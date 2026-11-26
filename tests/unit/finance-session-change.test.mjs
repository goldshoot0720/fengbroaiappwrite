import test from "node:test";
import assert from "node:assert/strict";
import { getYahooSessionChange, financeChangeClass, formatFinanceChange } from "../../lib/financeQuoteChange.ts";

test("TWII uses the 2026-11-26 trading session despite the stale previousClose", () => {
  const result = getYahooSessionChange(39151.81, {
    previousClose: 40122.4, chartPreviousClose: 40122.4,
    regularMarketChangePercent: 2.504, fulldayPrice: 39151.81, fulldayChange: 956.379,
  });
  assert.equal(formatFinanceChange(result.change), "+956.38");
  assert.equal(formatFinanceChange(result.changePercent, true), "+2.50%");
  assert.equal(result.previousClose.toFixed(2), "38195.43");
});

test("US regular change stays separate from a different full-day comparison", () => {
  const meta = { previousClose: 354.07, regularMarketChangePercent: 0.426, fulldayPrice: 355.58, fulldayChange: 1.03 };
  assert.equal(getYahooSessionChange(355.58, meta).change.toFixed(2), "1.51");
  assert.equal(getYahooSessionChange(355.58, { ...meta, fulldayPrice: 359 }).change.toFixed(2), "1.51");
});

test("regular-session points, zero and missing values", () => {
  assert.deepEqual(getYahooSessionChange(99, { regularMarketChange: -1, previousClose: 80 }), {
    change: -1, changePercent: -1, previousClose: 100,
  });
  assert.deepEqual(getYahooSessionChange(100, { previousClose: 100 }), { change: 0, changePercent: 0, previousClose: 100 });
  assert.deepEqual(getYahooSessionChange(100, { regularMarketChangePercent: 2, previousClose: 110 }), {
    change: null, changePercent: 2, previousClose: null,
  });
  assert.equal(getYahooSessionChange(100, { chartPreviousClose: 90 }).change, null);
});

test("exchange takes precedence over watchlist grouping for colours", () => {
  const color = (group, symbol, exchangeTimezone, delta) => financeChangeClass({group, symbol, exchangeTimezone}, delta);
  for (const group of ["taiwan", "japan", "korea"]) {
    assert.match(color(group, "", undefined, 1), /text-red/);
    assert.match(color(group, "", undefined, -1), /text-emerald/);
  }
  assert.match(color("us", "^HSI", "Asia/Hong_Kong", 1), /text-red/);
  assert.match(color("other", ".HSI", undefined, -1), /text-emerald/);
  assert.match(color("taiwan", "TSM", "America/New_York", 1), /text-emerald/);
  assert.match(color("other", "^GDAXI", "Europe/Berlin", -1), /text-red/);
  for (const delta of [null, 0]) assert.equal(color("us", "AAPL", undefined, delta), "text-muted-foreground");
  assert.equal(formatFinanceChange(0, true), "0.00%");
  assert.equal(formatFinanceChange(null, true), "—");
});
