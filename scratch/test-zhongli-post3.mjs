const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const listUrl = "https://www.zhongli.tycg.gov.tw/News.aspx?n=5605&sms=10728";

const getRes = await fetch(listUrl, {
  headers: { "user-agent": UA, "accept-language": "zh-TW,zh;q=0.9" },
});
const html = await getRes.text();

function pick(name, source = html) {
  // handle value before or after name
  const re1 = new RegExp(`name=["']${name}["'][^>]*value=["']([^"']*)["']`, "i");
  const re2 = new RegExp(`value=["']([^"']*)["'][^>]*name=["']${name}["']`, "i");
  return (source.match(re1)?.[1] ?? source.match(re2)?.[1] ?? "");
}

async function post(label, fields) {
  const body = new URLSearchParams(fields);
  const res = await fetch(listUrl, {
    method: "POST",
    headers: {
      "user-agent": UA,
      "accept-language": "zh-TW,zh;q=0.9",
      "content-type": "application/x-www-form-urlencoded",
      referer: listUrl,
      origin: "https://www.zhongli.tycg.gov.tw",
    },
    body,
  });
  const text = await res.text();
  console.log(label, res.status, text.length, "kw", text.includes("中新地下道"), "id", text.includes("1616891"));
  // check if field value was retained
  const retained = text.includes('jNewsModule_field_2"') && text.includes("中新地下道");
  console.log("  retained field?", retained);
  if (text.includes("中新地下道")) {
    const idx = text.indexOf("中新地下道");
    console.log("  ctx", text.slice(Math.max(0, idx - 120), idx + 40).replace(/\s+/g, " "));
  }
  // count news links
  const links = [...text.matchAll(/News_Content\.aspx\?n=5605&sms=10728&s=(\d+)/g)].map((m) => m[1]);
  console.log("  articles", [...new Set(links)].slice(0, 5), "count", new Set(links).size);
  return text;
}

const base = {
  __VIEWSTATE: pick("__VIEWSTATE"),
  __VIEWSTATEGENERATOR: pick("__VIEWSTATEGENERATOR"),
  __VIEWSTATEENCRYPTED: pick("__VIEWSTATEENCRYPTED"),
};

await post("A submit", {
  ...base,
  jNewsModule_field_SDate_1: "",
  jNewsModule_field_2: "中新地下道",
  jNewsModule_BtnSend: "送出查詢",
});

await post("B eventtarget", {
  ...base,
  __EVENTTARGET: "jNewsModule_BtnSend",
  __EVENTARGUMENT: "",
  jNewsModule_field_SDate_1: "",
  jNewsModule_field_2: "中新地下道",
});

await post("C with dates empty strings and reset absent", {
  ...base,
  __EVENTTARGET: "",
  __EVENTARGUMENT: "",
  jNewsModule_field_SDate_1: "",
  jNewsModule_field_EDate_1: "",
  jNewsModule_field_2: "中新地下道",
  jNewsModule_BtnSend: "送出查詢",
});

// Scan several pages for the article
for (let page = 1; page <= 19; page++) {
  const res = await fetch(
    `https://www.zhongli.tycg.gov.tw/News.aspx?n=5605&sms=10728&page=${page}&PageSize=20`,
    { headers: { "user-agent": UA, "accept-language": "zh-TW,zh;q=0.9" } }
  );
  const text = await res.text();
  if (text.includes("中新地下道") || text.includes("1616891")) {
    console.log("FOUND on page", page);
    const idx = text.indexOf("中新地下道");
    console.log(text.slice(Math.max(0, idx - 150), idx + 50).replace(/\s+/g, " "));
    break;
  }
  if (page === 19) console.log("not found in 19 pages");
}
