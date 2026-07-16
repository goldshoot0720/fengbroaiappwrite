import fs from "node:fs";

const t = fs.readFileSync("scratch/news-bing-traffic.tycg.gov.tw.html", "utf8");
console.log("b_algo", (t.match(/b_algo/g) || []).length);
console.log("b_title", (t.match(/b_title/g) || []).length);
console.log("cite", (t.match(/<cite/g) || []).length);
console.log("ol id b_results", t.includes('id="b_results"'));
console.log("no results?", /沒有任何結果|没有与|There are no results/i.test(t));

const idx = t.indexOf("traffic");
console.log("idx traffic", idx);
if (idx >= 0) console.log(t.slice(Math.max(0, idx - 120), idx + 400).replace(/\s+/g, " "));

const urls = [...t.matchAll(/https?:\/\/[a-z0-9.-]*traffic\.tycg\.gov\.tw[^"'\\\s<>]*/gi)].map((m) => m[0]).slice(0, 15);
console.log("urls", urls);

// Look for JSON embedded results
const jsonIdx = t.indexOf("organic");
console.log("organic idx", jsonIdx);
if (jsonIdx >= 0) console.log(t.slice(jsonIdx, jsonIdx + 200));

// Find any h2 with href
const h2s = [...t.matchAll(/<h2[\s\S]{0,200}<\/h2>/gi)].slice(0, 5);
console.log("h2 samples", h2s.map((m) => m[0].replace(/\s+/g, " ").slice(0, 180)));
