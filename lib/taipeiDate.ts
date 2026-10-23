/**
 * 台北時區的日期字串工具。
 *
 * 全站只要出現「今天幾號」的判斷，一律走這裡，不要各自用 `new Date().toISOString()`：
 * UTC 的 00:00 在台北是當天早上 8 點，跨日邊界很容易差一天。
 */

/** 台北時區的 YYYY-MM-DD。 */
export function taipeiDateKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** YYYY-MM-DD → YYYYMMDD（檔名、文件 id 用）。 */
export function dateStampFromKey(key: string): string {
  return String(key || "").replace(/-/g, "");
}

/** 日期字串轉成「UTC 天數」，只拿來相減，不涉及本地時區。 */
function keyToUtcDay(key: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ""));
  if (!match) return null;
  const time = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(time) ? null : Math.round(time / 86_400_000);
}

function utcDayToKey(day: number): string {
  return new Date(day * 86_400_000).toISOString().slice(0, 10);
}

/** `to` 減 `from` 的日曆天數；任一格格式不對就回 null。 */
export function daysBetweenDateKeys(from: string, to: string): number | null {
  const start = keyToUtcDay(from);
  const end = keyToUtcDay(to);
  if (start == null || end == null) return null;
  return end - start;
}

export function addDaysToDateKey(key: string, days: number): string | null {
  const day = keyToUtcDay(key);
  if (day == null) return null;
  return utcDayToKey(day + days);
}
