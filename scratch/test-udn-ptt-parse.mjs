const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const q = encodeURIComponent("中新地下道");

// UDN search HTML structure around keyword
{
  const res = await fetch(`https://udn.com/search/word/2/${q}`, {
    headers: { "user-agent": UA, "accept-language": "zh-TW" },
  });
  const html = await res.text();
  const idx = html.indexOf("中新地下道");
  console.log("UDN status", res.status, "idx", idx);
  console.log(html.slice(Math.max(0, idx - 300), idx + 200).replace(/\s+/g, " "));
  // story links
  const stories = [...html.matchAll(/href="(\/news\/story\/[^"]+)"[^>]*>([\s\S]{0,200}?)<\/a>/gi)].slice(0, 8);
  for (const m of stories) {
    const title = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    console.log(" story", title.slice(0, 80), "=>", m[1]);
  }
  // also story-title class patterns
  const classes = [...html.matchAll(/class="([^"]*story[^"]*)"/gi)].slice(0, 15).map((m) => m[1]);
  console.log("classes", [...new Set(classes)]);
}

// PTT without vs with cookie, and undici-like
{
  for (const cookie of ["", "over18=1"]) {
    try {
      const res = await fetch(`https://www.ptt.cc/bbs/Railway/search?q=${q}`, {
        headers: {
          "user-agent": UA,
          "accept-language": "zh-TW",
          ...(cookie ? { cookie } : {}),
        },
      });
      const html = await res.text();
      console.log("PTT cookie=", JSON.stringify(cookie), res.status, html.length, html.includes("over18"), html.includes("中新"));
      const titles = [...html.matchAll(/class="title"[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
      console.log("  titles", titles.length, titles.slice(0, 3).map((m) => m[2].replace(/<[^>]+>/g, "").trim()));
    } catch (e) {
      console.log("PTT ERR", cookie, e.message);
    }
  }
}

// chinatimes via google cache or alternative
{
  const alts = [
    `https://www.chinatimes.com/realtimenews/?chdtv`,
    `https://www.chinatimes.com/search/result.htm?q=${q}`,
    `https://r.jina.ai/http://www.chinatimes.com/search/${q}`,
  ];
  for (const u of alts) {
    try {
      const res = await fetch(u, { headers: { "user-agent": UA, accept: "text/html,text/plain" } });
      const t = await res.text();
      console.log("CT", u.slice(0, 70), res.status, t.length, t.includes("中新"));
    } catch (e) {
      console.log("CT ERR", e.message);
    }
  }
}

// leho
{
  const alts = [
    "https://www.leho.com.tw/",
    `https://r.jina.ai/https://leho.com.tw/`,
    `https://r.jina.ai/https://leho.com.tw/?s=${q}`,
  ];
  for (const u of alts) {
    try {
      const res = await fetch(u, { headers: { "user-agent": UA, accept: "text/html,text/plain" } });
      const t = await res.text();
      console.log("LEHO", u.slice(0, 60), res.status, t.length, t.includes("中新"));
    } catch (e) {
      console.log("LEHO ERR", e.message);
    }
  }
}
