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

/** Pull a date from nearby HTML (list cards often put date next to the link). */
function extractDateFromHtmlContext(context: string): Date | null {
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
function inferArticleDate(
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
function filterArticlesByMaxAge(articles: NewsArticle[], now = Date.now()): NewsArticle[] {
  const cutoff = getNewsCutoffMs(now);
  const requireDateHosts = [
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
  ];
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
    const mustDate = requireDateHosts.some((h) => host === h || host.endsWith(`.${h}`));
    if (mustDate) continue; // no verifiable date → exclude for media/PTT/YouTube
    kept.push(article);
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

function defaultFetchHeaders(targetUrl: string): Record<string, string> {
  const headers: Record<string, string> = {
    "user-agent": USER_AGENT,
    "accept-language": "zh-TW,zh;q=0.9,en;q=0.8",
    accept: "text/html,application/xhtml+xml,application/xml,text/plain,*/*",
    "cache-control": "no-cache",
  };
  try {
    const host = new URL(targetUrl).hostname;
    if (host.includes("ptt.cc")) {
      headers.cookie = "over18=1";
      headers.referer = "https://www.ptt.cc/";
    }
    if (host.includes("chinatimes.com")) {
      headers.referer = "https://www.chinatimes.com/";
    }
    if (host.includes("udn.com")) {
      headers.referer = "https://udn.com/";
    }
    if (host.includes("leho.com.tw")) {
      headers.referer = "https://leho.com.tw/";
    }
    if (host.includes("bella.tw")) {
      headers.referer = "https://www.bella.tw/";
    }
    if (host.includes("tycg.gov.tw")) {
      headers.referer = "https://www.tycg.gov.tw/";
    }
  } catch {
    // ignore
  }
  return headers;
}

async function fetchText(
  url: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; text: string; finalUrl: string; error?: string }> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        ...defaultFetchHeaders(url),
        ...(init?.headers || {}),
      },
      cache: "no-store",
      redirect: "follow",
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text, finalUrl: res.url };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      text: "",
      finalUrl: url,
      error: error instanceof Error ? error.message : "fetch failed",
    };
  }
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

/** Strip scripts/styles/comments so ad JS (DFP/prebid) never becomes a fake title. */
function stripNoiseHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ");
}

