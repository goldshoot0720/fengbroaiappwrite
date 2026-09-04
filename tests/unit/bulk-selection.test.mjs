import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deleteByIds,
  isAllVisibleSelected,
  nextSelectAllState,
  setManySelected,
  toggleSelectedId,
} from "../../lib/bulkSelection.ts";

describe("bulk selection", () => {
  it("enters selection mode and selects every visible id", () => {
    const next = nextSelectAllState(false, new Set(), ["a", "b", "c"]);
    assert.equal(next.selectionMode, true);
    assert.deepEqual([...next.selectedIds], ["a", "b", "c"]);
  });

  it("clears selection when every visible id is already selected", () => {
    const next = nextSelectAllState(true, new Set(["a", "b", "c"]), ["a", "b", "c"]);
    assert.equal(next.selectionMode, false);
    assert.equal(next.selectedIds.size, 0);
  });

  it("fills in remaining visible ids when only some are selected", () => {
    const next = nextSelectAllState(true, new Set(["a"]), ["a", "b", "c"]);
    assert.equal(next.selectionMode, true);
    assert.deepEqual([...next.selectedIds].sort(), ["a", "b", "c"]);
  });

  it("toggles a single id on and off", () => {
    const added = toggleSelectedId(new Set(), "a");
    assert.equal(added.has("a"), true);
    const removed = toggleSelectedId(added, "a");
    assert.equal(removed.has("a"), false);
  });

  it("adds or removes a group of ids", () => {
    const added = setManySelected(new Set(["keep"]), ["a", "b"], true);
    assert.deepEqual([...added].sort(), ["a", "b", "keep"]);
    const removed = setManySelected(added, ["a", "keep"], false);
    assert.deepEqual([...removed], ["b"]);
  });

  it("reports whether every visible id is selected", () => {
    assert.equal(isAllVisibleSelected(new Set(["a", "b"]), ["a", "b"]), true);
    assert.equal(isAllVisibleSelected(new Set(["a"]), ["a", "b"]), false);
    assert.equal(isAllVisibleSelected(new Set(["a"]), []), false);
  });

  it("counts failures without aborting the remaining deletes", async () => {
    const seen = [];
    const result = await deleteByIds(["ok", "bad", "also-ok"], async (id) => {
      seen.push(id);
      if (id === "bad") throw new Error("nope");
    });
    assert.deepEqual(seen.sort(), ["also-ok", "bad", "ok"]);
    assert.equal(result.failCount, 1);
  });
});
