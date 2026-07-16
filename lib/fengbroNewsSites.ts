export type FengbroNewsAdapter =
  | "tycg-traffic"
  | "rb-nreo"
  | "tycg-zhongli"
  | "generic-keyword-url";

export type FengbroNewsSiteConfig = {
  /** Stable id for localStorage / API */
  id: string;
  /** Display name, e.g. 桃園市政府交通局 */
  name: string;
  /** Host used for focus lock matching */
  domain: string;
  /** Home / portal URL */
  homeUrl: string;
  /** How the backend scrapes this site */
  adapter: FengbroNewsAdapter;
  /**
   * For generic-keyword-url: list URL with `{q}` placeholder
   * (already encoded or raw — backend encodes when substituting).
   */
  searchUrlTemplate?: string;
  /** When false, site is unlocked (not included in focused search). */
  locked: boolean;
};

/** Example focus lock set: 中新地下道 相關公部門網站 */
export const DEFAULT_FENGBRO_NEWS_SITES: FengbroNewsSiteConfig[] = [
  {
    id: "tycg-traffic",
    name: "桃園市政府交通局",
    domain: "traffic.tycg.gov.tw",
    homeUrl: "https://traffic.tycg.gov.tw/",
    adapter: "tycg-traffic",
    locked: true,
  },
  {
    id: "rb-nreo",
    name: "交通部鐵道局北部工程分局",
    domain: "rb.gov.tw",
    homeUrl: "https://www.rb.gov.tw/zh-TW/NREO/",
    adapter: "rb-nreo",
    locked: true,
  },
  {
    id: "tycg-zhongli",
    name: "桃園市中壢區公所",
    domain: "zhongli.tycg.gov.tw",
    homeUrl: "https://www.zhongli.tycg.gov.tw/",
    adapter: "tycg-zhongli",
    locked: true,
  },
];

export const FENGBRO_NEWS_SITES_KEY = "fengbro.tools.news.sites";
export const FENGBRO_NEWS_QUERY_KEY = "fengbro.tools.news.query";

export function normalizeDomain(input: string): string {
  const raw = (input || "").trim().toLowerCase();
  if (!raw) return "";
  try {
    if (/^https?:\/\//i.test(raw)) {
      return new URL(raw).hostname.replace(/^www\./, "");
    }
  } catch {
    // fall through
  }
  return raw
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0]
    .trim();
}

export function normalizeFengbroNewsSite(
  input: Partial<FengbroNewsSiteConfig> & { name?: string; domain?: string }
): FengbroNewsSiteConfig | null {
  const name = (input.name || "").trim();
  const domain = normalizeDomain(input.domain || input.homeUrl || "");
  if (!name || !domain) return null;

  const adapter = (input.adapter || "generic-keyword-url") as FengbroNewsAdapter;
  const homeUrl =
    (input.homeUrl || "").trim() ||
    `https://${domain.startsWith("www.") ? domain : domain}/`;

  const id =
    (input.id || "").trim() ||
    domain.replace(/[^a-z0-9.-]+/gi, "-").replace(/^-|-$/g, "") ||
    `site-${Date.now()}`;

  return {
    id,
    name,
    domain,
    homeUrl,
    adapter,
    searchUrlTemplate: input.searchUrlTemplate?.trim() || undefined,
    locked: input.locked !== false,
  };
}

export function normalizeFengbroNewsSites(input: unknown): FengbroNewsSiteConfig[] {
  if (!Array.isArray(input)) return DEFAULT_FENGBRO_NEWS_SITES.map((s) => ({ ...s }));

  const seen = new Set<string>();
  const sites: FengbroNewsSiteConfig[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const site = normalizeFengbroNewsSite(item as Partial<FengbroNewsSiteConfig>);
    if (!site) continue;
    const key = site.domain;
    if (seen.has(key)) continue;
    seen.add(key);
    sites.push(site);
  }
  return sites.length > 0 ? sites : DEFAULT_FENGBRO_NEWS_SITES.map((s) => ({ ...s }));
}

export function getLockedFengbroNewsSites(sites: FengbroNewsSiteConfig[]) {
  return sites.filter((site) => site.locked);
}