function isJunkNewsTitle(title: string): boolean {
  const t = normalizeSpace(title);
  if (!t || t.length < 6 || t.length > 160) return true;
  // Navigation / UI chrome
  if (/^(上一頁|下一頁|最新|看板|所有文章|搜尋|首頁|回目錄|更多|看更多|分享|訂閱|登入|註冊)$/i.test(t)) {
    return true;
  }
  // Ad / tracker / DFP / prebid noise (UDN etc.)
  if (
    /DFP|prebid|googletag|gpt-ad|ads-|bidder|openx|rubicon|taboola|bridgewell|criteo|pbjs|pubads|defineSlot|sizeMapping|adUnits|clientId|eruId|stickyAds|billboard|superBanner/i.test(
      t
    )
  ) {
    return true;
  }
  // Looks like JavaScript / code, not a headline
  if (/[{};=]|function\s*\(|console\.log|var\s+\w+|const\s+\w+|=>/.test(t)) return true;
  if ((t.match(/[a-zA-Z]{3,}/g) || []).length >= 8 && !/[\u4e00-\u9fff]{4,}/.test(t)) return true;
  // Must contain some CJK or enough letters for a real title
  const cjk = (t.match(/[\u4e00-\u9fff]/g) || []).length;
  const letters = (t.match(/[A-Za-z0-9\u4e00-\u9fff]/g) || []).length;
  if (cjk < 2 && letters < 12) return true;
  if (letters / Math.max(t.length, 1) < 0.35) return true;
  return false;
}

function isJunkNewsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    const full = url.toLowerCase();
    if (u.protocol === "javascript:" || u.protocol === "data:") return true;
    if (!path || path === "/") return true;
    if (
      /\/(ads?|advert|banner|track|pixel|click|logout|login|register|search\/tagging)\b/i.test(path) ||
      /doubleclick|googlesyndication|scorecardresearch|facebook\.com\/tr|analytics/i.test(full)
    ) {
      return true;
    }
    // UDN family (udn.com / sdgs.udn.com / …): keep real story paths
    if (u.hostname.includes("udn.com")) {
      if (/\/(static|upf|css|js|img|font|ads?)\//i.test(path)) return true;
      if (/\/story\//i.test(path) && /\d{4,}/.test(path)) return false;
      if (/\/news\/breaknews\//i.test(path) && /\d/.test(path)) return false;
      if (/\/news\/paper\//i.test(path)) return false;
      // Category / channel indexes are not articles
      return true;
    }
    // leho WordPress posts
    if (u.hostname.includes("leho.com.tw")) {
      if (/\/archives\/\d+/i.test(path)) return false;
      if (/\/archives\/category\//i.test(path)) return true;
      return !/\/\d{4,}/.test(path);
    }
    // Bella 儂儂 articles: /articles/{cat}/{id}/{slug}
    if (u.hostname.includes("bella.tw")) {
      if (/\/articles\/[^/]+\/\d+\//i.test(path)) return false;
      return true;
    }
    // 桃園市政府 / 各局處 news content pages
    if (u.hostname.includes("tycg.gov.tw")) {
      if (/News_Content\.aspx/i.test(path) || /NewsPage\.aspx/i.test(path)) return false;
      if (/Advanced_Search\.aspx/i.test(path) || /\/News\.aspx$/i.test(path)) return true;
      // keep deep paths with numeric ids
      if (/\d{4,}/.test(path + u.search)) return false;
      return true;
    }
    // 行政院
    if (u.hostname.includes("ey.gov.tw")) {
      if (/\/Page\//i.test(path) && /[A-F0-9]{8,}/i.test(path)) return false;
      if (/News|news|消息|新聞/i.test(path + u.search) && /\d{3,}/.test(path + u.search)) return false;
      if (/search|Search|PageList/i.test(path)) return true;
      return !/\d{4,}/.test(path + u.search);
    }
    // 客新聞 / MyGo (often WP-like numeric or slug posts)
    if (u.hostname.includes("hakkanews.tw") || u.hostname.includes("mygo.com")) {
      if (/\/\d{4}\/\d{2}\//.test(path) || /\/archives\/\d+/i.test(path) || /\/\d{4,}/.test(path)) return false;
      if (/\/(category|tag|author|page)\//i.test(path)) return true;
      // slug articles without date folder
      if (path.split("/").filter(Boolean).length >= 1 && !/\/(wp-|feed|login)/i.test(path)) {
        if (path !== "/" && !/\.(css|js|png|jpg|svg)$/i.test(path)) return false;
      }
      return true;
    }
    // 今周刊
    if (u.hostname.includes("businesstoday.com.tw")) {
      if (/\/article\/category\/\d+\/\d+/i.test(path) || /\/article\//i.test(path)) return false;
      if (/\/search/i.test(path)) return true;
      return !/\d{5,}/.test(path);
    }
    // Yahoo 奇摩新聞
    if (u.hostname.includes("yahoo.com")) {
      if (/\/search/i.test(path)) return true;
      // story slugs often end with html id
      if (/\.html$/i.test(path) || /-\d{6,}\.html$/i.test(path)) return false;
      if (path.split("/").filter(Boolean).length >= 1 && /[\u4e00-\u9fffA-Za-z0-9-]{8,}/.test(path)) return false;
      return true;
    }
    // 住商新聞 homeplus
    if (u.hostname.includes("homeplus.net.tw")) {
      if (/\/\d{4}\/\d{2}\//.test(path) || /\/archives\/\d+/i.test(path) || /\/\d{4,}/.test(path)) return false;
      if (/\/(category|tag|author|page|wp-)\//i.test(path)) return true;
      if (path.split("/").filter(Boolean).length >= 1 && !/\.(css|js|png|jpg)$/i.test(path)) return false;
      return true;
    }
    // 桃園市議會
    if (u.hostname.includes("tycc.gov.tw")) {
      if (/News|news|訊息|公告|Content|content/i.test(path + u.search) && /\d{3,}/.test(path + u.search)) return false;
      if (/home\.jsp/i.test(path) && !/\d{4,}/.test(u.search)) return true;
      return !/\d{4,}/.test(path + u.search);
    }
    // 交通部
    if (u.hostname.includes("motc.gov.tw")) {
      if (/home\.jsp/i.test(path) && /id=\d+/i.test(u.search) && /dataserno|news|News/i.test(path + u.search)) return false;
      if (/\/ch\/home\.jsp/i.test(path) && /\d{5,}/.test(u.search)) return false;
      if (/parentpath|id=\d+/i.test(u.search) && /\d{6,}/.test(u.search)) return false;
      // keep deep content ids
      if (/\d{6,}/.test(path + u.search)) return false;
      return true;
    }
    // AN 新聞
    if (u.hostname.includes("annewsmedia.com")) {
      if (/\/\d{4}\/\d{2}\//.test(path) || /\/archives\/\d+/i.test(path) || /\/\d{4,}/.test(path)) return false;
      if (/\/(category|tag|author|page)\//i.test(path)) return true;
      if (path.split("/").filter(Boolean).length >= 1) return false;
      return true;
    }
    // 好房網新聞
    if (u.hostname.includes("housefun.com.tw")) {
      if (/\/news\/\d+/i.test(path) || /\/article\//i.test(path) || /\/\d{5,}/.test(path)) return false;
      if (/\/(search|tag|category)\//i.test(path)) return true;
      return !/\d{4,}/.test(path);
    }
    // 住展
    if (u.hostname.includes("myhousing.com.tw")) {
      if (/\/\d{4}\/\d{2}\//.test(path) || /\/archives\/\d+/i.test(path) || /\/news\//i.test(path)) return false;
      if (/\/(category|tag|author|page)\//i.test(path)) return true;
      if (/\d{4,}/.test(path)) return false;
      return true;
    }
    // 樂居
    if (u.hostname.includes("leju.com.tw")) {
      if (/\/\d{4}\/\d{2}\//.test(path) || /\/archives\/\d+/i.test(path) || /\/news\//i.test(path) || /\/\d{4,}/.test(path)) return false;
      if (/\/(category|tag|author|page|search)\//i.test(path)) return true;
      if (path.split("/").filter(Boolean).length >= 1) return false;
      return true;
    }
    // 工商時報
    if (u.hostname.includes("ctee.com.tw")) {
      if (/\/\d{6,}/.test(path) || /\/article\//i.test(path) || /\/\d{4}\/\d{2}\//.test(path)) return false;
      if (/\/search/i.test(path)) return true;
      return !/\d{5,}/.test(path);
    }
    // 桃園電子報
    if (u.hostname.includes("tyenews.com")) {
      if (/\/\d{4}\/\d{2}\//.test(path) || /\/archives\/\d+/i.test(path) || /\/\d{4,}/.test(path)) return false;
      if (/\/(category|tag|author|page)\//i.test(path)) return true;
      if (path.split("/").filter(Boolean).length >= 1) return false;
      return true;
    }
    // 樞紐新聞
    if (u.hostname.includes("thehubnews.net")) {
      if (/\/\d{4}\/\d{2}\//.test(path) || /\/archives\/\d+/i.test(path) || /\/\d{4,}/.test(path)) return false;
      if (/\/(category|tag|author|page)\//i.test(path)) return true;
      if (path.split("/").filter(Boolean).length >= 1) return false;
      return true;
    }
    // 風傳媒 / 新新聞 storm.mg
    if (u.hostname.includes("storm.mg")) {
      if (/\/article\/\d+/i.test(path) || /\/\d{5,}/.test(path)) return false;
      if (/\/(category|tag|author|search|page)\//i.test(path)) return true;
      return true;
    }
    // Mobile01 討論串
    if (u.hostname.includes("mobile01.com")) {
      if (/topicdetail\.php/i.test(path) && /[?&]t=\d+/i.test(u.search)) return false;
      if (/\/topic\/\d+/i.test(path)) return false;
      if (/googlesearch|topiclist|forumtopic/i.test(path)) return true;
      return true;
    }
    // chinatimes articles usually have long numeric id in path
    if (u.hostname.includes("chinatimes.com")) {
      if (/\/\d{6,}(?:\.html)?/i.test(path) || /\/realtimenews\//i.test(path)) return false;
      if (/\/search\//i.test(path)) return true;
      return true;
    }
    // LTN story paths usually /news/ or /category/
    if (u.hostname.includes("ltn.com.tw")) {
      if (!/\/(news|article|politics|society|world|business|sports|life|local|entertainment)\//i.test(path) && !/search\.ltn/.test(u.hostname)) {
        // keep search.ltn result pages that link to news
        if (!/\d{5,}/.test(path)) return true;
      }
    }
    // China Times articles
    if (u.hostname.includes("chinatimes.com")) {
      if (!/\/(realtimenews|newspapers|opinion|life|money|sports|star|society|world|chinese|news)\//i.test(path) && !/\/search\//i.test(path)) {
        if (!/\d{6,}/.test(path)) return true;
      }
    }
    return false;
  } catch {
    return true;
  }
}

function isLikelyArticleUrl(url: string, domain: string): boolean {
  if (isJunkNewsUrl(url)) return false;
  try {
    const u = new URL(url);
    const path = u.pathname;
    // PTT posts
    if (domain.includes("ptt.cc")) return /\/bbs\/[^/]+\/M\.\d+\.A\./i.test(path);
    // Generic: avoid pure category indexes without article id
    if (/\/(index|home|default)(\.(html?|aspx|php))?$/i.test(path) && !/\d{5,}/.test(path)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Slice HTML around a match so list-card dates (LTN time span, etc.) can be parsed. */
function sliceHtmlContext(html: string, matchIndex: number, matchLength: number, radius = 420): string {
  const start = Math.max(0, matchIndex - radius);
  const end = Math.min(html.length, matchIndex + matchLength + radius);
  return html.slice(start, end);
}

function buildArticleFromMatch(
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

function extractArticlesFromText(
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
  if (via.ok && via.text.length >= 200) {
    return { text: via.text, source: `${url} (via reader)` };
  }

  const statusPart =
    direct.error ||
    `HTTP ${direct.status || 0}${via.ok ? "" : via.error ? `/${via.error}` : via.status ? `/${via.status}` : ""}`;
  return {
    text: "",
    source: url,
    error: statusPart,
  };
}

/** Google News RSS fallback for bot-blocked publishers (chinatimes etc.). */
async function searchGoogleNewsRss(
  site: FengbroNewsSiteConfig,
  query: string,
  seen: Set<string>
): Promise<{ articles: NewsArticle[]; source?: string; error?: string }> {
  const domain = normalizeDomain(site.domain);
  const q = encodeURIComponent(`${query} site:${domain} when:1095d`);
  const feedUrl = `https://news.google.com/rss/search?q=${q}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`;
  const feed = await fetchText(feedUrl, {
    headers: { accept: "application/rss+xml,application/xml,text/xml,*/*" },
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
    if (publisherHost && publisherHost !== domain && !publisherHost.endsWith(`.${domain}`) && !domain.endsWith(publisherHost)) {
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

  try {
    const origin = new URL(site.homeUrl || `https://${site.domain}`).origin;
    const domain = normalizeDomain(site.domain);
    const enc = encodeURIComponent(query);

    // Site-specific search URL variants
    if (domain.includes("ptt.cc")) {
      const board = site.homeUrl.match(/\/bbs\/([^/]+)/i)?.[1] || "Railway";
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

  // Fallback: Google News RSS when direct site is blocked or empty
  if (articles.length === 0) {
    const rss = await searchGoogleNewsRss(site, query, seen);
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
        ? // Prefer "no match" when we did load a page (avoid stale "fetch failed" after jina/reader)
          sources.length > 0
          ? "此來源未找到標題符合的文章（近三年內）"
          : lastError || "此來源未找到標題符合的文章（近三年內）"
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

function getYouTubeChannelTab(homeUrl: string): "videos" | "shorts" | "streams" | "featured" {
  try {
    const path = decodeURIComponent(new URL(homeUrl).pathname).toLowerCase();
    if (/\/shorts(?:\/|$)/i.test(path)) return "shorts";
    if (/\/streams(?:\/|$)/i.test(path)) return "streams";
    if (/\/featured(?:\/|$)/i.test(path)) return "featured";
  } catch {
    // fall through
  }
  return "videos";
}

/** Channel list page: /videos (default) or /shorts when configured. */
function getYouTubeVideosPageUrl(homeUrl: string) {
  const tab = getYouTubeChannelTab(homeUrl);
  try {
    const url = new URL(homeUrl);
    let path = url.pathname.replace(/\/+$/, "");
    path = path.replace(/\/(videos|shorts|streams|featured)$/i, "");
    return `https://www.youtube.com${path}/${tab}`;
  } catch {
    return homeUrl;
  }
}

function formatYouTubeHitUrl(videoId: string, tab: "videos" | "shorts" | "streams" | "featured") {
  if (tab === "shorts") return `https://www.youtube.com/shorts/${videoId}`;
  return `https://www.youtube.com/watch?v=${videoId}`;
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

  // Shorts shelf: "/shorts/xxxxxxxxxxx"
  {
    const shortRe = /\/shorts\/([\w-]{11})/g;
    let sm: RegExpExecArray | null;
    while ((sm = shortRe.exec(html))) {
      const videoId = sm[1];
      if (seen.has(videoId)) continue;
      // Try nearby title in a small window
      const window = html.slice(Math.max(0, sm.index - 200), sm.index + 280);
      const titleM =
        /"text"\s*:\s*"((?:\\.|[^"\\]){2,120})"/.exec(window) ||
        /"title"\s*:\s*"((?:\\.|[^"\\]){2,120})"/.exec(window);
      let title = titleM?.[1] || "";
      try {
        if (title) title = JSON.parse(`"${title}"`) as string;
      } catch {
        title = title.replace(/\\u0026/g, "&").replace(/\\"/g, '"');
      }
      title = normalizeSpace(title);
      if (!title || title.length < 2) continue;
      if (/^(watch later|share|mix|播放清單|稍後再看)/i.test(title)) continue;
      seen.add(videoId);
      hits.push({
        title,
        url: `https://www.youtube.com/shorts/${videoId}`,
        videoId,
      });
    }
  }

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

function getYouTubeChannelSearchUrl(homeUrl: string, query: string): string {
  try {
    const url = new URL(getYouTubeVideosPageUrl(homeUrl));
    // /@handle/videos|shorts → /@handle/search?query=
    const basePath = url.pathname
      .replace(/\/(videos|shorts|streams|featured)\/?$/i, "")
      .replace(/\/+$/, "");
    return `https://www.youtube.com${basePath}/search?query=${encodeURIComponent(query)}`;
  } catch {
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  }
}

/** YouTube channel — prefer channel search, then recent feed/list (or /shorts tab). */
async function searchYouTubeChannel(site: FengbroNewsSiteConfig, query: string): Promise<SiteSearchResult> {
  const tab = getYouTubeChannelTab(site.homeUrl);
  const videosPageUrl = getYouTubeVideosPageUrl(site.homeUrl);
  const searchPageUrl = getYouTubeChannelSearchUrl(site.homeUrl, query);
  let html = "";
  let channelId = "";
  let source = tab === "shorts" ? videosPageUrl : searchPageUrl;
  let hits: YouTubeVideoHit[] = [];

  // Shorts: list /shorts first (channel search mixes long-form)
  if (tab === "shorts") {
    const page = await fetchText(videosPageUrl);
    if (page.ok && page.text.length > 2000) {
      html = page.text;
      hits = parseYouTubeVideosFromHtml(html);
      source = videosPageUrl;
      channelId = resolveYouTubeChannelIdFromHtml(html);
    }
  }

  // 1) Channel search page (finds older matching videos, not only latest 15)
  if (hits.length < 3) {
    const page = await fetchText(searchPageUrl);
    if (page.ok && page.text.length > 5000) {
      if (!html) html = page.text;
      const searchHits = parseYouTubeVideosFromHtml(page.text);
      const seenIds = new Set(hits.map((h) => h.videoId));
      for (const hit of searchHits) {
        if (seenIds.has(hit.videoId)) continue;
        hits.push(hit);
        seenIds.add(hit.videoId);
      }
      source = source || searchPageUrl;
      channelId = channelId || resolveYouTubeChannelIdFromHtml(page.text);
    }
  }

  // 2) Recent videos/shorts page + Atom feed (feed only for non-shorts; shorts rarely in Atom)
  if (hits.length < 3 && tab !== "shorts") {
    const page = await fetchText(videosPageUrl);
    if (page.ok) {
      if (!html) html = page.text;
      channelId = channelId || resolveYouTubeChannelIdFromHtml(page.text);
      const recent = parseYouTubeVideosFromHtml(page.text);
      const seenIds = new Set(hits.map((h) => h.videoId));
      for (const hit of recent) {
        if (seenIds.has(hit.videoId)) continue;
        hits.push(hit);
        seenIds.add(hit.videoId);
      }
      if (!source) source = videosPageUrl;
    }
  }

  if (channelId && hits.length < 3 && tab !== "shorts") {
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
    const feed = await fetchText(feedUrl, {
      headers: { accept: "application/atom+xml,application/xml,text/xml,*/*" },
    });
    if (feed.ok && feed.text.includes("<entry>")) {
      const feedHits = parseYouTubeFeedEntries(feed.text);
      const seenIds = new Set(hits.map((h) => h.videoId));
      for (const hit of feedHits) {
        if (seenIds.has(hit.videoId)) continue;
        hits.push(hit);
        seenIds.add(hit.videoId);
      }
      source = source || feedUrl;
    }
  }

  // 3) jina fallback on shorts list or search page
  if (hits.length === 0) {
    const fallbackUrl = tab === "shorts" ? videosPageUrl : searchPageUrl;
    const via = await fetchViaJina(fallbackUrl);
    if (via.ok) {
      const mdHits: YouTubeVideoHit[] = [];
      const re =
        /\[([^\]]+)\]\((https?:\/\/(?:www\.)?youtube\.com\/(?:watch\?v=|shorts\/)([\w-]{11})[^)\s]*)\)/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(via.text))) {
        mdHits.push({
          title: normalizeSpace(m[1]),
          url: formatYouTubeHitUrl(m[3], tab),
          videoId: m[3],
        });
      }
      if (mdHits.length) {
        hits = mdHits;
        source = `${fallbackUrl} (via reader)`;
      }
    }
  }

  const articles: NewsArticle[] = [];
  const seen = new Set<string>();
  for (const hit of hits) {
    if (!titleMatches(hit.title, query) || isJunkNewsTitle(hit.title)) continue;
    const url = hit.videoId
      ? formatYouTubeHitUrl(hit.videoId, tab)
      : hit.url.startsWith("http")
        ? hit.url
        : `https://www.youtube.com/watch?v=${hit.videoId}`;
    if (seen.has(url)) continue;
    seen.add(url);
    articles.push({
      title: hit.title.slice(0, 160),
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
        ? "無法讀取此 YouTube 頻道"
        : articles.length === 0
          ? `頻道內沒有標題含「${query}」的影片（近三年內）`
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
