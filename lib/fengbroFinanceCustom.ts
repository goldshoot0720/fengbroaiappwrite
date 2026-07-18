/**
 * Client-side helpers for custom 鋒兄金融 instruments:
 * parse Yahoo / CNBC quote URLs (or bare tickers) and guess a display group.
 */

export type FinanceCustomProvider = "cnbc" | "yahoo";

export type FinanceCustomGroup =
  | "tw"
  | "tw-stocks"
  | "asia"
  | "asia-stocks"
  | "korea"
  | "fx"
  | "commodities"
  | "rates"
  | "us"
  | "us-stocks"
  | "crypto"
  | "valuation";

export type CustomFinanceInstrument = {
  name: string;
  symbol: string;
  provider: FinanceCustomProvider;
  group: FinanceCustomGroup;
};

export type CustomFinanceDraft = {
  /** 代稱（顯示名稱）；空白時用代號 */
  name: string;
  /** 報價網址或代號 */
  urlOrSymbol: string;
  provider: FinanceCustomProvider;
  group: FinanceCustomGroup;
};

export const FINANCE_CUSTOM_GROUPS: FinanceCustomGroup[] = [
  "asia",
  "korea",
  "asia-stocks",
  "us",
  "us-stocks",
  "tw",
  "tw-stocks",
  "fx",
  "rates",
  "commodities",
  "crypto",
];

export type ParsedFinanceQuoteInput = {
  symbol: string;
  provider: FinanceCustomProvider;
  /** True when the original input looked like a URL (provider taken from host). */
  fromUrl: boolean;
  sourceUrl?: string;
};

const BARE_SYMBOL_RE = /^[A-Z0-9.^@=_\-+%]{1,32}$/i;

function ensureHttps(input: string) {
  return /^https?:\/\//i.test(input) ? input : `https://${input}`;
}

/** True if the string looks like a finance quote page URL (not a bare ticker). */
export function isFinanceQuoteUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return false;
  if (/^https?:\/\//i.test(trimmed)) return true;
  return /^(www\.)?(cnbc\.com|finance\.yahoo\.com|tw\.stock\.yahoo\.com)\b/i.test(trimmed);
}

