const ua =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";

async function main() {
  // Yahoo search JSON endpoints
  const endpoints = [
    `https://tw.buy.yahoo.com/api/v1/search?p=${encodeURIComponent("AirPods Pro 3")}`,
    `https://tw.buy.yahoo.com/search/product?p=${encodeURIComponent("AirPods Pro 3")}&view=json`,
    `https://tw.fd-api.com/api/v5/menu/search?q=${encodeURIComponent("AirPods")}`,
  ];
  for (const url of endpoints) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": ua, Accept: "application/json,text/html,*/*", Referer: "https://tw.buy.yahoo.com/" },
      });
      console.log(r.status, url, (await r.text()).slice(0, 200).replace(/\s+/g, " "));
    } catch (e) {
      console.log("err", url, e.message);
    }
  }

  // momo search result structure
  const momo = await fetch(
    `https://www.momoshop.com.tw/search/searchShop.jsp?keyword=${encodeURIComponent("AirPods Pro 3")}`,
    {
      headers: {
        "User-Agent": ua,
        Accept: "text/html",
        Referer: "https://www.momoshop.com.tw/",
        "Accept-Language": "zh-TW",
      },
    }
  );
  const html = await momo.text();
  const idx = html.indexOf("SearchResult");
  console.log("\nmomo around SearchResult", html.slice(idx, idx + 800).replace(/\s+/g, " "));

  // look for goodsUrl / goodsCode
  for (const key of ["goodsCode", "goodsName", "goodsPrice", "price", "i_code", "prdName"]) {
    console.log(key, (html.match(new RegExp(key, "g")) || []).length);
  }

  const nameHits = [...html.matchAll(/AirPods[^<"]{0,40}/g)].slice(0, 8);
  console.log("name hits", nameHits.map((m) => m[0]));

  // try mobile search API
  const mApis = [
    `https://m.momoshop.com.tw/api/search?keyword=${encodeURIComponent("AirPods Pro 3")}`,
    `https://www.momoshop.com.tw/api/search?keyword=${encodeURIComponent("AirPods Pro 3")}`,
    `https://m.momoshop.com.tw/search.momo?searchKeyword=${encodeURIComponent("AirPods Pro 3")}`,
  ];
  for (const url of mApis) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": ua, Accept: "application/json,text/html,*/*", Referer: "https://m.momoshop.com.tw/" },
      });
      console.log("momo api", r.status, url, (await r.text()).slice(0, 180).replace(/\s+/g, " "));
    } catch (e) {
      console.log("momo api err", e.message);
    }
  }
}

main().catch(console.error);
