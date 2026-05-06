import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CHANNEL_SOURCES = [
  "https://www.youtube.com/@SJdiao/videos",
  "https://www.youtube.com/@henren778",
  "https://www.youtube.com/@libertas1984/videos",
  "https://www.youtube.com/@sunlao/videos",
  "https://www.youtube.com/@Torontobigface/videos",
  "https://www.youtube.com/@junyulan/videos",
  "https://www.youtube.com/@blackwhite_raven/videos",
  "https://www.youtube.com/@quedaren/videos",
  "https://www.youtube.com/@%E5%A4%B8%E5%85%8B%E8%AF%B4",
  "https://www.youtube.com/@%E5%96%B5%E5%96%B5%E7%9C%8B%E4%B8%80%E7%9C%8B/videos",
];

const uniqueSources = Array.from(new Set(CHANNEL_SOURCES));
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

  return {
    sourceUrl,
    channelId,
    title: feedTitle || title,
    videos: entries.slice(0, 10),
  };
}

export async function GET() {
  const settled = await Promise.allSettled(uniqueSources.map(fetchChannel));
  const channels = settled.map((item, index) => {
    if (item.status === "fulfilled") return item.value;
    const sourceUrl = uniqueSources[index];
    return {
      sourceUrl,
      channelId: "",
      title: fallbackNameFromUrl(sourceUrl),
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
    channels,
    recentVideos: recentVideos.sort(
      (left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime()
    ),
  });
}
