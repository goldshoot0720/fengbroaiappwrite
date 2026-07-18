async function run() {
  // Now it's the night session window (03:00 AM CST = 19:00 UTC-1)
  // Let's try MarketType=1 but not filtering
  const res = await fetch("https://mis.taifex.com.tw/futures/api/getQuoteList", {
    method: "POST",
    headers: {
      "user-agent": "Mozilla/5.0",
      "Content-Type": "application/json",
      "Referer": "https://mis.taifex.com.tw/"
    },
    body: JSON.stringify({ MarketType: "1", commodity_id: "TXF", queryType: "1" })
  });
  const data = await res.json();
  const list = data?.RtData?.QuoteList || [];
  console.log("Night session count:", list.length);
  const txf = list.filter(q => q.SymbolID && q.SymbolID.includes("TXF")).slice(0, 5);
  if (txf.length > 0) {
    txf.forEach(q => console.log(JSON.stringify({ id: q.SymbolID, name: q.DispCName, price: q.CLastPrice, status: q.Status })));
  } else {
    // Show first 3 from full list
    list.slice(0, 3).forEach(q => console.log(JSON.stringify({ id: q.SymbolID, name: q.DispCName, price: q.CLastPrice })));
  }
}
run();
