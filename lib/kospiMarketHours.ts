/** KOSPI regular session: Mon–Fri 09:00–15:30 Asia/Seoul (KST). */

const KOSPI_TZ = "Asia/Seoul";
const WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export type KospiMarketClock = {
  weekday: number;
  hour: number;
  minute: number;
  /** Minutes since midnight in Seoul. */
  minutesOfDay: number;
  isWeekday: boolean;
  isOpen: boolean;
};

function parseSeoulParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: KOSPI_TZ,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const weekdayLabel = get("weekday");
  const weekday = WEEKDAY_TO_INDEX[weekdayLabel] ?? -1;
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));

  return {
    weekday,
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
  };
}

/** Open window: 09:00 inclusive through 15:30 inclusive (last print at close). */
export function getKospiMarketClock(date: Date = new Date()): KospiMarketClock {
  const { weekday, hour, minute } = parseSeoulParts(date);
  const minutesOfDay = hour * 60 + minute;
  const isWeekday = weekday >= 1 && weekday <= 5;
  const open = 9 * 60;
  const close = 15 * 60 + 30;
  const isOpen = isWeekday && minutesOfDay >= open && minutesOfDay <= close;

  return { weekday, hour, minute, minutesOfDay, isWeekday, isOpen };
}

export function isKospiMarketOpen(date: Date = new Date()) {
  return getKospiMarketClock(date).isOpen;
}

export const KOSPI_LIVE_POLL_MS = 60_000;
