/** Orchestrate multi-site Fengbro News search. */

import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_FENGBRO_NEWS_SITES,
  normalizeDomain,
  normalizeFengbroNewsSites,
  type FengbroNewsSiteConfig,
} from "@/lib/fengbroNewsSites";
import { searchGenericKeywordUrl } from "./adapters/generic";
import { searchRbNreo } from "./adapters/rbNreo";
import { searchTycgTraffic } from "./adapters/tycgTraffic";
import { searchTycgZhongli } from "./adapters/tycgZhongli";
import { searchYouTubeChannel } from "./adapters/youtube";
import {
  MAX_NEWS_AGE_YEARS,
  SITE_CONCURRENCY,
  SITE_SEARCH_TIMEOUT_MS,
} from "./constants";
import { filterArticlesByMaxAge, inferArticleDate } from "./dates";
import { mapPool, withTimeout } from "./fetch";
import type { NewsArticle, SiteSearchResult } from "./types";

export async function searchSiteInner(site: FengbroNewsSiteConfig, query: string): Promise<SiteSearchResult> {
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
}

export async function searchSite(site: FengbroNewsSiteConfig, query: string): Promise<SiteSearchResult> {
  try {
    return await withTimeout(searchSiteInner(site, query), SITE_SEARCH_TIMEOUT_MS, () => ({
      siteId: site.id,
      siteName: site.name,
      domain: site.domain,
      articles: [] as NewsArticle[],
      error: `此來源搜尋逾時（>${Math.round(SITE_SEARCH_TIMEOUT_MS / 1000)}s）`,
      source: site.homeUrl,
    }));
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

export function parseSitesFromRequest(request: NextRequest, body: unknown): FengbroNewsSiteConfig[] {
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

export async function handleSearch(request: NextRequest, body: unknown = null) {
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

  // Bounded concurrency: 30+ locked sources must not open 30+ hanging fetches at once
  const bySiteRaw = await mapPool(sites, SITE_CONCURRENCY, (site) => searchSite(site, query));
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

