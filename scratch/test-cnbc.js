async function run() {
  const params = new URLSearchParams({
    symbols: "SKHY",
    requestMethod: "quick",
    noform: "1",
    fund: "1",
    output: "json",
  });
  const res = await fetch(`https://quote.cnbc.com/quote-html-webservice/quote.htm?${params}`);
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
run();
