/** 中壢區公所 adapter. */

import type { FengbroNewsSiteConfig } from "@/lib/fengbroNewsSites";
import { fetchText } from "../fetch";
import { stripTags, titleMatches } from "../html";
import type { FengbroNewsSearchOptions } from "../options";
import { isSearchAborted } from "../options";
import type { NewsArticle, SiteSearchResult } from "../types";
import { absoluteUrl, canonicalizeUrl } from "../url";

/** 中壢區公所 — paginated News.aspx list, filter by title */
export async function searchTycgZhongli(
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

  const baseList = "https://www.zhongli.tycg.gov.tw/News.aspx?n=5605&sms=10728";
  const articles: NewsArticle[] = [];
  const seen = new Set<string>();
  let lastError = "";
  let pagesScanned = 0;
  const maxPages = 12;

  for (let page = 1; page <= maxPages; page++) {
    if (isSearchAborted(options?.signal)) {
      lastError = "搜尋已取消";
      break;
    }
    const listUrl = `${baseList}&page=${page}&PageSize=20`;
    const { ok, status, text, error } = await fetchText(listUrl, { signal: options?.signal });
    pagesScanned += 1;
    if (!ok) {
      lastError = error || `HTTP ${status} on page ${page}`;
      break;
    }

    const re = /href="(News_Content\.aspx\?[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    let pageHits = 0;
    while ((m = re.exec(text))) {
      const title = stripTags(m[2]);
      if (!title) continue;
      pageHits += 1;
      if (!titleMatches(title, query)) continue;
      let href = m[1];
      if (!/[?&]sms=/.test(href) && /[?&]n=5605/.test(href)) {
        href = href.includes("?") ? `${href}&sms=10728` : `${href}?sms=10728`;
      }
      const url = canonicalizeUrl(absoluteUrl("https://www.zhongli.tycg.gov.tw/", href));
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

    if (pageHits === 0) break;
    if (articles.length > 0 && page >= 10) break;
  }

  return {
    siteId: site.id,
    siteName: site.name,
    domain: site.domain,
    articles,
    error: articles.length === 0 && lastError ? lastError : undefined,
    source: `${baseList} (scanned ${pagesScanned} pages)`,
  };
}
