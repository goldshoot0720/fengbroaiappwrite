import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import JSZip from "jszip";
import * as points from "../../lib/oiioiiPoints.ts";

function compile(path, dependencies, globals = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const exports = {};
  new Function("require", "exports", ...Object.keys(globals), output)((id) => {
    assert.ok(Object.hasOwn(dependencies, id), `Unexpected import: ${id}`);
    return dependencies[id];
  }, exports, ...Object.values(globals));
  return exports;
}

test("artifact loader reads latest report, skips expired artifacts, caches and forces refresh", async () => {
  const zip = new JSZip();
  zip.file("oiioii-daily-summary.json", JSON.stringify({ rows: [], generatedAt: "2026-09-06T08:00:00Z" }));
  const bytes = await zip.generateAsync({ type: "uint8array" });
  const calls = [];
  const client = compile("../../app/api/_lib/oiioiiClient.js", {
    jszip: JSZip, "../../../lib/oiioiiPoints": points,
  }, {
    process: { env: { OIIOII_GITHUB_TOKEN: "test-only" } },
    fetch: async (url, options) => {
      calls.push(url);
      assert.equal(options.headers.Authorization, "Bearer test-only");
      if (url.includes("/workflows/")) return Response.json({ workflow_runs: [{ id: 22 }, { id: 21 }] });
      if (url.includes("/runs/22/")) return Response.json({ artifacts: [{ name: "oiioii-claim-report", expired: true }] });
      if (url.includes("/runs/21/")) return Response.json({ artifacts: [{ name: "oiioii-claim-report", id: 99 }] });
      assert.ok(url.endsWith("/artifacts/99/zip"));
      return new Response(bytes);
    },
  });
  const result = await client.loadOiioiiReport({ now: 1000 });
  assert.ok(result.source.endsWith("/runs/21"));
  assert.equal(calls.length, 4);
  assert.equal(await client.loadOiioiiReport({ now: 2000 }), result);
  assert.equal(calls.length, 4);
  await client.loadOiioiiReport({ now: 3000, force: true });
  assert.equal(calls.length, 8);
});

test("missing GitHub credentials are actionable and never trigger network requests", async () => {
  const client = compile("../../app/api/_lib/oiioiiClient.js", {
    jszip: JSZip, "../../../lib/oiioiiPoints": points,
  }, { process: { env: {} }, fetch: () => assert.fail("must not fetch") });
  await assert.rejects(client.loadOiioiiReport(), /OIIOII_GITHUB_TOKEN/);
});

test("quota refresh dispatches OiiOii ahead of tokens, writes zero, preserves newer or failed points", async () => {
  const timestamp = "2026-09-06T08:00:00.000Z";
  const rows = [
    { $id: "zero", name: "OiiOii", account: "account-a", serviceType: "ai", accessToken: "not-a-codex-token" },
    { $id: "newer", name: "OiiOii", account: "account-a", pointsSyncedAt: "2026-09-07T08:00:00Z" },
    { $id: "failed", name: "OiiOii", account: "account-b", quotaPoints: 88 },
    { $id: "unknown", name: "OiiOii", account: "missing" },
  ];
  const writes = [];
  let loads = 0;
  const deps = {
    "next/server": { NextResponse: Response }, "node-appwrite": { Query: {} },
    "../_lib/appwriteClient": { createAppwrite: () => ({ databaseId: "db", databases: {
      updateDocument: async ({ documentId, data }) => { writes.push({ documentId, data }); return { $id: documentId, ...data }; },
    } }) },
    "../_lib/managementTables": { findManagementTable: async () => ({ $id: "quota" }) },
    "../_lib/listAllDocuments": { listAllDocuments: async () => rows },
    "../_lib/oiioiiClient": { loadOiioiiReport: async () => {
      loads++;
      return { source: "fixture", report: points.parseOiioiiReport({ generatedAt: timestamp, rows: [
        { account: 1, name: "account-a", status: "checked_in", currentPoints: 0, finishedAt: timestamp },
        { account: 2, name: "account-b", status: "failed", currentPoints: 7, finishedAt: timestamp },
      ] }) };
    } },
    "../../../lib/oiioiiPoints": points,
    "../_lib/quotaSanitize": { sanitizeQuotaRow: (row) => row },
    "../../../lib/mindvideoPoints": { isMindvideoImageService: () => false },
    "../../../lib/codexUsage": { isUsageStale: () => true },
  };
  for (const id of ["../_lib/codexClient", "../_lib/claudeClient", "../_lib/litmediaClient", "../_lib/mindvideoClient",
    "../../../lib/chatgptSession", "../../../lib/claudeSession", "../../../lib/claudeUsage", "../../../lib/litmediaPoints"]) deps[id] = {};
  const route = compile("../../app/api/quota-refresh/route.js", deps);
  const response = await route.POST(new Request("https://example.com/api/quota-refresh", { method: "POST", body: '{"force":true}' }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(loads, 1);
  assert.deepEqual(writes, [{ documentId: "zero", data: { quotaPoints: 0, pointsSyncedAt: timestamp } }]);
  assert.deepEqual(body.results.map((item) => item.reason).filter(Boolean).sort(), ["no-points", "oiioii-account-not-found", "older-report"]);
});
