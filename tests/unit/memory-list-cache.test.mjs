import assert from "node:assert/strict";
import { beforeEach, before, describe, it } from "node:test";
import {
  clearMemoryLists,
  MEMORY_LIST_FRESH_MS,
  readMemoryList,
  writeMemoryList,
} from "../../lib/memoryListCache.ts";

function memoryStore() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    clear: () => map.clear(),
  };
}

describe("memory list cache", () => {
  before(() => {
    globalThis.window = { localStorage: memoryStore() };
  });

  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("NEXT_PUBLIC_APPWRITE_PROJECT_ID", "p1");
    clearMemoryLists();
  });

  it("returns nothing before the first load", () => {
    assert.equal(readMemoryList("/api/subscription"), null);
  });

  it("is fresh right after a write and stale after the fresh window", () => {
    writeMemoryList("/api/subscription", [{ $id: "a" }], 1_000);
    assert.deepEqual(readMemoryList("/api/subscription", undefined, 1_500), { data: [{ $id: "a" }], fresh: true });
    const later = readMemoryList("/api/subscription", undefined, 1_000 + MEMORY_LIST_FRESH_MS);
    assert.equal(later.fresh, false);
    assert.deepEqual(later.data, [{ $id: "a" }]);
  });

  it("marks the list stale when another tab bumped the refresh key", () => {
    writeMemoryList("/api/bank", [{ $id: "a" }], 1_000);
    window.localStorage.setItem("bank_refresh_key", "2000");
    assert.equal(readMemoryList("/api/bank", "bank_refresh_key", 2_500).fresh, false);
  });

  it("never serves another Appwrite account's data", () => {
    writeMemoryList("/api/bank", [{ $id: "a" }], 1_000);
    window.localStorage.setItem("NEXT_PUBLIC_APPWRITE_PROJECT_ID", "p2");
    assert.equal(readMemoryList("/api/bank", undefined, 1_100), null);
  });

  it("drops the list after an account switch", () => {
    writeMemoryList("/api/bank", [{ $id: "a" }], 1_000);
    window.localStorage.setItem("appwrite_account_switched", "1500");
    assert.equal(readMemoryList("/api/bank", undefined, 1_600), null);
  });

  it("clearMemoryLists empties everything", () => {
    writeMemoryList("/api/bank", [{ $id: "a" }]);
    clearMemoryLists();
    assert.equal(readMemoryList("/api/bank"), null);
  });
});
