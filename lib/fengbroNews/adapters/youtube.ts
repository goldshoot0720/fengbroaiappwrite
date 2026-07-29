/** YouTube channel adapter for Fengbro News. */

import type { FengbroNewsSiteConfig } from "@/lib/fengbroNewsSites";
import { fetchText, fetchViaJina } from "../fetch";
import {
  isJunkNewsTitle,
  normalizeSpace,
  pickXml,
  titleMatches,
} from "../html";
import type { NewsArticle, SiteSearchResult } from "../types";

export type YouTubeVideoHit = {
  title: string;
  url: string;
  videoId: string;
  publishedAt?: string;
};

export function getYouTubeChannelTab(homeUrl: string): "videos" | "shorts" | "streams" | "featured" {
  try {
    const path = decodeURIComponent(new URL(homeUrl).pathname).toLowerCase();
    if (/\/shorts(?:\/|$)/i.test(path)) return "shorts";
    if (/\/streams(?:\/|$)/i.test(path)) return "streams";
    if (/\/featured(?:\/|$)/i.test(path)) return "featured";
  } catch {
    // fall through
  }
  return "videos";
}

/** Channel list page: /videos (default) or /shorts when configured. */
export function getYouTubeVideosPageUrl(homeUrl: string) {
  const tab = getYouTubeChannelTab(homeUrl);
  try {
    const url = new URL(homeUrl);
    let path = url.pathname.replace(/\/+$/, "");
    path = path.replace(/\/(videos|shorts|streams|featured)$/i, "");
    return `https://www.youtube.com${path}/${tab}`;
  } catch {
    return homeUrl;
  }
}

export function formatYouTubeHitUrl(videoId: string, tab: "videos" | "shorts" | "streams" | "featured") {
  if (tab === "shorts") return `https://www.youtube.com/shorts/${videoId}`;
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function resolveYouTubeChannelIdFromHtml(html: string) {
  return (
    /"externalId"\s*:\s*"(UC[\w-]+)"/.exec(html)?.[1] ||
    /"channelId"\s*:\s*"(UC[\w-]+)"/.exec(html)?.[1] ||
    /youtube\.com\/channel\/(UC[\w-]+)/.exec(html)?.[1] ||
    /<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]+)"/.exec(html)?.[1] ||
    ""
  );
}

export function parseYouTubeFeedEntries(xml: string): YouTubeVideoHit[] {
  if (!xml.includes("<entry>")) return [];
  const entries = xml.split("<entry>").slice(1);
  const hits: YouTubeVideoHit[] = [];
  for (const entry of entries) {
    const videoId =
      pickXml(entry, /<yt:videoId>(.*?)<\/yt:videoId>/) ||
      pickXml(entry, /video:videoid>(.*?)<\/yt:videoId>/i) ||
      "";
    const title = pickXml(entry, /<title>([\s\S]*?)<\/title>/);
    const link =
      pickXml(entry, /<link[^>]+href="([^"]+)"/) ||
      (videoId ? `https://www.youtube.com/watch?v=${videoId}` : "");
    const publishedAt =
      pickXml(entry, /<published>(.*?)<\/published>/) ||
      pickXml(entry, /<updated>(.*?)<\/updated>/);
    if (!title || !link) continue;
    hits.push({
      title,
      url: link,
      videoId: videoId || link.match(/[?&]v=([\w-]{11})/)?.[1] || "",
      publishedAt: publishedAt || undefined,
    });
  }
  return hits;
}

