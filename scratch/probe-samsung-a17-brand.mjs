const brandUrl = "https://www.landtop.com.tw/brands?brand=samsung";
const res = await fetch(brandUrl, {
  headers: {
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  },
});
const t = await res.text();
const idx = t.toLowerCase().indexOf("samsung-a17");
console.log("idx", idx, "len", t.length);
if (idx >= 0) console.log(t.slice(idx - 200, idx + 800).replace(/\s+/g, " "));

// find a17 mentions
const a17 = [...t.matchAll(/A17[^<]{0,80}/gi)].slice(0, 10).map((m) => m[0]);
console.log("a17 mentions", a17);

// try variant fetch
for (const vid of ["401", "386"]) {
  const r = await fetch(
    `https://www.landtop.com.tw/products/variants?product_id=3298&variant_id=${vid}`,
    {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "text/vnd.turbo-stream.html",
        "X-Requested-With": "XMLHttpRequest",
        Referer: "https://www.landtop.com.tw/products/samsung-a17",
      },
    }
  );
  const body = await r.text();
  const name = (body.match(/price-product-name">([\s\S]*?)<\/div>/i)?.[1] || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const disc = (body.match(/discount-price">([\s\S]*?)<\/div>/i)?.[1] || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const strike = (body.match(/text-strikethrough[^"]*">([\s\S]*?)<\/div>/i)?.[1] || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  console.log({ vid, status: r.status, name, disc, strike, len: body.length });
}
