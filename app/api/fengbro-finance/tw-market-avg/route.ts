import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * 鋒兄台股指數
 * 定義：當日所有上市＋上櫃 4 碼證券收盤價加總 ÷ 股票數（等權均價指數）
 */

const TWSE_DAY_ALL_URL = "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL";
const TPEX_DAY_ALL_URL = "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes";
const TWSE_MI_INDEX_URL = "https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX";
const TPEX_HIST_URL =
  "https://www.tpex.org.tw/web/stock/aftertrading/otc_quotes_no1430/stk_wn1430_result.php";

const FETCH_HEADERS = {
  accept: "application/json,text/plain,*/*",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
};

/** Inclusive lookback windows ending at Taipei "now". */
const MONTHLY_LOOKBACK = 24; // e.g. 2024/08 … 2026/07 when now is 2026/07
const YEARLY_LOOKBACK = 24; // e.g. 2003 … 2026 when now is 2026

type DailyIndex = {
  date: string;
  index: number;
  stockCount: number;
  twseCount: number;
  tpexCount: number;
  priceSum: number;
};

type SnapshotIndex = {
  label: string;
  key: string;
  index: number | null;
  stockCount: number;
  twseCount: number;
  tpexCount: number;
  asOfDate: string | null;
  method: string;
  dayCount?: number;
};

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
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  const weekdayToken = get("weekday"); // Mon, Tue, ...
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { year, month, day, weekday: weekdayMap[weekdayToken] ?? 0 };
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

