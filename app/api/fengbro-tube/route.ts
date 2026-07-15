import { NextResponse } from "next/server";
import {
  DEFAULT_FENGBRO_TUBE_CHANNELS,
  type FengbroTubeChannelConfig,
  getFengbroTubeAlias,
  isBrokenFengbroTubeTitle,
  normalizeFengbroTubeChannels,
} from "@/lib/fengbroTubeChannels";

export const dynamic = "force-dynamic";

const YOUTUBE_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "zh-TW,zh;q=0.9,en;q=0.8",
  "cache-control": "no-cache",
};

/** YouTube Atom RSS has been returning 404; keep as last-resort only. */
const YOUTUBE_FETCH_INIT: RequestInit = {
  headers: YOUTUBE_HEADERS,
  cache: "no-store",
};

type TubeVideoEntry = {
  videoId: string;
  title: string;
  url: string;
  publishedAt: string;
  updatedAt: string;
  thumbnail: string;
};

const BILIBILI_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  accept: "application/json,text/plain,*/*",
  referer: "https://space.bilibili.com/",
  origin: "https://www.bilibili.com",
};

function decodeHtml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function pick(text: string, pattern: RegExp) {
  return decodeHtml(pattern.exec(text)?.[1] || "");
}

function normalizeChannelUrl(sourceUrl: string) {
  return sourceUrl.replace(/\/videos\/?$/i, "").replace(/\/$/, "");
}

function fallbackNameFromUrl(sourceUrl: string) {
  try {
    const path = decodeURIComponent(new URL(sourceUrl).pathname);
    return path.replace(/^\/@?/, "").replace(/\/videos\/?$/i, "") || sourceUrl;
  } catch {
    return sourceUrl;
  }
}

function normalizeBilibiliImageUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "";
  return value.trim().replace(/^\/\//, "https://").replace(/^http:\/\//, "https://");
}

function toProxiedImageUrl(value: unknown) {
  const imageUrl = normalizeBilibiliImageUrl(value);
  return imageUrl ? `/api/media-proxy?url=${encodeURIComponent(imageUrl)}` : "";
}

function isBilibiliSource(sourceUrl: string) {
  try {
    const hostname = new URL(sourceUrl).hostname;
    return /bilibili\.com$/i.test(hostname) || /\.bilibili\.com$/i.test(hostname);
  } catch {
    return false;
  }
}

function getBilibiliMid(sourceUrl: string) {
  try {
    return new URL(sourceUrl).pathname.match(/^\/(\d+)/)?.[1] || "";
  } catch {
    return "";
  }
}

function isBrokenYouTubeTitle(title: string) {
  return isBrokenFengbroTubeTitle(title);
}

function getChannelTitle(channel: FengbroTubeChannelConfig, title: string) {
  const defaultAlias = getFengbroTubeAlias(channel.sourceUrl);
  const cleanedTitle = isBrokenYouTubeTitle(title) ? "" : title.trim();
  const cleanedAlias =
    channel.alias && !isBrokenYouTubeTitle(channel.alias) ? channel.alias.trim() : "";
  if (cleanedAlias && cleanedAlias !== defaultAlias) return cleanedAlias;
  if (defaultAlias) return defaultAlias;
  if (cleanedAlias) return cleanedAlias;
  if (cleanedTitle) return cleanedTitle;
  return fallbackNameFromUrl(channel.sourceUrl);
}

function walkJson(node: unknown, visitor: (value: Record<string, unknown>) => void) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) walkJson(item, visitor);
    return;
  }
  const record = node as Record<string, unknown>;
  visitor(record);
  for (const value of Object.values(record)) walkJson(value, visitor);
}

function textFromYouTubeField(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  if (typeof record.simpleText === "string") return record.simpleText;
  if (typeof record.content === "string") return record.content;
  if (Array.isArray(record.runs)) {
    return record.runs
      .map((run) => (run && typeof run === "object" && typeof (run as { text?: unknown }).text === "string" ? (run as { text: string }).text : ""))
      .join("");
  }
  return "";
}

