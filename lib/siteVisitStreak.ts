import { daysUntil, getTaipeiDateKey } from "@/lib/notifications/daysUntil";

export { getTaipeiDateKey };

function asStreak(value: number | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Normalize a YYYY-MM-DD key or ISO timestamp to a Taipei calendar date. */
export function toVisitDateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return getTaipeiDateKey(parsed);
}

export function resolveLastVisitDate(
  lastVisitDate?: string | null,
  lastVisitAt?: string | null
): string | null {
  return toVisitDateKey(lastVisitDate) || toVisitDateKey(lastVisitAt);
}

/**
 * Advance the consecutive-day streak when a new browser session is recorded.
 * Same Taipei calendar day keeps the streak; yesterday increments; any gap resets to 1.
 */
export function nextSiteVisitStreak(input: {
  lastVisitDate?: string | null;
  lastVisitAt?: string | null;
  currentStreak?: number | null;
  now?: Date;
}): { today: string; lastVisitDate: string | null; currentStreak: number } {
  const now = input.now ?? new Date();
  const today = getTaipeiDateKey(now);
  const lastVisitDate = resolveLastVisitDate(input.lastVisitDate, input.lastVisitAt);
  const stored = asStreak(input.currentStreak);

  if (!lastVisitDate) {
    return { today, lastVisitDate: null, currentStreak: 1 };
  }

  const delta = daysUntil(lastVisitDate, { now });
  if (delta === 0) {
    return { today, lastVisitDate, currentStreak: Math.max(stored, 1) };
  }
  if (delta === -1) {
    return { today, lastVisitDate, currentStreak: Math.max(stored, 1) + 1 };
  }
  return { today, lastVisitDate, currentStreak: 1 };
}

/**
 * Streak shown on the About page: still alive if last visit was today or yesterday,
 * otherwise 0 until the next visit starts a new run.
 */
export function displaySiteVisitStreak(input: {
  lastVisitDate?: string | null;
  lastVisitAt?: string | null;
  currentStreak?: number | null;
  now?: Date;
}): number {
  const now = input.now ?? new Date();
  const lastVisitDate = resolveLastVisitDate(input.lastVisitDate, input.lastVisitAt);
  if (!lastVisitDate) return 0;
  const delta = daysUntil(lastVisitDate, { now });
  if (delta === 0 || delta === -1) return Math.max(asStreak(input.currentStreak), 1);
  return 0;
}
