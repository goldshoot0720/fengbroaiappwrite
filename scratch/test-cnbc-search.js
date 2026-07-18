async function run() {
  // Try CNBC search for Taiwan futures
  const res = await fetch(`https://search.cnbc.com/rs/search/combinedSearch/?query=taiwan+futures&partnerId=2&origin=100&category=quotes&type=quotes&moduleId=100`, {
    headers: { "user-agent": "Mozilla/5.0" }
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2).slice(0, 2000));
}
run();
