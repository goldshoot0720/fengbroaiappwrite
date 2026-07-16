/**
 * Direct integration-style test of the three adapters without Next server.
 * Mirrors app/api/fengbro-news adapters at a high level for smoke check.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const query = "中新地下道";

function stripTags(value) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Traffic
{
  const listUrl = `https://traffic.tycg.gov.tw/businessd/post/list.aspx?key=${encodeURIComponent(query)}&uid=0&cid=0&con=1`;
  const res = await fetch(listUrl, { headers: { "user-agent": UA, "accept-language": "zh-TW" } });
  const html = await res.text();
  const re = /href="((?:upt|plus)\.aspx\?[^"]*p0=\d+[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const found = [];
  let m;
  while ((m = re.exec(html))) {
    const title = stripTags(m[2]);
    if (title.includes(query)) found.push({ title, href: m[1] });
  }
  console.log("TRAFFIC", found.slice(0, 3));
}

// RB via jina
{
  const listUrl = "https://r.jina.ai/https://www.rb.gov.tw/zh-TW/NREO/NREO_13/NREO_30/NREO_31/?page=1";
  const res = await fetch(listUrl, { headers: { accept: "text/plain" } });
  const text = await res.text();
  const re =
    /\[([^\]]+)\]\((https?:\/\/(?:www\.)?rb\.gov\.tw\/zh-TW\/NREO\/NREO_13\/NREO_30\/NREO_31\/[^)\s]+)\)/gi;
  const found = [];
  let m;
  while ((m = re.exec(text))) {
    if (m[1].includes(query)) found.push({ title: m[1], url: m[2] });
  }
  console.log("RB", found.slice(0, 3));
}

// Zhongli pages
{
  const found = [];
  for (let page = 1; page <= 12; page++) {
    const listUrl = `https://www.zhongli.tycg.gov.tw/News.aspx?n=5605&sms=10728&page=${page}&PageSize=20`;
    const res = await fetch(listUrl, { headers: { "user-agent": UA, "accept-language": "zh-TW" } });
    const html = await res.text();
    const re = /href="(News_Content\.aspx\?[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = re.exec(html))) {
      const title = stripTags(m[2]);
      if (title.includes(query)) found.push({ title, href: m[1], page });
    }
    if (found.length) break;
  }
  console.log("ZHONGLI", found.slice(0, 3));
}
