import { NextResponse } from "next/server";

type ResolveSource = "local" | "biggo-api";

type PricePoint = {
  date: string;
  price: number | null;
  currency?: string;
};

type ComparisonOffer = {
  merchant: string;
  title: string;
  price: number | null;
  url: string;
  source: string;
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

type ResolveResult = {
  url: string;
  title: string;
  source: string;
  currency: string;
  currentPrice: number | null;
  history: PricePoint[];
  resolvedAt: string;
  notice?: string;
  matchedTitle?: string;
  matchedUrl?: string;
  historyId?: string;
  comparisons?: ComparisonOffer[];
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

const RESULT_CACHE_TTL_MS = 20 * 60 * 1000;
const resultCache = new Map<string, { expiresAt: number; data: ResolveResult }>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
  if (hostname.includes("buy.yahoo.com") || hostname.includes("tw.bid.yahoo.com")) return "yahoo";
  return hostname;
}

function extractProductCode(url: string): string {
  const parsed = new URL(url);
  if (parsed.hostname.toLowerCase().includes("momoshop.com.tw")) {
    const code = parsed.searchParams.get("i_code");
    if (code) return code;
  }

  if (parsed.hostname.toLowerCase().includes("buy.yahoo.com")) {
    const gdid = parsed.searchParams.get("gdid");
    if (gdid) return gdid;
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  return segments.at(-1) || "product";
}

function inferSourceMetaFromUrl(url: string): SourceMeta {
  const code = extractProductCode(url);
  const storeKey = getStoreKey(url);
  const storeLabel =
    storeKey === "pchome"
      ? "PChome"
      : storeKey === "momo"
        ? "momo"
        : storeKey === "yahoo"
          ? "Yahoo購物中心"
          : new URL(url).hostname;

  return {
    title: `${storeLabel} 商品 ${code}`,
    price: null,
    code,
    storeKey,
  };
}

function pickNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string") {
    const numeric = Number(value.replace(/[^\d.]/g, ""));
    return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : null;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["P", "M", "price", "Price", "salePrice", "originPrice", "Low"]) {
      const nested = pickNumber(record[key]);
      if (nested != null) return nested;
    }
  }
  return null;
}

function pickText(value: unknown): string {
  return typeof value === "string" ? normalizeSpace(value) : "";
}

function decodeEscapedJsonBlob(text: string): string {
  return text
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "\n")
    .replace(/\\u003c/gi, "<")
    .replace(/\\u003e/gi, ">")
    .replace(/\\u0027/g, "'");
}

