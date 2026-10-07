import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCollectionStatsRow,
  normalizeCollection,
  pickNamedCollection,
  showsCreateButton,
  showsRebuildButton,
} from "../../lib/collectionStats.js";
import { createBlockedByCleanup, deleteNamedCollections, waitUntilAttributesReady } from "../../app/api/_lib/collectionInventory.js";

const sitevisitAttrs = (status) => [
  { key: "count", type: "integer", status },
  { key: "lastVisitAt", type: "datetime", status: "available" },
  { key: "currentStreak", type: "integer", status: "available" },
  { key: "lastVisitDate", type: "string", status: "available", size: 10 },
];

describe("sitevisit settings row", () => {
  it("does not offer 建立 when the table exists but its columns are not readable", () => {
    const row = buildCollectionStatsRow({
      name: "sitevisit",
      collection: {
        $id: "6abcb64c0025e45a49dd",
        name: "sitevisit",
        attributes: sitevisitAttrs("processing"),
      },
      documentsError: true,
      fallbackColumnCount: 4,
    });

    assert.equal(row.collectionId, "6abcb64c0025e45a49dd");
    assert.equal(row.columnCount, 4);
    assert.equal(row.error, false);
    assert.equal(row.attributesPending, true);
    assert.equal(showsCreateButton(row), false);
    assert.equal(showsRebuildButton(row), true);
  });

  it("treats a not-available read as columns still starting, and keeps a real read error", () => {
    const pending = buildCollectionStatsRow({
      name: "sitevisit",
      collection: {
        $id: "6ac5fea300114606b542",
        name: "sitevisit",
        attributes: sitevisitAttrs("available"),
      },
      documentsError: true,
      readError: 'Attribute "count" is not available. Please try again later.',
    });
    assert.equal(pending.attributesPending, true);
    assert.equal(pending.documentsError, false);
    assert.equal(showsRebuildButton(pending), true);
    assert.match(pending.readError, /not available/);

    const blocked = buildCollectionStatsRow({
      name: "sitevisit",
      collection: {
        $id: "6ac5fea300114606b542",
        name: "sitevisit",
        attributes: sitevisitAttrs("available"),
      },
      documentsError: true,
      readError: "Server Error",
    });
    assert.equal(blocked.documentsError, true);
    assert.equal(blocked.attributesPending, false);
    assert.equal(blocked.readError, "Server Error");
    assert.equal(showsCreateButton(blocked), false);
  });

  it("stops a new create when an old same-named table cannot be deleted", () => {
    assert.equal(createBlockedByCleanup({ removed: 1, failures: [] }), null);
    const message = createBlockedByCleanup({
      removed: 0,
      failures: [{ id: "6abf6c5b00145975e47b", message: "Server Error" }],
    });
    assert.match(message, /6abf6c5b00145975e47b/);
    assert.match(message, /已停止建立/);
  });

  it("counts Tables API columns when the old attributes array is empty", () => {
    const collection = normalizeCollection({
      $id: "6abf6c5b00145975e47b",
      name: "sitevisit",
      attributes: [],
      columns: sitevisitAttrs("available"),
    });
    const row = buildCollectionStatsRow({ name: "sitevisit", collection });
    assert.equal(row.columnCount, 4);
    assert.equal(row.error, false);
    assert.equal(showsCreateButton(row), false);
    assert.equal(showsRebuildButton(row), false);
  });

  it("still offers 建立 only when the table is missing", () => {
    const row = buildCollectionStatsRow({
      name: "sitevisit",
      collection: null,
      fallbackColumnCount: 4,
    });
    assert.equal(row.error, true);
    assert.equal(row.collectionId, undefined);
    assert.equal(showsCreateButton(row), true);
    assert.equal(showsRebuildButton(row), false);
  });

  it("prefers a ready duplicate over a newer stuck sitevisit", () => {
    const picked = pickNamedCollection(
      [
        {
          name: "sitevisit",
          $id: "6abcb64c0025e45a49dd",
          $updatedAt: "2026-10-07T15:40:00.000Z",
          attributes: sitevisitAttrs("failed"),
        },
        {
          name: "sitevisit",
          $id: "6ac5f6fd0016accdf8f5",
          $updatedAt: "2026-10-07T15:38:00.000Z",
          attributes: sitevisitAttrs("available"),
        },
      ],
      "sitevisit",
    );
    assert.equal(picked.$id, "6ac5f6fd0016accdf8f5");
  });

  it("deletes a same-named table that sits past the first page", async () => {
    const collections = Array.from({ length: 30 }, (_, index) => ({
      $id: `other-${index}`,
      name: `other-${index}`,
    }));
    collections.push({ $id: "6abcb64c0025e45a49dd", name: "sitevisit", attributes: sitevisitAttrs("stuck") });
    const deleted = [];
    await deleteNamedCollections(
      {
        async deleteCollection(_databaseId, id) {
          deleted.push(id);
        },
        async deleteAttribute() {},
      },
      "main",
      "sitevisit",
      { collections },
    );
    assert.deepEqual(deleted, ["6abcb64c0025e45a49dd"]);
  });

  it("drops stuck columns and retries when the first delete fails", async () => {
    const deletedAttrs = [];
    const deleted = [];
    let attempts = 0;
    const result = await deleteNamedCollections(
      {
        async deleteCollection(_databaseId, id) {
          attempts += 1;
          if (attempts === 1) throw new Error("attribute still processing");
          deleted.push(id);
        },
        async deleteAttribute(_databaseId, _id, key) {
          deletedAttrs.push(key);
        },
      },
      "main",
      "sitevisit",
      {
        collections: [
          { $id: "stuck", name: "sitevisit", attributes: [{ key: "count", status: "stuck" }] },
        ],
      },
    );
    assert.deepEqual(deletedAttrs, ["count"]);
    assert.deepEqual(deleted, ["stuck"]);
    assert.equal(result.failures.length, 0);
    assert.equal(result.removed, 1);
  });

  it("waits until the new columns are available before reporting success", async () => {
    const payloads = [
      [{ key: "lastVisitAt", type: "datetime", status: "available" }],
      sitevisitAttrs("available"),
    ];
    const result = await waitUntilAttributesReady(
      {
        async getCollection() {
          return { $id: "new", attributes: payloads.shift() || sitevisitAttrs("available") };
        },
      },
      "main",
      "new",
      ["count", "lastVisitAt", "currentStreak", "lastVisitDate"],
      { timeoutMs: 1000, intervalMs: 0, sleep: async () => {} },
    );
    assert.equal(result.ok, true);
  });

  it("reports a failed column instead of a successful create", async () => {
    const result = await waitUntilAttributesReady(
      {
        async getCollection() {
          return { $id: "new", attributes: sitevisitAttrs("failed") };
        },
      },
      "main",
      "new",
      ["count", "lastVisitAt", "currentStreak", "lastVisitDate"],
      { timeoutMs: 0, intervalMs: 0, sleep: async () => {} },
    );
    assert.equal(result.ok, false);
    assert.match(result.error, /count/);
  });
});