function parseRelativePublishedAt(value: string, now = Date.now()) {
  const text = value.trim().toLowerCase();
  if (!text) return "";
  if (/剛剛|刚刚|just now|moments? ago/.test(text)) return new Date(now).toISOString();

  const match =
    text.match(/(\d+)\s*(秒|second|seconds|分鐘|分钟|minute|minutes|小時|小时|hour|hours|天|day|days|週|周|week|weeks|個月|个月|month|months|年|year|years)\s*(前|ago)?/) ||
    text.match(/(\d+)\s*(seconds?|minutes?|hours?|days?|weeks?|months?|years?)\s*ago/);
  if (!match) return "";

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount < 0) return "";
  const unit = match[2];
  const msByUnit: Record<string, number> = {
    秒: 1000,
    second: 1000,
    seconds: 1000,
    分鐘: 60 * 1000,
    分钟: 60 * 1000,
    minute: 60 * 1000,
    minutes: 60 * 1000,
    小時: 60 * 60 * 1000,
    小时: 60 * 60 * 1000,
    hour: 60 * 60 * 1000,
    hours: 60 * 60 * 1000,
    天: 24 * 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
    週: 7 * 24 * 60 * 60 * 1000,
    周: 7 * 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    weeks: 7 * 24 * 60 * 60 * 1000,
    個月: 30 * 24 * 60 * 60 * 1000,
    个月: 30 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    months: 30 * 24 * 60 * 60 * 1000,
    年: 365 * 24 * 60 * 60 * 1000,
    year: 365 * 24 * 60 * 60 * 1000,
    years: 365 * 24 * 60 * 60 * 1000,
  };
  const unitMs = msByUnit[unit];
  if (!unitMs) return "";
  return new Date(now - amount * unitMs).toISOString();
}

function normalizeDigits(value: string) {
  return value.replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0));
}

function extractDownfallIndex(title: string) {
  const normalizedTitle = normalizeDigits(title);
  const numberPattern = "([0-9]+(?:\\.[0-9]+)?)";
  const formatIndex = (value: string) => Number(value).toFixed(2);
  const movementUnits = "飆至|飙至|升至|漲至|涨至|達到|达到|衝到|冲到|升到|達|达|突破|破|到|至";
  const isPlausibleIndex = (raw: string, nextText = "") => {
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 1 || value > 100) return false;
    // avoid "6月" / "2026年" false positives
    if (/^[月日號号年]/.test(nextText)) return false;
    if (value >= 40) return true;
    return raw.includes(".");
  };

  // e.g. 倒台指數6月飆至70.58 / 「倒台指數」11月飆至68.28 / 衝到69.39
  const movementNearLabel = normalizedTitle.match(
    new RegExp(`倒台指[數数][」』"']?.{0,40}?(?:${movementUnits})\\s*${numberPattern}`)
  );
  if (movementNearLabel?.[1]) {
    const full = movementNearLabel[0];
    const num = movementNearLabel[1];
    const nextText = full.slice(full.lastIndexOf(num) + num.length);
    if (isPlausibleIndex(num, nextText)) return formatIndex(num);
  }

  // e.g. 解讀「中共倒台指數」67
  const indexAfterLabel = normalizedTitle.match(
    new RegExp(`倒台指[數数][」』"']?\\s*${numberPattern}(?![月日號号年])`)
  );
  if (indexAfterLabel?.[1] && isPlausibleIndex(indexAfterLabel[1])) {
    return formatIndex(indexAfterLabel[1]);
  }

  const labelMatch = /倒台指[數数]/.exec(normalizedTitle);
  if (labelMatch) {
    const afterLabelText = normalizedTitle.slice(
      labelMatch.index + labelMatch[0].length,
      labelMatch.index + labelMatch[0].length + 80
    );
    const movementValue = afterLabelText.match(new RegExp(`(?:${movementUnits})\\s*${numberPattern}`));
    if (movementValue?.[1] && isPlausibleIndex(movementValue[1])) return formatIndex(movementValue[1]);

    const afterLabelNumbers = [...afterLabelText.matchAll(new RegExp(numberPattern, "g"))];
    const firstNonDateNumber = afterLabelNumbers.find((match) => {
      const nextText = afterLabelText.slice((match.index || 0) + match[0].length).trimStart();
      return isPlausibleIndex(match[1], nextText);
    });
    if (firstNonDateNumber?.[1]) return formatIndex(firstNonDateNumber[1]);
  }
  const beforeLabel = normalizedTitle.match(new RegExp(`${numberPattern}\\s*(?:分|%|％)?\\s*倒台指[數数]`));
  if (beforeLabel?.[1] && isPlausibleIndex(beforeLabel[1])) return formatIndex(beforeLabel[1]);
  return "";
}