export function parseYouTubeVideosFromHtml(html: string): YouTubeVideoHit[] {
  const hits: YouTubeVideoHit[] = [];
  const seen = new Set<string>();

  // Shorts shelf: "/shorts/xxxxxxxxxxx"
  {
    const shortRe = /\/shorts\/([\w-]{11})/g;
    let sm: RegExpExecArray | null;
    while ((sm = shortRe.exec(html))) {
      const videoId = sm[1];
      if (seen.has(videoId)) continue;
      // Try nearby title in a small window
      const window = html.slice(Math.max(0, sm.index - 200), sm.index + 280);
      const titleM =
        /"text"\s*:\s*"((?:\\.|[^"\\]){2,120})"/.exec(window) ||
        /"title"\s*:\s*"((?:\\.|[^"\\]){2,120})"/.exec(window);
      let title = titleM?.[1] || "";
      try {
        if (title) title = JSON.parse(`"${title}"`) as string;
      } catch {
        title = title.replace(/\\u0026/g, "&").replace(/\\"/g, '"');
      }
      title = normalizeSpace(title);
      if (!title || title.length < 2) continue;
      if (/^(watch later|share|mix|播放清單|稍後再看)/i.test(title)) continue;
      seen.add(videoId);
      hits.push({
        title,
        url: `https://www.youtube.com/shorts/${videoId}`,
        videoId,
      });
    }
  }

  // "videoId":"xxxxxxxxxxx" near "title":{"runs":[{"text":"..."}]}
  const re =
    /"videoId"\s*:\s*"([\w-]{11})"[\s\S]{0,400}?"text"\s*:\s*"((?:\\.|[^"\\]){2,200})"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const videoId = m[1];
    if (seen.has(videoId)) continue;
    let title = m[2]
      .replace(/\\u0026/g, "&")
      .replace(/\\"/g, '"')
      .replace(/\\n/g, " ")
      .replace(/\\\//g, "/");
    try {
      title = JSON.parse(`"${m[2]}"`) as string;
    } catch {
      // keep cleaned title
    }
    title = normalizeSpace(title);
    if (!title || title.length < 2) continue;
    if (/^(watch later|share|mix|播放清單|稍後再看)/i.test(title)) continue;
    seen.add(videoId);
    hits.push({
      title,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      videoId,
    });
  }

  // Alternate pattern: title first then videoId
  if (hits.length < 3) {
    const re2 =
      /"text"\s*:\s*"((?:\\.|[^"\\]){2,200})"[\s\S]{0,200}?"videoId"\s*:\s*"([\w-]{11})"/g;
    while ((m = re2.exec(html))) {
      const videoId = m[2];
      if (seen.has(videoId)) continue;
      let title = m[1];
      try {
        title = JSON.parse(`"${m[1]}"`) as string;
      } catch {
        title = m[1].replace(/\\u0026/g, "&").replace(/\\"/g, '"');
      }
      title = normalizeSpace(title);
      if (!title || title.length < 2) continue;
      seen.add(videoId);
      hits.push({
        title,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        videoId,
      });
    }
  }

  return hits;
}

export function getYouTubeChannelSearchUrl(homeUrl: string, query: string): string {
  try {
    const url = new URL(getYouTubeVideosPageUrl(homeUrl));
    // /@handle/videos|shorts → /@handle/search?query=
    const basePath = url.pathname
      .replace(/\/(videos|shorts|streams|featured)\/?$/i, "")
      .replace(/\/+$/, "");
    return `https://www.youtube.com${basePath}/search?query=${encodeURIComponent(query)}`;
  } catch {
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  }
}

