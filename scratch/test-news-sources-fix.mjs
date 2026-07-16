const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const q = encodeURIComponent("中新地下道");

const urls = [
  ["ptt-index", "https://www.ptt.cc/bbs/Railway/index.html"],
  ["ptt-search", `https://www.ptt.cc/bbs/Railway/search?q=${q}`],
  ["chinatimes-home", "https://www.chinatimes.com/?chdtv"],
  ["chinatimes-search", `https://www.chinatimes.com/search/${q}?chdtv`],
  ["chinatimes-search2", `https://www.chinatimes.com/search/result/${q}?chdtv`],
  ["udn-home", "https://udn.com/news/index"],
  ["udn-search", `https://udn.com/search/word/2/${q}`],
  ["udn-search2", `https://udn.com/search/result/2/${q}`],
  ["leho-home", "https://leho.com.tw/"],
  ["leho-search", `https://leho.com.tw/?s=${q}`],
  ["jina-ptt", `https://r.jina.ai/https://www.ptt.cc/bbs/Railway/search?q=${q}`],
  ["jina-udn", `https://r.jina.ai/https://udn.com/search/word/2/${q}`],
  ["jina-ct", `https://r.jina.ai/https://www.chinatimes.com/search/${q}?chdtv`],
];

for (const [label, url] of urls) {
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": UA,
        "accept-language": "zh-TW,zh;q=0.9",
        accept: "text/html,application/xhtml+xml,text/plain,*/*",
        cookie: "over18=1",
      },
      redirect: "follow",
    });
    const text = await res.text();
    const hasKw = text.includes("中新地下道");
    const story = (text.match(/news\/story/g) || []).length;
    const pttM = (text.match(/M\.\d{10}\.A\./g) || []).length;
    console.log(
      label,
      res.status,
      text.length,
      "kw",
      hasKw,
      "story",
      story,
      "pttM",
      pttM,
      res.url.slice(0, 90)
    );
    if (hasKw && label.includes("jina")) {
      const lines = text.split("\n").filter((l) => l.includes("中新地下道")).slice(0, 5);
      console.log("  ", lines.join(" | ").slice(0, 300));
    }
  } catch (e) {
    console.log(label, "ERR", e.message);
  }
}