async function fetchResponse(
  url: string,
  init?: RequestInit,
  options?: { retries?: number; baseDelayMs?: number }
): Promise<Response> {
  const retries = options?.retries ?? 2;
  const baseDelayMs = options?.baseDelayMs ?? 700;
  const method = init?.method || "GET";
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        headers: {
          "User-Agent": USER_AGENT,
          "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
          ...(init?.headers || {}),
        },
        cache: "no-store",
      });

      if (response.status === 429 || response.status === 503) {
        if (attempt >= retries) {
          throw new HttpStatusError(response.status, url, method);
        }
        const retryAfterHeader = response.headers.get("retry-after");
        const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
        const delayMs = Number.isFinite(retryAfterSeconds)
          ? Math.min(Math.max(retryAfterSeconds * 1000, 400), 8000)
          : baseDelayMs * 2 ** attempt + Math.floor(Math.random() * 250);
        await sleep(delayMs);
        continue;
      }

      if (!response.ok) {
        throw new HttpStatusError(response.status, url, method);
      }

      return response;
    } catch (error) {
      lastError = error;
      if (error instanceof HttpStatusError) throw error;
      if (attempt >= retries) throw error;
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Request failed: ${url}`);
}

async function fetchText(
  url: string,
  init?: RequestInit,
  options?: { retries?: number; baseDelayMs?: number }
): Promise<string> {
  const response = await fetchResponse(url, init, options);
  return await response.text();
}

async function fetchJson<T>(
  url: string,
  payload: unknown,
  headers?: HeadersInit,
  options?: { retries?: number; baseDelayMs?: number }
): Promise<T> {
  const response = await fetchResponse(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(headers || {}),
      },
      body: JSON.stringify(payload),
    },
    options
  );
  return (await response.json()) as T;
}

async function fetchGetJson<T>(
  url: string,
  headers?: HeadersInit,
  options?: { retries?: number; baseDelayMs?: number }
): Promise<T> {
  const response = await fetchResponse(
    url,
    {
      method: "GET",
      headers: {
        Accept: "application/json,text/plain,*/*",
        ...(headers || {}),
      },
    },
    options
  );
  return (await response.json()) as T;
}

async function resolvePchomeProductMeta(url: string): Promise<SourceMeta | null> {
  if (getStoreKey(url) !== "pchome") return null;
  const code = extractProductCode(url);
  if (!code || code === "product") return null;

  // Public PChome search API: returns name + price even when product HTML is rate-limited (429).
  try {
    const searchUrl = `https://ecshweb.pchome.com.tw/search/v3.3/all/results?q=${encodeURIComponent(code)}&page=1&sort=sale/dc`;
    const payload = await fetchGetJson<{
      prods?: Array<{ Id?: string; name?: string; price?: number; originPrice?: number }>;
    }>(searchUrl, { Referer: "https://24h.pchome.com.tw/" }, { retries: 1 });

    const exact =
      payload.prods?.find((item) => item.Id === code) ||
      payload.prods?.find((item) => item.Id?.startsWith(code)) ||
      payload.prods?.[0];

    if (exact) {
      const title = pickText(exact.name) || inferSourceMetaFromUrl(url).title;
      const price = pickNumber(exact.price) ?? pickNumber(exact.originPrice);
      if (title || price != null) {
        return {
          title,
          price,
          code,
          storeKey: "pchome",
          notice: "來源商品頁可能限流，已改用 PChome 公開搜尋 API 取得標題與目前價格。",
        };
      }
    }
  } catch {
    // continue to button API
  }

  const fields = "Id,Name,Nick,Price,Url";
  const endpoints = [
    `https://ecapi-cdn.pchome.com.tw/ecshop/prodapi/v2/prod/button&id=${encodeURIComponent(code)}&fields=${fields}`,
    `https://ecapi.pchome.com.tw/ecshop/prodapi/v2/prod/button&id=${encodeURIComponent(code)}&fields=${fields}`,
  ];

  for (const endpoint of endpoints) {
    try {
      const payload = await fetchGetJson<unknown>(
        endpoint,
        { Referer: "https://24h.pchome.com.tw/" },
        { retries: 1 }
      );
      const record =
        Array.isArray(payload)
          ? payload[0]
          : payload && typeof payload === "object"
            ? (payload as Record<string, unknown>)[code] ||
              Object.values(payload as Record<string, unknown>)[0]
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
        notice: "來源商品頁可能限流，已改用 PChome 商品 button API 取得目前價格。",
      };
    } catch {
      continue;
    }
  }

  return null;
}

async function resolveMomoProductMeta(url: string): Promise<SourceMeta | null> {
  if (getStoreKey(url) !== "momo") return null;
  const code = extractProductCode(url);
  try {
    const html = await fetchText(
      url,
      {
        headers: {
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          Referer: "https://www.momoshop.com.tw/",
        },
      },
      { retries: 1 }
    );
    const meta = extractProductMeta(html, url);
    return {
      ...meta,
      notice: "已直接解析 momo 商品頁取得標題與目前價格。",
    };
  } catch {
    return code
      ? {
          ...inferSourceMetaFromUrl(url),
          notice: "momo 商品頁暫時無法讀取，僅保留商品代碼。",
        }
      : null;
  }
}

async function resolveYahooProductMeta(url: string): Promise<SourceMeta | null> {
  if (getStoreKey(url) !== "yahoo") return null;
  try {
    const html = await fetchText(
      url,
      {
        headers: {
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          Referer: "https://tw.buy.yahoo.com/",
        },
      },
      { retries: 1 }
    );
    const meta = extractProductMeta(html, url);
    return {
      ...meta,
      notice: "已直接解析 Yahoo 購物中心商品頁取得標題與目前價格。",
    };
  } catch {
    return null;
  }
}

async function resolveMerchantProductMeta(url: string): Promise<SourceMeta | null> {
  const storeKey = getStoreKey(url);
  if (storeKey === "pchome") return await resolvePchomeProductMeta(url);
  if (storeKey === "momo") return await resolveMomoProductMeta(url);
  if (storeKey === "yahoo") return await resolveYahooProductMeta(url);
  return null;
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
    /"goodsPrice"\s*:\s*"\$\$([\d,]+)"/i,
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
    if (!Number.isNaN(price) && price > 0) break;
    price = null;
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

  if (storeKey === "yahoo") {
    return normalizeSpace(title.replace(/\s*\|\s*Yahoo.*$/iu, "").replace(/\s*\|\s*AirPods.*$/iu, ""));
  }

  return normalizeSpace(title);
}

