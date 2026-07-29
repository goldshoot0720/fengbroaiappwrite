/** 中壢區公所 adapter. */

import type { FengbroNewsSiteConfig } from "@/lib/fengbroNewsSites";
import { fetchText } from "../fetch";
import { stripTags, titleMatches } from "../html";
import type { NewsArticle, SiteSearchResult } from "../types";
import { absoluteUrl, canonicalizeUrl } from "../url";

/** 中壢區公所 — paginated News.aspx list, filter by title */
export async function searchTycgZhongli(site: FengbroNewsSiteConfig, query: string): Promise<SiteSearchResult> {
  const baseList = "https://www.zhongli.tycg.gov.tw/News.aspx?n=5605&sms=10728";
  const articles: NewsArticle[] = [];
  const seen = new Set<string>();
  let lastError = "";
  let pagesScanned = 0;
  const maxPages = 12;

  for (let page = 1; page <= maxPages; page++) {
    const listUrl = `${baseList}&page=${page}&PageSize=20`;
    const { ok, status, text } = await fetchText(listUrl);
    pagesScanned += 1;
    if (!ok) {
      lastError = `HTTP ${status} on page ${page}`;
      break;
    }

    // <a href="News_Content.aspx?n=5605&s=1616891" ...>115/05/05-115/07/22中新地下道...</a>
    // sometimes also includes sms=
    const re = /href="(News_Content\.aspx\?[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    let pageHits = 0;
    while ((m = re.exec(text))) {
      const title = stripTags(m[2]);
      if (!title) continue;
      pageHits += 1;
      if (!titleMatches(title, query)) continue;
      let href = m[1];
      // Ensure sms is present for stable deep links when missing
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

    // No more list rows
    if (pageHits === 0) break;
    // Early exit if we already found matches and later pages rarely needed for demo
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

