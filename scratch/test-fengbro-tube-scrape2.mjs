const YOUTUBE_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "zh-TW,zh;q=0.9,en;q=0.8",
};

const sourceUrl = "https://www.youtube.com/@sunlao/videos";
const response = await fetch(sourceUrl, { headers: YOUTUBE_HEADERS });
const html = await response.text();
console.log("status", response.status, "len", html.length);
console.log("has ytInitialData", /ytInitialData/.test(html));
console.log("has ytInitialPlayerResponse", /ytInitialPlayerResponse/.test(html));
console.log("has videoRenderer", /videoRenderer/.test(html));
console.log("has gridVideoRenderer", /gridVideoRenderer/.test(html));
console.log("has richItemRenderer", /richItemRenderer/.test(html));
console.log("has reelItemRenderer", /reelItemRenderer/.test(html));
console.log("has lockupViewModel", /lockupViewModel/.test(html));

// Find assignment patterns
const patterns = [
  /var ytInitialData\s*=\s*/,
  /window\["ytInitialData"\]\s*=\s*/,
  /ytInitialData\s*=\s*/,
];
for (const p of patterns) {
  console.log("pattern", p, p.test(html));
}

const idx = html.indexOf("ytInitialData");
console.log("idx", idx);
if (idx >= 0) {
  console.log("context", html.slice(idx, idx + 200));
}

// Try more flexible extract
const m = html.match(/ytInitialData\s*=\s*(\{[\s\S]*?\})\s*;\s*(?:<\/script>|var\s+|window)/);
console.log("flexible match", Boolean(m), m?.[1]?.length);

// Extract video ids with nearby title via regex
const videoIdMatches = [...html.matchAll(/"videoId":"([\w-]{11})"/g)].map((x) => x[1]);
console.log("videoId count", videoIdMatches.length, "unique", new Set(videoIdMatches).size);

// Look for lockup model structure (new YouTube UI)
const lockupIdx = html.indexOf("lockupViewModel");
console.log("lockup context", lockupIdx >= 0 ? html.slice(lockupIdx, lockupIdx + 500) : "none");

const contentIdx = html.indexOf('"content":{"videoRenderer"');
console.log("content videoRenderer", contentIdx >= 0 ? html.slice(contentIdx, contentIdx + 300) : "none");

const richIdx = html.indexOf("richItemRenderer");
console.log("richItem context", richIdx >= 0 ? html.slice(richIdx, richIdx + 400) : "none");

// Find title near first video id
const firstId = [...new Set(videoIdMatches)][0];
if (firstId) {
  const idIdx = html.indexOf(`"videoId":"${firstId}"`);
  console.log("firstId", firstId, "context\n", html.slice(Math.max(0, idIdx - 200), idIdx + 800));
}
