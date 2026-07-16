const ua =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";

async function get(url, headers = {}) {
  const r = await fetch(url, {
    headers: { "User-Agent": ua, "Accept-Language": "zh-TW,zh;q=0.9", ...headers },
    cache: "no-store",
  });
  const text = await r.text();
  return { status: r.status, text, headers: Object.fromEntries(r.headers.entries()) };
}

async function post(url, body, headers = {}) {
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": ua,
      ...headers,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await r.text();
  return { status: r.status, text };
}

async function main() {
  // PChome page vs API
  const code = "DYAJ2Y-A900BIY8G";
  const page = await get(`https://24h.pchome.com.tw/prod/${code}`);
  console.log("PChome page", page.status, page.text.slice(0, 120));

  const button = await get(
    `https://ecapi-cdn.pchome.com.tw/ecshop/prodapi/v2/prod/button&id=${encodeURIComponent(code)}&fields=Id,Name,Nick,Price,Url`,
    { Referer: "https://24h.pchome.com.tw/" }
  );
  console.log("PChome button", button.status, button.text.slice(0, 300));

  const full = await get(
    `https://ecapi-cdn.pchome.com.tw/cdn/ecshop/prodapi/v2/prod/${code}&fields=Id,Name,Nick,Price,Pic,Info,isSpec,Seq`,
    { Referer: "https://24h.pchome.com.tw/" }
  );
  console.log("PChome full", full.status, full.text.slice(0, 400));

  // Try search API for real product
  const searchApi = await get(
    `https://ecshweb.pchome.com.tw/search/v3.3/all/results?q=${encodeURIComponent("AirPods")}&page=1&sort=rnk/dc`,
    { Referer: "https://24h.pchome.com.tw/" }
  );
  console.log("PChome search", searchApi.status, searchApi.text.slice(0, 500));

  // momo
  const momoPage = await get("https://www.momoshop.com.tw/goods/GoodsDetail.jsp?i_code=13166754");
  console.log("momo page", momoPage.status, momoPage.text.slice(0, 150));

  // BigGo search + history
  const bg = await get(`https://biggo.com.tw/s/${encodeURIComponent("AirPods Pro")}/`, {
    Referer: "https://biggo.com.tw/",
  });
  console.log("BigGo search", bg.status, bg.text.length);
  const m = bg.text.match(
    /"history_id":"([^"]+)"[\s\S]{0,1200}?"title":"([^"]+)"[\s\S]{0,1200}?"price":(\d+|null)/
  );
  console.log("history match", m ? [m[1], m[2].slice(0, 60), m[3]] : null);

  if (m) {
    const hist = await post(
      "https://biggo.com.tw/api/v1/spa/product/history",
      { history_id: m[1], days: 365 },
      { region: "tw", referer: "https://biggo.com.tw/" }
    );
    console.log("BigGo history", hist.status, hist.text.slice(0, 400));
  }

  // FindPrice search
  const fp = await get(`https://www.findprice.com.tw/g/${encodeURIComponent("AirPods Pro")}`);
  console.log("FindPrice", fp.status, fp.text.length, fp.text.slice(0, 200).replace(/\s+/g, " "));

  // Yahoo shopping TW search
  const yahoo = await get(
    `https://tw.buy.yahoo.com/search/product?p=${encodeURIComponent("AirPods Pro")}`
  );
  console.log("Yahoo buy", yahoo.status, yahoo.text.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
