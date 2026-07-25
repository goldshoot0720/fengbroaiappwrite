/**
 * Client-side helpers for custom 鋒兄金融 instruments:
 * parse Yahoo / CNBC quote URLs (or bare tickers) and guess a display group.
 *
 * Groups are region-based: 韓國 / 日本 / 台灣 / 美國 / 其他.
 */

export type FinanceCustomProvider = "cnbc" | "yahoo";

/** Region groups for 鋒兄金融 display & custom instruments. */
export type FinanceCustomGroup = "korea" | "japan" | "taiwan" | "us" | "other";

export type CustomFinanceInstrument = {
  name: string;
  symbol: string;
  provider: FinanceCustomProvider;
  group: FinanceCustomGroup;
  /** Optional media / external video links shown on the quote card. */
  imageUrl?: string;
  imageUrls?: string[];
  youtubeUrl?: string;
  bilibiliUrl?: string;
  /** When true, show this instrument in 精選焦點. */
  featured?: boolean;
};

export type CustomFinanceDraft = {
  /** 代稱（顯示名稱）；空白時用代號 */
  name: string;
  /** 報價網址或代號 */
  urlOrSymbol: string;
  provider: FinanceCustomProvider;
  group: FinanceCustomGroup;
  /** One image URL per line (optional). */
  imageUrlsText: string;
  youtubeUrl: string;
  bilibiliUrl: string;
  /** Pin to 精選焦點. */
  featured: boolean;
};

/** Max instruments user can pin as 精選焦點. */
export const MAX_FEATURED_FINANCE_INSTRUMENTS = 9;

/** Match server-side custom quote id generation (`custom-${slug(provider-symbol)}`). */
export function buildCustomFinanceQuoteId(
  provider: FinanceCustomProvider,
  symbol: string
): string {
  const idBase =
    `${provider}-${symbol}`
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "item";
  return `custom-${idBase}`;
}

const MAX_CUSTOM_IMAGE_URLS = 12;

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Normalize optional http(s) URL; empty / invalid → undefined. */
export function normalizeOptionalHttpUrl(value: unknown, maxLen = 500): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, maxLen);
  if (!trimmed) return undefined;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return isHttpUrl(withProtocol) ? withProtocol : undefined;
}

/** Parse draft textarea / stored list into clean http(s) image URLs. */
export function normalizeFinanceImageUrls(input: unknown): string[] {
  const rawList: string[] = [];
  if (typeof input === "string") {
    rawList.push(
      ...input
        .split(/[\n,]+/)
        .map((part) => part.trim())
        .filter(Boolean)
    );
  } else if (Array.isArray(input)) {
    for (const item of input) {
      if (typeof item === "string" && item.trim()) rawList.push(item.trim());
    }
  }

  const seen = new Set<string>();
  const urls: string[] = [];
  for (const raw of rawList) {
    const url = normalizeOptionalHttpUrl(raw, 800);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
    if (urls.length >= MAX_CUSTOM_IMAGE_URLS) break;
  }
  return urls;
}

export const FINANCE_CUSTOM_GROUPS: FinanceCustomGroup[] = [
  "korea",
  "japan",
  "taiwan",
  "us",
  "other",
];

export const FINANCE_GROUP_LABELS: Record<FinanceCustomGroup, string> = {
  korea: "韓國",
  japan: "日本",
  taiwan: "台灣",
  us: "美國",
  other: "其他",
};

/** Legacy asset-type groups → region groups (localStorage / old API payloads). */
const LEGACY_FINANCE_GROUP_MAP: Record<string, FinanceCustomGroup> = {
  asia: "other",
  "asia-stocks": "japan",
  korea: "korea",
  tw: "taiwan",
  "tw-stocks": "taiwan",
  us: "us",
  "us-stocks": "us",
  fx: "other",
  rates: "other",
  commodities: "other",
  crypto: "other",
  valuation: "other",
  japan: "japan",
  taiwan: "taiwan",
  other: "other",
};

