/**
 * Mechanical split of searchService.ts into lib/fengbroNews/* modules.
 * Run from repo root: node scratch/split-news-modules.mjs
 */
import fs from "fs";
import path from "path";

const root = "lib/fengbroNews";
const src = fs.readFileSync(path.join(root, "searchService.ts"), "utf8");
const lines = src.split(/\n/);

/** 1-based inclusive line ranges from the post-extract searchService */
const ranges = {
  // after removing dynamic/maxDuration, line numbers shifted - detect by markers
};

function findLine(re, from = 0) {
  for (let i = from; i < lines.length; i++) {
    if (re.test(lines[i])) return i; // 0-based
  }
  throw new Error(`Not found: ${re}`);
}

function slice(startRe, endReExclusive) {
  const start = findLine(startRe);
  const end = endReExclusive ? findLine(endReExclusive, start + 1) : lines.length;
  return lines.slice(start, end).join("\n").replace(/\n+$/, "") + "\n";
}

function exportFn(block) {
  return block
    .replace(/^function /gm, "export function ")
    .replace(/^async function /gm, "export async function ")
    .replace(/^type /gm, "export type ")
    .replace(/^const /gm, "export const ");
}

// Locate sections by anchors
const iUserAgent = findLine(/^const USER_AGENT/);
const iNewsArticle = findLine(/^export type NewsArticle/);
const iDecodeHtml = findLine(/^function decodeHtml/);
const iGetCutoff = findLine(/^function getNewsCutoffMs/);
const iAbsUrl = findLine(/^function absoluteUrl/);
const iDefaultHeaders = findLine(/^function defaultFetchHeaders/);
const iTycg = findLine(/^\/\*\* 桃園市政府交通局/);
const iRb = findLine(/^\/\*\* 鐵道局北部工程分局/);
const iZhongli = findLine(/^\/\*\* 中壢區公所/);
const iHostMatch = findLine(/^function hostMatchesDomain/);
const iSliceCtx = findLine(/^\/\*\* Slice HTML around a match/);
const iFetchPage = findLine(/^async function fetchPageText/);
const iGoogle = findLine(/^\/\*\* Google News RSS fallback/);
const iGenericFn = findLine(/^async function searchGenericKeywordUrl/);
const iYtType = findLine(/^type YouTubeVideoHit/);
const iSearchInner = findLine(/^async function searchSiteInner/);

// Comment block immediately above generic function
let iGenericComment = iGenericFn;
for (let i = iGenericFn - 1; i >= Math.max(0, iGenericFn - 8); i--) {
  if (lines[i].trim().startsWith("/**")) {
    iGenericComment = i;
    break;
  }
}

const body = (a, b) => lines.slice(a, b).join("\n").replace(/\n+$/, "") + "\n";

// --- html.ts ---
const htmlBody = exportFn(
  body(iDecodeHtml, iGetCutoff) +
    // stripNoise + junk title live between hostMatches and slice? No - stripNoise is after hostMatches
    ""
);

// Actually restructure carefully:
// html pure: decodeHtml..titleMatches (before getNewsCutoff)
// dates: getNewsCutoff..filterArticles (before absoluteUrl)
// url part1: absoluteUrl..canonicalize (before defaultFetchHeaders)
// fetch: defaultFetchHeaders..withTimeout (before tycg)
// adapters tycg, rb, zhongli
// url part2: hostMatches..isLikelyArticle (before slice)
// extract: slice..extractArticles (before fetchPageText)
// fetchPage: fetchPageText (before google)
// google: searchGoogleNewsRss (before generic)
// generic: searchGenericKeywordUrl (before youtube type)
// youtube: YouTube..searchYouTubeChannel (before searchSiteInner)
// search: searchSiteInner..end

const iStripNoise = findLine(/^function stripNoiseHtml/);
const iIsLikely = findLine(/^function isLikelyArticleUrl/);
// isLikely ends before slice comment
const afterIsLikely = findLine(/^\/\*\* Slice HTML around a match/);
const iExtractEnd = findLine(/^async function fetchPageText/);
const iGoogleEnd = iGenericComment;
const iYtEnd = iSearchInner;

const files = {};

files["html.ts"] = `/** HTML / text helpers for Fengbro News scraping. */

${exportFn(body(iDecodeHtml, iGetCutoff))}
${exportFn(body(iStripNoise, iAbsUrl > iStripNoise ? iAbsUrl : findLine(/^function isJunkNewsUrl/) ))}
`;

// Wait - stripNoise is AFTER hostMatches which is after adapters. Order in file:
// decode..titleMatches
// dates
// absoluteUrl..canonicalize
// fetch helpers
// adapters tycg/rb/zhongli
// hostMatches, stripNoise, isJunkTitle, isJunkUrl, isLikely
// extract
// ...

// Fix html to include stripNoise + isJunkNewsTitle only
const iIsJunkTitle = findLine(/^function isJunkNewsTitle/);
const iIsJunkUrl = findLine(/^function isJunkNewsUrl/);

