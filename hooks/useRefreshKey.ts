"use client";

import { useEffect } from "react";

export const DATA_REFRESH_EVENT = "fengbro:data-refresh";

export type DataRefreshDetail = {
  key?: string;
  timestamp?: number;
};

/** Notify listeners that cached module data should reload. */
export function notifyDataRefresh(key: string = "*") {
  if (typeof window === "undefined") return;
  const timestamp = Date.now();
  window.dispatchEvent(
    new CustomEvent<DataRefreshDetail>(DATA_REFRESH_EVENT, {
      detail: { key, timestamp },
    })
  );
}

/** Write a refresh key and notify same-tab listeners (storage events only fire cross-tab). */
export function bumpRefreshKey(refreshKeyName: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(refreshKeyName, Date.now().toString());
  notifyDataRefresh(refreshKeyName);
}

/**
 * Subscribe to cache-invalidation signals without polling.
 * Same-tab: CustomEvent. Cross-tab: storage events.
 */
export function useRefreshKeyListener(
  refreshKeyName: string,
  onRefresh: () => void,
  enabled = true
) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const handleCustom = (event: Event) => {
      const detail = (event as CustomEvent<DataRefreshDetail>).detail;
      if (!detail?.key || detail.key === "*" || detail.key === refreshKeyName) {
        onRefresh();
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (!event.key) return;
      if (event.key === refreshKeyName || event.key === "appwrite_account_switched") {
        onRefresh();
      }
    };

    window.addEventListener(DATA_REFRESH_EVENT, handleCustom as EventListener);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(DATA_REFRESH_EVENT, handleCustom as EventListener);
      window.removeEventListener("storage", handleStorage);
    };
  }, [enabled, onRefresh, refreshKeyName]);
}
