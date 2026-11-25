"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { convertToTWD, getDaysFromToday } from "@/lib/formatters";
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

/** 銀行／電子票證／點數表（Appwrite bank） */
interface BankDoc {
  $id: string;
  name: string;
  deposit?: number;
  expiry?: string;
  category?: string;
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

/** 銀行／票證／點數到期細節（以 expiry 為準） */
interface BankExpiryDetail {
  id: string;
  name: string;
  daysRemaining: number;
  expiry: string;
  category: string;
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
  banksExpiring7Days: number;
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
  banksExpiring7DaysList: BankExpiryDetail[];
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
  banksExpiring7Days: 0,
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
  banksExpiring7DaysList: [],
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
    if (!Array.isArray(result)) throw new Error("收到的資料格式不正確");
    return { data: result, missingError: null };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { data: [], missingError: null };
    }
    const message = err instanceof Error ? err.message : "";
    if (message.includes("不存在")) {
      return { data: [], missingError: message };
    }
    throw err;
  }
}

/**
 * 到期天數一律用「本地日曆日」計算，與各模組頁（useFoods / useSubscriptions /
 * useShoppingList）的 getDaysFromToday 同口徑。
 *
 * 不要再用 `now` 與原始時間戳相減後 Math.ceil：Appwrite 的 date-only 欄位會存成
 * UTC 00:00，在 UTC+8 等於當天 08:00，於是首頁把「今天扣款」顯示成「1 天後」、
 * 「明天」顯示成「2 天後」；超過 08:00 後當天的項目甚至會被誤判成已逾期。
 *
 * 回傳 null 代表沒填日期或日期無法解析。
 */
function daysUntil(raw?: string | null): number | null {
  if (!raw) return null;
  const days = getDaysFromToday(raw);
  return Number.isFinite(days) ? days : null;
}

function toFoodDetail(food: Food): FoodDetail {
  return {
    id: food.$id,
    name: food.name,
    daysRemaining: daysUntil(food.todate) ?? 0,
    expireDate: food.todate,
  };
}

function toSubDetail(sub: Subscription): SubscriptionDetail {
  return {
    id: sub.$id,
    name: sub.name,
    site: sub.site,
    daysRemaining: daysUntil(sub.nextdate) ?? 0,
    nextDate: sub.nextdate,
    price: sub.price,
  };
}

