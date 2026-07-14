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
  localLabel?: string;
  youtubeUrl?: string;
  youtubeLabel?: string;
  youtubeLinks?: Array<{ label: string; url: string }>;
  bilibiliUrl?: string;
  periodLabel?: string;
  imageUrl?: string;
  imageUrls?: string[];
};

type FinanceInstrumentGroup = FinanceInstrument["group"];

type CustomFinanceInstrumentInput = {
  name?: unknown;
  symbol?: unknown;
  provider?: unknown;
  group?: unknown;
};

type FinanceHistoryPoint = {
  date: string;
  price: number;
};

type FinanceHistoryRange = {
  key: "1y" | "5y" | "10y" | "20y" | "30y";
  range: string;
  interval: string;
};

const SHILLER_PE_URL = "https://www.multpl.com/shiller-pe";
const SHILLER_PE_RECORD_HIGH = 44.19;
const SHILLER_PE_RECORD_DATE = "Dec 1999";
const FINANCE_HISTORY_RANGES: FinanceHistoryRange[] = [
  { key: "1y", range: "1y", interval: "1wk" },
  { key: "5y", range: "5y", interval: "1mo" },
  { key: "10y", range: "10y", interval: "1mo" },
  { key: "20y", range: "20y", interval: "3mo" },
  { key: "30y", range: "30y", interval: "3mo" },
];
const YAHOO_HISTORY_SYMBOLS: Record<string, string> = {
  "nikkei-225": "^N225",
  kospi: "^KS11",
  brent: "BZ=F",
  us30y: "^TYX",
  gold: "GC=F",
  dow: "^DJI",
  sp500: "^GSPC",
  nasdaq: "^IXIC",
  "phlx-semiconductor": "^SOX",
  vix: "^VIX",
  bitcoin: "BTC-USD",
  ether: "ETH-USD",
  "berkshire-a": "BRK-A",
  "berkshire-b": "BRK-B",
  intel: "INTC",
  nvidia: "NVDA",
  koru: "KORU",
  soxl: "SOXL",
};