function buildSearchQueries(title: string, code: string, storeKey: string): string[] {
  const base = cleanSourceTitle(title, storeKey);
  const compact = normalizeSpace(base.replace(/\s*\([^)]*\)/g, ""));
  const withoutStoreNoise = normalizeSpace(
    compact
      .replace(/\s*momo購物網.*$/iu, "")
      .replace(/\s*好評推薦.*$/iu, "")
      .replace(/\s*Yahoo購物中心.*$/iu, "")
  );

  // Prefer human title first; product code last (code-only searches often mismatch on BigGo).
  const queries = [withoutStoreNoise, compact, base];
  if (code && !/^product$/i.test(code) && storeKey !== "pchome") {
    queries.push(code);
  } else if (code && storeKey === "pchome" && withoutStoreNoise.includes(code) === false) {
    // PChome codes are useful as a secondary key when title is weak.
    if (/商品\s+\S+$/u.test(base)) queries.unshift(code);
  }

  return Array.from(new Set(queries.filter((q) => q && q.length >= 2)));
}

function decodeBigGoHtml(html: string): string {
  return decodeEscapedJsonBlob(html);
}

function parseBigGoCandidates(html: string): BigGoCandidate[] {
  const decoded = decodeBigGoHtml(html);
  const pattern =
    /"history_id":"([^"]+)"[\s\S]{0,1800}?"title":"([^"]*)"[\s\S]{0,1800}?"purl":"(https?:\/\/[^"]+)"[\s\S]{0,1800}?"price":(\d+|null)[\s\S]{0,1800}?"store":\{"image":"[^"]*","link":"[^"]*","name":"([^"]+)"/g;

  const results = new Map<string, BigGoCandidate>();
  for (const match of decoded.matchAll(pattern)) {
    const historyId = match[1];
    const title = normalizeSpace(match[2] || "");
    if (!historyId || !title || results.has(historyId)) continue;
    results.set(historyId, {
      historyId,
      title,
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
  if (storeKey === "yahoo" && merchant.includes("yahoo")) score += 0.8;

  for (const term of ["保護貼", "保護殼", "手機殼", "鏡頭貼", "鋼化膜", "貼膜", "皮套", "case", "cover", "福利品", "二手"]) {
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

function singlePointHistory(price: number | null): PricePoint[] {
  if (price == null) return [];
  return [
    {
      date: toDateString(Date.now()),
      price,
      currency: "TWD",
    },
  ];
}

async function searchPchomeComparisons(query: string, limit = 6): Promise<ComparisonOffer[]> {
  try {
    const searchUrl = `https://ecshweb.pchome.com.tw/search/v3.3/all/results?q=${encodeURIComponent(query)}&page=1&sort=rnk/dc`;
    const payload = await fetchGetJson<{
      prods?: Array<{ Id?: string; name?: string; price?: number }>;
    }>(searchUrl, { Referer: "https://24h.pchome.com.tw/" }, { retries: 1, baseDelayMs: 500 });

    return (payload.prods || [])
      .map((item) => {
        const id = pickText(item.Id);
        const title = pickText(item.name);
        const price = pickNumber(item.price);
        if (!id || !title) return null;
        return {
          merchant: "PChome 24h",
          title,
          price,
          url: `https://24h.pchome.com.tw/prod/${id}`,
          source: "pchome-search-api",
        } satisfies ComparisonOffer;
      })
      .filter((item): item is ComparisonOffer => Boolean(item))
      .slice(0, limit);
  } catch {
    return [];
  }
}

async function searchMomoComparisons(query: string, limit = 6): Promise<ComparisonOffer[]> {
  try {
    const html = await fetchText(
      `https://www.momoshop.com.tw/search/searchShop.jsp?keyword=${encodeURIComponent(query)}`,
      {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          Referer: "https://www.momoshop.com.tw/",
        },
      },
      { retries: 1, baseDelayMs: 500 }
    );

    const decoded = decodeEscapedJsonBlob(html);
    const pattern =
      /"goodsCode":"(\d+)"[\s\S]{0,600}?"goodsName":"([^"]+)"[\s\S]{0,800}?"goodsPrice":"\$\$([^"]+)"/g;

    const results: ComparisonOffer[] = [];
    const seen = new Set<string>();
    for (const match of decoded.matchAll(pattern)) {
      const code = match[1];
      if (!code || seen.has(code)) continue;
      seen.add(code);
      results.push({
        merchant: "momo購物網",
        title: normalizeSpace(match[2] || ""),
        price: pickNumber(match[3]),
        url: `https://www.momoshop.com.tw/goods/GoodsDetail.jsp?i_code=${code}`,
        source: "momo-search-page",
      });
      if (results.length >= limit) break;
    }
    return results;
  } catch {
    return [];
  }
}

async function buildOpenSourceComparisons(query: string, sourceMeta: SourceMeta): Promise<ComparisonOffer[]> {
  const cleaned = cleanSourceTitle(sourceMeta.title, sourceMeta.storeKey);
  const searchQuery = cleaned && !/商品\s+\S+$/u.test(cleaned) ? cleaned : query;

  const [pchome, momo] = await Promise.all([
    searchPchomeComparisons(searchQuery, 5),
    searchMomoComparisons(searchQuery, 5),
  ]);

  const merged = [...pchome, ...momo]
    .filter((item) => item.title && item.price != null && item.price > 0)
    .sort((a, b) => (a.price || Number.MAX_SAFE_INTEGER) - (b.price || Number.MAX_SAFE_INTEGER));

  // Prefer diverse merchants near the source price when available.
  if (sourceMeta.price != null) {
    return merged
      .slice()
      .sort((a, b) => {
        const da = Math.abs((a.price || 0) - sourceMeta.price!);
        const db = Math.abs((b.price || 0) - sourceMeta.price!);
        return da - db;
      })
      .slice(0, 8);
  }

  return merged.slice(0, 8);
}

function buildFallbackResult(
  url: string,
  sourceMeta: SourceMeta,
  options?: {
    notice?: string;
    comparisons?: ComparisonOffer[];
    sourceLabel?: string;
  }
): ResolveResult {
  const comparisonPrices = (options?.comparisons || [])
    .map((item) => item.price)
    .filter((price): price is number => typeof price === "number" && price > 0);
  const lowestComparison = comparisonPrices.length ? Math.min(...comparisonPrices) : null;
  const currentPrice = sourceMeta.price ?? lowestComparison;

  return {
    url,
    title: sourceMeta.title,
    source: options?.sourceLabel || "公開商家 API 備援",
    currency: "TWD",
    currentPrice,
    history: singlePointHistory(currentPrice),
    resolvedAt: new Date().toISOString(),
    notice: options?.notice,
    comparisons: options?.comparisons?.length ? options.comparisons : undefined,
  };
}

async function resolveSourceMeta(url: string): Promise<SourceMeta> {
  // Prefer public merchant APIs first — PChome product HTML is frequently rate-limited (429).
  const merchantMeta = await resolveMerchantProductMeta(url);
  if (merchantMeta?.title && !/商品\s+\S+$/u.test(merchantMeta.title)) {
    return merchantMeta;
  }
  if (merchantMeta?.price != null && merchantMeta.title) {
    // Keep API price even if title is weak; still try HTML for a better title.
  }

  try {
    const sourceHtml = await fetchText(
      url,
      {
        headers: {
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      },
      { retries: 1, baseDelayMs: 900 }
    );
    const htmlMeta = extractProductMeta(sourceHtml, url);
    if (merchantMeta?.price != null && htmlMeta.price == null) {
      return {
        ...htmlMeta,
        price: merchantMeta.price,
        notice: merchantMeta.notice,
      };
    }
    return htmlMeta;
  } catch (error) {
    if (merchantMeta) return merchantMeta;
    if (error instanceof HttpStatusError && error.status === 429) {
      return {
        ...inferSourceMetaFromUrl(url),
        notice:
          "來源商品頁目前回傳 429，且可用的商家 API 也無法取得完整商品資訊。",
      };
    }
    throw error;
  }
}

async function resolveFromBigGo(url: string, days: number): Promise<ResolveResult> {
  const cacheKey = `${url}::${days}`;
  const cached = resultCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      ...cached.data,
      notice: cached.data.notice
        ? `${cached.data.notice}（快取結果）`
        : "使用伺服器快取結果，降低上游 429 風險。",
      resolvedAt: new Date().toISOString(),
    };
  }

  const sourceMeta = await resolveSourceMeta(url);

  if (!sourceMeta.title || (/商品\s+\S+$/u.test(sourceMeta.title) && sourceMeta.price == null)) {
    const comparisons = await buildOpenSourceComparisons(sourceMeta.code, sourceMeta);
    return buildFallbackResult(url, sourceMeta, {
      comparisons,
      notice:
        sourceMeta.notice ||
        "無法取得可靠的商品標題，已改以公開商家搜尋 API 嘗試比價。",
      sourceLabel: "公開商家 API 備援",
    });
  }

  const queries = buildSearchQueries(sourceMeta.title, sourceMeta.code, sourceMeta.storeKey);
  let candidates: BigGoCandidate[] = [];
  let lastQuery = queries[0] || sourceMeta.title;
  let bigGoRateLimited = false;

  for (const query of queries.slice(0, 2)) {
    lastQuery = query;
    const searchUrl = `https://biggo.com.tw/s/${encodeURIComponent(query)}/`;
    try {
      const html = await fetchText(
        searchUrl,
        { headers: { Referer: "https://biggo.com.tw/" } },
        { retries: 2, baseDelayMs: 900 }
      );
      candidates = parseBigGoCandidates(html);
      if (candidates.length > 0) break;
      await sleep(350);
    } catch (error) {
      if (error instanceof HttpStatusError && (error.status === 429 || error.status === 503)) {
        bigGoRateLimited = true;
        break;
      }
      // continue other queries for non-rate-limit errors
    }
  }

  if (candidates.length === 0) {
    const comparisons = await buildOpenSourceComparisons(lastQuery, sourceMeta);
    return buildFallbackResult(url, sourceMeta, {
      comparisons,
      notice: bigGoRateLimited
        ? `${sourceMeta.notice ? `${sourceMeta.notice} ` : ""}BigGo 目前查詢過於頻繁（429）。已改用 PChome / momo 公開搜尋結果做即時比價。`
        : `${sourceMeta.notice ? `${sourceMeta.notice} ` : ""}BigGo 沒有可配對候選，已改用 PChome / momo 公開搜尋結果做即時比價。`,
      sourceLabel: bigGoRateLimited ? "公開商家 API 備援（BigGo 429）" : "公開商家 API 備援",
    });
  }

  let match: BigGoCandidate;
  try {
    match = findBestMatch(sourceMeta.title, url, sourceMeta.price, sourceMeta.storeKey, candidates);
  } catch (error) {
    const comparisons = await buildOpenSourceComparisons(lastQuery, sourceMeta);
    return buildFallbackResult(url, sourceMeta, {
      comparisons,
      notice:
        sourceMeta.notice
          ? `${sourceMeta.notice} 目前沒有可可靠配對的 BigGo 候選商品，已改用公開商家搜尋比價。`
          : error instanceof Error
            ? `${error.message}；已改用公開商家搜尋比價。`
            : "目前沒有可可靠配對的 BigGo 候選商品，已改用公開商家搜尋比價。",
      sourceLabel: "公開商家 API 備援",
    });
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
      },
      { retries: 2, baseDelayMs: 1000 }
    );
  } catch (error) {
    if (error instanceof HttpStatusError && (error.status === 429 || error.status === 503)) {
      const comparisons = await buildOpenSourceComparisons(lastQuery, sourceMeta);
      const currentPrice = match.price ?? sourceMeta.price;
      return {
        ...buildFallbackResult(
          url,
          { ...sourceMeta, title: match.title || sourceMeta.title, price: currentPrice },
          {
            comparisons,
            notice: `${sourceMeta.notice ? `${sourceMeta.notice} ` : ""}BigGo 歷史價格 API 回傳 429。已顯示匹配商品現價，並附上 PChome / momo 公開搜尋比價。`,
            sourceLabel: "BigGo 匹配 + 公開商家備援",
          }
        ),
        matchedTitle: match.title,
        matchedUrl: match.purl,
        historyId: match.historyId,
      };
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

  // Light multi-store snapshot even when BigGo history succeeds.
  let comparisons: ComparisonOffer[] | undefined;
  try {
    comparisons = await buildOpenSourceComparisons(
      cleanSourceTitle(historyResponse.title || match.title || sourceMeta.title, sourceMeta.storeKey),
      sourceMeta
    );
    if (!comparisons.length) comparisons = undefined;
  } catch {
    comparisons = undefined;
  }

  const result: ResolveResult = {
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
    comparisons,
  };

  resultCache.set(cacheKey, { expiresAt: Date.now() + RESULT_CACHE_TTL_MS, data: result });

  // Prevent unbounded growth in long-lived server processes.
  if (resultCache.size > 200) {
    const now = Date.now();
    for (const [key, value] of resultCache) {
      if (value.expiresAt <= now) resultCache.delete(key);
    }
  }

  return result;
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

    try {
      // Validate URL early for clearer client errors.
      new URL(url);
    } catch {
      return NextResponse.json({ error: "url 參數格式不正確" }, { status: 400 });
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