files["html.ts"] = `/** HTML / text helpers for Fengbro News scraping. */

${exportFn(body(iDecodeHtml, iGetCutoff))}
${exportFn(body(iStripNoise, iIsJunkUrl))}
${exportFn(body(findLine(/^function decodeXml/), findLine(/^function getYouTubeChannelTab/)).replace(/^export type YouTubeVideoHit[\s\S]*?(?=export function decodeXml)/, ""))}
`;

// This is getting messy. Simpler approach: write modules with explicit content extraction ranges that match actual file structure.

const plan = [
  {
    file: "html.ts",
    header: `/** HTML / text helpers for Fengbro News scraping. */\n\n`,
    ranges: [
      [iDecodeHtml, iGetCutoff],
      [iStripNoise, iIsJunkUrl],
      [findLine(/^function decodeXml/), findLine(/^function getYouTubeChannelTab/)],
    ],
  },
  {
    file: "dates.ts",
    header: `/** Date parsing and max-age filtering for Fengbro News. */\n\nimport { normalizeDomain } from "@/lib/fengbroNewsSites";\nimport { MAX_NEWS_AGE_MS, MAX_NEWS_AGE_YEARS } from "./constants";\nimport { isJunkNewsTitle, normalizeSpace } from "./html";\nimport type { NewsArticle } from "./types";\nimport { isJunkNewsUrl } from "./url";\n\n`,
    ranges: [[iGetCutoff, iAbsUrl]],
  },
  {
    file: "url.ts",
    header: `/** URL normalize / article URL heuristics for Fengbro News. */\n\nimport { normalizeDomain } from "@/lib/fengbroNewsSites";\n\n`,
    ranges: [
      [iAbsUrl, iDefaultHeaders],
      [iHostMatch, iStripNoise],
      [iIsJunkUrl, afterIsLikely],
    ],
  },
  {
    file: "fetch.ts",
    header: `/** HTTP helpers for Fengbro News scraping. */\n\nimport {\n  FETCH_TIMEOUT_MS,\n  JINA_PREFIX,\n  JINA_TIMEOUT_MS,\n  USER_AGENT,\n} from "./constants";\n\n`,
    ranges: [
      [iDefaultHeaders, iTycg],
      [iFetchPage, iGoogle],
    ],
  },
  {
    file: "extract.ts",
    header: `/** Article extraction from list/search HTML for Fengbro News. */\n\nimport { normalizeDomain } from "@/lib/fengbroNewsSites";\nimport type { FengbroNewsSiteConfig } from "@/lib/fengbroNewsSites";\nimport {\n  extractDateFromHtmlContext,\n  inferArticleDate,\n  toIsoDate,\n} from "./dates";\nimport {\n  isJunkNewsTitle,\n  normalizeSpace,\n  stripNoiseHtml,\n  stripTags,\n  titleMatches,\n} from "./html";\nimport type { NewsArticle } from "./types";\nimport {\n  absoluteUrl,\n  canonicalizeUrl,\n  hostMatchesDomain,\n  isJunkNewsUrl,\n  isLikelyArticleUrl,\n} from "./url";\n\n`,
    ranges: [[afterIsLikely, iFetchPage]],
  },
  {
    file: "googleNews.ts",
    header: `/** Google News RSS fallback for bot-blocked publishers. */\n\nimport { normalizeDomain } from "@/lib/fengbroNewsSites";\nimport type { FengbroNewsSiteConfig } from "@/lib/fengbroNewsSites";\nimport { fetchText } from "./fetch";\nimport { isJunkNewsTitle, normalizeSpace, pickXml, titleMatches } from "./html";\nimport type { NewsArticle } from "./types";\n\n`,
    ranges: [[iGoogle, iGenericComment]],
  },
  {
    file: "adapters/tycgTraffic.ts",
    header: `/** 桃園市政府交通局 adapter. */\n\nimport type { FengbroNewsSiteConfig } from "@/lib/fengbroNewsSites";\nimport { fetchText } from "../fetch";\nimport { stripTags, titleMatches } from "../html";\nimport type { NewsArticle, SiteSearchResult } from "../types";\nimport { absoluteUrl, canonicalizeUrl } from "../url";\n\n`,
    ranges: [[iTycg, iRb]],
  },
  {
    file: "adapters/rbNreo.ts",
    header: `/** 鐵道局北部工程分局 adapter. */\n\nimport type { FengbroNewsSiteConfig } from "@/lib/fengbroNewsSites";\nimport { fetchViaJina } from "../fetch";\nimport { normalizeSpace, titleMatches } from "../html";\nimport type { NewsArticle, SiteSearchResult } from "../types";\nimport { canonicalizeUrl } from "../url";\n\n`,
    ranges: [[iRb, iZhongli]],
  },
  {
    file: "adapters/tycgZhongli.ts",
    header: `/** 中壢區公所 adapter. */\n\nimport type { FengbroNewsSiteConfig } from "@/lib/fengbroNewsSites";\nimport { fetchText } from "../fetch";\nimport { stripTags, titleMatches } from "../html";\nimport type { NewsArticle, SiteSearchResult } from "../types";\nimport { absoluteUrl, canonicalizeUrl } from "../url";\n\n`,
    ranges: [[iZhongli, iHostMatch]],
  },
  {
    file: "adapters/generic.ts",
    header: `/** Generic keyword/list URL adapter + site-specific candidate URLs. */\n\nimport { normalizeDomain } from "@/lib/fengbroNewsSites";\nimport type { FengbroNewsSiteConfig } from "@/lib/fengbroNewsSites";\nimport { MAX_LIST_URL_TRIES } from "../constants";\nimport { extractArticlesFromText } from "../extract";\nimport { fetchPageText } from "../fetch";\nimport { searchGoogleNewsRss } from "../googleNews";\nimport type { NewsArticle, SiteSearchResult } from "../types";\n\n`,
    ranges: [[iGenericComment, iYtType]],
  },
  {
    file: "adapters/youtube.ts",
    header: `/** YouTube channel adapter for Fengbro News. */\n\nimport type { FengbroNewsSiteConfig } from "@/lib/fengbroNewsSites";\nimport { fetchText, fetchViaJina } from "../fetch";\nimport {\n  isJunkNewsTitle,\n  normalizeSpace,\n  pickXml,\n  titleMatches,\n} from "../html";\nimport type { NewsArticle, SiteSearchResult } from "../types";\n\n`,
    // Skip decodeXml/pickXml (live in html.ts); keep YouTubeVideoHit + channel helpers + search
    ranges: [
      [iYtType, findLine(/^function decodeXml/)],
      [findLine(/^function getYouTubeChannelTab/), iSearchInner],
    ],
  },
  {
    file: "search.ts",
    header: `/** Orchestrate multi-site Fengbro News search. */\n\nimport { NextRequest, NextResponse } from "next/server";\nimport {\n  DEFAULT_FENGBRO_NEWS_SITES,\n  normalizeDomain,\n  normalizeFengbroNewsSites,\n  type FengbroNewsSiteConfig,\n} from "@/lib/fengbroNewsSites";\nimport { searchGenericKeywordUrl } from "./adapters/generic";\nimport { searchRbNreo } from "./adapters/rbNreo";\nimport { searchTycgTraffic } from "./adapters/tycgTraffic";\nimport { searchTycgZhongli } from "./adapters/tycgZhongli";\nimport { searchYouTubeChannel } from "./adapters/youtube";\nimport {\n  MAX_NEWS_AGE_YEARS,\n  SITE_CONCURRENCY,\n  SITE_SEARCH_TIMEOUT_MS,\n} from "./constants";\nimport { filterArticlesByMaxAge, inferArticleDate } from "./dates";\nimport { mapPool, withTimeout } from "./fetch";\nimport type { NewsArticle, SiteSearchResult } from "./types";\n\n`,
    ranges: [[iSearchInner, lines.length]],
  },
];

