export type FinanceMarketSession = "regular" | "closed" | "pre" | "post" | "";
type CashSession = "regular" | "closed" | "";
export type MarketSessionLookup = (region: string) => Promise<CashSession>;

/** A watchlist can contain several indices from the same market. Share one calendar request. */
export function createMarketSessionLookup(): MarketSessionLookup {
  const markets = new Map<string, Promise<CashSession>>();
  return (region) => {
    if (!/^[A-Z]{2}$/.test(region)) return Promise.resolve("");
    const existing = markets.get(region);
    if (existing) return existing;
    const pending = fetchRegionSession(region);
    markets.set(region, pending);
    return pending;
  };
}

async function fetchRegionSession(region: string): Promise<CashSession> {
  try {
    const url = new URL("https://query1.finance.yahoo.com/v6/finance/markettime");
    url.search = new URLSearchParams({ region, lang: "en-US", formatted: "false" }).toString();
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "Mozilla/5.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) return "";
    const payload = await response.json();
    const markets = payload.finance?.marketTimes?.[0]?.marketTime;
    // Unsupported regions can silently receive the US calendar.
    const market = Array.isArray(markets) && markets.find((item) => item?.id === region.toLowerCase());
    if (market?.status === "closed") return "closed";
    if (market?.status === "open") return "regular";
  } catch {
    // The price is still usable if the separate market calendar is unavailable.
  }
  return "";
}

export async function cnbcIndexSession(quote: Record<string, unknown>, lookup: MarketSessionLookup): Promise<CashSession> {
  if (quote.assetType !== "INDEX" || quote.assetSubType === "CNBC Synthetic") return "";
  if (quote.trading_day_type === "HOLIDAY" || quote.trading_day_type === "WEEKEND") return "closed";
  if (quote.mainmktstatus === "CLOSE") return "closed";
  // Generic feeds (including crypto and currency indices) may identify their distributor as the exchange.
  if (!quote.exchange || quote.exchange === "Exchange") return "";
  const region = typeof quote.countryCode === "string" ? quote.countryCode.toUpperCase() : "";
  // US index feeds can say OPEN on Thanksgiving. curmktstatus describes the quote, not a live market.
  if (region !== "US" && quote.mainmktstatus === "OPEN") return "regular";
  return lookup(region);
}

// Yahoo's exchange codes identify the actual listing even when users group a symbol elsewhere.
const indexRegions: Record<string, string> = {
  SNP: "US", DJI: "US", NIM: "US", TAI: "TW", TWO: "TW", OSA: "JP", JPX: "JP",
  KSC: "KR", KOQ: "KR", HKG: "HK", SHH: "CN", SHZ: "CN", GER: "DE", FTSE: "GB",
};

export async function yahooQuoteSession(meta: Record<string, unknown>, lookup: MarketSessionLookup, now = Date.now()): Promise<FinanceMarketSession> {
  switch (meta.marketState) {
    case "CLOSED": return "closed";
    case "REGULAR": return "regular";
    case "PRE": return "pre";
    case "POST":
    case "POSTPOST": return "post";
  }
  if (meta.instrumentType !== "INDEX") return "";
  const region = indexRegions[String(meta.exchangeName)];
  if (region) {
    const session = await lookup(region);
    if (session) return session;
  }

  const periods = meta.currentTradingPeriod as { regular?: { start?: number; end?: number; gmtoffset?: number } } | undefined;
  const regular = periods?.regular;
  if (!regular || typeof regular.start !== "number" || typeof regular.end !== "number" ||
      !Number.isFinite(regular.start) || !Number.isFinite(regular.end) || regular.end <= regular.start) return "";
  const seconds = now / 1000;
  if (seconds >= regular.start && seconds < regular.end) return "regular";
  // A stale chart from an earlier date cannot establish whether this market is open today.
  const offset = regular.gmtoffset;
  if (typeof offset !== "number" || !Number.isFinite(offset)) return "";
  const localDay = (time: number) => Math.floor((time + offset) / 86400);
  return localDay(seconds) === localDay(regular.start) || localDay(seconds) === localDay(regular.end) ? "closed" : "";
}
