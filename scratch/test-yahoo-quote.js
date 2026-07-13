async function run() {
  const res = await fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=SKHY`, {
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
    }
  });
  const data = await res.json();
  console.log(JSON.stringify(data.quoteResponse.result[0], null, 2));
}
run();
