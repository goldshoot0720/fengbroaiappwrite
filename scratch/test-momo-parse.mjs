const ua =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";

async function main() {
  const r = await fetch(
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
  const html = await r.text();

  // Find goodsName patterns with surrounding context
  const idx = html.indexOf("goodsName");
  console.log("first goodsName context:\n", html.slice(idx - 100, idx + 400));

  // Try to extract JSON object containing rtnCateGoods or similar
  for (const key of ["rtnCateGoods", "goodsInfoList", "searchGoods", "goodsList", "dataList"]) {
    console.log(key, html.includes(key));
  }

  // Regex for goods entries
  const re =
    /"goodsCode"\s*:\s*"(\d+)"[\s\S]{0,500}?"goodsName"\s*:\s*"([^"]+)"[\s\S]{0,500}?"goodsPrice"\s*:\s*"?(\d+)"?/g;
  const matches = [...html.matchAll(re)].slice(0, 5);
  console.log(
    "regex matches",
    matches.map((m) => ({ code: m[1], name: m[2].slice(0, 40), price: m[3] }))
  );

  // reverse order name first
  const re2 =
    /"goodsName"\s*:\s*"([^"]+)"[\s\S]{0,400}?"goodsPrice"\s*:\s*"?(\d+)"?[\s\S]{0,200}?"goodsCode"\s*:\s*"(\d+)"/g;
  const matches2 = [...html.matchAll(re2)].slice(0, 5);
  console.log(
    "regex2",
    matches2.map((m) => ({ name: m[1].slice(0, 40), price: m[2], code: m[3] }))
  );

  // product page price extraction improvement
  const page = await fetch("https://www.momoshop.com.tw/goods/GoodsDetail.jsp?i_code=13166754", {
    headers: { "User-Agent": ua, Referer: "https://www.momoshop.com.tw/" },
  });
  const phtml = await page.text();
  for (const re of [
    /property="og:title"\s+content="([^"]+)"/i,
    /property="product:price:amount"\s+content="([^"]+)"/i,
    /"salePrice"\s*:\s*"?(\d+)/i,
    /"goodsPrice"\s*:\s*"?(\d+)/i,
    /"price"\s*:\s*"?(\d{3,})/i,
    /promoPrice[^>]*>[\s$]*([\d,]+)/i,
  ]) {
    const m = phtml.match(re);
    console.log(re.source.slice(0, 40), m?.[1]);
  }
}

main().catch(console.error);
