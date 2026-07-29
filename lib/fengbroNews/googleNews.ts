/** Google News RSS fallback for bot-blocked publishers. */

import { normalizeDomain } from "@/lib/fengbroNewsSites";
import type { FengbroNewsSiteConfig } from "@/lib/fengbroNewsSites";
import { PREFER_GOOGLE_NEWS_HOSTS } from "./constants";
import { fetchText } from "./fetch";
import { isJunkNewsTitle, normalizeSpace, pickXml, titleMatches } from "./html";
import type { FengbroNewsSearchOptions } from "./options";
import type { NewsArticle } from "./types";

export function prefersGoogleNewsFirst(domainOrUrl: string): boolean {
  const host = normalizeDomain(domainOrUrl);
  return PREFER_GOOGLE_NEWS_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

/** Google News RSS fallback for bot-blocked publishers (chinatimes etc.). */
export async function searchGoogleNewsRss(
  site: FengbroNewsSiteConfig,
  query: string,
  seen: Set<string>,
  options?: FengbroNewsSearchOptions
): Promise<{ articles: NewsArticle[]; source?: string; error?: string }> {
  if (options?.signal?.aborted) {
    return { articles: [], error: "已取消" };
  }

  const domain = normalizeDomain(site.domain);
  const q = encodeURIComponent(`${query} site:${domain} when:1095d`);
  const feedUrl = `https://news.google.com/rss/search?q=${q}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`;
  const feed = await fetchText(feedUrl, {
    headers: { accept: "application/rss+xml,application/xml,text/xml,*/*" },
    signal: options?.signal,
  });
  if (!feed.ok || !feed.text.includes("<item>")) {
    return {
      articles: [],
      error: feed.error || `Google News HTTP ${feed.status}`,
    };
  }

  const articles: NewsArticle[] = [];
  const items = feed.text.split("<item>").slice(1);
  for (const item of items) {
    const titleRaw =
      pickXml(item, /<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
      pickXml(item, /<title>([\s\S]*?)<\/title>/);
    // Strip publisher suffix: "title - 中時新聞網"
    const title = normalizeSpace(titleRaw.replace(/\s*[-|｜]\s*[^-|｜]{2,20}\s*$/, ""));
    if (!title || !titleMatches(title, query) || isJunkNewsTitle(title)) continue;

    const link =
      pickXml(item, /<link>([\s\S]*?)<\/link>/) ||
      pickXml(item, /href="(https?:\/\/[^"]+)"/);
    const sourceName = pickXml(item, /<source[^>]*>([\s\S]*?)<\/source>/);
    const sourceUrl = /url="([^"]+)"/.exec(item)?.[1] || "";
    // Prefer publisher homepage domain match
    const publisherHost = sourceUrl ? normalizeDomain(sourceUrl) : "";
    if (
      publisherHost &&
      publisherHost !== domain &&
      !publisherHost.endsWith(`.${domain}`) &&
      !domain.endsWith(publisherHost)
    ) {
      // still allow if title has query and source name contains site name
      if (!sourceName.includes(site.name.slice(0, 2))) continue;
    }

    const publishedAt = pickXml(item, /<pubDate>([\s\S]*?)<\/pubDate>/);
    const url = (link || "").trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    articles.push({
      title: title.slice(0, 160),
      url,
      siteId: site.id,
      siteName: site.name,
      domain: site.domain,
      publishedAt: publishedAt || undefined,
    });
    if (articles.length >= 10) break;
  }

  return { articles, source: feedUrl };
}
