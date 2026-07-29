/**
 * Fengbro News (鋒兄新聞) — scrape engine + shared types.
 *
 * Layout:
 * - types / constants — shared contracts
 * - html / dates / url / fetch / extract — pure helpers
 * - adapters/* — per-source scrapers
 * - googleNews — RSS fallback
 * - search — multi-site orchestration (used by API route)
 */
export type {
  FengbroNewsSearchResult,
  NewsArticle,
  SiteSearchResult,
  TraBentoStore,
  TraBentoStoresResult,
} from "./types";
export {
  FETCH_TIMEOUT_MS,
  JINA_TIMEOUT_MS,
  MAX_LIST_URL_TRIES,
  MAX_NEWS_AGE_MS,
  MAX_NEWS_AGE_YEARS,
  PREFER_GOOGLE_NEWS_HOSTS,
  SITE_CONCURRENCY,
  SITE_SEARCH_TIMEOUT_MS,
} from "./constants";
export { prefersGoogleNewsFirst } from "./googleNews";
export { handleSearch } from "./search";
