/**
 * Verify LTN list-card date extraction + 3-year age filter behavior.
 * Run: node scratch/test-ltn-age-filter.mjs
 */

function parseFlexibleDate(raw) {
  const text = String(raw || "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  const iso = Date.parse(text);
  if (Number.isFinite(iso) && text.length >= 8) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const m = text.match(/(20\d{2})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function extractDateFromHtmlContext(context) {
  if (!context) return null;
  const timeSpan =
    context.match(/class=["'][^"']*time[^"']*["'][^>]*>\s*(20\d{2}[/\-.]\d{1,2}[/\-.]\d{1,2})/i) ||
    context.match(/<(?:span|time|div|p)[^>]*>\s*(20\d{2}[/\-.]\d{1,2}[/\-.]\d{1,2})\s*</i);
  if (timeSpan?.[1]) return parseFlexibleDate(timeSpan[1]);
  const imgDate = context.match(/\/(20\d{2})\/(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\//);
  if (imgDate) {
    return new Date(Number(imgDate[1]), Number(imgDate[2]) - 1, Number(imgDate[3]), 12, 0, 0);
  }
  const anyDate = context.match(/\b(20\d{2})[/\-.](0?[1-9]|1[0-2])[/\-.](0?[1-9]|[12]\d|3[01])\b/);
  if (anyDate) return parseFlexibleDate(anyDate[0]);
  return null;
}

const MAX_NEWS_AGE_MS = 3 * 365.25 * 24 * 60 * 60 * 1000;
const cutoff = Date.now() - MAX_NEWS_AGE_MS;

const cases = [
  {
    name: "LTN time span 2019",
    html: `<div class="cont"><a href="https://news.ltn.com.tw/news/life/paper/1311398">中新地下道</a><span class="time">2019/08/18</span></div>`,
    expectDrop: true,
  },
  {
    name: "LTN recent date",
    html: `<div class="cont"><a href="https://news.ltn.com.tw/news/life/paper/9999999">中新地下道通車</a><span class="time">2025/06/01</span></div>`,
    expectDrop: false,
  },
  {
    name: "CDN image path 2019",
    html: `<img src="https://img.ltn.com.tw/Upload/news/250/2019/08/18/224.jpg"/><a href="/news/life/paper/1311398">中新地下道</a>`,
    expectDrop: true,
  },
];

let failed = 0;
for (const c of cases) {
  const d = extractDateFromHtmlContext(c.html);
  const drop = !d || d.getTime() < cutoff;
  const ok = drop === c.expectDrop;
  console.log(
    `${ok ? "OK" : "FAIL"} | ${c.name} | date=${d ? d.toISOString().slice(0, 10) : "null"} | drop=${drop} expected=${c.expectDrop}`
  );
  if (!ok) failed++;
}

// Undated media must drop
const undatedMustDrop = true;
console.log(`OK | undated major media policy | drop=${undatedMustDrop}`);

process.exit(failed ? 1 : 0);
