import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * 鋒兄台股上市指數、鋒兄台股上櫃指數（兩支獨立指數，沒有合併的「鋒兄台股指數」）
 * - 鋒兄台股上市指數：當日全部上市 4 碼「公司股」市值加權均價
 * - 鋒兄台股上櫃指數：當日全部上櫃 4 碼「公司股」市值加權均價
 * - 市值 = 收盤價 × 已發行普通股數；指數 = Σ(收盤價 × 市值) / Σ市值
 * - 僅納入有發行股數之公司（不含 ETF 等無公司股數資料之證券，避免與成分股雙重計算）
 *
 * 台股收盤後同一台北日只完整計算一次，後續請求直接回傳當日快取。
 */

const TWSE_DAY_ALL_URL = "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL";
const TPEX_DAY_ALL_URL = "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes";
const TWSE_BASIC_URL = "https://openapi.twse.com.tw/v1/opendata/t187ap03_L";
const TPEX_BASIC_URL = "https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap03_O";
const TWSE_MI_INDEX_URL = "https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX";
const TPEX_HIST_URL =
  "https://www.tpex.org.tw/web/stock/aftertrading/otc_quotes_no1430/stk_wn1430_result.php";

const FETCH_HEADERS = {
  accept: "application/json,text/plain,*/*",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
};

/** Inclusive lookback windows ending at Taipei "now". */
const MONTHLY_LOOKBACK = 24;
const YEARLY_LOOKBACK = 24;

/** TWSE/TPEx regular session ends 13:30 Asia/Taipei. */
const TW_MARKET_CLOSE_MINUTES = 13 * 60 + 30;

/** Minimum sample sizes for a usable board close. */
const TWSE_MIN_STOCKS = 100;
const TPEX_MIN_STOCKS = 50;

type MarketKey = "twse" | "tpex";

/** One board constituent with close and shares for market-cap weighting. */
type QuoteLeg = {
  close: number;
  shares: number;
};

type DailyIndex = {
  date: string;
  market: MarketKey;
  /** 市值加權均價 = Σ(P × MC) / ΣMC */
  index: number;
  stockCount: number;
  /** 未加權收盤價加總（參考用） */
  priceSum: number;
  /** 總市值（元）= Σ(收盤價 × 已發行股數) */
  marketCapSum: number;
};

type ShareMaps = {
  twse: Map<string, number>;
  tpex: Map<string, number>;
};

/** Both markets for one calendar / trading day (one history fetch pair). */
type DayPair = {
  date: string;
  twse: DailyIndex | null;
  tpex: DailyIndex | null;
};

type SnapshotIndex = {
  label: string;
  key: string;
  index: number | null;
  stockCount: number;
  asOfDate: string | null;
  method: string;
  dayCount?: number;
};

type SeriesPoint = {
  key: string;
  label: string;
  year?: number;
  month?: number;
  index: number | null;
  stockCount: number;
  asOfDate: string | null;
};

type MarketBoard = {
  market: MarketKey;
  name: string;
  formula: string;
  note: string;
  today: SnapshotIndex;
  week: SnapshotIndex;
  month: SnapshotIndex;
  snapshots: SnapshotIndex[];
  monthly: SeriesPoint[];
  yearly: SeriesPoint[];
  universe: {
    asOfDate: string;
    stockCount: number;
    priceSum: number;
    marketCapSum: number;
  };
};

type TwIndexPayload = {
  fetchedAt: string;
  name: string;
  formula: string;
  source: string;
  note: string;
  asOfDate: string;
  ranges: {
    monthlyStart: string;
    monthlyEnd: string;
    monthlyLookback: number;
    yearlyStart: number;
    yearlyEnd: number;
    yearlyLookback: number;
  };
  twse: MarketBoard;
  tpex: MarketBoard;
  boards: MarketBoard[];
  cached?: boolean;
  cacheNote?: string;
};

const MARKET_META: Record<
  MarketKey,
  { name: string; formula: string; note: string; minStocks: number }
