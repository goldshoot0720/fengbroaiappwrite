async function run() {
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/SKHY?range=1y&interval=1d`);
  const data = await res.json();
  const meta = data.chart.result[0].meta;
  console.log("regularMarketPrice:", meta.regularMarketPrice);
  console.log("meta keys:", Object.keys(meta));
}
run();