export function migrateFinanceGroup(group: unknown): FinanceCustomGroup {
  if (typeof group !== "string" || !group.trim()) return "other";
  const key = group.trim();
  if ((FINANCE_CUSTOM_GROUPS as string[]).includes(key)) {
    return key as FinanceCustomGroup;
  }
  return LEGACY_FINANCE_GROUP_MAP[key] ?? "other";
}

export type ParsedFinanceQuoteInput = {
  symbol: string;
  provider: FinanceCustomProvider;
  /** True when the original input looked like a URL (provider taken from host). */
  fromUrl: boolean;
  sourceUrl?: string;
  /**
   * Host-based market hint when the URL itself implies a market
   * (e.g. tw.stock.yahoo.com → Taiwan Yahoo 奇摩股市).
   */
  marketHint?: "tw";
};

const BARE_SYMBOL_RE = /^[A-Z0-9.^@=_\-+%]{1,32}$/i;

/** Yahoo 奇摩股市 (Taiwan Yahoo Finance) host. */
const TAIWAN_YAHOO_STOCK_HOST = "tw.stock.yahoo.com";

function ensureHttps(input: string) {
  return /^https?:\/\//i.test(input) ? input : `https://${input}`;
}

function hostnameFromInput(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  try {
    if (/^https?:\/\//i.test(trimmed) || trimmed.includes("/")) {
      return new URL(ensureHttps(trimmed)).hostname.replace(/^www\./i, "").toLowerCase();
    }
  } catch {
    // fall through
  }
  return trimmed.replace(/^www\./i, "").toLowerCase();
}

/**
 * True when the URL/host is Taiwan Yahoo 奇摩股市 (tw.stock.yahoo.com).
 * Used for 台股來源自動辨識.
 */
