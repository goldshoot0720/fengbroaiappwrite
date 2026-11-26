type CashSession = "upcoming" | "regular" | "break" | "ended" | "holiday" | "";
export type FinanceMarketSession = CashSession | "pre" | "post";
export type MarketSessionLookup = (region: string) => Promise<CashSession>;

type TradingPeriod = { start: number; end: number; gmtoffset?: number };

/** A watchlist can contain several indices from the same market. Share one calendar lookup. */
export function createMarketSessionLookup(now = Date.now()): MarketSessionLookup {
  const markets = new Map<string, Promise<CashSession>>();
  return (region) => {
    if (!/^[A-Z]{2}$/.test(region)) return Promise.resolve("");
    const existing = markets.get(region);
    if (existing) return existing;
    const pending = fetchRegionSession(region, now);
    markets.set(region, pending);
    return pending;
  };
}

async function fetchCalendarJson(url: URL) {
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "Mozilla/5.0" },
    cache: "no-store",
    signal: AbortSignal.timeout(2500),
  });
  return response.ok ? response.json() : null;
}

function sessionOnLocalDate(
  now: number, open: number, close: number, localDay: (time: number) => string | number, paused: boolean,
): CashSession {
  if (!Number.isFinite(open) || !Number.isFinite(close) || close <= open) return "";
  if (now >= open && now < close) return paused ? "break" : "regular";
  if (localDay(now) === localDay(open) && now < open) return "upcoming";
  if (localDay(now) === localDay(close) && now >= close) return "ended";
  return "";
}

// When the regional calendar rolls forward, check the exchange's sessions rather than one watchlist quote's age.
const benchmarkSymbols: Record<string, string> = {
  TW: "^TWII", JP: "^N225", KR: "^KS11", HK: "^HSI", CN: "000001.SS",
  DE: "^GDAXI", GB: "^FTSE", FR: "^FCHI", CA: "^GSPTSE", AU: "^AXJO", IN: "^BSESN",
};

async function sessionBeforeNextOpening(region: string, now: number, localDay: (time: number) => string): Promise<CashSession> {
  if (region === "US") {
    const payload = await fetchCalendarJson(new URL("https://api.nasdaq.com/api/market-info"));
    const day = payload?.data;
    if (day?.clndr_dt?.slice(0, 10) !== localDay(now)) return "";
    if (day.isBusinessDay === false) return "holiday";
    if (day.isBusinessDay === true && day.trade_Date?.slice(0, 10) === localDay(now)) return "ended";
    return "";
  }
  const benchmark = benchmarkSymbols[region];
  if (!benchmark) return "";
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(benchmark)}`);
  url.search = "range=5d&interval=1h";
  const data = await fetchCalendarJson(url);
  const meta = data?.chart?.result?.[0]?.meta;
  const periods: TradingPeriod[] = Array.isArray(meta?.tradingPeriods) ? meta.tradingPeriods.flat() : [];
  if (meta?.currentTradingPeriod?.regular) periods.push(meta.currentTradingPeriod.regular);

  let lastClose = 0;
  for (const period of periods) {
    if (!period || !Number.isFinite(period.start) || !Number.isFinite(period.end) || period.start >= period.end) continue;
    const open = period.start * 1000;
    const close = period.end * 1000;
    const today = sessionOnLocalDate(now, open, close, localDay, false);
    if (today) return today;
    if (close <= now) lastClose = Math.max(lastClose, close);
  }

  // Only use recent exchange history to bracket today between the last and next trading days.
  return lastClose > 0 && now - lastClose < 14 * 86400_000 ? "holiday" : "";
}

async function fetchRegionSession(region: string, now: number): Promise<CashSession> {
  try {
    const url = new URL("https://query1.finance.yahoo.com/v6/finance/markettime");
    url.search = new URLSearchParams({ region, lang: "en-US", formatted: "false" }).toString();
    const payload = await fetchCalendarJson(url);
    const markets = payload?.finance?.marketTimes?.[0]?.marketTime;
    // Unsupported regions can silently receive the US calendar.
    const market = Array.isArray(markets) && markets.find((item) => item?.id === region.toLowerCase());
    if (!market || (market.status !== "open" && market.status !== "closed")) return "";
    const timeZone = market.timezone?.[0]?.$text;
    if (!timeZone) return "";
    const localDay = new Intl.DateTimeFormat("en-CA", { timeZone }).format;
    if (market.time && localDay(Date.parse(market.time)) !== localDay(now)) return "";
    const open = Date.parse(market.open);
    const close = Date.parse(market.close);
    if (!Number.isFinite(open) || !Number.isFinite(close) || close <= open) return "";
    const today = sessionOnLocalDate(now, open, close, localDay, market.status === "closed");
    if (today) return today;
    if (market.status === "closed" && open > now) return await sessionBeforeNextOpening(region, now, localDay);
  } catch {
    // The price is still usable if the separate market calendar is unavailable.
  }
  return "";
}

export async function cnbcIndexSession(quote: Record<string, unknown>, lookup: MarketSessionLookup): Promise<CashSession> {
  if (quote.assetType !== "INDEX" || quote.assetSubType === "CNBC Synthetic") return "";
  if (!quote.exchange || quote.exchange === "Exchange") return "";
  const region = typeof quote.countryCode === "string" ? quote.countryCode.toUpperCase() : "";
  const session = await lookup(region);
  if (session) return session;
  if (quote.trading_day_type === "HOLIDAY" || quote.trading_day_type === "WEEKEND") return "holiday";
  // Some US index feeds even report OPEN on Thanksgiving. CLOSE alone doesn't identify a trading day.
  return region !== "US" && quote.mainmktstatus === "OPEN" ? "regular" : "";
}

const indexRegions: Record<string, string> = {
  SNP: "US", DJI: "US", NIM: "US", TAI: "TW", TWO: "TW", OSA: "JP", JPX: "JP",
  KSC: "KR", KOQ: "KR", HKG: "HK", SHH: "CN", SHZ: "CN", GER: "DE", FTSE: "GB",
};

export async function yahooQuoteSession(meta: Record<string, unknown>, lookup: MarketSessionLookup, now = Date.now()): Promise<FinanceMarketSession> {
  if (meta.marketState === "PRE") return "pre";
  if (meta.marketState === "POST" || meta.marketState === "POSTPOST") return "post";
  if (meta.instrumentType === "INDEX") {
    const region = indexRegions[String(meta.exchangeName)];
    if (region) {
      const session = await lookup(region);
      if (session) return session;
    }
  }
  if (meta.marketState === "REGULAR") return "regular";
  if (meta.instrumentType !== "INDEX" && meta.marketState !== "CLOSED") return "";
  const periods = meta.currentTradingPeriod as { regular?: TradingPeriod } | undefined;
  const regular = periods?.regular;
  if (!regular || typeof regular.gmtoffset !== "number" || !Number.isFinite(regular.gmtoffset)) return "";
  const offset = regular.gmtoffset * 1000;
  const localDay = (time: number) => Math.floor((time + offset) / 86400_000);
  return sessionOnLocalDate(now, regular.start * 1000, regular.end * 1000, localDay, meta.marketState === "CLOSED");
}
