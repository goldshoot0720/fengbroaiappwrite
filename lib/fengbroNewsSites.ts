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
    searchUrlTemplate: "https://leho.com.tw/?s={q}",
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
  {
    id: "tycg",
    name: "桃園市政府",
    domain: "tycg.gov.tw",
    homeUrl: "https://www.tycg.gov.tw/",
    adapter: "generic-keyword-url",
    searchUrlTemplate: "https://www.tycg.gov.tw/Advanced_Search.aspx?q={q}",
    locked: true,
  },
  {
    id: "bella",
    name: "Bella 儂儂",
    domain: "bella.tw",
    homeUrl: "https://www.bella.tw/",
    adapter: "generic-keyword-url",
    searchUrlTemplate: "https://www.bella.tw/search?q={q}",
    locked: true,
  },
  {
    id: "youtube-tbc-news-nty",
    name: "TBC 新聞 (NTY)",
    domain: "youtube.com",
    homeUrl: "https://www.youtube.com/@TBC-news-NTY/videos",
    adapter: "youtube-channel",
    locked: true,
  },
  {
    id: "youtube-pnnpts",
    name: "PNN 公視新聞網",
    domain: "youtube.com",
    homeUrl: "https://www.youtube.com/@PNNPTS/videos",
    adapter: "youtube-channel",
    locked: true,
  },
  {
    id: "youtube-beiken-vitality",
    name: "北健活力頻道",
    domain: "youtube.com",
    homeUrl: "https://www.youtube.com/@北健活力頻道/videos",
    adapter: "youtube-channel",
    locked: true,
  },
  {
    id: "youtube-nantaoyuantbc",
    name: "南桃園 TBC",
    domain: "youtube.com",
    homeUrl: "https://www.youtube.com/@nantaoyuantbc/videos",
    adapter: "youtube-channel",
    locked: true,
  },
  {
    id: "ey-gov",
    name: "行政院",
    domain: "ey.gov.tw",
    homeUrl: "https://www.ey.gov.tw/",
    adapter: "generic-keyword-url",
    // 新聞與公告列表；關鍵字命中靠列表掃 + Google News 備援
    searchUrlTemplate: "https://www.ey.gov.tw/Page/4EC20EEEEEAF363C",
    locked: true,
  },
  {
    id: "dorts-tycg",
    name: "桃園市政府捷運工程局",
    domain: "dorts.tycg.gov.tw",
    homeUrl: "https://dorts.tycg.gov.tw/",
    adapter: "generic-keyword-url",
    searchUrlTemplate: "https://dorts.tycg.gov.tw/News.aspx",
    locked: true,
  },
  {
    id: "hakkanews",
    name: "客新聞",
    domain: "hakkanews.tw",
    homeUrl: "https://hakkanews.tw/",
    adapter: "generic-keyword-url",
    searchUrlTemplate: "https://hakkanews.tw/?s={q}",
    locked: true,
  },
  {
    id: "mygo",
    name: "MyGo!",
    domain: "mygo.com",
    homeUrl: "https://www.mygo.com/",
    adapter: "generic-keyword-url",
    searchUrlTemplate: "https://www.mygo.com/?s={q}",
    locked: true,
  },
  {
    id: "businesstoday",
    name: "今周刊",
    domain: "businesstoday.com.tw",
    homeUrl: "https://www.businesstoday.com.tw/",
    adapter: "generic-keyword-url",
    searchUrlTemplate: "https://www.businesstoday.com.tw/search?q={q}",
    locked: true,
  },
  {
    id: "yahoo-news-tw",
    name: "Yahoo奇摩新聞",
    domain: "tw.news.yahoo.com",
    homeUrl: "https://tw.news.yahoo.com/",
    adapter: "generic-keyword-url",
    searchUrlTemplate: "https://tw.news.yahoo.com/search?p={q}",
    locked: true,
  },
  {
    id: "homeplus-news",
    name: "住商新聞",
    domain: "news.homeplus.net.tw",
    homeUrl: "https://news.homeplus.net.tw/",
    adapter: "generic-keyword-url",
    searchUrlTemplate: "https://news.homeplus.net.tw/?s={q}",
    locked: true,
  },
  {
    id: "tycc",
    name: "桃園市議會",
    domain: "tycc.gov.tw",
    homeUrl: "https://www.tycc.gov.tw/",
    adapter: "generic-keyword-url",
    searchUrlTemplate: "https://www.tycc.gov.tw/home.jsp?id=45&q={q}",
    locked: true,
  },
  {
    id: "motc",
    name: "交通部",
    domain: "motc.gov.tw",
    homeUrl: "https://www.motc.gov.tw/",
    adapter: "generic-keyword-url",
    // 新聞稿列表；關鍵字靠掃描 + Google News 備援
    searchUrlTemplate: "https://www.motc.gov.tw/ch/home.jsp?id=14&parentpath=0,2",
    locked: true,
  },
  // 桃園市政府 (tycg.gov.tw) 已於上方 id: "tycg" 登錄
  {
    id: "annewsmedia",
    name: "AN 新聞",
    domain: "annewsmedia.com",
    homeUrl: "https://annewsmedia.com/",
    adapter: "generic-keyword-url",
    searchUrlTemplate: "https://annewsmedia.com/?s={q}",
    locked: true,
  },
  {
    id: "housefun-news",
    name: "好房網新聞",
    domain: "news.housefun.com.tw",
    homeUrl: "https://news.housefun.com.tw/",
    adapter: "generic-keyword-url",
    searchUrlTemplate: "https://news.housefun.com.tw/search?q={q}",
    locked: true,
  },
  {
    id: "myhousing",
    name: "住展房屋網",
    domain: "myhousing.com.tw",
    homeUrl: "https://www.myhousing.com.tw/",
    adapter: "generic-keyword-url",
    searchUrlTemplate: "https://www.myhousing.com.tw/?s={q}",
    locked: true,
  },
  {
    id: "youtube-bv2dp",
    name: "BV2DP",
    domain: "youtube.com",
    homeUrl: "https://www.youtube.com/@bv2dp/videos",
    adapter: "youtube-channel",
    locked: true,
  },
  {
    id: "youtube-ttv-news",
    name: "台視新聞 TTV NEWS",
    domain: "youtube.com",
    homeUrl: "https://www.youtube.com/@TTV_NEWS/videos",
    adapter: "youtube-channel",
    locked: true,
  },
  {
    id: "leju",
    name: "樂居",
    domain: "leju.com.tw",
    homeUrl: "https://www.leju.com.tw/",
    adapter: "generic-keyword-url",
    searchUrlTemplate: "https://www.leju.com.tw/?s={q}",
    locked: true,
  },
  {
    id: "youtube-qianliyan",
    name: "千里眼新視界",
    domain: "youtube.com",
    homeUrl: "https://www.youtube.com/@千里眼新視界/videos",
    adapter: "youtube-channel",
    locked: true,
  },
  {
    id: "ptt-home-sale",
    name: "PTT 房屋板",
    domain: "ptt.cc",
    homeUrl: "https://www.ptt.cc/bbs/home-sale/index.html",
    adapter: "generic-keyword-url",
    searchUrlTemplate: "https://www.ptt.cc/bbs/home-sale/search?q={q}",
    locked: true,
  },
  {
    id: "ctee",
    name: "工商時報",
    domain: "ctee.com.tw",
    homeUrl: "https://www.ctee.com.tw/",
    adapter: "generic-keyword-url",
    searchUrlTemplate: "https://www.ctee.com.tw/search/{q}",
    locked: true,
  },
  {
    id: "tyenews",
    name: "桃園電子報",
    domain: "tyenews.com",
    homeUrl: "https://tyenews.com/",
    adapter: "generic-keyword-url",
    searchUrlTemplate: "https://tyenews.com/?s={q}",
    locked: true,
  },
  // 自由時報 (ltn.com.tw) 已於上方 id: "ltn" 登錄
  {
    id: "thehubnews",
    name: "樞紐新聞",
    domain: "thehubnews.net",
    homeUrl: "https://www.thehubnews.net/",
    adapter: "generic-keyword-url",
    searchUrlTemplate: "https://www.thehubnews.net/?s={q}",
    locked: true,
  },
  {
    id: "storm-new7",
    name: "新新聞",
    domain: "storm.mg",
    homeUrl: "https://new7.storm.mg/",
    adapter: "generic-keyword-url",
    searchUrlTemplate: "https://new7.storm.mg/?s={q}",
    locked: true,
  },
  {
    id: "youtube-ntyprogram-shorts",
    name: "年代向錢看 Shorts",
    domain: "youtube.com",
    homeUrl: "https://www.youtube.com/@ntyprogram/shorts",
    adapter: "youtube-channel",
    locked: true,
  },
  {
    id: "mobile01",
    name: "Mobile01",
    domain: "mobile01.com",
    homeUrl: "https://www.mobile01.com/",
    adapter: "generic-keyword-url",
    searchUrlTemplate: "https://www.mobile01.com/googlesearch.php?q={q}",
    locked: true,
  },
];

