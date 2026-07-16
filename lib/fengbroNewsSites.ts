export type FengbroNewsAdapter =
  | "tycg-traffic"
  | "rb-nreo"
  | "tycg-zhongli"
  | "youtube-channel"
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

/** Default locked sources: 公部門 + 主流新聞 + YouTube + PTT 鐵路 */
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
  {
    id: "youtube-tnews6460",
    name: "TNEWS聯播網",
    domain: "youtube.com",
    homeUrl: "https://www.youtube.com/@tnews6460/videos",
    adapter: "youtube-channel",
    locked: true,
  },
  {
    id: "ptt-railway",
    name: "PTT 鐵路板",
    domain: "ptt.cc",
    homeUrl: "https://www.ptt.cc/bbs/Railway/index.html",
    adapter: "generic-keyword-url",
    searchUrlTemplate: "https://www.ptt.cc/bbs/Railway/search?q={q}",
    locked: true,
  },
  {
    id: "ltn",
    name: "自由時報",
    domain: "ltn.com.tw",
    homeUrl: "https://www.ltn.com.tw/",
    adapter: "generic-keyword-url",
    searchUrlTemplate: "https://search.ltn.com.tw/list?keyword={q}",
    locked: true,
  },
  {
    id: "youtube-ntyprogram",
    name: "年代向錢看",
    domain: "youtube.com",
    homeUrl: "https://www.youtube.com/@ntyprogram/videos",
    adapter: "youtube-channel",
    locked: true,
  },
  {
    id: "chinatimes",
    name: "中時新聞網",
    domain: "chinatimes.com",
    homeUrl: "https://www.chinatimes.com/?chdtv",
    adapter: "generic-keyword-url",
    searchUrlTemplate: "https://www.chinatimes.com/search/{q}?chdtv",
    locked: true,
  },
  {
    id: "leho",
    name: "樂活",
    domain: "leho.com.tw",
    homeUrl: "https://leho.com.tw/",
    adapter: "generic-keyword-url",
    locked: true,
  },
  {
    id: "udn",
    name: "聯合新聞網",
    domain: "udn.com",
    homeUrl: "https://udn.com/news/index",
    adapter: "generic-keyword-url",
    searchUrlTemplate: "https://udn.com/search/word/2/{q}",
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

export function isYouTubeHost(domainOrUrl: string): boolean {
  const d = normalizeDomain(domainOrUrl);
  return d === "youtube.com" || d === "youtu.be" || d === "m.youtube.com" || d.endsWith(".youtube.com");
}

/** Extract @handle / channel/UC / @ from URL. */
export function extractYouTubeChannelKey(homeUrl: string): string {
  try {
    const url = new URL(homeUrl);
    const path = decodeURIComponent(url.pathname);
    const handle = path.match(/^\/@([^/]+)/)?.[1];
    if (handle) return handle.toLowerCase();
    const channelId = path.match(/^\/channel\/(UC[\w-]+)/)?.[1];
    if (channelId) return channelId;
    const user = path.match(/^\/(?:c|user)\/([^/]+)/)?.[1];
    if (user) return user.toLowerCase();
  } catch {
    // fall through
  }
  return "";
}

/** Normalize YouTube channel URL to https://www.youtube.com/@handle/videos form when possible. */
export function normalizeYouTubeChannelUrl(input: string): string {
  const raw = (input || "").trim();
  if (!raw) return "";

  // Bare handle
  if (raw.startsWith("@")) {
    return `https://www.youtube.com/${encodeURI(raw)}/videos`;
  }

  try {
    let url: URL;
    if (/^https?:\/\//i.test(raw)) {
      url = new URL(raw);
    } else if (/youtube\.com|youtu\.be/i.test(raw)) {
      url = new URL(`https://${raw.replace(/^\/\//, "")}`);
    } else {
      return "";
    }

    if (!isYouTubeHost(url.hostname)) return "";

    const path = decodeURIComponent(url.pathname).replace(/\/+$/, "");
    const handle = path.match(/^\/@([^/]+)/)?.[1];
    if (handle) return `https://www.youtube.com/@${handle}/videos`;

    const channelId = path.match(/^\/channel\/(UC[\w-]+)/)?.[1];
    if (channelId) return `https://www.youtube.com/channel/${channelId}/videos`;

    const legacy = path.match(/^\/(?:c|user)\/([^/]+)/)?.[1];
    if (legacy) return `https://www.youtube.com/@${legacy}/videos`;

    // /videos alone or channel root
    if (path === "" || path === "/") return "";
    return `https://www.youtube.com${path}${/\/videos$/i.test(path) ? "" : "/videos"}`;
  } catch {
    return "";
  }
}

/** Normalize a home/list URL; accept domain-only input. */
export function normalizeHomeUrl(input: string): string {
  const raw = (input || "").trim();
  if (!raw) return "";

  const yt = normalizeYouTubeChannelUrl(raw);
  if (yt) return yt;

  try {
    if (/^https?:\/\//i.test(raw)) {
      const url = new URL(raw);
      return url.toString().replace(/\/$/, "") || url.origin;
    }
  } catch {
    // fall through
  }
  const domain = normalizeDomain(raw);
  return domain ? `https://${domain}` : "";
}

/** Infer specialized adapter from known domains / URLs. */
export function guessFengbroNewsAdapter(domainOrUrl: string): FengbroNewsAdapter {
  if (isYouTubeHost(domainOrUrl) || normalizeYouTubeChannelUrl(domainOrUrl)) {
    return "youtube-channel";
  }
  const d = normalizeDomain(domainOrUrl);
  if (d === "traffic.tycg.gov.tw" || d.endsWith(".traffic.tycg.gov.tw")) return "tycg-traffic";
  if (d === "rb.gov.tw" || d.endsWith(".rb.gov.tw")) return "rb-nreo";
  if (d === "zhongli.tycg.gov.tw" || d.endsWith(".zhongli.tycg.gov.tw")) return "tycg-zhongli";
  return "generic-keyword-url";
}

/** Friendly default name when user only pastes a URL. */
export function guessSiteNameFromUrl(homeUrl: string, domain: string): string {
  const ytKey = extractYouTubeChannelKey(homeUrl);
  if (ytKey) return ytKey.startsWith("UC") ? `YouTube ${ytKey.slice(0, 12)}` : `@${ytKey}`;
  try {
    if (homeUrl) {
      const host = new URL(homeUrl).hostname.replace(/^www\./, "");
      if (host) return host;
    }
  } catch {
    // fall through
  }
  return domain || "未命名網站";
}

/** Unique key for dedupe (YouTube channels / PTT boards share parent domains). */
export function fengbroNewsSiteKey(site: Pick<FengbroNewsSiteConfig, "id" | "domain" | "homeUrl" | "adapter">): string {
  if (site.adapter === "youtube-channel" || isYouTubeHost(site.domain) || isYouTubeHost(site.homeUrl)) {
    return `yt:${extractYouTubeChannelKey(site.homeUrl) || site.id || site.homeUrl}`.toLowerCase();
  }
  // PTT boards: /bbs/Railway/...
  try {
    const host = normalizeDomain(site.homeUrl || site.domain);
    if (host === "ptt.cc" || host.endsWith(".ptt.cc")) {
      const board = new URL(site.homeUrl).pathname.match(/\/bbs\/([^/]+)/i)?.[1];
      if (board) return `ptt:${board.toLowerCase()}`;
    }
  } catch {
    // fall through
  }
  if (site.id) return `id:${site.id}`;
  return normalizeDomain(site.domain) || site.homeUrl;
}

function finalizeHomeUrl(homeUrl: string, isYt: boolean): string {
  if (isYt) return normalizeYouTubeChannelUrl(homeUrl) || homeUrl;
  // Don't append slash after .html / query strings
  if (/\.(html?|aspx|php|jsp)(\?|#|$)/i.test(homeUrl)) return homeUrl;
  if (homeUrl.includes("?")) return homeUrl;
  return homeUrl.endsWith("/") ? homeUrl : `${homeUrl}/`;
}

export function normalizeFengbroNewsSite(
  input: Partial<FengbroNewsSiteConfig> & { name?: string; domain?: string }
): FengbroNewsSiteConfig | null {
  const homeUrl = normalizeHomeUrl(input.homeUrl || input.domain || "");
  if (!homeUrl) return null;

  const domain = normalizeDomain(homeUrl);
  if (!domain) return null;

  const isYt = isYouTubeHost(domain) || Boolean(normalizeYouTubeChannelUrl(homeUrl));
  const name = (input.name || "").trim() || guessSiteNameFromUrl(homeUrl, domain);
  const guessed = guessFengbroNewsAdapter(homeUrl);
  const adapter = (input.adapter || guessed) as FengbroNewsAdapter;

  const ytKey = extractYouTubeChannelKey(homeUrl);
  const id =
    (input.id || "").trim() ||
    (isYt && ytKey
      ? `youtube-${ytKey.replace(/[^a-z0-9._-]+/gi, "-").toLowerCase()}`
      : domain.replace(/[^a-z0-9.-]+/gi, "-").replace(/^-|-$/g, "")) ||
    `site-${Date.now()}`;

  return {
    id,
    name,
    domain,
    homeUrl: finalizeHomeUrl(homeUrl, isYt),
    adapter: isYt ? "youtube-channel" : adapter,
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
    const key = fengbroNewsSiteKey(site);
    if (seen.has(key)) continue;
    seen.add(key);
    sites.push(site);
  }

  // Merge in newly shipped default sources (e.g. YouTube) that older localStorage may lack.
  for (const def of DEFAULT_FENGBRO_NEWS_SITES) {
    const key = fengbroNewsSiteKey(def);
    if (seen.has(key)) continue;
    seen.add(key);
    sites.push({ ...def });
  }

  return sites.length > 0 ? sites : DEFAULT_FENGBRO_NEWS_SITES.map((s) => ({ ...s }));
}

export function getLockedFengbroNewsSites(sites: FengbroNewsSiteConfig[]) {
  return sites.filter((site) => site.locked);
}
