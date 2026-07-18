async function run() {
  // CNBC actually uses specific IDs. Let's try to look up their known symbols
  // Taiwan futures night session might be on tw.stock.yahoo.com
  // Let's check Yahoo TW API
  const symbols = ["TXF00", "TXF.TW", "TXFA26.TW", "TXFB26.TW", "TXF2600.TW", "TX00.TW"];
  for (const sym of symbols) {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=1d`, {
      headers: { "user-agent": "Mozilla/5.0" }
    });
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    const err = data?.chart?.error;
    if (result && result.meta.regularMarketPrice) {
      const m = result.meta;
      console.log(`✅ ${sym}: name="${m.shortName||m.longName}" price=${m.regularMarketPrice} currency=${m.currency} exchange=${m.exchangeName}`);
    } else {
      console.log(`❌ ${sym}: ${err?.description || 'no result'}`);
    }
  }
}
run();
