const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const q = "中新地下道";

// more leho jina full for links
{
  const res = await fetch(`https://r.jina.ai/https://leho.com.tw/?s=${encodeURIComponent(q)}`, {
    headers: { accept: "text/plain", "user-agent": UA },
  });
  const t = await res.text();
  const links = [...t.matchAll(/\[([^\]]+)\]\((https?:\/\/leho\.com\.tw\/[^)]+)\)/g)];
  console.log("leho all links", links.length);
  console.log(links.slice(0, 30).map((m) => [m[1].slice(0, 60), m[2]]));
  console.log("has archives", t.includes("/archives/"));
  console.log(t.slice(2000, 4500));
}

// chinatimes via google news / ddg
const alts = [
  `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q + " site:chinatimes.com")}`,
  `https://r.jina.ai/https://html.duckduckgo.com/html/?q=${encodeURIComponent(q + " site:chinatimes.com")}`,
  `https://www.google.com/search?q=${encodeURIComponent(q + " site:chinatimes.com")}&hl=zh-TW`,
];
for (const u of alts) {
  try {
    const res = await fetch(u, {
      headers: { "user-agent": UA, "accept-language": "zh-TW", accept: "text/html,text/plain" },
    });
    const t = await res.text();
    console.log("---", res.status, t.length, u.slice(0, 60));
    const hits = [...t.matchAll(/chinatimes\.com[^"'<\s]*/gi)].slice(0, 8);
    console.log(hits);
    const titles = t.split("\n").filter((l) => l.includes("中新") || l.includes("chinatimes")).slice(0, 8);
    console.log(titles.map((x) => x.slice(0, 120)));
  } catch (e) {
    console.log("ERR", e.message);
  }
}
