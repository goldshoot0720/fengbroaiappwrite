import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

function compile(path, dependencies, globals = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const exports = {};
  new Function("require", "exports", ...Object.keys(globals), output)(
    (id) => {
      assert.ok(Object.hasOwn(dependencies, id), `Unexpected import: ${id}`);
      return dependencies[id];
    },
    exports,
    ...Object.values(globals),
  );
  return exports;
}

test("Command Code usage client follows the CLI's authenticated read-only endpoints", async () => {
  const requests = [];
  const client = compile(
    "../../app/api/_lib/commandCodeClient.js",
    {
      "../../../lib/commandCodeUsage": {
        normalizeCommandCodeUsage: (payload, source) => ({ payload, source, fetchedAt: "2026-09-06T12:00:00.000Z" }),
      },
    },
    {
      fetch: async (url, options) => {
        const requestUrl = new URL(url);
        requests.push({ path: requestUrl.pathname, query: requestUrl.searchParams, options });
        if (requestUrl.pathname === "/alpha/whoami") {
          return Response.json({ org: { id: "org-1" } });
        }
        if (requestUrl.pathname === "/alpha/billing/credits") {
          return Response.json({ credits: { planId: "individual-pro", monthlyCredits: 15 } });
        }
        if (requestUrl.pathname === "/alpha/billing/subscriptions") {
          return Response.json({ data: { planId: "individual-pro", status: "active" } });
        }
        return new Response("not found", { status: 404 });
      },
    },
  );

  const result = await client.loadCommandCodeSnapshot({ apiKey: "cmd-test-key" });

  assert.equal(result.ok, true);
  assert.deepEqual(requests.map((request) => request.path), [
    "/alpha/whoami",
    "/alpha/billing/credits",
    "/alpha/billing/subscriptions",
  ]);
  assert.equal(requests[0].query.get("limits"), "1");
  assert.equal(requests[1].query.get("orgId"), "org-1");
  assert.equal(requests[2].query.get("orgId"), "org-1");
  assert.equal(requests[0].options.headers.Authorization, "Bearer cmd-test-key");
});
