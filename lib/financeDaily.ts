/**
 * 指數每日記錄：每天把「當天的 52 週高／低」存一筆，隔天就能判斷有沒有破。
 *
 * 為什麼不看「現價有沒有碰到 52W High」就好？因為那只有在打開頁面的那一刻才成立：
 * 盤中創高後拉回，現價就低於 52W High，徽章消失，事後完全看不出今天創過高。
 * 改成比對「今天的 52W High vs 昨天記錄的 52W High」，只要今天真的創高，
 * 這個數字就會被推上去，之後拉回也不會消失。
 */

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