fs.mkdirSync(path.join(root, "adapters"), { recursive: true });

for (const item of plan) {
  let content = item.header;
  for (const [a, b] of item.ranges) {
    content += exportFn(body(a, b)) + "\n";
  }
  // Avoid double-export
  content = content.replace(/export export /g, "export ");
  // Don't re-export MAX_* that aren't functions in search if already imported
  fs.writeFileSync(path.join(root, item.file), content);
  console.log("wrote", item.file, content.split("\n").length, "lines", "range starts", item.ranges.map((r) => r[0] + 1));
}

// Fix html.ts: decodeXml/pickXml shouldn't pull YouTubeVideoHit
// Fix dates: MAX_NEWS_AGE_YEARS used in filter message? only MAX_NEWS_AGE_MS and requireDateHosts
// Fix circular: dates imports url, url has no dates - ok
// extract imports dates - dates imports url - url no extract - ok
// googleNews imports pickXml from html - need pickXml exported

// Write index + thin searchService re-export
const index = `export type {
  FengbroNewsSearchResult,
  NewsArticle,
  SiteSearchResult,
  TraBentoStore,
  TraBentoStoresResult,
} from "./types";
export {
  MAX_LIST_URL_TRIES,
  MAX_NEWS_AGE_MS,
  MAX_NEWS_AGE_YEARS,
  SITE_CONCURRENCY,
  SITE_SEARCH_TIMEOUT_MS,
} from "./constants";
export { handleSearch } from "./search";
`;
fs.writeFileSync(path.join(root, "index.ts"), index);

// searchService becomes re-export for stable import path
fs.writeFileSync(
  path.join(root, "searchService.ts"),
  `/** @deprecated Prefer @/lib/fengbroNews — kept for stable import path. */\nexport { handleSearch, MAX_NEWS_AGE_YEARS, SITE_CONCURRENCY } from "./search";\nexport type { NewsArticle, SiteSearchResult } from "./types";\n`
);

console.log("done");
