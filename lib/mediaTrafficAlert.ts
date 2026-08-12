import type { MediaTrafficLedger } from "@/lib/mediaTraffic";

export const MEDIA_TRAFFIC_ALERT_STORAGE_KEY = "fengbro:media-traffic-alert:v1";
export const GIBIBYTE = 1024 ** 3;

export type MediaTrafficAlertPolicy = {
  thresholdGiB: number;
  dailyLimit: number | null;
};

type MediaTrafficAlertRecord = {
  day: string;
  displays: number;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function taipeiCalendarDay(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getMediaTrafficAlertPolicy(totalBytes: number): MediaTrafficAlertPolicy | null {
  if (!Number.isFinite(totalBytes) || totalBytes <= 2.5 * GIBIBYTE) return null;
  if (totalBytes > 4.5 * GIBIBYTE) return { thresholdGiB: 4.5, dailyLimit: null };
  if (totalBytes > 4 * GIBIBYTE) return { thresholdGiB: 4, dailyLimit: 3 };
  if (totalBytes > 3.5 * GIBIBYTE) return { thresholdGiB: 3.5, dailyLimit: 2 };
  return { thresholdGiB: 2.5, dailyLimit: 1 };
}

function readRecord(storage: StorageLike, day: string): MediaTrafficAlertRecord {
  try {
    const value = JSON.parse(storage.getItem(MEDIA_TRAFFIC_ALERT_STORAGE_KEY) || "null") as Partial<MediaTrafficAlertRecord> | null;
    const displays = value?.displays;
    if (value?.day === day && typeof displays === "number" && Number.isInteger(displays) && displays >= 0) {
      return { day, displays };
    }
  } catch {
    // A corrupt local value should behave like a new day of reminders.
  }
  return { day, displays: 0 };
}

/**
 * Reserves one homepage reminder slot for the current Taiwan calendar day.
 * Returns the policy that should be displayed, or null when today's quota is used.
 */
export function claimMediaTrafficHomepageAlert(
  totalBytes: number,
  storage: StorageLike,
  now = new Date(),
): MediaTrafficAlertPolicy | null {
  const policy = getMediaTrafficAlertPolicy(totalBytes);
  if (!policy) return null;

  const day = taipeiCalendarDay(now);
  const record = readRecord(storage, day);
  if (policy.dailyLimit !== null && record.displays >= policy.dailyLimit) return null;

  try {
    storage.setItem(MEDIA_TRAFFIC_ALERT_STORAGE_KEY, JSON.stringify({ day, displays: record.displays + 1 }));
  } catch {
    // When storage is unavailable, still show the current homepage reminder.
  }
  return policy;
}

export function formatMediaTrafficGiB(totalBytes: number) {
  return (Math.max(0, totalBytes) / GIBIBYTE).toFixed(2);
}

export function mediaTrafficTotal(ledger: Pick<MediaTrafficLedger, "total">) {
  return ledger.total;
}
