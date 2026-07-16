const ua =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";

async function main() {
  const r = await fetch(`https://biggo.com.tw/s/${encodeURIComponent("AirPods Pro")}/`, {
    headers: { "User-Agent": ua, Referer: "https://biggo.com.tw/", "Accept-Language": "zh-TW" },
  });
  const html = await r.text();
  console.log("status", r.status, "len", html.length);

  // Find keys related to history
  for (const key of ["history_id", "historyId", "price_history", "current_price", "purl", '"store"']) {
    const idx = html.indexOf(key);
    console.log(key, "first index", idx);
    if (idx >= 0) console.log("  context:", html.slice(Math.max(0, idx - 40), idx + 120).replace(/\s+/g, " "));
  }

  // Count occurrences
  console.log("history_id count", (html.match(/history_id/g) || []).length);
  console.log("historyId count", (html.match(/historyId/g) || []).length);

  // Look for __NEXT_DATA__ or similar
  const nextData = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  console.log("NEXT_DATA", !!nextData, nextData ? nextData[1].length : 0);

  // Look for json blobs
  const scriptJson = [...html.matchAll(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/g)];
  console.log("application/json scripts", scriptJson.length);

  // Sample any history_id-like patterns
  const ids = [...html.matchAll(/history[_-]?id["']?\s*[:=]\s*["']([^"']+)["']/gi)].slice(0, 5);
  console.log("id-like", ids.map((m) => m[0].slice(0, 80)));

  // Find product-like structures
  const titleHits = [...html.matchAll(/"title"\s*:\s*"([^"\\]{10,80})"/g)].slice(0, 8);
  console.log("titles", titleHits.map((m) => m[1]));

  // Check for nuxt/vue state
  const nuxt = html.match(/window\.__NUXT__|__INITIAL_STATE__|self\.__next_f/);
  console.log("state marker", nuxt && nuxt[0]);

  // Write a snippet around first title
  if (titleHits[0]) {
    const i = html.indexOf(titleHits[0][0]);
    console.log("around first title:\n", html.slice(Math.max(0, i - 300), i + 500).replace(/\s+/g, " "));
  }
}

main().catch(console.error);
