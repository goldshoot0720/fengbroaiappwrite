export type FengbroTubeChannelConfig = {
  alias: string;
  sourceUrl: string;
};

export const FENGBRO_TUBE_TITLE_OVERRIDES: Record<string, string> = {
  sjdiao: "习书记",
  henren778: "一个狠人",
  libertas1984: "Cao Cao's daily observation",
  sunlao: "政經孫老師",
  torontobigface: "多伦多方脸",
  junyulan: "君語瀾 JunYuLan",
  blackwhite_raven: "黑白乌鸦",
  quedaren: "雀大人 | Miss. Mi",
  夸克说: "夸克说",
  喵喵看一看: "小喵看一看「怪事先生」",
  jlaw: "夏河東渡",
  sunchannelhk: "Sun Channel",
  jilixiaoshimei: "吉利小师妹",
  informant510: "线人频道Informant",
  "ma-siku": "马司库",
  monsterise: "怪獸崛起 MONSTERISE",
  neixianzhang: "張内咸脫口秀",
  修仙者小烨: "修仙者小烨",
  xiaoye1757: "修炼者小烨",
  cheapaoe: "cheap",
  storytellerhk: "StorytellerHK 說書客",
  mrshenofficial: "公子沈 Terence Shen",
  jiangtaigong: "加州姜太公NEWS",
  gc趙氏讀書生活: "Gavinchiu趙氏讀書生活",
};

const DEFAULT_FENGBRO_TUBE_CHANNEL_URLS = [
  "https://www.youtube.com/@SJdiao/videos",
  "https://www.youtube.com/@henren778",
  "https://www.youtube.com/@libertas1984/videos",
  "https://www.youtube.com/@sunlao/videos",
  "https://www.youtube.com/@Torontobigface/videos",
  "https://www.youtube.com/@junyulan/videos",
  "https://www.youtube.com/@blackwhite_raven/videos",
  "https://www.youtube.com/@quedaren/videos",
  "https://www.youtube.com/@%E5%A4%B8%E5%85%8B%E8%AF%B4",
  "https://www.youtube.com/@%E5%96%B5%E5%96%B5%E7%9C%8B%E4%B8%80%E7%9C%8B/videos",
  "https://www.youtube.com/@jlaw/videos",
  "https://www.youtube.com/@SunChannelHK/videos",
  "https://www.youtube.com/@jilixiaoshimei/videos",
  "https://www.youtube.com/@informant510/videos",
  "https://www.youtube.com/@ma-siku/videos",
  "https://www.youtube.com/@monsterise/videos",
  "https://www.youtube.com/@NeixianZhang/videos",
  "https://www.youtube.com/@%E4%BF%AE%E4%BB%99%E8%80%85%E5%B0%8F%E7%83%A8/videos",
  "https://www.youtube.com/@xiaoye1757/videos",
  "https://www.youtube.com/@cheapaoe/videos",
  "https://www.youtube.com/@StorytellerHK/videos",
  "https://www.youtube.com/@mrshenofficial/videos",
  "https://www.youtube.com/@jiangtaigong/videos",
  "https://www.youtube.com/@GC%E8%B6%99%E6%B0%8F%E8%AE%80%E6%9B%B8%E7%94%9F%E6%B4%BB",
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
      if (!/youtube\.com$/i.test(url.hostname) && !/\.youtube\.com$/i.test(url.hostname)) return "";
      return url.toString().replace(/\/$/, "").replace(/\/videos$/i, "/videos");
    } catch {
      return "";
    }
  }

  return `https://www.youtube.com/@${encodeURIComponent(trimmedInput)}/videos`;
}

export function getFengbroTubeHandle(sourceUrl: string) {
  try {
    const path = decodeURIComponent(new URL(sourceUrl).pathname);
    return path.match(/^\/@([^/]+)/)?.[1].toLowerCase() || "";
  } catch {
    return "";
  }
}

export function getFengbroTubeAlias(sourceUrl: string, fallback = "") {
  const handle = getFengbroTubeHandle(sourceUrl);
  return FENGBRO_TUBE_TITLE_OVERRIDES[handle] || fallback;
}

export function getFengbroTubeFallbackTitle(sourceUrl: string, fallback = "") {
  return getFengbroTubeAlias(sourceUrl) || fallback || getFengbroTubeHandle(sourceUrl) || sourceUrl;
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
  const normalizedAlias = alias === "未命名頻道" ? "" : alias;
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
