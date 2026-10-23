import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bandRangeFromHistory,
  buildDailyComparisons,
  compareDailyItems,
  findSnapshotItem,
  getBandTag,
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

describe("bandRangeFromHistory (26 週波段)", () => {
  const weekly = (startISO, count, base) =>
    Array.from({ length: count }, (_, i) => {
      const date = new Date(`${startISO}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + i * 7);
      return { date: date.toISOString().slice(0, 10), price: base + i };
    });

  it("returns empty when there is no history", () => {
    assert.deepEqual(bandRangeFromHistory(null), { high: null, low: null, weeks: 0 });
    assert.deepEqual(bandRangeFromHistory([]), { high: null, low: null, weeks: 0 });
  });

  it("uses a single point as both high and low", () => {
    const range = bandRangeFromHistory([{ date: "2026-10-20", price: 500 }]);
    assert.equal(range.high, 500);
    assert.equal(range.low, 500);
    assert.equal(range.weeks, 1);
  });

  it("ignores points older than 26 weeks", () => {
    // 40 週的資料，第 1 筆是刻意壓低的異常值；它已超出 26 週，不該被算進波段低點。
    const points = weekly("2026-01-06", 40, 100);
    points[0] = { ...points[0], price: 1 };
    const range = bandRangeFromHistory(points);
    assert.ok(range.low > 1, `low 應排除 26 週前的異常值，實際 ${range.low}`);
    // 最後一根（本週還沒收盤）也會被排除，所以最高只到 138。
    assert.equal(range.high, 138);
    assert.ok(range.weeks >= 26 && range.weeks <= 27, `weeks=${range.weeks}`);
  });

  it("excludes the in-progress week so the current price cannot define the band", () => {
    // 回歸測試：KOSPI 現價 5,505.21，本週那根 K 的收盤是 5,505.20996，
    // 把本週算進去時 low 就等於現價，浮點差讓 price <= low 永遠不成立。
    const points = weekly("2026-05-01", 26, 125);
    points[points.length - 1] = { ...points[points.length - 1], price: 50 };
    const range = bandRangeFromHistory(points);
    assert.equal(range.low, 125, `low 應是上一週的 125，實際 ${range.low}`);
    assert.equal(range.high, 149);
    assert.equal(getBandTag(50, range, null), "band-low");
  });

  it("keeps a low that sits inside the 26-week window", () => {
    const points = weekly("2026-01-06", 40, 100);
    points[points.length - 10] = { ...points[points.length - 10], price: 5 };
    const range = bandRangeFromHistory(points);
    assert.equal(range.low, 5);
  });

  it("sorts unordered points by date", () => {
    const range = bandRangeFromHistory([
      { date: "2026-10-20", price: 300 },
      { date: "2026-10-06", price: 100 },
      { date: "2026-10-27", price: 400 },
      { date: "2026-10-13", price: 200 },
    ]);
    // 10-27 是最後一根（本週），排除後區間是 10-06 ~ 10-20。
    assert.equal(range.high, 300);
    assert.equal(range.low, 100);
  });
});

describe("getBandTag", () => {
  const band = { high: 900, low: 500, weeks: 26 };

  it("stays quiet when the 52-week badge already fired", () => {
    assert.equal(getBandTag(1000, band, "new-high"), null);
    assert.equal(getBandTag(400, band, "new-low"), null);
  });

  it("flags a band high inside the 52-week range", () => {
    assert.equal(getBandTag(900, band, null), "band-high");
  });

  it("flags a band low inside the 52-week range", () => {
    assert.equal(getBandTag(500, band, null), "band-low");
  });

  it("stays quiet in between", () => {
    assert.equal(getBandTag(700, band, null), null);
  });

  it("needs a price", () => {
    assert.equal(getBandTag(null, band, null), null);
  });
});
