import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

import * as commandCodeSession from "../../lib/commandCodeSession.ts";
import * as commandCodeUsage from "../../lib/commandCodeUsage.ts";
import * as codexUsage from "../../lib/codexUsage.ts";

function compile(path, dependencies) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const exports = {};
  new Function("require", "exports", output)((id) => {
    assert.ok(Object.hasOwn(dependencies, id), `Unexpected import: ${id}`);
    return dependencies[id];
  }, exports);
  return exports;
}

test("quota refresh writes Command Code's three real meters without exposing its API key", async () => {
  const storedCredential = commandCodeSession.serializeCommandCodeCredential({
    apiKey: "cmd-test-key",
    userId: "user-123",
  });
  const snapshot = commandCodeUsage.normalizeCommandCodeUsage(
    {
      credits: {
        credits: { planId: "individual-pro", monthlyCredits: 15 },
        windowLimits: {
          fiveHour: { used: 0, cap: 16, resetAt: "2026-09-06T10:00:00.000Z" },
          weekly: { used: 40, cap: 40, resetAt: "2026-09-08T10:00:00.000Z" },
        },
      },
      subscription: { data: { planId: "individual-pro", currentPeriodEnd: "2026-10-02T00:00:00.000Z" } },
    },
    "fixture",
  );
  snapshot.fetchedAt = "2026-09-06T08:00:00.000Z";

  const writes = [];
  let requestedCredential = null;
  const deps = {
    "next/server": { NextResponse: Response },
    "node-appwrite": { Query: {} },
    "../_lib/appwriteClient": {
      createAppwrite: () => ({
        databaseId: "db",
        databases: {
          updateDocument: async ({ documentId, data }) => {
            writes.push({ documentId, data });
            return { $id: documentId, ...data };
          },
        },
      }),
    },
    "../_lib/managementTables": {
      findManagementTable: async () => ({ $id: "quota", attributes: [{ key: "usageSyncedAt", status: "available" }] }),
    },
    "../_lib/listAllDocuments": {
      listAllDocuments: async () => [{
        $id: "command-code",
        name: "Command Code",
        account: "example",
        serviceType: "ai",
        accessToken: storedCredential,
      }],
    },
    "../_lib/commandCodeClient": {
      loadCommandCodeSnapshot: async (credential) => {
        requestedCredential = credential;
        return { ok: true, snapshot };
      },
    },
    "../../../lib/commandCodeSession": commandCodeSession,
    "../../../lib/commandCodeUsage": commandCodeUsage,
    "../../../lib/codexUsage": { ...codexUsage, isUsageStale: () => true },
    "../../../lib/claudeSession": { readStoredClaudeCredential: () => null },
    "../../../lib/grokSession": { readStoredGrokCredential: () => null },
    "../../../lib/chatgptSession": { readStoredCredential: () => null },
    "../../../lib/mindvideoPoints": { isMindvideoImageService: () => false },
    "../../../lib/oiioiiPoints": { isOiioiiService: () => false },
    "../_lib/quotaSanitize": { sanitizeQuotaRow: (row) => row },
    "../_lib/codexClient": {},
    "../_lib/claudeClient": {},
    "../_lib/grokClient": {},
    "../_lib/litmediaClient": {},
    "../_lib/mindvideoClient": {},
    "../_lib/oiioiiClient": {},
    "../../../lib/claudeUsage": {},
    "../../../lib/grokUsage": {},
    "../../../lib/litmediaPoints": {},
  };

  const route = compile("../../app/api/quota-refresh/route.js", deps);
  const response = await route.POST(new Request("https://example.com/api/quota-refresh", {
    method: "POST",
    body: '{"force":true}',
  }));

  assert.equal(response.status, 200);
  assert.deepEqual(requestedCredential, { apiKey: "cmd-test-key", userId: "user-123", userName: undefined, keyName: undefined, authenticatedAt: undefined });
  assert.deepEqual(writes, [{
    documentId: "command-code",
    data: {
      ratio5h: 100,
      expiry5h: "18:00",
      ratioWeek: 0,
      expiryWeek: "2026-09-08",
      ratioMonth: 50,
      expiryMonth: "2026-10-02",
      usageSyncedAt: "2026-09-06T08:00:00.000Z",
    },
  }]);
  const body = await response.json();
  assert.equal(body.updated, 1);
  assert.equal(JSON.stringify(body).includes("cmd-test-key"), false);
});
