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

/** Generic: fetch a keyword search URL template and extract links whose text matches query */
async function searchGenericKeywordUrl(site: FengbroNewsSiteConfig, query: string): Promise<SiteSearchResult> {
  const template = site.searchUrlTemplate;
  if (!template) {
    return {
      siteId: site.id,
      siteName: site.name,
      domain: site.domain,
      articles: [],
      error: "此網站尚未設定 searchUrlTemplate，無法自動搜尋",
    };
  }

  const listUrl = template.includes("{q}")
    ? template.replaceAll("{q}", encodeURIComponent(query))
    : template;

  let text = "";
  let source = listUrl;
  const direct = await fetchText(listUrl);
  if (direct.ok && direct.text.length > 2000 && !direct.text.includes("Incapsula") && !direct.text.includes("ROBOTS")) {
    text = direct.text;
  } else {
    // Fallback reader for hard sites
    const via = await fetchViaJina(listUrl);
    if (!via.ok) {
      return {
        siteId: site.id,
        siteName: site.name,
        domain: site.domain,
        articles: [],
        error: `HTTP ${direct.status}/${via.status}`,
        source: listUrl,
      };
    }
    text = via.text;
    source = `${listUrl} (via reader)`;
  }

  const articles: NewsArticle[] = [];
  const seen = new Set<string>();
  const domain = normalizeDomain(site.domain);

  // HTML anchors
  const htmlRe = /href="(https?:\/\/[^"]+|\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = htmlRe.exec(text))) {
    const title = stripTags(m[2]);
    if (!title || title.length < 4 || !titleMatches(title, query)) continue;
    const url = canonicalizeUrl(absoluteUrl(listUrl, m[1]));
    try {
      if (!normalizeDomain(new URL(url).hostname).endsWith(domain.replace(/^www\./, ""))) continue;
    } catch {
      continue;
    }
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

  // Markdown links from reader
  const mdRe = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gi;
  while ((m = mdRe.exec(text))) {
    const title = normalizeSpace(m[1]);
    if (!title || !titleMatches(title, query)) continue;
    const url = canonicalizeUrl(m[2]);
    try {
      if (!normalizeDomain(new URL(url).hostname).endsWith(domain.replace(/^www\./, ""))) continue;
    } catch {
      continue;
    }
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
      case "generic-keyword-url":
      default:
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

  const bySite = await Promise.all(sites.map((site) => searchSite(site, query)));
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
