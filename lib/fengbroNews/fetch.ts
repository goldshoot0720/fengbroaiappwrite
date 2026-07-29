/** HTTP helpers for Fengbro News scraping. */

import {
  FETCH_TIMEOUT_MS,
  JINA_PREFIX,
  JINA_TIMEOUT_MS,
  USER_AGENT,
} from "./constants";

export function defaultFetchHeaders(targetUrl: string): Record<string, string> {
  const headers: Record<string, string> = {
    "user-agent": USER_AGENT,
    "accept-language": "zh-TW,zh;q=0.9,en;q=0.8",
    accept: "text/html,application/xhtml+xml,application/xml,text/plain,*/*",
    "cache-control": "no-cache",
  };
  try {
    const host = new URL(targetUrl).hostname;
    if (host.includes("ptt.cc")) {
      headers.cookie = "over18=1";
      headers.referer = "https://www.ptt.cc/";
    }
    if (host.includes("chinatimes.com")) {
      headers.referer = "https://www.chinatimes.com/";
    }
    if (host.includes("udn.com")) {
      headers.referer = "https://udn.com/";
    }
    if (host.includes("leho.com.tw")) {
      headers.referer = "https://leho.com.tw/";
    }
    if (host.includes("bella.tw")) {
      headers.referer = "https://www.bella.tw/";
    }
    if (host.includes("tycg.gov.tw")) {
      headers.referer = "https://www.tycg.gov.tw/";
    }
  } catch {
    // ignore
  }
  return headers;
}

export function mergeAbortSignals(a?: AbortSignal | null, b?: AbortSignal | null): AbortSignal | undefined {
  if (!a && !b) return undefined;
  if (a && !b) return a;
  if (b && !a) return b;
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (a!.aborted || b!.aborted) {
    controller.abort();
    return controller.signal;
  }
  a!.addEventListener("abort", onAbort, { once: true });
  b!.addEventListener("abort", onAbort, { once: true });
  return controller.signal;
}

function isAbortLike(error: unknown): boolean {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    name === "TimeoutError" ||
    name === "AbortError" ||
    /aborted|timeout/i.test(message)
  );
}

export async function fetchText(
  url: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<{ ok: boolean; status: number; text: string; finalUrl: string; error?: string }> {
  if (init?.signal?.aborted) {
    return {
      ok: false,
      status: 0,
      text: "",
      finalUrl: url,
      error: "已取消",
    };
  }

  const timeoutMs = init?.timeoutMs ?? FETCH_TIMEOUT_MS;
  const timeoutSignal =
    typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
      ? AbortSignal.timeout(timeoutMs)
      : undefined;
  const signal = mergeAbortSignals(init?.signal ?? null, timeoutSignal ?? null);
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        ...defaultFetchHeaders(url),
        ...(init?.headers || {}),
      },
      cache: "no-store",
      redirect: "follow",
      signal,
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text, finalUrl: res.url };
  } catch (error) {
    const message = error instanceof Error ? error.message : "fetch failed";
    const timedOut = isAbortLike(error);
    const cancelled = init?.signal?.aborted;
    return {
      ok: false,
      status: 0,
      text: "",
      finalUrl: url,
      error: cancelled ? "已取消" : timedOut ? `逾時 ${Math.round(timeoutMs / 1000)}s` : message,
    };
  }
}

export async function fetchViaJina(
  targetHttpsUrl: string,
  options?: { signal?: AbortSignal }
) {
  const url = targetHttpsUrl.startsWith("http")
    ? `${JINA_PREFIX}${targetHttpsUrl.replace(/^https?:\/\//i, "")}`
    : `${JINA_PREFIX}${targetHttpsUrl}`;
  return fetchText(url, {
    headers: { accept: "text/plain" },
    timeoutMs: JINA_TIMEOUT_MS,
    signal: options?.signal,
  });
}

/** Run async work over items with a concurrency limit. */
export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  options?: {
    signal?: AbortSignal;
    /** Used for queue items not started when signal aborts. */
    onAborted?: (item: T, index: number) => R;
  }
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length || 1) }, async () => {
    while (next < items.length) {
      if (options?.signal?.aborted && options.onAborted) {
        const i = next++;
        results[i] = options.onAborted(items[i], i);
        continue;
      }
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  });
  if (items.length === 0) return results;
  await Promise.all(runners);
  return results;
}

export async function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout: () => T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(onTimeout()), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function fetchPageText(
  url: string,
  options?: { allowJina?: boolean; signal?: AbortSignal }
): Promise<{ text: string; source: string; error?: string }> {
  const allowJina = options?.allowJina !== false;
  const signal = options?.signal;
  const direct = await fetchText(url, { signal });
  if (
    direct.ok &&
    direct.text.length > 800 &&
    !direct.text.includes("Incapsula") &&
    !/META NAME="ROBOTS" CONTENT="NOINDEX,\s*NOFOLLOW"/i.test(direct.text)
  ) {
    return { text: direct.text, source: url };
  }

  // Prefer shorter path when direct already returned usable HTML (even if short)
  if (direct.ok && direct.text.length >= 400) {
    return { text: direct.text, source: url };
  }

  if (allowJina && !signal?.aborted) {
    const via = await fetchViaJina(url, { signal });
    if (via.ok && via.text.length >= 200) {
      return { text: via.text, source: `${url} (via reader)` };
    }
    const statusPart =
      direct.error ||
      `HTTP ${direct.status || 0}${via.ok ? "" : via.error ? `/${via.error}` : via.status ? `/${via.status}` : ""}`;
    return { text: "", source: url, error: statusPart };
  }

  return {
    text: "",
    source: url,
    error: direct.error || `HTTP ${direct.status || 0}`,
  };
}
