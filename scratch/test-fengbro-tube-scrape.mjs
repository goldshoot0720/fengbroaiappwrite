const YOUTUBE_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "zh-TW,zh;q=0.9,en;q=0.8",
};

function collectVideoRenderers(node, out = []) {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const item of node) collectVideoRenderers(item, out);
    return out;
  }
  if (node.videoRenderer || node.gridVideoRenderer || node.richItemRenderer?.content?.videoRenderer) {
    const renderer =
      node.videoRenderer ||
      node.gridVideoRenderer ||
      node.richItemRenderer?.content?.videoRenderer;
    if (renderer?.videoId) out.push(renderer);
  }
  for (const value of Object.values(node)) collectVideoRenderers(value, out);
  return out;
}

function textFromRuns(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value.simpleText === "string") return value.simpleText;
  if (Array.isArray(value.runs)) return value.runs.map((run) => run.text || "").join("");
  return "";
}

function parseVideosFromHtml(html) {
  const match = html.match(/ytInitialData\s*=\s*(\{.+?\});<\/script>/s);
  if (!match) return [];
  const data = JSON.parse(match[1]);
  const renderers = collectVideoRenderers(data);
  const seen = new Set();
  const videos = [];
  for (const renderer of renderers) {
    const videoId = renderer.videoId;
    if (!videoId || seen.has(videoId)) continue;
    // skip shorts-only style if overlay indicates shorts? keep for now but filter /shorts later
    const title = textFromRuns(renderer.title) || textFromRuns(renderer.headline);
    if (!title) continue;
    const publishedAtText = textFromRuns(renderer.publishedTimeText);
    const thumbnail =
      renderer.thumbnail?.thumbnails?.slice(-1)?.[0]?.url ||
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    const isShort =
      renderer.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url?.includes("/shorts/") ||
      renderer.thumbnailOverlays?.some((overlay) =>
        JSON.stringify(overlay).includes("SHORTS")
      );
    if (isShort) continue;
    seen.add(videoId);
    videos.push({
      videoId,
      title,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      publishedAtText,
      thumbnail: thumbnail.startsWith("//") ? `https:${thumbnail}` : thumbnail,
    });
    if (videos.length >= 10) break;
  }
  return videos;
}

const urls = [
  "https://www.youtube.com/@sunlao/videos",
  "https://www.youtube.com/@henren778/videos",
  "https://www.youtube.com/@blackwhite_raven/videos",
];

for (const sourceUrl of urls) {
  const response = await fetch(sourceUrl, { headers: YOUTUBE_HEADERS });
  const html = await response.text();
  const videos = parseVideosFromHtml(html);
  console.log("\n===", sourceUrl, "status", response.status, "videos", videos.length, "===");
  console.log(JSON.stringify(videos.slice(0, 3), null, 2));
}