export const FENGBRO_NEWS_SITES_KEY = "fengbro.tools.news.sites";
export const FENGBRO_NEWS_QUERY_KEY = "fengbro.tools.news.query";

/** Built-in default source count (keep in sync with DEFAULT_FENGBRO_NEWS_SITES). */
export const DEFAULT_FENGBRO_NEWS_SITES_COUNT = DEFAULT_FENGBRO_NEWS_SITES.length;

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

/** Channel tab: videos (default) | shorts | streams | featured */
export function extractYouTubeChannelTab(homeUrl: string): "videos" | "shorts" | "streams" | "featured" {
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

/** Normalize YouTube channel URL; preserve /shorts|/streams when present. */
export function normalizeYouTubeChannelUrl(input: string): string {
  const raw = (input || "").trim();
  if (!raw) return "";

  // Bare handle → videos tab
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
    const tabMatch = path.match(/\/(videos|shorts|streams|featured)$/i);
    const tab = tabMatch ? tabMatch[1].toLowerCase() : "videos";

    const handle = path.match(/^\/@([^/]+)/)?.[1];
    if (handle) return `https://www.youtube.com/@${handle}/${tab}`;

    const channelId = path.match(/^\/channel\/(UC[\w-]+)/)?.[1];
    if (channelId) return `https://www.youtube.com/channel/${channelId}/${tab}`;

    const legacy = path.match(/^\/(?:c|user)\/([^/]+)/)?.[1];
    if (legacy) return `https://www.youtube.com/@${legacy}/${tab}`;

    // /videos alone or channel root
    if (path === "" || path === "/") return "";
    if (/\/(videos|shorts|streams|featured)$/i.test(path)) {
      return `https://www.youtube.com${path}`;
    }
    return `https://www.youtube.com${path}/videos`;
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
    const ch = extractYouTubeChannelKey(site.homeUrl) || site.id || site.homeUrl;
    const tab = extractYouTubeChannelTab(site.homeUrl);
    // Allow same channel videos + shorts as two sources
    return `yt:${ch}:${tab}`.toLowerCase();
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
  const ytTab = isYt ? extractYouTubeChannelTab(homeUrl) : "videos";
  const id =
    (input.id || "").trim() ||
    (isYt && ytKey
      ? `youtube-${ytKey.replace(/[^a-z0-9._-]+/gi, "-").toLowerCase()}${ytTab !== "videos" ? `-${ytTab}` : ""}`
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
