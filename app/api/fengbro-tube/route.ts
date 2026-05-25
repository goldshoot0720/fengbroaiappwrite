import { NextResponse } from "next/server";
import {
  DEFAULT_FENGBRO_TUBE_CHANNEL_SOURCES,
  FENGBRO_TUBE_TITLE_OVERRIDES,
  dedupeFengbroTubeSources,
} from "@/lib/fengbroTubeChannels";

export const dynamic = "force-dynamic";

const YOUTUBE_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

function decodeHtml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
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

function getChannelHandle(sourceUrl: string) {
  try {
    const path = decodeURIComponent(new URL(sourceUrl).pathname);
    return path.match(/^\/@([^/]+)/)?.[1].toLowerCase() || "";
  } catch {
    return "";
  }
}

function getChannelTitle(sourceUrl: string, title: string) {
  return FENGBRO_TUBE_TITLE_OVERRIDES[getChannelHandle(sourceUrl)] || title;
}

function normalizeDigits(value: string) {
  return value.replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0));
}

function extractDownfallIndex(title: string) {
  const normalizedTitle = normalizeDigits(title);
  const numberPattern = "([0-9]+(?:\\.[0-9]+)?)";
  const afterLabel = normalizedTitle.match(new RegExp(`倒台指[數数][^0-9]{0,24}${numberPattern}`));
  const beforeLabel = normalizedTitle.match(new RegExp(`${numberPattern}\\s*(?:分|%|％)?\\s*倒台指[數数]`));
  return afterLabel?.[1] || beforeLabel?.[1] || "";
}

function isHenrenChannel(sourceUrl: string, title: string) {
  return /henren778/i.test(sourceUrl) || /一[個个]狠人/.test(title);
}

async function resolveChannelId(sourceUrl: string) {
  const channelUrl = normalizeChannelUrl(sourceUrl);
  const response = await fetch(channelUrl, {
    headers: YOUTUBE_HEADERS,
    next: { revalidate: 60 * 60 * 6 },
  });
  const html = await response.text();
  const channelId =
    pick(html, /"channelId"\s*:\s*"([^"]+)"/) ||
    pick(html, /"externalId"\s*:\s*"([^"]+)"/) ||
    pick(html, /youtube\.com\/channel\/(UC[\w-]+)/);

  if (!channelId) {
    throw new Error("找不到 YouTube channel id");
  }

  const title =
    pick(html, /<meta property="og:title" content="([^"]+)"/) ||
    pick(html, /<title>(.*?)<\/title>/) ||
    fallbackNameFromUrl(sourceUrl);

  return { channelId, title: title.replace(/ - YouTube$/i, "") };
}

function parseFeed(xml: string) {
  const feedTitle = pick(xml, /<title>(.*?)<\/title>/);
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
  });

  return { feedTitle, entries };
}

async function fetchChannel(sourceUrl: string) {
  const { channelId, title } = await resolveChannelId(sourceUrl);
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
  const response = await fetch(feedUrl, {
    headers: YOUTUBE_HEADERS,
    next: { revalidate: 60 * 30 },
  });
  const xml = await response.text();
  const { feedTitle, entries } = parseFeed(xml);

  const videos = entries.slice(0, 10);
  const downfallIndexVideo = isHenrenChannel(sourceUrl, feedTitle || title)
    ? videos
        .map((video) => ({ video, value: extractDownfallIndex(video.title) }))
        .find((item) => item.value)
    : null;

  return {
    sourceUrl,
    channelId,
    title: getChannelTitle(sourceUrl, feedTitle || title),
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

async function buildTubeResult(sources: string[]) {
  const uniqueSources = dedupeFengbroTubeSources(sources);
  const settled = await Promise.allSettled(uniqueSources.map(fetchChannel));
  const channels = settled.map((item, index) => {
    if (item.status === "fulfilled") return item.value;
    const sourceUrl = uniqueSources[index];
    return {
      sourceUrl,
      channelId: "",
      title: getChannelTitle(sourceUrl, fallbackNameFromUrl(sourceUrl)),
      videos: [],
      error: item.reason instanceof Error ? item.reason.message : "讀取失敗",
    };
  });

  const now = Date.now();
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
  const recentVideos = channels.flatMap((channel) =>
    channel.videos
      .filter((video) => {
        const time = new Date(video.publishedAt || video.updatedAt).getTime();
        return Number.isFinite(time) && now - time <= threeDaysMs;
      })
      .map((video) => ({
        ...video,
        channelTitle: channel.title,
        channelId: channel.channelId,
      }))
  );

  return NextResponse.json({
    fetchedAt: new Date().toISOString(),
    sourceCount: uniqueSources.length,
    defaultSourceCount: DEFAULT_FENGBRO_TUBE_CHANNEL_SOURCES.length,
    channels,
    recentVideos: recentVideos.sort(
      (left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime()
    ),
  });
}

export async function GET() {
  return buildTubeResult(DEFAULT_FENGBRO_TUBE_CHANNEL_SOURCES);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { sources?: unknown };
    const sources = Array.isArray(body.sources)
      ? body.sources.filter((source): source is string => typeof source === "string")
      : DEFAULT_FENGBRO_TUBE_CHANNEL_SOURCES;
    return buildTubeResult(sources);
  } catch {
    return buildTubeResult(DEFAULT_FENGBRO_TUBE_CHANNEL_SOURCES);
  }
}
