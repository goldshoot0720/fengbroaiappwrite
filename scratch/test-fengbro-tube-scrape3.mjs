const YOUTUBE_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "zh-TW,zh;q=0.9,en;q=0.8",
};

function walk(node, visitor) {
  if (!node || typeof node !== "object") return;
  visitor(node);
  if (Array.isArray(node)) {
    for (const item of node) walk(item, visitor);
    return;
  }
  for (const value of Object.values(node)) walk(value, visitor);
}

function textFrom(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value.simpleText === "string") return value.simpleText;
  if (typeof value.content === "string") return value.content;
  if (Array.isArray(value.runs)) return value.runs.map((run) => run.text || "").join("");
  return "";
}

function parseVideosFromHtml(html) {
  const match = html.match(/ytInitialData\s*=\s*(\{[\s\S]*?\})\s*;\s*(?:<\/script>|var\s+|window)/);
  if (!match) return { error: "no ytInitialData", videos: [] };
  let data;
  try {
    data = JSON.parse(match[1]);
  } catch (e) {
    return { error: `json parse: ${e.message}`, videos: [] };
  }

  const lockups = [];
  const videoRenderers = [];
  walk(data, (node) => {
    if (node.lockupViewModel) lockups.push(node.lockupViewModel);
    if (node.videoRenderer) videoRenderers.push(node.videoRenderer);
    if (node.gridVideoRenderer) videoRenderers.push(node.gridVideoRenderer);
  });

  const videos = [];
  const seen = new Set();

  for (const lockup of lockups) {
    const contentId = lockup.contentId || lockup.rendererContext?.commandContext?.onTap?.innertubeCommand?.watchEndpoint?.videoId;
    const watchUrl =
      lockup.rendererContext?.commandContext?.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url ||
      lockup.rendererContext?.commandContext?.onTap?.innertubeCommand?.watchEndpoint?.videoId
        ? `/watch?v=${lockup.rendererContext?.commandContext?.onTap?.innertubeCommand?.watchEndpoint?.videoId}`
        : "";
    const videoId =
      contentId ||
      lockup.rendererContext?.commandContext?.onTap?.innertubeCommand?.watchEndpoint?.videoId ||
      (typeof watchUrl === "string" ? watchUrl.match(/v=([\w-]{11})/)?.[1] : "") ||
      "";
    if (!videoId || seen.has(videoId) || videoId.length !== 11) continue;
    if (typeof watchUrl === "string" && watchUrl.includes("/shorts/")) continue;

    const title =
      textFrom(lockup.metadata?.lockupMetadataViewModel?.title) ||
      textFrom(lockup.title) ||
      textFrom(lockup.metadata?.title);
    const metadataRows = lockup.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows || [];
    const metaTexts = metadataRows.flatMap((row) =>
      (row.metadataParts || []).map((part) => textFrom(part.text)).filter(Boolean)
    );
    const publishedAtText = metaTexts.find((t) => /前|ago|天|小時|分钟|分鐘|週|周|月|年|streamed|直播/.test(t)) || metaTexts[metaTexts.length - 1] || "";
    const thumbnail =
      lockup.contentImage?.thumbnailViewModel?.image?.sources?.slice(-1)?.[0]?.url ||
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    if (!title) continue;
    seen.add(videoId);
    videos.push({
      videoId,
      title,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      publishedAtText,
      thumbnail: thumbnail.startsWith("//") ? `https:${thumbnail}` : thumbnail,
      source: "lockupViewModel",
    });
  }

  for (const renderer of videoRenderers) {
    const videoId = renderer.videoId;
    if (!videoId || seen.has(videoId)) continue;
    const title = textFrom(renderer.title);
    if (!title) continue;
    const isShort =
      renderer.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url?.includes("/shorts/");
    if (isShort) continue;
    seen.add(videoId);
    videos.push({
      videoId,
      title,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      publishedAtText: textFrom(renderer.publishedTimeText),
      thumbnail:
        renderer.thumbnail?.thumbnails?.slice(-1)?.[0]?.url ||
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      source: "videoRenderer",
    });
  }

  return {
    error: null,
    lockupCount: lockups.length,
    videoRendererCount: videoRenderers.length,
    videos: videos.slice(0, 10),
  };
}

const urls = [
  "https://www.youtube.com/@henren778/videos",
  "https://www.youtube.com/@sunlao/videos",
  "https://www.youtube.com/@libertas1984/videos",
];

for (const sourceUrl of urls) {
  const response = await fetch(sourceUrl, { headers: YOUTUBE_HEADERS });
  const html = await response.text();
  const result = parseVideosFromHtml(html);
  console.log("\n===", sourceUrl, "===");
  console.log({
    status: response.status,
    error: result.error,
    lockupCount: result.lockupCount,
    videoRendererCount: result.videoRendererCount,
    videos: result.videos.length,
  });
  console.log(JSON.stringify(result.videos.slice(0, 3), null, 2));
}
