import { NextResponse } from "next/server";
import {
  DEFAULT_FENGBRO_TUBE_CHANNELS,
  type FengbroTubeChannelConfig,
  getFengbroTubeAlias,
  normalizeFengbroTubeChannels,
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

function getChannelTitle(channel: FengbroTubeChannelConfig, title: string) {
  const defaultAlias = getFengbroTubeAlias(channel.sourceUrl);
  return !channel.alias || channel.alias === defaultAlias ? title : channel.alias;
}

function normalizeDigits(value: string) {
  return value.replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0));
}

function extractDownfallIndex(title: string) {
  const normalizedTitle = normalizeDigits(title);
  const numberPattern = "([0-9]+(?:\\.[0-9]+)?)";
  const formatIndex = (value: string) => Number(value).toFixed(2).padStart(5, "0");
  const labelMatch = /倒台指[數数]/.exec(normalizedTitle);
  if (labelMatch) {
    const afterLabelText = normalizedTitle.slice(labelMatch.index + labelMatch[0].length, labelMatch.index + labelMatch[0].length + 80);
    const movementValue = afterLabelText.match(new RegExp(`(?:飆至|飙至|升至|漲至|涨至|達到|达到|達|达|至|突破|破)\\s*${numberPattern}`));
    if (movementValue?.[1]) return formatIndex(movementValue[1]);

    const afterLabelNumbers = [...afterLabelText.matchAll(new RegExp(numberPattern, "g"))];
    const firstNonDateNumber = afterLabelNumbers.find((match) => {
      const nextText = afterLabelText.slice((match.index || 0) + match[0].length).trimStart();
      return !/^[月日號号]/.test(nextText);
    });
    if (firstNonDateNumber?.[1]) return formatIndex(firstNonDateNumber[1]);
  }
  const beforeLabel = normalizedTitle.match(new RegExp(`${numberPattern}\\s*(?:分|%|％)?\\s*倒台指[數数]`));
  return beforeLabel?.[1] ? formatIndex(beforeLabel[1]) : "";
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

async function fetchChannel(channel: FengbroTubeChannelConfig) {
  const { sourceUrl } = channel;
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
    title: getChannelTitle(channel, feedTitle || title),
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
  const settled = await Promise.allSettled(uniqueChannels.map(fetchChannel));
  const channels = settled.map((item, index) => {
    if (item.status === "fulfilled") return item.value;
    const channel = uniqueChannels[index];
    const sourceUrl = channel.sourceUrl;
    return {
      sourceUrl,
      channelId: "",
      title: getChannelTitle(channel, fallbackNameFromUrl(sourceUrl)),
      videos: [],
      error: item.reason instanceof Error ? item.reason.message : "讀取失敗",
    };
  }).sort((left, right) => getLatestChannelTime(right) - getLatestChannelTime(left));

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
    sourceCount: uniqueChannels.length,
    defaultSourceCount: DEFAULT_FENGBRO_TUBE_CHANNELS.length,
    channels,
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