export function isTaiwanYahooStockSource(input?: string | null): boolean {
  if (!input) return false;
  const host = hostnameFromInput(input);
  if (host === TAIWAN_YAHOO_STOCK_HOST) return true;
  // Bare hostname fragments / partial paste
  return /(^|\.)tw\.stock\.yahoo\.com$/i.test(host) || /tw\.stock\.yahoo\.com/i.test(input);
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

      const isTaiwanYahoo = host === TAIWAN_YAHOO_STOCK_HOST;
      const isYahoo =
        host === "finance.yahoo.com" ||
        isTaiwanYahoo ||
        (host.endsWith(".yahoo.com") && /\/quote\//i.test(url.pathname));
      if (isYahoo) {
        const symbol = extractYahooSymbol(url.pathname);
        if (!symbol || symbol.length > 32) return null;
        return {
          symbol,
          provider: "yahoo",
          fromUrl: true,
          sourceUrl: url.toString(),
          // Yahoo 奇摩股市 → 台股來源自動辨識
          ...(isTaiwanYahoo ? { marketHint: "tw" as const } : {}),
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

export type GuessFinanceGroupOptions = {
  /** Quote page URL; tw.stock.yahoo.com forces Taiwan market groups. */
  sourceUrl?: string;
  /** From parseFinanceQuoteInput when host is Yahoo 奇摩股市. */
  marketHint?: "tw";
};

/**
 * Best-effort region group guess from ticker shape and optional source host
 * (user can still override in the form).
 *
 * Taiwan Yahoo 奇摩股市 (`tw.stock.yahoo.com`) → 台灣.
 */
export function guessFinanceGroup(
  symbol: string,
  options?: GuessFinanceGroupOptions
): FinanceCustomGroup {
  const s = symbol.trim().toUpperCase();
  const fromTaiwanYahoo =
    options?.marketHint === "tw" || isTaiwanYahooStockSource(options?.sourceUrl);

  if (!s) {
    return fromTaiwanYahoo ? "taiwan" : "us";
  }

  // Korea
  if (s === ".KS11" || s === "^KS11" || s === "KORU") return "korea";
  if (/\.KS$/i.test(s) || /\.KQ$/i.test(s)) return "korea";

  // Japan
  if (s === ".N225" || s === "^N225") return "japan";
  if (/\.T$/i.test(s)) return "japan";

  // Taiwan
  if (s === "^TWII" || s === ".TWII" || s === "^TWOII" || s === ".TWOII") return "taiwan";
  if (/\.TW$/i.test(s) || /\.TWO$/i.test(s)) return "taiwan";
  if (s === "TSM" || s === "TSMX") return "taiwan";
  if (fromTaiwanYahoo) return "taiwan";

  // Global / other (FX, crypto, commodities, rates, valuation)
  if (/=X$/i.test(s)) return "other";
  if (/BTC|ETH|CRYPTO|CAPE/i.test(s)) return "other";
  if (s.startsWith("@") || /=(F)$/i.test(s) || s.endsWith("=F")) return "other";
  // US indices & equities
  if (s.startsWith(".") || s.startsWith("^")) return "us";
  return "us";
}

/** Display name for finance quote source (Yahoo 奇摩 vs global Yahoo, etc.). */
export function getFinanceProviderDisplayName(input: {
  provider?: string;
  sourceUrl?: string;
  marketHint?: "tw";
}): string {
  if (input.marketHint === "tw" || isTaiwanYahooStockSource(input.sourceUrl)) {
    return "Yahoo 奇摩";
  }
  if (input.provider === "yahoo") return "Yahoo";
  if (input.provider === "cnbc") return "CNBC";
  return (input.provider || "Unknown").toUpperCase();
}

export type YahooQuoteSourceUrlOptions = {
  /** Custom instrument group (taiwan → 奇摩 for TW-listed). */
  group?: string;
  /** Original paste URL; tw.stock.yahoo.com forces 奇摩. */
  sourceUrl?: string;
  marketHint?: "tw";
};

/**
 * True when a Yahoo quote should open on Yahoo 奇摩股市 (tw.stock.yahoo.com)
 * rather than global finance.yahoo.com.
 *
 * Rules: marketHint/source host, taiwan/legacy TW groups, .TW/.TWO suffixes, major TW indices.
 * US-listed Taiwan ADRs (TSM) stay on global Yahoo.
 */
export function isTaiwanYahooQuoteTarget(
  symbol: string,
  options?: YahooQuoteSourceUrlOptions
): boolean {
  if (options?.marketHint === "tw" || isTaiwanYahooStockSource(options?.sourceUrl)) {
    return true;
  }

  const s = symbol.trim().toUpperCase();
  if (!s) return false;
  // US-listed ADR / leveraged products — not 奇摩
  if (s === "TSM" || s === "TSMX") return false;

  const group = options?.group;
  if (
    group === "taiwan" ||
    group === "tw" ||
    group === "tw-stocks"
  ) {
    // taiwan group + TW listing suffix / index → 奇摩
    if (/\.TWO?$/i.test(s) || s.startsWith("^") || s.startsWith(".")) return true;
  }

  // TWSE (.TW) and TPEx / 櫃買 (.TWO)
  if (/\.TWO?$/i.test(s)) return true;
  if (s === "^TWII" || s === ".TWII" || s === "^TWOII" || s === ".TWOII") return true;
  return false;
}

/**
 * Public quote-page URL for a Yahoo symbol.
 * Taiwan stocks/indices stay on tw.stock.yahoo.com (not finance.yahoo.com).
 */
export function buildYahooQuoteSourceUrl(
  symbol: string,
  options?: YahooQuoteSourceUrlOptions
): string {
  const encoded = encodeURIComponent(symbol.trim());
  if (isTaiwanYahooQuoteTarget(symbol, options)) {
    return `https://tw.stock.yahoo.com/quote/${encoded}`;
  }
  return `https://finance.yahoo.com/quote/${encoded}`;
}

/**
 * Parse Yahoo 奇摩股市 HTML `<title>` into short display name.
 * e.g. "川湖(2059.TW) 走勢圖 - Yahoo股市" → { name: "川湖", symbol: "2059.TW" }
 *      "加權指數(^TWII) 走勢圖 - Yahoo股市" → { name: "加權指數", symbol: "^TWII" }
 */
export function parseTaiwanYahooQuotePageTitle(
  title: string
): { name: string; symbol: string } | null {
  const cleaned = title.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;

  const match = cleaned.match(/^(.+?)\(([^)]+)\)/);
  if (!match?.[1] || !match[2]) return null;

  const name = match[1].trim();
  let symbol = match[2].trim();
  try {
    symbol = decodeURIComponent(symbol);
  } catch {
    // keep raw
  }
  symbol = symbol.toUpperCase();

  if (!name || !symbol || name.length > 40 || symbol.length > 32) return null;
  // Ignore generic shell titles
  if (/^yahoo/i.test(name) || /走勢圖/.test(name)) return null;

  return { name, symbol };
}

/** Public quote-page URL for a CNBC symbol. */
export function buildCnbcQuoteSourceUrl(symbol: string): string {
  return `https://www.cnbc.com/quotes/${encodeURIComponent(symbol.trim())}`;
}

/** Load an existing custom instrument into the add/edit draft form. */
export function draftFromCustomFinanceInstrument(
  instrument: CustomFinanceInstrument
): CustomFinanceDraft {
  const urlOrSymbol =
    instrument.provider === "yahoo"
      ? buildYahooQuoteSourceUrl(instrument.symbol, { group: instrument.group })
      : buildCnbcQuoteSourceUrl(instrument.symbol);

  const imageUrls = normalizeFinanceImageUrls(
    instrument.imageUrls?.length
      ? instrument.imageUrls
      : instrument.imageUrl
        ? [instrument.imageUrl]
        : []
  );

  return {
    name: instrument.name,
    urlOrSymbol,
    provider: instrument.provider,
    group: migrateFinanceGroup(instrument.group),
    imageUrlsText: imageUrls.join("\n"),
    youtubeUrl: instrument.youtubeUrl || "",
    bilibiliUrl: instrument.bilibiliUrl || "",
    featured: Boolean(instrument.featured),
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
  const group = migrateFinanceGroup(input.group);

  const imageUrls = normalizeFinanceImageUrls(
    input.imageUrls?.length
      ? input.imageUrls
      : input.imageUrl
        ? [input.imageUrl]
        : (input as { imageUrlsText?: string }).imageUrlsText
  );
  const youtubeUrl = normalizeOptionalHttpUrl(input.youtubeUrl);
  const bilibiliUrl = normalizeOptionalHttpUrl(input.bilibiliUrl);

  return {
    name,
    symbol,
    provider,
    group,
    ...(imageUrls[0] ? { imageUrl: imageUrls[0] } : {}),
    ...(imageUrls.length > 0 ? { imageUrls } : {}),
    ...(youtubeUrl ? { youtubeUrl } : {}),
    ...(bilibiliUrl ? { bilibiliUrl } : {}),
    ...(input.featured ? { featured: true } : {}),
  };
}

/**
 * Build a custom instrument from the add form (代稱 + 網址/代號 + optional media).
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
    : guessFinanceGroup(parsed.symbol, {
        sourceUrl: parsed.sourceUrl,
        marketHint: parsed.marketHint,
      });

  return normalizeCustomFinanceInstrument({
    name: draft.name,
    symbol: parsed.symbol,
    provider,
    group,
    imageUrls: normalizeFinanceImageUrls(draft.imageUrlsText),
    youtubeUrl: draft.youtubeUrl,
    bilibiliUrl: draft.bilibiliUrl,
    featured: Boolean(draft.featured),
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
    imageUrlsText: "",
    youtubeUrl: "",
    bilibiliUrl: "",
    featured: false,
    ...overrides,
  };
}
