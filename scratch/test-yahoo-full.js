async function run() {
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/SKHY?range=1d&interval=1m&region=US&lang=en-US&includePrePost=true`);
  const data = await res.json();
  const meta = data.chart.result[0].meta;
  const quote = data.chart.result[0].indicators.quote[0];
  const lastClose = quote.close[quote.close.length - 1];
  console.log("meta pre/post prices:", Object.keys(meta).filter(k => k.toLowerCase().includes('price')));
  console.log("last close from chart:", lastClose);
}
run();
