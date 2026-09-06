import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getQuotaAvailabilityBlocker, toQuotaUsageChart } from "../../lib/quotaUsageDisplay.ts";

describe("quota usage chart", () => {
  it("shows the reported used percentage alongside the stored remaining percentage", () => {
    assert.deepEqual(toQuotaUsageChart(88), {
      usedPercent: 12,
      remainingPercent: 88,
      usedLabel: "已使用 12%",
      remainingLabel: "剩餘 88%",
      accessibilityLabel: "用量圖表：已使用 12%，剩餘 88%",
    });
  });

  it("retains the zero-remaining limit state instead of treating it as missing data", () => {
    assert.deepEqual(toQuotaUsageChart(0), {
      usedPercent: 100,
      remainingPercent: 0,
      usedLabel: "已使用 100%",
      remainingLabel: "剩餘 0%",
      accessibilityLabel: "用量圖表：已使用 100%，剩餘 0%",
    });
  });

  it("does not invent a chart when the stored percentage is absent or invalid", () => {
    assert.equal(toQuotaUsageChart(undefined), null);
    assert.equal(toQuotaUsageChart(101), null);
  });

  it("keeps a fresh 5-hour meter factual while reporting that a reached weekly limit blocks use", () => {
    assert.deepEqual(
      getQuotaAvailabilityBlocker([
        { key: "5h", label: "5 小時", reached: false, current: true },
        { key: "week", label: "一週", reached: true, current: true },
      ]),
      { key: "week", label: "一週" },
    );
  });

  it("does not block from a reached window whose snapshot is no longer current", () => {
    assert.equal(
      getQuotaAvailabilityBlocker([
        { key: "5h", label: "5 小時", reached: false, current: true },
        { key: "week", label: "一週", reached: true, current: false },
      ]),
      null,
    );
  });
});