function isHenrenChannel(sourceUrl: string, title: string) {
  return /henren778/i.test(sourceUrl) || /一[個个]狠人/.test(title);
}

/** Thumbnail-only values (number not present in title) with verified air dates. */
const KNOWN_DOWNFALL_INDEX_BY_VIDEO_ID: Record<string, { value: string; publishedAt: string }> = {
  // 本月「倒台指數」再度上行… thumbnail 67.44 · first Saturday of Oct 2025
  sticRfV28VM: { value: "67.44", publishedAt: "2025-10-04T00:00:00.000Z" },
};

function resolveDownfallIndexForVideo(video: TubeVideoEntry) {
  const fromTitle = extractDownfallIndex(video.title);
  if (fromTitle) {
    return {
      value: fromTitle,
      publishedAt: video.publishedAt || video.updatedAt || "",
    };
  }
  const known = KNOWN_DOWNFALL_INDEX_BY_VIDEO_ID[video.videoId];
  if (!known) return null;
  return {
    value: known.value,
    publishedAt: video.publishedAt || video.updatedAt || known.publishedAt,
  };
}

function getVideosPageUrl(sourceUrl: string) {
  const channelUrl = normalizeChannelUrl(sourceUrl);
  return /\/videos$/i.test(sourceUrl) ? sourceUrl.replace(/\/$/, "") : `${channelUrl}/videos`;
}

function resolveChannelMetaFromHtml(sourceUrl: string, html: string) {
  const channelId =
    pick(html, /"externalId"\s*:\s*"(UC[\w-]+)"/) ||
    pick(html, /<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]+)"/) ||
    pick(html, /property="og:url" content="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]+)"/) ||
    pick(html, /"channelId"\s*:\s*"(UC[\w-]+)"/) ||
    pick(html, /youtube\.com\/channel\/(UC[\w-]+)/);

  const rawTitle =
    pick(html, /<meta property="og:title" content="([^"]+)"/) ||
    pick(html, /<title>(.*?)<\/title>/) ||
    fallbackNameFromUrl(sourceUrl);
  const title = isBrokenYouTubeTitle(rawTitle)
    ? fallbackNameFromUrl(sourceUrl)
    : rawTitle.replace(/ - YouTube$/i, "");

  return { channelId, title };
}

async function resolveChannelPage(sourceUrl: string) {
  const videosPageUrl = getVideosPageUrl(sourceUrl);
  const response = await fetch(videosPageUrl, YOUTUBE_FETCH_INIT);
  const html = await response.text();
  const { channelId, title } = resolveChannelMetaFromHtml(sourceUrl, html);

  if (!channelId) {
    throw new Error("找不到 YouTube channel id");
  }
  if (!response.ok && isBrokenYouTubeTitle(title)) {
    throw new Error(`YouTube 頻道讀取失敗 (${response.status})`);
  }

  return { channelId, title, html, videosPageUrl };
}

function extractJsonObjectAfterMarker(html: string, marker: string): unknown | null {
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return null;

  const equalsIndex = html.indexOf("=", markerIndex + marker.length);
  if (equalsIndex < 0) return null;

  let start = equalsIndex + 1;
  while (start < html.length && /\s/.test(html[start])) start += 1;
  if (html[start] !== "{") return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < html.length; index += 1) {
    const char = html[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") {
      depth += 1;
      continue;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, index + 1));
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

function extractYtInitialData(html: string): unknown | null {
  const regexMatch = html.match(/ytInitialData\s*=\s*(\{[\s\S]*?\})\s*;\s*(?:<\/script>|var\s+|window)/);
  if (regexMatch) {
    try {
      return JSON.parse(regexMatch[1]);
    } catch {
      // fall through to bracket parser
    }
  }
  return extractJsonObjectAfterMarker(html, "ytInitialData");
}

function extractInnertubeClientConfig(html: string) {
  return {
    apiKey: pick(html, /"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/),
    clientVersion:
      pick(html, /"INNERTUBE_CLIENT_VERSION"\s*:\s*"([^"]+)"/) || "2.20260714.01.00",
    clientName: pick(html, /"INNERTUBE_CLIENT_NAME"\s*:\s*"([^"]+)"/) || "WEB",
  };
}

