/** Date parsing and max-age filtering for Fengbro News. */

import { normalizeDomain } from "@/lib/fengbroNewsSites";
import { MAX_NEWS_AGE_MS } from "./constants";
import { isJunkNewsTitle, normalizeSpace } from "./html";
import type { NewsArticle } from "./types";
import { isJunkNewsUrl } from "./url";

export function getNewsCutoffMs(now = Date.now()) {
  return now - MAX_NEWS_AGE_MS;
}

export function toIsoDate(date: Date | null | undefined): string | undefined {
  if (!date || Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

/** Parse ROC calendar like 115/05/05 or 115-5-5 → Gregorian Date (local noon). */
export function parseRocDate(year: number, month: number, day: number): Date | null {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // ROC year 1 = 1912
  const gYear = year + 1911;
  if (gYear < 1990 || gYear > 2100) return null;
  const d = new Date(gYear, month - 1, day, 12, 0, 0);
  if (d.getFullYear() !== gYear || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

export function parseFlexibleDate(raw: string): Date | null {
  const text = normalizeSpace(raw);
  if (!text) return null;

  // ISO / RFC
  const iso = Date.parse(text);
  if (Number.isFinite(iso) && text.length >= 8) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d;
  }

  // Unix seconds in pure digits (10–11 digits)
  if (/^\d{10,11}$/.test(text)) {
    const sec = Number(text);
    if (sec > 1_000_000_000 && sec < 4_000_000_000) return new Date(sec * 1000);
  }

  // YYYYMMDD
  const ymd = text.match(/\b(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\b/);
  if (ymd) {
    const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]), 12, 0, 0);
    if (!Number.isNaN(d.getTime())) return d;
  }

  // YYYY-MM-DD / YYYY/MM/DD
  const ymd2 = text.match(/\b(20\d{2})[./\-年](0?[1-9]|1[0-2])[./\-月](0?[1-9]|[12]\d|3[01])日?\b/);
  if (ymd2) {
    const d = new Date(Number(ymd2[1]), Number(ymd2[2]) - 1, Number(ymd2[3]), 12, 0, 0);
    if (!Number.isNaN(d.getTime())) return d;
  }

  // ROC: 115/05/05 or 115年5月5日
  const roc =
    text.match(/\b([1-9]\d{2})[./\-年](0?[1-9]|1[0-2])[./\-月](0?[1-9]|[12]\d|3[01])日?\b/) ||
    text.match(/\b([1-9]\d{2})\/(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\b/);
  if (roc) {
    const d = parseRocDate(Number(roc[1]), Number(roc[2]), Number(roc[3]));
    if (d) return d;
  }

  return null;
}

/** Pull a date from nearby HTML (list cards often put date next to the link). */
export function extractDateFromHtmlContext(context: string): Date | null {
  if (!context) return null;

  // LTN: <span class="time">2019/08/18</span>
  const timeSpan =
    context.match(/class=["'][^"']*time[^"']*["'][^>]*>\s*(20\d{2}[\/\-.]\d{1,2}[\/\-.]\d{1,2})/i) ||
    context.match(/<(?:span|time|div|p)[^>]*>\s*(20\d{2}[\/\-.]\d{1,2}[\/\-.]\d{1,2})\s*</i);
  if (timeSpan?.[1]) {
    const d = parseFlexibleDate(timeSpan[1]);
    if (d) return d;
  }

  // datetime / content meta fragments
  const attrDate =
    context.match(/datetime=["']([^"']+)["']/i) ||
    context.match(/content=["'](20\d{2}-\d{2}-\d{2}[^"']*)["']/i) ||
    context.match(/article:published_time["']\s+content=["']([^"']+)["']/i);
  if (attrDate?.[1]) {
    const d = parseFlexibleDate(attrDate[1]);
    if (d) return d;
  }

  // LTN CDN image path: /Upload/news/250/2019/08/18/224.jpg
  const imgDate = context.match(/\/(20\d{2})\/(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\//);
  if (imgDate) {
    const d = new Date(Number(imgDate[1]), Number(imgDate[2]) - 1, Number(imgDate[3]), 12, 0, 0);
    if (!Number.isNaN(d.getTime())) return d;
  }

  // First clear calendar date in window
  const anyDate = context.match(/\b(20\d{2})[\/\-.](0?[1-9]|1[0-2])[\/\-.](0?[1-9]|[12]\d|3[01])\b/);
  if (anyDate) {
    const d = parseFlexibleDate(anyDate[0]);
    if (d) return d;
  }

  return null;
}

/** Infer article date from publishedAt, URL patterns, title, or HTML context. */
export function inferArticleDate(
  article: Pick<NewsArticle, "publishedAt" | "url" | "title"> & { htmlContext?: string }
): Date | null {
  if (article.publishedAt) {
    const fromPub = parseFlexibleDate(article.publishedAt);
    if (fromPub) return fromPub;
  }

  if (article.htmlContext) {
    const fromCtx = extractDateFromHtmlContext(article.htmlContext);
    if (fromCtx) return fromCtx;
  }

  const url = article.url || "";
  // PTT: /M.<unix>.A.xxx.html
  const ptt = url.match(/\/M\.(\d{10})\.A\./i);
  if (ptt) {
    const d = new Date(Number(ptt[1]) * 1000);
    if (!Number.isNaN(d.getTime())) return d;
  }

  // rb.gov.tw / news paths: 20260420_151005
  const pathYmd = url.match(/\/(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[_/]/);
  if (pathYmd) {
    const d = new Date(Number(pathYmd[1]), Number(pathYmd[2]) - 1, Number(pathYmd[3]), 12, 0, 0);
    if (!Number.isNaN(d.getTime())) return d;
  }

  // Common news URL segments: /2024/05/05/ or 2024-05-05
  const urlDate = url.match(/\/(20\d{2})[/-](0[1-9]|1[0-2])[/-](0[1-9]|[12]\d|3[01])(?:\/|$)/);
  if (urlDate) {
    const d = new Date(Number(urlDate[1]), Number(urlDate[2]) - 1, Number(urlDate[3]), 12, 0, 0);
    if (!Number.isNaN(d.getTime())) return d;
  }

  // Title: ROC or Gregorian leading date
  if (article.title) {
    const fromTitle = parseFlexibleDate(article.title.slice(0, 40));
    if (fromTitle) return fromTitle;
    // 115/05/05-115/07/22...
    const range = article.title.match(/^([1-9]\d{2}\/\d{1,2}\/\d{1,2})/);
    if (range) {
      const d = parseFlexibleDate(range[1]);
      if (d) return d;
    }
  }

  return null;
}

/**
 * Keep articles within the last MAX_NEWS_AGE_YEARS.
 * - Dated & too old → drop
 * - Dated & OK → keep (and fill publishedAt)
 * - Undated on major news sites → drop (avoid leaking multi-year-old hits like LTN 2019)
 * - Undated elsewhere → keep (gov lists often lack dates)
 */
/** Hosts that must have a parseable date (otherwise drop — avoid multi-year-old leaks). */
const REQUIRE_DATE_HOSTS = [
  "ltn.com.tw",
  "udn.com",
  "chinatimes.com",
  "leho.com.tw",
  "bella.tw",
  "hakkanews.tw",
  "mygo.com",
  "businesstoday.com.tw",
  "yahoo.com",
  "homeplus.net.tw",
  "annewsmedia.com",
  "housefun.com.tw",
  "myhousing.com.tw",
  "leju.com.tw",
  "ctee.com.tw",
  "tyenews.com",
  "thehubnews.net",
  "storm.mg",
  "youtube.com",
  "ptt.cc",
] as const;

function hostRequiresDate(host: string): boolean {
  return REQUIRE_DATE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

export function filterArticlesByMaxAge(articles: NewsArticle[], now = Date.now()): NewsArticle[] {
  const cutoff = getNewsCutoffMs(now);
  const kept: NewsArticle[] = [];
  for (const article of articles) {
    if (isJunkNewsTitle(article.title) || isJunkNewsUrl(article.url)) continue;
    const date = inferArticleDate(article);
    if (date) {
      if (date.getTime() < cutoff) continue;
      kept.push({
        ...article,
        publishedAt: article.publishedAt || toIsoDate(date),
      });
      continue;
    }

    const host = normalizeDomain(article.domain || article.url);
    if (hostRequiresDate(host)) continue; // no verifiable date → exclude for media/PTT/YouTube
    kept.push(article);
  }
  return kept;
}

