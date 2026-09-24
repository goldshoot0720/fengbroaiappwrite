"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchApi } from "@/hooks/useApi";
import { APPWRITE_CONFIG_CHANGED_EVENT } from "@/hooks/useAppwriteSetup";
import { bumpRefreshKey, useRefreshKeyListener } from "@/hooks/useRefreshKey";
import { API_ENDPOINTS } from "@/lib/constants";
import { getDaysFromToday, getExpiryStatus } from "@/lib/formatters";
import { createWriteTracker, patchItem, removeItem, replaceItem, restoreItem, upsertItem } from "@/lib/optimisticList";
import { readEndpointCache, writeEndpointCache } from "@/lib/requestCache";
import type { ShoppingItem } from "@/types";

function sortByPlannedDate(list: ShoppingItem[]): ShoppingItem[] {
  return list.sort((a, b) => {
    const dateA = a.plannedDate ? new Date(a.plannedDate).getTime() : Number.POSITIVE_INFINITY;
    const dateB = b.plannedDate ? new Date(b.plannedDate).getTime() : Number.POSITIVE_INFINITY;
    return dateA - dateB;
  });
}

export const SHOPPING_LIST_REFRESH_KEY = "shoppinglist_refresh_key";

/** ShoppingList keeps its own local cache; CRUD bumps the shared refresh key too. */
export function useShoppingList() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const revision = useRef(0);
  const mounted = useRef(false);
  /** 自己寫入後觸發的 refresh 事件不需要再整張表重抓。 */
  const selfBump = useRef(false);

  const fetchAll = useCallback(async (silent = false) => {
    const requestRevision = ++revision.current;
    if (!silent) {
      // 先畫出上次的結果（session 快取），Appwrite 回來後再覆蓋。
      const persisted = readEndpointCache<ShoppingItem[]>(API_ENDPOINTS.SHOPPING_LIST);
      if (persisted && persisted.length) {
        setItems(persisted);
        setLoading(false);
      } else {
        setLoading(true);
      }
    }
    setError(null);
    try {
      const result = await fetchApi<ShoppingItem[]>(API_ENDPOINTS.SHOPPING_LIST, {
        cache: "no-store",
      });
      if (mounted.current && requestRevision === revision.current) {
        const list = sortByPlannedDate(Array.isArray(result) ? result : []);
        writeEndpointCache(API_ENDPOINTS.SHOPPING_LIST, list);
        setItems(list);
      }
    } catch (err) {
      if (mounted.current && requestRevision === revision.current) {
        setError(err instanceof Error ? err.message : "載入失敗，請重新整理。");
      }
    } finally {
      if (mounted.current && requestRevision === revision.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void fetchAll();
    const onAccountChanged = () => {
      revision.current += 1;
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
      window.removeEventListener(APPWRITE_CONFIG_CHANGED_EVENT, onAccountChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, [fetchAll]);

  const tracker = useRef(createWriteTracker()).current;

  /** 更新清單並同步 session 快取，讓下次開啟直接上畫。 */
  const commit = useCallback((updater: (current: ShoppingItem[]) => ShoppingItem[]) => {
    setItems((current) => {
      const sorted = sortByPlannedDate(updater(current));
      writeEndpointCache(API_ENDPOINTS.SHOPPING_LIST, sorted);
      return sorted;
    });
  }, []);

  const write = useCallback(async (
    method: "POST" | "PUT" | "DELETE",
    id?: string,
    data?: Partial<ShoppingItem>,
  ): Promise<ShoppingItem> => {
    revision.current += 1;

    // Optimistic UI：修改／刪除先反映在畫面，失敗再回滾；新增需要伺服器配發的 $id。
    const token = id ? tracker.begin(id) : 0;
    let previous: ShoppingItem | undefined;
    let removed: ShoppingItem | undefined;
    let removedIndex = -1;
    if (id && method === "PUT" && data) {
      commit((current) => {
        const patched = patchItem(current, id, data);
        previous = patched.previous;
        return patched.list;
      });
    } else if (id && method === "DELETE") {
      commit((current) => {
        const result = removeItem(current, id);
        removed = result.removed;
        removedIndex = result.index;
        return result.list;
      });
    }

    let result: ShoppingItem;
    let latest = true;
    try {
      result = await fetchApi<ShoppingItem>(
        id ? `${API_ENDPOINTS.SHOPPING_LIST}/${encodeURIComponent(id)}` : API_ENDPOINTS.SHOPPING_LIST,
        {
          method,
          cache: "no-store",
          ...(data ? { body: JSON.stringify(data) } : {}),
        },
      );
      latest = !id || tracker.isLatest(id, token);
    } catch (err) {
      if (mounted.current && (!id || tracker.isLatest(id, token))) {
        commit((current) => method === "DELETE"
          ? restoreItem(current, removed, removedIndex)
          : id ? replaceItem(current, id, previous) : current);
      }
      throw err;
    } finally {
      if (id) tracker.finish(id, token);
    }
    revision.current += 1;
    setError(null);
    if (method === "POST") {
      commit((current) => upsertItem(current, result));
    } else if (method === "PUT" && id && latest) {
      commit((current) => replaceItem(current, id, result));
    }
    selfBump.current = true;
    try {
      bumpRefreshKey(SHOPPING_LIST_REFRESH_KEY);
    } finally {
      selfBump.current = false;
    }
    return result;
  }, [commit, tracker]);

  const handleExternalRefresh = useCallback(() => {
    if (selfBump.current) return;
    void fetchAll(true);
  }, [fetchAll]);
  useRefreshKeyListener(SHOPPING_LIST_REFRESH_KEY, handleExternalRefresh);

  const stats = useMemo(() => {
    const list = Array.isArray(items) ? items : [];
    let expired = 0; // 已過預定購買日（含今天）但尚未「完成」
    let upcoming = 0; // 未來 3 天內要買
    let totalPlanned = 0;
    for (const item of list) {
      const days = getDaysFromToday(item.plannedDate || "");
      if (Number.isFinite(days) && days <= 0) expired += 1;
      if (Number.isFinite(days) && days >= 1 && days <= 3) upcoming += 1;
      if (item.price && item.quantity) totalPlanned += item.price * item.quantity;
    }
    return { total: list.length, expired, upcoming, totalPlanned };
  }, [items]);

  return {
    items,
    loading,
    error,
    stats,
    fetchAll,
    create: (data: Omit<ShoppingItem, "$id">) => write("POST", undefined, data),
    update: (id: string, data: Partial<ShoppingItem>) => write("PUT", id, data),
    remove: (id: string) => write("DELETE", id),
  };
}

/** 購物清單輔助：以「預定購買日」計算剩餘天數與到期狀態。 */
export function getShoppingItemExpiryInfo(item: Pick<ShoppingItem, "plannedDate">) {
  const daysRemaining = getDaysFromToday(item.plannedDate || "");
  const status = getExpiryStatus(daysRemaining);
  const formattedDate = item.plannedDate ? item.plannedDate.slice(0, 10) : "";
  return {
    daysRemaining,
    status,
    formattedDate,
    hasDate: Number.isFinite(daysRemaining),
    isExpired: Number.isFinite(daysRemaining) && daysRemaining < 0,
    isToday: Number.isFinite(daysRemaining) && daysRemaining === 0,
    isUpcomingSoon: Number.isFinite(daysRemaining) && daysRemaining >= 0 && daysRemaining <= 3,
  };
}
