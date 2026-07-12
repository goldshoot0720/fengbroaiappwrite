"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Food, FoodFormData } from "@/types";
import { API_ENDPOINTS } from "@/lib/constants";
import { formatDate, getDaysFromToday, getExpiryStatus } from "@/lib/formatters";
import { fetchApi } from "@/hooks/useApi";
import { bumpRefreshKey, useRefreshKeyListener } from "@/hooks/useRefreshKey";

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

  const setRefreshKey = () => bumpRefreshKey("foods_refresh_key");

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

    setLoading(true);
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
      
      setFoods((prev) => {
        const updated = [...prev, newFood];
        return updated.sort(sortFoodsByExpiryDate);
      });
      cachedFoods = null;
      setRefreshKey();
      return newFood;
    } catch (err) {
      console.error("新增食品失敗:", err);
      throw err;
    }
  }, []);

  // 更新食品
  const updateFood = useCallback(async (id: string, formData: FoodFormData): Promise<Food | null> => {
    try {
      console.log('更新食品 - ID:', id, '資料:', formData);
      const updatedFood = await fetchApi<Food>(`${API_ENDPOINTS.FOOD}/${id}`, {
        method: "PUT",
        body: JSON.stringify(formData),
      });
      console.log('更新成功:', updatedFood);
      
      setFoods((prev) => {
        const updated = prev.map((f) => (f.$id === id ? updatedFood : f));
        return updated.sort(sortFoodsByExpiryDate);
      });
      cachedFoods = null;
      setRefreshKey();
      return updatedFood;
    } catch (err) {
      console.error("更新食品失敗:", err);
      console.error("錯誤詳情:", err instanceof Error ? err.message : err);
      throw err;
    }
  }, []);

  // 刪除食品
  const deleteFood = useCallback(async (id: string): Promise<boolean> => {
    try {
      await fetchApi(`${API_ENDPOINTS.FOOD}/${id}`, { method: "DELETE" });
      
      setFoods((prev) => prev.filter((f) => f.$id !== id));
      cachedFoods = null;
      setRefreshKey();
      return true;
    } catch (err) {
      console.error("刪除食品失敗:", err);
      throw err;
    }
  }, []);

  // 更新數量
  const updateAmount = useCallback(async (food: Food, delta: number): Promise<boolean> => {
    const newAmount = food.amount + delta;
    if (newAmount < 0) return false;

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

      setFoods((prev) => {
        const updated = prev.map((f) => (f.$id === food.$id ? updatedFood : f));
        cachedFoods = updated.sort(sortFoodsByExpiryDate);
        cacheTimestamp = Date.now();
        return cachedFoods;
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  // 初始載入
  useEffect(() => {
    loadFoods();
  }, [loadFoods]);

  // 事件驅動快取失效（同頁 CustomEvent / 跨分頁 storage）
  useRefreshKeyListener("foods_refresh_key", () => {
    loadFoods(true);
  });

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
