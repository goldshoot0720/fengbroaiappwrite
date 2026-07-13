async function run() {
  const res = await fetch(`https://query2.finance.yahoo.com/v10/finance/quoteModules/v1/SKHY?modules=price`);
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
run();
