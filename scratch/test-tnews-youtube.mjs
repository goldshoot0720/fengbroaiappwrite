const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const url = "https://www.youtube.com/@tnews6460/videos";
const res = await fetch(url, { headers: { "user-agent": UA, "accept-language": "zh-TW" } });
const html = await res.text();
const id =
  html.match(/"externalId"\s*:\s*"(UC[\w-]+)"/)?.[1] ||
  html.match(/"channelId"\s*:\s*"(UC[\w-]+)"/)?.[1] ||
  "";
console.log("status", res.status, "len", html.length, "channel", id);
if (id) {
  const feed = `https://www.youtube.com/feeds/videos.xml?channel_id=${id}`;
  const f = await fetch(feed, { headers: { "user-agent": UA } });
  const xml = await f.text();
  console.log("feed", f.status, "entries", (xml.match(/<entry>/g) || []).length);
  const titles = [...xml.matchAll(/<media:title>([\s\S]*?)<\/media:title>/g)]
    .slice(0, 3)
    .map((m) => m[1]);
  console.log(titles);
}
