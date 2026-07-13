async function run() {
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/SKHY?range=1y&interval=1d&includePrePost=true`);
  const data = await res.json();
  const quote = data.chart.result[0].indicators.quote[0];
  const closes = quote.close;
  console.log("Last 5 closes:", closes.slice(-5));
}
run();
