"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Food, FoodFormData } from "@/types";
import { API_ENDPOINTS } from "@/lib/constants";
import { formatDate, getDaysFromToday, getExpiryStatus } from "@/lib/formatters";
import { fetchApi } from "@/hooks/useApi";
import { bumpRefreshKey, useRefreshKeyListener } from "@/hooks/useRefreshKey";
import { readEndpointCache, writeEndpointCache } from "@/lib/requestCache";

// 全域快取
let cachedFoods: Food[] | null = null;
let cacheTimestamp: number = 0;

function getSortableDateValue(dateStr: string) {
  if (!dateStr) return Number.POSITIVE_INFINITY;
  const time = new Date(dateStr).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

function sortFoodsByExpiryDate(a: Food, b: Food) {
  return getSortableDateValue(a.todate) - getSortableDateValue(b.todate);
}

export function useFoods() {
  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 從localStorage 讀取上次 CRUD 的時間戳
  const getRefreshKey = () => {
    if (typeof window === 'undefined') return '';
    const accountSwitched = localStorage.getItem('appwrite_account_switched');
    if (accountSwitched) return accountSwitched;
    return localStorage.getItem('foods_refresh_key') || '';
  };

  // 寫入後本地狀態已是最新：只通知其他模組／分頁，自己不再整張表重抓一次 Appwrite。
  const selfBump = useRef(false);
  const setRefreshKey = () => {
    selfBump.current = true;
    try {
      bumpRefreshKey("foods_refresh_key");
    } finally {
      selfBump.current = false;
    }
  };

  /** 把寫入後的清單同步進模組快取與 session 快取，下次掛載／重新整理可直接上畫。 */
  const commitFoods = useCallback((updater: (prev: Food[]) => Food[]) => {
    setFoods((prev) => {
      const next = updater(prev).sort(sortFoodsByExpiryDate);
      cachedFoods = next;
      cacheTimestamp = Date.now() + 1;
      writeEndpointCache(API_ENDPOINTS.FOOD, next);
      return next;
    });
  }, []);

  // 載入食品資料（使用快取）
  const loadFoods = useCallback(async (forceRefresh = false) => {
    const storedRefreshKey = getRefreshKey();
    const accountSwitched = typeof window !== 'undefined' ? localStorage.getItem('appwrite_account_switched') : null;
      
    if (accountSwitched && cacheTimestamp < parseInt(accountSwitched)) {
      cachedFoods = null;
      forceRefresh = true;
    }
      
    // 如果有快取且沒有 CRUD 操作，直接使用快取
    if (!forceRefresh && cachedFoods && (!storedRefreshKey || cacheTimestamp >= parseInt(storedRefreshKey))) {
      setFoods(cachedFoods);
      setLoading(false);
      return cachedFoods;
    }

    // 重新整理後先畫出上次存下的結果，再讓下面的請求在背景更新。
    const persisted = forceRefresh ? null : readEndpointCache<Food[]>(API_ENDPOINTS.FOOD);
    if (persisted && persisted.length) {
      setFoods(persisted);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const cacheParam = (forceRefresh || storedRefreshKey) ? `?t=${storedRefreshKey || Date.now()}` : '';
      const resData = await fetchApi<Food[]>(API_ENDPOINTS.FOOD + cacheParam);
      let data: Food[] = Array.isArray(resData) ? resData : [];
      // 按到期日排序
      data = data.sort(sortFoodsByExpiryDate);
      
      // 更新快取
      cachedFoods = data;
      cacheTimestamp = Date.now();
      writeEndpointCache(API_ENDPOINTS.FOOD, data);
      
      setFoods(data);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "載入食品資料失敗";
      setError(message);
      console.error("載入食品資料失敗:", err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // 新增食品
  const createFood = useCallback(async (formData: FoodFormData): Promise<Food | null> => {
    try {
      const newFood = await fetchApi<Food>(API_ENDPOINTS.FOOD, {
        method: "POST",
        body: JSON.stringify(formData),
      });
      
      setRefreshKey();
      commitFoods((prev) => [...prev.filter((f) => f.$id !== newFood.$id), newFood]);
      return newFood;
    } catch (err) {
      console.error("新增食品失敗:", err);
      throw err;
    }
  }, [commitFoods]);

  // 更新食品
  const updateFood = useCallback(async (id: string, formData: FoodFormData): Promise<Food | null> => {
    try {
      const updatedFood = await fetchApi<Food>(`${API_ENDPOINTS.FOOD}/${id}`, {
        method: "PUT",
        body: JSON.stringify(formData),
      });
      setRefreshKey();
      commitFoods((prev) => prev.map((f) => (f.$id === id ? updatedFood : f)));
      return updatedFood;
    } catch (err) {
      console.error("更新食品失敗:", err);
      console.error("錯誤詳情:", err instanceof Error ? err.message : err);
      throw err;
    }
  }, [commitFoods]);

  // 刪除食品
  const deleteFood = useCallback(async (id: string): Promise<boolean> => {
    // 樂觀刪除：先從畫面移除，失敗再放回去。
    let removed: Food | undefined;
    commitFoods((prev) => {
      removed = prev.find((f) => f.$id === id);
      return prev.filter((f) => f.$id !== id);
    });
    try {
      await fetchApi(`${API_ENDPOINTS.FOOD}/${id}`, { method: "DELETE" });
      setRefreshKey();
      return true;
    } catch (err) {
      console.error("刪除食品失敗:", err);
      if (removed) {
        const restore = removed;
        commitFoods((prev) => (prev.some((f) => f.$id === id) ? prev : [...prev, restore]));
      }
      throw err;
    }
  }, [commitFoods]);

  // 更新數量
  const updateAmount = useCallback(async (food: Food, delta: number): Promise<boolean> => {
    const newAmount = food.amount + delta;
    if (newAmount < 0) return false;

    // 樂觀更新：數量加減立即反映在畫面，不等 Appwrite 回應。
    commitFoods((prev) => prev.map((f) => (f.$id === food.$id ? { ...f, amount: newAmount } : f)));

    try {
      const updatedFood = await fetchApi<Food>(`${API_ENDPOINTS.FOOD}/${food.$id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: food.name,
          amount: newAmount,
          todate: food.todate,
          photo: food.photo || '',
          price: food.price || 0,
          shop: food.shop || '',
          photohash: food.photohash || '',
        }),
      });

      setRefreshKey();
      commitFoods((prev) => prev.map((f) => (f.$id === food.$id ? updatedFood : f)));
      return true;
    } catch {
      // 失敗回滾到原本數量。
      commitFoods((prev) => prev.map((f) => (f.$id === food.$id ? { ...f, amount: food.amount } : f)));
      return false;
    }
  }, [commitFoods]);

  // 初始載入
  useEffect(() => {
    loadFoods();
  }, [loadFoods]);

  // 事件驅動快取失效（同頁 CustomEvent / 跨分頁 storage）
  // 用穩定 callback，避免 useFoods 每次 render 都重綁 listener
  const handleFoodsRefresh = useCallback(() => {
    if (selfBump.current) return;
    loadFoods(true);
  }, [loadFoods]);

  useRefreshKeyListener("foods_refresh_key", handleFoodsRefresh);

  const stats = useMemo(() => {
    const list = Array.isArray(foods) ? foods : [];
    let expired = 0;
    let expiringSoon = 0;
    for (const food of list) {
      const days = getDaysFromToday(food.todate);
      if (days < 0) expired += 1;
      else if (days <= 7) expiringSoon += 1;
    }
    return { total: list.length, expired, expiringSoon };
  }, [foods]);

  return {
    foods,
    loading,
    error,
    stats,
    loadFoods,
    createFood,
    updateFood,
    deleteFood,
    updateAmount,
  };
}

// 食品項目的輔助函數
export function getFoodExpiryInfo(food: Food) {
  const daysRemaining = getDaysFromToday(food.todate);
  const status = getExpiryStatus(daysRemaining);
  const formattedDate = formatDate(food.todate) || "未設定";
  
  return {
    daysRemaining,
    status,
    formattedDate,
    isExpired: daysRemaining < 0,
    isExpiringSoon: daysRemaining >= 0 && daysRemaining <= 3,
  };
}
