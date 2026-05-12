import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type FinanceInstrument = {
  id: string;
  name: string;
  symbol: string;
  sourceUrl: string;
  group: "tw" | "asia" | "commodities" | "rates" | "us" | "crypto" | "valuation";
  provider?: "cnbc" | "yahoo" | "multpl";
};

const SHILLER_PE_URL = "https://www.multpl.com/shiller-pe";
const SHILLER_PE_RECORD_HIGH = 44.19;
const SHILLER_PE_RECORD_DATE = "Dec 1999";

const INSTRUMENTS: FinanceInstrument[] = [
  { id: "taiex", name: "加權指數", symbol: "^TWII", sourceUrl: "https://tw.stock.yahoo.com/s/tse.php", group: "tw", provider: "yahoo" },
  { id: "tsmc", name: "台積電", symbol: "2330.TW", sourceUrl: "https://tw.stock.yahoo.com/quote/2330.TW", group: "tw", provider: "yahoo" },
  { id: "nikkei-225", name: "Nikkei 225 Index", symbol: ".N225", sourceUrl: "https://www.cnbc.com/quotes/.N225", group: "asia" },
  { id: "kospi", name: "KOSPI Index", symbol: ".KS11", sourceUrl: "https://www.cnbc.com/quotes/.KS11?qsearchterm=kospi", group: "asia" },
  { id: "brent", name: "ICE Brent Crude", symbol: "@LCO.1", sourceUrl: "https://www.cnbc.com/quotes/@LCO.1", group: "commodities" },
  { id: "us30y", name: "U.S. 30 Year Treasury", symbol: "US.30", sourceUrl: "https://www.cnbc.com/quotes/US.30", group: "rates" },
  { id: "gold", name: "Gold COMEX", symbol: "@GC.1", sourceUrl: "https://www.cnbc.com/quotes/@GC.1", group: "commodities" },
  { id: "dow", name: "Dow Jones Industrial Average", symbol: ".DJI", sourceUrl: "https://www.cnbc.com/quotes/.DJI", group: "us" },
  { id: "sp500", name: "S&P 500 Index", symbol: ".SPX", sourceUrl: "https://www.cnbc.com/quotes/.SPX", group: "us" },
  { id: "nasdaq", name: "NASDAQ Composite", symbol: ".IXIC", sourceUrl: "https://www.cnbc.com/quotes/.IXIC", group: "us" },
  { id: "vix", name: "CBOE Volatility Index", symbol: ".VIX", sourceUrl: "https://www.cnbc.com/quotes/.VIX", group: "us" },
  { id: "shiller-pe", name: "Shiller PE Ratio", symbol: "CAPE", sourceUrl: SHILLER_PE_URL, group: "valuation", provider: "multpl" },
  { id: "bitcoin", name: "Bitcoin/USD Coin Metrics", symbol: "BTC.CM=", sourceUrl: "https://www.cnbc.com/quotes/BTC.CM=", group: "crypto" },
  { id: "ether", name: "Ether/USD Coin Metrics", symbol: "ETH.CM=", sourceUrl: "https://www.cnbc.com/quotes/ETH.CM=", group: "crypto" },
];

const CNBC_ENDPOINT = "https://quote.cnbc.com/quote-html-webservice/quote.htm";
const YAHOO_CHART_ENDPOINT = "https://query1.finance.yahoo.com/v8/finance/chart";

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

function getRecordTag(price: number | null, high52: number | null, low52: number | null) {
  if (price != null && high52 != null && (price >= high52 || nearlyEqual(price, high52))) return "new-high";
  if (price != null && low52 != null && (price <= low52 || nearlyEqual(price, low52))) return "new-low";
  return null;
}

function extractFirstNumber(pattern: RegExp, text: string) {
  const match = text.match(pattern);
  return match?.[1] ? asNumber(match[1]) : null;
}

function toNumberList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(asNumber).filter((item): item is number => item != null);
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
    recordTag: getRecordTag(price, high52, low52),
  };
}

