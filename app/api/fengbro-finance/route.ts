import { NextResponse } from "next/server";
import {
  buildCnbcQuoteSourceUrl,
  buildYahooQuoteSourceUrl,
  isTaiwanYahooQuoteTarget,
  parseTaiwanYahooQuotePageTitle,
} from "@/lib/fengbroFinanceCustom";

export const dynamic = "force-dynamic";

type FinanceProvider = "cnbc" | "yahoo" | "mis";

type FinanceInstrument = {
  id: string;
  name: string;
  symbol: string;
  sourceUrl: string;
  /** Region: 韓國 / 日本 / 台灣 / 美國 / 其他 */
  group: "korea" | "japan" | "taiwan" | "us" | "other";
  provider?: FinanceProvider;
  alertThreshold?: number;
  localLabel?: string;
  youtubeUrl?: string;
  youtubeLabel?: string;
  youtubeLinks?: Array<{ label: string; url: string }>;
  bilibiliUrl?: string;
  /** Extra external links (PTT 閒聊、官方指數頁等), rendered with ExternalLink. */
  relatedLinks?: Array<{ label: string; url: string }>;
  periodLabel?: string;
  /**
   * Optional horizontal reference levels (e.g. 融資平均水平線).
   * Drawn on history charts and shown as annotation badges.
   */
  referenceLevels?: Array<{ value: number; label: string }>;
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
  key: "1y" | "3y";
  range: string;
  interval: string;
  /** Keep only the most recent N years after fetch (Yahoo has no native 3y range). */
  keepYears?: number;
};

const FINANCE_HISTORY_RANGES: FinanceHistoryRange[] = [
  { key: "1y", range: "1y", interval: "1wk" },
  // Yahoo chart API has no native "3y"; fetch 5y weekly then trim to 3 years.
  { key: "3y", range: "5y", interval: "1wk", keepYears: 3 },
];
const YAHOO_HISTORY_SYMBOLS: Record<string, string> = {
  kospi: "^KS11",
  koru: "KORU",
};

const INSTRUMENTS: FinanceInstrument[] = [
  { id: "kioxia", name: "キオクシア 鎧俠", symbol: "285A.T", sourceUrl: "https://finance.yahoo.com/quote/285A.T", group: "japan", provider: "yahoo", localLabel: "TYO: 285A" },
  {
    id: "kospi",
    name: "KOSPI Index",
    symbol: ".KS11",
    sourceUrl: "https://www.cnbc.com/quotes/.KS11?qsearchterm=kospi",
    group: "korea",
    alertThreshold: 12682,
    localLabel: "코스피",
    periodLabel: "2026~2027",
    /** 韓國市場融資平均水平線約為 6472 點 · 絕對不能破 */
    referenceLevels: [
      { value: 6472, label: "韓國市場融資平均水平線約為6472點 · 絕對不能破" },
    ],
    youtubeUrl: "https://www.youtube.com/results?search_query=%EC%BD%94%EC%8A%A4%ED%94%BC&sp=EgIIAg%253D%253D",
    bilibiliUrl:
      "https://search.bilibili.com/all?vt=47938637&keyword=%E9%9F%93%E5%9C%8B%E8%82%A1%E5%B8%82&from_source=web_search&spm_id_from=333.1007&search_source=5&pubtime_begin_s=1784044800&pubtime_end_s=1784649599",
    imageUrl: "/finance/kospi-202607212245.png",
    imageUrls: [
      "/finance/kospi-202607212245.png",
      "/finance/kospi-202607212238.png",
      "/finance/kospi-202607212237-17.png",
      "/finance/kospi-202607212237-03.png",
      "/finance/kospi-202607212218-51.png",
      "/finance/kospi-202607212218-26.png",
      "/finance/kospi-202607212215.png",
      "/finance/kospi-202607212214.png",
      "/finance/kospi-20260721-fibonacci.jpg",
      "/finance/kospi-20260721-compound-loss.jpg",
      "/finance/kospi-202607211923.png",
      "/finance/kospi-202607201654.png",
      "/finance/kospi-202607201639-58.png",
      "/finance/kospi-202607201639-54.png",
      "/finance/kospi-202607201630-44.png",
      "/finance/kospi-202607201630-41.png",
      "/finance/kospi-20260720-6472-hoodie.jpg",
      "/finance/kospi-20260720-6472-suit.jpg",
      "/finance/kospi-202607201244-pink.png",
      "/finance/kospi-202607201244-hoodie.png",
      "/finance/kospi-202607192019.png",
      "/finance/kospi-202607192018-43.png",
      "/finance/kospi-202607192018-23.png",
      "/finance/kospi-202607141413.png",
      "/finance/kospi-202607141405.png",
      "/finance/kospi-202607141219.png",
      "/finance/kospi-202607121235.png",
      "/finance/kospi-202605010347.jpg",
      "/finance/kospi-cats.jpg",
      "/finance/kospi-index.png",
    ],
  },
  { id: "sk-hynix", name: "SK 海力士", symbol: "000660.KS", sourceUrl: "https://finance.yahoo.com/quote/000660.KS", group: "korea", provider: "yahoo", alertThreshold: 11110000 },
  { id: "sk-hynix-adr", name: "SK hynix Inc. ADR", symbol: "SKHY", sourceUrl: "https://finance.yahoo.com/quote/SKHY", group: "korea", provider: "yahoo" },
  { id: "koru", name: "Direxion Daily MSCI South Korea Bull 3X ETF", symbol: "KORU", sourceUrl: "https://www.cnbc.com/quotes/KORU", group: "korea", localLabel: "NYSEARCA: KORU" },
];

