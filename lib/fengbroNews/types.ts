/** Shared Fengbro News API result types (server + client). */

export type NewsArticle = {
  title: string;
  url: string;
  siteId: string;
  siteName: string;
  domain: string;
  publishedAt?: string;
  snippet?: string;
};

export type SiteSearchResult = {
  siteId: string;
  siteName: string;
  domain: string;
  articles: NewsArticle[];
  error?: string;
  source?: string;
};

export type FengbroNewsSearchResult = {
  query: string;
  onlyLocked: boolean;
  siteCount: number;
  resultCount: number;
  maxAgeYears?: number;
  fetchedAt: string;
  results: NewsArticle[];
  bySite: SiteSearchResult[];
  warnings?: string[];
  exampleNote?: string;
  error?: string;
};

export type TraBentoStore = {
  name: string;
  detail: string;
  focus?: boolean;
  stationHint?: string;
};

export type TraBentoStoresResult = {
  sourceUrl: string;
  sourceLabel: string;
  focusOnly: boolean;
  fetchedAt: string;
  count: number;
  stores: TraBentoStore[];
  live: boolean;
  warning?: string;
  error?: string;
};