const INSTRUMENTS: FinanceInstrument[] = [
  { id: "taiex", name: "加權指數", symbol: "^TWII", sourceUrl: "https://tw.stock.yahoo.com/s/tse.php", group: "tw", provider: "yahoo", alertThreshold: 126820 },
  { id: "tsmc", name: "台積電", symbol: "2330.TW", sourceUrl: "https://tw.stock.yahoo.com/quote/2330.TW", group: "tw", provider: "yahoo", alertThreshold: 3333, imageUrl: "/finance/tsmc-featured.jpg" },
  { id: "nikkei-225", name: "Nikkei 225 Index", symbol: ".N225", sourceUrl: "https://www.cnbc.com/quotes/.N225", group: "asia", alertThreshold: 110000, localLabel: "日経平均株価", imageUrl: "/finance/nikkei-225-featured.jpg", youtubeUrl: "https://www.youtube.com/results?search_query=%E5%A4%A7%E6%9A%B4%E8%90%BD", youtubeLabel: "日経平均株価 大暴落", youtubeLinks: [{ label: "日経平均株価 インフレ", url: "https://www.youtube.com/results?search_query=%E6%97%A5%E7%B5%8C%E5%B9%B3%E5%9D%87%E6%A0%AA%E4%BE%A1%20%E3%82%A4%E3%83%B3%E3%83%95%E3%83%AC" }, { label: "朝倉慶 文藝春秋", url: "https://www.youtube.com/@Bungeishunju/search?query=%E6%9C%9D%E5%80%89%E6%85%B6" }, { label: "朝倉慶 ASK1", url: "https://www.youtube.com/@info_ask1/search?query=%E6%9C%9D%E5%80%89%E6%85%B6" }, { label: "朝倉慶 楽待", url: "https://www.youtube.com/@rakumachi/search?query=%E6%9C%9D%E5%80%89%E6%85%B6" }, { label: "朝倉慶 外為どっとコム", url: "https://www.youtube.com/@gaitame_com/search?query=%E6%9C%9D%E5%80%89%E6%85%B6" }] },
  { id: "kioxia", name: "キオクシア 鎧俠", symbol: "285A.T", sourceUrl: "https://finance.yahoo.com/quote/285A.T", group: "asia", provider: "yahoo", localLabel: "TYO: 285A" },
  { id: "kospi", name: "KOSPI Index", symbol: ".KS11", sourceUrl: "https://www.cnbc.com/quotes/.KS11?qsearchterm=kospi", group: "asia", alertThreshold: 12682, localLabel: "코스피", periodLabel: "2026~2027", youtubeUrl: "https://www.youtube.com/results?search_query=SK+Hynix+stock&sp=CAMSBAgCEAE%253D", bilibiliUrl: "https://search.bilibili.com/all?keyword=%E9%9F%93%E5%9C%8B%E8%82%A1%E5%B8%82&from_source=web_search&spm_id_from=333.1007&search_source=5&pubtime_begin_s=1782489600&pubtime_end_s=1783094399", imageUrl: "/finance/kospi-202607121235.png", imageUrls: ["/finance/kospi-202607121235.png", "/finance/kospi-202607121252.mp4", "/finance/kospi-cats.jpg", "/finance/kospi-index.png"] },
  { id: "samsung-electronics", name: "三星電子", symbol: "005930.KS", sourceUrl: "https://finance.yahoo.com/quote/005930.KS", group: "korea", provider: "yahoo", alertThreshold: 1110000 },
  { id: "sk-hynix", name: "SK 海力士", symbol: "000660.KS", sourceUrl: "https://finance.yahoo.com/quote/000660.KS", group: "korea", provider: "yahoo", alertThreshold: 11110000 },
  { id: "sk-hynix-adr", name: "SK hynix Inc. ADR", symbol: "SKHY", sourceUrl: "https://finance.yahoo.com/quote/SKHY", group: "korea", provider: "yahoo" },
  { id: "koru", name: "Direxion Daily MSCI South Korea Bull 3X ETF", symbol: "KORU", sourceUrl: "https://www.cnbc.com/quotes/KORU", group: "korea", localLabel: "NYSEARCA: KORU" },
  { id: "usd-twd", name: "美元對台幣匯率", symbol: "USDTWD=X", sourceUrl: "https://finance.yahoo.com/quote/USDTWD=X", group: "fx", provider: "yahoo", alertThreshold: 37 },
  { id: "usd-jpy", name: "美元對日元匯率", symbol: "USDJPY=X", sourceUrl: "https://finance.yahoo.com/quote/USDJPY=X", group: "fx", provider: "yahoo", alertThreshold: 222, bilibiliUrl: "https://search.bilibili.com/all?keyword=%E6%97%A5%E5%85%83%E8%B4%AC%E5%80%BC&from_source=websuggest_search&spm_id_from=333.1007&search_source=5&pubtime_begin_s=1782489600&pubtime_end_s=1783094399" },
  { id: "brent", name: "ICE Brent Crude", symbol: "@LCO.1", sourceUrl: "https://www.cnbc.com/quotes/@LCO.1", group: "commodities", alertThreshold: 222 },
  { id: "us30y", name: "U.S. 30 Year Treasury", symbol: "US.30", sourceUrl: "https://www.cnbc.com/quotes/US.30", group: "rates", alertThreshold: 6.66 },
  { id: "gold", name: "Gold COMEX", symbol: "@GC.1", sourceUrl: "https://www.cnbc.com/quotes/@GC.1", group: "commodities", alertThreshold: 6666, imageUrl: "/finance/gold-featured.jpg" },
  { id: "dow", name: "Dow Jones Industrial Average", symbol: ".DJI", sourceUrl: "https://www.cnbc.com/quotes/.DJI", group: "us", alertThreshold: 66666, localLabel: "Roaring '20s", youtubeUrl: "https://www.youtube.com/watch?v=32u5T6lO8qk", youtubeLabel: "Most People Will Lose Everything", imageUrl: "/finance/dow-jones-doac.png" },
  { id: "sp500", name: "S&P 500 Index", symbol: ".SPX", sourceUrl: "https://www.cnbc.com/quotes/.SPX", group: "us", alertThreshold: 11111 },
  { id: "nasdaq", name: "NASDAQ Composite", symbol: ".IXIC", sourceUrl: "https://www.cnbc.com/quotes/.IXIC", group: "us", alertThreshold: 33333, localLabel: "科技泡沫" },
  { id: "phlx-semiconductor", name: "費城半導體指數", symbol: ".SOX", sourceUrl: "https://www.cnbc.com/quotes/.SOX", group: "us", localLabel: "半導體泡沫", bilibiliUrl: "https://search.bilibili.com/all?keyword=%E5%8D%8A%E5%B0%8E%E9%AB%94&from_source=web_search&spm_id_from=333.788&search_source=5&pubtime_begin_s=1782489600&pubtime_end_s=1783094399", imageUrl: "/finance/sox-cats.jpg" },
  { id: "soxl", name: "Direxion Daily Semiconductor Bull 3X ETF", symbol: "SOXL", sourceUrl: "https://www.cnbc.com/quotes/SOXL", group: "us", localLabel: "NYSEARCA: SOXL" },
  { id: "berkshire-a", name: "Berkshire Hathaway Inc Class A", symbol: "BRK.A", sourceUrl: "https://www.cnbc.com/quotes/BRK.A", group: "us", localLabel: "巴菲特" },
  { id: "berkshire-b", name: "Berkshire Hathaway Inc Class B", symbol: "BRK.B", sourceUrl: "https://www.cnbc.com/quotes/BRK.B", group: "us", localLabel: "巴菲特" },
  { id: "intel", name: "Intel Corp", symbol: "INTC", sourceUrl: "https://www.cnbc.com/quotes/INTC", group: "us", localLabel: "NASDAQ: INTC" },
  { id: "amd", name: "Advanced Micro Devices Inc", symbol: "AMD", sourceUrl: "https://www.cnbc.com/quotes/AMD", group: "us", localLabel: "NASDAQ: AMD" },
  { id: "nvidia", name: "NVIDIA Corp", symbol: "NVDA", sourceUrl: "https://www.cnbc.com/quotes/NVDA", group: "us", localLabel: "重零開始" },
  { id: "micron", name: "美光科技", symbol: "MU", sourceUrl: "https://www.cnbc.com/quotes/MU", group: "us", localLabel: "AI泡沫" },
  { id: "spacex", name: "SpaceX", symbol: "SPCX", sourceUrl: "https://www.cnbc.com/quotes/SPCX", group: "us", localLabel: "人類泡沫" },
  { id: "apple", name: "蘋果", symbol: "AAPL", sourceUrl: "https://www.cnbc.com/quotes/AAPL", group: "us", localLabel: "手機泡沫" },
  { id: "vix", name: "CBOE Volatility Index", symbol: ".VIX", sourceUrl: "https://www.cnbc.com/quotes/.VIX", group: "us" },
  { id: "shiller-pe", name: "Shiller PE Ratio", symbol: "CAPE", sourceUrl: SHILLER_PE_URL, group: "valuation", provider: "multpl", alertThreshold: 45 },
  { id: "bitcoin", name: "Bitcoin/USD Coin Metrics", symbol: "BTC.CM=", sourceUrl: "https://www.cnbc.com/quotes/BTC.CM=", group: "crypto", alertThreshold: 111111, imageUrl: "/finance/bitcoin-cats.jpg" },
  { id: "ether", name: "Ether/USD Coin Metrics", symbol: "ETH.CM=", sourceUrl: "https://www.cnbc.com/quotes/ETH.CM=", group: "crypto", alertThreshold: 2222 },
];

