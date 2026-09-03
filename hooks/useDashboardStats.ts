"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { convertToTWD } from "@/lib/formatters";
import { fetchApi } from "@/hooks/useApi";
import { useAppwriteSetup } from "@/hooks/useAppwriteSetup";
import { useRefreshKeyListener } from "@/hooks/useRefreshKey";
import { readSessionCache, writeSessionCache } from "@/lib/sessionDataCache";

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
}

/** 試用／首購表（Appwrite trialpurchase） */
interface TrialPurchaseDoc {
  $id: string;
  name: string;
  eventDate?: string;
  trialStatus?: string;
  purchaseStatus?: string;
}

/** 額度表（Appwrite quota） */
interface QuotaDoc {
  $id: string;
  name: string;
  account?: string;
  serviceType?: "general" | "ai";
  quotaExpiry?: string;
  expiryWeek?: string;
  expiryMonth?: string;
}

/** 購物清單表（Appwrite shoppinglist） */
interface ShoppingDoc {
  $id: string;
  name: string;
  plannedDate?: string;
  price?: number;
  currency?: string;
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

/** 試用／首購到期細節（以 eventDate 為準） */
interface TrialPurchaseDetail {
  id: string;
  name: string;
  daysRemaining: number;
  eventDate: string;
  trialStatus: string;
  purchaseStatus: string;
}

/** 額度到期細節：general 看 quotaExpiry；ai 額外列出一週／一月到期 */
interface QuotaExpiryDetail {
  id: string;
  name: string;
  account: string;
  serviceType: "general" | "ai";
  daysRemaining: number | null;
  expiryDate: string;
  kind: "quotaExpiry" | "expiryWeek" | "expiryMonth";
  /** 供通知訊息選用（ex: 「一週到期」） */
  label: string;
}

/** 購物清單到期細節（以 plannedDate 為準） */
interface ShoppingItemDetail {
  id: string;
  name: string;
  daysRemaining: number;
  plannedDate: string;
  price?: number;
  currency?: string;
}

interface DashboardStats {
  totalFoods: number;
  totalSubscriptions: number;
  totalTrialPurchases: number;
  totalQuotaAccounts: number;
  totalShoppingItems: number;
  totalArticles: number;
  totalCommonAccounts: number;
  totalBanks: number;
  totalBankDeposit: number;
  totalRoutines: number;
  foodsExpiring7Days: number;
  foodsExpiring30Days: number;
  subscriptionsExpiring3Days: number;
  subscriptionsExpiring7Days: number;
  trialPurchasesExpiring3Days: number;
  quotaAccountsExpiring3Days: number;
  quotaAiExpiringTodayOrTomorrow: number;
  shoppingItemsExpiring3Days: number;
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
  trialPurchasesExpiring3DaysList: TrialPurchaseDetail[];
  quotaAccountsExpiring3DaysList: QuotaExpiryDetail[];
  quotaAiExpiringSoonList: QuotaExpiryDetail[];
  shoppingItemsExpiring3DaysList: ShoppingItemDetail[];
}

const DASHBOARD_STATS_TTL_MS = 60_000;

const EMPTY_STATS: DashboardStats = {
  totalFoods: 0,
  totalSubscriptions: 0,
  totalTrialPurchases: 0,
  totalQuotaAccounts: 0,
  totalShoppingItems: 0,
  totalArticles: 0,
  totalCommonAccounts: 0,
  totalBanks: 0,
  totalBankDeposit: 0,
  totalRoutines: 0,
  foodsExpiring7Days: 0,
  foodsExpiring30Days: 0,
  subscriptionsExpiring3Days: 0,
  subscriptionsExpiring7Days: 0,
  trialPurchasesExpiring3Days: 0,
  quotaAccountsExpiring3Days: 0,
  quotaAiExpiringTodayOrTomorrow: 0,
  shoppingItemsExpiring3Days: 0,
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
  trialPurchasesExpiring3DaysList: [],
  quotaAccountsExpiring3DaysList: [],
  quotaAiExpiringSoonList: [],
  shoppingItemsExpiring3DaysList: [],
};

type TableLoadResult<T> = {
  data: T[];
  missingError: string | null;
};

const emptyTableResult = <T,>(): TableLoadResult<T> => ({
  data: [],
  missingError: null,
});

function dashboardStatsCacheName(includeExtended: boolean) {
  return includeExtended ? "dashboard-stats-full" : "dashboard-stats-summary";
}

async function loadTable<T>(
  api: string,
  signal?: AbortSignal
): Promise<TableLoadResult<T>> {
  try {
    const result = await fetchApi<T[]>(api, { signal });
    return { data: Array.isArray(result) ? result : [], missingError: null };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { data: [], missingError: null };
    }
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

export function useDashboardStats(includeExtended = true) {
  const { checked: appwriteSetupChecked, hasDatabaseConfig } = useAppwriteSetup();
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const requestSequence = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);

  const loadStats = useCallback(async () => {
    const requestId = ++requestSequence.current;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setError(null);

    if (!hasDatabaseConfig) {
      setSetupRequired(true);
      setLoading(false);
      if (requestId === requestSequence.current) activeRequest.current = null;
      return;
    }
    setSetupRequired(false);
    const cached = readSessionCache<DashboardStats>(
      dashboardStatsCacheName(includeExtended),
      DASHBOARD_STATS_TTL_MS,
    );
    if (cached) {
      setStats(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      // 三個管理模組表（試用/首購、額度、購物清單）以「可選」方式載入：
      // 尚未在鋒兄設定建立 Table 時不阻斷首頁，相關計數維持 0。
      // 精簡／完整模式都會載入，讓首頁待辦與到期提醒同步。精簡模式才略過文章／常用／銀行／例行等裝飾統計。
      const [
        foodsResult,
        subsResult,
        articlesResult,
        accountsResult,
        banksResult,
        routinesResult,
        trialPurchasesResult,
        quotaResult,
        shoppingResult,
      ] = await Promise.all([
        loadTable<Food>("/api/food", controller.signal),
        loadTable<Subscription>("/api/subscription", controller.signal),
        includeExtended
          ? loadTable<unknown>("/api/article", controller.signal)
          : Promise.resolve(emptyTableResult<unknown>()),
        includeExtended
          ? loadTable<unknown>("/api/commonaccount", controller.signal)
          : Promise.resolve(emptyTableResult<unknown>()),
        includeExtended
          ? loadTable<{ deposit?: number }>("/api/bank", controller.signal)
          : Promise.resolve(emptyTableResult<{ deposit?: number }>()),
        includeExtended
          ? loadTable<unknown>("/api/routine", controller.signal)
          : Promise.resolve(emptyTableResult<unknown>()),
        loadTable<TrialPurchaseDoc>("/api/trial-purchase", controller.signal),
        loadTable<QuotaDoc>("/api/quota", controller.signal),
        loadTable<ShoppingDoc>("/api/shopping-list", controller.signal),
      ]);

      if (controller.signal.aborted || requestId !== requestSequence.current) return;

      const missing = [
        foodsResult,
        subsResult,
        articlesResult,
        accountsResult,
        banksResult,
        routinesResult,
      ]
        .map((r) => r.missingError)
        .filter(Boolean) as string[];

      if (missing.length > 0) {
        throw new Error(missing.join("\n"));
      }

      const foods = foodsResult.data;
      const subscriptions = subsResult.data;
      const articles = articlesResult.data;
      const commonAccounts = accountsResult.data;
      const banks = banksResult.data;
      const routines = routinesResult.data;
      const trialPurchases = trialPurchasesResult.missingError ? [] : trialPurchasesResult.data;
      const quotas = quotaResult.missingError ? [] : quotaResult.data;
      const shoppingItems = shoppingResult.missingError ? [] : shoppingResult.data;

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

      // 試用／首購：到期前 3 天內（含當天）進入提醒窗口
      const trialPurchasesExpiring3DaysList = trialPurchases
        .filter((doc) => {
          if (!doc.eventDate) return false;
          const eventDate = new Date(doc.eventDate);
          if (Number.isNaN(eventDate.getTime())) return false;
          return eventDate <= threeDaysFromNow && eventDate >= today;
        })
        .map((doc) => {
          const eventDate = new Date(doc.eventDate!);
          const daysRemaining = Math.ceil((eventDate.getTime() - today.getTime()) / dayMs);
          return {
            id: doc.$id,
            name: doc.name,
            daysRemaining,
            eventDate: doc.eventDate!,
            trialStatus: doc.trialStatus || "untried",
            purchaseStatus: doc.purchaseStatus || "not_purchased",
          } satisfies TrialPurchaseDetail;
        })
        .sort((a, b) => a.daysRemaining - b.daysRemaining);

      // 額度到期：非 AI 用 quotaExpiry（0~3 天）；AI 的一週／一月到期只列前一天與當天（0~1 天）
      const quotaExpiryDetails: QuotaExpiryDetail[] = [];
      for (const doc of quotas) {
        const isAi = doc.serviceType === "ai";
        const pushDate = (kind: "quotaExpiry" | "expiryWeek" | "expiryMonth", raw?: string, label?: string) => {
          if (!raw) return;
          const date = new Date(raw);
          if (Number.isNaN(date.getTime())) return;
          const daysRemaining = Math.ceil((date.getTime() - today.getTime()) / dayMs);
          // 規則：非 AI quotaExpiry 0~3 天；AI 一週／一月只提醒前一天＋當天（0~1 天）
          const inWindow = kind === "quotaExpiry"
            ? !isAi && daysRemaining >= 0 && daysRemaining <= 3
            : isAi && daysRemaining >= 0 && daysRemaining <= 1;
          if (!inWindow) return;
          quotaExpiryDetails.push({
            id: doc.$id,
            name: doc.name,
            account: doc.account || "",
            serviceType: isAi ? "ai" : "general",
            daysRemaining,
            expiryDate: raw,
            kind,
            label: label || (kind === "expiryWeek" ? "一週到期" : kind === "expiryMonth" ? "一月到期" : "額度到期"),
          });
        };
        if (!isAi) pushDate("quotaExpiry", doc.quotaExpiry, "額度到期");
        else {
          pushDate("expiryWeek", doc.expiryWeek, "一週到期");
          pushDate("expiryMonth", doc.expiryMonth, "一月到期");
        }
      }
      quotaExpiryDetails.sort((a, b) => (a.daysRemaining ?? 0) - (b.daysRemaining ?? 0));
      const quotaAccountsExpiring3DaysList = quotaExpiryDetails.filter(
        (detail) => detail.kind === "quotaExpiry" && (detail.daysRemaining ?? 0) >= 0 && (detail.daysRemaining ?? 0) <= 3,
      );
      const quotaAiExpiringSoonList = quotaExpiryDetails.filter(
        (detail) => detail.kind !== "quotaExpiry" && (detail.daysRemaining ?? 0) >= 0 && (detail.daysRemaining ?? 0) <= 1,
      );

      // 購物清單：預定購買日前 3 天內（含當天）進入提醒窗口
      const shoppingItemsExpiring3DaysList = shoppingItems
        .filter((doc) => {
          if (!doc.plannedDate) return false;
          const planned = new Date(doc.plannedDate);
          if (Number.isNaN(planned.getTime())) return false;
          return planned <= threeDaysFromNow && planned >= today;
        })
        .map((doc) => {
          const planned = new Date(doc.plannedDate!);
          const daysRemaining = Math.ceil((planned.getTime() - today.getTime()) / dayMs);
          return {
            id: doc.$id,
            name: doc.name,
            daysRemaining,
            plannedDate: doc.plannedDate!,
            price: doc.price,
            currency: doc.currency,
          } satisfies ShoppingItemDetail;
        })
        .sort((a, b) => a.daysRemaining - b.daysRemaining);

      const totalMonthlyFee = subscriptions.reduce(
        (total, sub) => total + convertToTWD(sub.price, sub.currency),
        0
      );
      const totalAnnualFee = totalMonthlyFee;
      const totalBankDeposit = banks.reduce((total, bank) => total + (bank.deposit || 0), 0);

      const nextStats: DashboardStats = {
        totalFoods: foods.length,
        totalSubscriptions: subscriptions.length,
        totalTrialPurchases: trialPurchases.length,
        totalQuotaAccounts: quotas.length,
        totalShoppingItems: shoppingItems.length,
        totalArticles: articles.length,
        totalCommonAccounts: commonAccounts.length,
        totalBanks: banks.length,
        totalBankDeposit,
        totalRoutines: routines.length,
        foodsExpiring7Days: foodsExpiring7DaysList.length,
        foodsExpiring30Days: foodsExpiring30DaysList.length,
        subscriptionsExpiring3Days: subscriptionsExpiring3DaysList.length,
        subscriptionsExpiring7Days: subscriptionsExpiring7DaysList.length,
        trialPurchasesExpiring3Days: trialPurchasesExpiring3DaysList.length,
        quotaAccountsExpiring3Days: quotaAccountsExpiring3DaysList.length,
        quotaAiExpiringTodayOrTomorrow: quotaAiExpiringSoonList.length,
        shoppingItemsExpiring3Days: shoppingItemsExpiring3DaysList.length,
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
        trialPurchasesExpiring3DaysList,
        quotaAccountsExpiring3DaysList,
        quotaAiExpiringSoonList,
        shoppingItemsExpiring3DaysList,
      };
      setStats(nextStats);
      writeSessionCache(dashboardStatsCacheName(includeExtended), nextStats);
    } catch (err) {
      if (controller.signal.aborted || requestId !== requestSequence.current) return;
      console.error("獲取統計數據失敗:", err);
      setError(err instanceof Error ? err.message : "獲取統計數據失敗");
    } finally {
      if (requestId === requestSequence.current) {
        activeRequest.current = null;
        setLoading(false);
      }
    }
  }, [hasDatabaseConfig, includeExtended]);

  useEffect(() => {
    if (!appwriteSetupChecked) return;
    void loadStats();
    return () => {
      requestSequence.current += 1;
      activeRequest.current?.abort();
      activeRequest.current = null;
    };
  }, [appwriteSetupChecked, loadStats]);

  const refreshEnabled = appwriteSetupChecked && hasDatabaseConfig;
  useRefreshKeyListener("food_refresh_key", loadStats, refreshEnabled);
  useRefreshKeyListener("subscription_refresh_key", loadStats, refreshEnabled);
  useRefreshKeyListener("trialpurchase_refresh_key", loadStats, refreshEnabled);
  useRefreshKeyListener("quota_refresh_key", loadStats, refreshEnabled);
  useRefreshKeyListener("shoppinglist_refresh_key", loadStats, refreshEnabled);
  useRefreshKeyListener("articles_refresh_key", loadStats, refreshEnabled && includeExtended);
  useRefreshKeyListener("commonaccount_refresh_key", loadStats, refreshEnabled && includeExtended);
  useRefreshKeyListener("bank_refresh_key", loadStats, refreshEnabled && includeExtended);
  useRefreshKeyListener("routine_refresh_key", loadStats, refreshEnabled && includeExtended);

  return { stats, loading, error, setupRequired };
}
