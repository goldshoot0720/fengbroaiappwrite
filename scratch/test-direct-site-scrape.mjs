const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function get(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent": UA,
      "accept-language": "zh-TW,zh;q=0.9",
      accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });
  const text = await res.text();
  console.log(url, res.status, text.length, res.url);
  return text;
}

const keyword = encodeURIComponent("中新地下道");

// Traffic bureau list / search candidates
const urls = [
  "https://traffic.tycg.gov.tw/businessd/post/list.aspx?key=%E4%B8%AD%E6%96%B0%E5%9C%B0%E4%B8%8B%E9%81%93&uid=0&cid=0&con=1",
  "https://traffic.tycg.gov.tw/businessd/post/list_more.aspx?key=%E4%B8%AD%E6%96%B0%E5%9C%B0%E4%B8%8B%E9%81%93&uid=0&cid=0&cid2=0&con=1",
  "https://www.zhongli.tycg.gov.tw/News.aspx?n=5605&sms=10728",
  "https://www.zhongli.tycg.gov.tw/News.aspx?n=5605&sms=10728&page=1&PageSize=30",
  "https://www.rb.gov.tw/zh-TW/NREO/NREO_13/NREO_30/NREO_31/",
  "https://www.rb.gov.tw/zh-TW/search?q=%E4%B8%AD%E6%96%B0%E5%9C%B0%E4%B8%8B%E9%81%93",
  "https://www.rb.gov.tw/search?q=%E4%B8%AD%E6%96%B0%E5%9C%B0%E4%B8%8B%E9%81%93",
];

for (const url of urls) {
  try {
    const html = await get(url);
    const hasKeyword = html.includes("中新地下道");
    console.log("  has keyword:", hasKeyword);
    if (hasKeyword) {
      // extract nearby links
      const re = /href="([^"]+)"[^>]*>([\s\S]{0,200}?中新地下道[\s\S]{0,80}?)</gi;
      let m;
      let n = 0;
      while ((m = re.exec(html)) && n < 5) {
        console.log("  match", m[1], "=>", m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 80));
        n++;
      }
      // also reverse: text then href patterns
      const idx = html.indexOf("中新地下道");
      console.log("  context:", html.slice(Math.max(0, idx - 200), idx + 100).replace(/\s+/g, " "));
    }
  } catch (e) {
    console.log("ERR", url, e.message);
  }
  console.log("---");
}
