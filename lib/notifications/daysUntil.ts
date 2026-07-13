import { NOTIFICATION_POLICY } from "./policy";

const DEFAULT_TIME_ZONE = NOTIFICATION_POLICY.timezone;

/**
 * Calendar date key (YYYY-MM-DD) in the given IANA timezone.
 * Defaults to Asia/Taipei so server cron and email stay aligned.
 */
export function getDateKeyInTimeZone(
  date: Date = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Alias used by Resend and other Taipei-specific call sites. */
export function getTaipeiDateKey(date: Date = new Date()): string {
  return getDateKeyInTimeZone(date, DEFAULT_TIME_ZONE);
}

function dateKeyToUtcMs(dateKey: string): number | null {
  const [year, month, day] = String(dateKey).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  return Date.UTC(year, month - 1, day);
}

/**
 * Whole-day delta from "today" (in timeZone) to the target date string.
 * Returns null when the date is missing/invalid.
 */
export function daysUntil(
  dateStr: string | null | undefined,
  options?: { timeZone?: string; now?: Date }
): number | null {
  if (!dateStr) return null;
  const timeZone = options?.timeZone ?? DEFAULT_TIME_ZONE;
  const now = options?.now ?? new Date();
  const targetMs = dateKeyToUtcMs(String(dateStr).slice(0, 10));
  const todayMs = dateKeyToUtcMs(getDateKeyInTimeZone(now, timeZone));
  if (targetMs == null || todayMs == null) return null;
  return Math.round((targetMs - todayMs) / (1000 * 60 * 60 * 24));
}
