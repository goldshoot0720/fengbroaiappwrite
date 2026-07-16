import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_FENGBRO_NEWS_SITES,
  normalizeDomain,
  normalizeFengbroNewsSites,
  type FengbroNewsSiteConfig,
} from "@/lib/fengbroNewsSites";

export const dynamic = "force-dynamic";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const JINA_PREFIX = "https://r.jina.ai/https://";

/** Only keep news published within this many years. */
const MAX_NEWS_AGE_YEARS = 3;
const MAX_NEWS_AGE_MS = MAX_NEWS_AGE_YEARS * 365.25 * 24 * 60 * 60 * 1000;

type NewsArticle = {
  title: string;
  url: string;
  siteId: string;
  siteName: string;
  domain: string;
  publishedAt?: string;
  snippet?: string;
};

type SiteSearchResult = {
  siteId: string;
  siteName: string;
  domain: string;
  articles: NewsArticle[];
  error?: string;
  source?: string;
};

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;/g, " ")
    .trim();
}

function normalizeSpace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripTags(value: string) {
  return normalizeSpace(decodeHtml(value.replace(/<[^>]+>/g, " ")));
}

function titleMatches(title: string, query: string) {
  const t = normalizeSpace(title).toLowerCase();
  const q = normalizeSpace(query).toLowerCase();
  if (!q) return true;
  // Require all space-separated tokens to appear in title
  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.every((token) => t.includes(token));
}

function getNewsCutoffMs(now = Date.now()) {
  return now - MAX_NEWS_AGE_MS;
}

