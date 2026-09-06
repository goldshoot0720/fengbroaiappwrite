const apiKey = process.argv[2];

const candidates = [
  "https://api.commandcode.ai/internal/billing/credits",
  "https://api.commandcode.ai/internal/usage",
  "https://api.commandcode.ai/provider/v1/usage",
  "https://api.commandcode.ai/cli/usage",
  "https://api.commandcode.ai/v1/me/usage",
  "https://api.commandcode.ai/v1/me",
];

const headerVariants = [
  { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  { "x-api-key": apiKey, Accept: "application/json" },
];

for (const url of candidates) {
  for (const headers of headerVariants) {
    try {
      const res = await fetch(url, { headers });
      const text = await res.text();
      console.log("====", url, JSON.stringify(headers).slice(0, 40), "status:", res.status);
      console.log(text.slice(0, 300));
      console.log();
    } catch (err) {
      console.log("====", url, "FETCH ERROR:", err.message);
    }
  }
}
