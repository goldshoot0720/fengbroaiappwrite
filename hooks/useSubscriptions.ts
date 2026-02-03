import { useState, useEffect, useCallback } from "react";
import { Subscription, SubscriptionFormData } from "@/types";
import { API_ENDPOINTS } from "@/lib/constants";
import { formatDate, getDaysFromToday, getExpiryStatus, convertToTWD } from "@/lib/formatters";
import { fetchApi } from "@/hooks/useApi";

export function useSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 載入訂閱資料（不使用快取）
  const loadSubscriptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resData = await fetchApi<Subscription[]>(`${API_ENDPOINTS.SUBSCRIPTION}?t=${Date.now()}`);
      let data: Subscription[] = Array.isArray(resData) ? resData : [];
      // 按到期日排序，無日期排最後
      data = data.sort((a, b) => {
        const hasA = !!a.nextdate;
        const hasB = !!b.nextdate;
        if (!hasA && !hasB) return 0;
        if (!hasA) return 1;
        if (!hasB) return -1;
        return new Date(a.nextdate!).getTime() - new Date(b.nextdate!).getTime();
      });
      
      setSubscriptions(data);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "載入訂閱資料失敗";
      setError(message);
      console.error("載入訂閱資料失敗:", err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // 新增訂閱
  const createSubscription = useCallback(async (formData: SubscriptionFormData): Promise<Subscription | null> => {
    try {
      const newSub = await fetchApi<Subscription>(API_ENDPOINTS.SUBSCRIPTION, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      // 重新載入以確保資料同步
      await loadSubscriptions();
      return newSub;
    } catch (err) {
      console.error("新增訂閱失敗:", err);
      throw err;
    }
  }, [loadSubscriptions]);

  // 新增訂閱（不重新載入，用於批量匯入）
  const createSubscriptionSilent = useCallback(async (formData: SubscriptionFormData): Promise<Subscription | null> => {
    try {
      const newSub = await fetchApi<Subscription>(API_ENDPOINTS.SUBSCRIPTION, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      return newSub;
    } catch (err) {
      console.error("新增訂閱失敗:", err);
      throw err;
    }
  }, []);

  // 更新訂閱
  const updateSubscription = useCallback(async (id: string, formData: SubscriptionFormData): Promise<Subscription | null> => {
    try {
      const updatedSub = await fetchApi<Subscription>(`${API_ENDPOINTS.SUBSCRIPTION}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      // 重新載入以確保資料同步
      await loadSubscriptions();
      return updatedSub;
    } catch (err) {
      console.error("更新訂閱失敗:", err);
      throw err;
    }
  }, [loadSubscriptions]);

  // 更新訂閱（不重新載入，用於批量匯入）
  const updateSubscriptionSilent = useCallback(async (id: string, formData: SubscriptionFormData): Promise<Subscription | null> => {
    try {
      const updatedSub = await fetchApi<Subscription>(`${API_ENDPOINTS.SUBSCRIPTION}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      return updatedSub;
    } catch (err) {
      console.error("更新訂閱失敗:", err);
      throw err;
    }
  }, []);

  // 刪除訂閱
  const deleteSubscription = useCallback(async (id: string): Promise<boolean> => {
    try {
      await fetchApi(`${API_ENDPOINTS.SUBSCRIPTION}/${id}`, { method: "DELETE" });
      // 重新載入以確保資料同步
      await loadSubscriptions();
      return true;
    } catch (err) {
      console.error("刪除訂閱失敗:", err);
      throw err;
    }
  }, [loadSubscriptions]);

  // 初始載入
  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  // 計算統計資料
  const stats = (() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextMonthYear = currentMonth === 11 ? currentYear + 1 : currentYear;

    // 計算總金額（換算為TWD）
    const totalTWD = Array.isArray(subscriptions) 
      ? subscriptions.reduce((sum, s) => {
          const feeInTWD = convertToTWD(s.price || 0, s.currency);
          return sum + feeInTWD;
        }, 0)
      : 0;

    // 計算本月到期筆數
    const expiringSoon = Array.isArray(subscriptions)
      ? subscriptions.filter((s) => {
          if (!s.nextdate) return false;
          const nextDate = new Date(s.nextdate);
          return (
            nextDate.getFullYear() === currentYear &&
            nextDate.getMonth() === currentMonth
          );
        }).length
      : 0;

    // 計算本月月費（本月到期的訂閱總費用）
    const totalMonthlyFee = Array.isArray(subscriptions)
      ? subscriptions.reduce((sum, s) => {
          if (!s.nextdate) return sum;
          const nextDate = new Date(s.nextdate);
          if (nextDate.getFullYear() === currentYear && nextDate.getMonth() === currentMonth) {
            return sum + convertToTWD(s.price || 0, s.currency);
          }
          return sum;
        }, 0)
      : 0;

    // 計算下月月費（下月到期的訂閱總費用）
    const nextMonthFee = Array.isArray(subscriptions)
      ? subscriptions.reduce((sum, s) => {
          if (!s.nextdate) return sum;
          const nextDate = new Date(s.nextdate);
          if (nextDate.getFullYear() === nextMonthYear && nextDate.getMonth() === nextMonth) {
            return sum + convertToTWD(s.price || 0, s.currency);
          }
          return sum;
        }, 0)
      : 0;

    return {
      total: Array.isArray(subscriptions) ? subscriptions.length : 0,
      totalTWD,
      expiringSoon,
      totalMonthlyFee,
      nextMonthFee,
    };
  })();

  return {
    subscriptions,
    loading,
    error,
    stats,
    loadSubscriptions,
    createSubscription,
    createSubscriptionSilent,
    updateSubscription,
    updateSubscriptionSilent,
    deleteSubscription,
  };
}

// 訂閱項目的輔助函數
export function getSubscriptionExpiryInfo(subscription: Subscription) {
  const daysRemaining = getDaysFromToday(subscription.nextdate || '');
  const status = getExpiryStatus(daysRemaining);
  const formattedDate = formatDate(subscription.nextdate || '');
  
  return {
    daysRemaining,
    status,
    formattedDate,
    isExpired: daysRemaining < 0,
    isExpiringSoon: daysRemaining >= 0 && daysRemaining <= 7,
  };
}
