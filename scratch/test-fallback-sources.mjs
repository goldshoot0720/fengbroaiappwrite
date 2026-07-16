const ua =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";

async function get(url, headers = {}) {
  const r = await fetch(url, {
    headers: { "User-Agent": ua, "Accept-Language": "zh-TW,zh;q=0.9", ...headers },
  });
  return { status: r.status, text: await r.text(), headers: r.headers };
}

async function main() {
  // FindPrice page structure
  const fp = await get(`https://www.findprice.com.tw/g/${encodeURIComponent("AirPods Pro 3")}`);
  const decoded = fp.text;
  // look for product cards
  const samples = [];
  for (const re of [
    /class="[^"]*price[^"]*"[^>]*>[\s\S]{0,80}/gi,
    /data-[a-z-]*price[^=]*="[^"]+"/gi,
    /\$[\d,]+/g,
    /NT\$\s*[\d,]+/gi,
    /"price"\s*:\s*\d+/gi,
  ]) {
    const m = [...decoded.matchAll(re)].slice(0, 5).map((x) => x[0]);
    if (m.length) samples.push([re.source.slice(0, 40), m]);
  }
  console.log("FindPrice patterns", samples);

  // Look for structured list items
  const idx = decoded.toLowerCase().indexOf("airpods");
  console.log("around product", decoded.slice(Math.max(0, idx - 100), idx + 500).replace(/\s+/g, " "));

  // PChome multi search as comparison source
  const pchome = await get(
    `https://ecshweb.pchome.com.tw/search/v3.3/all/results?q=${encodeURIComponent("AirPods Pro 3")}&page=1&sort=rnk/dc`,
    { Referer: "https://24h.pchome.com.tw/" }
  );
  const pj = JSON.parse(pchome.text);
  console.log(
    "\nPChome results",
    pj.prods?.slice(0, 5).map((p) => ({ id: p.Id, name: p.name, price: p.price }))
  );

  // Yahoo shopping search - find JSON
  const yahoo = await get(`https://tw.buy.yahoo.com/search/product?p=${encodeURIComponent("AirPods Pro 3")}`);
  console.log("\nYahoo len", yahoo.text.length);
  const ynext = yahoo.text.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  console.log("yahoo next data", !!ynext, ynext?.[1]?.length);
  if (ynext) {
    const data = JSON.parse(ynext[1]);
    console.log("keys", Object.keys(data));
    console.log("page props keys", Object.keys(data.props?.pageProps || {}));
    const str = JSON.stringify(data).slice(0, 500);
    console.log(str);
  }

  // Try Yahoo product page API
  const yProduct = await get(
    "https://tw.buy.yahoo.com/gdsale/gdsale.asp?gdid=11884262",
    { Referer: "https://tw.buy.yahoo.com/" }
  );
  console.log("\nyahoo product", yProduct.status, yProduct.text.length);
  const yTitle = yProduct.text.match(/property="og:title"\s+content="([^"]+)"/i);
  const yPrice = yProduct.text.match(/product:price:amount"\s+content="([^"]+)"/i);
  console.log("yahoo meta", yTitle?.[1], yPrice?.[1]);

  // momo search
  const momoSearch = await get(
    `https://www.momoshop.com.tw/search/searchShop.jsp?keyword=${encodeURIComponent("AirPods Pro 3")}`,
    { Referer: "https://www.momoshop.com.tw/" }
  );
  console.log("\nmomo search", momoSearch.status, momoSearch.text.length);
  const mTitle = [...momoSearch.text.matchAll(/goodsName[^>]*>([^<]{5,80})</gi)].slice(0, 3);
  const mPrice = [...momoSearch.text.matchAll(/price[^>]*>[\s$]*([\d,]+)/gi)].slice(0, 5);
  console.log("momo titles", mTitle.map((m) => m[1]));
  console.log("momo prices", mPrice.map((m) => m[0].slice(0, 60)));

  // Check if momo has JSON in page
  const mJson = momoSearch.text.match(/searchResult|goodsInfo|productList/i);
  console.log("momo json marker", mJson?.[0]);
}

main().catch(console.error);
