const url = "https://tw.stock.yahoo.com/quote/2059.TW";
const res = await fetch(url, {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept-Language": "zh-TW,zh;q=0.9",
  },
});
const t = await res.text();
const title = (t.match(/<title[^>]*>([^<]+)/i) || [])[1];
const og = (t.match(/property="og:title" content="([^"]+)/i) || [])[1];
const h1 = (t.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1];
console.log("status", res.status);
console.log("title", title);
console.log("og", og);
console.log("h1", h1 && h1.replace(/<[^>]+>/g, "").trim().slice(0, 120));
console.log("has 川湖", t.includes("川湖"));

// Common JSON-in-page patterns
for (const key of ["shortName", "longName", "quoteName", "symbolName", "companyName"]) {
  const re = new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`, "g");
  let m;
  const hits = [];
  while ((m = re.exec(t)) && hits.length < 5) hits.push(m[1]);
  if (hits.length) console.log(key, hits);
}

// Try quote summary API
const qs = new URLSearchParams({
  modules: "price,summaryProfile,quoteType",
  lang: "zh-TW",
  region: "TW",
});
const q = await fetch(
  `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent("2059.TW")}?${qs}`,
  {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    },
  }
);
console.log("quoteSummary status", q.status);
if (q.ok) {
  const j = await q.json();
  const r = j?.quoteSummary?.result?.[0];
  console.log(
    JSON.stringify(
      {
        price: {
          shortName: r?.price?.shortName,
          longName: r?.price?.longName,
          shortNameRaw: r?.price?.shortName,
        },
        quoteType: r?.quoteType,
      },
      null,
      2
    )
  );
} else {
  console.log(await q.text().then((s) => s.slice(0, 200)));
}

// v7 quote
const v7 = await fetch(
  `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent("2059.TW")}&lang=zh-TW&region=TW`,
  {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    },
  }
);
console.log("v7 status", v7.status);
if (v7.ok) {
  const j = await v7.json();
  const r = j?.quoteResponse?.result?.[0];
  console.log(
    JSON.stringify(
      { shortName: r?.shortName, longName: r?.longName, displayName: r?.displayName },
      null,
      2
    )
  );
} else {
  console.log(await v7.text().then((s) => s.slice(0, 200)));
}
