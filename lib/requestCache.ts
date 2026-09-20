"use client";

import { readSessionCache, writeSessionCache } from "@/lib/sessionDataCache";

/**
 * 資料讀取快取層：
 * 1. 同一個 GET 在飛行中不會重複發送（多個模組同時掛載時共用一個 request）。
 * 2. 極短 TTL 的記憶體快取，收斂「同一輪渲染內多次讀同一張表」。
 * 3. 以 endpoint 為鍵的 sessionStorage 快取，讓重新整理後可先畫出上次結果再背景更新。
 *    這層是「明確加入」的：只有列表類 hook 會呼叫 writeEndpointCache，
 *    設定／憑證類回應不會被寫進 sessionStorage。
 *
 * 失效機制沿用既有的 refresh key：CRUD 後 URL 會帶上新的 ?t=，鍵自然改變。
 */

type CacheEntry = { data: unknown; savedAt: number };

/** Appwrite 連線設定參數：不影響資料內容的鍵，且 _key 是憑證，不可進入快取鍵。 */
const CONFIG_PARAMS = ["_endpoint", "_project", "_database", "_key", "_bucket"];

/** 夠長以合併同一輪掛載的重複請求，夠短以免蓋掉外部變更。 */
const MEMORY_TTL_MS = 2_000;

/** 重新整理後可接受的「先畫舊資料」年齡上限。 */
export const ENDPOINT_CACHE_TTL_MS = 5 * 60_000;

/** 單筆 session 快取大小上限，避免大清單擠爆 sessionStorage 配額。 */
const MAX_PERSIST_BYTES = 512 * 1024;

const inflight = new Map<string, Promise<unknown>>();
const memory = new Map<string, CacheEntry>();

/** 去掉連線設定參數後的 URL，作為記憶體／飛行中快取的鍵。 */
export function requestCacheKey(url: string): string {
  const queryStart = url.indexOf("?");
  if (queryStart === -1) return url;

  const path = url.slice(0, queryStart);
  const params = new URLSearchParams(url.slice(queryStart + 1));
  for (const name of CONFIG_PARAMS) params.delete(name);

  const rest = params.toString();
  return rest ? `${path}?${rest}` : path;
}

/** 以 endpoint 路徑（不含 query）為鍵，跨重新整理保留上次結果。 */
function endpointCacheName(url: string): string {
  const queryStart = url.indexOf("?");
  return `req:${queryStart === -1 ? url : url.slice(0, queryStart)}`;
}

/**
 * 讀取上次存下的 endpoint 結果，供首次渲染立即上畫；呼叫端仍應照常發請求更新。
 */
export function readEndpointCache<T>(
  url: string,
  maxAgeMs: number = ENDPOINT_CACHE_TTL_MS
): T | null {
  return readSessionCache<T>(endpointCacheName(url), maxAgeMs);
}

/** 寫入 endpoint 結果；過大的清單直接略過，不擠掉其他模組的快取。 */
export function writeEndpointCache<T>(url: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    if (JSON.stringify(data).length > MAX_PERSIST_BYTES) return;
  } catch {
    return;
  }
  writeSessionCache(endpointCacheName(url), data);
}

/**
 * 陣列回傳淺複製。呼叫端習慣直接對結果 .sort()（就地排序），
 * 共用同一個陣列實例會改到快取內容，也會改到其他呼叫端拿到的資料。
 */
function detach<T>(data: T): T {
  return Array.isArray(data) ? ([...data] as unknown as T) : data;
}

/**
 * 共用一次 GET：飛行中的請求直接掛上去，極短時間內的結果直接重用。
 */
export function dedupedGet<T>(url: string, fetcher: () => Promise<T>): Promise<T> {
  const key = requestCacheKey(url);

  const cached = memory.get(key);
  if (cached && Date.now() - cached.savedAt < MEMORY_TTL_MS) {
    return Promise.resolve(detach(cached.data as T));
  }

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending.then(detach);

  const request = fetcher().then(
    (data) => {
      inflight.delete(key);
      memory.set(key, { data, savedAt: Date.now() });
      return data;
    },
    (err) => {
      inflight.delete(key);
      throw err;
    }
  );

  inflight.set(key, request);
  return request.then(detach);
}

/**
 * 清掉記憶體快取（寫入操作後呼叫），避免 TTL 內讀到剛被改掉的舊資料。
 * 帶 pathPrefix 時只清該 endpoint，未帶時全清。
 */
export function invalidateRequestCache(pathPrefix?: string): void {
  if (!pathPrefix) {
    memory.clear();
    return;
  }
  for (const key of memory.keys()) {
    if (key === pathPrefix || key.startsWith(`${pathPrefix}?`) || key.startsWith(`${pathPrefix}/`)) {
      memory.delete(key);
    }
  }
}