async function fetchYahooInstrument(instrument: FinanceInstrument) {
  const params = new URLSearchParams({
    range: "1y",
    interval: "1d",
    lang: "zh-TW",
    region: "TW",
  });

  const response = await fetch(`${YAHOO_CHART_ENDPOINT}/${encodeURIComponent(instrument.symbol)}?${params.toString()}`, {
    headers: {
      accept: "application/json,text/plain,*/*",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    },
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`Yahoo Finance ${response.status}`);
  const payload = await response.json();
  const chart = payload?.chart?.result?.[0];
  if (!chart || typeof chart !== "object") throw new Error("No Yahoo Finance chart data");

  const meta = (chart.meta || {}) as Record<string, unknown>;
  const quote = (chart.indicators?.quote?.[0] || {}) as Record<string, unknown>;
  const closes = toNumberList(quote.close);
  const highs = toNumberList(quote.high);
  const lows = toNumberList(quote.low);
  const price = pickNumber(meta, ["regularMarketPrice"]) ?? closes.at(-1) ?? null;
  const previousClose = closes.length > 1 ? closes[closes.length - 2] : null;
  const high52 = highs.length ? Math.max(...highs) : null;
  const low52 = lows.length ? Math.min(...lows) : null;
  const change = price != null && previousClose != null ? price - previousClose : null;
  const changePercent = change != null && previousClose ? (change / previousClose) * 100 : null;
  const marketTime = pickNumber(meta, ["regularMarketTime"]);

  return {
    ...instrument,
    displayName: pickText(meta, ["shortName", "longName"]) || instrument.name,
    price,
    change,
    changePercent,
    currency: pickText(meta, ["currency"]) || "TWD",
    high52,
    low52,
    dayHigh: highs.at(-1) ?? null,
    dayLow: lows.at(-1) ?? null,
    lastUpdated: marketTime ? new Date(marketTime * 1000).toISOString() : "",
    recordTag: getRecordTag(price, high52, low52),
  };
}

async function fetchMultplInstrument(instrument: FinanceInstrument) {
  const response = await fetch(instrument.sourceUrl, {
    headers: {
      accept: "text/html,text/plain,*/*",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    },
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`Multpl ${response.status}`);
  const html = await response.text();
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const price = extractFirstNumber(/Current\s+Shiller\s+PE\s+Ratio:\s*([0-9]+(?:\.[0-9]+)?)/i, text);
  if (price == null) throw new Error("No Shiller PE data");

  const changeMatch = text.match(/Current\s+Shiller\s+PE\s+Ratio:\s*[0-9]+(?:\.[0-9]+)?\s*([+-]?[0-9]+(?:\.[0-9]+)?)\s*\(([+-]?[0-9]+(?:\.[0-9]+)?)%\)/i);
  const maxFromPage = extractFirstNumber(/Max:\s*([0-9]+(?:\.[0-9]+)?)/i, text) ?? SHILLER_PE_RECORD_HIGH;
  const minFromPage = extractFirstNumber(/Min:\s*([0-9]+(?:\.[0-9]+)?)/i, text);
  const updatedMatch = text.match(/([0-9]{1,2}:[0-9]{2}\s*[AP]M\s*[A-Z]{2,4},\s*[A-Za-z]{3}\s+[A-Za-z]{3}\s+[0-9]{1,2})/i);

  return {
    ...instrument,
    displayName: instrument.name,
    price,
    change: changeMatch?.[1] ? asNumber(changeMatch[1]) : null,
    changePercent: changeMatch?.[2] ? asNumber(changeMatch[2]) : null,
    currency: "",
    high52: maxFromPage,
    low52: minFromPage,
    dayHigh: null,
    dayLow: null,
    lastUpdated: updatedMatch?.[1] || "",
    recordTag: price >= maxFromPage || nearlyEqual(price, maxFromPage) ? "new-high" : null,
    recordNote: `Historical max ${maxFromPage} (${SHILLER_PE_RECORD_DATE})`,
  };
}

async function fetchFinanceInstrument(instrument: FinanceInstrument) {
  if (instrument.provider === "yahoo") return fetchYahooInstrument(instrument);
  if (instrument.provider === "multpl") return fetchMultplInstrument(instrument);
  return fetchInstrument(instrument);
}

export async function GET() {
  const settled = await Promise.allSettled(INSTRUMENTS.map(fetchFinanceInstrument));
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
  const shillerQuote = quotes.find((quote) => quote.id === "shiller-pe");

  return NextResponse.json({
    fetchedAt: new Date().toISOString(),
    source: "CNBC / Yahoo Finance / Multpl",
    quotes,
    shillerPe: {
      id: "shiller-pe",
      name: "Shiller PE Ratio",
      sourceUrl: SHILLER_PE_URL,
      current: shillerQuote?.price ?? null,
      recordHigh: shillerQuote?.high52 ?? SHILLER_PE_RECORD_HIGH,
      recordHighDate: SHILLER_PE_RECORD_DATE,
      updatedAt: shillerQuote?.lastUpdated ?? "",
      isRecordHigh: shillerQuote?.recordTag === "new-high",
      error: shillerQuote && "error" in shillerQuote ? shillerQuote.error : undefined,
    },
  });
}