export function useDashboardStats(includeExtended = true) {
  const { checked: appwriteSetupChecked, hasDatabaseConfig } = useAppwriteSetup();
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [resolvedMode, setResolvedMode] = useState<boolean | null>(null);
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
      setResolvedMode(includeExtended);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      // 三個管理模組表（試用/首購、額度、購物清單）以「可選」方式載入：
      // 尚未在鋒兄設定建立 Table 時不阻斷首頁，相關計數維持 0。
      // 精簡／完整模式都會載入，讓首頁待辦與到期提醒同步。銀行也一起載入（點數／票證
      // 有到期提醒），精簡模式才略過文章／常用／例行等裝飾統計。
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
        loadTable<BankDoc>("/api/bank", controller.signal),
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
        routinesResult,
        // 銀行在精簡模式也會載入（點數到期提醒），但只有完整儀表會顯示銀行統計，
        // 所以沒建表時只在完整模式視為錯誤。
        ...(includeExtended ? [banksResult] : []),
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
      const banks = banksResult.missingError ? [] : banksResult.data;
      const routines = routinesResult.data;
      const trialPurchases = trialPurchasesResult.missingError ? [] : trialPurchasesResult.data;
      const quotas = quotaResult.missingError ? [] : quotaResult.data;
      const shoppingItems = shoppingResult.missingError ? [] : shoppingResult.data;

      // 提醒窗口以「日曆日」表示：0 = 今天，3 = 三天後，負數 = 已過期。
      const EXPIRING_3_DAYS = 3;
      const EXPIRING_7_DAYS = 7;
      const EXPIRING_30_DAYS = 30;

      const foodsExpiring7DaysList = foods
        .filter((food) => {
          const days = daysUntil(food.todate);
          return days !== null && days >= 0 && days <= EXPIRING_7_DAYS;
        })
        .map(toFoodDetail)
        .sort((a, b) => a.daysRemaining - b.daysRemaining);

      const foodsExpiring30DaysList = foods
        .filter((food) => {
          const days = daysUntil(food.todate);
          return days !== null && days >= 0 && days <= EXPIRING_30_DAYS;
        })
        .map(toFoodDetail)
        .sort((a, b) => a.daysRemaining - b.daysRemaining);

      const expiredFoodsList = foods
        .filter((food) => {
          const days = daysUntil(food.todate);
          return days !== null && days < 0;
        })
        .map(toFoodDetail)
        .sort((a, b) => a.daysRemaining - b.daysRemaining);

      const subscriptionsExpiring3DaysList = subscriptions
        .filter((sub) => {
          const days = daysUntil(sub.nextdate);
          return days !== null && days >= 0 && days <= EXPIRING_3_DAYS;
        })
        .map(toSubDetail)
        .sort((a, b) => a.daysRemaining - b.daysRemaining);

      const subscriptionsExpiring7DaysList = subscriptions
        .filter((sub) => {
          const days = daysUntil(sub.nextdate);
          return days !== null && days >= 0 && days <= EXPIRING_7_DAYS;
        })
        .map(toSubDetail)
        .sort((a, b) => a.daysRemaining - b.daysRemaining);

      const overdueSubscriptionsList = subscriptions
        .filter((sub) => {
          const days = daysUntil(sub.nextdate);
          return days !== null && days < 0;
        })
        .map(toSubDetail)
        .sort((a, b) => a.daysRemaining - b.daysRemaining);

      // 試用／首購：到期前 3 天內（含當天）進入提醒窗口
      const trialPurchasesExpiring3DaysList = trialPurchases
        .filter((doc) => {
          const days = daysUntil(doc.eventDate);
          return days !== null && days >= 0 && days <= EXPIRING_3_DAYS;
        })
        .map((doc) => {
          return {
            id: doc.$id,
            name: doc.name,
            daysRemaining: daysUntil(doc.eventDate) ?? 0,
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
          const daysRemaining = daysUntil(raw);
          if (daysRemaining === null) return;
          // 規則：非 AI quotaExpiry 0~3 天；AI 一週／一月只提醒前一天＋當天（0~1 天）
          const inWindow = kind === "quotaExpiry"
            ? !isAi && daysRemaining >= 0 && daysRemaining <= EXPIRING_3_DAYS
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
        (detail) => detail.kind === "quotaExpiry" && (detail.daysRemaining ?? 0) >= 0 && (detail.daysRemaining ?? 0) <= EXPIRING_3_DAYS,
      );
      const quotaAiExpiringSoonList = quotaExpiryDetails.filter(
        (detail) => detail.kind !== "quotaExpiry" && (detail.daysRemaining ?? 0) >= 0 && (detail.daysRemaining ?? 0) <= 1,
      );

      // 購物清單：預定購買日前 3 天內（含當天）進入提醒窗口
      const shoppingItemsExpiring3DaysList = shoppingItems
        .filter((doc) => {
          const days = daysUntil(doc.plannedDate);
          return days !== null && days >= 0 && days <= EXPIRING_3_DAYS;
        })
        .map((doc) => {
          return {
            id: doc.$id,
            name: doc.name,
            daysRemaining: daysUntil(doc.plannedDate) ?? 0,
            plannedDate: doc.plannedDate!,
            price: doc.price,
            currency: doc.currency,
          } satisfies ShoppingItemDetail;
        })
        .sort((a, b) => a.daysRemaining - b.daysRemaining);

      // 銀行／電子票證／點數：有效期限 7 天內（含當天）進入提醒窗口
      const banksExpiring7DaysList = banks
        .filter((doc) => {
          const days = daysUntil(doc.expiry);
          return days !== null && days >= 0 && days <= EXPIRING_7_DAYS;
        })
        .map((doc) => {
          return {
            id: doc.$id,
            name: doc.name,
            daysRemaining: daysUntil(doc.expiry) ?? 0,
            expiry: doc.expiry!,
            category: doc.category || "",
          } satisfies BankExpiryDetail;
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
        banksExpiring7Days: banksExpiring7DaysList.length,
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
        banksExpiring7DaysList,
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
        setResolvedMode(includeExtended);
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
  useRefreshKeyListener("bank_refresh_key", loadStats, refreshEnabled);
  useRefreshKeyListener("routine_refresh_key", loadStats, refreshEnabled && includeExtended);

  return { stats, loading: loading || resolvedMode !== includeExtended, error, setupRequired, refresh: loadStats };
}
