async function run() {
  const res = await fetch("https://www.youtube.com/feeds/videos.xml?channel_id=UCgjypggfQ2s-H7ITdonS28Q");
  const xml = await res.text();
  const pick = (str, regex) => str.match(regex)?.[1];
  const feedTitle = pick(xml, /<title>(.*?)<\/title>/);
  console.log("Feed title:", feedTitle);
  const entries = [...xml.matchAll(/<title>(.*?)<\/title>/g)].map(m => m[1]);
  console.log("Videos:", entries.slice(1, 5));
}
run();