function parseFeed(xml: string) {
  if (!xml.includes("<entry>") && !xml.includes("<feed")) {
    return { feedTitle: "", entries: [] as TubeVideoEntry[] };
  }

  const feedTitle = pick(xml, /<title>(.*?)<\/title>/);
  if (isBrokenYouTubeTitle(feedTitle)) {
    return { feedTitle: "", entries: [] as TubeVideoEntry[] };
  }

  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((match) => {
    const entry = match[1];
    const videoId = pick(entry, /<yt:videoId>(.*?)<\/yt:videoId>/);
    const title = pick(entry, /<title>(.*?)<\/title>/);
    const url = pick(entry, /<link[^>]+href="([^"]+)"/) || `https://www.youtube.com/watch?v=${videoId}`;
    const publishedAt = pick(entry, /<published>(.*?)<\/published>/);
    const updatedAt = pick(entry, /<updated>(.*?)<\/updated>/);
    const thumbnail =
      pick(entry, /<media:thumbnail[^>]+url="([^"]+)"/) ||
      (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : "");

    return {
      videoId,
      title,
      url,
      publishedAt,
      updatedAt,
      thumbnail,
    };
  }).filter((entry) => entry.videoId && entry.title && !entry.url.includes("/shorts/"));

  return { feedTitle, entries };
}

