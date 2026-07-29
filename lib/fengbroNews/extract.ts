/** Article extraction from list/search HTML for Fengbro News. */

import { normalizeDomain } from "@/lib/fengbroNewsSites";
import type { FengbroNewsSiteConfig } from "@/lib/fengbroNewsSites";
import {
  extractDateFromHtmlContext,
  inferArticleDate,
  toIsoDate,
} from "./dates";
import {
  isJunkNewsTitle,
  normalizeSpace,
  stripNoiseHtml,
  stripTags,
  titleMatches,
} from "./html";
import type { NewsArticle } from "./types";
import {
  absoluteUrl,
  canonicalizeUrl,
  hostMatchesDomain,
  isJunkNewsUrl,
  isLikelyArticleUrl,
} from "./url";

/** Slice HTML around a match so list-card dates (LTN time span, etc.) can be parsed. */
export function sliceHtmlContext(html: string, matchIndex: number, matchLength: number, radius = 420): string {
  const start = Math.max(0, matchIndex - radius);
  const end = Math.min(html.length, matchIndex + matchLength + radius);
  return html.slice(start, end);
}

export function buildArticleFromMatch(
  site: FengbroNewsSiteConfig,
  title: string,
  url: string,
  html: string,
  matchIndex: number,
  matchLength: number
): NewsArticle {
  const htmlContext = sliceHtmlContext(html, matchIndex, matchLength);
  const fromCtx = extractDateFromHtmlContext(htmlContext);
  const article: NewsArticle & { htmlContext?: string } = {
    title: title.slice(0, 160),
    url,
    siteId: site.id,
    siteName: site.name,
    domain: site.domain,
    htmlContext,
  };
  // Prefer context date for publishedAt so age filter + sort work even without URL date
  const date = inferArticleDate(article);
  if (date) {
    article.publishedAt = toIsoDate(date);
  } else if (fromCtx) {
    article.publishedAt = toIsoDate(fromCtx);
  }
  // Do not expose raw HTML in API responses
  delete article.htmlContext;
  return article;
}

export function extractArticlesFromText(
  text: string,
  baseUrl: string,
  site: FengbroNewsSiteConfig,
  query: string,
  seen: Set<string>
): NewsArticle[] {
  const articles: NewsArticle[] = [];
  const domain = normalizeDomain(site.domain);
  const cleaned = stripNoiseHtml(text);

  // HTML anchors (href before text only — avoid loose broken tags swallowing scripts)
  const htmlRe = /<a\b[^>]*\bhref\s*=\s*["'](https?:\/\/[^"']+|\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = htmlRe.exec(cleaned))) {
    const href = m[1] || "";
    const rawTitle = m[2] || "";
    if (!href || href.startsWith("#") || href.toLowerCase().startsWith("javascript:")) continue;
    // Skip anchors whose body still looks like nested markup-heavy chrome
    if (/<script|<style|googletag|prebid/i.test(rawTitle)) continue;

    const title = stripTags(rawTitle);
    if (!title || !titleMatches(title, query) || isJunkNewsTitle(title)) continue;

    const url = canonicalizeUrl(absoluteUrl(baseUrl, href));
    if (!hostMatchesDomain(url, domain)) continue;
    if (!isLikelyArticleUrl(url, domain)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    articles.push(buildArticleFromMatch(site, title, url, cleaned, m.index, m[0].length));
  }

  // PTT list rows: <div class="title"><a href="...">title</a>
  if (domain.includes("ptt.cc")) {
    const pttRe = /class="title"[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    while ((m = pttRe.exec(cleaned))) {
      const title = stripTags(m[2]);
      if (!title || !titleMatches(title, query) || isJunkNewsTitle(title)) continue;
      const url = canonicalizeUrl(absoluteUrl(baseUrl, m[1]));
      if (!isLikelyArticleUrl(url, domain)) continue;
      if (seen.has(url)) continue;
      seen.add(url);
      articles.push(buildArticleFromMatch(site, title, url, cleaned, m.index, m[0].length));
    }
  }

  // UDN story links (main site + subdomains like sdgs.udn.com)
  if (domain.includes("udn.com")) {
    const udnRe =
      /href="((?:https?:\/\/(?:[\w-]+\.)?udn\.com)?[^"]*\/(?:news\/)?story\/[^"]+)"[^>]*(?:title="([^"]*)")?[^>]*>([\s\S]*?)<\/a>/gi;
    while ((m = udnRe.exec(cleaned))) {
      const title = stripTags(m[2] || m[3] || "");
      if (!title || !titleMatches(title, query) || isJunkNewsTitle(title)) continue;
      const url = canonicalizeUrl(absoluteUrl(baseUrl, m[1]));
      if (isJunkNewsUrl(url)) continue;
      if (seen.has(url)) continue;
      seen.add(url);
      articles.push(buildArticleFromMatch(site, title, url, cleaned, m.index, m[0].length));
    }
  }

  // Markdown links from reader. Allow one nested [] level so PTT titles like
  // [[新聞] 鐵路地下化…](https://www.ptt.cc/bbs/Railway/M.xxx.A.xxx.html) match.
  const mdRe = /\[((?:\[[^\]]*\]|[^\[\]]){4,160})\]\((https?:\/\/[^)\s]+)\)/gi;
  while ((m = mdRe.exec(cleaned))) {
    const title = normalizeSpace(m[1]);
    if (!title || !titleMatches(title, query) || isJunkNewsTitle(title)) continue;
    const url = canonicalizeUrl(m[2]);
    if (!hostMatchesDomain(url, domain)) continue;
    if (!isLikelyArticleUrl(url, domain)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    articles.push(buildArticleFromMatch(site, title, url, cleaned, m.index, m[0].length));
  }

  // PTT posts in plain / reader text even without perfect markdown nesting
  if (domain.includes("ptt.cc")) {
    const pttMd =
      /\[([^\n\]]{0,40}\]?[^\n\]]{4,140})\]\((https?:\/\/www\.ptt\.cc\/bbs\/[^/]+\/M\.\d{10}\.A\.[A-Za-z0-9]+\.html)\)/gi;
    while ((m = pttMd.exec(cleaned))) {
      const title = normalizeSpace(m[1].replace(/^\[/, ""));
      if (!title || !titleMatches(title, query) || isJunkNewsTitle(title)) continue;
      const url = canonicalizeUrl(m[2]);
      if (seen.has(url)) continue;
      seen.add(url);
      articles.push(buildArticleFromMatch(site, title, url, cleaned, m.index, m[0].length));
    }
  }

  return articles;
}

