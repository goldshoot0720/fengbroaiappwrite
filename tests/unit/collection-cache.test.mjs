import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { beforeEach, describe, it } from "node:test";

// appwriteClient.js 在 Next 內以 require 載入 node-appwrite；單元測試提供同樣的全域 require。
globalThis.require ??= createRequire(import.meta.url);
const { getCollectionId, clearCollectionCache } = await import(
  "../../app/api/_lib/appwriteClient.js"
);

/** 假的 Databases：記錄 listCollections 呼叫次數，並支援分頁。 */
function makeDatabases(collections, { project = "p1", endpoint = "https://e" } = {}) {
  const calls = [];
  return {
    calls,
    client: { config: { endpoint, project } },
    async listCollections(databaseId, queries = []) {
      const values = queries.map((q) => JSON.parse(q));
      const limit = values.find((q) => q.method === "limit")?.values?.[0] ?? 25;
      const offset = values.find((q) => q.method === "offset")?.values?.[0] ?? 0;
      calls.push({ databaseId, limit, offset });
      await new Promise((resolve) => setTimeout(resolve, 5));
      return {
        total: collections.length,
        collections: collections.slice(offset, offset + limit),
      };
    },
  };
}

const named = (name, id = `id_${name}`) => ({ $id: id, name });

describe("collection lookup cache", () => {
  beforeEach(() => clearCollectionCache());

  it("shares one listCollections call across concurrent lookups", async () => {
    const db = makeDatabases([named("food"), named("bank")]);
    const ids = await Promise.all([
      getCollectionId(db, "main", "food"),
      getCollectionId(db, "main", "bank"),
      getCollectionId(db, "main", "food"),
    ]);
    assert.deepEqual(ids, ["id_food", "id_bank", "id_food"]);
    assert.equal(db.calls.length, 1);
  });

  it("pages through more than 25 collections", async () => {
    const many = Array.from({ length: 130 }, (_, i) => named(`t${i}`));
    const db = makeDatabases(many);
    assert.equal(await getCollectionId(db, "main", "t129"), "id_t129");
    assert.equal(db.calls.length, 2);
  });

  it("keeps separate caches for projects that reuse a database id", async () => {
    const a = makeDatabases([named("food", "a_food")], { project: "A" });
    const b = makeDatabases([named("food", "b_food")], { project: "B" });
    assert.equal(await getCollectionId(a, "main", "food"), "a_food");
    assert.equal(await getCollectionId(b, "main", "food"), "b_food");
  });

  it("refetches once when a table is missing from the cache", async () => {
    const list = [named("food")];
    const db = makeDatabases(list);
    await getCollectionId(db, "main", "food");
    list.push(named("routine"));
    assert.equal(await getCollectionId(db, "main", "routine"), "id_routine");
    assert.equal(db.calls.length, 2);
    await assert.rejects(getCollectionId(db, "main", "nope"), /not found/);
  });

  it("clearCollectionCache(databaseId) drops every connection's entry", async () => {
    const db = makeDatabases([named("food")]);
    await getCollectionId(db, "main", "food");
    clearCollectionCache("main");
    await getCollectionId(db, "main", "food");
    assert.equal(db.calls.length, 2);
  });
});
