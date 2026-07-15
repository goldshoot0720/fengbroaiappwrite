export type FengbroTubeChannelConfig = {
  alias: string;
  sourceUrl: string;
};

export const FENGBRO_TUBE_TITLE_OVERRIDES: Record<string, string> = {
  henren778: "一个狠人",
  libertas1984: "Cao Cao's daily observation",
  sunlao: "政經孫老師",
  blackwhite_raven: "黑白乌鸦",

  informant510: "线人频道Informant",
  "ma-siku": "马司库",
  monsterise: "怪獸崛起 MONSTERISE",
  tankman2020: "二爷故事",
};

const DEFAULT_FENGBRO_TUBE_CHANNEL_URLS = [
  "https://www.youtube.com/@libertas1984/videos",
  "https://www.youtube.com/@sunlao/videos",
  "https://www.youtube.com/@blackwhite_raven/videos",

  "https://www.youtube.com/@informant510/videos",
  "https://www.youtube.com/@ma-siku/videos",
  "https://www.youtube.com/@monsterise/videos",
  "https://www.youtube.com/@Tankman2020/videos",
];

export function normalizeFengbroTubeSource(input: string) {
  const trimmedInput = input.trim();
  if (!trimmedInput) return "";

  if (trimmedInput.startsWith("@")) {
    return `https://www.youtube.com/${encodeURI(trimmedInput)}/videos`;
  }

  if (/^https?:\/\//i.test(trimmedInput)) {
    try {
      const url = new URL(trimmedInput);
      const isYouTube = /youtube\.com$/i.test(url.hostname) || /\.youtube\.com$/i.test(url.hostname);
      const isBilibili = /bilibili\.com$/i.test(url.hostname) || /\.bilibili\.com$/i.test(url.hostname);
      if (!isYouTube && !isBilibili) return "";
      if (isBilibili) return url.toString().replace(/\/$/, "");
      return url.toString().replace(/\/$/, "").replace(/\/videos$/i, "/videos");
    } catch {
      return "";
    }
  }

  return `https://www.youtube.com/@${encodeURIComponent(trimmedInput)}/videos`;
}

export function getFengbroTubeHandle(sourceUrl: string) {
  try {
    const url = new URL(sourceUrl);
    const path = decodeURIComponent(url.pathname);
    if (/bilibili\.com$/i.test(url.hostname) || /\.bilibili\.com$/i.test(url.hostname)) {
      return path.match(/^\/(\d+)/)?.[1] || "";
    }
    return path.match(/^\/@([^/]+)/)?.[1].toLowerCase() || "";
  } catch {
    return "";
  }
}

export function isBrokenFengbroTubeTitle(title: string) {
  return /Error\s*\d+\s*\(|Not Found|Server Error|!!1/i.test(title || "");
}

export function getFengbroTubeAlias(sourceUrl: string, fallback = "") {
  const handle = getFengbroTubeHandle(sourceUrl);
  return FENGBRO_TUBE_TITLE_OVERRIDES[handle] || fallback;
}

export function getFengbroTubeFallbackTitle(sourceUrl: string, fallback = "") {
  const cleanedFallback = isBrokenFengbroTubeTitle(fallback) ? "" : fallback.trim();
  return getFengbroTubeAlias(sourceUrl) || cleanedFallback || getFengbroTubeHandle(sourceUrl) || sourceUrl;
}

export function toFengbroTubeChannelConfig(input: unknown): FengbroTubeChannelConfig | null {
  if (typeof input === "string") {
    const sourceUrl = normalizeFengbroTubeSource(input);
    if (!sourceUrl) return null;
    return { alias: getFengbroTubeAlias(sourceUrl), sourceUrl };
  }

  if (!input || typeof input !== "object") return null;
  const value = input as { alias?: unknown; sourceUrl?: unknown; url?: unknown };
  const sourceInput = typeof value.sourceUrl === "string" ? value.sourceUrl : typeof value.url === "string" ? value.url : "";
  const sourceUrl = normalizeFengbroTubeSource(sourceInput);
  if (!sourceUrl) return null;

  const alias = typeof value.alias === "string" ? value.alias.trim() : "";
  const normalizedAlias =
    !alias || alias === "未命名頻道" || isBrokenFengbroTubeTitle(alias) ? "" : alias;
  return { alias: normalizedAlias || getFengbroTubeAlias(sourceUrl), sourceUrl };
}

export function normalizeFengbroTubeChannels(inputs: unknown[]) {
  const channels: FengbroTubeChannelConfig[] = [];
  const seen = new Set<string>();

  for (const input of inputs) {
    const channel = toFengbroTubeChannelConfig(input);
    if (!channel || seen.has(channel.sourceUrl)) continue;
    seen.add(channel.sourceUrl);
    channels.push(channel);
  }

  return channels;
}

export function dedupeFengbroTubeSources(sources: string[]) {
  return normalizeFengbroTubeChannels(sources).map((channel) => channel.sourceUrl);
}

export const DEFAULT_FENGBRO_TUBE_CHANNELS = normalizeFengbroTubeChannels(DEFAULT_FENGBRO_TUBE_CHANNEL_URLS);

export const DEFAULT_FENGBRO_TUBE_CHANNEL_SOURCES = DEFAULT_FENGBRO_TUBE_CHANNELS.map((channel) => channel.sourceUrl);
