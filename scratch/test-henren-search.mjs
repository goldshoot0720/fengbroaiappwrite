const headers = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "zh-TW,zh;q=0.9,en;q=0.8",
};

const url = "https://www.youtube.com/@henren778/search?query=" + encodeURIComponent("倒台指數");
const res = await fetch(url, { headers, cache: "no-store" });
const html = await res.text();
console.log("status", res.status, "len", html.length);

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

const data = extractJsonObjectAfterMarker(html, "ytInitialData");
const videos = [];
const seen = new Set();
if (data) {
  walk(data, (node) => {
    const lockup = node.lockupViewModel;
    const renderer = node.videoRenderer || node.gridVideoRenderer;
    if (lockup) {
      const watchUrl =
        lockup.rendererContext?.commandContext?.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata
          ?.url || "";
      const videoId =
        lockup.contentId ||
        lockup.rendererContext?.commandContext?.onTap?.innertubeCommand?.watchEndpoint?.videoId ||
        watchUrl.match(/[?&]v=([\w-]{11})/)?.[1] ||
        "";
      if (!videoId || seen.has(videoId)) return;
      const title =
        textFrom(lockup.metadata?.lockupMetadataViewModel?.title) || textFrom(lockup.title);
      if (!title || !/倒台指[數数]/.test(title)) return;
      const rows = lockup.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows || [];
      const meta = rows.flatMap((row) => (row.metadataParts || []).map((p) => textFrom(p.text))).filter(Boolean);
      seen.add(videoId);
      videos.push({ videoId, title: title.slice(0, 80), meta });
    }
    if (renderer) {
      const videoId = renderer.videoId;
      if (!videoId || seen.has(videoId)) return;
      const title = textFrom(renderer.title);
      if (!title || !/倒台指[數数]/.test(title)) return;
      seen.add(videoId);
      videos.push({
        videoId,
        title: title.slice(0, 80),
        meta: [textFrom(renderer.publishedTimeText), textFrom(renderer.viewCountText)].filter(Boolean),
      });
    }
  });
}

console.log("videos", videos.length);
console.log(JSON.stringify(videos.slice(0, 12), null, 2));