async function fetchJson(url: string) {
  const response = await fetch(url, {
    headers: FETCH_HEADERS,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function buildDailyIndex(
  dateIso: string,
  closes: Array<{ market: "twse" | "tpex"; close: number }>
): DailyIndex | null {
  if (closes.length === 0) return null;
  let sum = 0;
  let twseCount = 0;
  let tpexCount = 0;
  for (const item of closes) {
    sum += item.close;
    if (item.market === "twse") twseCount += 1;
    else tpexCount += 1;
  }
  return {
    date: dateIso,
    index: round4(sum / closes.length),
    stockCount: closes.length,
    twseCount,
    tpexCount,
    priceSum: round4(sum),
  };
}

async function fetchLatestDailyIndex(): Promise<DailyIndex | null> {
  const [twsePayload, tpexPayload] = await Promise.all([
    fetchJson(TWSE_DAY_ALL_URL),
    fetchJson(TPEX_DAY_ALL_URL),
  ]);

  const closes: Array<{ market: "twse" | "tpex"; close: number }> = [];
  if (Array.isArray(twsePayload)) {
    for (const row of twsePayload) {
      const code = String(row?.Code || "").trim();
      if (!isFourDigitCode(code)) continue;
      const close = asNumber(row?.ClosingPrice);
      if (close == null || close <= 0) continue;
      closes.push({ market: "twse", close });
    }
  }
  if (Array.isArray(tpexPayload)) {
    for (const row of tpexPayload) {
      const code = String(row?.SecuritiesCompanyCode || "").trim();
      if (!isFourDigitCode(code)) continue;
      const close = asNumber(row?.Close);
      if (close == null || close <= 0) continue;
      closes.push({ market: "tpex", close });
    }
  }

  const { year, month, day } = taipeiParts();
  return buildDailyIndex(toIso(year, month, day), closes);
}

async function fetchTwseClosesOnDate(year: number, month: number, day: number) {
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

    const closes: number[] = [];
    for (const row of table.data) {
      if (!Array.isArray(row) || row.length < 9) continue;
      const code = String(row[0] || "").trim();
      if (!isFourDigitCode(code)) continue;
      const close = asNumber(row[8]);
      if (close == null || close <= 0) continue;
      closes.push(close);
    }
    return closes.length > 100 ? closes : null;
  } catch {
    return null;
  }
}

async function fetchTpexClosesOnDate(year: number, month: number, day: number) {
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

    const closes: number[] = [];
    for (const row of table.data) {
      if (!Array.isArray(row) || row.length < 3) continue;
      const code = String(row[0] || "").trim();
      if (!isFourDigitCode(code)) continue;
      const close = asNumber(row[2]);
      if (close == null || close <= 0) continue;
      closes.push(close);
    }
    return closes.length > 100 ? closes : null;
  } catch {
    return null;
  }
}

async function fetchDailyIndexOnDate(
  year: number,
  month: number,
  day: number,
  cache: Map<string, DailyIndex | null>
): Promise<DailyIndex | null> {
  const iso = toIso(year, month, day);
  if (cache.has(iso)) return cache.get(iso) ?? null;

  // Weekends never trade.
  const probe = new Date(Date.UTC(year, month - 1, day));
  const weekday = probe.getUTCDay();
  if (weekday === 0 || weekday === 6) {
    cache.set(iso, null);
    return null;
  }

  let twse = await fetchTwseClosesOnDate(year, month, day);
  let tpex = await fetchTpexClosesOnDate(year, month, day);
  // One retry helps when TWSE/TPEx briefly rate-limit concurrent history pulls.
  if (!twse && !tpex) {
    await sleep(200);
    twse = await fetchTwseClosesOnDate(year, month, day);
    tpex = await fetchTpexClosesOnDate(year, month, day);
  }

  if (!twse && !tpex) {
    cache.set(iso, null);
    return null;
  }

  const closes: Array<{ market: "twse" | "tpex"; close: number }> = [];
  for (const close of twse || []) closes.push({ market: "twse", close });
  for (const close of tpex || []) closes.push({ market: "tpex", close });

  const daily = buildDailyIndex(iso, closes);
  cache.set(iso, daily);
  return daily;
}

/** Candidate calendar days walking backward, skipping weekends. */
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

/** Walk back until a trading day with data is found. */
async function findNearestTradingIndex(
  year: number,
  month: number,
  day: number,
  cache: Map<string, DailyIndex | null>,
  maxBack = 10
): Promise<DailyIndex | null> {
  const candidates = walkBackWeekdays(year, month, day, maxBack);
  for (const c of candidates) {
    const found = await fetchDailyIndexOnDate(c.year, c.month, c.day, cache);
    if (found) return found;
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
    twseCount: last.twseCount,
    tpexCount: last.tpexCount,
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

/** Shift a year/month by delta months (negative = look back). */
function shiftMonth(year: number, month: number, delta: number) {
  const zeroBased = year * 12 + (month - 1) + delta;
  const y = Math.floor(zeroBased / 12);
  const m = (zeroBased % 12) + 1;
  return { year: y, month: m };
}

function listWeekTradingDays(today: { year: number; month: number; day: number; weekday: number }) {
  // Monday = 1 ... Sunday = 0. Offset back to Monday.
  const offsetToMonday = today.weekday === 0 ? 6 : today.weekday - 1;
  const monday = addDays(today.year, today.month, today.day, -offsetToMonday);
  const days: Array<{ year: number; month: number; day: number }> = [];
  for (let i = 0; i < 7; i += 1) {
    const d = addDays(monday.year, monday.month, monday.day, i);
    // Only up to today
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

export async function GET() {
  try {
    const cache = new Map<string, DailyIndex | null>();
    const todayParts = taipeiParts();

    // 1) Latest index (prefer openapi latest full board)
    const latest = await fetchLatestDailyIndex();
    if (latest) {
      cache.set(latest.date, latest);
    }

    // If openapi date is calendar today but market not closed yet / holiday empty, walk back.
    let todayIndex = latest;
    if (!todayIndex || todayIndex.stockCount < 200) {
      todayIndex = await findNearestTradingIndex(
        todayParts.year,
        todayParts.month,
        todayParts.day,
        cache
      );
    }

    if (!todayIndex) {
      return NextResponse.json({ error: "無法計算鋒兄台股指數（無收盤行情）" }, { status: 502 });
    }

    // 2) This week: average of daily indices Mon → latest trading day this week
    const weekDays = listWeekTradingDays(todayParts);
    const weekDaily = (
      await mapPool(weekDays, 3, async (d) => {
        // Reuse cache / latest for today
        if (toIso(d.year, d.month, d.day) === todayIndex!.date) return todayIndex;
        return fetchDailyIndexOnDate(d.year, d.month, d.day, cache);
      })
    ).filter((d): d is DailyIndex => d != null);

    const weekSnapshot = averageDailyIndices(weekDaily.length ? weekDaily : [todayIndex]);

    // 3) This month: average of daily indices month-to-date (Mon–Fri so far)
    const monthDays = listMonthTradingDaysSoFar(todayParts);
    // Cap to avoid timeout: if many days, sample evenly including first & last.
    const monthDaySample =
      monthDays.length <= 14
        ? monthDays
        : (() => {
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
          })();

    const monthDaily = (
      await mapPool(monthDaySample, 3, async (d) => {
        if (toIso(d.year, d.month, d.day) === todayIndex!.date) return todayIndex;
        return fetchDailyIndexOnDate(d.year, d.month, d.day, cache);
      })
    ).filter((d): d is DailyIndex => d != null);

    const monthSnapshot = averageDailyIndices(monthDaily.length ? monthDaily : [todayIndex]);

    // 4) Monthly series: last MONTHLY_LOOKBACK months through current Taipei month (auto-extends)
    //    Returned newest-first so current month sits on top.
    const monthlyEnd = { year: todayParts.year, month: todayParts.month };
    const monthlyStart = shiftMonth(monthlyEnd.year, monthlyEnd.month, -(MONTHLY_LOOKBACK - 1));
    const monthKeys = listMonthKeys(monthlyStart, monthlyEnd);
    const monthlySeriesRaw = await mapPool(monthKeys, 2, async ({ year, month, key }) => {
      const endDay = daysInMonth(year, month);
      const targetDay =
        year === todayParts.year && month === todayParts.month ? todayParts.day : endDay;

      const found = await findNearestTradingIndex(year, month, targetDay, cache, 14);
      return {
        key,
        label: `${year}/${pad2(month)}`,
        year,
        month,
        index: found?.index ?? null,
        stockCount: found?.stockCount ?? 0,
        twseCount: found?.twseCount ?? 0,
        tpexCount: found?.tpexCount ?? 0,
        asOfDate: found?.date ?? null,
      };
    });
    const monthlySeries = [...monthlySeriesRaw].reverse();

    // 5) Yearly series: last YEARLY_LOOKBACK years through current Taipei year (auto-extends)
    //    Returned newest-first so current year sits on top.
    const yearlyEnd = todayParts.year;
    const yearlyStart = yearlyEnd - (YEARLY_LOOKBACK - 1);
    const yearlySeriesRaw = await mapPool(
      Array.from({ length: YEARLY_LOOKBACK }, (_, i) => yearlyStart + i),
      2,
      async (year) => {
        const target =
          year === todayParts.year
            ? { year: todayParts.year, month: todayParts.month, day: todayParts.day }
            : { year, month: 12, day: 31 };

        const found = await findNearestTradingIndex(target.year, target.month, target.day, cache, 14);
        return {
          key: String(year),
          label: String(year),
          year,
          index: found?.index ?? null,
          stockCount: found?.stockCount ?? 0,
          twseCount: found?.twseCount ?? 0,
          tpexCount: found?.tpexCount ?? 0,
          asOfDate: found?.date ?? null,
        };
      }
    );
    const yearlySeries = [...yearlySeriesRaw].reverse();

    const snapshots: SnapshotIndex[] = [
      {
        label: "今天指數",
        key: "today",
        index: todayIndex.index,
        stockCount: todayIndex.stockCount,
        twseCount: todayIndex.twseCount,
        tpexCount: todayIndex.tpexCount,
        asOfDate: todayIndex.date,
        method: "latest-close-average",
        dayCount: 1,
      },
      {
        label: "本周指數",
        key: "week",
        index: weekSnapshot?.index ?? todayIndex.index,
        stockCount: weekSnapshot?.stockCount ?? todayIndex.stockCount,
        twseCount: weekSnapshot?.twseCount ?? todayIndex.twseCount,
        tpexCount: weekSnapshot?.tpexCount ?? todayIndex.tpexCount,
        asOfDate: weekSnapshot?.asOfDate ?? todayIndex.date,
        method: "week-to-date-daily-average",
        dayCount: weekSnapshot?.dayCount ?? 1,
      },
      {
        label: "本月指數",
        key: "month",
        index: monthSnapshot?.index ?? todayIndex.index,
        stockCount: monthSnapshot?.stockCount ?? todayIndex.stockCount,
        twseCount: monthSnapshot?.twseCount ?? todayIndex.twseCount,
        tpexCount: monthSnapshot?.tpexCount ?? todayIndex.tpexCount,
        asOfDate: monthSnapshot?.asOfDate ?? todayIndex.date,
        method: "month-to-date-daily-average",
        dayCount: monthSnapshot?.dayCount ?? 1,
      },
    ];

    return NextResponse.json({
      fetchedAt: new Date().toISOString(),
      name: "鋒兄台股指數",
      formula: "所有上市上櫃 4 碼證券收盤價加總 ÷ 股票數",
      source: "TWSE OpenAPI / TPEx OpenAPI / TWSE MI_INDEX / TPEx daily close",
      note:
        "鋒兄台股指數 = 當日全部上市＋上櫃 4 碼證券（含 ETF）收盤價的等權平均。今天＝最新交易日；本周＝本周一至最新交易日每日指數平均；本月＝本月迄今交易日每日指數平均（樣本較多時均勻抽樣）；每月＝最近 24 個月各月最後交易日指數（新到舊，隨台北時間滾動）；每年＝最近 24 年各年最後交易日指數（新到舊，隨台北時間滾動；當年為最新交易日）。",
      today: snapshots[0],
      week: snapshots[1],
      month: snapshots[2],
      snapshots,
      monthly: monthlySeries,
      yearly: yearlySeries,
      ranges: {
        monthlyStart: `${monthlyStart.year}${pad2(monthlyStart.month)}`,
        monthlyEnd: `${monthlyEnd.year}${pad2(monthlyEnd.month)}`,
        monthlyLookback: MONTHLY_LOOKBACK,
        yearlyStart,
        yearlyEnd,
        yearlyLookback: YEARLY_LOOKBACK,
      },
      universe: {
        asOfDate: todayIndex.date,
        stockCount: todayIndex.stockCount,
        twseCount: todayIndex.twseCount,
        tpexCount: todayIndex.tpexCount,
        priceSum: todayIndex.priceSum,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "鋒兄台股指數計算失敗",
      },
      { status: 500 }
    );
  }
}
