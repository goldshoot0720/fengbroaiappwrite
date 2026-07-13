async function run() {
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/SKHY?range=1d&interval=1d&region=US&lang=en-US&includePrePost=true`);
  const data = await res.json();
  console.log(JSON.stringify(data.chart.result[0].meta, null, 2));
}
run();
