const listUrl = "https://r.jina.ai/https://www.rb.gov.tw/zh-TW/NREO/NREO_13/NREO_30/NREO_31/";
const res = await fetch(listUrl, {
  headers: { accept: "text/plain", "user-agent": "Mozilla/5.0" },
});
const text = await res.text();
console.log("status", res.status, text.length);
console.log(text.slice(0, 3000));
console.log("--- keyword ---");
const lines = text.split("\n").filter((l) => l.includes("中新") || l.includes("地下道") || l.includes("NREO_31/20"));
console.log(lines.slice(0, 40).join("\n"));
