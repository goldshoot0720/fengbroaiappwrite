const q = process.argv[2] || "中壢";
const sites = [
  "tycg.gov.tw",
  "bella.tw",
  "youtube.com", // will match all yt defaults; better pass JSON via POST
].join(",");

// Prefer POST with explicit site list so we only hit the 5 new sources
const body = {
  q,
  onlyLocked: true,
  sites: [
    {
      id: "tycg",
      name: "桃園市政府",
      domain: "tycg.gov.tw",
      homeUrl: "https://www.tycg.gov.tw/",
      adapter: "generic-keyword-url",
      searchUrlTemplate: "https://www.tycg.gov.tw/Advanced_Search.aspx?q={q}",
      locked: true,
    },
    {
      id: "bella",
      name: "Bella 儂儂",
      domain: "bella.tw",
      homeUrl: "https://www.bella.tw/",
      adapter: "generic-keyword-url",
      searchUrlTemplate: "https://www.bella.tw/search?q={q}",
      locked: true,
    },
    {
      id: "youtube-tbc-news-nty",
      name: "TBC 新聞 (NTY)",
      domain: "youtube.com",
      homeUrl: "https://www.youtube.com/@TBC-news-NTY/videos",
      adapter: "youtube-channel",
      locked: true,
    },
    {
      id: "youtube-pnnpts",
      name: "PNN 公視新聞網",
      domain: "youtube.com",
      homeUrl: "https://www.youtube.com/@PNNPTS/videos",
      adapter: "youtube-channel",
      locked: true,
    },
    {
      id: "youtube-beiken-vitality",
      name: "北健活力頻道",
      domain: "youtube.com",
      homeUrl: "https://www.youtube.com/@北健活力頻道/videos",
      adapter: "youtube-channel",
      locked: true,
    },
  ],
};

const res = await fetch("http://localhost:3000/api/fengbro-news", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
const j = await res.json();
console.log(
  JSON.stringify(
    {
      status: res.status,
      resultCount: j.resultCount,
      bySite: (j.bySite || []).map((s) => ({
        site: s.siteName,
        n: s.articles.length,
        error: s.error || null,
        source: s.source || null,
        first: s.articles[0]
          ? { t: s.articles[0].title, u: s.articles[0].url, d: s.articles[0].publishedAt }
          : null,
      })),
    },
    null,
    2
  )
);