const CNBC_ENDPOINT = "https://quote.cnbc.com/quote-html-webservice/quote.htm";
const YAHOO_CHART_ENDPOINT = "https://query1.finance.yahoo.com/v8/finance/chart";
const CUSTOM_FINANCE_GROUPS: FinanceInstrumentGroup[] = ["tw", "asia", "korea", "fx", "commodities", "rates", "us", "crypto"];
const DEFAULT_INSTRUMENT_IDS = new Set(INSTRUMENTS.map((instrument) => instrument.id));

function slugifyInstrumentId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function normalizeCustomFinanceInstrument(input: CustomFinanceInstrumentInput, index: number): FinanceInstrument | null {
  const symbol = typeof input.symbol === "string" ? input.symbol.trim().toUpperCase() : "";
  if (!symbol || symbol.length > 32) return null;

  const provider = input.provider === "yahoo" ? "yahoo" : "cnbc";
  const group = CUSTOM_FINANCE_GROUPS.includes(input.group as FinanceInstrumentGroup)
    ? (input.group as FinanceInstrumentGroup)
    : "us";
  const name =
    typeof input.name === "string" && input.name.trim()
      ? input.name.trim().slice(0, 80)
      : symbol;
  const idBase = slugifyInstrumentId(`${provider}-${symbol}`) || `custom-${index + 1}`;
  const encodedSymbol = encodeURIComponent(symbol);

  return {
    id: `custom-${idBase}`,
    name,
    symbol,
    sourceUrl:
      provider === "yahoo"
        ? `https://finance.yahoo.com/quote/${encodedSymbol}`
        : `https://www.cnbc.com/quotes/${encodedSymbol}`,
    group,
    provider,
    localLabel: `${provider.toUpperCase()}: ${symbol}`,
  };
}

