import test from "node:test";
import assert from "node:assert/strict";
import {
  createWriteTracker,
  patchItem,
  removeItem,
  replaceItem,
  restoreItem,
  upsertItem,
} from "@/lib/optimisticList";

const list = () => [
  { $id: "a", name: "A", price: 1 },
  { $id: "b", name: "B", price: 2 },
  { $id: "c", name: "C", price: 3 },
];

test("patchItem merges the patch without mutating and returns the previous item", () => {
  const original = list();
  const { list: next, previous } = patchItem(original, "b", { price: 20 });
  assert.deepEqual(next[1], { $id: "b", name: "B", price: 20 });
  assert.equal(previous, original[1]);
  assert.equal(original[1].price, 2);
  assert.notEqual(next, original);
});

test("patchItem leaves the list alone for an unknown id", () => {
  const original = list();
  const result = patchItem(original, "zzz", { price: 9 });
  assert.equal(result.list, original);
  assert.equal(result.previous, undefined);
});

test("patchItem never lets the patch change $id", () => {
  const { list: next } = patchItem(list(), "a", { $id: "x", name: "A2" });
  assert.equal(next[0].$id, "a");
});

test("replaceItem swaps by id and ignores rows deleted meanwhile", () => {
  const confirmed = { $id: "b", name: "B!", price: 22 };
  assert.deepEqual(replaceItem(list(), "b", confirmed)[1], confirmed);
  const withoutB = list().filter((item) => item.$id !== "b");
  assert.equal(replaceItem(withoutB, "b", confirmed), withoutB);
  const original = list();
  assert.equal(replaceItem(original, "b", undefined), original);
});

test("removeItem + restoreItem puts the row back where it was", () => {
  const { list: next, removed, index } = removeItem(list(), "b");
  assert.deepEqual(next.map((item) => item.$id), ["a", "c"]);
  assert.equal(index, 1);
  assert.deepEqual(restoreItem(next, removed, index).map((item) => item.$id), ["a", "b", "c"]);
});

test("restoreItem does not duplicate a row that came back from a reload", () => {
  const { removed, index } = removeItem(list(), "b");
  const reloaded = list();
  assert.equal(restoreItem(reloaded, removed, index), reloaded);
});

test("restoreItem clamps the index when the list shrank", () => {
  const { removed } = removeItem(list(), "c");
  assert.deepEqual(restoreItem([{ $id: "a" }], removed, 5).map((item) => item.$id), ["a", "c"]);
});

test("upsertItem appends new rows and replaces existing ones", () => {
  assert.deepEqual(upsertItem(list(), { $id: "d", name: "D", price: 4 }).map((item) => item.$id), ["a", "b", "c", "d"]);
  const replaced = upsertItem(list(), { $id: "a", name: "A!", price: 1 });
  assert.equal(replaced.length, 3);
  assert.equal(replaced[0].name, "A!");
});

test("WriteTracker only lets the latest write per id settle", () => {
  const tracker = createWriteTracker();
  const first = tracker.begin("a");
  const second = tracker.begin("a");
  const other = tracker.begin("b");
  assert.equal(tracker.isLatest("a", first), false);
  assert.equal(tracker.isLatest("a", second), true);
  assert.equal(tracker.isLatest("b", other), true);

  // An older write finishing must not clear the newer one.
  tracker.finish("a", first);
  assert.equal(tracker.isLatest("a", second), true);
  tracker.finish("a", second);
  assert.equal(tracker.isLatest("a", second), false);
});
