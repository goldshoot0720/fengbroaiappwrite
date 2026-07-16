const ua =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";
const code = "DYAJCH-1900JGS6A";

async function get(url) {
  const r = await fetch(url, {
    headers: {
      "User-Agent": ua,
      Referer: "https://24h.pchome.com.tw/",
      Accept: "application/json,text/plain,*/*",
      "Accept-Language": "zh-TW",
    },
  });
  const text = await r.text();
  console.log("\n", r.status, url);
  console.log(text.slice(0, 400));
  return text;
}

async function main() {
  const endpoints = [
    `https://ecapi-cdn.pchome.com.tw/ecshop/prodapi/v2/prod/${code}&fields=Id,Name,Nick,Price,Pic,Info`,
    `https://ecapi.pchome.com.tw/ecshop/prodapi/v2/prod/${code}&fields=Id,Name,Nick,Price,Pic,Info`,
    `https://ecapi-cdn.pchome.com.tw/cdn/ecshop/prodapi/v2/prod/${code}-000&fields=Id,Name,Nick,Price`,
    `https://ecapi-cdn.pchome.com.tw/ecshop/prodapi/v2/prod/${code}-000&fields=Id,Name,Nick,Price`,
    `https://ecapi-cdn.pchome.com.tw/ecshop/prodapi/v2/prod/button&id=${code}&fields=Id,Name,Nick,Price,Url,Pic`,
    `https://ecapi-cdn.pchome.com.tw/cdn/ecshop/prodapi/v2/prod/button&id=${code}-000&fields=Id,Name,Nick,Price,Url`,
    `https://24h.pchome.com.tw/prod/v3/${code}`,
    `https://ecapi-cdn.pchome.com.tw/cdn/ecshop/prodapi/v2/store/DYAJCH/prod&offset=1&limit=5&fields=Id,Name,Price`,
    // search by id
    `https://ecshweb.pchome.com.tw/search/v3.3/all/results?q=${encodeURIComponent(code)}&page=1&sort=sale/dc`,
    `https://ecapi-cdn.pchome.com.tw/cdn/ecshop/prodapi/v2/prod/button&id=${code},${code}-000&fields=Id,Name,Nick,Price,Url`,
    // region price
    `https://ecapi-cdn.pchome.com.tw/ecshop/prodapi/v2/prod/price&id=${code}`,
    `https://ecapi-cdn.pchome.com.tw/fsapi/prod/v1/prod/${code}`,
  ];

  for (const ep of endpoints) {
    try {
      await get(ep);
    } catch (e) {
      console.log("err", ep, e.message);
    }
  }
}

main();
