const YOUTUBE_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

const urls = [
  "https://www.youtube.com/@henren778/videos",
  "https://www.youtube.com/@libertas1984/videos",
  "https://www.youtube.com/@sunlao/videos",
  "https://www.youtube.com/@blackwhite_raven/videos",
  "https://www.youtube.com/@informant510/videos",
  "https://www.youtube.com/@ma-siku/videos",
  "https://www.youtube.com/@monsterise/videos",
  "https://www.youtube.com/@Tankman2020/videos",
  "https://www.youtube.com/@tengumedia/videos",
];

function pick(text, pattern) {
  return (pattern.exec(text)?.[1] || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

async function resolveOne(sourceUrl) {
  const channelUrl = sourceUrl.replace(/\/videos\/?$/i, "").replace(/\/$/, "");
  const response = await fetch(channelUrl, { headers: YOUTUBE_HEADERS });
  const html = await response.text();
  const channelId =
    pick(html, /"externalId"\s*:\s*"([^"]+)"/) ||
    pick(html, /"channelId"\s*:\s*"([^"]+)"/) ||
    pick(html, /youtube\.com\/channel\/(UC[\w-]+)/);
  const title =
    pick(html, /<meta property="og:title" content="([^"]+)"/) ||
    pick(html, /<title>(.*?)<\/title>/) ||
    "none";

  let feed = null;
  if (channelId) {
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
    const feedRes = await fetch(feedUrl, { headers: YOUTUBE_HEADERS });
    const xml = await feedRes.text();
    const feedTitle = pick(xml, /<title>(.*?)<\/title>/);
    const entries = [...xml.matchAll(/<entry>/g)].length;
    feed = {
      status: feedRes.status,
      title: feedTitle.slice(0, 100),
      entries,
      head: xml.slice(0, 150).replace(/\s+/g, " "),
      is404Title: /Error 404|Not Found/i.test(feedTitle),
    };
  }

  return {
    sourceUrl,
    status: response.status,
    channelId: channelId || null,
    title: title.slice(0, 100),
    is404Title: /Error 404|Not Found/i.test(title),
    feed,
  };
}

const results = [];
for (const url of urls) {
  try {
    results.push(await resolveOne(url));
  } catch (error) {
    results.push({ sourceUrl: url, error: String(error) });
  }
}

const bad = results.filter(
  (r) => r.error || r.is404Title || !r.channelId || r.feed?.is404Title || r.feed?.status !== 200 || r.feed?.entries === 0
);
console.log("TOTAL", results.length);
console.log("BAD", bad.length);
console.log(JSON.stringify(bad, null, 2));
console.log("--- SAMPLE OK ---");
console.log(JSON.stringify(results.filter((r) => !bad.includes(r)).slice(0, 3), null, 2));