> = {
  twse: {
    name: "鋒兄台股上市指數",
    formula: "Σ(收盤價 × 市值) ÷ Σ市值；市值 = 收盤價 × 已發行股數",
    note: "鋒兄台股上市指數 = 當日全部上市（TWSE）4 碼公司股的市值加權均價（僅納入有已發行股數之公司，不含 ETF）。",
    minStocks: TWSE_MIN_STOCKS,
  },
  tpex: {
    name: "鋒兄台股上櫃指數",
    formula: "Σ(收盤價 × 市值) ÷ Σ市值；市值 = 收盤價 × 已發行股數",
    note: "鋒兄台股上櫃指數 = 當日全部上櫃（TPEx）4 碼公司股的市值加權均價（僅納入有已發行股數之公司，不含 ETF）。",
    minStocks: TPEX_MIN_STOCKS,
  },
};

/** Bump when index methodology changes so in-process day cache is not reused across formulas. */
const INDEX_METHOD_VERSION = "mcap-v1";

/** Process-level day cache: after close, same Taipei calendar day reuses one full compute. */
let dayResultCache: {
  methodVersion: string;
  taipeiDay: string;
  asOfDate: string;
  payload: TwIndexPayload;
  computedAtMs: number;
} | null = null;

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[$,%\s,+]/g, "").trim();
  if (!cleaned || cleaned === "--" || cleaned.toUpperCase() === "N/A" || cleaned === "X") return null;
  if (cleaned.includes("除")) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function isFourDigitCode(code: string) {
  return /^\d{4}$/.test(code);
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toYmd(year: number, month: number, day: number) {
  return `${year}${pad2(month)}${pad2(day)}`;
}

function toIso(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function toRoc(year: number, month: number, day: number) {
  return `${year - 1911}/${pad2(month)}/${pad2(day)}`;
}

/** Wall-clock parts in Asia/Taipei. */
function taipeiParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  const weekdayToken = get("weekday");
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const weekday = weekdayMap[weekdayToken] ?? 0;
  const minutesOfDay = (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0);
  const isWeekday = weekday >= 1 && weekday <= 5;
  const isAfterClose = !isWeekday || minutesOfDay > TW_MARKET_CLOSE_MINUTES;
  return {
    year,
    month,
    day,
    weekday,
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
    minutesOfDay,
    isWeekday,
    isAfterClose,
    dayKey: toIso(year, month, day),
  };
}

function shouldServeDayCache(
  cache: typeof dayResultCache,
  force: boolean,
  now = taipeiParts()
): boolean {
  if (force || !cache) return false;
  if (cache.methodVersion !== INDEX_METHOD_VERSION) return false;
  return now.isAfterClose && cache.taipeiDay === now.dayKey;
}

function addDays(year: number, month: number, day: number, delta: number) {
  const utc = new Date(Date.UTC(year, month - 1, day + delta));
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() };
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function round4(value: number) {
  return Math.round(value * 10000) / 10000;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Bound upstream TWSE/TPEx latency so the route always finishes with JSON (not a hung/truncated body). */
const UPSTREAM_FETCH_MS = 12_000;

async function fetchJson(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_FETCH_MS);
  try {
    const response = await fetch(url, {
      headers: FETCH_HEADERS,
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function buildMarketDailyIndex(
  dateIso: string,
  market: MarketKey,
  legs: QuoteLeg[]
): DailyIndex | null {
  if (legs.length === 0) return null;
  let priceSum = 0;
  let marketCapSum = 0;
  let weighted = 0;
  let n = 0;
  for (const { close, shares } of legs) {
    if (!(close > 0) || !(shares > 0)) continue;
    const marketCap = close * shares;
    priceSum += close;
    marketCapSum += marketCap;
    weighted += close * marketCap;
    n += 1;
  }
  if (n === 0 || marketCapSum <= 0) return null;
  return {
    date: dateIso,
    market,
    index: round4(weighted / marketCapSum),
    stockCount: n,
    priceSum: round4(priceSum),
    marketCapSum: round4(marketCapSum),
  };
}

function buildDayPair(dateIso: string, twseLegs: QuoteLeg[], tpexLegs: QuoteLeg[]): DayPair {
  return {
    date: dateIso,
    twse: buildMarketDailyIndex(dateIso, "twse", twseLegs),
    tpex: buildMarketDailyIndex(dateIso, "tpex", tpexLegs),
  };
}

async function loadShareMaps(): Promise<ShareMaps> {
  const [twseResult, tpexResult] = await Promise.allSettled([
    fetchJson(TWSE_BASIC_URL),
    fetchJson(TPEX_BASIC_URL),
  ]);

  const twse = new Map<string, number>();
  const twsePayload = twseResult.status === "fulfilled" ? twseResult.value : null;
  if (Array.isArray(twsePayload)) {
    for (const row of twsePayload) {
      const code = String(row?.["公司代號"] || "").trim();
      if (!isFourDigitCode(code)) continue;
      const shares = asNumber(row?.["已發行普通股數或TDR原股發行股數"]);
      if (shares == null || shares <= 0) continue;
      twse.set(code, shares);
    }
  }

  const tpex = new Map<string, number>();
  const tpexPayload = tpexResult.status === "fulfilled" ? tpexResult.value : null;
  if (Array.isArray(tpexPayload)) {
    for (const row of tpexPayload) {
      const code = String(row?.SecuritiesCompanyCode || "").trim();
      if (!isFourDigitCode(code)) continue;
      const shares = asNumber(row?.IssueShares);
      if (shares == null || shares <= 0) continue;
      tpex.set(code, shares);
    }
  }

  return { twse, tpex };
}

function dayPairIsUsable(pair: DayPair | null): boolean {
  if (!pair) return false;
  const twseOk = (pair.twse?.stockCount ?? 0) >= TWSE_MIN_STOCKS;
  const tpexOk = (pair.tpex?.stockCount ?? 0) >= TPEX_MIN_STOCKS;
  return twseOk || tpexOk;
}

function marketFromPair(pair: DayPair | null, market: MarketKey): DailyIndex | null {
  if (!pair) return null;
  const daily = pair[market];
  if (!daily) return null;
  if (daily.stockCount < MARKET_META[market].minStocks) return null;
  return daily;
}

async function fetchLatestDayPair(shareMaps: ShareMaps): Promise<DayPair | null> {
  const [twseResult, tpexResult] = await Promise.allSettled([
    fetchJson(TWSE_DAY_ALL_URL),
    fetchJson(TPEX_DAY_ALL_URL),
  ]);
  const twsePayload = twseResult.status === "fulfilled" ? twseResult.value : null;
  const tpexPayload = tpexResult.status === "fulfilled" ? tpexResult.value : null;

  const twseLegs: QuoteLeg[] = [];
  const tpexLegs: QuoteLeg[] = [];

  if (Array.isArray(twsePayload)) {
    for (const row of twsePayload) {
      const code = String(row?.Code || "").trim();
      if (!isFourDigitCode(code)) continue;
      const shares = shareMaps.twse.get(code);
      if (shares == null || shares <= 0) continue;
      const close = asNumber(row?.ClosingPrice);
      if (close == null || close <= 0) continue;
      twseLegs.push({ close, shares });
    }
  }
  if (Array.isArray(tpexPayload)) {
    for (const row of tpexPayload) {
      const code = String(row?.SecuritiesCompanyCode || "").trim();
      if (!isFourDigitCode(code)) continue;
      const shares = shareMaps.tpex.get(code);
      if (shares == null || shares <= 0) continue;
      const close = asNumber(row?.Close);
      if (close == null || close <= 0) continue;
      tpexLegs.push({ close, shares });
    }
  }

  const { year, month, day } = taipeiParts();
  const pair = buildDayPair(toIso(year, month, day), twseLegs, tpexLegs);
  return dayPairIsUsable(pair) ? pair : null;
}

async function fetchTwseLegsOnDate(
  year: number,
  month: number,
  day: number,
  shareMaps: ShareMaps
): Promise<QuoteLeg[] | null> {
  const params = new URLSearchParams({
    response: "json",
    date: toYmd(year, month, day),
    type: "ALLBUT0999",
  });
  try {
    const payload = await fetchJson(`${TWSE_MI_INDEX_URL}?${params.toString()}`);
    if (payload?.stat !== "OK" || !Array.isArray(payload.tables)) return null;
    const table = payload.tables.find(
      (item: { data?: unknown[] }) => Array.isArray(item?.data) && item.data.length > 500
    );
    if (!table || !Array.isArray(table.data)) return null;

    const legs: QuoteLeg[] = [];
    for (const row of table.data) {
      if (!Array.isArray(row) || row.length < 9) continue;
      const code = String(row[0] || "").trim();
      if (!isFourDigitCode(code)) continue;
      const shares = shareMaps.twse.get(code);
      if (shares == null || shares <= 0) continue;
      const close = asNumber(row[8]);
      if (close == null || close <= 0) continue;
      legs.push({ close, shares });
    }
    return legs.length > 100 ? legs : null;
  } catch {
    return null;
  }
}

async function fetchTpexLegsOnDate(
  year: number,
  month: number,
  day: number,
  shareMaps: ShareMaps
): Promise<QuoteLeg[] | null> {
  const params = new URLSearchParams({
    l: "zh-tw",
    d: toRoc(year, month, day),
    se: "EW",
    o: "json",
  });
  try {
    const payload = await fetchJson(`${TPEX_HIST_URL}?${params.toString()}`);
    const table = Array.isArray(payload?.tables) ? payload.tables[0] : null;
    if (!table || !Array.isArray(table.data)) return null;

    const legs: QuoteLeg[] = [];
    for (const row of table.data) {
      if (!Array.isArray(row) || row.length < 3) continue;
      const code = String(row[0] || "").trim();
      if (!isFourDigitCode(code)) continue;
      if (!shareMaps.tpex.has(code)) continue;
      const close = asNumber(row[2]);
      if (close == null || close <= 0) continue;
      // Historical 發行股數 at column 14 when present; else company basic map.
      const histShares = row.length > 14 ? asNumber(row[14]) : null;
      const shares = histShares != null && histShares > 0 ? histShares : shareMaps.tpex.get(code);
      if (shares == null || shares <= 0) continue;
      legs.push({ close, shares });
    }
    return legs.length > 100 ? legs : null;
  } catch {
    return null;
  }
}

async function fetchDayPairOnDate(
  year: number,
  month: number,
  day: number,
  cache: Map<string, DayPair | null>,
  shareMaps: ShareMaps
): Promise<DayPair | null> {
  const iso = toIso(year, month, day);
  if (cache.has(iso)) return cache.get(iso) ?? null;

  const probe = new Date(Date.UTC(year, month - 1, day));
  const weekday = probe.getUTCDay();
  if (weekday === 0 || weekday === 6) {
    cache.set(iso, null);
    return null;
  }

  let twse = await fetchTwseLegsOnDate(year, month, day, shareMaps);
  let tpex = await fetchTpexLegsOnDate(year, month, day, shareMaps);
  if (!twse && !tpex) {
    await sleep(200);
    twse = await fetchTwseLegsOnDate(year, month, day, shareMaps);
    tpex = await fetchTpexLegsOnDate(year, month, day, shareMaps);
  }

  if (!twse && !tpex) {
    cache.set(iso, null);
    return null;
  }

  const pair = buildDayPair(iso, twse || [], tpex || []);
  const usable = dayPairIsUsable(pair) ? pair : null;
  cache.set(iso, usable);
  return usable;
}

function walkBackWeekdays(year: number, month: number, day: number, maxBack = 12) {
  const days: Array<{ year: number; month: number; day: number }> = [];
  let y = year;
  let m = month;
  let d = day;
  for (let i = 0; i < maxBack * 2 && days.length < maxBack; i += 1) {
    const probe = new Date(Date.UTC(y, m - 1, d));
    const wd = probe.getUTCDay();
    if (wd !== 0 && wd !== 6) days.push({ year: y, month: m, day: d });
    const prev = addDays(y, m, d, -1);
    y = prev.year;
    m = prev.month;
    d = prev.day;
  }
  return days;
}

async function findNearestDayPair(
  year: number,
  month: number,
  day: number,
  cache: Map<string, DayPair | null>,
  shareMaps: ShareMaps,
  maxBack = 10
): Promise<DayPair | null> {
  const candidates = walkBackWeekdays(year, month, day, maxBack);
  for (const c of candidates) {
    const found = await fetchDayPairOnDate(c.year, c.month, c.day, cache, shareMaps);
    if (found) return found;
    await sleep(40);
  }
  return null;
}

/** Prefer a day where the specific market has enough samples. */
async function findNearestMarketIndex(
  year: number,
  month: number,
  day: number,
  market: MarketKey,
  cache: Map<string, DayPair | null>,
  shareMaps: ShareMaps,
  maxBack = 14
): Promise<DailyIndex | null> {
  const candidates = walkBackWeekdays(year, month, day, maxBack);
  for (const c of candidates) {
    const pair = await fetchDayPairOnDate(c.year, c.month, c.day, cache, shareMaps);
    const daily = marketFromPair(pair, market);
    if (daily) return daily;
    await sleep(40);
  }
  return null;
}

async function mapPool<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index]);
    }
  }

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, () => run());
  await Promise.all(runners);
  return results;
}