const CNBC_ENDPOINT = "https://quote.cnbc.com/quote-html-webservice/quote.htm";
const YAHOO_CHART_ENDPOINT = "https://query1.finance.yahoo.com/v8/finance/chart";
/** TWSE MIS realtime quote (櫃買指數 = otc_o00.tw). */
const TWSE_MIS_QUOTE_URL = "https://mis.twse.com.tw/stock/api/getStockInfo.jsp";
/** TPEx daily trading index history (close at column index 4). */
const TPEX_DAILY_INDEX_URL =
  "https://www.tpex.org.tw/web/stock/aftertrading/daily_trading_index/st41_result.php";
const CUSTOM_FINANCE_GROUPS: FinanceInstrumentGroup[] = ["korea", "japan", "taiwan", "us", "other"];

/** Map legacy asset-type groups (and unknown) onto region groups. */
function migrateInstrumentGroup(group: unknown): FinanceInstrumentGroup {
  if (typeof group === "string" && (CUSTOM_FINANCE_GROUPS as string[]).includes(group)) {
    return group as FinanceInstrumentGroup;
  }
  const legacy: Record<string, FinanceInstrumentGroup> = {
    asia: "other",
    "asia-stocks": "japan",
    korea: "korea",
    tw: "taiwan",
    "tw-stocks": "taiwan",
    us: "us",
    "us-stocks": "us",
    fx: "other",
    rates: "other",
    commodities: "other",
    crypto: "other",
    valuation: "other",
  };
  if (typeof group === "string" && legacy[group]) return legacy[group];
  return "other";
}
const DEFAULT_INSTRUMENT_IDS = new Set(INSTRUMENTS.map((instrument) => instrument.id));
const FETCH_BROWSER_HEADERS = {
  accept: "application/json,text/plain,*/*",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
};

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
  const group = migrateInstrumentGroup(input.group);
  const name =
    typeof input.name === "string" && input.name.trim()
      ? input.name.trim().slice(0, 80)
      : symbol;
  const idBase = slugifyInstrumentId(`${provider}-${symbol}`) || `custom-${index + 1}`;

  return {
    id: `custom-${idBase}`,
    name,
    symbol,
    // 台股 (.TW / .TWO / tw 分類) 連到 Yahoo 奇摩，不要改成 finance.yahoo.com
    sourceUrl:
      provider === "yahoo"
        ? buildYahooQuoteSourceUrl(symbol, { group })
        : buildCnbcQuoteSourceUrl(symbol),
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

/** Asia/Taipei calendar parts for market session / ROC date windows. */
function getTaipeiNowParts() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    weekday: get("weekday"),
  };
}

function getTwMarketSessionFromTaipei(): "pre" | "regular" | "closed" {
  const { hour, minute, weekday } = getTaipeiNowParts();
  if (weekday === "Sat" || weekday === "Sun") return "closed";
  const mins = hour * 60 + minute;
  if (mins < 9 * 60) return "pre";
  if (mins < 13 * 60 + 30) return "regular";
  return "closed";
}