function toIsoDate(date: Date | null | undefined): string | undefined {
  if (!date || Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

/** Parse ROC calendar like 115/05/05 or 115-5-5 → Gregorian Date (local noon). */
function parseRocDate(year: number, month: number, day: number): Date | null {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // ROC year 1 = 1912
  const gYear = year + 1911;
  if (gYear < 1990 || gYear > 2100) return null;
  const d = new Date(gYear, month - 1, day, 12, 0, 0);
  if (d.getFullYear() !== gYear || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

function parseFlexibleDate(raw: string): Date | null {
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

/** Infer article date from publishedAt, URL patterns, or title. */
function inferArticleDate(article: Pick<NewsArticle, "publishedAt" | "url" | "title">): Date | null {
  if (article.publishedAt) {
    const fromPub = parseFlexibleDate(article.publishedAt);
    if (fromPub) return fromPub;
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
 * - Undated → keep (cannot prove age; many list scrapers lack dates)
 */
function filterArticlesByMaxAge(articles: NewsArticle[], now = Date.now()): NewsArticle[] {
  const cutoff = getNewsCutoffMs(now);
  const kept: NewsArticle[] = [];
  for (const article of articles) {
    const date = inferArticleDate(article);
    if (date) {
      if (date.getTime() < cutoff) continue;
      kept.push({
        ...article,
        publishedAt: article.publishedAt || toIsoDate(date),
      });
    } else {
      kept.push(article);
    }
  }
  return kept;
}

function absoluteUrl(base: string, href: string) {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function canonicalizeUrl(url: string) {
  try {
    const u = new URL(url);
    u.hash = "";
    // Prefer stable article id (+ con) for traffic bureau deep links
    if (u.hostname.includes("traffic.tycg.gov.tw")) {
      const p0 = u.searchParams.get("p0");
      const con = u.searchParams.get("con");
      u.search = "";
      if (p0) u.searchParams.set("p0", p0);
      if (con) u.searchParams.set("con", con);
    }
    if (u.hostname.includes("zhongli.tycg.gov.tw")) {
      const n = u.searchParams.get("n");
      const sms = u.searchParams.get("sms");
      const s = u.searchParams.get("s");
      if (u.pathname.toLowerCase().includes("news_content") && s) {
        u.search = "";
        if (n) u.searchParams.set("n", n);
        if (sms) u.searchParams.set("sms", sms);
        u.searchParams.set("s", s);
      }
    }
    // Normalize trailing slash for rb article paths
    if (u.hostname.includes("rb.gov.tw") && /\/\d{8}_\d+\/?$/.test(u.pathname)) {
      u.pathname = u.pathname.replace(/\/?$/, "/");
    }
    return u.toString();
  } catch {
    return url;
  }
}

async function fetchText(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; text: string; finalUrl: string }> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "user-agent": USER_AGENT,
      "accept-language": "zh-TW,zh;q=0.9,en;q=0.8",
      accept: "text/html,application/xhtml+xml,text/plain,*/*",
      ...(init?.headers || {}),
    },
    cache: "no-store",
    redirect: "follow",
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text, finalUrl: res.url };
}

async function fetchViaJina(targetHttpsUrl: string) {
  const url = targetHttpsUrl.startsWith("http")
    ? `${JINA_PREFIX}${targetHttpsUrl.replace(/^https?:\/\//i, "")}`
    : `${JINA_PREFIX}${targetHttpsUrl}`;
  return fetchText(url, {
    headers: { accept: "text/plain" },
  });
}

/** 桃園市政府交通局 — list.aspx?key= */
async function searchTycgTraffic(site: FengbroNewsSiteConfig, query: string): Promise<SiteSearchResult> {
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

/** 鐵道局北部工程分局 — Incapsula blocked; use jina reader on news list */
async function searchRbNreo(site: FengbroNewsSiteConfig, query: string): Promise<SiteSearchResult> {
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

/** 中壢區公所 — paginated News.aspx list, filter by title */
async function searchTycgZhongli(site: FengbroNewsSiteConfig, query: string): Promise<SiteSearchResult> {
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

function hostMatchesDomain(url: string, domain: string) {
  try {
    const host = normalizeDomain(new URL(url).hostname);
    const d = domain.replace(/^www\./, "");
    if (host === d || host.endsWith(`.${d}`)) return true;
    // Cross-subdomain news search hosts (search.ltn.com.tw ↔ ltn.com.tw)
    const root = d.split(".").slice(-2).join(".");
    const hostRoot = host.split(".").slice(-2).join(".");
    if (root.length > 3 && hostRoot === root) return true;
    return false;
  } catch {
    return false;
  }
}

function extractArticlesFromText(
  text: string,
  baseUrl: string,
  site: FengbroNewsSiteConfig,
  query: string,
  seen: Set<string>
): NewsArticle[] {
  const articles: NewsArticle[] = [];
  const domain = normalizeDomain(site.domain);

  // HTML anchors (href before or after text)
  const htmlRe =
    /<a\b[^>]*href="(https?:\/\/[^"]+|\/[^"]+)"[^>]*>([\s\S]*?)<\/a>|<a\b[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = htmlRe.exec(text))) {
    let href = m[1] || "";
    let rawTitle = m[2] || m[3] || "";
    if (!href) {
      const innerHref = /href="(https?:\/\/[^"]+|\/[^"]+)"/i.exec(m[0]);
      href = innerHref?.[1] || "";
    }
    if (!href) continue;
    // PTT: title is often plain text inside r-ent blocks
    const title = stripTags(rawTitle);
    if (!title || title.length < 4 || !titleMatches(title, query)) continue;
    // Skip pure navigation chrome
    if (/^(上一頁|下一頁|最新|看板|所有文章|搜尋|首頁|回目錄)$/i.test(title)) continue;
    const url = canonicalizeUrl(absoluteUrl(baseUrl, href));
    if (!hostMatchesDomain(url, domain)) continue;
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

  // PTT list rows: <div class="title"><a href="...">title</a>
  if (domain.includes("ptt.cc")) {
    const pttRe = /class="title"[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    while ((m = pttRe.exec(text))) {
      const title = stripTags(m[2]);
      if (!title || !titleMatches(title, query)) continue;
      const url = canonicalizeUrl(absoluteUrl(baseUrl, m[1]));
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
  }

  // Markdown links from reader
  const mdRe = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gi;
  while ((m = mdRe.exec(text))) {
    const title = normalizeSpace(m[1]);
    if (!title || title.length < 4 || !titleMatches(title, query)) continue;
    const url = canonicalizeUrl(m[2]);
    if (!hostMatchesDomain(url, domain)) continue;
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

  return articles;
}

async function fetchPageText(url: string): Promise<{ text: string; source: string; error?: string }> {
  const direct = await fetchText(url);
  if (
    direct.ok &&
    direct.text.length > 800 &&
    !direct.text.includes("Incapsula") &&
    !/META NAME="ROBOTS" CONTENT="NOINDEX,\s*NOFOLLOW"/i.test(direct.text)
  ) {
    return { text: direct.text, source: url };
  }

  const via = await fetchViaJina(url);
  if (!via.ok || via.text.length < 200) {
    return {
      text: "",
      source: url,
      error: `HTTP ${direct.status}${via.ok ? "" : `/${via.status}`}`,
    };
  }
  return { text: via.text, source: `${url} (via reader)` };
}

/**
 * Generic: prefer searchUrlTemplate with {q}; otherwise scan homeUrl / list page
 * and filter anchors whose title contains the keyword.
 */
async function searchGenericKeywordUrl(site: FengbroNewsSiteConfig, query: string): Promise<SiteSearchResult> {
  const candidates: string[] = [];
  const template = site.searchUrlTemplate?.trim();
  if (template) {
    candidates.push(
      template.includes("{q}") ? template.replaceAll("{q}", encodeURIComponent(query)) : template
    );
  }
  if (site.homeUrl) candidates.push(site.homeUrl);
  // Common TW gov news list patterns as soft fallbacks
  try {
    const origin = new URL(site.homeUrl || `https://${site.domain}`).origin;
    candidates.push(
      `${origin}/News.aspx`,
      `${origin}/news`,
      `${origin}/News`,
      `https://${site.domain}/`
    );
  } catch {
    candidates.push(`https://${site.domain}/`);
  }

  const uniqueUrls = [...new Set(candidates.filter(Boolean))];
  const articles: NewsArticle[] = [];
  const seen = new Set<string>();
  const sources: string[] = [];
  let lastError = "";

  for (const listUrl of uniqueUrls) {
    try {
      const page = await fetchPageText(listUrl);
      if (page.error && !page.text) {
        lastError = page.error;
        continue;
      }
      sources.push(page.source);
      const found = extractArticlesFromText(page.text, listUrl, site, query, seen);
      articles.push(...found);
      if (articles.length >= 8) break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "抓取失敗";
    }
  }

  return {
    siteId: site.id,
    siteName: site.name,
    domain: site.domain,
    articles,
    error:
      articles.length === 0
        ? lastError || "此來源未找到標題符合的文章（可設定搜尋 URL 模板含 {q} 提升命中）"
        : undefined,
    source: sources[0] || site.homeUrl,
  };
}

type YouTubeVideoHit = {
  title: string;
  url: string;
  videoId: string;
  publishedAt?: string;
};

function decodeXml(value: string) {
  return decodeHtml(
    value
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<[^>]+>/g, "")
  );
}

function pickXml(text: string, pattern: RegExp) {
  return decodeXml(pattern.exec(text)?.[1] || "");
}

function getYouTubeVideosPageUrl(homeUrl: string) {
  try {
    const url = new URL(homeUrl);
    const path = url.pathname.replace(/\/+$/, "");
    if (/\/videos$/i.test(path)) return `https://www.youtube.com${path}`;
    return `https://www.youtube.com${path}/videos`;
  } catch {
    return homeUrl;
  }
}

function resolveYouTubeChannelIdFromHtml(html: string) {
  return (
    /"externalId"\s*:\s*"(UC[\w-]+)"/.exec(html)?.[1] ||
    /"channelId"\s*:\s*"(UC[\w-]+)"/.exec(html)?.[1] ||
    /youtube\.com\/channel\/(UC[\w-]+)/.exec(html)?.[1] ||
    /<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]+)"/.exec(html)?.[1] ||
    ""
  );
}

function parseYouTubeFeedEntries(xml: string): YouTubeVideoHit[] {
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

function parseYouTubeVideosFromHtml(html: string): YouTubeVideoHit[] {
  const hits: YouTubeVideoHit[] = [];
  const seen = new Set<string>();

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

/** YouTube channel videos — match title keyword against recent uploads. */
async function searchYouTubeChannel(site: FengbroNewsSiteConfig, query: string): Promise<SiteSearchResult> {
  const videosPageUrl = getYouTubeVideosPageUrl(site.homeUrl);
  let html = "";
  let channelId = "";
  let source = videosPageUrl;

  try {
    const page = await fetchText(videosPageUrl);
    html = page.text;
    channelId = resolveYouTubeChannelIdFromHtml(html);
  } catch (error) {
    return {
      siteId: site.id,
      siteName: site.name,
      domain: site.domain,
      articles: [],
      error: error instanceof Error ? error.message : "YouTube 讀取失敗",
      source: videosPageUrl,
    };
  }

  let hits: YouTubeVideoHit[] = [];

  if (channelId) {
    try {
      const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
      const feed = await fetchText(feedUrl, {
        headers: { accept: "application/atom+xml,application/xml,text/xml,*/*" },
      });
      if (feed.ok && feed.text.includes("<entry>")) {
        hits = parseYouTubeFeedEntries(feed.text);
        source = feedUrl;
      }
    } catch {
      // fall through to HTML parse
    }
  }

  if (hits.length === 0 && html) {
    hits = parseYouTubeVideosFromHtml(html);
    source = videosPageUrl;
  }

  // Last resort: jina reader on videos page
  if (hits.length === 0) {
    try {
      const via = await fetchViaJina(videosPageUrl);
      if (via.ok) {
        const mdHits: YouTubeVideoHit[] = [];
        const re = /\[([^\]]+)\]\((https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([\w-]{11})[^)\s]*)\)/gi;
        let m: RegExpExecArray | null;
        while ((m = re.exec(via.text))) {
          mdHits.push({ title: normalizeSpace(m[1]), url: m[2], videoId: m[3] });
        }
        if (mdHits.length) {
          hits = mdHits;
          source = `${videosPageUrl} (via reader)`;
        }
      }
    } catch {
      // ignore
    }
  }

  const articles: NewsArticle[] = [];
  const seen = new Set<string>();
  for (const hit of hits) {
    if (!titleMatches(hit.title, query)) continue;
    const url = hit.url.startsWith("http") ? hit.url : `https://www.youtube.com/watch?v=${hit.videoId}`;
    if (seen.has(url)) continue;
    seen.add(url);
    articles.push({
      title: hit.title,
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
        ? "無法讀取此 YouTube 頻道影片列表"
        : articles.length === 0
          ? `頻道近作中沒有標題含「${query}」的影片`
          : undefined,
    source,
  };
}

async function searchSite(site: FengbroNewsSiteConfig, query: string): Promise<SiteSearchResult> {
  try {
    switch (site.adapter) {
      case "tycg-traffic":
        return await searchTycgTraffic(site, query);
      case "rb-nreo":
        return await searchRbNreo(site, query);
      case "tycg-zhongli":
        return await searchTycgZhongli(site, query);
      case "youtube-channel":
        return await searchYouTubeChannel(site, query);
      case "generic-keyword-url":
      default:
        // Auto-route YouTube URLs even if adapter was stored as generic
        if (/youtube\.com|youtu\.be/i.test(site.homeUrl || site.domain)) {
          return await searchYouTubeChannel(site, query);
        }
        return await searchGenericKeywordUrl(site, query);
    }
  } catch (error) {
    return {
      siteId: site.id,
      siteName: site.name,
      domain: site.domain,
      articles: [],
      error: error instanceof Error ? error.message : "搜尋失敗",
    };
  }
}

function parseSitesFromRequest(request: NextRequest, body: unknown): FengbroNewsSiteConfig[] {
  const url = new URL(request.url);
  // body.sites takes precedence
  if (body && typeof body === "object" && Array.isArray((body as { sites?: unknown }).sites)) {
    return normalizeFengbroNewsSites((body as { sites: unknown }).sites);
  }
  const sitesParam = url.searchParams.get("sites");
  if (sitesParam) {
    try {
      return normalizeFengbroNewsSites(JSON.parse(sitesParam));
    } catch {
      // comma-separated domains → match defaults
      const domains = sitesParam.split(",").map((s) => normalizeDomain(s)).filter(Boolean);
      if (domains.length) {
        const matched = DEFAULT_FENGBRO_NEWS_SITES.filter((s) =>
          domains.some((d) => s.domain.includes(d) || d.includes(s.domain))
        ).map((s) => ({ ...s, locked: true }));
        if (matched.length) return matched;
      }
    }
  }
  return DEFAULT_FENGBRO_NEWS_SITES.map((s) => ({ ...s }));
}

async function handleSearch(request: NextRequest, body: unknown = null) {
  const url = new URL(request.url);
  const bodyObj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const query = String(bodyObj.q ?? bodyObj.query ?? url.searchParams.get("q") ?? url.searchParams.get("query") ?? "").trim();

  if (!query) {
    return NextResponse.json({ error: "請提供文章標題關鍵字 q" }, { status: 400 });
  }

  const allSites = parseSitesFromRequest(request, body);
  const onlyLocked = bodyObj.onlyLocked !== false && url.searchParams.get("onlyLocked") !== "0";
  const sites = onlyLocked ? allSites.filter((s) => s.locked) : allSites;

  if (sites.length === 0) {
    return NextResponse.json(
      { error: "沒有鎖定的網站焦點。請先在「網站焦點」鎖定至少一個網站。" },
      { status: 400 }
    );
  }

  const bySiteRaw = await Promise.all(sites.map((site) => searchSite(site, query)));
  const bySite = bySiteRaw.map((siteResult) => {
    const before = siteResult.articles.length;
    const articles = filterArticlesByMaxAge(siteResult.articles);
    const dropped = before - articles.length;
    return {
      ...siteResult,
      articles,
      error:
        articles.length === 0 && before > 0
          ? `近 ${MAX_NEWS_AGE_YEARS} 年內沒有標題符合的文章（已過濾 ${dropped} 則較舊結果）`
          : siteResult.error,
    };
  });

  const results: NewsArticle[] = [];
  const seen = new Set<string>();
  for (const siteResult of bySite) {
    for (const article of siteResult.articles) {
      const key = article.url;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(article);
    }
  }

  // Prefer newer first when dates exist
  results.sort((a, b) => {
    const da = inferArticleDate(a)?.getTime() ?? 0;
    const db = inferArticleDate(b)?.getTime() ?? 0;
    return db - da;
  });

  const warnings = bySite
    .filter((s) => s.error || s.articles.length === 0)
    .map((s) =>
      s.error
        ? `${s.siteName}：${s.error}`
        : `${s.siteName}：標題含「${query}」的文章未找到`
    );

  return NextResponse.json({
    query,
    onlyLocked,
    siteCount: sites.length,
    resultCount: results.length,
    maxAgeYears: MAX_NEWS_AGE_YEARS,
    fetchedAt: new Date().toISOString(),
    results,
    bySite,
    warnings,
    exampleNote:
      query.includes("中新地下道")
        ? "範例：鎖定交通局 / 鐵道局北部工程分局 / 中壢區公所，標題含「中新地下道」"
        : undefined,
  });
}

export async function GET(request: NextRequest) {
  return handleSearch(request, null);
}

export async function POST(request: NextRequest) {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  return handleSearch(request, body);
}
