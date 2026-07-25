/**
 * YouTube / Bilibili URL helpers.
 * Adapted from huang1988pioneer/YoutubeBilibiliMP4MP3Converter.
 */

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);

const BILIBILI_HOST_RE = /(^|\.)bilibili\.com$/i;
const B23_HOST_RE = /(^|\.)b23\.tv$/i;

export type MediaPlatform = "youtube" | "bilibili" | "unknown";

export function detectPlatform(url: string): MediaPlatform {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.toLowerCase();
    if (YOUTUBE_HOSTS.has(host) || host.endsWith(".youtube.com")) return "youtube";
    if (BILIBILI_HOST_RE.test(host) || B23_HOST_RE.test(host)) return "bilibili";
    return "unknown";
  } catch {
    return "unknown";
  }
}

export function isAllowedMediaUrl(url: string): boolean {
  return detectPlatform(url) !== "unknown";
}

const BILI_TRACKING_KEYS = new Set([
  "spm_id_from",
  "from_spmid",
  "vd_source",
  "share_source",
  "share_medium",
  "share_plat",
  "share_session_id",
  "unique_k",
]);

/** Strip Bilibili tracking query params; leave YouTube as-is. */
export function normalizeMediaUrl(url: string): string {
  const trimmed = url.trim();
  let uri: URL;
  try {
    uri = new URL(trimmed);
  } catch {
    return trimmed;
  }

  if (!BILIBILI_HOST_RE.test(uri.hostname) && !B23_HOST_RE.test(uri.hostname)) {
    return uri.toString();
  }

  const kept: string[] = [];
  uri.searchParams.forEach((value, key) => {
    if (!BILI_TRACKING_KEYS.has(key)) {
      kept.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  });
  uri.search = kept.length ? `?${kept.join("&")}` : "";
  return uri.toString();
}

export function validateAndNormalizeUrls(raw: string[]): {
  urls: string[];
  errors: string[];
} {
  const errors: string[] = [];
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const item of raw) {
    const trimmed = (item || "").trim();
    if (!trimmed) continue;
    if (!isAllowedMediaUrl(trimmed)) {
      errors.push(`不支援的網址（僅 YouTube / Bilibili）：${trimmed}`);
      continue;
    }
    const normalized = normalizeMediaUrl(trimmed);
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    urls.push(normalized);
  }

  return { urls, errors };
}
