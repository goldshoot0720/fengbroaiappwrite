import assert from "node:assert/strict";
import test from "node:test";
import { cnbcIndexSession, createMarketSessionLookup, yahooQuoteSession } from "../../lib/financeMarketSession.ts";

const screenshotTime = "2026-11-26T16:15:00Z";
const usa = { id: "us", status: "closed", open: "2026-11-27T14:30:00Z", close: "2026-11-27T18:00:00Z", timezone: [{ $text: "America/New_York" }] };
const japan = { id: "jp", status: "closed", open: "2026-11-27T00:00:00Z", close: "2026-11-27T06:30:00Z", timezone: [{ $text: "Asia/Tokyo" }] };
const korea = { ...japan, id: "kr", timezone: [{ $text: "Asia/Seoul" }] };
const index = { assetType: "INDEX", exchange: "Stock Exchange", mainmktstatus: "CLOSE", trading_day_type: "TRADING_DAY" };
const unexpectedLookup = () => assert.fail("Unexpected calendar lookup");
const period = (open, close) => ({ start: Date.parse(open) / 1000, end: Date.parse(close) / 1000 });

function mockCalendars(t, regions, { regularPeriods = [], nasdaqDay } = {}) {
  return t.mock.method(globalThis, "fetch", async (input) => {
    const url = new URL(input);
    if (url.hostname === "api.nasdaq.com") return Response.json({ data: nasdaqDay ?? null });
    if (url.pathname.includes("/markettime")) {
      const market = regions.find(item => item.id === url.searchParams.get("region").toLowerCase());
      return Response.json({ finance: { marketTimes: [{ marketTime: [market ?? usa] }] } });
    }
    return Response.json({ chart: { result: [{ meta: { tradingPeriods: regularPeriods.map(p => [p]) } }] } });
  });
}

test("at 00:15 Taipei, Japan and Korea are awaiting the open while the US has no session on Thanksgiving", async t => {
  mockCalendars(t, [usa, japan, korea], { nasdaqDay: { clndr_dt: "2026-11-26T00:00:00", isBusinessDay: false } });
  const lookup = createMarketSessionLookup(Date.parse(screenshotTime));
  assert.equal(await cnbcIndexSession({ ...index, countryCode: "JP" }, lookup), "upcoming");
  assert.equal(await cnbcIndexSession({ ...index, countryCode: "KR" }, lookup), "upcoming");
  assert.equal(await cnbcIndexSession({ ...index, countryCode: "US", mainmktstatus: "OPEN" }, lookup), "holiday");
});

test("a trading day distinguishes its opening, an intraday pause, and its early close", async t => {
  const feed = { ...usa };
  mockCalendars(t, [feed]);
  const lookupAt = time => createMarketSessionLookup(Date.parse(time))("US");
  assert.equal(await lookupAt("2026-11-27T13:30:00Z"), "upcoming");
  feed.status = "open";
  assert.equal(await lookupAt(usa.open), "regular");
  feed.status = "closed";
  assert.equal(await lookupAt("2026-11-27T16:00:00Z"), "break");
  assert.equal(await lookupAt(usa.close), "ended");
});

test("rolling the next opening to Monday after Friday's close does not make Friday a holiday", async t => {
  const monday = { ...japan, open: "2026-11-30T00:00:00Z", close: "2026-11-30T06:30:00Z" };
  mockCalendars(t, [monday], { regularPeriods: [period(japan.open, japan.close)] });
  assert.equal(await createMarketSessionLookup(Date.parse("2026-11-27T08:00:00Z"))("JP"), "ended");
  assert.equal(await createMarketSessionLookup(Date.parse("2026-11-28T08:00:00Z"))("JP"), "holiday");
});

test("a calendar pointing to a future opening alone cannot establish a full-day closure", async t => {
  const mock = mockCalendars(t, [usa]);
  const lookup = createMarketSessionLookup(Date.parse(screenshotTime));
  assert.deepEqual(await Promise.all([lookup("US"), lookup("US"), lookup("XX"), lookup("")]), ["", "", "", ""]);
  assert.equal(mock.mock.callCount(), 3);
  mock.mock.mockImplementation(async () => { throw new Error("offline"); });
  assert.equal(await createMarketSessionLookup()("TW"), "");
});

test("CNBC uses explicit non-trading days as a fallback, never a bare CLOSE flag", async () => {
  const unknown = async () => "";
  for (const day of ["HOLIDAY", "WEEKEND"]) {
    assert.equal(await cnbcIndexSession({ ...index, trading_day_type: day }, unknown), "holiday");
  }
  assert.equal(await cnbcIndexSession(index, unknown), "");
  assert.equal(await cnbcIndexSession({ ...index, exchange: "Exchange" }, unexpectedLookup), "");
  assert.equal(await cnbcIndexSession({ ...index, assetSubType: "CNBC Synthetic" }, unexpectedLookup), "");
});

test("Yahoo CLOSED uses the exchange's local session date and preserves explicit extended hours", async () => {
  const meta = { instrumentType: "INDEX", exchangeName: "TAI", marketState: "CLOSED" };
  assert.equal(await yahooQuoteSession(meta, async region => { assert.equal(region, "TW"); return "upcoming"; }), "upcoming");
  for (const [marketState, expected] of Object.entries({ PRE: "pre", REGULAR: "regular", POST: "post", POSTPOST: "post" })) {
    assert.equal(await yahooQuoteSession({ marketState }, unexpectedLookup), expected);
  }
  const chart = { ...meta, currentTradingPeriod: { regular: { ...period(usa.open, usa.close), gmtoffset: -18000 } } };
  assert.equal(await yahooQuoteSession(chart, async () => "", Date.parse("2026-11-27T10:00:00Z")), "upcoming");
  assert.equal(await yahooQuoteSession(chart, async () => "", Date.parse(usa.close)), "ended");
  assert.equal(await yahooQuoteSession(chart, async () => "", Date.parse("2026-11-28T18:00:00Z")), "");
  assert.equal(await yahooQuoteSession({ marketState: "CLOSED" }, unexpectedLookup), "");
});

test("stale daily calendars and undated closed flags leave the badge unset", async t => {
  mockCalendars(t, [{ ...usa, time: "2026-11-25T16:00:00Z" }, japan], {
    regularPeriods: [period("2026-10-20T00:00:00Z", "2026-10-20T06:30:00Z")],
  });
  assert.equal(await createMarketSessionLookup(Date.parse(screenshotTime))("US"), "");
  assert.equal(await createMarketSessionLookup(Date.parse("2026-11-23T03:00:00Z"))("JP"), "");
  assert.equal(await yahooQuoteSession({ instrumentType: "CRYPTOCURRENCY", exchangeName: "TAI" }, unexpectedLookup), "");
  const unknownMarket = { instrumentType: "INDEX", currentTradingPeriod: { regular: { start: 7, end: 5 } } };
  assert.equal(await yahooQuoteSession(unknownMarket, unexpectedLookup), "");
});
