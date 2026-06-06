import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type FinanceInstrument = {
  id: string;
  name: string;
  symbol: string;
  sourceUrl: string;
  group: "tw" | "asia" | "korea" | "fx" | "commodities" | "rates" | "us" | "crypto" | "valuation";
  provider?: "cnbc" | "yahoo" | "multpl";
  alertThreshold?: number;
};

const SHILLER_PE_URL = "https://www.multpl.com/shiller-pe";
const SHILLER_PE_RECORD_HIGH = 44.19;
const SHILLER_PE_RECORD_DATE = "Dec 1999";

const INSTRUMENTS: FinanceInstrument[] = [
  { id: "taiex", name: "加權指數", symbol: "^TWII", sourceUrl: "https://tw.stock.yahoo.com/s/tse.php", group: "tw", provider: "yahoo", alertThreshold: 126820 },
  { id: "tsmc", name: "台積電", symbol: "2330.TW", sourceUrl: "https://tw.stock.yahoo.com/quote/2330.TW", group: "tw", provider: "yahoo", alertThreshold: 3333 },
  { id: "nikkei-225", name: "Nikkei 225 Index", symbol: ".N225", sourceUrl: "https://www.cnbc.com/quotes/.N225", group: "asia", alertThreshold: 110000 },
  { id: "kospi", name: "KOSPI Index", symbol: ".KS11", sourceUrl: "https://www.cnbc.com/quotes/.KS11?qsearchterm=kospi", group: "asia", alertThreshold: 12682 },
  { id: "samsung-electronics", name: "三星電子", symbol: "005930.KS", sourceUrl: "https://finance.yahoo.com/quote/005930.KS", group: "korea", provider: "yahoo", alertThreshold: 1110000 },
  { id: "sk-hynix", name: "SK 海力士", symbol: "000660.KS", sourceUrl: "https://finance.yahoo.com/quote/000660.KS", group: "korea", provider: "yahoo", alertThreshold: 11110000 },
  { id: "usd-twd", name: "美元對台幣匯率", symbol: "USDTWD=X", sourceUrl: "https://finance.yahoo.com/quote/USDTWD=X", group: "fx", provider: "yahoo", alertThreshold: 37 },
  { id: "usd-jpy", name: "美元對日元匯率", symbol: "USDJPY=X", sourceUrl: "https://finance.yahoo.com/quote/USDJPY=X", group: "fx", provider: "yahoo", alertThreshold: 222 },
  { id: "brent", name: "ICE Brent Crude", symbol: "@LCO.1", sourceUrl: "https://www.cnbc.com/quotes/@LCO.1", group: "commodities", alertThreshold: 222 },
  { id: "us30y", name: "U.S. 30 Year Treasury", symbol: "US.30", sourceUrl: "https://www.cnbc.com/quotes/US.30", group: "rates", alertThreshold: 6.66 },
  { id: "gold", name: "Gold COMEX", symbol: "@GC.1", sourceUrl: "https://www.cnbc.com/quotes/@GC.1", group: "commodities", alertThreshold: 6666 },
  { id: "dow", name: "Dow Jones Industrial Average", symbol: ".DJI", sourceUrl: "https://www.cnbc.com/quotes/.DJI", group: "us", alertThreshold: 66666 },
  { id: "sp500", name: "S&P 500 Index", symbol: ".SPX", sourceUrl: "https://www.cnbc.com/quotes/.SPX", group: "us", alertThreshold: 11111 },
  { id: "nasdaq", name: "NASDAQ Composite", symbol: ".IXIC", sourceUrl: "https://www.cnbc.com/quotes/.IXIC", group: "us", alertThreshold: 33333 },
  { id: "phlx-semiconductor", name: "費城半導體指數", symbol: ".SOX", sourceUrl: "https://www.cnbc.com/quotes/.SOX", group: "us" },
  { id: "vix", name: "CBOE Volatility Index", symbol: ".VIX", sourceUrl: "https://www.cnbc.com/quotes/.VIX", group: "us" },
  { id: "shiller-pe", name: "Shiller PE Ratio", symbol: "CAPE", sourceUrl: SHILLER_PE_URL, group: "valuation", provider: "multpl", alertThreshold: 45 },
  { id: "bitcoin", name: "Bitcoin/USD Coin Metrics", symbol: "BTC.CM=", sourceUrl: "https://www.cnbc.com/quotes/BTC.CM=", group: "crypto", alertThreshold: 111111 },
  { id: "ether", name: "Ether/USD Coin Metrics", symbol: "ETH.CM=", sourceUrl: "https://www.cnbc.com/quotes/ETH.CM=", group: "crypto", alertThreshold: 2222 },
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

function isThresholdAlert(price: number | null, threshold?: number) {
  return typeof price === "number" && typeof threshold === "number" && price > threshold;
}

function extractFirstNumber(pattern: RegExp, text: string) {
  const match = text.match(pattern);
  return match?.[1] ? asNumber(match[1]) : null;
}

function toReadableText(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseShillerPeText(text: string) {
  const price =
    extractFirstNumber(/Current\s+Shiller\s+PE\s+Ratio(?:\s+is)?\s*:?\s*([0-9]+(?:\.[0-9]+)?)/i, text) ??
    extractFirstNumber(/\bShiller\s+PE\s+Ratio\s+([0-9]+(?:\.[0-9]+)?)/i, text);

  const changeMatch =
    text.match(/Current\s+Shiller\s+PE\s+Ratio(?:\s+is)?\s*:?\s*[0-9]+(?:\.[0-9]+)?\s*,?\s*([+-]?[0-9]+(?:\.[0-9]+)?)\s*\(([+-]?[0-9]+(?:\.[0-9]+)?)%\)/i) ??
    text.match(/\bShiller\s+PE\s+Ratio\s+[0-9]+(?:\.[0-9]+)?\s+([+-]?[0-9]+(?:\.[0-9]+)?)\s*\(([+-]?[0-9]+(?:\.[0-9]+)?)%\)/i);

  return {
    price,
    change: changeMatch?.[1] ? asNumber(changeMatch[1]) : null,
    changePercent: changeMatch?.[2] ? asNumber(changeMatch[2]) : null,
    pageMax: extractFirstNumber(/Max:\s*([0-9]+(?:\.[0-9]+)?)/i, text),
    minFromPage: extractFirstNumber(/Min:\s*([0-9]+(?:\.[0-9]+)?)/i, text),
    updatedAt:
      text.match(/([0-9]{1,2}:[0-9]{2}\s*[AP]M\s*[A-Z]{2,4},\s*[A-Za-z]{3}\s+[A-Za-z]{3}\s+[0-9]{1,2})/i)?.[1] ||
      text.match(/\b(At market close\s+[A-Za-z]{3}\s+[A-Za-z]{3}\s+[0-9]{1,2},\s*[0-9]{4})\b/i)?.[1] ||
      "",
  };
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
  const fetchMultplText = async (url: string) => {
    const response = await fetch(url, {
      headers: {
        accept: "text/html,text/plain,*/*",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      },
      cache: "no-store",
    });

    if (!response.ok) throw new Error(`Multpl ${response.status}`);
    return toReadableText(await response.text());
  };

  const primaryText = await fetchMultplText(instrument.sourceUrl);
  let parsed = parseShillerPeText(primaryText);

  if (parsed.price == null) {
    const fallbackText = await fetchMultplText("https://www.multpl.com/");
    parsed = parseShillerPeText(fallbackText);
  }

  const price = parsed.price;
  if (price == null) throw new Error("No Shiller PE data");

  return {
    ...instrument,
    displayName: instrument.name,
    price,
    change: parsed.change,
    changePercent: parsed.changePercent,
    currency: "",
    high52: SHILLER_PE_RECORD_HIGH,
    low52: parsed.minFromPage,
    dayHigh: null,
    dayLow: null,
    lastUpdated: parsed.updatedAt,
    recordTag: price > SHILLER_PE_RECORD_HIGH ? "new-high" : null,
    recordNote: `Historical max ${SHILLER_PE_RECORD_HIGH} (${SHILLER_PE_RECORD_DATE})`,
    pageMax: parsed.pageMax,
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
  }).map((quote) => {
    const thresholdAlert = isThresholdAlert(quote.price, quote.alertThreshold);
    return {
      ...quote,
      isThresholdAlert: thresholdAlert,
      alertMessage: thresholdAlert
        ? `${quote.name} 目前 ${quote.price}${quote.currency ? ` ${quote.currency}` : ""}，已突破 ${quote.alertThreshold}`
        : "",
    };
  });
  const shillerQuote = quotes.find((quote) => quote.id === "shiller-pe");
  const financeAlerts = quotes
    .filter((quote) => quote.isThresholdAlert)
    .map((quote) => ({
      id: quote.id,
      name: quote.name,
      displayName: quote.displayName,
      symbol: quote.symbol,
      sourceUrl: quote.sourceUrl,
      current: quote.price,
      threshold: quote.alertThreshold,
      currency: quote.currency,
      lastUpdated: quote.lastUpdated,
      message: quote.alertMessage,
    }));

  return NextResponse.json({
    fetchedAt: new Date().toISOString(),
    source: "CNBC / Yahoo Finance / Multpl",
    quotes,
    financeAlerts,
    shillerPe: {
      id: "shiller-pe",
      name: "Shiller PE Ratio",
      sourceUrl: SHILLER_PE_URL,
      current: shillerQuote?.price ?? null,
      recordHigh: SHILLER_PE_RECORD_HIGH,
      recordHighDate: SHILLER_PE_RECORD_DATE,
      updatedAt: shillerQuote?.lastUpdated ?? "",
      isRecordHigh:
        shillerQuote?.isThresholdAlert === true,
      error: shillerQuote && "error" in shillerQuote ? shillerQuote.error : undefined,
    },
  });
}
