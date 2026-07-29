import fs from "fs";

const path = "lib/fengbroNews/searchService.ts";
let src = fs.readFileSync(path, "utf8");

// Remove route-only config (lives in route.ts)
src = src.replace(/^export const dynamic = "force-dynamic";\r?\n/m, "");
src = src.replace(
  /^\/\*\* Vercel \/ long server routes: allow multi-site scrape window \*\/\r?\nexport const maxDuration = 60;\r?\n\r?\n/m,
  ""
);

// Export shared types / knobs
src = src.replace("type NewsArticle =", "export type NewsArticle =");
src = src.replace("type SiteSearchResult =", "export type SiteSearchResult =");
src = src.replace(
  "const MAX_NEWS_AGE_YEARS = 3;",
  "export const MAX_NEWS_AGE_YEARS = 3;"
);
src = src.replace(
  "const SITE_CONCURRENCY = 5;",
  "export const SITE_CONCURRENCY = 5;"
);
src = src.replace(
  "async function handleSearch",
  "export async function handleSearch"
);

// Drop GET/POST — route owns HTTP handlers
src = src.replace(/\r?\nexport async function GET\([\s\S]*$/m, "\n");

fs.writeFileSync(path, src);
console.log({
  lines: src.split(/\n/).length,
  handleSearch: /export async function handleSearch/.test(src),
  hasGet: /export async function GET/.test(src),
});
