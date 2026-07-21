import { NextResponse } from "next/server";
import {
  buildCnbcQuoteSourceUrl,
  buildYahooQuoteSourceUrl,
  isTaiwanYahooQuoteTarget,
  parseTaiwanYahooQuotePageTitle,
} from "@/lib/fengbroFinanceCustom";

export const dynamic = "force-dynamic";

type FinanceProvider = "cnbc" | "yahoo" | "multpl" | "mis";

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

const SHILLER_PE_URL = "https://www.multpl.com/shiller-pe";
const SHILLER_PE_RECORD_HIGH = 44.19;
const SHILLER_PE_RECORD_DATE = "Dec 1999";
const FINANCE_HISTORY_RANGES: FinanceHistoryRange[] = [
  { key: "1y", range: "1y", interval: "1wk" },
  // Yahoo chart API has no native "3y"; fetch 5y weekly then trim to 3 years.
  { key: "3y", range: "5y", interval: "1wk", keepYears: 3 },
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
  bitcoin: "BTC-USD",
  ether: "ETH-USD",
  tsm: "TSM",
  koru: "KORU",
  soxl: "SOXL",
};

const INSTRUMENTS: FinanceInstrument[] = [
  {
    id: "taiex",
    name: "加權指數",
    symbol: "^TWII",
    sourceUrl: "https://tw.stock.yahoo.com/quote/%5ETWII",
    group: "taiwan",
    provider: "yahoo",
    alertThreshold: 126820,
    localLabel: "週一至五 09:00–13:30",
    imageUrl: "/finance/taiex-cats.png",
    relatedLinks: [
      { label: "盤中閒聊", url: "https://www.ptt.cc/bbs/Stock/search?q=%E7%9B%A4%E4%B8%AD%E9%96%92%E8%81%8A" },
      { label: "盤後閒聊", url: "https://www.ptt.cc/bbs/Stock/search?q=%E7%9B%A4%E5%BE%8C%E9%96%92%E8%81%8A" },
      { label: "證交所", url: "https://www.twse.com.tw/" },
    ],
  },
  {
    id: "otc",
    name: "上櫃指數",
    // Yahoo ^TWOII feed is stale (~2024); live quote uses TWSE MIS otc_o00.tw.
    symbol: "otc_o00.tw",
    sourceUrl: "https://www.tpex.org.tw/",
    group: "taiwan",
    provider: "mis",
    alertThreshold: 666,
    localLabel: "櫃買指數 · 週一至五 09:00–13:30",
    relatedLinks: [
      { label: "盤中閒聊", url: "https://www.ptt.cc/bbs/Stock/search?q=%E7%9B%A4%E4%B8%AD%E9%96%92%E8%81%8A" },
      { label: "盤後閒聊", url: "https://www.ptt.cc/bbs/Stock/search?q=%E7%9B%A4%E5%BE%8C%E9%96%92%E8%81%8A" },
      { label: "櫃買中心", url: "https://www.tpex.org.tw/" },
      { label: "MIS 即時", url: "https://mis.twse.com.tw/stock/index?lang=zhHant" },
    ],
  },
  { id: "tsmc", name: "台積電", symbol: "2330.TW", sourceUrl: "https://tw.stock.yahoo.com/quote/2330.TW", group: "taiwan", provider: "yahoo", alertThreshold: 3333, imageUrl: "/finance/tsmc-featured.jpg" },
  {
    id: "tsm",
    name: "台積電 ADR",
    symbol: "TSM",
    sourceUrl: "https://www.investing.com/equities/taiwan-semicond.manufacturing-co",
    group: "taiwan",
    provider: "yahoo",
    localLabel: "NYSE: TSM · Pre/After Market",
    imageUrl: "/finance/tsmc-featured.jpg",
  },
  { id: "nikkei-225", name: "Nikkei 225 Index", symbol: ".N225", sourceUrl: "https://www.cnbc.com/quotes/.N225", group: "japan", alertThreshold: 110000, localLabel: "日経平均株価", imageUrl: "/finance/nikkei-225-featured.jpg", youtubeUrl: "https://www.youtube.com/results?search_query=%E5%A4%A7%E6%9A%B4%E8%90%BD", youtubeLabel: "日経平均株価 大暴落", youtubeLinks: [{ label: "日経平均株価 インフレ", url: "https://www.youtube.com/results?search_query=%E6%97%A5%E7%B5%8C%E5%B9%B3%E5%9D%87%E6%A0%AA%E4%BE%A1%20%E3%82%A4%E3%83%B3%E3%83%95%E3%83%AC" }, { label: "朝倉慶 文藝春秋", url: "https://www.youtube.com/@Bungeishunju/search?query=%E6%9C%9D%E5%80%89%E6%85%B6" }, { label: "朝倉慶 ASK1", url: "https://www.youtube.com/@info_ask1/search?query=%E6%9C%9D%E5%80%89%E6%85%B6" }, { label: "朝倉慶 楽待", url: "https://www.youtube.com/@rakumachi/search?query=%E6%9C%9D%E5%80%89%E6%85%B6" }, { label: "朝倉慶 外為どっとコム", url: "https://www.youtube.com/@gaitame_com/search?query=%E6%9C%9D%E5%80%89%E6%85%B6" }] },
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
    youtubeUrl: "https://www.youtube.com/results?search_query=SK+Hynix+stock&sp=CAMSBAgCEAE%253D",
    bilibiliUrl:
      "https://search.bilibili.com/all?keyword=%E9%9F%93%E5%9C%8B%E8%82%A1%E5%B8%82&from_source=web_search&spm_id_from=333.1007&search_source=5&pubtime_begin_s=1782489600&pubtime_end_s=1783094399",
    imageUrl: "/finance/kospi-202607201244-pink.png",
    imageUrls: [
      "/finance/kospi-202607201244-pink.png",
      "/finance/kospi-202607201244-hoodie.png",
      "/finance/kospi-202607141413.png",
      "/finance/kospi-202607141405.png",
      "/finance/kospi-202607141219.png",
      "/finance/kospi-202607121235.png",
      "/finance/kospi-cats.jpg",
      "/finance/kospi-index.png",
    ],
  },
  { id: "samsung-electronics", name: "三星電子", symbol: "005930.KS", sourceUrl: "https://finance.yahoo.com/quote/005930.KS", group: "korea", provider: "yahoo", alertThreshold: 1110000 },
  { id: "sk-hynix", name: "SK 海力士", symbol: "000660.KS", sourceUrl: "https://finance.yahoo.com/quote/000660.KS", group: "korea", provider: "yahoo", alertThreshold: 11110000 },
  { id: "sk-hynix-adr", name: "SK hynix Inc. ADR", symbol: "SKHY", sourceUrl: "https://finance.yahoo.com/quote/SKHY", group: "korea", provider: "yahoo" },
  { id: "koru", name: "Direxion Daily MSCI South Korea Bull 3X ETF", symbol: "KORU", sourceUrl: "https://www.cnbc.com/quotes/KORU", group: "korea", localLabel: "NYSEARCA: KORU" },
  { id: "usd-twd", name: "美元對台幣匯率", symbol: "USDTWD=X", sourceUrl: "https://finance.yahoo.com/quote/USDTWD=X", group: "other", provider: "yahoo", alertThreshold: 37 },
  { id: "usd-jpy", name: "美元對日元匯率", symbol: "USDJPY=X", sourceUrl: "https://finance.yahoo.com/quote/USDJPY=X", group: "other", provider: "yahoo", alertThreshold: 222, bilibiliUrl: "https://search.bilibili.com/all?keyword=%E6%97%A5%E5%85%83%E8%B4%AC%E5%80%BC&from_source=websuggest_search&spm_id_from=333.1007&search_source=5&pubtime_begin_s=1782489600&pubtime_end_s=1783094399" },
  { id: "brent", name: "ICE Brent Crude", symbol: "@LCO.1", sourceUrl: "https://www.cnbc.com/quotes/@LCO.1", group: "other", alertThreshold: 222 },
  { id: "us30y", name: "U.S. 30 Year Treasury", symbol: "US.30", sourceUrl: "https://www.cnbc.com/quotes/US.30", group: "other", alertThreshold: 6.66 },
  { id: "gold", name: "Gold COMEX", symbol: "@GC.1", sourceUrl: "https://www.cnbc.com/quotes/@GC.1", group: "other", alertThreshold: 6666, imageUrl: "/finance/gold-featured.jpg" },
  { id: "dow", name: "Dow Jones Industrial Average", symbol: ".DJI", sourceUrl: "https://www.cnbc.com/quotes/.DJI", group: "us", alertThreshold: 66666, localLabel: "Roaring '20s" },
  { id: "sp500", name: "S&P 500 Index", symbol: ".SPX", sourceUrl: "https://www.cnbc.com/quotes/.SPX", group: "us", alertThreshold: 11111 },
  { id: "nasdaq", name: "NASDAQ Composite", symbol: ".IXIC", sourceUrl: "https://www.cnbc.com/quotes/.IXIC", group: "us", alertThreshold: 33333, localLabel: "科技泡沫" },
  { id: "phlx-semiconductor", name: "費城半導體指數", symbol: ".SOX", sourceUrl: "https://www.cnbc.com/quotes/.SOX", group: "us", localLabel: "半導體泡沫", bilibiliUrl: "https://search.bilibili.com/all?keyword=%E5%8D%8A%E5%B0%8E%E9%AB%94&from_source=web_search&spm_id_from=333.788&search_source=5&pubtime_begin_s=1782489600&pubtime_end_s=1783094399", imageUrl: "/finance/sox-cats.jpg" },
  { id: "soxl", name: "Direxion Daily Semiconductor Bull 3X ETF", symbol: "SOXL", sourceUrl: "https://www.cnbc.com/quotes/SOXL", group: "us", localLabel: "NYSEARCA: SOXL" },
  { id: "micron", name: "美光科技", symbol: "MU", sourceUrl: "https://www.cnbc.com/quotes/MU", group: "us", localLabel: "AI泡沫" },
  { id: "shiller-pe", name: "Shiller PE Ratio", symbol: "CAPE", sourceUrl: SHILLER_PE_URL, group: "other", provider: "multpl", alertThreshold: 45 },
  { id: "bitcoin", name: "Bitcoin/USD Coin Metrics", symbol: "BTC.CM=", sourceUrl: "https://www.cnbc.com/quotes/BTC.CM=", group: "other", alertThreshold: 111111, imageUrl: "/finance/bitcoin-cats.jpg" },
  { id: "ether", name: "Ether/USD Coin Metrics", symbol: "ETH.CM=", sourceUrl: "https://www.cnbc.com/quotes/ETH.CM=", group: "other", alertThreshold: 2222 },
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
    instrument.provider === "mis"
      ? await fetchMisInstrument(instrument)
      : instrument.provider === "yahoo"
        ? await fetchYahooInstrument(instrument)
        : instrument.provider === "multpl"
          ? await fetchMultplInstrument(instrument)
          : await fetchInstrument(instrument);

  if (options?.skipHistory || instrument.provider === "multpl") {
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
    source: "CNBC / Yahoo Finance / Multpl / TWSE MIS / TPEx",
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
