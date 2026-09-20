import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listAllDocuments } from "../../app/api/_lib/listAllDocuments.js";

/** Stand-in for node-appwrite's Query, recording what each page asked for. */
const Query = {
  limit: (n) => ({ k: "limit", n }),
  offset: (n) => ({ k: "offset", n }),
  cursorAfter: (id) => ({ k: "cursorAfter", id }),
  orderAsc: (field) => ({ k: "orderAsc", field }),
};

/**
 * Fake Appwrite database holding `total` documents.
 * @param {{ reportTotal?: boolean, overReportBy?: number }} [options]
 */
function makeDatabase(total, options = {}) {
  const { reportTotal = true, overReportBy = 0 } = options;
  const docs = Array.from({ length: total }, (_, i) => ({ $id: `d${i}` }));
  const calls = [];
  let inFlight = 0;
  let peakInFlight = 0;

  return {
    calls,
    peakInFlight: () => peakInFlight,
    databases: {
      async listDocuments(_databaseId, _collectionId, queries) {
        inFlight += 1;
        peakInFlight = Math.max(peakInFlight, inFlight);

        const limit = queries.find((q) => q.k === "limit").n;
        const offset = queries.find((q) => q.k === "offset");
        const cursor = queries.find((q) => q.k === "cursorAfter");

        let start = 0;
        if (offset) start = offset.n;
        else if (cursor) start = docs.findIndex((d) => d.$id === cursor.id) + 1;

        calls.push({ start, limit, queries });
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;

        return {
          documents: docs.slice(start, start + limit),
          ...(reportTotal ? { total: total + overReportBy } : {}),
        };
      },
    },
  };
}

const idsUpTo = (n) => Array.from({ length: n }, (_, i) => `d${i}`);

describe("listAllDocuments", () => {
  it("makes a single request for a table smaller than one page", async () => {
    const harness = makeDatabase(42);
    const docs = await listAllDocuments(harness.databases, "db", "col", { Query });

    assert.equal(docs.length, 42);
    assert.equal(harness.calls.length, 1, "a short table must not be paged");
  });

  it("makes a single request when the table is exactly one page", async () => {
    const harness = makeDatabase(100);
    const docs = await listAllDocuments(harness.databases, "db", "col", { Query });

    assert.equal(docs.length, 100);
    assert.equal(harness.calls.length, 1);
  });

  it("fetches the remaining pages in parallel, preserving order", async () => {
    const harness = makeDatabase(950);
    const docs = await listAllDocuments(harness.databases, "db", "col", { Query });

    assert.deepEqual(docs.map((d) => d.$id), idsUpTo(950));
    assert.equal(harness.calls.length, 10, "one first page plus nine offset pages");
    assert.ok(
      harness.peakInFlight() > 1,
      `expected overlapping requests, peak was ${harness.peakInFlight()}`
    );
  });

  it("carries extra queries such as sorting on every page", async () => {
    const harness = makeDatabase(300);
    const sorted = [];
    const databases = {
      listDocuments: (databaseId, collectionId, queries) => {
        sorted.push(queries.some((q) => q.k === "orderAsc"));
        return harness.databases.listDocuments(databaseId, collectionId, queries);
      },
    };

    await listAllDocuments(databases, "db", "col", { Query }, [Query.orderAsc("todate")]);

    assert.ok(sorted.length > 1);
    assert.ok(sorted.every(Boolean), "every page must carry the sort query");
  });

  it("falls back to cursor paging when the total is not reported", async () => {
    const harness = makeDatabase(250, { reportTotal: false });
    const docs = await listAllDocuments(harness.databases, "db", "col", { Query });

    assert.deepEqual(docs.map((d) => d.$id), idsUpTo(250));
  });

  it("de-duplicates when rows shift during parallel paging", async () => {
    // An over-reported total makes the offset pages overlap at the tail.
    const harness = makeDatabase(250, { overReportBy: 60 });
    const docs = await listAllDocuments(harness.databases, "db", "col", { Query });
    const ids = docs.map((d) => d.$id);

    assert.equal(new Set(ids).size, ids.length, "no duplicate $id may be returned");
  });
});
