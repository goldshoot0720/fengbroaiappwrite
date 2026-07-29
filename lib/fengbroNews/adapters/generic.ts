/** Generic keyword/list URL adapter + site-specific candidate URLs. */

import { normalizeDomain } from "@/lib/fengbroNewsSites";
import type { FengbroNewsSiteConfig } from "@/lib/fengbroNewsSites";
import { MAX_LIST_URL_TRIES } from "../constants";
import { extractArticlesFromText } from "../extract";
import { fetchPageText } from "../fetch";
import { prefersGoogleNewsFirst, searchGoogleNewsRss } from "../googleNews";
import type { FengbroNewsSearchOptions } from "../options";
import { isSearchAborted } from "../options";
import type { NewsArticle, SiteSearchResult } from "../types";

type CandidateCtx = {
  origin: string;
  domain: string;
  enc: string;
  homeUrl: string;
  siteDomain: string;
};

/** Prefer high-signal search/list URLs first (unshift order matters before dedupe cap). */
function appendSiteSpecificCandidates(candidates: string[], ctx: CandidateCtx) {
  const { origin, domain, enc, homeUrl, siteDomain } = ctx;

  if (domain.includes("ptt.cc")) {
    const board = homeUrl.match(/\/bbs\/([^/]+)/i)?.[1] || "Railway";
    candidates.unshift(`https://www.ptt.cc/bbs/${board}/search?q=${enc}`);
  }
  if (domain.includes("udn.com")) {
    candidates.unshift(`https://udn.com/search/word/2/${enc}`);
  }
  if (domain.includes("ltn.com.tw")) {
    candidates.unshift(`https://search.ltn.com.tw/list?keyword=${enc}`);
  }
  if (domain.includes("leho.com.tw")) {
    candidates.unshift(`https://leho.com.tw/?s=${enc}`);
  }
  if (domain.includes("chinatimes.com")) {
    candidates.push(`${origin}/realtimenews/?chdtv`);
  }
  // Only root 桃園市政府 portal (not dorts / traffic / zhongli subdomains)
  if (domain === "tycg.gov.tw") {
    candidates.unshift(`https://www.tycg.gov.tw/Advanced_Search.aspx?q=${enc}`);
    candidates.push(`https://www.tycg.gov.tw/News.aspx?n=13&sms=7887`);
  }
  if (domain === "dorts.tycg.gov.tw") {
    candidates.unshift(`${origin}/News.aspx`);
    candidates.push(`${origin}/News_Content.aspx`);
  }
  if (domain.includes("bella.tw")) {
    candidates.unshift(`https://www.bella.tw/search?q=${enc}`);
    candidates.push(
      `https://www.bella.tw/lifestyle/all`,
      `https://www.bella.tw/people/all`,
      `https://www.bella.tw/fashion/all`
    );
  }
  if (domain.includes("ey.gov.tw")) {
    candidates.push(`${origin}/Page/4EC20EEEEEAF363C`, `${origin}/Page/5A359FF2BC84355B`);
  }
  if (domain.includes("hakkanews.tw")) {
    candidates.unshift(`https://hakkanews.tw/?s=${enc}`);
  }
  if (domain.includes("mygo.com")) {
    candidates.unshift(`https://www.mygo.com/?s=${enc}`, `https://www.mygo.com/search?q=${enc}`);
  }
  if (domain.includes("businesstoday.com.tw")) {
    candidates.unshift(
      `https://www.businesstoday.com.tw/search?q=${enc}`,
      `https://www.businesstoday.com.tw/search/result?keywords=${enc}`
    );
  }
  if (domain.includes("yahoo.com")) {
    candidates.unshift(`https://tw.news.yahoo.com/search?p=${enc}`);
  }
  if (domain.includes("homeplus.net.tw")) {
    candidates.unshift(`https://news.homeplus.net.tw/?s=${enc}`);
  }
  if (domain.includes("tycc.gov.tw")) {
    candidates.unshift(`${origin}/home.jsp?id=45&q=${enc}`, `${origin}/home.jsp?id=14`);
  }
  if (domain.includes("motc.gov.tw")) {
    candidates.unshift(
      `${origin}/ch/home.jsp?id=14&parentpath=0,2`,
      `${origin}/ch/home.jsp?id=6&parentpath=0,2`
    );
  }
  if (domain.includes("annewsmedia.com")) {
    candidates.unshift(`https://annewsmedia.com/?s=${enc}`);
  }
  if (domain.includes("housefun.com.tw")) {
    candidates.unshift(
      `https://news.housefun.com.tw/search?q=${enc}`,
      `https://news.housefun.com.tw/search/${enc}`
    );
  }
  if (domain.includes("myhousing.com.tw")) {
    candidates.unshift(`https://www.myhousing.com.tw/?s=${enc}`, `https://www.myhousing.com.tw/search?q=${enc}`);
  }
  if (domain.includes("leju.com.tw")) {
    candidates.unshift(`https://www.leju.com.tw/?s=${enc}`, `https://www.leju.com.tw/search?q=${enc}`);
  }
  if (domain.includes("ctee.com.tw")) {
    candidates.unshift(`https://www.ctee.com.tw/search/${enc}`, `https://www.ctee.com.tw/livenews`);
  }
  if (domain.includes("tyenews.com")) {
    candidates.unshift(`https://tyenews.com/?s=${enc}`);
  }
  if (domain.includes("thehubnews.net")) {
    candidates.unshift(`https://www.thehubnews.net/?s=${enc}`);
  }
  if (domain.includes("storm.mg")) {
    candidates.unshift(
      `https://new7.storm.mg/?s=${enc}`,
      `https://www.storm.mg/search?q=${enc}`,
      `${origin}/?s=${enc}`
    );
  }
  if (domain.includes("mobile01.com")) {
    candidates.unshift(`https://www.mobile01.com/googlesearch.php?q=${enc}`);
  }

  candidates.push(
    `${origin}/News.aspx`,
    `${origin}/news`,
    `${origin}/News`,
    `https://${siteDomain}/`
  );
}