function extractYahooSymbol(pathname: string) {
  const match = pathname.match(/\/quote\/([^/?#]+)/i);
  if (!match?.[1]) return "";
  try {
    return decodeURIComponent(match[1]).trim().toUpperCase();
  } catch {
    return match[1].trim().toUpperCase();
  }
}

function extractCnbcSymbol(pathname: string, searchParams: URLSearchParams) {
  const pathMatch = pathname.match(/\/quotes?\/([^/?#]+)/i);
  if (pathMatch?.[1]) {
    try {
      return decodeURIComponent(pathMatch[1]).trim().toUpperCase();
    } catch {
      return pathMatch[1].trim().toUpperCase();
    }
  }
  const fromQuery =
    searchParams.get("symbol") ||
    searchParams.get("q") ||
    searchParams.get("qsearchterm") ||
    "";
  return fromQuery.trim().toUpperCase();
}

/**
 * Parse a Yahoo / CNBC quote URL or a bare ticker into symbol + provider.
 * Bare symbols default provider to yahoo unless they look like CNBC-style indices (leading `.`).
 */
export function parseFinanceQuoteInput(input: string): ParsedFinanceQuoteInput | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (isFinanceQuoteUrl(trimmed)) {
    try {
      const url = new URL(ensureHttps(trimmed));
      const host = url.hostname.replace(/^www\./i, "").toLowerCase();

      const isYahoo =
        host === "finance.yahoo.com" ||
        host === "tw.stock.yahoo.com" ||
        (host.endsWith(".yahoo.com") && /\/quote\//i.test(url.pathname));
      if (isYahoo) {
        const symbol = extractYahooSymbol(url.pathname);
        if (!symbol || symbol.length > 32) return null;
        return {
          symbol,
          provider: "yahoo",
          fromUrl: true,
          sourceUrl: url.toString(),
        };
      }

      const isCnbc = host === "cnbc.com" || host.endsWith(".cnbc.com");
      if (isCnbc) {
        const symbol = extractCnbcSymbol(url.pathname, url.searchParams);
        if (!symbol || symbol.length > 32) return null;
        return {
          symbol,
          provider: "cnbc",
          fromUrl: true,
          sourceUrl: url.toString(),
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  // Bare symbol / ticker
  const symbol = trimmed.toUpperCase().replace(/\s+/g, "");
  if (!BARE_SYMBOL_RE.test(symbol)) return null;

  return {
    symbol,
    // CNBC index codes often start with `.` (e.g. .SOX, .SPX); Yahoo uses `^` for many indices.
    provider: symbol.startsWith(".") ? "cnbc" : "yahoo",
    fromUrl: false,
  };
}

/** Stable key for a custom instrument (provider + symbol). */
export function getCustomFinanceInstrumentKey(
  instrument: Pick<CustomFinanceInstrument, "provider" | "symbol">
) {
  return `${instrument.provider}|${instrument.symbol.trim().toUpperCase()}`;
}

/** Best-effort group guess from ticker shape (user can still override in the form). */
export function guessFinanceGroup(symbol: string): FinanceCustomGroup {
  const s = symbol.trim().toUpperCase();
  if (!s) return "us-stocks";

  if (s === "^TWII" || s === ".TWII") return "tw";
  // TWSE (.TW) and TPEx / 櫃買 (.TWO) — e.g. 2330.TW, 5274.TWO
  if (/\.TW$/i.test(s) || /\.TWO$/i.test(s)) return "tw-stocks";
  if (/\.KS$/i.test(s) || /\.KQ$/i.test(s)) return "korea";
  if (s === ".KS11" || s === "^KS11") return "asia";
  if (s === ".N225" || s === "^N225") return "asia";
  if (/\.T$/i.test(s)) return "asia-stocks";
  if (/=X$/i.test(s)) return "fx";
  if (/BTC|ETH|CRYPTO/i.test(s)) return "crypto";
  if (s.startsWith("@") || /=(F)$/i.test(s) || s.endsWith("=F")) return "commodities";
  if (s.startsWith(".") || s.startsWith("^")) return "us";
  return "us-stocks";
}

/** Load an existing custom instrument into the add/edit draft form. */
export function draftFromCustomFinanceInstrument(
  instrument: CustomFinanceInstrument
): CustomFinanceDraft {
  return {
    name: instrument.name,
    urlOrSymbol: instrument.symbol,
    provider: instrument.provider,
    group: instrument.group,
  };
}

export function normalizeCustomFinanceInstrument(
  input: Partial<CustomFinanceInstrument>
): CustomFinanceInstrument | null {
  const symbol = typeof input.symbol === "string" ? input.symbol.trim().toUpperCase() : "";
  if (!symbol || symbol.length > 32) return null;

  const name =
    typeof input.name === "string" && input.name.trim()
      ? input.name.trim().slice(0, 80)
      : symbol;
  const provider = input.provider === "yahoo" ? "yahoo" : "cnbc";
  const group = FINANCE_CUSTOM_GROUPS.includes(input.group as FinanceCustomGroup)
    ? (input.group as FinanceCustomGroup)
    : "us";

  return { name, symbol, provider, group };
}

/**
 * Build a custom instrument from the add form (代稱 + 網址/代號 + optional overrides).
 */
export function buildCustomFinanceInstrumentFromDraft(
  draft: CustomFinanceDraft
): CustomFinanceInstrument | null {
  const parsed = parseFinanceQuoteInput(draft.urlOrSymbol);
  if (!parsed) return null;

  const provider = parsed.fromUrl
    ? parsed.provider
    : draft.provider === "yahoo"
      ? "yahoo"
      : "cnbc";

  const group = FINANCE_CUSTOM_GROUPS.includes(draft.group)
    ? draft.group
    : guessFinanceGroup(parsed.symbol);

  return normalizeCustomFinanceInstrument({
    name: draft.name,
    symbol: parsed.symbol,
    provider,
    group,
  });
}

export function createEmptyCustomFinanceDraft(
  overrides?: Partial<CustomFinanceDraft>
): CustomFinanceDraft {
  return {
    name: "",
    urlOrSymbol: "",
    provider: "cnbc",
    group: "us",
    ...overrides,
  };
}
