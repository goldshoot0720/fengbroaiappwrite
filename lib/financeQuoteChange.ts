export function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[$,%\s,]/g, "");
  if (!cleaned || cleaned === "--" || cleaned.toUpperCase() === "N/A") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function pickNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = asNumber(record[key]);
    if (value != null) return value;
  }
  return null;
}

function fromPriceChange(price: number, change: number) {
  const previousClose = price - change;
  return { previousClose, change, changePercent: previousClose > 0 ? change / previousClose * 100 : null };
}

/** Yahoo's intraday previousClose and full-day fields can refer to different sessions. */
export function getYahooSessionChange(price: number | null, meta: Record<string, unknown>) {
  const percent = pickNumber(meta, ["regularMarketChangePercent"]);
  const unknown = { previousClose: null, change: null, changePercent: percent };
  if (price == null) return unknown;

  // Percentages in the feed are rounded. Allow only the same direction and a
  // difference smaller than half a displayed percentage-point hundredth.
  function agrees(changePercent: number | null) {
    return percent == null || (changePercent != null &&
      (Math.sign(changePercent) === Math.sign(percent) || percent === 0) &&
      Math.abs(changePercent - percent) <= 0.005);
  }

  const regularChange = pickNumber(meta, ["regularMarketChange"]);
  if (regularChange != null) return fromPriceChange(price, regularChange);

  const fullChange = pickNumber(meta, ["fulldayChange"]);
  const samePrice = pickNumber(meta, ["fulldayPrice"]) === price;
  if (fullChange != null && samePrice && (percent != null || meta.hasPrePostMarketData === false)) {
    const full = fromPriceChange(price, fullChange);
    if (agrees(full.changePercent)) return full;
  }

  const close = pickNumber(meta, ["regularMarketPreviousClose", "previousClose"]);
  if (close != null && close > 0) {
    const change = price - close;
    const changePercent = change / close * 100;
    if (agrees(changePercent)) return { previousClose: close, change, changePercent };
  }
  return unknown;
}

type QuoteMarket = { group: string; symbol: string; exchangeTimezone?: string; exchangeCountry?: string };

const asianMarketCountries = new Set([
  "AE", "AF", "AM", "AZ", "BD", "BH", "BN", "BT", "CN", "CY", "GE", "HK", "ID", "IL", "IN",
  "IQ", "IR", "JO", "JP", "KG", "KH", "KP", "KR", "KW", "KZ", "LA", "LB", "LK", "MM",
  "MN", "MO", "MV", "MY", "NP", "OM", "PH", "PK", "PS", "QA", "SA", "SG", "SY", "TH",
  "TJ", "TL", "TM", "TR", "TW", "UZ", "VN", "YE",
]);

function usesRedForGains({ group, symbol, exchangeTimezone, exchangeCountry }: QuoteMarket) {
  if (exchangeTimezone?.startsWith("Asia/")) return true;
  if (exchangeTimezone?.startsWith("America/") || exchangeTimezone?.startsWith("Europe/")) return false;
  if (exchangeCountry && /^[A-Z]{2}$/.test(exchangeCountry)) return asianMarketCountries.has(exchangeCountry);
  // Older cached quotes may lack exchange metadata.
  if (/\.(?:TW|TWO|T|KS|KQ|HK|SS|SZ|BO|NS|SI|BK|JK|KL)$/i.test(symbol) ||
      /^[.^](?:HSI|HSCE|TWII|TWOII|N225|KS11|KQ11|SSEC|CSI300|NSEI|BSESN|STI)$/i.test(symbol)) return true;
  return group === "taiwan" || group === "japan" || group === "korea" || group === "asia";
}

export function financeChangeClass(market: QuoteMarket, value: number | null | undefined) {
  if (value == null || !Number.isFinite(value) || value === 0) return "text-muted-foreground";
  return (value > 0) === usesRedForGains(market) ? "text-red-600" : "text-emerald-700";
}

const changeNumber = new Intl.NumberFormat("zh-TW", { signDisplay: "exceptZero", maximumFractionDigits: 2 });
const changePercent = new Intl.NumberFormat("zh-TW", { signDisplay: "exceptZero", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatFinanceChange(value: number | null | undefined, percent = false) {
  if (value == null || !Number.isFinite(value)) return "—";
  return percent ? changePercent.format(value) + "%" : changeNumber.format(value);
}
