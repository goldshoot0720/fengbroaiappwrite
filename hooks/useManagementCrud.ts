"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchApi } from "@/hooks/useApi";
import { APPWRITE_CONFIG_CHANGED_EVENT } from "@/hooks/useAppwriteSetup";
import { notifyDataRefresh } from "@/hooks/useRefreshKey";
import { createWriteTracker, patchItem, removeItem, replaceItem, restoreItem, upsertItem } from "@/lib/optimisticList";

/** Map an /api/xxx base URL to the shared refresh-key name used by dashboard & module listeners. */
function refreshKeyForBaseUrl(baseUrl: string): string | null {
  const match = baseUrl.match(/\/api\/([a-z-]+)/);
  if (!match) return null;
  const segment = match[1].replace(/-/g, "");
  return `${segment}_refresh_key`;
}

// Account and license data stays in this mounted module, never the global CRUD cache.
export function useManagementCrud<T extends { $id: string }>(baseUrl: string) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountVersion, setAccountVersion] = useState(0);
  const revision = useRef(0);
  const accountRevision = useRef(0);
  const mounted = useRef(false);

  const fetchAll = useCallback(async () => {
    const requestRevision = ++revision.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchApi<T[]>(baseUrl, { cache: "no-store" });
      if (mounted.current && requestRevision === revision.current) setItems(result);
    } catch (err) {
      if (mounted.current && requestRevision === revision.current) {
        setError(err instanceof Error ? err.message : "載入失敗，請重新整理。");
      }
    } finally {
      if (mounted.current && requestRevision === revision.current) setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    mounted.current = true;
    void fetchAll();
    const onAccountChanged = () => {
      accountRevision.current += 1;
      setAccountVersion((value) => value + 1);
      setItems([]);
      void fetchAll();
    };
    const onStorage = (event: StorageEvent) => {
      if (!event.key || /APPWRITE|appwrite_account_switched/.test(event.key)) onAccountChanged();
    };
    window.addEventListener(APPWRITE_CONFIG_CHANGED_EVENT, onAccountChanged);
    window.addEventListener("storage", onStorage);
    return () => {
      mounted.current = false;
      revision.current += 1;
      accountRevision.current += 1;
      window.removeEventListener(APPWRITE_CONFIG_CHANGED_EVENT, onAccountChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, [fetchAll]);

  const tracker = useRef(createWriteTracker()).current;

  const write = useCallback(async (method: "POST" | "PUT" | "DELETE", id?: string, data?: Partial<T>) => {
    const currentAccount = accountRevision.current;
    // A previously started read must not overwrite this successful mutation.
    revision.current += 1;
    const sameAccount = () => mounted.current && currentAccount === accountRevision.current;

    // Optimistic UI: PUT / DELETE show up before Appwrite answers and roll back on failure.
    // POST still waits, because the row needs the server-assigned $id.
    const token = id ? tracker.begin(id) : 0;
    let previous: T | undefined;
    let removed: T | undefined;
    let removedIndex = -1;
    if (id && method === "PUT" && data) {
      setItems((current) => {
        const patched = patchItem(current, id, data);
        previous = patched.previous;
        return patched.list;
      });
    } else if (id && method === "DELETE") {
      setItems((current) => {
        const result = removeItem(current, id);
        removed = result.removed;
        removedIndex = result.index;
        return result.list;
      });
    }

    let result: T;
    let latest = true;
    try {
      result = await fetchApi<T>(id ? `${baseUrl}/${encodeURIComponent(id)}` : baseUrl, {
        method,
        cache: "no-store",
        ...(data ? { body: JSON.stringify(data) } : {}),
      });
      latest = !id || tracker.isLatest(id, token);
    } catch (err) {
      if (sameAccount() && (!id || tracker.isLatest(id, token))) {
        setItems((current) => method === "DELETE"
          ? restoreItem(current, removed, removedIndex)
          : id ? replaceItem(current, id, previous) : current);
      }
      throw err;
    } finally {
      if (id) tracker.finish(id, token);
      if (sameAccount()) setLoading(false);
    }
    if (!sameAccount()) {
      throw new Error("Appwrite 設定已切換，請在原帳戶確認剛才的操作結果。");
    }
    revision.current += 1;
    setLoading(false);
    setError(null);
    if (method === "POST") {
      setItems((current) => upsertItem(current, result));
    } else if (method === "PUT" && id && latest) {
      setItems((current) => replaceItem(current, id, result));
    }
    // 讓首頁統計等跨模組彙整能即時收到變更。
    const refreshKey = refreshKeyForBaseUrl(baseUrl);
    if (refreshKey) notifyDataRefresh(refreshKey);
    return result;
  }, [baseUrl, tracker]);

  return {
    items, loading, error, fetchAll, accountVersion,
    create: (data: Omit<T, "$id">) => write("POST", undefined, data as Partial<T>),
    update: (id: string, data: Partial<T>) => write("PUT", id, data),
    remove: (id: string) => write("DELETE", id),
  };
}
