import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collectPages } from "../../lib/collectionPage.js";

describe("collection pages", () => {
  it("keeps reading after a 25-row page when the server total is larger", async () => {
    const many = Array.from({ length: 33 }, (_, index) => ({
      $id: `id-${index}`,
      name: `table-${index}`,
    }));
    many[30] = { $id: "6ac5fea300114606b542", name: "sitevisit", attributes: [] };

    const calls = [];
    const list = await collectPages(async ({ limit, offset }) => {
      calls.push({ limit, offset });
      const pageSize = Math.min(limit, 25);
      return {
        total: many.length,
        collections: many.slice(offset, offset + pageSize),
      };
    });

    assert.equal(
      list.find((col) => col.name === "sitevisit")?.$id,
      "6ac5fea300114606b542",
    );
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[1], { limit: 100, offset: 25 });
  });
});
