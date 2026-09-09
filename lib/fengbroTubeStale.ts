/**
 * 鋒兄Tube 停更提示。
 *
 * 頻道最新一部影片超過三個月（預設 90 天）就視為停更，
 * 在畫面上主動提示使用者，避免清單裡一直留著早就不更新的頻道。
 */

export const FENGBRO_TUBE_STALE_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

type StaleInputVideo = {
  publishedAt?: string | null;
  updatedAt?: string | null;
};

type StaleInputChannel = {
  sourceUrl: string;
  title?: string;
  videos?: StaleInputVideo[] | null;
};

export type FengbroTubeStaleChannel = {
  sourceUrl: string;
  title: string;
  latestPublishedAt: string;
  staleDays: number;
};

function toTime(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return NaN;
  return new Date(value).getTime();
}

/** 影片時間以 publishedAt 為主，缺少時退回 updatedAt（與 API 端一致）。 */
function videoTimestamp(video: StaleInputVideo | null | undefined): string {
  const published = video?.publishedAt;
  if (typeof published === "string" && published.trim()) return published;
  const updated = video?.updatedAt;
  return typeof updated === "string" && updated.trim() ? updated : "";
}

/** 頻道最新影片的發布時間；沒有可用日期時回傳空字串。 */
export function getFengbroTubeLatestPublishedAt(channel: StaleInputChannel): string {
  let latestTime = NaN;
  let latestValue = "";

  for (const video of channel.videos || []) {
    const value = videoTimestamp(video);
    const time = toTime(value);
    if (!Number.isFinite(time)) continue;
    if (!Number.isFinite(latestTime) || time > latestTime) {
      latestTime = time;
      latestValue = value;
    }
  }

  return latestValue;
}

/**
 * 距離最新影片的天數；無法判斷（沒有影片或日期解析失敗）時回傳 null。
 * 未來時間視為 0 天，不會誤報停更。
 */
export function getFengbroTubeStaleDays(channel: StaleInputChannel, now: number = Date.now()): number | null {
  const latestTime = toTime(getFengbroTubeLatestPublishedAt(channel));
  if (!Number.isFinite(latestTime)) return null;
  return Math.max(0, Math.floor((now - latestTime) / DAY_MS));
}

/** 超過門檻天數沒有新影片的頻道，停更最久的排最前面。 */
export function getStaleFengbroTubeChannels(
  channels: StaleInputChannel[],
  now: number = Date.now(),
  thresholdDays: number = FENGBRO_TUBE_STALE_DAYS,
): FengbroTubeStaleChannel[] {
  const stale: FengbroTubeStaleChannel[] = [];

  for (const channel of channels || []) {
    if (!channel?.sourceUrl) continue;
    const staleDays = getFengbroTubeStaleDays(channel, now);
    if (staleDays == null || staleDays <= thresholdDays) continue;
    stale.push({
      sourceUrl: channel.sourceUrl,
      title: channel.title?.trim() || channel.sourceUrl,
      latestPublishedAt: getFengbroTubeLatestPublishedAt(channel),
      staleDays,
    });
  }

  return stale.sort((a, b) => b.staleDays - a.staleDays);
}

/** 把停更天數轉成中文長度標籤，例如「4 個月」「1 年 2 個月」。 */
export function formatFengbroTubeStaleDuration(staleDays: number): string {
  const days = Math.max(0, Math.floor(staleDays));
  const years = Math.floor(days / 365);
  const months = Math.floor((days - years * 365) / 30);
  if (years > 0) return months > 0 ? `${years} 年 ${months} 個月` : `${years} 年`;
  return `${Math.max(1, months)} 個月`;
}
