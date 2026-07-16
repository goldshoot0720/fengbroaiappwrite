const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const url = "https://www.railway.gov.tw/tra-tip-web/tip/tip004/tip421/storeLocation";

function strip(v) {
  return v
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const res = await fetch(url, { headers: { "user-agent": UA } });
const html = await res.text();
const re = /class="sublist-title"[^>]*>([\s\S]*?)<\/div>\s*<ol>([\s\S]*?)<\/ol>/gi;
const stores = [];
let m;
while ((m = re.exec(html))) {
  const name = strip(m[1]);
  if (!/便當|本舖|舖/.test(name)) continue;
  const lis = [...m[2].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((x) => strip(x[1]));
  stores.push({ name, detail: lis.join("；"), focus: /桃園|中壢/.test(name) });
}
console.log("all", stores.length);
console.log(JSON.stringify(stores.filter((s) => s.focus), null, 2));
