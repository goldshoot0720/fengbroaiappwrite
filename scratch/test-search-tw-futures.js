async function run() {
  // Search Yahoo Finance for TAIEX futures
  const queries = ["TAIEX", "台指期", "TX", "TWF", "^TWII futures"];
  for (const q of queries) {
    const res = await fetch(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=5`, {
      headers: { "user-agent": "Mozilla/5.0" }
    });
    const data = await res.json();
    if (data.quotes && data.quotes.length > 0) {
      console.log(`Query "${q}":`);
      data.quotes.forEach(q => console.log(`  ${q.symbol} - ${q.shortname} (${q.exchange}/${q.quoteType})`));
    } else {
      console.log(`Query "${q}": no results`);
    }
  }
}
run();
