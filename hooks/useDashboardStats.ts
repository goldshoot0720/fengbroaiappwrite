"use client";

import { useState, useEffect } from "react";
import { convertToTWD } from "@/lib/formatters";
import { fetchApi } from "@/hooks/useApi";
import { useAppwriteSetup } from "@/hooks/useAppwriteSetup";
import { isActiveSubscription } from "@/lib/subscriptionFields";

interface Food {
  $id: string;
  name: string;
  amount: number;
  todate: string;
  photo: string;
}

interface Subscription {
  $id: string;
  name: string;
  site: string;
  price: number;
  nextdate: string;
  currency?: string;
  archived?: boolean;
}

interface FoodDetail {
  id: string;
  name: string;
  daysRemaining: number;
  expireDate: string;
}

interface SubscriptionDetail {
  id: string;
  name: string;
  site: string;
  daysRemaining: number;
  nextDate: string;
  price: number;
}

interface DashboardStats {
  totalFoods: number;
  totalSubscriptions: number;
  totalArticles: number;
  totalCommonAccounts: number;
  totalBanks: number;
  totalBankDeposit: number;
  totalRoutines: number;
  foodsExpiring7Days: number;
  foodsExpiring30Days: number;
  subscriptionsExpiring3Days: number;
  subscriptionsExpiring7Days: number;
  totalMonthlyFee: number;
  totalAnnualFee: number;
  expiredFoods: number;
  overdueSubscriptions: number;
  foodsExpiring7DaysList: FoodDetail[];
  foodsExpiring30DaysList: FoodDetail[];
  expiredFoodsList: FoodDetail[];
  subscriptionsExpiring3DaysList: SubscriptionDetail[];
  subscriptionsExpiring7DaysList: SubscriptionDetail[];
  overdueSubscriptionsList: SubscriptionDetail[];
}

const EMPTY_STATS: DashboardStats = {
  totalFoods: 0,
  totalSubscriptions: 0,
  totalArticles: 0,
  totalCommonAccounts: 0,
  totalBanks: 0,
  totalBankDeposit: 0,
  totalRoutines: 0,
  foodsExpiring7Days: 0,
  foodsExpiring30Days: 0,
  subscriptionsExpiring3Days: 0,
  subscriptionsExpiring7Days: 0,
  totalMonthlyFee: 0,
  totalAnnualFee: 0,
  expiredFoods: 0,
  overdueSubscriptions: 0,
  foodsExpiring7DaysList: [],
  foodsExpiring30DaysList: [],
  expiredFoodsList: [],
  subscriptionsExpiring3DaysList: [],
  subscriptionsExpiring7DaysList: [],
  overdueSubscriptionsList: [],
};

type TableLoadResult<T> = {
  data: T[];
  missingError: string | null;
};

async function loadTable<T>(api: string, cacheParam: string): Promise<TableLoadResult<T>> {
  try {
    const result = await fetchApi<T[]>(api + cacheParam);
    return { data: Array.isArray(result) ? result : [], missingError: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("不存在")) {
      return { data: [], missingError: message };
    }
    console.error(`Failed to load ${api}:`, err);
    return { data: [], missingError: null };
  }
}

function toFoodDetail(food: Food, today: Date, useFloor = false): FoodDetail {
  const expireDate = new Date(food.todate);
  const ms = expireDate.getTime() - today.getTime();
  const daysRemaining = useFloor
    ? Math.floor(ms / (1000 * 60 * 60 * 24))
    : Math.ceil(ms / (1000 * 60 * 60 * 24));
  return {
    id: food.$id,
    name: food.name,
    daysRemaining,
    expireDate: food.todate,
  };
}

function toSubDetail(sub: Subscription, today: Date, useFloor = false): SubscriptionDetail {
  const nextDate = new Date(sub.nextdate);
  const ms = nextDate.getTime() - today.getTime();
  const daysRemaining = useFloor
    ? Math.floor(ms / (1000 * 60 * 60 * 24))
    : Math.ceil(ms / (1000 * 60 * 60 * 24));
  return {
    id: sub.$id,
    name: sub.name,
    site: sub.site,
    daysRemaining,
    nextDate: sub.nextdate,
    price: sub.price,
  };
}

