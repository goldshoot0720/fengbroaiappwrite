async function run() {
  // Try Yahoo Finance TW local site search for 台指期
  const res = await fetch(`https://tw.stock.yahoo.com/ws/option/v2/contract/summary?category=futures&symbol=TX&symbolType=all`, {
    headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
  });
  const text = await res.text();
  console.log(text.slice(0, 1000));
}
run();
