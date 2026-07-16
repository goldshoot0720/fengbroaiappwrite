const q = process.argv[2] || "中新地下道";
const sites = process.argv[3] || "ltn.com.tw,ptt.cc,youtube.com,chinatimes.com,udn.com,leho.com.tw";
const url = `http://localhost:3000/api/fengbro-news?q=${encodeURIComponent(q)}&sites=${encodeURIComponent(sites)}`;

console.error("GET", url);
const res = await fetch(url);
const j = await res.json();

console.log(
  JSON.stringify(
    {
      status: res.status,
      resultCount: j.resultCount,
      maxAgeYears: j.maxAgeYears,
      bySite: (j.bySite || []).map((s) => ({
        site: s.siteName,
        n: s.articles.length,
        error: s.error || null,
        source: s.source || null,
        first: s.articles[0]
          ? { t: s.articles[0].title, u: s.articles[0].url, d: s.articles[0].publishedAt }
          : null,
      })),
      warnings: j.warnings,
    },
    null,
    2
  )
);

const bad = (j.results || []).some((a) => String(a.url || "").includes("1311398") || (a.publishedAt && Date.parse(a.publishedAt) < Date.now() - 3 * 365.25 * 864e5));
if (bad) {
  console.error("FAIL: found too-old article in results");
  process.exit(1);
}
console.error("OK: no known over-age articles");
