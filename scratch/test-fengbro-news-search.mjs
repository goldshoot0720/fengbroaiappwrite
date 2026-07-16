import fs from "node:fs";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function parseDdg(html) {
  const results = [];
  // result links: <a rel="nofollow" class="result__a" href="...">
  const re = /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    let url = decodeHtml(m[1]);
    if (url.includes("uddg=")) {
      try {
        url = decodeURIComponent(new URL(url, "https://duckduckgo.com").searchParams.get("uddg") || url);
      } catch {}
    }
    const title = decodeHtml(m[2].replace(/<[^>]+>/g, "")).trim();
    results.push({ url, title });
  }
  return results;
}

function parseBing(html) {
  const results = [];
  // <li class="b_algo"> ... <h2><a href="...">title</a>
  const blocks = html.split(/<li class="b_algo"/i).slice(1);
  for (const block of blocks) {
    const m = block.match(/<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!m) continue;
    const url = decodeHtml(m[1]);
    const title = decodeHtml(m[2].replace(/<[^>]+>/g, "")).trim();
    results.push({ url, title });
  }
  return results;
}

async function trySearch(label, url, parser) {
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": UA,
        "accept-language": "zh-TW,zh;q=0.9,en;q=0.8",
        accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    const text = await res.text();
    fs.writeFileSync(`scratch/news-${label.replace(/\s+/g, "-")}.html`, text);
    const results = parser(text);
    console.log("---", label, res.status, "results", results.length);
    for (const r of results.slice(0, 5)) {
      console.log(" ", r.title, "=>", r.url);
    }
    if (!results.length) {
      // show snippets of possible anchors
      const sample = [...text.matchAll(/result__a|b_algo|uddg=/g)].slice(0, 5).map((x) => x[0]);
      console.log(" markers", sample);
    }
  } catch (e) {
    console.log(label, e.message);
  }
}

const keyword = "中新地下道";
const sites = ["traffic.tycg.gov.tw", "rb.gov.tw", "zhongli.tycg.gov.tw"];

for (const site of sites) {
  const q = encodeURIComponent(`${keyword} site:${site}`);
  await trySearch(`ddg-${site}`, `https://html.duckduckgo.com/html/?q=${q}`, parseDdg);
  await trySearch(`bing-${site}`, `https://www.bing.com/search?q=${q}&setlang=zh-tw&cc=TW`, parseBing);
}
