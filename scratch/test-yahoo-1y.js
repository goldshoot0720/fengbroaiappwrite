async function run() {
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/SKHY?range=1y&interval=1d`);
  const data = await res.json();
  const quote = data.chart.result[0].indicators.quote[0];
  const closes = quote.close ? quote.close.filter(c => c !== null) : [];
  console.log("Closes count:", closes.length);
  if (closes.length > 0) {
    console.log("Min close:", Math.min(...closes));
    console.log("Max close:", Math.max(...closes));
  }
}
run();
