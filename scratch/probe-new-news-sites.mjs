const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function get(url, viaJina = false) {
  const target = viaJina ? `https://r.jina.ai/${url.replace(/^https?:\/\//, "https://")}` : url;
  try {
    const res = await fetch(target, {
      headers: {
        "user-agent": UA,
        "accept-language": "zh-TW,zh;q=0.9",
        accept: viaJina ? "text/plain" : "text/html,*/*",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, finalUrl: res.url, text, error: null };
  } catch (e) {
    return { ok: false, status: 0, finalUrl: url, text: "", error: e.message };
  }
}

const tycg = await get("https://www.tycg.gov.tw/");
console.log("tycg", tycg.status, tycg.error, tycg.text.length);
if (tycg.text) {
  const hrefs = [...tycg.text.matchAll(/href=["']([^"']+)["']/gi)]
    .map((m) => m[1])
    .filter((h) => /news|search|訊息|公告|News/i.test(h))
    .slice(0, 40);
  console.log("tycg href sample:\n", [...new Set(hrefs)].slice(0, 20).join("\n"));
}

const bella = await get("https://www.bella.tw/");
console.log("bella direct", bella.status, bella.error, bella.text.length);
const bellaJ = await get("https://www.bella.tw/", true);
console.log("bella jina", bellaJ.status, bellaJ.error, bellaJ.text.length);
if (bellaJ.text) console.log(bellaJ.text.slice(0, 1200));

// common search patterns
for (const u of [
  "https://www.tycg.gov.tw/News.aspx?n=11158&sms=9199",
  "https://www.tycg.gov.tw/News_Content.aspx",
  "https://www.tycg.gov.tw/search.aspx?q=" + encodeURIComponent("中壢"),
  "https://www.bella.tw/?s=" + encodeURIComponent("中壢"),
  "https://www.bella.tw/search?q=" + encodeURIComponent("中壢"),
]) {
  const r = await get(u);
  console.log("try", u, "->", r.status, r.error || r.finalUrl, r.text.length);
}
