const ua =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";

async function get(url, headers = {}) {
  const r = await fetch(url, {
    headers: { "User-Agent": ua, "Accept-Language": "zh-TW,zh;q=0.9", ...headers },
  });
  return { status: r.status, text: await r.text() };
}

async function main() {
  // Get a real PChome product id from search
  const search = await get(
    `https://ecshweb.pchome.com.tw/search/v3.3/all/results?q=${encodeURIComponent("AirPods Pro")}&page=1&sort=rnk/dc`,
    { Referer: "https://24h.pchome.com.tw/" }
  );
  const searchJson = JSON.parse(search.text);
  const prod = searchJson.prods?.[0];
  console.log("search prod", prod?.Id, prod?.name, prod?.price);

  const code = prod?.Id;
  if (code) {
    const endpoints = [
      `https://ecapi-cdn.pchome.com.tw/ecshop/prodapi/v2/prod/button&id=${code}&fields=Id,Name,Nick,Price,Url`,
      `https://ecapi.pchome.com.tw/ecshop/prodapi/v2/prod/button&id=${code}&fields=Id,Name,Nick,Price,Url`,
      `https://ecapi-cdn.pchome.com.tw/cdn/ecshop/prodapi/v2/prod/${code}&fields=Id,Name,Nick,Price,Pic,Info,isSpec,Seq`,
      `https://ecapi-cdn.pchome.com.tw/cdn/ecshop/prodapi/v2/prod/button&id=${code}&fields=Id,Name,Nick,Price,Url`,
      `https://ecapi-cdn.pchome.com.tw/ecshop/prodapi/v2/prod/${code}&fields=Name,Nick,Price,Pic`,
    ];
    for (const ep of endpoints) {
      const r = await get(ep, { Referer: "https://24h.pchome.com.tw/" });
      console.log("\n", r.status, ep.slice(0, 90));
      console.log(r.text.slice(0, 250));
    }
  }

  // momo product
  const momoUrl = "https://www.momoshop.com.tw/goods/GoodsDetail.jsp?i_code=13166754";
  const momo = await get(momoUrl, {
    Accept: "text/html",
    Referer: "https://www.momoshop.com.tw/",
  });
  console.log("\nmomo status", momo.status, momo.text.length);
  const ogTitle = momo.text.match(/property="og:title"\s+content="([^"]+)"/i);
  const ogPrice = momo.text.match(/product:price:amount"\s+content="([^"]+)"/i);
  const titleTag = momo.text.match(/<title>([^<]+)<\/title>/i);
  console.log("momo og", ogTitle?.[1], ogPrice?.[1], titleTag?.[1]?.slice(0, 80));

  // momo ajax endpoints
  const momoApis = [
    `https://www.momoshop.com.tw/api/moec/v1/goods/getGoodsInfo?goodsCode=13166754`,
    `https://www.momoshop.com.tw/ajax/goodsInfo.jsp?i_code=13166754`,
    `https://m.momoshop.com.tw/api/moec/v1/goods/getGoodsInfo?goodsCode=13166754`,
    `https://www.momoshop.com.tw/goods/GoodsDetail.jsp?i_code=13166754&osm=pc`,
  ];
  for (const ep of momoApis) {
    try {
      const r = await get(ep, { Referer: "https://www.momoshop.com.tw/", Accept: "application/json,text/html,*/*" });
      console.log("momo api", r.status, ep.slice(0, 90), r.text.slice(0, 180).replace(/\s+/g, " "));
    } catch (e) {
      console.log("momo api err", e.message);
    }
  }

  // FindPrice structure for a product
  const fp = await get(`https://www.findprice.com.tw/g/${encodeURIComponent("AirPods Pro")}`);
  console.log("\nfindprice len", fp.text.length);
  for (const key of ["price", "元", "NT", "data-price", "product", "history"]) {
    console.log("fp has", key, fp.text.includes(key));
  }
  const prices = [...fp.text.matchAll(/\$?([\d,]{3,6})/g)].slice(0, 10).map((m) => m[1]);
  console.log("fp price-like", prices);

  // BigGo with pchome product URL flow simulation
  if (code) {
    const title = prod.name;
    const bg = await get(`https://biggo.com.tw/s/${encodeURIComponent(title)}/`, { Referer: "https://biggo.com.tw/" });
    const decoded = bg.text
      .replace(/\\u0026/g, "&")
      .replace(/\\\//g, "/")
      .replace(/\\"/g, '"')
      .replace(/\\n/g, "\n");
    const pattern =
      /"history_id":"([^"]+)"[\s\S]{0,1200}?"title":"([^"]+)"[\s\S]{0,1200}?"purl":"(https?:\/\/[^"]+)"[\s\S]{0,1200}?"price":(\d+|null)[\s\S]{0,1200}?"store":\{"image":"[^"]*","link":"[^"]*","name":"([^"]+)"/g;
    const matches = [...decoded.matchAll(pattern)];
    console.log("\nbiggo candidates for pchome title", matches.length);
    const pchome = matches.filter((m) => /pchome/i.test(m[5]) || /pchome/i.test(m[3]));
    console.log("pchome-like", pchome.slice(0, 3).map((m) => [m[5], m[4], m[2].slice(0, 40)]));
  }
}

main().catch(console.error);
