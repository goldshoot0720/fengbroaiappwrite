const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function tryUrl(label, url, init) {
  const res = await fetch(url, {
    headers: {
      "user-agent": UA,
      "accept-language": "zh-TW,zh;q=0.9",
      ...(init?.headers || {}),
    },
    ...init,
    redirect: "follow",
  });
  const html = await res.text();
  console.log(label, res.status, html.length, "keyword", html.includes("中新地下道"), "id", html.includes("1616891"));
  if (html.includes("中新地下道")) {
    const re = /News_Content\.aspx\?([^"'<>]*s=\d+[^"'<>]*)["'][^>]*>([\s\S]{0,200}?)</gi;
    let m;
    let n = 0;
    while ((m = re.exec(html)) && n < 8) {
      const title = m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      if (title.includes("中新") || title.length > 4) {
        console.log(" ", title.slice(0, 80), "=>", m[1].slice(0, 80));
        n++;
      }
    }
    const idx = html.indexOf("中新地下道");
    console.log(" context", html.slice(Math.max(0, idx - 180), idx + 40).replace(/\s+/g, " "));
  }
  return html;
}

// Advanced search
await tryUrl("advanced", "https://www.zhongli.tycg.gov.tw/Advanced_Search.aspx?q=" + encodeURIComponent("中新地下道"));

// Site search pages
await tryUrl("search1", "https://www.zhongli.tycg.gov.tw/Search.aspx?q=" + encodeURIComponent("中新地下道"));
await tryUrl("search2", "https://www.zhongli.tycg.gov.tw/search.aspx?q=" + encodeURIComponent("中新地下道"));

// POST with correct button value
const listUrl = "https://www.zhongli.tycg.gov.tw/News.aspx?n=5605&sms=10728";
const html = await tryUrl("list", listUrl);
function pick(name) {
  const re = new RegExp(`name="${name}"[^>]*value="([^"]*)"`, "i");
  const m = html.match(re);
  return m ? m[1] : "";
}
const body = new URLSearchParams({
  __VIEWSTATE: pick("__VIEWSTATE"),
  __VIEWSTATEGENERATOR: pick("__VIEWSTATEGENERATOR"),
  __VIEWSTATEENCRYPTED: pick("__VIEWSTATEENCRYPTED"),
  jNewsModule_field_SDate_1: "",
  jNewsModule_field_EDate_1: "",
  jNewsModule_field_2: "中新地下道",
  jNewsModule_BtnSend: "送出查詢",
});
await tryUrl("post-correct", listUrl, {
  method: "POST",
  headers: {
    "content-type": "application/x-www-form-urlencoded",
    referer: listUrl,
    origin: "https://www.zhongli.tycg.gov.tw",
  },
  body,
});

// Maybe GET with field params
await tryUrl(
  "get-fields",
  listUrl + "&jNewsModule_field_2=" + encodeURIComponent("中新地下道")
);
