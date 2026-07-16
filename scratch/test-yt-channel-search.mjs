const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const q = encodeURIComponent("中新地下道");
const urls = [
  `https://www.youtube.com/@tnews6460/search?query=${q}`,
  `https://www.youtube.com/@ntyprogram/search?query=${q}`,
  `https://r.jina.ai/https://www.youtube.com/@tnews6460/search?query=${q}`,
];
for (const u of urls) {
  try {
    const res = await fetch(u, {
      headers: { "user-agent": UA, "accept-language": "zh-TW", accept: "text/html,text/plain" },
    });
    const t = await res.text();
    console.log(u.slice(0, 80), res.status, t.length, "kw", t.includes("中新地下道"), "videoId", (t.match(/videoId/g) || []).length);
    if (t.includes("中新") || t.includes("videoId")) {
      const titles = [...t.matchAll(/"text"\s*:\s*"((?:\\.|[^"\\]){4,120})"/g)]
        .map((m) => {
          try {
            return JSON.parse(`"${m[1]}"`);
          } catch {
            return m[1];
          }
        })
        .filter((x) => /中新|地下道|鐵路|中壢/.test(x))
        .slice(0, 8);
      console.log(" titles", titles);
    }
  } catch (e) {
    console.log("ERR", e.message);
  }
}

// chinatimes more alts
const ct = [
  `https://www.chinatimes.com/search/?keyword=${q}`,
  `https://www.chinatimes.com/search/all/${q}?chdtv`,
  `https://r.jina.ai/https://www.chinatimes.com/realtimenews/?chdtv`,
];
for (const u of ct) {
  try {
    const res = await fetch(u, { headers: { "user-agent": UA, "accept-language": "zh-TW" } });
    const t = await res.text();
    console.log("CT2", res.status, t.length, u.slice(0, 70), t.includes("中新"));
  } catch (e) {
    console.log("CT2 ERR", e.message);
  }
}

// leho jina content
{
  const res = await fetch(`https://r.jina.ai/https://leho.com.tw/?s=${q}`, {
    headers: { accept: "text/plain" },
  });
  const t = await res.text();
  console.log("LEHO jina sample", t.slice(0, 2000));
  const links = [...t.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g)].filter((m) =>
    m[1].includes("中新") || m[1].includes("地下道")
  );
  console.log("LEHO links", links.slice(0, 5));
}