function parseVideosFromYouTubeData(data: unknown): TubeVideoEntry[] {
  if (!data) return [];

  const lockups: Record<string, unknown>[] = [];
  const renderers: Record<string, unknown>[] = [];
  walkJson(data, (node) => {
    if (node.lockupViewModel && typeof node.lockupViewModel === "object") {
      lockups.push(node.lockupViewModel as Record<string, unknown>);
    }
    if (node.videoRenderer && typeof node.videoRenderer === "object") {
      renderers.push(node.videoRenderer as Record<string, unknown>);
    }
    if (node.gridVideoRenderer && typeof node.gridVideoRenderer === "object") {
      renderers.push(node.gridVideoRenderer as Record<string, unknown>);
    }
    if (node.richItemRenderer && typeof node.richItemRenderer === "object") {
      const content = (node.richItemRenderer as Record<string, unknown>).content;
      if (content && typeof content === "object") {
        const contentRecord = content as Record<string, unknown>;
        if (contentRecord.videoRenderer && typeof contentRecord.videoRenderer === "object") {
          renderers.push(contentRecord.videoRenderer as Record<string, unknown>);
        }
        if (contentRecord.lockupViewModel && typeof contentRecord.lockupViewModel === "object") {
          lockups.push(contentRecord.lockupViewModel as Record<string, unknown>);
        }
      }
    }
  });

  const videos: TubeVideoEntry[] = [];
  const seen = new Set<string>();
  const now = Date.now();

  for (const lockup of lockups) {
    const rendererContext = lockup.rendererContext as Record<string, unknown> | undefined;
    const commandContext = rendererContext?.commandContext as Record<string, unknown> | undefined;
    const onTap = commandContext?.onTap as Record<string, unknown> | undefined;
    const innertubeCommand = onTap?.innertubeCommand as Record<string, unknown> | undefined;
    const watchEndpoint = innertubeCommand?.watchEndpoint as Record<string, unknown> | undefined;
    const commandMetadata = innertubeCommand?.commandMetadata as Record<string, unknown> | undefined;
    const webCommandMetadata = commandMetadata?.webCommandMetadata as Record<string, unknown> | undefined;
    const watchUrl = typeof webCommandMetadata?.url === "string" ? webCommandMetadata.url : "";
    const videoId =
      (typeof lockup.contentId === "string" && lockup.contentId) ||
      (typeof watchEndpoint?.videoId === "string" && watchEndpoint.videoId) ||
      watchUrl.match(/[?&]v=([\w-]{11})/)?.[1] ||
      "";

    if (!videoId || videoId.length !== 11 || seen.has(videoId)) continue;
    if (watchUrl.includes("/shorts/")) continue;

    const metadata = lockup.metadata as Record<string, unknown> | undefined;
    const lockupMetadata = metadata?.lockupMetadataViewModel as Record<string, unknown> | undefined;
    const title = textFromYouTubeField(lockupMetadata?.title) || textFromYouTubeField(lockup.title);
    if (!title || isBrokenYouTubeTitle(title)) continue;

    const contentMetadata = lockupMetadata?.metadata as Record<string, unknown> | undefined;
    const contentMetadataViewModel = contentMetadata?.contentMetadataViewModel as Record<string, unknown> | undefined;
    const metadataRows = Array.isArray(contentMetadataViewModel?.metadataRows)
      ? (contentMetadataViewModel.metadataRows as Array<Record<string, unknown>>)
      : [];
    const metaTexts = metadataRows.flatMap((row) => {
      const parts = Array.isArray(row.metadataParts) ? (row.metadataParts as Array<Record<string, unknown>>) : [];
      return parts.map((part) => textFromYouTubeField(part.text)).filter(Boolean);
    });
    const publishedAtText =
      metaTexts.find((text) => /前|ago|天|小時|小时|分钟|分鐘|週|周|月|年|streamed|直播/.test(text)) ||
      metaTexts[metaTexts.length - 1] ||
      "";
    const publishedAt = parseRelativePublishedAt(publishedAtText, now);

    const contentImage = lockup.contentImage as Record<string, unknown> | undefined;
    const thumbnailViewModel = contentImage?.thumbnailViewModel as Record<string, unknown> | undefined;
    const image = thumbnailViewModel?.image as Record<string, unknown> | undefined;
    const sources = Array.isArray(image?.sources) ? (image.sources as Array<Record<string, unknown>>) : [];
    const thumbnailUrl =
      (typeof sources[sources.length - 1]?.url === "string" && (sources[sources.length - 1].url as string)) ||
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    seen.add(videoId);
    videos.push({
      videoId,
      title,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      publishedAt,
      updatedAt: publishedAt,
      thumbnail: thumbnailUrl.startsWith("//") ? `https:${thumbnailUrl}` : thumbnailUrl,
    });
  }

  for (const renderer of renderers) {
    const videoId = typeof renderer.videoId === "string" ? renderer.videoId : "";
    if (!videoId || seen.has(videoId)) continue;
    const title = textFromYouTubeField(renderer.title);
    if (!title || isBrokenYouTubeTitle(title)) continue;
    const nav = renderer.navigationEndpoint as Record<string, unknown> | undefined;
    const commandMetadata = nav?.commandMetadata as Record<string, unknown> | undefined;
    const webCommandMetadata = commandMetadata?.webCommandMetadata as Record<string, unknown> | undefined;
    const watchUrl = typeof webCommandMetadata?.url === "string" ? webCommandMetadata.url : "";
    if (watchUrl.includes("/shorts/")) continue;

    const publishedAtText = textFromYouTubeField(renderer.publishedTimeText);
    const publishedAt = parseRelativePublishedAt(publishedAtText, now);
    const thumbnailObj = renderer.thumbnail as Record<string, unknown> | undefined;
    const thumbnails = Array.isArray(thumbnailObj?.thumbnails)
      ? (thumbnailObj.thumbnails as Array<Record<string, unknown>>)
      : [];
    const thumbnailUrl =
      (typeof thumbnails[thumbnails.length - 1]?.url === "string" && (thumbnails[thumbnails.length - 1].url as string)) ||
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    seen.add(videoId);
    videos.push({
      videoId,
      title,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      publishedAt,
      updatedAt: publishedAt,
      thumbnail: thumbnailUrl.startsWith("//") ? `https:${thumbnailUrl}` : thumbnailUrl,
    });
  }

  return videos;
}

function parseVideosFromChannelHtml(html: string): TubeVideoEntry[] {
  return parseVideosFromYouTubeData(extractYtInitialData(html));
}

async function fetchYouTubeInnertubeVideos(channelId: string, html: string): Promise<TubeVideoEntry[]> {
  const { apiKey, clientVersion } = extractInnertubeClientConfig(html);
  if (!apiKey || !channelId) return [];

  try {
    const response = await fetch(
      `https://www.youtube.com/youtubei/v1/browse?key=${encodeURIComponent(apiKey)}&prettyPrint=false`,
      {
        method: "POST",
        cache: "no-store",
        headers: {
          ...YOUTUBE_HEADERS,
          "content-type": "application/json",
          "x-youtube-client-name": "1",
          "x-youtube-client-version": clientVersion,
          origin: "https://www.youtube.com",
          referer: `https://www.youtube.com/channel/${channelId}/videos`,
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: "WEB",
              clientVersion,
              hl: "zh-TW",
              gl: "TW",
            },
          },
          browseId: channelId,
          // videos tab
          params: "EgZ2aWRlb3PyBgQKAjoA",
        }),
      }
    );
    if (!response.ok) return [];
    const data = await response.json();
    return parseVideosFromYouTubeData(data);
  } catch {
    return [];
  }
}

