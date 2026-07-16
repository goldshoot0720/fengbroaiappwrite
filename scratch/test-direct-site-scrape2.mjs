import fs from "node:fs";

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
  console.log(url, res.status, text.length, "final", res.url);
  return text;
}

// Zhongli search
const zhongliCandidates = [
  "https://www.zhongli.tycg.gov.tw/News.aspx?n=5605&sms=10728&Search=%E4%B8%AD%E6%96%B0%E5%9C%B0%E4%B8%8B%E9%81%93",
  "https://www.zhongli.tycg.gov.tw/News.aspx?n=5605&sms=10728&q=%E4%B8%AD%E6%96%B0%E5%9C%B0%E4%B8%8B%E9%81%93",
  "https://www.zhongli.tycg.gov.tw/News_Content.aspx?n=5605&sms=10728&s=1616891",
  "https://www.zhongli.tycg.gov.tw/News.aspx?n=5605&sms=10728&page=1&PageSize=100",
];

for (const url of zhongliCandidates) {
  try {
    const html = await get(url);
    fs.writeFileSync("scratch/zhongli-sample.html", html);
    console.log("  has keyword", html.includes("中新地下道"), "has 1616891", html.includes("1616891"));
    // find search form fields
    const inputs = [...html.matchAll(/<input[^>]+name="([^"]+)"[^>]*>/gi)].map((m) => m[1]).slice(0, 30);
    console.log("  inputs", inputs);
    const searchHints = [...html.matchAll(/搜尋|Search|keyword|關鍵字/gi)].slice(0, 10).map((m) => m[0]);
    console.log("  hints", searchHints);
  } catch (e) {
    console.log("ERR", e.message);
  }
  console.log("---");
}

// RB site
const rbCandidates = [
  "https://www.rb.gov.tw/",
  "https://www.rb.gov.tw/zh-TW/",
  "https://www.rb.gov.tw/zh-TW/NREO/NREO_13/NREO_30/NREO_31/20260420_151005/",
  "https://www.rb.gov.tw/api/search?q=%E4%B8%AD%E6%96%B0%E5%9C%B0%E4%B8%8B%E9%81%93",
];

for (const url of rbCandidates) {
  try {
    const html = await get(url);
    fs.writeFileSync("scratch/rb-sample.html", html.slice(0, 5000));
    console.log("  body sample:", html.slice(0, 400).replace(/\s+/g, " "));
    console.log("  has keyword", html.includes("中新地下道"));
  } catch (e) {
    console.log("ERR", e.message);
  }
  console.log("---");
}