function buildGenericCandidateUrls(site: FengbroNewsSiteConfig, query: string): string[] {
  const candidates: string[] = [];
  const template = site.searchUrlTemplate?.trim();
  if (template) {
    candidates.push(
      template.includes("{q}") ? template.replaceAll("{q}", encodeURIComponent(query)) : template
    );
  }
  if (site.homeUrl) candidates.push(site.homeUrl);

  try {
    const origin = new URL(site.homeUrl || `https://${site.domain}`).origin;
    appendSiteSpecificCandidates(candidates, {
      origin,
      domain: normalizeDomain(site.domain),
      enc: encodeURIComponent(query),
      homeUrl: site.homeUrl,
      siteDomain: site.domain,
    });
  } catch {
    candidates.push(`https://${site.domain}/`);
  }

  // Prefer high-signal URLs first; cap tries so multi-site search stays responsive
  return [...new Set(candidates.filter(Boolean))].slice(0, MAX_LIST_URL_TRIES);
}

/**
 * Generic: prefer searchUrlTemplate with {q}; otherwise scan homeUrl / list page
 * and filter anchors whose title contains the keyword.
 * Bot-blocked hosts try Google News RSS first.
 */
export async function searchGenericKeywordUrl(
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

  const articles: NewsArticle[] = [];
  const seen = new Set<string>();
  const sources: string[] = [];
  let lastError = "";
  let usedGoogleFirst = false;

  // Known bot-walled publishers: RSS first, skip slow direct scrape when hits exist
  if (prefersGoogleNewsFirst(site.domain)) {
    usedGoogleFirst = true;
    const rss = await searchGoogleNewsRss(site, query, seen, options);
    if (rss.articles.length) {
      return {
        siteId: site.id,
        siteName: site.name,
        domain: site.domain,
        articles: rss.articles,
        source: rss.source,
      };
    }
    if (rss.error) lastError = rss.error;
  }

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

  const uniqueUrls = buildGenericCandidateUrls(site, query);
  for (let i = 0; i < uniqueUrls.length; i++) {
    if (isSearchAborted(options?.signal)) {
      lastError = "搜尋已取消";
      break;
    }
    const listUrl = uniqueUrls[i];
    try {
      // Only first URL may use jina (slow); rest are direct + Google News fallback
      const page = await fetchPageText(listUrl, {
        allowJina: i === 0,
        signal: options?.signal,
      });
      if (page.error && !page.text) {
        lastError = page.error;
        continue;
      }
      sources.push(page.source);
      const found = extractArticlesFromText(page.text, listUrl, site, query, seen);
      articles.push(...found);
      if (articles.length >= 6) break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "抓取失敗";
    }
  }

  // Fallback: Google News when direct empty (skip if already tried first)
  if (articles.length === 0 && !usedGoogleFirst) {
    const rss = await searchGoogleNewsRss(site, query, seen, options);
    if (rss.articles.length) {
      return {
        siteId: site.id,
        siteName: site.name,
        domain: site.domain,
        articles: rss.articles,
        source: rss.source,
      };
    }
    if (rss.error) lastError = lastError || rss.error;
  }

  return {
    siteId: site.id,
    siteName: site.name,
    domain: site.domain,
    articles,
    error:
      articles.length === 0
        ? sources.length > 0
          ? "此來源未找到標題符合的文章（近三年內）"
          : lastError || "此來源未找到標題符合的文章（近三年內）"
        : undefined,
    source: sources[0] || site.homeUrl,
  };
}

