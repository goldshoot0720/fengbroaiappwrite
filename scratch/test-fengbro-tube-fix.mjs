/**
 * Standalone verification of the post-fix YouTube fetch strategy:
 * HTML scrape -> Innertube browse -> Atom RSS (last resort)
 */
const YOUTUBE_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "zh-TW,zh;q=0.9,en;q=0.8",
  "cache-control": "no-cache",
};

function pick(text, pattern) {
  return (pattern.exec(text)?.[1] || "").trim();
}

function isBroken(title) {
  return /Error\s*\d+\s*\(|Not Found|Server Error|!!1/i.test(title || "");
}

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
  for (const value of Object.values(node)) walk(value, visitor);
}

function textFrom(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value.simpleText === "string") return value.simpleText;
  if (typeof value.content === "string") return value.content;
  if (Array.isArray(value.runs)) return value.runs.map((r) => r.text || "").join("");
  return "";
}

function parseVideos(data) {
  if (!data) return [];
  const lockups = [];
  const renderers = [];
  walk(data, (node) => {
    if (node.lockupViewModel) lockups.push(node.lockupViewModel);
    if (node.videoRenderer) renderers.push(node.videoRenderer);
    if (node.gridVideoRenderer) renderers.push(node.gridVideoRenderer);
  });
  const videos = [];
  const seen = new Set();
  for (const lockup of lockups) {
    const watchUrl =
      lockup.rendererContext?.commandContext?.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url ||
      "";
    const videoId =
      lockup.contentId ||
      lockup.rendererContext?.commandContext?.onTap?.innertubeCommand?.watchEndpoint?.videoId ||
      watchUrl.match(/[?&]v=([\w-]{11})/)?.[1] ||
      "";
    if (!videoId || videoId.length !== 11 || seen.has(videoId)) continue;
    if (String(watchUrl).includes("/shorts/")) continue;
    const title =
      textFrom(lockup.metadata?.lockupMetadataViewModel?.title) || textFrom(lockup.title);
    if (!title || isBroken(title)) continue;
    seen.add(videoId);
    videos.push({ videoId, title });
  }
  for (const renderer of renderers) {
    const videoId = renderer.videoId;
    if (!videoId || seen.has(videoId)) continue;
    const title = textFrom(renderer.title);
    if (!title || isBroken(title)) continue;
    seen.add(videoId);
    videos.push({ videoId, title });
  }
  return videos;
}

async function fetchChannel(sourceUrl) {
  const videosUrl = sourceUrl.replace(/\/$/, "");
  const pageRes = await fetch(videosUrl.includes("/videos") ? videosUrl : `${videosUrl}/videos`, {
    headers: YOUTUBE_HEADERS,
    cache: "no-store",
  });
  const html = await pageRes.text();
  const channelId =
    pick(html, /"externalId"\s*:\s*"(UC[\w-]+)"/) ||
    pick(html, /"channelId"\s*:\s*"(UC[\w-]+)"/) ||
    pick(html, /youtube\.com\/channel\/(UC[\w-]+)/);
  let title =
    pick(html, /<meta property="og:title" content="([^"]+)"/) ||
    pick(html, /<title>(.*?)<\/title>/) ||
    "";
  if (isBroken(title)) title = "";
  title = title.replace(/ - YouTube$/i, "");

  const initialData = extractJsonObjectAfterMarker(html, "ytInitialData");
  let videos = parseVideos(initialData).slice(0, 10);
  let source = videos.length ? "html" : "";

  if (videos.length === 0) {
    const apiKey = pick(html, /"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/);
    const clientVersion = pick(html, /"INNERTUBE_CLIENT_VERSION"\s*:\s*"([^"]+)"/) || "2.20260714.01.00";
    if (apiKey && channelId) {
      const browseRes = await fetch(
        `https://www.youtube.com/youtubei/v1/browse?key=${encodeURIComponent(apiKey)}&prettyPrint=false`,
        {
          method: "POST",
          cache: "no-store",
          headers: {
            ...YOUTUBE_HEADERS,
            "content-type": "application/json",
            "x-youtube-client-name": "1",
            "x-youtube-client-version": clientVersion,
          },
          body: JSON.stringify({
            context: {
              client: { clientName: "WEB", clientVersion, hl: "zh-TW", gl: "TW" },
            },
            browseId: channelId,
            params: "EgZ2aWRlb3PyBgQKAjoA",
          }),
        }
      );
      if (browseRes.ok) {
        videos = parseVideos(await browseRes.json()).slice(0, 10);
        if (videos.length) source = "innertube";
      }
    }
  }

  if (videos.length === 0 && channelId) {
    const feedRes = await fetch(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`,
      { headers: YOUTUBE_HEADERS, cache: "no-store" }
    );
    source = feedRes.ok ? "feed-ok" : `feed-${feedRes.status}`;
  }

  return {
    sourceUrl,
    pageStatus: pageRes.status,
    channelId: channelId || null,
    title: title || null,
    brokenTitle: isBroken(title),
    videoCount: videos.length,
    source,
    sample: videos[0]?.title?.slice(0, 50) || null,
  };
}

const urls = [
  "https://www.youtube.com/@henren778/videos",
  "https://www.youtube.com/@sunlao/videos",
  "https://www.youtube.com/@libertas1984/videos",
];

const results = [];
for (const url of urls) {
  try {
    results.push(await fetchChannel(url));
  } catch (e) {
    results.push({ sourceUrl: url, error: String(e) });
  }
}

console.log(JSON.stringify(results, null, 2));
const bad = results.filter((r) => r.error || !r.channelId || r.videoCount === 0 || r.brokenTitle);
console.log("BAD", bad.length, bad.map((r) => r.sourceUrl));
