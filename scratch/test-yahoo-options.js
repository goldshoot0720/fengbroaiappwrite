async function run() {
  const res = await fetch(`https://query1.finance.yahoo.com/v7/finance/options/SKHY`);
  const data = await res.json();
  console.log(JSON.stringify(data.optionChain.result[0].quote, null, 2));
}
run();
