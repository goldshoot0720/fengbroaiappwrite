const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function get(url, viaJina = false) {
  const target = viaJina
    ? `https://r.jina.ai/https://${url.replace(/^https?:\/\//, "")}`
    : url;
  try {
    const res = await fetch(target, {
      headers: {
        "user-agent": UA,
        "accept-language": "zh-TW,zh;q=0.9",
        accept: viaJina ? "text/plain" : "text/html,*/*",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text, error: null };
  } catch (e) {
    return { ok: false, status: 0, text: "", error: e.message };
  }
}

const q = encodeURIComponent("中壢");
const tycgSearch = await get(`https://www.tycg.gov.tw/Advanced_Search.aspx?q=${q}`);
console.log("tycg advanced", tycgSearch.status, tycgSearch.error, tycgSearch.text.length);
if (tycgSearch.text) {
  const links = [...tycgSearch.text.matchAll(/href=["']([^"']*News_Content[^"']*)["']/gi)]
    .map((m) => m[1])
    .slice(0, 10);
  console.log("tycg News_Content links", links);
  const titles = [...tycgSearch.text.matchAll(/<a[^>]+>([\s\S]{8,80}?)<\/a>/gi)]
    .map((m) => m[1].replace(/<[^>]+>/g, "").trim())
    .filter((t) => t.includes("中壢") || t.includes("地下"))
    .slice(0, 10);
  console.log("tycg title hits", titles);
}

const bellaJ = await get(`https://www.bella.tw/search?q=${q}`, true);
console.log("bella search jina", bellaJ.status, bellaJ.error, bellaJ.text.length);
if (bellaJ.text) {
  console.log(bellaJ.text.slice(0, 2500));
}

const bellaHome = await get("https://www.bella.tw/", true);
if (bellaHome.text) {
  const articleLinks = [...bellaHome.text.matchAll(/\]\((https?:\/\/www\.bella\.tw\/[^)\s]+)\)/gi)]
    .map((m) => m[1])
    .filter((u) => !/\/(all|tag|images|2022|subscribed|web_login|fashion\/all)/i.test(u))
    .slice(0, 15);
  console.log("bella article-ish links", [...new Set(articleLinks)]);
}
