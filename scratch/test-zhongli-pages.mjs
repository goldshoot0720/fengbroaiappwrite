const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function get(url) {
  const res = await fetch(url, {
    headers: { "user-agent": UA, "accept-language": "zh-TW,zh;q=0.9" },
  });
  return { status: res.status, html: await res.text(), url: res.url };
}

// Check news list HTML for pagination pattern
const first = await get("https://www.zhongli.tycg.gov.tw/News.aspx?n=5605&sms=10728");
console.log("status", first.status, first.html.length);
const pageHints = [...first.html.matchAll(/page|分頁|Page|GoTo|aspnet/gi)].slice(0, 20).map((m) => m[0]);
console.log("pageHints unique", [...new Set(pageHints)]);

// Look for pager links
const pager = [...first.html.matchAll(/href="([^"]*(?:page|Page|p=)[^"]*)"/gi)].map((m) => m[1]).slice(0, 20);
console.log("pager", pager);

// Look for __doPostBack
const postbacks = [...first.html.matchAll(/__doPostBack\('([^']*)','([^']*)'\)/g)].slice(0, 30);
console.log("postbacks", postbacks.map((m) => [m[1], m[2]]));

// Try Advanced_Search with different params
const adv = await get("https://www.zhongli.tycg.gov.tw/Advanced_Search.aspx?q=%E4%B8%AD%E6%96%B0%E5%9C%B0%E4%B8%8B%E9%81%93");
console.log("adv has form", adv.html.includes("form"), adv.html.includes("Search"));
const advForms = [...adv.html.matchAll(/action="([^"]*)"/gi)].map((m) => m[1]).slice(0, 10);
console.log("adv actions", advForms);
const advInputs = [...adv.html.matchAll(/name="([^"]+)"/gi)].map((m) => m[1]).filter((n) => /search|q|key|title|keyword/i.test(n));
console.log("adv search inputs", advInputs);

// sitewide search via tycg portal?
const portals = [
  "https://www.tycg.gov.tw/News.aspx?n=1233&sms=9726&Search=%E4%B8%AD%E6%96%B0%E5%9C%B0%E4%B8%8B%E9%81%93",
  "https://www.google.com/search?q=%E4%B8%AD%E6%96%B0%E5%9C%B0%E4%B8%8B%E9%81%93+site%3Azhongli.tycg.gov.tw",
];
for (const u of portals) {
  const r = await get(u);
  console.log(u.slice(0, 80), r.status, r.html.length, r.html.includes("1616891"), r.html.includes("中新地下道"));
}
