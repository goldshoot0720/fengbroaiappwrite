const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const listUrl = "https://www.zhongli.tycg.gov.tw/News.aspx?n=5605&sms=10728";
const res = await fetch(listUrl, {
  headers: { "user-agent": UA, "accept-language": "zh-TW,zh;q=0.9" },
});
const html = await res.text();

// find form-related snippets
const patterns = [
  /jNewsModule[\s\S]{0,400}/gi,
  /field_2[\s\S]{0,200}/gi,
  /BtnSend[\s\S]{0,200}/gi,
  /__EVENTTARGET[\s\S]{0,100}/gi,
  /關鍵字[\s\S]{0,300}/gi,
];

for (const re of patterns) {
  const m = html.match(re);
  console.log("---", re.source.slice(0, 30));
  for (const x of (m || []).slice(0, 3)) {
    console.log(x.replace(/\s+/g, " ").slice(0, 300));
  }
}

// Find all input/select near search
const formBits = [...html.matchAll(/<(input|select|button)[^>]*(jNews|Search|search|keyword|Btn)[^>]*>/gi)];
console.log("form bits", formBits.map((m) => m[0]).slice(0, 20));
