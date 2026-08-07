import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatDownfallIndexPublishGapDays,
  getLastTwoDownfallIndexPublishGap,
} from "../../lib/downfallIndex.ts";

describe("getLastTwoDownfallIndexPublishGap", () => {
  it("returns null when fewer than two dated entries", () => {
    assert.equal(getLastTwoDownfallIndexPublishGap([]), null);
    assert.equal(
      getLastTwoDownfallIndexPublishGap([{ date: "2026-06-07T00:00:00.000Z", price: 70.58 }]),
      null
    );
  });

  it("computes rounded days between the two latest releases", () => {
    const gap = getLastTwoDownfallIndexPublishGap([
      { date: "2025-10-04T00:00:00.000Z", price: 67.44 },
      { date: "2025-11-01T00:00:00.000Z", price: 68.28 },
      { date: "2026-06-07T00:00:00.000Z", price: 70.58 },
    ]);
    assert.ok(gap);
    assert.equal(gap.previous.price, 68.28);
    assert.equal(gap.latest.price, 70.58);
    // 2025-11-01 → 2026-06-07 = 218 days
    assert.equal(gap.days, 218);
  });

  it("sorts by date so input order does not matter", () => {
    const gap = getLastTwoDownfallIndexPublishGap([
      { date: "2026-06-07T00:00:00.000Z", price: 70.58 },
      { date: "2025-10-04T00:00:00.000Z", price: 67.44 },
      { date: "2025-11-01T00:00:00.000Z", price: 68.28 },
    ]);
    assert.ok(gap);
    assert.equal(gap.days, 218);
    assert.equal(gap.previous.price, 68.28);
    assert.equal(gap.latest.price, 70.58);
  });

  it("ignores entries without valid price or date", () => {
    const gap = getLastTwoDownfallIndexPublishGap([
      { date: "not-a-date", price: 1 },
      { date: "2025-11-01T00:00:00.000Z", price: null },
      { date: "2025-11-01T00:00:00.000Z", price: 68.28 },
      { date: "2026-06-07T00:00:00.000Z", price: 70.58 },
    ]);
    assert.ok(gap);
    assert.equal(gap.days, 218);
  });
});

describe("formatDownfallIndexPublishGapDays", () => {
  it("formats short gaps as days only", () => {
    assert.equal(formatDownfallIndexPublishGapDays(12), "12 天");
    assert.equal(formatDownfallIndexPublishGapDays(0), "0 天");
  });

  it("adds approximate months for longer gaps", () => {
    assert.equal(formatDownfallIndexPublishGapDays(30), "30 天（約 1 個月）");
    assert.equal(formatDownfallIndexPublishGapDays(65), "65 天（約 2 個月又 5 天）");
    assert.equal(formatDownfallIndexPublishGapDays(218), "218 天（約 7 個月又 8 天）");
  });
});
