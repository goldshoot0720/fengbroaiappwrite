const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const q = encodeURIComponent("中新地下道");
const search = `https://search.ltn.com.tw/list?keyword=${q}`;
const res = await fetch(search, { headers: { "user-agent": UA, "accept-language": "zh-TW" } });
const html = await res.text();
console.log("status", res.status, html.length);

// find paper/1311398 or 2019
const idx = html.indexOf("1311398");
console.log("id idx", idx);
if (idx >= 0) console.log(html.slice(idx - 400, idx + 300).replace(/\s+/g, " "));

const idx2 = html.indexOf("中新地下道");
console.log("kw contexts:");
let from = 0;
for (let i = 0; i < 6; i++) {
  const j = html.indexOf("中新地下道", from);
  if (j < 0) break;
  console.log(html.slice(j - 250, j + 120).replace(/\s+/g, " "));
  console.log("---");
  from = j + 1;
}

// article page
const art = await fetch("https://news.ltn.com.tw/news/life/paper/1311398", {
  headers: { "user-agent": UA, "accept-language": "zh-TW" },
});
const ahtml = await art.text();
console.log("article", art.status, ahtml.length);
const time = ahtml.match(/time[^>]*>([^<]{6,40})</i) || ahtml.match(/2019[\/\-.]08[\/\-.]18/);
console.log("time match", time && time[0]);
const meta = ahtml.match(/property="article:published_time"[^>]*content="([^"]+)"/i) || ahtml.match(/datetime="([^"]+)"/i);
console.log("meta", meta && meta[1]);
