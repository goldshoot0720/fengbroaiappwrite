import type { FengbroNewsSiteConfig } from "@/lib/fengbroNewsSites";
import { SITE_SEARCH_TIMEOUT_MS } from "./constants";
import type { SiteSearchResult } from "./types";

/** Per-request options shared across adapters and HTTP helpers. */
export type FengbroNewsSearchOptions = {
  signal?: AbortSignal;
};

export function isSearchAborted(signal?: AbortSignal | null): boolean {
  return Boolean(signal?.aborted);
}

export function abortedSiteResult(
  site: Pick<FengbroNewsSiteConfig, "id" | "name" | "domain" | "homeUrl">,
  reason: "cancelled" | "timeout"
): SiteSearchResult {
  return {
    siteId: site.id,
    siteName: site.name,
    domain: site.domain,
    articles: [],
    error:
      reason === "cancelled"
        ? "搜尋已取消"
        : `此來源搜尋逾時（>${Math.round(SITE_SEARCH_TIMEOUT_MS / 1000)}s）`,
    source: site.homeUrl,
  };
}

/**
 * Link a per-site timeout to an optional parent AbortSignal (e.g. request disconnect).
 * Call `cleanup()` in a finally block.
 */
export function createSiteAbortController(
  parent?: AbortSignal | null,
  timeoutMs = SITE_SEARCH_TIMEOUT_MS
): {
  signal: AbortSignal;
  /** True when the timer fired (vs parent cancel). */
  didTimeout: () => boolean;
  cleanup: () => void;
} {
  const controller = new AbortController();
  let timedOut = false;

  const onParent = () => {
    if (!controller.signal.aborted) controller.abort();
  };

  if (parent?.aborted) {
    controller.abort();
  } else if (parent) {
    parent.addEventListener("abort", onParent, { once: true });
  }

  const timer = setTimeout(() => {
    timedOut = true;
    if (!controller.signal.aborted) controller.abort();
  }, timeoutMs);

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      clearTimeout(timer);
      parent?.removeEventListener("abort", onParent);
    },
  };
}
