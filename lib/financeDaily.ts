/**
 * 指數每日記錄：每天把「當天的 52 週高／低」存一筆，隔天就能判斷有沒有破。
 *
 * 為什麼不看「現價有沒有碰到 52W High」就好？因為那只有在打開頁面的那一刻才成立：
 * 盤中創高後拉回，現價就低於 52W High，徽章消失，事後完全看不出今天創過高。
 * 改成比對「今天的 52W High vs 昨天記錄的 52W High」，只要今天真的創高，
 * 這個數字就會被推上去，之後拉回也不會消失。
 */

import { addDaysToDateKey } from "./taipeiDate";

export type FinanceDailyItem = {
  id: string;
  name: string;
  price: number | null;
  high52: number | null;
  low52: number | null;
};

export type FinanceDailySnapshot = {
  dateKey: string;
  items: FinanceDailyItem[];
};

export type FinanceDailyComparison = {
  /** 拿來比對的那一天（通常就是昨天）。 */
  previousDateKey: string;
  previousHigh52: number | null;
  previousLow52: number | null;
  /** 今天的 52W High 比上次高 → 今天創新高。 */
  newHigh: boolean;
  /** 今天的 52W Low 比上次低 → 今天創新低。 */
  newLow: boolean;
};

/** 只記指數：名稱含「指數」或 Index（費城半導體指數、KOSPI Index、Nikkei 225 Index…）。 */
export function isIndexName(name: string | null | undefined): boolean {
  return /指數|index/i.test(String(name || ""));
}

function toNumberOrNull(value: unknown): number | null {
  const num = typeof value === "string" ? Number(value) : value;
  return typeof num === "number" && Number.isFinite(num) ? num : null;
}

/** 把 API 回傳的報價收斂成要存進每日記錄的欄位。 */
export function toDailyItem(quote: {
  id?: unknown;
  name?: unknown;
  displayName?: unknown;
  price?: unknown;
  high52?: unknown;
  low52?: unknown;
}): FinanceDailyItem | null {
  const id = String(quote?.id || "").trim();
  if (!id) return null;
  const high52 = toNumberOrNull(quote.high52);
  const low52 = toNumberOrNull(quote.low52);
  if (high52 == null && low52 == null) return null;
  return {
    id,
    name: String(quote.displayName || quote.name || id).trim(),
    price: toNumberOrNull(quote.price),
    high52,
    low52,
  };
}

/** 從一份快照挑出某一檔的資料。 */
export function findSnapshotItem(
  snapshot: FinanceDailySnapshot | null | undefined,
  id: string
): FinanceDailyItem | null {
  if (!snapshot?.items?.length) return null;
  return snapshot.items.find((item) => item.id === id) || null;
}

/**
 * 兩天之間的比較。任一邊缺值就不判斷，避免把「資料抓不到」誤標成創新低。
 *
 * 用相對容差（1e-6）而不是嚴格大於：52 週高低是浮點數，同一數值重新抓取
 * 可能出現 6160.050000001 這種尾差，不該被當成創新低。
 */
export function compareDailyItems(
  previous: FinanceDailyItem | null | undefined,
  current: FinanceDailyItem | null | undefined,
  previousDateKey: string
): FinanceDailyComparison | null {
  if (!previous || !current) return null;

  const newHigh =
    current.high52 != null &&
    previous.high52 != null &&
    current.high52 - previous.high52 > Math.abs(previous.high52) * 1e-6;

  const newLow =
    current.low52 != null &&
    previous.low52 != null &&
    previous.low52 - current.low52 > Math.abs(previous.low52) * 1e-6;

  return {
    previousDateKey,
    previousHigh52: previous.high52,
    previousLow52: previous.low52,
    newHigh,
    newLow,
  };
}

/** 一次算好整批，key 是標的 id，給畫面直接查表。 */
export function buildDailyComparisons(
  previous: FinanceDailySnapshot | null | undefined,
  currentItems: FinanceDailyItem[]
): Record<string, FinanceDailyComparison> {
  const result: Record<string, FinanceDailyComparison> = {};
  if (!previous?.items?.length) return result;
  for (const item of currentItems) {
    const comparison = compareDailyItems(findSnapshotItem(previous, item.id), item, previous.dateKey);
    if (comparison) result[item.id] = comparison;
  }
  return result;
}

/* ── 波段（26 週）高低 ─────────────────────────────────────────────
 *
 * 52W 高低是 API 給的（含盤中價），但沒有 26 週版本。這裡用卡片上那條
 * 「最近一年走勢」的週線資料自己算：取最近 26 週的週收盤最高／最低。
 *
 * 注意這是**週收盤**基準，不是盤中最低，所以數值會比真實的 26 週盤中低點高一些；
 * 徽章文字寫「創波段新低 26W」，語意就是「跌破近半年的週收盤區間」。
 *
 * **最後一根 K 一定要排除**：Yahoo 的週線會帶「本週還沒收盤」那一根，它的收盤價
 * 就等於現價。把它算進來，波段低點就被現價自己定義了 —— KOSPI 5,505.21 對上
 * 同一根 K 的 5,505.20996（浮點誤差），`price <= low` 永遠不成立，徽章一個都亮不了。
 */

export const BAND_WEEKS = 26;

export type FinanceBandRange = {
  high: number | null;
  low: number | null;
  /** 實際納入計算的週數，資料不足時會小於 BAND_WEEKS。 */
  weeks: number;
};

export type FinanceBandTag = "band-high" | "band-low" | null;

/** 從週線資料取最近 26 週（不含本週那根還沒收盤的 K）的最高／最低週收盤。 */
export function bandRangeFromHistory(
  points: Array<{ date: string; price: number | null }> | null | undefined,
  weeks: number = BAND_WEEKS
): FinanceBandRange {
  const empty = { high: null, low: null, weeks: 0 };
  if (!Array.isArray(points) || points.length === 0) return empty;

  const sorted = [...points]
    .filter((point): point is { date: string; price: number } =>
      Boolean(point) && typeof point.price === "number" && Number.isFinite(point.price)
    )
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (sorted.length === 0) return empty;

  // 只有一根時沒得排除，直接用它。
  const completed = sorted.length > 1 ? sorted.slice(0, -1) : sorted;
  const latestDate = String(completed[completed.length - 1].date);
  const cutoff = addDaysToDateKey(latestDate, -weeks * 7);
  const window = cutoff ? completed.filter((point) => String(point.date) >= cutoff) : completed;
  if (window.length === 0) return empty;

  let high: number | null = null;
  let low: number | null = null;
  for (const point of window) {
    if (high == null || point.price > high) high = point.price;
    if (low == null || point.price < low) low = point.price;
  }
  return { high, low, weeks: window.length };
}

/**
 * 波段徽章。已經破了 52 週高低就不重複標 —— 52W 是更強的說法，
 * 兩個一起亮只會讓人以為是兩件事。
 *
 * 容差 0.05%：現價是券商給的兩位小數，週收盤是浮點數，差幾厘不該讓徽章消失。
 */
export const BAND_TOLERANCE_RATIO = 0.0005;

export function getBandTag(
  price: number | null | undefined,
  band: FinanceBandRange,
  tag52: "new-high" | "new-low" | null
): FinanceBandTag {
  if (typeof price !== "number" || !Number.isFinite(price)) return null;
  if (tag52 === "new-high" || tag52 === "new-low") return null;
  if (band.high != null && price >= band.high * (1 - BAND_TOLERANCE_RATIO)) return "band-high";
  if (band.low != null && price <= band.low * (1 + BAND_TOLERANCE_RATIO)) return "band-low";
  return null;
}