/** Gregorian YYYY-MM-DD → ROC yyy/MM/dd (民國年). */
function toRocYmd(year: number, month: number, day: number) {
  return `${year - 1911}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
}

/** ROC "115/07/17" → ISO "2026-07-17". */
function fromRocYmd(roc: string) {
  const match = roc.trim().match(/^(\d{2,3})\/(\d{1,2})\/(\d{1,2})$/);
  if (!match) return null;
  const year = Number(match[1]) + 1911;
  const month = String(Number(match[2])).padStart(2, "0");
  const day = String(Number(match[3])).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftMonth(year: number, month: number, delta: number) {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Keep the last trading point of each ISO week (Mon–Sun) for chart density. */
function downsampleToWeekly(points: FinanceHistoryPoint[]) {
  const byWeek = new Map<string, FinanceHistoryPoint>();
  for (const point of points) {
    const date = new Date(`${point.date}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) continue;
    // ISO week key via Thursday of the same week.
    const day = date.getUTCDay() || 7;
    const thursday = new Date(date);
    thursday.setUTCDate(date.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    const key = `${thursday.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
    byWeek.set(key, point);
  }
  return Array.from(byWeek.values()).sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchTpexDailyIndexMonth(year: number, month: number): Promise<FinanceHistoryPoint[]> {
  const start = toRocYmd(year, month, 1);
  const end = toRocYmd(year, month, lastDayOfMonth(year, month));
  const params = new URLSearchParams({
    l: "zh-tw",
    d: start,
    e: end,
    s: "0,asc,0",
  });
  const response = await fetch(`${TPEX_DAILY_INDEX_URL}?${params.toString()}`, {
    headers: FETCH_BROWSER_HEADERS,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`TPEx daily index ${response.status}`);
  const payload = await response.json();
  const rows = payload?.tables?.[0]?.data;
  if (!Array.isArray(rows)) return [];

  const points: FinanceHistoryPoint[] = [];
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 5) continue;
    const date = fromRocYmd(String(row[0] ?? ""));
    const price = asNumber(row[4]);
    if (!date || price == null || price <= 0) continue;
    points.push({ date, price });
  }
  return points;
}

/** Fetch TPEx 櫃買指數 daily closes for the last `years` years (month-by-month). */
async function fetchTpexOtcHistoryPoints(years: number): Promise<FinanceHistoryPoint[]> {
  const taipei = getTaipeiNowParts();
  const end = { year: taipei.year, month: taipei.month };
  const start = shiftMonth(end.year, end.month, -(years * 12 + 1));
  const months: Array<{ year: number; month: number }> = [];
  let cursor = { ...start };
  while (cursor.year < end.year || (cursor.year === end.year && cursor.month <= end.month)) {
    months.push({ ...cursor });
    cursor = shiftMonth(cursor.year, cursor.month, 1);
  }

  const settled = await Promise.allSettled(months.map((item) => fetchTpexDailyIndexMonth(item.year, item.month)));
  const byDate = new Map<string, number>();
  for (const item of settled) {
    if (item.status !== "fulfilled") continue;
    for (const point of item.value) byDate.set(point.date, point.price);
  }

  return Array.from(byDate.entries())
    .map(([date, price]) => ({ date, price }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function sliceHistoryPoints(points: FinanceHistoryPoint[], keepYears: number) {
  if (keepYears <= 0 || points.length === 0) return points;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - keepYears);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  return points.filter((point) => point.date >= cutoffIso);
}

function highLowFromPoints(points: FinanceHistoryPoint[]) {
  let high: number | null = null;
  let low: number | null = null;
  for (const point of points) {
    if (high == null || point.price > high) high = point.price;
    if (low == null || point.price < low) low = point.price;
  }
  return { high52: high, low52: low };
}

async function fetchTpexOtcHistoryRanges() {
  // One multi-year daily pull, then slice/downsample for chart ranges.
  const daily = await fetchTpexOtcHistoryPoints(3);
  const oneYear = sliceHistoryPoints(daily, 1);
  const threeYear = sliceHistoryPoints(daily, 3);
  return {
    historyRanges: {
      "1y": downsampleToWeekly(oneYear),
      "3y": downsampleToWeekly(threeYear),
    } as Record<string, FinanceHistoryPoint[]>,
    historyErrors: {} as Record<string, string>,
    highLow1y: highLowFromPoints(oneYear),
  };
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

  const points = timestamps
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

  if (historyRange.keepYears == null || historyRange.keepYears <= 0 || points.length === 0) {
    return points;
  }

  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - historyRange.keepYears);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  return points.filter((point) => point.date >= cutoffIso);
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
  // CNBC often nests 52-week high/low under FundamentalData (indices/ETFs), not top-level.
  const fundamentals =
    quote.FundamentalData && typeof quote.FundamentalData === "object"
      ? (quote.FundamentalData as Record<string, unknown>)
      : null;
  const price = pickNumber(quote, ["last", "last_price", "Last", "price", "yrlast"]);
  const high52 =
    pickNumber(quote, ["high_52week", "high52", "yrhiprice", "year_high", "52week_high"]) ??
    (fundamentals
      ? pickNumber(fundamentals, ["high_52week", "high52", "yrhiprice", "year_high", "52week_high"])
      : null);
  const low52 =
    pickNumber(quote, ["low_52week", "low52", "yrloprice", "year_low", "52week_low"]) ??
    (fundamentals
      ? pickNumber(fundamentals, ["low_52week", "low52", "yrloprice", "year_low", "52week_low"])
      : null);
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

/**
 * Live quote for Taiwan OTC / 櫃買指數 via TWSE MIS.
 * Yahoo ^TWOII is stuck around 2024 levels and must not be used.
 */
async function fetchMisInstrument(instrument: FinanceInstrument) {
  const exCh = instrument.symbol.includes("_") ? instrument.symbol : `otc_${instrument.symbol}`;
  const params = new URLSearchParams({
    ex_ch: exCh,
    json: "1",
    delay: "0",
  });
  const response = await fetch(`${TWSE_MIS_QUOTE_URL}?${params.toString()}`, {
    headers: FETCH_BROWSER_HEADERS,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`TWSE MIS ${response.status}`);
  const payload = await response.json();
  const row = Array.isArray(payload?.msgArray) ? payload.msgArray[0] : null;
  if (!row || typeof row !== "object") throw new Error("No TWSE MIS quote data");

  const record = row as Record<string, unknown>;
  const price = pickNumber(record, ["z", "pz"]);
  const previousClose = pickNumber(record, ["y"]);
  const dayHigh = pickNumber(record, ["h"]);
  const dayLow = pickNumber(record, ["l"]);
  if (price == null || price <= 0) throw new Error("TWSE MIS price unavailable");

  const change =
    previousClose != null && previousClose > 0 ? price - previousClose : null;
  const changePercent =
    change != null && previousClose ? (change / previousClose) * 100 : null;

  const marketSession = getTwMarketSessionFromTaipei();
  const marketState =
    marketSession === "regular" ? "REGULAR" : marketSession === "pre" ? "PRE" : "CLOSED";

  const tradeDate = asText(record.d); // YYYYMMDD
  const tradeTime = asText(record.t); // HH:mm:ss
  let lastUpdated = "";
  if (tradeDate.length === 8) {
    const isoDate = `${tradeDate.slice(0, 4)}-${tradeDate.slice(4, 6)}-${tradeDate.slice(6, 8)}`;
    lastUpdated = tradeTime
      ? new Date(`${isoDate}T${tradeTime}+08:00`).toISOString()
      : `${isoDate}T00:00:00+08:00`;
  }

  return {
    ...instrument,
    displayName: pickText(record, ["n", "nf"]) || instrument.name,
    price,
    change,
    changePercent,
    currency: "TWD",
    high52: null as number | null,
    low52: null as number | null,
    dayHigh,
    dayLow,
    marketState,
    marketSession,
    preMarketPrice: null as number | null,
    preMarketChange: null as number | null,
    preMarketChangePercent: null as number | null,
    postMarketPrice: null as number | null,
    postMarketChange: null as number | null,
    postMarketChangePercent: null as number | null,
    regularMarketPrice: price,
    regularMarketChange: change,
    regularMarketChangePercent: changePercent,
    previousClose,
    lastUpdated,
    recordTag: null as string | null,
  };
}

/**
 * Yahoo chart meta only has English shortName for TW stocks (e.g. KING SLIDE WORKS CO).
 * Scrape Yahoo 奇摩 page title for Chinese short names (e.g. 川湖).
 * Used when the stored 代稱 is still just the ticker.
 */
async function resolveTaiwanYahooChineseName(symbol: string, sourceUrl?: string): Promise<string | null> {
  const pageUrl =
    sourceUrl && /tw\.stock\.yahoo\.com/i.test(sourceUrl)
      ? sourceUrl
      : buildYahooQuoteSourceUrl(symbol, { marketHint: "tw" });

  try {
    const response = await fetch(pageUrl, {
      headers: FETCH_BROWSER_HEADERS,
      cache: "no-store",
      redirect: "follow",
    });
    if (!response.ok) return null;

    const html = await response.text();
    const title = (html.match(/<title[^>]*>([^<]+)/i) || [])[1] || "";
    const fromTitle = parseTaiwanYahooQuotePageTitle(title);
    if (fromTitle?.name) return fromTitle.name.slice(0, 80);

    const symbolNameMatch = html.match(/"symbolName"\s*:\s*"([^"]{1,40})"/);
    if (symbolNameMatch?.[1]?.trim()) return symbolNameMatch[1].trim().slice(0, 80);
  } catch {
    // network / parse — fall back to chart English name
  }
  return null;
}

function isTickerLikeName(name: string, symbol: string) {
  const n = name.trim().toUpperCase();
  const s = symbol.trim().toUpperCase();
  return !n || n === s;
}

async function fetchYahooInstrument(instrument: FinanceInstrument) {
  const isUsListed =
    !/\.(TW|KS|T|HK|L|TO|AX)$/i.test(instrument.symbol) &&
    !instrument.symbol.startsWith("^") &&
    !instrument.symbol.includes("=");
  // Use 1d quote window for latest session price — never range=1y for the live quote.
  // With range=1y, chartPreviousClose is ~1 year ago and must not be treated as previous close.
  const params = new URLSearchParams({
    range: "1d",
    interval: "1m",
    includePrePost: "true",
    lang: isUsListed ? "en-US" : "zh-TW",
    region: isUsListed ? "US" : "TW",
  });

  const response = await fetch(`${YAHOO_CHART_ENDPOINT}/${encodeURIComponent(instrument.symbol)}?${params.toString()}`, {
    headers: FETCH_BROWSER_HEADERS,
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`Yahoo Finance ${response.status}`);
  const payload = await response.json();
  const chart = payload?.chart?.result?.[0];
  if (!chart || typeof chart !== "object") throw new Error("No Yahoo Finance chart data");

  const meta = (chart.meta || {}) as Record<string, unknown>;
  const quote = (chart.indicators?.quote?.[0] || {}) as Record<string, unknown>;
  const closes = toNumberList(quote.close).filter((value) => value > 0);

  // Latest regular-session price from quote meta only (not 1y history series).
  const regularPrice = pickNumber(meta, ["regularMarketPrice"]);
  // Session previous close only — never chartPreviousClose from multi-month ranges.
  const previousClose = pickNumber(meta, ["regularMarketPreviousClose", "previousClose"]);
  const high52 = pickNumber(meta, ["fiftyTwoWeekHigh"]);
  const low52 = pickNumber(meta, ["fiftyTwoWeekLow"]);
  const regularChange =
    pickNumber(meta, ["regularMarketChange"]) ??
    (regularPrice != null && previousClose != null ? regularPrice - previousClose : null);
  const regularChangePercent =
    pickNumber(meta, ["regularMarketChangePercent"]) ??
    (regularChange != null && previousClose ? (regularChange / previousClose) * 100 : null);
  const marketState = pickText(meta, ["marketState"]).toUpperCase();

  let preMarketPrice = pickNumber(meta, ["preMarketPrice"]);
  let preMarketChange = pickNumber(meta, ["preMarketChange"]);
  let preMarketChangePercent = pickNumber(meta, ["preMarketChangePercent"]);
  // When meta omits preMarket* but 1m chart has extended-hours bars, use the last bar during PRE.
  if (preMarketPrice == null && marketState === "PRE" && closes.length > 0) {
    const lastBar = closes.at(-1) ?? null;
    if (lastBar != null && (regularPrice == null || !nearlyEqual(lastBar, regularPrice))) {
      preMarketPrice = lastBar;
    }
  }
  if (preMarketChange == null && preMarketPrice != null && previousClose != null) {
    preMarketChange = preMarketPrice - previousClose;
  }
  if (preMarketChangePercent == null && preMarketChange != null && previousClose) {
    preMarketChangePercent = (preMarketChange / previousClose) * 100;
  }

  let postMarketPrice = pickNumber(meta, ["postMarketPrice"]);
  let postMarketChange = pickNumber(meta, ["postMarketChange"]);
  let postMarketChangePercent = pickNumber(meta, ["postMarketChangePercent"]);
  if (
    postMarketPrice == null &&
    (marketState === "POST" || marketState === "POSTPOST") &&
    closes.length > 0
  ) {
    const lastBar = closes.at(-1) ?? null;
    if (lastBar != null && (regularPrice == null || !nearlyEqual(lastBar, regularPrice))) {
      postMarketPrice = lastBar;
    }
  }
  if (postMarketChange == null && postMarketPrice != null && regularPrice != null) {
    postMarketChange = postMarketPrice - regularPrice;
  }
  if (postMarketChangePercent == null && postMarketChange != null && regularPrice) {
    postMarketChangePercent = (postMarketChange / regularPrice) * 100;
  }

  // Primary "最新價" is always regular-session latest, separate from pre/post.
  const price = regularPrice;
  const change = regularChange;
  const changePercent = regularChangePercent;
  const marketTime = pickNumber(meta, ["regularMarketTime"]);
  let marketSession: "pre" | "regular" | "post" | "closed" | "" = "";

  if (marketState === "PRE") {
    marketSession = "pre";
  } else if (marketState === "POST" || marketState === "POSTPOST") {
    marketSession = "post";
  } else if (marketState === "REGULAR") {
    marketSession = "regular";
  } else if (marketState === "CLOSED") {
    marketSession = "closed";
  }

  const dayHigh = pickNumber(meta, ["regularMarketDayHigh"]);
  const dayLow = pickNumber(meta, ["regularMarketDayLow"]);

  let currency = pickText(meta, ["currency"]);
  if (!currency) {
    currency = meta.exchangeTimezoneName === "America/New_York" ? "USD" : "TWD";
  }

  // Chart API returns English names for TW listings; prefer 奇摩中文 when 代稱 is still the ticker.
  const chartName = pickText(meta, ["shortName", "longName"]);
  let displayName = chartName || instrument.name;
  let name = instrument.name;
  const preferTwChinese = isTaiwanYahooQuoteTarget(instrument.symbol, {
    group: instrument.group,
    sourceUrl: instrument.sourceUrl,
  });
  if (preferTwChinese && isTickerLikeName(instrument.name, instrument.symbol)) {
    const chineseName = await resolveTaiwanYahooChineseName(instrument.symbol, instrument.sourceUrl);
    if (chineseName) {
      displayName = chineseName;
      name = chineseName;
    }
  }

  return {
    ...instrument,
    name,
    displayName,
    price,
    change,
    changePercent,
    currency,
    high52,
    low52,
    dayHigh,
    dayLow,
    marketState: marketState || "",
    marketSession,
    preMarketPrice,
    preMarketChange,
    preMarketChangePercent,
    postMarketPrice,
    postMarketChange,
    postMarketChangePercent,
    regularMarketPrice: regularPrice,
    regularMarketChange: regularChange,
    regularMarketChangePercent: regularChangePercent,
    previousClose,
    lastUpdated: marketTime ? new Date(marketTime * 1000).toISOString() : "",
    recordTag: getRecordTag(price, high52, low52),
  };
}

async function fetchFinanceInstrument(instrument: FinanceInstrument, options?: { skipHistory?: boolean }) {
  const quote =
    instrument.provider === "mis"
      ? await fetchMisInstrument(instrument)
      : instrument.provider === "yahoo"
        ? await fetchYahooInstrument(instrument)
        : await fetchInstrument(instrument);

  if (options?.skipHistory) {
    return { ...quote, historyRanges: {}, historyErrors: {} };
  }

  if (instrument.provider === "mis") {
    try {
      const { historyRanges, historyErrors, highLow1y } = await fetchTpexOtcHistoryRanges();
      const high52 = highLow1y.high52;
      const low52 = highLow1y.low52;
      return {
        ...quote,
        high52,
        low52,
        recordTag: getRecordTag(quote.price, high52, low52),
        historyRanges,
        historyErrors,
      };
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
  const baseQuotes = settled.map((item, index) => {
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
  });
  const quotes = baseQuotes.map((quote) => {
    const thresholdAlert = isThresholdAlert(quote.price, quote.alertThreshold);
    return {
      ...quote,
      isThresholdAlert: thresholdAlert,
      alertMessage: thresholdAlert
        ? `${quote.name} 目前 ${quote.price}${quote.currency ? ` ${quote.currency}` : ""}，已突破 ${quote.alertThreshold}`
        : "",
    };
  });
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
    source: "CNBC / Yahoo Finance / TWSE MIS / TPEx",
    quotes,
    financeAlerts,
  });
}
