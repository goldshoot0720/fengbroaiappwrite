import { NextResponse } from "next/server";

type ResolveSource = "local" | "biggo-api";

type PricePoint = {
  date: string;
  price: number | null;
  currency?: string;
};

type BigGoCandidate = {
  historyId: string;
  title: string;
  purl: string;
  price: number | null;
  merchant: string;
};

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";

function normalizeSpace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeTitle(value: string): string {
  return normalizeSpace(value)
    .toLowerCase()
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/[^\p{L}\p{N}\p{Script=Han}]+/gu, " ")
    .trim();
}

function getStoreKey(url: string): string {
  const hostname = new URL(url).hostname.toLowerCase();
  if (hostname.includes("momoshop.com.tw")) return "momo";
  if (hostname.includes("pchome.com.tw")) return "pchome";
  return hostname;
}

function extractProductCode(url: string): string {
  const parsed = new URL(url);
  if (parsed.hostname.toLowerCase().includes("momoshop.com.tw")) {
    const code = parsed.searchParams.get("i_code");
    if (code) return code;
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  return segments.at(-1) || "product";
}

async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`${init?.method || "GET"} ${url} failed with HTTP ${response.status}`);
  }

  return await response.text();
}

async function fetchJson<T>(url: string, payload: unknown, headers?: HeadersInit): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": USER_AGENT,
      "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
      ...(headers || {}),
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`POST ${url} failed with HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

function extractProductMeta(html: string, url: string) {
  const titlePatterns = [
    /<meta\s+property="og:title"\s+content="([^"]+)"/i,
    /<meta\s+name="twitter:title"\s+content="([^"]+)"/i,
    /<title>([\s\S]*?)<\/title>/i,
    /<h1[^>]*>([\s\S]*?)<\/h1>/i,
  ];
  const pricePatterns = [
    /<meta\s+property="product:price:amount"\s+content="([^"]+)"/i,
    /"price"\s*:\s*"?(\\?\d[\d,]*)"?/i,
    /"salePrice"\s*:\s*"?(\\?\d[\d,]*)"?/i,
  ];

  let title = "";
  for (const pattern of titlePatterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      title = normalizeSpace(match[1].replace(/<[^>]+>/g, ""));
      break;
    }
  }

  if (!title) {
    throw new Error("無法解析商品標題");
  }

  let price: number | null = null;
  for (const pattern of pricePatterns) {
    const match = html.match(pattern);
    if (!match?.[1]) continue;
    const raw = match[1].replace(/[^\d.]/g, "");
    if (!raw) continue;
    price = Math.round(Number(raw));
    if (!Number.isNaN(price)) break;
  }

  return {
    title,
    price,
    code: extractProductCode(url),
    storeKey: getStoreKey(url),
  };
}

function cleanSourceTitle(title: string, storeKey: string): string {
  if (storeKey === "pchome") {
    return normalizeSpace(title.replace(/\s*-\s*PChome\s*24h.*$/iu, ""));
  }

  if (storeKey === "momo") {
    return normalizeSpace(title.replace(/\s*-\s*momo.*$/iu, ""));
  }

  return normalizeSpace(title);
}

function buildSearchQueries(title: string, code: string, storeKey: string): string[] {
  const base = cleanSourceTitle(title, storeKey);
  const compact = normalizeSpace(base.replace(/\s*\([^)]*\)/g, ""));
  return Array.from(new Set([base, compact, code].filter(Boolean)));
}

function decodeBigGoHtml(html: string): string {
  return html
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "\n");
}

function parseBigGoCandidates(html: string): BigGoCandidate[] {
  const decoded = decodeBigGoHtml(html);
  const pattern =
    /"history_id":"([^"]+)"[\s\S]{0,1200}?"title":"([^"]+)"[\s\S]{0,1200}?"purl":"(https?:\/\/[^"]+)"[\s\S]{0,1200}?"price":(\d+|null)[\s\S]{0,1200}?"store":\{"image":"[^"]*","link":"[^"]*","name":"([^"]+)"/g;

  const results = new Map<string, BigGoCandidate>();
  for (const match of decoded.matchAll(pattern)) {
    const historyId = match[1];
    if (!historyId || results.has(historyId)) continue;
    results.set(historyId, {
      historyId,
      title: normalizeSpace(match[2] || ""),
      purl: normalizeSpace(match[3] || ""),
      price: match[4] && match[4] !== "null" ? Number(match[4]) : null,
      merchant: normalizeSpace(match[5] || ""),
    });
  }

  return Array.from(results.values());
}

function scoreCandidate(
  sourceTitle: string,
  sourceUrl: string,
  sourcePrice: number | null,
  storeKey: string,
  candidate: BigGoCandidate
): number {
  const sourceTokens = new Set(normalizeTitle(sourceTitle).split(" ").filter(Boolean));
  const candidateTokens = new Set(normalizeTitle(candidate.title).split(" ").filter(Boolean));
  const union = new Set([...sourceTokens, ...candidateTokens]);
  let score =
    [...sourceTokens].filter((token) => candidateTokens.has(token)).length / Math.max(1, union.size);

  const canonicalSourceUrl = sourceUrl.split("&Area=")[0];
  if (candidate.purl === canonicalSourceUrl) score += 2;

  const sourceCode = extractProductCode(sourceUrl);
  if (sourceCode && candidate.purl.includes(sourceCode)) score += 1.5;

  const merchant = candidate.merchant.toLowerCase();
  if (storeKey === "momo" && merchant.includes("momo")) score += 0.8;
  if (storeKey === "pchome" && merchant.includes("pchome")) score += 0.8;

  for (const term of ["保護貼", "保護殼", "手機殼", "鏡頭貼", "鋼化膜", "貼膜", "皮套", "case", "cover"]) {
    if (candidate.title.toLowerCase().includes(term.toLowerCase())) {
      score -= 1.2;
      break;
    }
  }

  if (sourcePrice != null && candidate.price != null) {
    const diffRatio = Math.abs(candidate.price - sourcePrice) / Math.max(sourcePrice, 1);
    if (diffRatio < 0.03) score += 0.6;
    else if (diffRatio < 0.08) score += 0.3;
    else if (diffRatio > 0.4) score -= 0.5;
  }

  return score;
}

function findBestMatch(
  sourceTitle: string,
  sourceUrl: string,
  sourcePrice: number | null,
  storeKey: string,
  candidates: BigGoCandidate[]
): BigGoCandidate {
  if (candidates.length === 0) {
    throw new Error("找不到 BigGo 候選商品");
  }

  const scored = candidates
    .map((candidate) => ({
      candidate,
      score: scoreCandidate(sourceTitle, sourceUrl, sourcePrice, storeKey, candidate),
    }))
    .sort((a, b) => b.score - a.score);

  if (!scored[0] || scored[0].score < 0.35) {
    throw new Error(`無法可靠比對商品，最接近結果為：${scored[0]?.candidate.title || "未知"}`);
  }

  return scored[0].candidate;
}

function toDateString(timestampMs: number): string {
  return new Date(timestampMs).toISOString().slice(0, 10);
}

function buildHistoryEntries(history: Array<{ x: number; y: number }>, currency = "TWD"): PricePoint[] {
  return [...history]
    .sort((a, b) => a.x - b.x)
    .map((point) => ({
      date: toDateString(point.x),
      price: point.y,
      currency,
    }));
}

async function resolveFromBigGo(url: string, days: number) {
  const sourceHtml = await fetchText(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  const sourceMeta = extractProductMeta(sourceHtml, url);
  const queries = buildSearchQueries(sourceMeta.title, sourceMeta.code, sourceMeta.storeKey);

  let candidates: BigGoCandidate[] = [];
  let lastQuery = queries[0] || sourceMeta.title;

  for (const query of queries) {
    lastQuery = query;
    const searchUrl = `https://biggo.com.tw/s/${encodeURIComponent(query)}/`;
    const html = await fetchText(searchUrl, {
      headers: { Referer: "https://biggo.com.tw/" },
    });
    candidates = parseBigGoCandidates(html);
    if (candidates.length > 0) break;
  }

  const match = findBestMatch(
    sourceMeta.title,
    url,
    sourceMeta.price,
    sourceMeta.storeKey,
    candidates
  );

  const historyResponse = await fetchJson<{
    title?: string;
    current_price?: number;
    price_history?: Array<{ x: number; y: number }>;
  }>(
    "https://biggo.com.tw/api/v1/spa/product/history",
    {
      history_id: match.historyId,
      days,
    },
    {
      region: "tw",
      referer: `https://biggo.com.tw/s/${encodeURIComponent(lastQuery)}/`,
    }
  );

  const history = historyResponse.price_history?.length
    ? historyResponse.price_history
    : [
        {
          x: Date.now(),
          y: historyResponse.current_price ?? match.price ?? sourceMeta.price ?? 0,
        },
      ];

  const sortedHistory = [...history].sort((a, b) => a.x - b.x);
  const currentPrice = sortedHistory.at(-1)?.y ?? null;

  return {
    url,
    title: historyResponse.title || match.title || sourceMeta.title,
    source: "BigGo API",
    currency: "TWD",
    currentPrice,
    history: buildHistoryEntries(sortedHistory),
    resolvedAt: new Date().toISOString(),
    matchedTitle: match.title,
    matchedUrl: match.purl,
    historyId: match.historyId,
  };
}

function resolveSourceParam(value: string | null): ResolveSource {
  return value === "biggo-api" ? "biggo-api" : "local";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");
    const source = resolveSourceParam(searchParams.get("source"));
    const days = Number(searchParams.get("days") || "3650");

    if (!url) {
      return NextResponse.json({ error: "缺少 url 參數" }, { status: 400 });
    }

    if (source === "local") {
      return NextResponse.json({
        url,
        title: "鋒兄比價（待接資料源）",
        source: "local",
        currency: "",
        currentPrice: null,
        history: [],
        resolvedAt: new Date().toISOString(),
        notice: "目前仍是本地佔位模式。若要查實際歷史價格，請切換成 BigGo API。",
      });
    }

    const result = await resolveFromBigGo(url, Number.isFinite(days) ? days : 3650);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "比價解析失敗",
      },
      { status: 500 }
    );
  }
}
