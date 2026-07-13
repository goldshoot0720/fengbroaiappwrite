async function run() {
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/SKHY?range=1d&interval=1m&includePrePost=true`);
  const data = await res.json();
  const result = data.chart.result[0];
  const meta = result.meta;
  const quote = result.indicators.quote[0];
  console.log("meta has preMarketPrice?", !!meta.preMarketPrice, meta.preMarketPrice);
  if (quote && quote.close) {
    const closes = quote.close.filter(c => c !== null);
    console.log("Last close from 1m chart:", closes.at(-1));
  } else {
    console.log("No close data in 1m chart");
  }
}
run();
