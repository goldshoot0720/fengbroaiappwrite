async function run() {
  const res = await fetch("https://www.youtube.com/feeds/videos.xml?channel_id=UCgjypggfQ2s-H7ITdonS28Q"); // YouTube RSS feed sample
  const xml = await res.text();
  console.log(xml.substring(0, 2000));
}
run();
