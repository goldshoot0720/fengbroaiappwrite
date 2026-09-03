"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchApi } from "@/hooks/useApi";
import { APPWRITE_CONFIG_CHANGED_EVENT } from "@/hooks/useAppwriteSetup";
import { bumpRefreshKey, useRefreshKeyListener } from "@/hooks/useRefreshKey";
import { API_ENDPOINTS } from "@/lib/constants";
import { getDaysFromToday, getExpiryStatus } from "@/lib/formatters";
import type { ShoppingItem } from "@/types";

export const SHOPPING_LIST_REFRESH_KEY = "shoppinglist_refresh_key";

/** ShoppingList keeps its own local cache; CRUD bumps the shared refresh key too. */
export function useShoppingList() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const revision = useRef(0);
  const mounted = useRef(false);

  const fetchAll = useCallback(async (silent = false) => {
    const requestRevision = ++revision.current;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const result = await fetchApi<ShoppingItem[]>(API_ENDPOINTS.SHOPPING_LIST, {
        cache: "no-store",
      });
      if (mounted.current && requestRevision === revision.current) {
        const list = Array.isArray(result) ? result : [];
        list.sort((a, b) => {
          const dateA = a.plannedDate ? new Date(a.plannedDate).getTime() : Number.POSITIVE_INFINITY;
          const dateB = b.plannedDate ? new Date(b.plannedDate).getTime() : Number.POSITIVE_INFINITY;
          return dateA - dateB;
        });
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

  const write = useCallback(async (
    method: "POST" | "PUT" | "DELETE",
    id?: string,
    data?: Partial<ShoppingItem>,
  ): Promise<ShoppingItem> => {
    revision.current += 1;
    const result = await fetchApi<ShoppingItem>(
      id ? `${API_ENDPOINTS.SHOPPING_LIST}/${encodeURIComponent(id)}` : API_ENDPOINTS.SHOPPING_LIST,
      {
        method,
        cache: "no-store",
        ...(data ? { body: JSON.stringify(data) } : {}),
      },
    );
    revision.current += 1;
    setError(null);
    setItems((current) => {
      const next = method === "DELETE"
        ? current.filter((item) => item.$id !== id)
        : method === "PUT"
          ? current.map((item) => (item.$id === id ? result : item))
          : [...current, result];
      return next.sort((a, b) => {
        const dateA = a.plannedDate ? new Date(a.plannedDate).getTime() : Number.POSITIVE_INFINITY;
        const dateB = b.plannedDate ? new Date(b.plannedDate).getTime() : Number.POSITIVE_INFINITY;
        return dateA - dateB;
      });
    });
    bumpRefreshKey(SHOPPING_LIST_REFRESH_KEY);
    return result;
  }, []);

  const handleExternalRefresh = useCallback(() => {
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
