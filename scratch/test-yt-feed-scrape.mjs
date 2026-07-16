const headers = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "zh-TW,zh;q=0.9,en;q=0.8",
};

const channelId = "UCT3V0MMm45oJ8UMPF7NFlfw";

// 1) RSS with different UAs / endpoints
const feedUrls = [
  `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
  `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}&format=1`,
];

for (const url of feedUrls) {
  for (const ua of [
    headers["user-agent"],
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "feed-reader/1.0",
  ]) {
    const res = await fetch(url, { headers: { ...headers, "user-agent": ua, accept: "application/atom+xml,application/xml,text/xml,*/*" } });
    const text = await res.text();
    const title = text.match(/<title>(.*?)<\/title>/)?.[1] || "";
    const entries = [...text.matchAll(/<entry>/g)].length;
    console.log("feed", res.status, "entries", entries, "title", title.slice(0, 60), "ua", ua.slice(0, 40));
  }
}

// 2) Channel HTML scrape for videos
const pageRes = await fetch("https://www.youtube.com/@sunlao/videos", { headers });
const html = await pageRes.text();
console.log("\npage status", pageRes.status, "len", html.length);

const match = html.match(/ytInitialData\s*=\s*(\{[\s\S]*?\})\s*;\s*(?:<\/script>|var\s+|window)/);
console.log("ytInitialData match", Boolean(match), match ? match[1].length : 0);

if (match) {
  try {
    const data = JSON.parse(match[1]);
    const json = JSON.stringify(data);
    const videoIds = [...new Set([...json.matchAll(/"videoId":"([\w-]{11})"/g)].map((m) => m[1]))].slice(0, 10);
    const lockups = [...json.matchAll(/"lockupViewModel"/g)].length;
    const renderers = [...json.matchAll(/"videoRenderer"/g)].length;
    const grid = [...json.matchAll(/"gridVideoRenderer"/g)].length;
    console.log({ videoIds, lockups, renderers, grid });
  } catch (e) {
    console.log("parse fail", e.message);
  }
} else {
  // try alternate extraction
  const idx = html.indexOf("ytInitialData");
  console.log("ytInitialData idx", idx);
  if (idx >= 0) console.log(html.slice(idx, idx + 200));
}

// 3) innertube with proper API key from page
const apiKey = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1];
const clientVersion = html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/)?.[1];
const clientName = html.match(/"INNERTUBE_CLIENT_NAME":"([^"]+)"/)?.[1];
console.log("\ninnertube meta", { apiKey: apiKey?.slice(0, 20), clientVersion, clientName });

if (apiKey) {
  const body = {
    context: {
      client: {
        clientName: "WEB",
        clientVersion: clientVersion || "2.20240715.00.00",
        hl: "zh-TW",
        gl: "TW",
      },
    },
    browseId: channelId,
    params: "EgZ2aWRlb3PyBgQKAjoA", // videos tab
  };
  const res = await fetch(`https://www.youtube.com/youtubei/v1/browse?key=${apiKey}&prettyPrint=false`, {
    method: "POST",
    headers: {
      ...headers,
      "content-type": "application/json",
      "x-youtube-client-name": "1",
      "x-youtube-client-version": clientVersion || "2.20240715.00.00",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const videoIds = [...new Set([...text.matchAll(/"videoId":"([\w-]{11})"/g)].map((m) => m[1]))].slice(0, 10);
  const title = text.match(/"title"\s*:\s*\{\s*"simpleText"\s*:\s*"([^"]+)"/)?.[1]
    || text.match(/"channelMetadataRenderer"[\s\S]{0,200}"title"\s*:\s*"([^"]+)"/)?.[1];
  console.log("innertube browse", { status: res.status, len: text.length, videoIds, title, sample: text.slice(0, 200) });
}

// 4) resolve via /channel/UC.../videos
const chRes = await fetch(`https://www.youtube.com/channel/${channelId}/videos`, { headers });
const chHtml = await chRes.text();
const chTitle = chHtml.match(/<title>(.*?)<\/title>/)?.[1];
const chMatch = chHtml.match(/ytInitialData\s*=\s*(\{[\s\S]*?\})\s*;\s*(?:<\/script>|var\s+|window)/);
let chVideos = [];
if (chMatch) {
  try {
    const data = JSON.parse(chMatch[1]);
    const json = JSON.stringify(data);
    chVideos = [...new Set([...json.matchAll(/"videoId":"([\w-]{11})"/g)].map((m) => m[1]))].slice(0, 8);
  } catch {}
}
console.log("\nchannel id page", { status: chRes.status, title: chTitle, videos: chVideos });
