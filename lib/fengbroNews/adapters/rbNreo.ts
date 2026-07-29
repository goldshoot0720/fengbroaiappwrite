/** 鐵道局北部工程分局 adapter. */

import type { FengbroNewsSiteConfig } from "@/lib/fengbroNewsSites";
import { fetchViaJina } from "../fetch";
import { normalizeSpace, titleMatches } from "../html";
import type { FengbroNewsSearchOptions } from "../options";
import { isSearchAborted } from "../options";
import type { NewsArticle, SiteSearchResult } from "../types";
import { canonicalizeUrl } from "../url";

/** 鐵道局北部工程分局 — Incapsula blocked; use jina reader on news list */
export async function searchRbNreo(
  site: FengbroNewsSiteConfig,
  query: string,
  options?: FengbroNewsSearchOptions
): Promise<SiteSearchResult> {
  if (isSearchAborted(options?.signal)) {
    return {
      siteId: site.id,
      siteName: site.name,
      domain: site.domain,
      articles: [],
      error: "搜尋已取消",
      source: site.homeUrl,
    };
  }

  const listUrl = "https://www.rb.gov.tw/zh-TW/NREO/NREO_13/NREO_30/NREO_31/?page=1";
  const { ok, status, text } = await fetchViaJina(listUrl, { signal: options?.signal });
  if (!ok) {
    return {
      siteId: site.id,
      siteName: site.name,
      domain: site.domain,
      articles: [],
      error: status ? `HTTP ${status} (via reader)` : "已取消或逾時 (via reader)",
      source: listUrl,
    };
  }

  const articles: NewsArticle[] = [];
  const seen = new Set<string>();
  const re =
    /\[([^\]]+)\]\((https?:\/\/(?:www\.)?rb\.gov\.tw\/zh-TW\/NREO\/NREO_13\/NREO_30\/NREO_31\/[^)\s]+)\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const title = normalizeSpace(m[1]);
    const url = canonicalizeUrl(m[2]);
    if (!titleMatches(title, query)) continue;
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