export function useDashboardStats() {
  const { checked: appwriteSetupChecked, hasDatabaseConfig } = useAppwriteSetup();
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [setupRequired, setSetupRequired] = useState(false);

  useEffect(() => {
    if (!appwriteSetupChecked) return;

    let cancelled = false;

    async function fetchStats() {
      const cacheParam = `?t=${Date.now()}`;
      setError(null);

      if (!hasDatabaseConfig) {
        setSetupRequired(true);
        setError(null);
        setLoading(false);
        return;
      }
      setSetupRequired(false);
      setLoading(true);

      try {
        // Single parallel fetch — no double round-trip "check then load"
        const [
          foodsResult,
          subsResult,
          articlesResult,
          accountsResult,
          banksResult,
          routinesResult,
          documentsResult,
        ] = await Promise.all([
          loadTable<Food>("/api/food", cacheParam),
          loadTable<Subscription>("/api/subscription", cacheParam),
          loadTable<unknown>("/api/article", cacheParam),
          loadTable<unknown>("/api/commonaccount", cacheParam),
          loadTable<{ deposit?: number }>("/api/bank", cacheParam),
          loadTable<unknown>("/api/routine", cacheParam),
          loadTable<unknown>("/api/commondocument", cacheParam),
        ]);

        if (cancelled) return;

        const missing = [
          foodsResult,
          subsResult,
          articlesResult,
          accountsResult,
          banksResult,
          routinesResult,
          documentsResult,
        ]
          .map((r) => r.missingError)
          .filter(Boolean) as string[];

        if (missing.length > 0) {
          throw new Error(missing.join("\n"));
        }

        const foods = foodsResult.data;
        const subscriptions = subsResult.data.filter(isActiveSubscription);
        const articles = articlesResult.data;
        const commonAccounts = accountsResult.data;
        const banks = banksResult.data;
        const routines = routinesResult.data;

        const today = new Date();
        const dayMs = 24 * 60 * 60 * 1000;
        const sevenDaysFromNow = new Date(today.getTime() + 7 * dayMs);
        const thirtyDaysFromNow = new Date(today.getTime() + 30 * dayMs);
        const threeDaysFromNow = new Date(today.getTime() + 3 * dayMs);

        const foodsExpiring7DaysList = foods
          .filter((food) => {
            if (!food.todate) return false;
            const expireDate = new Date(food.todate);
            if (Number.isNaN(expireDate.getTime())) return false;
            return expireDate <= sevenDaysFromNow && expireDate >= today;
          })
          .map((food) => toFoodDetail(food, today))
          .sort((a, b) => a.daysRemaining - b.daysRemaining);

        const foodsExpiring30DaysList = foods
          .filter((food) => {
            if (!food.todate) return false;
            const expireDate = new Date(food.todate);
            if (Number.isNaN(expireDate.getTime())) return false;
            return expireDate <= thirtyDaysFromNow && expireDate >= today;
          })
          .map((food) => toFoodDetail(food, today))
          .sort((a, b) => a.daysRemaining - b.daysRemaining);

        const expiredFoodsList = foods
          .filter((food) => {
            if (!food.todate) return false;
            const expireDate = new Date(food.todate);
            if (Number.isNaN(expireDate.getTime())) return false;
            return expireDate < today;
          })
          .map((food) => toFoodDetail(food, today, true))
          .sort((a, b) => a.daysRemaining - b.daysRemaining);

        const subscriptionsExpiring3DaysList = subscriptions
          .filter((sub) => {
            if (!sub.nextdate) return false;
            const nextDate = new Date(sub.nextdate);
            return nextDate <= threeDaysFromNow && nextDate >= today;
          })
          .map((sub) => toSubDetail(sub, today))
          .sort((a, b) => a.daysRemaining - b.daysRemaining);

        const subscriptionsExpiring7DaysList = subscriptions
          .filter((sub) => {
            if (!sub.nextdate) return false;
            const nextDate = new Date(sub.nextdate);
            return nextDate <= sevenDaysFromNow && nextDate >= today;
          })
          .map((sub) => toSubDetail(sub, today))
          .sort((a, b) => a.daysRemaining - b.daysRemaining);

        const overdueSubscriptionsList = subscriptions
          .filter((sub) => {
            if (!sub.nextdate) return false;
            const nextDate = new Date(sub.nextdate);
            return nextDate < today;
          })
          .map((sub) => toSubDetail(sub, today, true))
          .sort((a, b) => a.daysRemaining - b.daysRemaining);

        const totalMonthlyFee = subscriptions.reduce(
          (total, sub) => total + convertToTWD(sub.price, sub.currency),
          0
        );
        const totalAnnualFee = totalMonthlyFee;
        const totalBankDeposit = banks.reduce((total, bank) => total + (bank.deposit || 0), 0);

        setStats({
          totalFoods: foods.length,
          totalSubscriptions: subscriptions.length,
          totalArticles: articles.length,
          totalCommonAccounts: commonAccounts.length,
          totalBanks: banks.length,
          totalBankDeposit,
          totalRoutines: routines.length,
          foodsExpiring7Days: foodsExpiring7DaysList.length,
          foodsExpiring30Days: foodsExpiring30DaysList.length,
          subscriptionsExpiring3Days: subscriptionsExpiring3DaysList.length,
          subscriptionsExpiring7Days: subscriptionsExpiring7DaysList.length,
          totalMonthlyFee,
          totalAnnualFee,
          expiredFoods: expiredFoodsList.length,
          overdueSubscriptions: overdueSubscriptionsList.length,
          foodsExpiring7DaysList,
          foodsExpiring30DaysList,
          expiredFoodsList,
          subscriptionsExpiring3DaysList,
          subscriptionsExpiring7DaysList,
          overdueSubscriptionsList,
        });
      } catch (err) {
        if (cancelled) return;
        console.error("獲取統計數據失敗:", err);
        setError(err instanceof Error ? err.message : "獲取統計數據失敗");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchStats();
    return () => {
      cancelled = true;
    };
  }, [appwriteSetupChecked, hasDatabaseConfig]);

  return { stats, loading, error, setupRequired };
}