function getCustomFinanceInstruments(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("custom");
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .slice(0, 30)
      .map((item, index) => normalizeCustomFinanceInstrument(item as CustomFinanceInstrumentInput, index))
      .filter((item): item is FinanceInstrument => item != null);
  } catch {
    return [];
  }
}

function getDefaultFinanceInstruments(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("defaults");
  if (!raw) return INSTRUMENTS;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return INSTRUMENTS;
    const requestedIds = new Set(
      parsed
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item) => DEFAULT_INSTRUMENT_IDS.has(item))
    );
    return INSTRUMENTS.filter((instrument) => requestedIds.has(instrument.id));
  } catch {
    return INSTRUMENTS;
  }
}

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

function getYahooHistorySymbol(instrument: FinanceInstrument) {
  if (YAHOO_HISTORY_SYMBOLS[instrument.id]) return YAHOO_HISTORY_SYMBOLS[instrument.id];
  if (instrument.provider === "yahoo") return instrument.symbol;
  if (/^[A-Z0-9.-]+$/.test(instrument.symbol)) return instrument.symbol;
  return "";
}

async function fetchYahooHistory(instrument: FinanceInstrument, historyRange: FinanceHistoryRange): Promise<FinanceHistoryPoint[]> {
  const symbol = getYahooHistorySymbol(instrument);
  if (!symbol) return [];

  const params = new URLSearchParams({
    range: historyRange.range,
    interval: historyRange.interval,
    lang: "zh-TW",
    region: "TW",
  });

  const response = await fetch(`${YAHOO_CHART_ENDPOINT}/${encodeURIComponent(symbol)}?${params.toString()}`, {
    headers: {
      accept: "application/json,text/plain,*/*",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    },
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`Yahoo Finance history ${response.status}`);
  const payload = await response.json();
  const chart = payload?.chart?.result?.[0];
  const timestamps = chart?.timestamp;
  const closes = chart?.indicators?.quote?.[0]?.close;
  if (!Array.isArray(timestamps) || !Array.isArray(closes)) return [];

  return timestamps
    .map((timestamp: unknown, index: number) => {
      const time = asNumber(timestamp);
      const price = asNumber(closes[index]);
      if (time == null || price == null) return null;
      return {
        date: new Date(time * 1000).toISOString().slice(0, 10),
        price,
      };
    })
    .filter((point): point is FinanceHistoryPoint => point != null);
}

async function fetchYahooHistoryRanges(instrument: FinanceInstrument) {
  const settled = await Promise.allSettled(
    FINANCE_HISTORY_RANGES.map((historyRange) => fetchYahooHistory(instrument, historyRange))
  );
  const historyRanges: Record<string, FinanceHistoryPoint[]> = {};
  const historyErrors: Record<string, string> = {};

  settled.forEach((item, index) => {
    const key = FINANCE_HISTORY_RANGES[index].key;
    if (item.status === "fulfilled") {
      historyRanges[key] = item.value;
      return;
    }
    historyRanges[key] = [];
    historyErrors[key] = item.reason instanceof Error ? item.reason.message : "Failed to load history";
  });

  return { historyRanges, historyErrors };
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
    high52: instrument.id === "kospi" ? 9385.59 : high52,
    low52: instrument.id === "kospi" ? 3079.27 : low52,
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
  const closes = toNumberList(quote.close).filter((value) => value > 0);
  const highs = toNumberList(quote.high).filter((value) => value > 0);
  const lows = toNumberList(quote.low).filter((value) => value > 0);
  const price = pickNumber(meta, ["regularMarketPrice"]) ?? closes.at(-1) ?? null;
  const previousClose =
    pickNumber(meta, ["regularMarketPreviousClose", "previousClose"]) ??
    (closes.length > 1 ? closes[closes.length - 2] : null);
  const high52 = pickNumber(meta, ["fiftyTwoWeekHigh"]) ?? (closes.length ? Math.max(...closes) : null);
  const low52 = pickNumber(meta, ["fiftyTwoWeekLow"]) ?? (closes.length ? Math.min(...closes) : null);
  const change =
    pickNumber(meta, ["regularMarketChange"]) ??
    (price != null && previousClose != null ? price - previousClose : null);
  const changePercent =
    pickNumber(meta, ["regularMarketChangePercent"]) ??
    (change != null && previousClose ? (change / previousClose) * 100 : null);
  const marketTime = pickNumber(meta, ["regularMarketTime"]);
  const dayHigh = pickNumber(meta, ["regularMarketDayHigh"]) ?? highs.at(-1) ?? null;
  const dayLow = pickNumber(meta, ["regularMarketDayLow"]) ?? lows.at(-1) ?? null;

  let currency = pickText(meta, ["currency"]);
  if (!currency) {
    currency = meta.exchangeTimezoneName === "America/New_York" ? "USD" : "TWD";
  }

  return {
    ...instrument,
    displayName: pickText(meta, ["shortName", "longName"]) || instrument.name,
    price,
    change,
    changePercent,
    currency,
    high52,
    low52,
    dayHigh,
    dayLow,
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

async function fetchFinanceInstrument(instrument: FinanceInstrument, options?: { skipHistory?: boolean }) {
  const quote =
    instrument.provider === "yahoo"
      ? await fetchYahooInstrument(instrument)
      : instrument.provider === "multpl"
        ? await fetchMultplInstrument(instrument)
        : await fetchInstrument(instrument);

  if (options?.skipHistory || instrument.provider === "multpl") {
    return { ...quote, historyRanges: {}, historyErrors: {} };
  }

  try {
    const { historyRanges, historyErrors } = await fetchYahooHistoryRanges(instrument);
    return { ...quote, historyRanges, historyErrors };
  } catch (error) {
    return {
      ...quote,
      historyRanges: {},
      historyErrors: {
        all: error instanceof Error ? error.message : "Failed to load history",
      },
    };
  }
}

function shouldSkipHistory(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("skipHistory") ?? searchParams.get("quoteOnly");
  return raw === "1" || raw === "true";
}

export async function GET(request: Request) {
  const skipHistory = shouldSkipHistory(request);
  const instruments = [...getDefaultFinanceInstruments(request), ...getCustomFinanceInstruments(request)];
  const settled = await Promise.allSettled(instruments.map((instrument) => fetchFinanceInstrument(instrument, { skipHistory })));
  const quotes = settled.map((item, index) => {
    if (item.status === "fulfilled") return item.value;
    const instrument = instruments[index];
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
      historyRanges: {},
      historyErrors: {},
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
      periodLabel: quote.periodLabel,
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
