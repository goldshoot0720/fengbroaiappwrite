const ua =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";

function decodeBigGoHtml(html) {
  return html
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "\n");
}

async function main() {
  const r = await fetch(`https://biggo.com.tw/s/${encodeURIComponent("AirPods Pro")}/`, {
    headers: { "User-Agent": ua, Referer: "https://biggo.com.tw/", "Accept-Language": "zh-TW" },
  });
  const html = await r.text();
  const decoded = decodeBigGoHtml(html);

  // Extract one full product object around history_id
  const idx = decoded.indexOf('"history_id"');
  console.log("decoded sample:\n", decoded.slice(idx - 200, idx + 1500));

  // Try looser patterns
  const historyIds = [...decoded.matchAll(/"history_id":"([^"]+)"/g)].slice(0, 5).map((m) => m[1]);
  console.log("\nhistory ids", historyIds);

  // Look at merchant/store fields near history_id
  const chunk = decoded.slice(idx, idx + 2000);
  for (const key of ["store", "merchant", "shop", "domain", "site", "source", "seller", "mall", "title", "purl", "url", "price", "name"]) {
    if (chunk.includes(`"${key}"`)) console.log("has key", key);
  }

  // Find all keys in first product-ish object
  const objMatch = decoded.slice(idx - 500, idx + 2500).match(/\{[^{}]*"history_id"[^{}]*\}/);
  if (objMatch) {
    console.log("\nflat object keys attempt:");
    console.log(objMatch[0].slice(0, 1000));
  }

  // Try old pattern
  const old =
    /"history_id":"([^"]+)"[\s\S]{0,1200}?"title":"([^"]+)"[\s\S]{0,1200}?"purl":"(https?:\/\/[^"]+)"[\s\S]{0,1200}?"price":(\d+|null)[\s\S]{0,1200}?"store":\{"image":"[^"]*","link":"[^"]*","name":"([^"]+)"/g;
  console.log("\nold pattern matches", [...decoded.matchAll(old)].length);

  // Alternative: history_id + nearby title + price
  const alt = /"history_id":"([^"]+)"[\s\S]{0,2500}?"title":"([^"]*)"[\s\S]{0,2500}?"price":(\d+|null)/g;
  const altMatches = [...decoded.matchAll(alt)].slice(0, 5);
  console.log("alt matches", altMatches.length);
  for (const m of altMatches) console.log(" -", m[1], m[3], m[2].slice(0, 50));

  // Check API search endpoint
  for (const endpoint of [
    "https://biggo.com.tw/api/v1/spa/search",
    "https://biggo.com.tw/api/search",
    "https://api.biggo.com/search",
  ]) {
    try {
      const sr = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": ua,
          region: "tw",
          Referer: "https://biggo.com.tw/",
        },
        body: JSON.stringify({ q: "AirPods Pro", page: 1 }),
      });
      console.log("API", endpoint, sr.status, (await sr.text()).slice(0, 200));
    } catch (e) {
      console.log("API err", endpoint, e.message);
    }
  }

  // GET style search API
  for (const endpoint of [
    `https://biggo.com.tw/api/v1/spa/search?q=${encodeURIComponent("AirPods Pro")}`,
    `https://biggo.com.tw/api/search?q=${encodeURIComponent("AirPods Pro")}`,
  ]) {
    try {
      const sr = await fetch(endpoint, {
        headers: {
          Accept: "application/json",
          "User-Agent": ua,
          region: "tw",
          Referer: "https://biggo.com.tw/",
        },
      });
      console.log("GET API", endpoint, sr.status, (await sr.text()).slice(0, 200));
    } catch (e) {
      console.log("GET err", endpoint, e.message);
    }
  }

  // History with found id
  if (historyIds[0]) {
    const hist = await fetch("https://biggo.com.tw/api/v1/spa/product/history", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": ua,
        region: "tw",
        referer: "https://biggo.com.tw/",
      },
      body: JSON.stringify({ history_id: historyIds[0], days: 365 }),
    });
    console.log("\nhistory", hist.status, (await hist.text()).slice(0, 500));
  }
}

main().catch(console.error);
