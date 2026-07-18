async function run() {
  // Try various CNBC symbols for Taiwan night futures
  const symbols = ["@TAIFEX", "TXFR1", "TXF", "@TXF", "TAIFEX", ".TWII.F", "@TXF.1", "^TWIINIGHT"];
  for (const sym of symbols) {
    const params = new URLSearchParams({ symbols: sym, requestMethod: "quick", noform: "1", fund: "1", output: "json" });
    const res = await fetch(`https://quote.cnbc.com/quote-html-webservice/quote.htm?${params}`, {
      headers: { "user-agent": "Mozilla/5.0" }
    });
    const data = await res.json();
    const raw = data?.QuickQuoteResult?.QuickQuote;
    const record = Array.isArray(raw) ? raw[0] : raw;
    if (record && record.last && record.last !== "--") {
      console.log(`✅ ${sym}: name="${record.name}" last=${record.last} code=${record.code}`);
    } else {
      console.log(`❌ ${sym}: code=${record?.code} (no valid quote)`);
    }
  }
}
run();
