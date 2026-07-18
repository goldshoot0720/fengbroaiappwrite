async function run() {
  // Get full field set for night session TXFH6-M
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
  const txfNight = list.find(q => q.SymbolID === "TXFH6-M");
  if (txfNight) {
    console.log("Full night session data:");
    console.log(JSON.stringify(txfNight, null, 2));
  }
  
  // Also check day session for same contract
  const res2 = await fetch("https://mis.taifex.com.tw/futures/api/getQuoteList", {
    method: "POST",
    headers: {
      "user-agent": "Mozilla/5.0",
      "Content-Type": "application/json",
      "Referer": "https://mis.taifex.com.tw/"
    },
    body: JSON.stringify({ MarketType: "0", commodity_id: "TXF", queryType: "1" })
  });
  const data2 = await res2.json();
  const list2 = data2?.RtData?.QuoteList || [];
  const txfDay = list2.find(q => q.SymbolID === "TXFH6-F");
  if (txfDay) {
    console.log("\nFull day session data (for comparison):");
    console.log(JSON.stringify(txfDay, null, 2));
  }
}
run();
