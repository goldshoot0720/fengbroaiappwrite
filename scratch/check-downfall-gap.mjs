import {
  extractDownfallIndex,
  KNOWN_DOWNFALL_INDEX_BY_VIDEO_ID,
  DOWNFALL_INDEX_BASELINE_HISTORY,
} from "../lib/downfallIndex.ts";

const headers = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "zh-TW,zh;q=0.9,en;q=0.8",
};

function extractJsonObjectAfterMarker(html, marker) {
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return null;
  const equalsIndex = html.indexOf("=", markerIndex + marker.length);
  if (equalsIndex < 0) return null;
  let start = equalsIndex + 1;
  while (start < html.length && /\s/.test(html[start])) start += 1;
  if (html[start] !== "{") return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function walk(node, visitor) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) walk(item, visitor);
    return;
  }
  visitor(node);
  for (const v of Object.values(node)) walk(v, visitor);
}

function textFrom(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value.simpleText === "string") return value.simpleText;
  if (typeof value.content === "string") return value.content;
  if (Array.isArray(value.runs)) return value.runs.map((r) => r.text || "").join("");
  return "";
}

function parseRelativeTime(text) {
  if (!text) return null;
  const now = Date.now();
  const m = text.match(
    /(\d+)\s*(second|minute|hour|day|week|month|year|秒|分鐘|分钟|小時|小时|天|日|週|周|個月|个月|月|年)/i
  );
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const ms = /second|秒/.test(unit)
    ? n * 1000
    : /minute|分鐘|分钟/.test(unit)
      ? n * 60 * 1000
      : /hour|小時|小时/.test(unit)
        ? n * 3600 * 1000
        : /day|天|日/.test(unit)
          ? n * 86400 * 1000
          : /week|週|周/.test(unit)
            ? n * 7 * 86400 * 1000
            : /month|個月|个月|月/.test(unit)
              ? n * 30 * 86400 * 1000
              : /year|年/.test(unit)
                ? n * 365 * 86400 * 1000
                : 0;
  return new Date(now - ms).toISOString();
}

function formatDuration(ms) {
  const totalDays = Math.round(ms / 86400000);
  const months = Math.floor(totalDays / 30);
  const days = totalDays % 30;
  if (months > 0) return `${totalDays} 天（約 ${months} 個月又 ${days} 天）`;
  return `${totalDays} 天`;
}

const url =
  "https://www.youtube.com/@henren778/search?query=" + encodeURIComponent("倒台指數");
const res = await fetch(url, { headers, cache: "no-store" });
const html = await res.text();
console.log("status", res.status, "len", html.length);

const data = extractJsonObjectAfterMarker(html, "ytInitialData");
const videos = [];
const seen = new Set();

if (data) {
  walk(data, (node) => {
    const lockup = node.lockupViewModel;
    const renderer = node.videoRenderer || node.gridVideoRenderer;
    if (lockup) {
      const watchUrl =
        lockup.rendererContext?.commandContext?.onTap?.innertubeCommand?.commandMetadata
          ?.webCommandMetadata?.url || "";
      const videoId =
        lockup.contentId ||
        lockup.rendererContext?.commandContext?.onTap?.innertubeCommand?.watchEndpoint?.videoId ||
        watchUrl.match(/[?&]v=([\w-]{11})/)?.[1] ||
        "";
      if (!videoId || seen.has(videoId)) return;
      const title =
        textFrom(lockup.metadata?.lockupMetadataViewModel?.title) || textFrom(lockup.title);
      if (!title || !/倒台指[數数]/.test(title)) return;
      const rows =
        lockup.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel
          ?.metadataRows || [];
      const meta = rows
        .flatMap((row) => (row.metadataParts || []).map((p) => textFrom(p.text)))
        .filter(Boolean);
      seen.add(videoId);
      videos.push({
        videoId,
        title,
        meta,
        publishedText:
          meta.find((t) => /前|ago|天|週|周|月|年|小時|小时|分鐘|分钟/.test(t)) ||
          meta[0] ||
          "",
      });
    }
    if (renderer) {
      const videoId = renderer.videoId;
      if (!videoId || seen.has(videoId)) return;
      const title = textFrom(renderer.title);
      if (!title || !/倒台指[數数]/.test(title)) return;
      seen.add(videoId);
      const publishedText = textFrom(renderer.publishedTimeText);
      videos.push({
        videoId,
        title,
        meta: [publishedText, textFrom(renderer.viewCountText)].filter(Boolean),
        publishedText,
      });
    }
  });
}

const resolved = videos
  .map((v) => {
    const value =
      extractDownfallIndex(v.title) || KNOWN_DOWNFALL_INDEX_BY_VIDEO_ID[v.videoId]?.value || "";
    const known = KNOWN_DOWNFALL_INDEX_BY_VIDEO_ID[v.videoId];
    const publishedAt = known?.publishedAt || parseRelativeTime(v.publishedText) || "";
    return { ...v, value, publishedAt };
  })
  .filter((v) => v.value && v.publishedAt);

// de-dupe by value+date roughly, keep earliest published for same price if needed
resolved.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

console.log(
  "resolved",
  JSON.stringify(
    resolved.slice(0, 20).map((v) => ({
      value: v.value,
      publishedAt: v.publishedAt,
      publishedText: v.publishedText,
      title: v.title.slice(0, 80),
      videoId: v.videoId,
    })),
    null,
    2
  )
);

// Also merge baseline history for context
const byKey = new Map();
for (const point of DOWNFALL_INDEX_BASELINE_HISTORY) {
  byKey.set(`${point.price.toFixed(2)}|${point.date}`, {
    value: point.price.toFixed(2),
    publishedAt: point.date,
    source: "baseline",
    title: "baseline",
  });
}
for (const v of resolved) {
  byKey.set(`${v.value}|${v.publishedAt}`, {
    value: v.value,
    publishedAt: v.publishedAt,
    source: "youtube",
    title: v.title,
    videoId: v.videoId,
    publishedText: v.publishedText,
  });
}
const all = [...byKey.values()].sort(
  (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)
);

console.log("\n=== ALL MERGED (latest first) ===");
for (const item of all.slice(0, 12)) {
  console.log(
    item.value,
    item.publishedAt,
    item.publishedText || "",
    (item.title || "").slice(0, 50)
  );
}

if (all.length >= 2) {
  const latest = all[0];
  const prev = all[1];
  const gapMs = new Date(latest.publishedAt) - new Date(prev.publishedAt);
  console.log("\n=== GAP BETWEEN LAST TWO ===");
  console.log("latest:", latest.value, latest.publishedAt, latest.publishedText || "", (latest.title || "").slice(0, 60));
  console.log("prev:  ", prev.value, prev.publishedAt, prev.publishedText || "", (prev.title || "").slice(0, 60));
  console.log("gap_days_rounded:", Math.round(gapMs / 86400000));
  console.log("gap_label:", formatDuration(gapMs));
}
