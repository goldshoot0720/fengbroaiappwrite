const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const q = encodeURIComponent("中新地下道");
const res = await fetch(`https://udn.com/search/word/2/${q}`, {
  headers: { "user-agent": UA, "accept-language": "zh-TW" },
});
const html = await res.text();

// story-list__text blocks
const blocks = [...html.matchAll(/story-list__text[\s\S]{0,800}/gi)].slice(0, 5);
for (const b of blocks) {
  console.log("---");
  console.log(b[0].replace(/\s+/g, " ").slice(0, 400));
}

// Find all anchors containing 中新
const re = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
let m;
let n = 0;
while ((m = re.exec(html)) && n < 20) {
  const title = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (title.includes("中新") || m[1].includes("%E4%B8%AD%E6%96%B0") || title.includes("地下道")) {
    console.log("HIT", title.slice(0, 100), "=>", m[1].slice(0, 120));
    n++;
  }
}

// h2/h3 in story list
const h = [...html.matchAll(/story-list__text[\s\S]*?<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)].slice(0, 10);
console.log(
  "h titles",
  h.map((x) => x[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim())
);

// JSON embedded?
const jsonIdx = html.indexOf("中新地下道");
console.log("all kw count", (html.match(/中新地下道/g) || []).length);
// print contexts
let from = 0;
for (let i = 0; i < 5; i++) {
  const idx = html.indexOf("中新地下道", from);
  if (idx < 0) break;
  console.log("ctx", html.slice(idx - 150, idx + 80).replace(/\s+/g, " "));
  from = idx + 1;
}
