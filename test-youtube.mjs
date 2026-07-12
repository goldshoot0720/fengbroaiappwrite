async function run() {
  const res = await fetch("https://www.youtube.com/feeds/videos.xml?channel_id=UCgjypggfQ2s-H7ITdonS28Q"); // Leonard精選片段
  const xml = await res.text();
  console.log(xml.substring(0, 2000));
}
run();