/** YouTube channel — prefer channel search, then recent feed/list (or /shorts tab). */
export async function searchYouTubeChannel(site: FengbroNewsSiteConfig, query: string): Promise<SiteSearchResult> {
  const tab = getYouTubeChannelTab(site.homeUrl);
  const videosPageUrl = getYouTubeVideosPageUrl(site.homeUrl);
  const searchPageUrl = getYouTubeChannelSearchUrl(site.homeUrl, query);
  let html = "";
  let channelId = "";
  let source = tab === "shorts" ? videosPageUrl : searchPageUrl;
  let hits: YouTubeVideoHit[] = [];

  // Shorts: list /shorts first (channel search mixes long-form)
  if (tab === "shorts") {
    const page = await fetchText(videosPageUrl);
    if (page.ok && page.text.length > 2000) {
      html = page.text;
      hits = parseYouTubeVideosFromHtml(html);
      source = videosPageUrl;
      channelId = resolveYouTubeChannelIdFromHtml(html);
    }
  }

  // 1) Channel search (skip for shorts once list page already returned items)
  if (hits.length < 3 && !(tab === "shorts" && hits.length > 0)) {
    const page = await fetchText(searchPageUrl);
    if (page.ok && page.text.length > 5000) {
      if (!html) html = page.text;
      const searchHits = parseYouTubeVideosFromHtml(page.text);
      const seenIds = new Set(hits.map((h) => h.videoId));
      for (const hit of searchHits) {
        if (seenIds.has(hit.videoId)) continue;
        hits.push(hit);
        seenIds.add(hit.videoId);
      }
      source = source || searchPageUrl;
      channelId = channelId || resolveYouTubeChannelIdFromHtml(page.text);
    }
  }

  // 2) Recent videos + Atom feed (non-shorts only; keep path short under site timeout)
  if (hits.length < 3 && tab !== "shorts") {
    const page = await fetchText(videosPageUrl);
    if (page.ok) {
      if (!html) html = page.text;
      channelId = channelId || resolveYouTubeChannelIdFromHtml(page.text);
      const recent = parseYouTubeVideosFromHtml(page.text);
      const seenIds = new Set(hits.map((h) => h.videoId));
      for (const hit of recent) {
        if (seenIds.has(hit.videoId)) continue;
        hits.push(hit);
        seenIds.add(hit.videoId);
      }
      if (!source) source = videosPageUrl;
    }
  }

  if (channelId && hits.length === 0 && tab !== "shorts") {
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
    const feed = await fetchText(feedUrl, {
      headers: { accept: "application/atom+xml,application/xml,text/xml,*/*" },
    });
    if (feed.ok && feed.text.includes("<entry>")) {
      hits = parseYouTubeFeedEntries(feed.text);
      source = source || feedUrl;
    }
  }

  // 3) jina only as last resort when completely empty (slow path)
  if (hits.length === 0) {
    const fallbackUrl = tab === "shorts" ? videosPageUrl : searchPageUrl;
    const via = await fetchViaJina(fallbackUrl);
    if (via.ok) {
      const mdHits: YouTubeVideoHit[] = [];
      const re =
        /\[([^\]]+)\]\((https?:\/\/(?:www\.)?youtube\.com\/(?:watch\?v=|shorts\/)([\w-]{11})[^)\s]*)\)/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(via.text))) {
        mdHits.push({
          title: normalizeSpace(m[1]),
          url: formatYouTubeHitUrl(m[3], tab),
          videoId: m[3],
        });
      }
      if (mdHits.length) {
        hits = mdHits;
        source = `${fallbackUrl} (via reader)`;
      }
    }
  }

  const articles: NewsArticle[] = [];
  const seen = new Set<string>();
  for (const hit of hits) {
    if (!titleMatches(hit.title, query) || isJunkNewsTitle(hit.title)) continue;
    const url = hit.videoId
      ? formatYouTubeHitUrl(hit.videoId, tab)
      : hit.url.startsWith("http")
        ? hit.url
        : `https://www.youtube.com/watch?v=${hit.videoId}`;
    if (seen.has(url)) continue;
    seen.add(url);
    articles.push({
      title: hit.title.slice(0, 160),
      url,
      siteId: site.id,
      siteName: site.name,
      domain: site.domain,
      publishedAt: hit.publishedAt,
    });
  }

  return {
    siteId: site.id,
    siteName: site.name,
    domain: site.domain,
    articles,
    error:
      hits.length === 0
        ? "無法讀取此 YouTube 頻道"
        : articles.length === 0
          ? `頻道內沒有標題含「${query}」的影片（近三年內）`
          : undefined,
    source,
  };
}