async function fetchYouTubeFeedVideos(channelId: string) {
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
  try {
    const response = await fetch(feedUrl, YOUTUBE_FETCH_INIT);
    if (!response.ok) return { feedTitle: "", entries: [] as TubeVideoEntry[] };
    const xml = await response.text();
    if (isBrokenYouTubeTitle(pick(xml, /<title>(.*?)<\/title>/))) {
      return { feedTitle: "", entries: [] as TubeVideoEntry[] };
    }
    return parseFeed(xml);
  } catch {
    return { feedTitle: "", entries: [] as TubeVideoEntry[] };
  }
}

async function fetchChannelSearchVideos(sourceUrl: string, query: string): Promise<TubeVideoEntry[]> {
  const channelUrl = normalizeChannelUrl(sourceUrl);
  const searchUrl = `${channelUrl}/search?query=${encodeURIComponent(query)}`;
  try {
    const response = await fetch(searchUrl, YOUTUBE_FETCH_INIT);
    if (!response.ok) return [];
    const html = await response.text();
    return parseVideosFromChannelHtml(html);
  } catch {
    return [];
  }
}

function mergeTubeVideos(...groups: TubeVideoEntry[][]) {
  const merged: TubeVideoEntry[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    for (const video of group) {
      if (!video.videoId || seen.has(video.videoId)) continue;
      seen.add(video.videoId);
      merged.push(video);
    }
  }
  return merged;
}

async function fetchChannel(channel: FengbroTubeChannelConfig) {
  if (isBilibiliSource(channel.sourceUrl)) return fetchBilibiliChannel(channel);

  const { sourceUrl } = channel;
  const { channelId, title, html } = await resolveChannelPage(sourceUrl);

  // Prefer page / Innertube scrape: Atom RSS currently returns 404 for many channels.
  let videos = parseVideosFromChannelHtml(html).slice(0, 15);
  if (videos.length === 0) {
    videos = (await fetchYouTubeInnertubeVideos(channelId, html)).slice(0, 15);
  }
  const feed = videos.length === 0 ? await fetchYouTubeFeedVideos(channelId) : { feedTitle: "", entries: [] as TubeVideoEntry[] };
  if (videos.length === 0) {
    videos = feed.entries.slice(0, 15);
  }

  if (sourceUrl.toLowerCase().includes("leonard2834")) {
    videos = videos.filter((video) => !/Leonard精[選选]片段/i.test(video.title));
  }

  videos = videos.slice(0, 10);
  let downfallIndexVideo: { video: TubeVideoEntry; value: string } | null = null;
  const resolvedTitle = getChannelTitle(channel, title || feed.feedTitle);

  if (isHenrenChannel(sourceUrl, resolvedTitle)) {
    // Channel search returns historical 倒台指數 episodes that may not appear in latest /videos.
    const searchVideos = await fetchChannelSearchVideos(sourceUrl, "倒台指數");
    const combined = mergeTubeVideos(videos, searchVideos).map((video) => {
      const known = KNOWN_DOWNFALL_INDEX_BY_VIDEO_ID[video.videoId];
      if (!known) return video;
      // Prefer verified air date over noisy relative scrape times (e.g. "9 個月前").
      return {
        ...video,
        publishedAt: known.publishedAt,
        updatedAt: video.updatedAt || known.publishedAt,
      };
    });

    const downfallItems = combined
      .map((video) => {
        const resolved = resolveDownfallIndexForVideo(video);
        return resolved ? { video: { ...video, publishedAt: resolved.publishedAt || video.publishedAt }, value: resolved.value } : null;
      })
      .filter((item): item is { video: TubeVideoEntry; value: string } => Boolean(item))
      .sort((left, right) => {
        const leftTime = new Date(left.video.publishedAt || left.video.updatedAt).getTime();
        const rightTime = new Date(right.video.publishedAt || right.video.updatedAt).getTime();
        return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
      });

    if (downfallItems.length > 0) {
      downfallIndexVideo = downfallItems[0];
      videos = downfallItems.map((item) => item.video).slice(0, 15);
    } else {
      videos = combined.filter((video) => /倒台指[數数]/.test(video.title)).slice(0, 15);
    }
  }

  return {
    sourceUrl,
    channelId,
    title: resolvedTitle,
    videos,
    downfallIndexUpdate: downfallIndexVideo
      ? {
          value: downfallIndexVideo.value,
          title: downfallIndexVideo.video.title,
          url: downfallIndexVideo.video.url,
          publishedAt: downfallIndexVideo.video.publishedAt,
        }
      : null,
  };
}

