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

type SourceMeta = {
  title: string;
  price: number | null;
  code: string;
  storeKey: string;
  notice?: string;
};

class HttpStatusError extends Error {
  status: number;
  requestUrl: string;
  requestMethod: string;

  constructor(status: number, requestUrl: string, requestMethod: string) {
    super(`${requestMethod} ${requestUrl} failed with HTTP ${status}`);
    this.name = "HttpStatusError";
    this.status = status;
    this.requestUrl = requestUrl;
    this.requestMethod = requestMethod;
  }
}

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

function inferSourceMetaFromUrl(url: string): SourceMeta {
  const code = extractProductCode(url);
  const storeKey = getStoreKey(url);
  const storeLabel =
    storeKey === "pchome" ? "PChome" : storeKey === "momo" ? "momo" : new URL(url).hostname;

  return {
    title: `${storeLabel} 商品 ${code}`,
    price: null,
    code,
    storeKey,
  };
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
    throw new HttpStatusError(response.status, url, init?.method || "GET");
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
    throw new HttpStatusError(response.status, url, "POST");
  }

  return (await response.json()) as T;
}

async function fetchGetJson<T>(url: string, headers?: HeadersInit): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json,text/plain,*/*",
      "User-Agent": USER_AGENT,
      "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
      ...(headers || {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new HttpStatusError(response.status, url, "GET");
  }

  return (await response.json()) as T;
}

function pickNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string") {
    const numeric = Number(value.replace(/[^\d.]/g, ""));
    return Number.isFinite(numeric) ? Math.round(numeric) : null;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["P", "M", "price", "Price", "salePrice", "originPrice"]) {
      const nested = pickNumber(record[key]);
      if (nested != null) return nested;
    }
  }
  return null;
}

function pickText(value: unknown): string {
  return typeof value === "string" ? normalizeSpace(value) : "";
}

async function resolvePchomeProductMeta(url: string): Promise<SourceMeta | null> {
  if (getStoreKey(url) !== "pchome") return null;
  const code = extractProductCode(url);
  if (!code) return null;

  const fields = "Id,Name,Nick,Price,Url";
  const endpoints = [
    `https://ecapi-cdn.pchome.com.tw/ecshop/prodapi/v2/prod/button&id=${encodeURIComponent(code)}&fields=${fields}`,
    `https://ecapi.pchome.com.tw/ecshop/prodapi/v2/prod/button&id=${encodeURIComponent(code)}&fields=${fields}`,
  ];

  for (const endpoint of endpoints) {
    try {
      const payload = await fetchGetJson<unknown>(endpoint, { Referer: "https://24h.pchome.com.tw/" });
      const record =
        Array.isArray(payload)
          ? payload[0]
          : payload && typeof payload === "object"
            ? (payload as Record<string, unknown>)[code] || Object.values(payload as Record<string, unknown>)[0]
            : null;

      if (!record || typeof record !== "object") continue;
      const item = record as Record<string, unknown>;
      const title = pickText(item.Name) || pickText(item.Nick) || inferSourceMetaFromUrl(url).title;
      const price = pickNumber(item.Price);
      if (!title && price == null) continue;

      return {
        title,
        price,
        code,
        storeKey: "pchome",
        notice: "來源商品頁回傳 429，已改用 PChome 商品 API 取得標題與目前價格，再繼續嘗試 BigGo 比對。",
      };
    } catch {
      continue;
    }
  }

  return null;
}

async function resolveMerchantProductMeta(url: string): Promise<SourceMeta | null> {
  return await resolvePchomeProductMeta(url);
}

function extractProductMeta(html: string, url: string): SourceMeta {
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

function buildRateLimitedFallback(url: string, sourceMeta: SourceMeta) {
  const history =
    sourceMeta.price != null
      ? [
          {
            date: toDateString(Date.now()),
            price: sourceMeta.price,
            currency: "TWD",
          },
        ]
      : [];

  return {
    url,
    title: sourceMeta.title,
    source: "BigGo API",
    currency: "TWD",
    currentPrice: sourceMeta.price,
    history,
    resolvedAt: new Date().toISOString(),
    notice:
      sourceMeta.notice
        ? `${sourceMeta.notice} BigGo 目前查詢過於頻繁，暫時回傳 429；已先顯示可取得的名稱與目前價格。`
        : "BigGo 目前查詢過於頻繁，暫時回傳 429。已先顯示商品頁可取得的名稱與目前價格，請稍後再試一次。",
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
  let sourceMeta: SourceMeta;
  try {
    const sourceHtml = await fetchText(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    sourceMeta = extractProductMeta(sourceHtml, url);
  } catch (error) {
    if (error instanceof HttpStatusError && error.status === 429) {
      const merchantMeta = await resolveMerchantProductMeta(url);
      if (!merchantMeta) {
        return {
          url,
          title: inferSourceMetaFromUrl(url).title,
          source: "BigGo API",
          currency: "TWD",
          currentPrice: null,
          history: [],
          resolvedAt: new Date().toISOString(),
          notice:
            "來源商品頁目前回傳 429，且可用的商家 API 也無法取得商品資訊，因此這次不送 BigGo 比對。請稍後再試，或改用未被限流的商品連結。",
        };
      }
      sourceMeta = merchantMeta;
    }
    else {
      throw error;
    }
  }
  const queries = buildSearchQueries(sourceMeta.title, sourceMeta.code, sourceMeta.storeKey);

  let candidates: BigGoCandidate[] = [];
  let lastQuery = queries[0] || sourceMeta.title;

  for (const query of queries) {
    lastQuery = query;
    const searchUrl = `https://biggo.com.tw/s/${encodeURIComponent(query)}/`;
    let html: string;
    try {
      html = await fetchText(searchUrl, {
        headers: { Referer: "https://biggo.com.tw/" },
      });
    } catch (error) {
      if (error instanceof HttpStatusError && error.status === 429) {
        return buildRateLimitedFallback(url, sourceMeta);
      }
      throw error;
    }
    candidates = parseBigGoCandidates(html);
    if (candidates.length > 0) break;
  }

  let match: BigGoCandidate;
  try {
    match = findBestMatch(
      sourceMeta.title,
      url,
      sourceMeta.price,
      sourceMeta.storeKey,
      candidates
    );
  } catch (error) {
    const fallback = buildRateLimitedFallback(url, sourceMeta);
    return {
      ...fallback,
      notice:
        sourceMeta.notice
          ? `${sourceMeta.notice} 目前沒有可可靠配對的 BigGo 候選商品，先顯示商家 API 的目前價格。`
          : error instanceof Error
            ? `${error.message}；已先顯示商品頁可取得的名稱與目前價格。`
            : "目前沒有可可靠配對的 BigGo 候選商品，已先顯示可取得的名稱與目前價格。",
    };
  }

  let historyResponse: {
    title?: string;
    current_price?: number;
    price_history?: Array<{ x: number; y: number }>;
  };
  try {
    historyResponse = await fetchJson<{
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
  } catch (error) {
    if (error instanceof HttpStatusError && error.status === 429) {
      return buildRateLimitedFallback(url, sourceMeta);
    }
    throw error;
  }

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
    notice: sourceMeta.notice,
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
