/** 桃園市政府交通局 adapter. */

import type { FengbroNewsSiteConfig } from "@/lib/fengbroNewsSites";
import { fetchText } from "../fetch";
import { stripTags, titleMatches } from "../html";
import type { NewsArticle, SiteSearchResult } from "../types";
import { absoluteUrl, canonicalizeUrl } from "../url";

/** 桃園市政府交通局 — list.aspx?key= */
export async function searchTycgTraffic(site: FengbroNewsSiteConfig, query: string): Promise<SiteSearchResult> {
  const key = encodeURIComponent(query);
  const listUrl = `https://traffic.tycg.gov.tw/businessd/post/list.aspx?key=${key}&uid=0&cid=0&con=1`;
  const { ok, status, text } = await fetchText(listUrl);
  if (!ok) {
    return {
      siteId: site.id,
      siteName: site.name,
      domain: site.domain,
      articles: [],
      error: `HTTP ${status}`,
      source: listUrl,
    };
  }

  const articles: NewsArticle[] = [];
  const seen = new Set<string>();
  // e.g. href="upt.aspx?p0=106052&...">CJ17 標...中新地下道...</a>
  const re = /href="((?:upt|plus)\.aspx\?[^"]*p0=\d+[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const title = stripTags(m[2]);
    if (!title || !titleMatches(title, query)) continue;
    const url = canonicalizeUrl(absoluteUrl("https://traffic.tycg.gov.tw/businessd/post/", m[1]));
    if (seen.has(url)) continue;
    seen.add(url);
    articles.push({
      title,
      url,
      siteId: site.id,
      siteName: site.name,
      domain: site.domain,
    });
  }

  return {
    siteId: site.id,
    siteName: site.name,
    domain: site.domain,
    articles,
    source: listUrl,
  };
}

