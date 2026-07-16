// Probe possible CMS APIs for rb.gov.tw news list via jina
const candidates = [
  "https://r.jina.ai/https://www.rb.gov.tw/zh-TW/NREO/NREO_13/NREO_30/NREO_31/?page=1",
  "https://r.jina.ai/https://www.rb.gov.tw/zh-TW/NREO/NREO_13/NREO_30/NREO_31/index.html",
  "https://r.jina.ai/http://www.rb.gov.tw/zh-TW/NREO/NREO_13/NREO_30/NREO_31/",
];

for (const u of candidates) {
  const res = await fetch(u, { headers: { accept: "text/plain" } });
  const text = await res.text();
  const articleLinks = [...text.matchAll(/https?:\/\/www\.rb\.gov\.tw\/zh-TW\/NREO\/NREO_13\/NREO_30\/NREO_31\/\d{8}_\d+/g)];
  console.log(u.slice(40), "len", text.length, "article links", articleLinks.length);
  console.log([...new Set(articleLinks.map((m) => m[0]))].slice(0, 10));
  if (text.includes("中新")) console.log("HAS KEYWORD");
  // print lines with 2026 or news-ish
  const lines = text.split("\n").filter((l) => /202[0-9]|消息|地下道|交維|CJ17/.test(l)).slice(0, 15);
  console.log(lines.join("\n"));
  console.log("---");
}

// Try site search via jina
const search = await fetch(
  "https://r.jina.ai/https://www.rb.gov.tw/zh-TW/search?q=" + encodeURIComponent("中新地下道"),
  { headers: { accept: "text/plain" } }
);
const sText = await search.text();
console.log("search len", sText.length);
console.log(sText.slice(0, 2500));
