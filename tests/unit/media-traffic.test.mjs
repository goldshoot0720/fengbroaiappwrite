import assert from "node:assert/strict";
import test from "node:test";

class MemoryStorage {
  values = new Map();

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

test("records the full media size from Content-Range when HEAD has no size", async () => {
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  globalThis.window = { localStorage, sessionStorage, dispatchEvent() {} };

  const calls = [];
  globalThis.fetch = async (_url, init = {}) => {
    calls.push(init);
    if (init.method === "HEAD") return new Response(null, { status: 405 });
    return new Response(null, {
      status: 206,
      headers: { "content-range": "bytes 0-0/273430000" },
    });
  };

  const { readMediaTraffic, recordRemoteMediaTraffic } = await import("../../lib/mediaTraffic.ts");
  await recordRemoteMediaTraffic("music", "playback", "/api/media-proxy?track=1");

  assert.deepEqual(calls, [{ method: "HEAD" }, { headers: { Range: "bytes=0-0" } }]);
  assert.equal(readMediaTraffic().categories.music, 273430000);
  assert.equal(readMediaTraffic().actions.playback, 273430000);
});

test("tracks separate actions for the same file and deduplicates concurrent transfers", async () => {
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  globalThis.window = { localStorage, sessionStorage, dispatchEvent() {} };

  let headCalls = 0;
  globalThis.fetch = async (_url, init = {}) => {
    if (init.method === "HEAD") {
      headCalls += 1;
      return new Response(null, {
        status: 200,
        headers: { "content-length": "1024" },
      });
    }
    throw new Error("unexpected range request");
  };

  const { readMediaTraffic, recordRemoteMediaTraffic } = await import("../../lib/mediaTraffic.ts");
  const url = "/api/media-proxy?track=shared";

  await Promise.all([
    recordRemoteMediaTraffic("music", "playback", url),
    recordRemoteMediaTraffic("music", "playback", url),
  ]);
  await recordRemoteMediaTraffic("music", "browse", url);

  const ledger = readMediaTraffic();
  assert.equal(headCalls, 2);
  assert.equal(ledger.total, 2048);
  assert.equal(ledger.categories.music, 2048);
  assert.equal(ledger.actions.playback, 1024);
  assert.equal(ledger.actions.browse, 1024);
});
