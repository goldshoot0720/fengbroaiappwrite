import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDailyComparisons,
  compareDailyItems,
  findSnapshotItem,
  isIndexName,
  toDailyItem,
} from "../../lib/financeDaily.ts";

const item = (over = {}) => ({
  id: "sox",
  name: "費城半導體指數",
  price: 10731.98,
  high52: 14655.29,
  low52: 6160.05,
  ...over,
});

describe("isIndexName", () => {
  it("keeps indices and drops individual stocks", () => {
    assert.equal(isIndexName("費城半導體指數"), true);
    assert.equal(isIndexName("KOSPI Index"), true);
    assert.equal(isIndexName("Nikkei 225 Index"), true);
    assert.equal(isIndexName("台積電"), false);
    assert.equal(isIndexName(""), false);
  });
});

describe("toDailyItem", () => {
  it("normalizes a quote into the stored shape", () => {
    assert.deepEqual(toDailyItem(item()), {
      id: "sox",
      name: "費城半導體指數",
      price: 10731.98,
      high52: 14655.29,
      low52: 6160.05,
    });
  });

  it("prefers displayName over name", () => {
    assert.equal(toDailyItem(item({ displayName: "SOX 指數" }))?.name, "SOX 指數");
  });

  it("drops entries with no 52-week range or no id", () => {
    assert.equal(toDailyItem(item({ high52: null, low52: null })), null);
    assert.equal(toDailyItem(item({ id: "" })), null);
    assert.equal(toDailyItem(item({ high52: "not-a-number" }))?.high52, null);
  });
});

describe("compareDailyItems", () => {
  it("flags a new high when today's 52W high is pushed up", () => {
    const result = compareDailyItems(
      item({ high52: 14655.29 }),
      item({ high52: 15000 }),
      "2026-10-22"
    );
    assert.equal(result?.newHigh, true);
    assert.equal(result?.newLow, false);
    assert.equal(result?.previousHigh52, 14655.29);
    assert.equal(result?.previousDateKey, "2026-10-22");
  });

  it("flags a new low when today's 52W low is pushed down", () => {
    const result = compareDailyItems(item({ low52: 6160.05 }), item({ low52: 6000 }), "2026-10-22");
    assert.equal(result?.newLow, true);
    assert.equal(result?.newHigh, false);
  });

  it("does not flag an unchanged range", () => {
    const result = compareDailyItems(item(), item(), "2026-10-22");
    assert.equal(result?.newHigh, false);
    assert.equal(result?.newLow, false);
  });

  it("ignores floating point noise", () => {
    // 同一數值重新抓取偶爾會多出尾差，不該被當成創新低。
    const result = compareDailyItems(item({ low52: 6160.05 }), item({ low52: 6160.050000001 }), "2026-10-22");
    assert.equal(result?.newLow, false);
  });

  it("returns null when either side is missing", () => {
    assert.equal(compareDailyItems(null, item(), "2026-10-22"), null);
    assert.equal(compareDailyItems(item(), null, "2026-10-22"), null);
  });

  it("never invents a record when a value is null", () => {
    const result = compareDailyItems(item({ high52: null }), item(), "2026-10-22");
    assert.equal(result?.newHigh, false);
  });
});

describe("buildDailyComparisons", () => {
  const previous = {
    dateKey: "2026-10-22",
    items: [
      { id: "sox", name: "SOX", price: 10000, high52: 14000, low52: 6000 },
      { id: "kospi", name: "KOSPI", price: 5000, high52: 9000, low52: 4000 },
    ],
  };

  it("keys the result by instrument id", () => {
    const today = [
      { id: "sox", name: "SOX", price: 15000, high52: 15000, low52: 6000 },
      { id: "kospi", name: "KOSPI", price: 5000, high52: 9000, low52: 4000 },
    ];
    const map = buildDailyComparisons(previous, today);
    assert.equal(map.sox.newHigh, true);
    assert.equal(map.kospi.newHigh, false);
    assert.equal(map.kospi.newLow, false);
  });

  it("skips instruments that were not recorded yesterday", () => {
    const map = buildDailyComparisons(previous, [
      { id: "n225", name: "N225", price: 1, high52: 2, low52: 1 },
    ]);
    assert.deepEqual(map, {});
  });

  it("returns nothing when there is no previous snapshot", () => {
    assert.deepEqual(buildDailyComparisons(null, [item()]), {});
  });

  it("finds a snapshot item by id", () => {
    assert.equal(findSnapshotItem(previous, "kospi")?.high52, 9000);
    assert.equal(findSnapshotItem(previous, "missing"), null);
    assert.equal(findSnapshotItem(null, "sox"), null);
  });
});
