import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type FinanceInstrument = {
  id: string;
  name: string;
  symbol: string;
  sourceUrl: string;
  group: "asia" | "commodities" | "rates" | "us" | "crypto";
};

const INSTRUMENTS: FinanceInstrument[] = [
  { id: "nikkei-225", name: "Nikkei 225 Index", symbol: ".N225", sourceUrl: "https://www.cnbc.com/quotes/.N225", group: "asia" },
  { id: "kospi", name: "KOSPI Index", symbol: ".KS11", sourceUrl: "https://www.cnbc.com/quotes/.KS11?qsearchterm=kospi", group: "asia" },
  { id: "brent", name: "ICE Brent Crude", symbol: "@LCO.1", sourceUrl: "https://www.cnbc.com/quotes/@LCO.1", group: "commodities" },
  { id: "us30y", name: "U.S. 30 Year Treasury", symbol: "US30Y", sourceUrl: "https://www.cnbc.com/quotes/US30Y", group: "rates" },
  { id: "gold", name: "Gold COMEX", symbol: "@GC.1", sourceUrl: "https://www.cnbc.com/quotes/@GC.1", group: "commodities" },
  { id: "dow", name: "Dow Jones Industrial Average", symbol: ".DJI", sourceUrl: "https://www.cnbc.com/quotes/.DJI", group: "us" },
  { id: "sp500", name: "S&P 500 Index", symbol: ".SPX", sourceUrl: "https://www.cnbc.com/quotes/.SPX", group: "us" },
  { id: "nasdaq", name: "NASDAQ Composite", symbol: ".IXIC", sourceUrl: "https://www.cnbc.com/quotes/.IXIC", group: "us" },
  { id: "vix", name: "CBOE Volatility Index", symbol: ".VIX", sourceUrl: "https://www.cnbc.com/quotes/.VIX", group: "us" },
  { id: "bitcoin", name: "Bitcoin/USD Coin Metrics", symbol: "BTC.CM=", sourceUrl: "https://www.cnbc.com/quotes/BTC.CM=", group: "crypto" },
  { id: "ether", name: "Ether/USD Coin Metrics", symbol: "ETH.CM=", sourceUrl: "https://www.cnbc.com/quotes/ETH.CM=", group: "crypto" },
];

const CNBC_ENDPOINT = "https://quote.cnbc.com/quote-html-webservice/quote.htm";

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[$,%\s,]/g, "");
  if (!cleaned || cleaned === "--" || cleaned.toUpperCase() === "N/A") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function pickNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = asNumber(record[key]);
    if (value != null) return value;
  }
  return null;
}

function pickText(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = asText(record[key]);
    if (value) return value;
  }
  return "";
}

function nearlyEqual(left: number, right: number) {
  const tolerance = Math.max(0.000001, Math.abs(right) * 0.0001);
  return Math.abs(left - right) <= tolerance;
}

function getRecord(payload: any) {
  const raw = payload?.QuickQuoteResult?.QuickQuote;
  return Array.isArray(raw) ? raw[0] : raw;
}

async function fetchInstrument(instrument: FinanceInstrument) {
  const params = new URLSearchParams({
    symbols: instrument.symbol,
    requestMethod: "quick",
    noform: "1",
    fund: "1",
    output: "json",
  });
  const response = await fetch(`${CNBC_ENDPOINT}?${params.toString()}`, {
    headers: {
      accept: "application/json,text/plain,*/*",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    },
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`CNBC ${response.status}`);
  const payload = await response.json();
  const record = getRecord(payload);
  if (!record || typeof record !== "object") throw new Error("No CNBC quote data");

  const quote = record as Record<string, unknown>;
  const price = pickNumber(quote, ["last", "last_price", "Last", "price", "yrlast"]);
  const high52 = pickNumber(quote, ["high_52week", "high52", "yrhiprice", "year_high", "52week_high"]);
  const low52 = pickNumber(quote, ["low_52week", "low52", "yrloprice", "year_low", "52week_low"]);
  const dayHigh = pickNumber(quote, ["high", "day_high"]);
  const dayLow = pickNumber(quote, ["low", "day_low"]);

  let recordTag: "new-high" | "new-low" | null = null;
  if (price != null && high52 != null && (price >= high52 || nearlyEqual(price, high52))) recordTag = "new-high";
  if (price != null && low52 != null && (price <= low52 || nearlyEqual(price, low52))) recordTag = "new-low";

  return {
    ...instrument,
    displayName: pickText(quote, ["name", "shortName", "symbolName"]) || instrument.name,
    price,
    change: pickNumber(quote, ["change", "net_change"]),
    changePercent: pickNumber(quote, ["change_pct", "change_percent", "pctchange"]),
    currency: pickText(quote, ["currencyCode", "currency"]) || "",
    high52,
    low52,
    dayHigh,
    dayLow,
    lastUpdated: pickText(quote, ["last_time", "last_time_msec", "time"]) || "",
    recordTag,
  };
}

export async function GET() {
  const settled = await Promise.allSettled(INSTRUMENTS.map(fetchInstrument));
  const quotes = settled.map((item, index) => {
    if (item.status === "fulfilled") return item.value;
    const instrument = INSTRUMENTS[index];
    return {
      ...instrument,
      displayName: instrument.name,
      price: null,
      change: null,
      changePercent: null,
      currency: "",
      high52: null,
      low52: null,
      dayHigh: null,
      dayLow: null,
      lastUpdated: "",
      recordTag: null,
      error: item.reason instanceof Error ? item.reason.message : "Failed to load quote",
    };
  });

  return NextResponse.json({
    fetchedAt: new Date().toISOString(),
    source: "CNBC",
    quotes,
  });
}
