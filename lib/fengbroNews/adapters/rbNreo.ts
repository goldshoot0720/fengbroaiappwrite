/** 鐵道局北部工程分局 adapter. */

import type { FengbroNewsSiteConfig } from "@/lib/fengbroNewsSites";
import { fetchViaJina } from "../fetch";
import { normalizeSpace, titleMatches } from "../html";
import type { NewsArticle, SiteSearchResult } from "../types";
import { canonicalizeUrl } from "../url";

/** 鐵道局北部工程分局 — Incapsula blocked; use jina reader on news list */
export async function searchRbNreo(site: FengbroNewsSiteConfig, query: string): Promise<SiteSearchResult> {
  const listUrl = "https://www.rb.gov.tw/zh-TW/NREO/NREO_13/NREO_30/NREO_31/?page=1";
  const { ok, status, text } = await fetchViaJina(listUrl);
  if (!ok) {
    return {
      siteId: site.id,
      siteName: site.name,
      domain: site.domain,
      articles: [],
      error: `HTTP ${status} (via reader)`,
      source: listUrl,
    };
  }

  const articles: NewsArticle[] = [];
  const seen = new Set<string>();
  // Markdown links: [title](https://www.rb.gov.tw/.../20260420_151005/)
  const re =
    /\[([^\]]+)\]\((https?:\/\/(?:www\.)?rb\.gov\.tw\/zh-TW\/NREO\/NREO_13\/NREO_30\/NREO_31\/[^)\s]+)\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const title = normalizeSpace(m[1]);
    const url = canonicalizeUrl(m[2]);
    if (!titleMatches(title, query)) continue;
    // Skip pure section nav links without article path segment
    if (!/\/NREO_31\/(?:\d{8}_\d+|newsinfo_\d+)/i.test(url)) continue;
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