async function fetchBilibiliChannel(channel: FengbroTubeChannelConfig) {
  const { sourceUrl } = channel;
  const mid = getBilibiliMid(sourceUrl);
  if (!mid) throw new Error("Missing Bilibili space id");

  const apiUrl = new URL("https://api.bilibili.com/x/space/arc/search");
  apiUrl.searchParams.set("mid", mid);
  apiUrl.searchParams.set("ps", "10");
  apiUrl.searchParams.set("tid", "0");
  apiUrl.searchParams.set("pn", "1");
  apiUrl.searchParams.set("keyword", "");
  apiUrl.searchParams.set("order", "pubdate");
  apiUrl.searchParams.set("jsonp", "jsonp");

  const response = await fetch(apiUrl.toString(), {
    headers: BILIBILI_HEADERS,
    next: { revalidate: 60 * 30 },
  });
  if (!response.ok) return fetchBilibiliSearchChannel(channel, `Bilibili ${response.status}`);

  const payload = await response.json();
  if (payload?.code !== 0) return fetchBilibiliSearchChannel(channel, payload?.message || "Bilibili read failed");
  const list = Array.isArray(payload?.data?.list?.vlist) ? payload.data.list.vlist : [];
  if (list.length === 0) return fetchBilibiliSearchChannel(channel, "Bilibili space has no recent videos");

  const videos = list.slice(0, 10).map((item: Record<string, unknown>) => {
    const bvid = typeof item.bvid === "string" ? item.bvid : "";
    const aid = typeof item.aid === "number" || typeof item.aid === "string" ? String(item.aid) : "";
    const publishedAt =
      typeof item.created === "number" && item.created > 0
        ? new Date(item.created * 1000).toISOString()
        : "";

    return {
      videoId: bvid || aid,
      title: typeof item.title === "string" ? decodeHtml(item.title) : "",
      url: bvid ? `https://www.bilibili.com/video/${bvid}` : sourceUrl,
      publishedAt,
      updatedAt: publishedAt,
      thumbnail: toProxiedImageUrl(item.pic),
    };
  });

  return {
    sourceUrl,
    channelId: mid,
    title: getChannelTitle(channel, fallbackNameFromUrl(sourceUrl)),
    videos,
    downfallIndexUpdate: null,
  };
}

