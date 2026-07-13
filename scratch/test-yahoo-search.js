async function run() {
  const query = "SKHY";
  const res = await fetch(`https://query2.finance.yahoo.com/v1/finance/search?q=${query}&quotesCount=10`);
  const data = await res.json();
  console.log(JSON.stringify(data.quotes.map(q => ({ symbol: q.symbol, shortname: q.shortname, exchange: q.exchange, quoteType: q.quoteType })), null, 2));
}
run();
