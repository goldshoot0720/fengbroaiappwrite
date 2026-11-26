import assert from "node:assert/strict";
import test from "node:test";
import { cnbcIndexSession, createMarketSessionLookup, yahooQuoteSession } from "../../lib/financeMarketSession.ts";

const unexpectedLookup = () => assert.fail("Unexpected calendar lookup");
const usIndex = { assetType: "INDEX", countryCode: "US", exchange: "NASDAQ", curmktstatus: "REG_MKT" };

test("US index follows the holiday calendar even with an OPEN flag or no flag on the quote", async () => {
  const holiday = async (region) => { assert.equal(region, "US"); return "closed"; };
  for (const mainmktstatus of ["OPEN", undefined]) {
    assert.equal(await cnbcIndexSession({ ...usIndex, mainmktstatus }, holiday), "closed");
  }
  assert.equal(await cnbcIndexSession(usIndex, async () => "regular"), "regular");
  assert.equal(await cnbcIndexSession(usIndex, async () => ""), "");
});

test("exchange closure and trading-day flags on international indices", async () => {
  const quote = { assetType: "INDEX", countryCode: "JP", exchange: "Nihon Keizai Shinbun", curmktstatus: "REG_MKT" };
  assert.equal(await cnbcIndexSession({ ...quote, mainmktstatus: "CLOSE" }, unexpectedLookup), "closed");
  assert.equal(await cnbcIndexSession({ ...quote, mainmktstatus: "OPEN" }, unexpectedLookup), "regular");
  for (const day of ["HOLIDAY", "WEEKEND"]) {
    assert.equal(await cnbcIndexSession({ ...quote, mainmktstatus: "OPEN", trading_day_type: day }, unexpectedLookup), "closed");
  }
  assert.equal(await cnbcIndexSession({ ...quote, exchange: "Exchange" }, unexpectedLookup), "");
  assert.equal(await cnbcIndexSession({ ...quote, assetSubType: "CNBC Synthetic" }, unexpectedLookup), "");
});

test("Yahoo preserves explicit sessions and uses index exchange instead of the watchlist group", async () => {
  for (const [marketState, expected] of Object.entries({ PRE:"pre", REGULAR:"regular", POST:"post", POSTPOST:"post", CLOSED:"closed" })) {
    assert.equal(await yahooQuoteSession({ marketState }, unexpectedLookup), expected);
  }
  const twIndex = { instrumentType: "INDEX", exchangeName: "TAI", group: "us" };
  assert.equal(await yahooQuoteSession(twIndex, async region => { assert.equal(region, "TW"); return "closed"; }), "closed");
  assert.equal(await yahooQuoteSession({ instrumentType: "CRYPTOCURRENCY", exchangeName: "TAI" }, unexpectedLookup), "");
});

test("Yahoo falls back to the date-specific session and does not infer closure from a stale price", async () => {
  const start = Date.parse("2026-11-27T14:30:00Z") / 1000;
  const end = Date.parse("2026-11-27T18:00:00Z") / 1000;
  const meta = { instrumentType: "INDEX", currentTradingPeriod: { regular: { start, end, gmtoffset: -18000 } } };
  assert.equal(await yahooQuoteSession(meta, unexpectedLookup, start * 1000), "regular");
  assert.equal(await yahooQuoteSession(meta, unexpectedLookup, end * 1000), "closed");
  assert.equal(await yahooQuoteSession(meta, unexpectedLookup, (end + 86400) * 1000), "");
  assert.equal(await yahooQuoteSession({ instrumentType: "INDEX" }, unexpectedLookup), "");
});

test("market calendars are shared per request and rejected if Yahoo returns another region", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => Response.json({
    finance: { marketTimes: [{ marketTime: [{ id: "us", status: "closed" }] }] },
  }));
  const lookup = createMarketSessionLookup();
  assert.deepEqual(await Promise.all([lookup("US"), lookup("US"), lookup("XX"), lookup("")]), ["closed", "closed", "", ""]);
  assert.equal(fetchMock.mock.callCount(), 2);
  fetchMock.mock.mockImplementation(async () => { throw new Error("offline"); });
  assert.equal(await createMarketSessionLookup()("TW"), "");
});
