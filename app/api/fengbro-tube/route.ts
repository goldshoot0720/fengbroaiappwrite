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
  "https://www.youtube.com/@jlaw/videos",
  "https://www.youtube.com/@SunChannelHK/videos",
  "https://www.youtube.com/@jilixiaoshimei/videos",
  "https://www.youtube.com/@informant510/videos",
  "https://www.youtube.com/@ma-siku/videos",
  "https://www.youtube.com/@monsterise/videos",
  "https://www.youtube.com/@NeixianZhang/videos",
  "https://www.youtube.com/@%E4%BF%AE%E4%BB%99%E8%80%85%E5%B0%8F%E7%83%A8/videos",
  "https://www.youtube.com/@xiaoye1757/videos",
];

const uniqueSources = Array.from(new Set(CHANNEL_SOURCES));
const CHANNEL_TITLE_OVERRIDES: Record<string, string> = {
  jlaw: "夏河東渡",
  sunchannelhk: "Sun Channel",
  jilixiaoshimei: "吉利小师妹",
  informant510: "线人频道Informant",
  "ma-siku": "马司库",
  monsterise: "怪獸崛起 MONSTERISE",
  neixianzhang: "張内咸脫口秀",
  修仙者小烨: "修仙者小烨",
  xiaoye1757: "修炼者小烨",
};
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
  return CHANNEL_TITLE_OVERRIDES[getChannelHandle(sourceUrl)] || title;
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

export async function GET() {
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
    channels,
    recentVideos: recentVideos.sort(
      (left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime()
    ),
  });
}
