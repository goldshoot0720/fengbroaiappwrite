/** Shared knobs for Fengbro News scrape engine. */

export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const JINA_PREFIX = "https://r.jina.ai/https://";

/** Only keep news published within this many years. */
export const MAX_NEWS_AGE_YEARS = 3;
export const MAX_NEWS_AGE_MS = MAX_NEWS_AGE_YEARS * 365.25 * 24 * 60 * 60 * 1000;

/** Per outbound HTTP request (prevents infinite "搜尋中"). */
export const FETCH_TIMEOUT_MS = 8_000;
export const JINA_TIMEOUT_MS = 10_000;

/** Hard cap per source so one dead site cannot stall the whole search. */
export const SITE_SEARCH_TIMEOUT_MS = 18_000;

/** How many sources to scrape in parallel. */
export const SITE_CONCURRENCY = 5;

/** Max list/search URLs tried per generic source (then Google News). */
export const MAX_LIST_URL_TRIES = 2;

/**
 * Publishers that often block datacenter scrapers (Incapsula / bot walls).
 * Generic adapter tries Google News RSS first for these hosts.
 */
export const PREFER_GOOGLE_NEWS_HOSTS = [
  "chinatimes.com",
  "udn.com",
  "storm.mg",
  "ctee.com.tw",
  "businesstoday.com.tw",
  "leho.com.tw",
  "bella.tw",
  "yahoo.com",
  "housefun.com.tw",
  "myhousing.com.tw",
  "annewsmedia.com",
  "hakkanews.tw",
  "thehubnews.net",
  "tyenews.com",
  "homeplus.net.tw",
  "ltn.com.tw",
] as const;