function averageDailyIndices(days: DailyIndex[]): SnapshotIndex | null {
  if (days.length === 0) return null;
  const index = round4(days.reduce((sum, d) => sum + d.index, 0) / days.length);
  const last = days[days.length - 1];
  return {
    label: "",
    key: "",
    index,
    stockCount: last.stockCount,
    asOfDate: last.date,
    method: "period-average",
    dayCount: days.length,
  };
}

function listMonthKeys(start: { year: number; month: number }, end: { year: number; month: number }) {
  const keys: Array<{ year: number; month: number; key: string }> = [];
  let y = start.year;
  let m = start.month;
  while (y < end.year || (y === end.year && m <= end.month)) {
    keys.push({ year: y, month: m, key: `${y}${pad2(m)}` });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return keys;
}

function shiftMonth(year: number, month: number, delta: number) {
  const zeroBased = year * 12 + (month - 1) + delta;
  const y = Math.floor(zeroBased / 12);
  const m = (zeroBased % 12) + 1;
  return { year: y, month: m };
}

function listWeekTradingDays(today: { year: number; month: number; day: number; weekday: number }) {
  const offsetToMonday = today.weekday === 0 ? 6 : today.weekday - 1;
  const monday = addDays(today.year, today.month, today.day, -offsetToMonday);
  const days: Array<{ year: number; month: number; day: number }> = [];
  for (let i = 0; i < 7; i += 1) {
    const d = addDays(monday.year, monday.month, monday.day, i);
    const afterToday =
      d.year > today.year ||
      (d.year === today.year && d.month > today.month) ||
      (d.year === today.year && d.month === today.month && d.day > today.day);
    if (afterToday) break;
    const probe = new Date(Date.UTC(d.year, d.month - 1, d.day));
    if (probe.getUTCDay() === 0 || probe.getUTCDay() === 6) continue;
    days.push(d);
  }
  return days;
}

function listMonthTradingDaysSoFar(today: { year: number; month: number; day: number }) {
  const days: Array<{ year: number; month: number; day: number }> = [];
  for (let d = 1; d <= today.day; d += 1) {
    const probe = new Date(Date.UTC(today.year, today.month - 1, d));
    const wd = probe.getUTCDay();
    if (wd === 0 || wd === 6) continue;
    days.push({ year: today.year, month: today.month, day: d });
  }
  return days;
}

function sampleMonthDays(monthDays: Array<{ year: number; month: number; day: number }>) {
  if (monthDays.length <= 14) return monthDays;
  const picked = new Map<string, { year: number; month: number; day: number }>();
  const first = monthDays[0];
  const last = monthDays[monthDays.length - 1];
  picked.set(toIso(first.year, first.month, first.day), first);
  picked.set(toIso(last.year, last.month, last.day), last);
  const step = Math.ceil(monthDays.length / 12);
  for (let i = 0; i < monthDays.length; i += step) {
    const item = monthDays[i];
    picked.set(toIso(item.year, item.month, item.day), item);
  }
  return Array.from(picked.values()).sort((a, b) =>
    toIso(a.year, a.month, a.day).localeCompare(toIso(b.year, b.month, b.day))
  );
}

function emptySnapshot(label: string, key: string, method: string): SnapshotIndex {
  return {
    label,
    key,
    index: null,
    stockCount: 0,
    asOfDate: null,
    method,
    dayCount: 0,
  };
}

async function buildMarketBoard(
  market: MarketKey,
  todayIndex: DailyIndex | null,
  todayParts: ReturnType<typeof taipeiParts>,
  pairCache: Map<string, DayPair | null>,
  shareMaps: ShareMaps,
  weekDays: Array<{ year: number; month: number; day: number }>,
  monthDaySample: Array<{ year: number; month: number; day: number }>,
  monthKeys: Array<{ year: number; month: number; key: string }>,
  yearlyYears: number[]
): Promise<MarketBoard> {
  const meta = MARKET_META[market];

  const weekDaily = (
    await mapPool(weekDays, 3, async (d) => {
      if (todayIndex && toIso(d.year, d.month, d.day) === todayIndex.date) return todayIndex;
      const pair = await fetchDayPairOnDate(d.year, d.month, d.day, pairCache, shareMaps);
      return marketFromPair(pair, market);
    })
  ).filter((d): d is DailyIndex => d != null);

  const weekSnapshot = averageDailyIndices(weekDaily.length ? weekDaily : todayIndex ? [todayIndex] : []);

  const monthDaily = (
    await mapPool(monthDaySample, 3, async (d) => {
      if (todayIndex && toIso(d.year, d.month, d.day) === todayIndex.date) return todayIndex;
      const pair = await fetchDayPairOnDate(d.year, d.month, d.day, pairCache, shareMaps);
      return marketFromPair(pair, market);
    })
  ).filter((d): d is DailyIndex => d != null);

  const monthSnapshot = averageDailyIndices(monthDaily.length ? monthDaily : todayIndex ? [todayIndex] : []);

  const monthlySeriesRaw = await mapPool(monthKeys, 2, async ({ year, month, key }) => {
    const endDay = daysInMonth(year, month);
    const targetDay = year === todayParts.year && month === todayParts.month ? todayParts.day : endDay;
    const found = await findNearestMarketIndex(year, month, targetDay, market, pairCache, shareMaps, 14);
    return {
      key,
      label: `${year}/${pad2(month)}`,
      year,
      month,
      index: found?.index ?? null,
      stockCount: found?.stockCount ?? 0,
      asOfDate: found?.date ?? null,
    };
  });
  const monthly = [...monthlySeriesRaw].reverse();

  const yearlySeriesRaw = await mapPool(yearlyYears, 2, async (year) => {
    const target =
      year === todayParts.year
        ? { year: todayParts.year, month: todayParts.month, day: todayParts.day }
        : { year, month: 12, day: 31 };
    const found = await findNearestMarketIndex(
      target.year,
      target.month,
      target.day,
      market,
      pairCache,
      shareMaps,
      14
    );
    return {
      key: String(year),
      label: String(year),
      year,
      index: found?.index ?? null,
      stockCount: found?.stockCount ?? 0,
      asOfDate: found?.date ?? null,
    };
  });
  const yearly = [...yearlySeriesRaw].reverse();

  const todaySnap: SnapshotIndex = todayIndex
    ? {
        label: "今天指數",
        key: "today",
        index: todayIndex.index,
        stockCount: todayIndex.stockCount,
        asOfDate: todayIndex.date,
        method: "latest-market-cap-weighted",
        dayCount: 1,
      }
    : emptySnapshot("今天指數", "today", "latest-market-cap-weighted");

  const weekSnap: SnapshotIndex = weekSnapshot
    ? {
        label: "本周指數",
        key: "week",
        index: weekSnapshot.index,
        stockCount: weekSnapshot.stockCount,
        asOfDate: weekSnapshot.asOfDate,
        method: "week-to-date-daily-average",
        dayCount: weekSnapshot.dayCount ?? 1,
      }
    : emptySnapshot("本周指數", "week", "week-to-date-daily-average");

  const monthSnap: SnapshotIndex = monthSnapshot
    ? {
        label: "本月指數",
        key: "month",
        index: monthSnapshot.index,
        stockCount: monthSnapshot.stockCount,
        asOfDate: monthSnapshot.asOfDate,
        method: "month-to-date-daily-average",
        dayCount: monthSnapshot.dayCount ?? 1,
      }
    : emptySnapshot("本月指數", "month", "month-to-date-daily-average");

  return {
    market,
    name: meta.name,
    formula: meta.formula,
    note: `${meta.note}今天＝最新交易日；本周＝本周一至最新交易日每日指數平均；本月＝本月迄今交易日每日指數平均（樣本較多時均勻抽樣）；每月＝最近 ${MONTHLY_LOOKBACK} 個月各月最後交易日；每年＝最近 ${YEARLY_LOOKBACK} 年各年最後交易日。`,
    today: todaySnap,
    week: weekSnap,
    month: monthSnap,
    snapshots: [todaySnap, weekSnap, monthSnap],
    monthly,
    yearly,
    universe: {
      asOfDate: todayIndex?.date ?? "",
      stockCount: todayIndex?.stockCount ?? 0,
      priceSum: todayIndex?.priceSum ?? 0,
      marketCapSum: todayIndex?.marketCapSum ?? 0,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const force =
      request.nextUrl.searchParams.get("refresh") === "1" ||
      request.nextUrl.searchParams.get("force") === "1";
    const todayParts = taipeiParts();

    const existingDayCache = dayResultCache;
    if (existingDayCache && shouldServeDayCache(existingDayCache, force, todayParts)) {
      return NextResponse.json({
        ...existingDayCache.payload,
        cached: true,
        cacheNote: `收盤後同一日不重複計算（基準 ${existingDayCache.asOfDate}，首次計算時間 ${new Date(existingDayCache.computedAtMs).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}）`,
      });
    }

    const pairCache = new Map<string, DayPair | null>();
    const shareMaps = await loadShareMaps();
    if (shareMaps.twse.size < TWSE_MIN_STOCKS && shareMaps.tpex.size < TPEX_MIN_STOCKS) {
      return NextResponse.json(
        { error: "無法計算鋒兄台股上市／上櫃指數（無法取得已發行股數）" },
        { status: 502 }
      );
    }

    // 1) Latest boards (prefer openapi full board + company share maps)
    const latest = await fetchLatestDayPair(shareMaps);
    if (latest) {
      pairCache.set(latest.date, latest);
    }

    let todayPair = latest;
    if (!dayPairIsUsable(todayPair)) {
      todayPair = await findNearestDayPair(
        todayParts.year,
        todayParts.month,
        todayParts.day,
        pairCache,
        shareMaps
      );
    }

    if (!dayPairIsUsable(todayPair) || !todayPair) {
      return NextResponse.json({ error: "無法計算鋒兄台股上市／上櫃指數（無收盤行情）" }, { status: 502 });
    }

    const asOfDate = todayPair.twse?.date || todayPair.tpex?.date || todayPair.date;

    // 收盤後且已有相同基準日完整結果：略過重算。
    if (
      !force &&
      todayParts.isAfterClose &&
      existingDayCache &&
      existingDayCache.methodVersion === INDEX_METHOD_VERSION &&
      existingDayCache.asOfDate === asOfDate &&
      ((existingDayCache.payload.twse?.universe?.stockCount ?? 0) >= TWSE_MIN_STOCKS ||
        (existingDayCache.payload.tpex?.universe?.stockCount ?? 0) >= TPEX_MIN_STOCKS)
    ) {
      const reused = {
        ...existingDayCache,
        methodVersion: INDEX_METHOD_VERSION,
        taipeiDay: todayParts.dayKey,
      };
      dayResultCache = reused;
      return NextResponse.json({
        ...reused.payload,
        cached: true,
        cacheNote: `收盤後基準日 ${asOfDate} 已計算過，略過重複計算`,
      });
    }

    const weekDays = listWeekTradingDays(todayParts);
    const monthDaySample = sampleMonthDays(listMonthTradingDaysSoFar(todayParts));

    const monthlyEnd = { year: todayParts.year, month: todayParts.month };
    const monthlyStart = shiftMonth(monthlyEnd.year, monthlyEnd.month, -(MONTHLY_LOOKBACK - 1));
    const monthKeys = listMonthKeys(monthlyStart, monthlyEnd);

    const yearlyEnd = todayParts.year;
    const yearlyStart = yearlyEnd - (YEARLY_LOOKBACK - 1);
    const yearlyYears = Array.from({ length: YEARLY_LOOKBACK }, (_, i) => yearlyStart + i);

    // Sequential boards: second market reuses pairCache from the first (same calendar days).
    const twseBoard = await buildMarketBoard(
      "twse",
      marketFromPair(todayPair, "twse"),
      todayParts,
      pairCache,
      shareMaps,
      weekDays,
      monthDaySample,
      monthKeys,
      yearlyYears
    );
    const tpexBoard = await buildMarketBoard(
      "tpex",
      marketFromPair(todayPair, "tpex"),
      todayParts,
      pairCache,
      shareMaps,
      weekDays,
      monthDaySample,
      monthKeys,
      yearlyYears
    );

    if (
      twseBoard.universe.stockCount < TWSE_MIN_STOCKS &&
      tpexBoard.universe.stockCount < TPEX_MIN_STOCKS
    ) {
      return NextResponse.json({ error: "無法計算鋒兄台股上市／上櫃指數（樣本不足）" }, { status: 502 });
    }

    const payload: TwIndexPayload = {
      fetchedAt: new Date().toISOString(),
      name: "鋒兄台股上市／上櫃指數",
      formula: "上市／上櫃各自：Σ(收盤價 × 市值) ÷ Σ市值；市值 = 收盤價 × 已發行股數",
      source:
        "TWSE OpenAPI (STOCK_DAY_ALL / t187ap03_L) / TPEx OpenAPI / TWSE MI_INDEX / TPEx daily close",
      note:
        "僅有鋒兄台股上市指數與鋒兄台股上櫃指數兩支，沒有合併的「鋒兄台股指數」。兩者分開計算，皆為市值加權均價（僅納入有已發行股數之 4 碼公司股，不含 ETF）。今天＝最新交易日；本周／本月為期間每日指數平均；每月／每年為期末交易日指數（新到舊，隨台北時間滾動）。收盤後同一台北日只完整計算一次。",
      asOfDate,
      ranges: {
        monthlyStart: `${monthlyStart.year}${pad2(monthlyStart.month)}`,
        monthlyEnd: `${monthlyEnd.year}${pad2(monthlyEnd.month)}`,
        monthlyLookback: MONTHLY_LOOKBACK,
        yearlyStart,
        yearlyEnd,
        yearlyLookback: YEARLY_LOOKBACK,
      },
      twse: twseBoard,
      tpex: tpexBoard,
      boards: [twseBoard, tpexBoard],
      cached: false,
    };

    if (
      todayParts.isAfterClose &&
      (twseBoard.universe.stockCount >= TWSE_MIN_STOCKS ||
        tpexBoard.universe.stockCount >= TPEX_MIN_STOCKS)
    ) {
      dayResultCache = {
        methodVersion: INDEX_METHOD_VERSION,
        taipeiDay: todayParts.dayKey,
        asOfDate,
        payload,
        computedAtMs: Date.now(),
      };
    }

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "鋒兄台股上市／上櫃指數計算失敗",
      },
      { status: 500 }
    );
  }
}
