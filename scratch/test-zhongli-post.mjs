const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const listUrl = "https://www.zhongli.tycg.gov.tw/News.aspx?n=5605&sms=10728";

const getRes = await fetch(listUrl, {
  headers: { "user-agent": UA, "accept-language": "zh-TW,zh;q=0.9" },
});
const html = await getRes.text();
console.log("GET", getRes.status, html.length);

function pick(name) {
  const re = new RegExp(`name="${name}"[^>]*value="([^"]*)"`, "i");
  const m = html.match(re);
  return m ? m[1] : "";
}

const viewstate = pick("__VIEWSTATE");
const generator = pick("__VIEWSTATEGENERATOR");
const encrypted = pick("__VIEWSTATEENCRYPTED");
console.log("viewstate len", viewstate.length, "gen", generator);

const body = new URLSearchParams({
  __VIEWSTATE: viewstate,
  __VIEWSTATEGENERATOR: generator,
  __VIEWSTATEENCRYPTED: encrypted,
  jNewsModule_field_SDate_1: "",
  jNewsModule_field_EDate_1: "",
  jNewsModule_field_2: "中新地下道",
  jNewsModule_BtnSend: "送出",
});

const postRes = await fetch(listUrl, {
  method: "POST",
  headers: {
    "user-agent": UA,
    "accept-language": "zh-TW,zh;q=0.9",
    "content-type": "application/x-www-form-urlencoded",
    referer: listUrl,
    origin: "https://www.zhongli.tycg.gov.tw",
  },
  body,
  redirect: "follow",
});
const postHtml = await postRes.text();
console.log("POST", postRes.status, postHtml.length, postRes.url);
console.log("has keyword", postHtml.includes("中新地下道"));
console.log("has 1616891", postHtml.includes("1616891"));

const re = /News_Content\.aspx\?[^"']+s=(\d+)[^"']*["'][^>]*>([\s\S]{0,300}?)</gi;
let m;
let n = 0;
while ((m = re.exec(postHtml)) && n < 10) {
  const title = m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  if (title) {
    console.log(m[1], title.slice(0, 100));
    n++;
  }
}

// broader link extraction around keyword
const idx = postHtml.indexOf("中新地下道");
if (idx >= 0) {
  console.log("context:", postHtml.slice(Math.max(0, idx - 250), idx + 80).replace(/\s+/g, " "));
}
