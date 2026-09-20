import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";

function memoryStore() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
    clear: () => {
      map.clear();
    },
  };
}

const sessionStorage = memoryStore();
const localStorage = memoryStore();
globalThis.sessionStorage = sessionStorage;
globalThis.localStorage = localStorage;
globalThis.window = { sessionStorage, localStorage };

const {
  dedupedGet,
  invalidateRequestCache,
  readEndpointCache,
  requestCacheKey,
  writeEndpointCache,
} = await import("../../lib/requestCache.ts");

describe("requestCacheKey", () => {
  it("drops Appwrite connection params but keeps the refresh token", () => {
    assert.equal(
      requestCacheKey("/api/food?t=123&_key=SECRET&_project=p&_database=d"),
      "/api/food?t=123"
    );
  });

  it("never lets the API key reach the cache key", () => {
    const key = requestCacheKey("/api/food?_key=SUPERSECRET");
    assert.ok(!key.includes("SUPERSECRET"));
    assert.equal(key, "/api/food");
  });

  it("keeps different refresh tokens apart", () => {
    assert.notEqual(requestCacheKey("/api/food?t=1"), requestCacheKey("/api/food?t=2"));
  });
});

describe("dedupedGet", () => {
  afterEach(() => invalidateRequestCache());

  it("collapses concurrent GETs of the same URL into one request", async () => {
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return ["a"];
    };

    const results = await Promise.all([
      dedupedGet("/api/food", fetcher),
      dedupedGet("/api/food", fetcher),
      dedupedGet("/api/food", fetcher),
      dedupedGet("/api/food", fetcher),
    ]);

    assert.equal(calls, 1, "four callers should share one request");
    for (const result of results) assert.deepEqual(result, ["a"]);
  });

  it("shares a request across URLs differing only by connection params", async () => {
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return ["x"];
    };

    await Promise.all([
      dedupedGet("/api/food?_key=K1&_project=p", fetcher),
      dedupedGet("/api/food?_project=p&_key=K1", fetcher),
    ]);

    assert.equal(calls, 1);
  });

  it("refetches when the refresh token changes", async () => {
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return [];
    };

    await Promise.all([
      dedupedGet("/api/food?t=1", fetcher),
      dedupedGet("/api/food?t=2", fetcher),
    ]);

    assert.equal(calls, 2, "a bumped refresh key must force a real refetch");
  });

  it("serves a repeat call from the short TTL cache", async () => {
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return ["v"];
    };

    await dedupedGet("/api/bank", fetcher);
    await dedupedGet("/api/bank", fetcher);
    assert.equal(calls, 1);
  });

  it("refetches after invalidation, which every write triggers", async () => {
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return ["v"];
    };

    await dedupedGet("/api/bank", fetcher);
    invalidateRequestCache();
    await dedupedGet("/api/bank", fetcher);
    assert.equal(calls, 2, "a write must not leave stale data readable");
  });

  it("hands each caller its own array, so an in-place sort cannot corrupt the cache", async () => {
    const fetcher = async () => [3, 1, 2];

    const [a, b] = await Promise.all([
      dedupedGet("/api/sortable", fetcher),
      dedupedGet("/api/sortable", fetcher),
    ]);
    assert.notEqual(a, b, "concurrent callers must not share one array instance");

    a.sort((x, y) => x - y);
    assert.deepEqual(b, [3, 1, 2], "one caller sorting must not reorder another's copy");

    const later = await dedupedGet("/api/sortable", fetcher);
    assert.deepEqual(later, [3, 1, 2], "the cached copy must survive a caller's sort");
  });

  it("propagates failures to every waiter without caching them", async () => {
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      throw new Error("network down");
    };

    await Promise.all([
      assert.rejects(dedupedGet("/api/x", fetcher), /network down/),
      assert.rejects(dedupedGet("/api/x", fetcher), /network down/),
    ]);
    assert.equal(calls, 1, "waiters share the in-flight request");

    await assert.rejects(dedupedGet("/api/x", fetcher), /network down/);
    assert.equal(calls, 2, "a failure must not be cached");
  });
});

describe("endpoint session cache", () => {
  afterEach(() => sessionStorage.clear());

  it("round-trips by endpoint path, ignoring the query string", () => {
    writeEndpointCache("/api/food", [{ $id: "1" }]);
    assert.deepEqual(readEndpointCache("/api/food?t=999"), [{ $id: "1" }]);
  });

  it("skips oversized payloads instead of filling the quota", () => {
    const huge = Array.from({ length: 40_000 }, (_, i) => ({ $id: `${"x".repeat(20)}${i}` }));
    writeEndpointCache("/api/video", huge);
    assert.equal(readEndpointCache("/api/video"), null);
  });

  it("ignores entries past the max age", () => {
    writeEndpointCache("/api/music", [1]);
    assert.equal(readEndpointCache("/api/music", -1), null);
  });
});
