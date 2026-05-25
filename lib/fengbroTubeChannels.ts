export const DEFAULT_FENGBRO_TUBE_CHANNEL_SOURCES = [
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
];

export const FENGBRO_TUBE_TITLE_OVERRIDES: Record<string, string> = {
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
};

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

export function dedupeFengbroTubeSources(sources: string[]) {
  return Array.from(new Set(sources.map(normalizeFengbroTubeSource).filter(Boolean)));
}
