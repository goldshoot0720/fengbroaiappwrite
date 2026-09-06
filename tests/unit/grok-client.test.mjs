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

test("Grok 用量查詢會為空 protobuf 訊息送出 gRPC-Web frame", async () => {
  let request;
  const client = compile(
    "../../app/api/_lib/grokClient.js",
    { "./grokProtobuf": { decodeGrokCreditsResponse: () => ({ usageRatio: 12, resetsAtIso: null }) } },
    {
      fetch: async (url, options) => {
        request = { url, options };
        return new Response(new Uint8Array(), { status: 200 });
      },
    },
  );

  const result = await client.loadGrokSnapshot({
    accessToken: "test-access-token",
    expiresAt: Date.now() + 60 * 60 * 1000,
  });

  assert.equal(result.ok, true);
  assert.equal(request.url, "https://grok.com/grok_api_v2.GrokBuildBilling/GetGrokCreditsConfig");
  assert.equal(request.options.headers["Content-Type"], "application/grpc-web+proto");
  assert.deepEqual([...request.options.body], [0x00, 0x00, 0x00, 0x00, 0x00]);
});

test("Grok gRPC-Web trailer 的授權錯誤不會被誤報為解析失敗", async () => {
  const trailer = Buffer.from("grpc-status:16\r\ngrpc-message:Unauthenticated\r\n");
  const framedTrailer = Buffer.alloc(5 + trailer.length);
  framedTrailer[0] = 0x80;
  framedTrailer.writeUInt32BE(trailer.length, 1);
  trailer.copy(framedTrailer, 5);
  const client = compile(
    "../../app/api/_lib/grokClient.js",
    { "./grokProtobuf": { decodeGrokCreditsResponse: () => null } },
    { fetch: async () => new Response(framedTrailer, { status: 200 }) },
  );

  const result = await client.loadGrokSnapshot({
    accessToken: "test-access-token",
    expiresAt: Date.now() + 60 * 60 * 1000,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
  assert.match(result.error, /access token 無效/);
  assert.doesNotMatch(result.error, /無法解析/);
});
