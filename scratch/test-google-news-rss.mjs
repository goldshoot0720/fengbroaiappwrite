const q = encodeURIComponent("中新地下道");
const urls = [
  `https://news.google.com/rss/search?q=${q}+when:1095d&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`,
  `https://news.google.com/rss/search?q=${q}+site:chinatimes.com+when:1095d&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`,
  `https://news.google.com/rss/search?q=${q}+site:leho.com.tw+when:1095d&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`,
  `https://news.google.com/rss/search?q=${q}+site:udn.com+when:1095d&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`,
];
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0 Safari/537.36";
for (const u of urls) {
  try {
    const res = await fetch(u, { headers: { "user-agent": UA, accept: "application/rss+xml,application/xml,text/xml,*/*" } });
    const t = await res.text();
    const items = (t.match(/<item>/g) || []).length;
    const titles = [...t.matchAll(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/g)]
      .map((m) => (m[1] || m[2] || "").replace(/<[^>]+>/g, "").trim())
      .filter((x) => x && !x.includes("Google"))
      .slice(0, 5);
    console.log(res.status, items, u.includes("site:") ? u.match(/site:[^\s+&]+/)?.[0] : "all", titles);
  } catch (e) {
    console.log("ERR", e.message);
  }
}
