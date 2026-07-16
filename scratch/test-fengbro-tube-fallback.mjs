const YOUTUBE_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

function pick(text, pattern) {
  return (pattern.exec(text)?.[1] || "").trim();
}

async function inspect(sourceUrl) {
  const channelUrl = sourceUrl.replace(/\/videos\/?$/i, "").replace(/\/$/, "");
  const response = await fetch(channelUrl, { headers: YOUTUBE_HEADERS });
  const html = await response.text();

  const externalIds = [...html.matchAll(/"externalId"\s*:\s*"(UC[\w-]+)"/g)].map((m) => m[1]);
  const channelIds = [...html.matchAll(/"channelId"\s*:\s*"(UC[\w-]+)"/g)].map((m) => m[1]);
  const browseIds = [...html.matchAll(/"browseId"\s*:\s*"(UC[\w-]+)"/g)].map((m) => m[1]);
  const unique = [...new Set([...externalIds, ...channelIds, ...browseIds])];

  console.log("\n===", sourceUrl, "===");
  console.log("status", response.status);
  console.log("unique channel-like ids", unique.slice(0, 10));
  console.log("canonical", pick(html, /<link rel="canonical" href="([^"]+)"/));
  console.log("og:url", pick(html, /property="og:url" content="([^"]+)"/));

  for (const id of unique.slice(0, 5)) {
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${id}`;
    const feedRes = await fetch(feedUrl, { headers: YOUTUBE_HEADERS });
    const xml = await feedRes.text();
    console.log("feed", id, feedRes.status, pick(xml, /<title>(.*?)<\/title>/).slice(0, 60), "entries", [...xml.matchAll(/<entry>/g)].length);
  }

  // Try scraping ytInitialData for videoRenderer
  const initialDataMatch = html.match(/ytInitialData\s*=\s*(\{.+?\});<\/script>/s);
  if (initialDataMatch) {
    try {
      const data = JSON.parse(initialDataMatch[1]);
      const json = JSON.stringify(data);
      const videoIds = [...new Set([...json.matchAll(/"videoId":"([\w-]{11})"/g)].map((m) => m[1]))].slice(0, 5);
      const titles = [...json.matchAll(/"title":\{"runs":\[\{"text":"([^"]+)"\}\]/g)].map((m) => m[1]).slice(0, 5);
      console.log("page videoIds", videoIds);
      console.log("page titles sample", titles);
    } catch (e) {
      console.log("parse initial data failed", e.message);
    }
  } else {
    console.log("no ytInitialData");
  }

  // videos tab page
  const videosUrl = channelUrl.includes("/videos") ? channelUrl : `${channelUrl}/videos`;
  const videosRes = await fetch(videosUrl, { headers: YOUTUBE_HEADERS });
  const videosHtml = await videosRes.text();
  const vInitial = videosHtml.match(/ytInitialData\s*=\s*(\{.+?\});<\/script>/s);
  if (vInitial) {
    try {
      const data = JSON.parse(vInitial[1]);
      const json = JSON.stringify(data);
      const videoIds = [...new Set([...json.matchAll(/"videoId":"([\w-]{11})"/g)].map((m) => m[1]))].slice(0, 8);
      console.log("videos tab status", videosRes.status, "videoIds", videoIds);
    } catch (e) {
      console.log("videos tab parse failed", e.message);
    }
  } else {
    console.log("videos tab no ytInitialData, status", videosRes.status, "len", videosHtml.length);
  }
}

const samples = [
  "https://www.youtube.com/@sunlao/videos",
  "https://www.youtube.com/@libertas1984/videos",
];

for (const url of samples) {
  await inspect(url);
}
