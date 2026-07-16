const UA = "Mozilla/5.0";
const q = encodeURIComponent("中新地下道");
const html = await (
  await fetch(`https://search.ltn.com.tw/list?keyword=${q}`, { headers: { "user-agent": UA } })
).text();
const j = html.indexOf("paper/1311398");
const block = html.slice(Math.max(0, j - 80), j + 1400);
console.log(block.replace(/\s+/g, " "));
console.log(
  "dates",
  [...block.matchAll(/20\d{2}[\/\-]\d{1,2}[\/\-]\d{1,2}/g)].map((d) => d[0])
);
console.log(
  "time els",
  [...block.matchAll(/class="[^"]*"[^>]*>[^<]{0,40}/g)].filter((m) => /time|date|日/i.test(m[0])).slice(0, 10)
);
