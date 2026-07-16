const q = process.argv[2] || "中新地下道";
const sites = process.argv[3] || "ltn.com.tw";
const url = `http://localhost:3000/api/fengbro-news?q=${encodeURIComponent(q)}&sites=${encodeURIComponent(sites)}`;

const res = await fetch(url);
const j = await res.json();

const summary = {
  status: res.status,
  query: j.query,
  resultCount: j.resultCount,
  maxAgeYears: j.maxAgeYears,
  warnings: j.warnings,
  results: (j.results || []).map((a) => ({
    title: a.title,
    url: a.url,
    publishedAt: a.publishedAt,
  })),
  bySite: (j.bySite || []).map((s) => ({
    site: s.siteName,
    n: s.articles.length,
    error: s.error,
    sample: s.articles.slice(0, 5).map((a) => ({
      t: a.title,
      u: a.url,
      d: a.publishedAt,
    })),
  })),
};

console.log(JSON.stringify(summary, null, 2));

// Assert the known 2019 LTN paper URL is not present
const bad = "news.ltn.com.tw/news/life/paper/1311398";
const hit = (j.results || []).some((a) => String(a.url || "").includes("1311398"));
if (hit) {
  console.error("FAIL: 2019 LTN article still returned:", bad);
  process.exit(1);
}
console.error("OK: paper/1311398 not in results");
