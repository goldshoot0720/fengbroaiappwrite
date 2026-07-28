import { NextResponse } from "next/server";
import {
  buildYahooQuoteSourceUrl,
  isJapanYahooQuoteTarget,
  isTaiwanYahooQuoteTarget,
  parseFinanceQuoteInput,
  parseJapanYahooQuotePageTitle,
  parseTaiwanYahooQuotePageTitle,
  pickYahooChartName,
} from "@/lib/fengbroFinanceCustom";

export const dynamic = "force-dynamic";

const FETCH_BROWSER_HEADERS = {
  accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
  "accept-language": "zh-TW,zh;q=0.9,en;q=0.8",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
};

const YAHOO_CHART_ENDPOINT = "https://query1.finance.yahoo.com/v8/finance/chart";

async function resolveTaiwanYahooPageName(symbol: string, sourceUrl?: string) {
  const pageUrl =
    sourceUrl && /tw\.stock\.yahoo\.com/i.test(sourceUrl)
      ? sourceUrl
      : buildYahooQuoteSourceUrl(symbol, { marketHint: "tw" });

  const response = await fetch(pageUrl, {
    headers: FETCH_BROWSER_HEADERS,
    cache: "no-store",
    redirect: "follow",
  });
  if (!response.ok) return null;

  const html = await response.text();
  const title = (html.match(/<title[^>]*>([^<]+)/i) || [])[1] || "";
  const fromTitle = parseTaiwanYahooQuotePageTitle(title);
  if (fromTitle?.name) return fromTitle.name;

  // Fallback: first "symbolName":"…" near the quote payload
  const symbolNameMatch = html.match(/"symbolName"\s*:\s*"([^"]{1,40})"/);
  if (symbolNameMatch?.[1]?.trim()) return symbolNameMatch[1].trim();

  return null;
}

async function resolveJapanYahooPageName(symbol: string, sourceUrl?: string) {
  const pageUrl =
    sourceUrl && /finance\.yahoo\.co\.jp/i.test(sourceUrl)
      ? sourceUrl
      : buildYahooQuoteSourceUrl(symbol, { marketHint: "jp" });

  const response = await fetch(pageUrl, {
    headers: {
      ...FETCH_BROWSER_HEADERS,
      "accept-language": "ja,ja-JP;q=0.9,en;q=0.5",
    },
    cache: "no-store",
    redirect: "follow",
  });
  if (!response.ok) return null;

  const html = await response.text();
  const title = (html.match(/<title[^>]*>([^<]+)/i) || [])[1] || "";
  const fromTitle = parseJapanYahooQuotePageTitle(title);
  if (fromTitle?.name) return fromTitle.name;

  return null;
}

async function resolveYahooChartName(
  symbol: string,
  options: { preferTw?: boolean; preferJp?: boolean }
) {
  const params = new URLSearchParams({
    range: "1d",
    interval: "1d",
    lang: options.preferTw ? "zh-TW" : options.preferJp ? "ja-JP" : "en-US",
    region: options.preferTw ? "TW" : options.preferJp ? "JP" : "US",
  });

  const response = await fetch(
    `${YAHOO_CHART_ENDPOINT}/${encodeURIComponent(symbol)}?${params.toString()}`,
    {
      headers: {
        ...FETCH_BROWSER_HEADERS,
        accept: "application/json,text/plain,*/*",
      },
      cache: "no-store",
    }
  );
  if (!response.ok) return null;

  const payload = await response.json();
  const meta = (payload?.chart?.result?.[0]?.meta || {}) as Record<string, unknown>;
  // Prefer longName when Yahoo truncates shortName (e.g. SOXL "…Bu").
  return pickYahooChartName(meta) || null;
}

/**
 * Resolve a friendly default 代稱 for a quote URL or symbol.
 * - Taiwan Yahoo pages → Chinese short names (e.g. 2059.TW → 川湖)
 * - Japan Yahoo pages → Japanese short names (e.g. 285A.T → キオクシアホールディングス)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const urlParam = (searchParams.get("url") || "").trim();
  const symbolParam = (searchParams.get("symbol") || "").trim();
  const providerParam = (searchParams.get("provider") || "").trim().toLowerCase();

  const rawInput = urlParam || symbolParam;
  if (!rawInput) {
    return NextResponse.json({ error: "Missing url or symbol" }, { status: 400 });
  }

  const parsed = parseFinanceQuoteInput(rawInput);
  const symbol = (parsed?.symbol || symbolParam).trim().toUpperCase();
  if (!symbol || symbol.length > 32) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }

  const provider =
    parsed?.provider ||
    (providerParam === "yahoo" || providerParam === "cnbc" ? providerParam : "yahoo");
  const sourceUrl = parsed?.sourceUrl;
  const marketHint = parsed?.marketHint;
  const preferTw = isTaiwanYahooQuoteTarget(symbol, { sourceUrl, marketHint });
  const preferJp = isJapanYahooQuoteTarget(symbol, { sourceUrl, marketHint });

  let name: string | null = null;
  let resolvedFrom: "taiwan-yahoo-page" | "japan-yahoo-page" | "yahoo-chart" | "symbol" =
    "symbol";

  if (provider === "yahoo" && preferTw) {
    try {
      name = await resolveTaiwanYahooPageName(symbol, sourceUrl);
      if (name) resolvedFrom = "taiwan-yahoo-page";
    } catch {
      // fall through
    }
  }

  if (!name && provider === "yahoo" && preferJp) {
    try {
      name = await resolveJapanYahooPageName(symbol, sourceUrl);
      if (name) resolvedFrom = "japan-yahoo-page";
    } catch {
      // fall through
    }
  }

  if (!name && provider === "yahoo") {
    try {
      name = await resolveYahooChartName(symbol, { preferTw, preferJp });
      if (name) resolvedFrom = "yahoo-chart";
    } catch {
      // fall through
    }
  }

  if (!name) {
    name = symbol;
    resolvedFrom = "symbol";
  }

  name = name.replace(/\s+/g, " ").trim().slice(0, 80);

  return NextResponse.json({
    name,
    symbol,
    provider,
    sourceUrl: sourceUrl || (provider === "yahoo" ? buildYahooQuoteSourceUrl(symbol, { marketHint }) : undefined),
    resolvedFrom,
  });
}