async function fetchBilibiliSearchChannel(channel: FengbroTubeChannelConfig, fallbackReason = "") {
  const alias = getChannelTitle(channel, fallbackNameFromUrl(channel.sourceUrl));
  const keyword = alias || fallbackNameFromUrl(channel.sourceUrl);
  const apiUrl = new URL("https://api.bilibili.com/x/web-interface/search/type");
  apiUrl.searchParams.set("search_type", "video");
  apiUrl.searchParams.set("keyword", keyword);
  apiUrl.searchParams.set("order", "pubdate");
  apiUrl.searchParams.set("page", "1");
  apiUrl.searchParams.set("page_size", "10");

  const response = await fetch(apiUrl.toString(), {
    headers: {
      ...BILIBILI_HEADERS,
      referer: `https://search.bilibili.com/all?keyword=${encodeURIComponent(keyword)}`,
    },
    next: { revalidate: 60 * 30 },
  });
  if (!response.ok) throw new Error(fallbackReason || `Bilibili search ${response.status}`);

  const payload = await response.json();
  if (payload?.code !== 0) throw new Error(fallbackReason || payload?.message || "Bilibili search failed");
  const result = Array.isArray(payload?.data?.result) ? payload.data.result : [];
  const matchingAuthor = result.filter((item: Record<string, unknown>) => {
    const author = typeof item.author === "string" ? decodeHtml(item.author) : "";
    return !author || author.includes(alias) || alias.includes(author);
  });
  const list = matchingAuthor.length > 0 ? matchingAuthor : result;

  const videos = list.slice(0, 10).map((item: Record<string, unknown>) => {
    const bvid = typeof item.bvid === "string" ? item.bvid : "";
    const arcurl = typeof item.arcurl === "string" ? item.arcurl.replace(/^\/\//, "https://") : "";
    const pubdate = typeof item.pubdate === "number" ? item.pubdate : Number(item.pubdate);
    const publishedAt = Number.isFinite(pubdate) && pubdate > 0 ? new Date(pubdate * 1000).toISOString() : "";

    return {
      videoId: bvid || arcurl || decodeHtml(String(item.title || "")),
      title: typeof item.title === "string" ? decodeHtml(item.title) : "",
      url: bvid ? `https://www.bilibili.com/video/${bvid}` : arcurl || channel.sourceUrl,
      publishedAt,
      updatedAt: publishedAt,
      thumbnail: toProxiedImageUrl(item.pic),
    };
  });

  return {
    sourceUrl: channel.sourceUrl,
    channelId: getBilibiliMid(channel.sourceUrl) || keyword,
    title: alias,
    videos,
    downfallIndexUpdate: null,
  };
}

function getLatestChannelTime(channel: { videos: Array<{ publishedAt: string; updatedAt: string }> }) {
  return Math.max(
    0,
    ...channel.videos.map((video) => {
      const time = new Date(video.publishedAt || video.updatedAt).getTime();
      return Number.isFinite(time) ? time : 0;
    })
  );
}

async function buildTubeResult(channelsConfig: FengbroTubeChannelConfig[]) {
  const uniqueChannels = normalizeFengbroTubeChannels(channelsConfig);
  const henrenConfig = { alias: "一个狠人", sourceUrl: "https://www.youtube.com/@henren778/videos" };
  const hasHenren = uniqueChannels.some(c => isHenrenChannel(c.sourceUrl, c.alias));
  
  const allChannels = [...uniqueChannels];
  if (!hasHenren) {
    allChannels.push(henrenConfig);
  }

  const settled = await Promise.allSettled(allChannels.map(fetchChannel));
  const allFetchedChannels = settled.map((item, index) => {
    if (item.status === "fulfilled") return item.value;
    const channel = allChannels[index];
    const sourceUrl = channel.sourceUrl;
    return {
      sourceUrl,
      channelId: "",
      title: getChannelTitle(channel, fallbackNameFromUrl(sourceUrl)),
      videos: [],
      error: item.reason instanceof Error ? item.reason.message : "讀取失敗",
    };
  });

  const downfallChannel = allFetchedChannels.find(c => isHenrenChannel(c.sourceUrl, c.title)) || null;
  const channels = allFetchedChannels.filter(c => uniqueChannels.some(req => req.sourceUrl === c.sourceUrl));

  channels.sort((left, right) => getLatestChannelTime(right) - getLatestChannelTime(left));

  const now = Date.now();
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
  const recentVideos = channels.flatMap((channel) =>
    channel.videos
      .filter((video: TubeVideoEntry) => {
        const time = new Date(video.publishedAt || video.updatedAt).getTime();
        return Number.isFinite(time) && now - time <= threeDaysMs;
      })
      .map((video: TubeVideoEntry) => ({
        ...video,
        channelTitle: channel.title,
        channelId: channel.channelId,
      }))
  );

  return NextResponse.json({
    fetchedAt: new Date().toISOString(),
    sourceCount: uniqueChannels.length,
    defaultSourceCount: DEFAULT_FENGBRO_TUBE_CHANNELS.length,
    channels,
    downfallChannel,
    recentVideos: recentVideos.sort(
      (left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime()
    ),
  });
}

export async function GET() {
  return buildTubeResult(DEFAULT_FENGBRO_TUBE_CHANNELS);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { channels?: unknown; sources?: unknown };
    const channelInputs = Array.isArray(body.channels)
      ? body.channels
      : Array.isArray(body.sources)
        ? body.sources
        : DEFAULT_FENGBRO_TUBE_CHANNELS;
    return buildTubeResult(normalizeFengbroTubeChannels(channelInputs));
  } catch {
    return buildTubeResult(DEFAULT_FENGBRO_TUBE_CHANNELS);
  }
}
