const url = "https://www.landtop.com.tw/products/samsung-a17";
const res = await fetch(url, {
  headers: {
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    accept: "text/html",
  },
});
const t = await res.text();
console.log("status", res.status, "len", t.length);

// JSON-LD offers
const ldBlocks = [...t.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
console.log("ld blocks", ldBlocks.length);
for (const block of ldBlocks) {
  try {
    const data = JSON.parse(block[1]);
    if (!data.offers) continue;
    console.log("product name", data.name);
    const uniq = new Map();
    for (const o of data.offers) {
      const m = String(o.sku || "").match(/(\d+G\/\d+G)/i);
      const key = m ? m[1] : o.sku;
      if (!uniq.has(key)) uniq.set(key, { price: o.price, sku: o.sku });
    }
    console.log("offers by variant", [...uniq.entries()]);
  } catch {
    // ignore
  }
}

const variantPattern =
  /data-product-id="(\d+)"[\s\S]{0,300}?data-variant-id="(\d+)"[\s\S]{0,250}?<div class="label-price">([^<]+)<\/div>/gi;
const variants = [...t.matchAll(variantPattern)];
console.log("variant links", variants.length);
console.log(variants.slice(0, 15).map((v) => `${v[1]}:${v[2]}:${v[3].trim()}`));

const allPid = [...new Set([...t.matchAll(/data-product-id="(\d+)"/g)].map((m) => m[1]))];
const allVid = [...new Set([...t.matchAll(/data-variant-id="(\d+)"/g)].map((m) => m[1]))];
console.log("product ids", allPid);
console.log("variant ids count", allVid.length, allVid.slice(0, 20));

// label-price samples
const labels = [...t.matchAll(/label-price">([^<]+)</gi)].map((m) => m[1].trim());
console.log("label-price samples", labels.slice(0, 20));

// price-product-name
const names = [...t.matchAll(/price-product-name">([\s\S]*?)<\/div>/gi)].map((m) =>
  m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
);
console.log("price-product-name", names.slice(0, 5));
