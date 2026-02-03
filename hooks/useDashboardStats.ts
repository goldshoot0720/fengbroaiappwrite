"use client";

import { useState, useEffect } from "react";
import { convertToTWD } from "@/lib/formatters";
import { fetchApi } from "@/hooks/useApi";

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
  // 詳細項目列表
  foodsExpiring7DaysList: FoodDetail[];
  foodsExpiring30DaysList: FoodDetail[];
  expiredFoodsList: FoodDetail[];
  subscriptionsExpiring3DaysList: SubscriptionDetail[];
  subscriptionsExpiring7DaysList: SubscriptionDetail[];
  overdueSubscriptionsList: SubscriptionDetail[];
}

// 不使用快取，每次都重新載入

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats>({
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
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      // 不使用快取，每次都重新載入
      const cacheParam = `?t=${Date.now()}`;

      setError(null);
      try {
        const errors: string[] = [];
        
        // 檢查所有表是否存在
        const tablesToCheck = [
          { name: 'article', api: '/api/article', label: 'Table article' },
          { name: 'bank', api: '/api/bank', label: 'Table bank' },
          { name: 'commonaccount', api: '/api/commonaccount', label: 'Table commonaccount' },
          { name: 'food', api: '/api/food', label: 'Table food' },
          { name: 'image', api: '/api/image', label: 'Table image' },
          { name: 'music', api: '/api/music', label: 'Table music' },
          { name: 'podcast', api: '/api/podcast', label: 'Table podcast' },
          { name: 'commondocument', api: '/api/commondocument', label: 'Table commondocument' },
          { name: 'routine', api: '/api/routine', label: 'Table routine' },
          { name: 'subscription', api: '/api/subscription', label: 'Table subscription' },
          { name: 'video', api: '/api/video', label: 'Table video' },
        ];

        // 並行檢查所有表
        const checkPromises = tablesToCheck.map(async (table) => {
          try {
            await fetchApi<any[]>(table.api + cacheParam);
            return null;
          } catch (err) {
            const message = err instanceof Error ? err.message : '';
            if (message.includes('不存在')) {
              return message;
            }
            return null;
          }
        });

        const checkResults = await Promise.all(checkPromises);
        const tableErrors = checkResults.filter(err => err !== null) as string[];
        
        if (tableErrors.length > 0) {
          throw new Error(tableErrors.join('\n'));
        }
        
        // 獲取食品數據（使用快取）
        let foods: Food[] = [];
        try {
          const foodsData = await fetchApi<Food[]>("/api/food" + cacheParam);
          foods = Array.isArray(foodsData) ? foodsData : [];
        } catch (err) {
          console.error('Failed to load foods:', err);
        }

        // 獲取訂閱數據（使用快取）
        let subscriptions: Subscription[] = [];
        try {
          const subsData = await fetchApi<Subscription[]>("/api/subscription" + cacheParam);
          subscriptions = Array.isArray(subsData) ? subsData : [];
        } catch (err) {
          console.error('Failed to load subscriptions:', err);
        }

        // 獲取筆記數據（使用快取）
        let articles: any[] = [];
        try {
          const articlesData = await fetchApi<any[]>("/api/article" + cacheParam);
          articles = Array.isArray(articlesData) ? articlesData : [];
        } catch (err) {
          console.error('Failed to load articles:', err);
        }

        // 獲取常用帳號數據（使用快取）
        let commonAccounts: any[] = [];
        try {
          const commonAccountsData = await fetchApi<any[]>("/api/commonaccount" + cacheParam);
          commonAccounts = Array.isArray(commonAccountsData) ? commonAccountsData : [];
        } catch (err) {
          console.error('Failed to load common accounts:', err);
        }

        // 獲取銀行數據（使用快取）
        let banks: any[] = [];
        try {
          const banksData = await fetchApi<any[]>("/api/bank" + cacheParam);
          banks = Array.isArray(banksData) ? banksData : [];
        } catch (err) {
          console.error('Failed to load banks:', err);
        }

        // 獲取例行數據（使用快取）
        let routines: any[] = [];
        try {
          const routinesData = await fetchApi<any[]>("/api/routine" + cacheParam);
          routines = Array.isArray(routinesData) ? routinesData : [];
        } catch (err) {
          console.error('Failed to load routines:', err);
        }

        const today = new Date();
        const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
        const threeDaysFromNow = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);

        // 計算食品統計和詳細列表
        const foodsToProcess = Array.isArray(foods) ? foods : [];
        const foodsExpiring7DaysList: FoodDetail[] = foodsToProcess
          .filter(food => {
            const expireDate = new Date(food.todate);
            return expireDate <= sevenDaysFromNow && expireDate >= today;
          })
          .map(food => {
            const expireDate = new Date(food.todate);
            const daysRemaining = Math.ceil((expireDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            return {
              id: food.$id,
              name: food.name,
              daysRemaining,
              expireDate: food.todate
            };
          })
          .sort((a, b) => a.daysRemaining - b.daysRemaining);

        const foodsExpiring30DaysList: FoodDetail[] = foodsToProcess
          .filter(food => {
            const expireDate = new Date(food.todate);
            return expireDate <= thirtyDaysFromNow && expireDate >= today;
          })
          .map(food => {
            const expireDate = new Date(food.todate);
            const daysRemaining = Math.ceil((expireDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            return {
              id: food.$id,
              name: food.name,
              daysRemaining,
              expireDate: food.todate
            };
          })
          .sort((a, b) => a.daysRemaining - b.daysRemaining);

        const expiredFoodsList: FoodDetail[] = foodsToProcess
          .filter(food => {
            const expireDate = new Date(food.todate);
            return expireDate < today;
          })
          .map(food => {
            const expireDate = new Date(food.todate);
            const daysRemaining = Math.floor((expireDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            return {
              id: food.$id,
              name: food.name,
              daysRemaining,
              expireDate: food.todate
            };
          })
          .sort((a, b) => a.daysRemaining - b.daysRemaining);

        // 計算訂閱統計和詳細列表（排除無日期的訂閱）
        const subsToProcess = Array.isArray(subscriptions) ? subscriptions : [];
        const subscriptionsExpiring3DaysList: SubscriptionDetail[] = subsToProcess
          .filter(sub => {
            if (!sub.nextdate) return false; // 排除無日期
            const nextDate = new Date(sub.nextdate);
            return nextDate <= threeDaysFromNow && nextDate >= today;
          })
          .map(sub => {
            const nextDate = new Date(sub.nextdate);
            const daysRemaining = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            return {
              id: sub.$id,
              name: sub.name,
              site: sub.site,
              daysRemaining,
              nextDate: sub.nextdate,
              price: sub.price
            };
          })
          .sort((a, b) => a.daysRemaining - b.daysRemaining);

        const subscriptionsExpiring7DaysList: SubscriptionDetail[] = subsToProcess
          .filter(sub => {
            if (!sub.nextdate) return false; // 排除無日期
            const nextDate = new Date(sub.nextdate);
            return nextDate <= sevenDaysFromNow && nextDate >= today;
          })
          .map(sub => {
            const nextDate = new Date(sub.nextdate);
            const daysRemaining = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            return {
              id: sub.$id,
              name: sub.name,
              site: sub.site,
              daysRemaining,
              nextDate: sub.nextdate,
              price: sub.price
            };
          })
          .sort((a, b) => a.daysRemaining - b.daysRemaining);

        const overdueSubscriptionsList: SubscriptionDetail[] = subsToProcess
          .filter(sub => {
            if (!sub.nextdate) return false; // 排除無日期
            const nextDate = new Date(sub.nextdate);
            return nextDate < today;
          })
          .map(sub => {
            const nextDate = new Date(sub.nextdate);
            const daysRemaining = Math.floor((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            return {
              id: sub.$id,
              name: sub.name,
              site: sub.site,
              daysRemaining,
              nextDate: sub.nextdate,
              price: sub.price
            };
          })
          .sort((a, b) => a.daysRemaining - b.daysRemaining);

        const totalMonthlyFee = subsToProcess.reduce((total, sub) => total + convertToTWD(sub.price, sub.currency), 0);
        
        // 計算年費總計 (所有訂閱服務費用總和，換算成台幣)
        const totalAnnualFee = subsToProcess.reduce((total, sub) => total + convertToTWD(sub.price, sub.currency), 0);
        
        // 計算銀行總存款
        const totalBankDeposit = banks.reduce((total, bank) => total + (bank.deposit || 0), 0);

        const newStats = {
          totalFoods: foodsToProcess.length,
          totalSubscriptions: subsToProcess.length,
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
        };
              
        setStats(newStats);
      } catch (error) {
        console.error("獲取統計數據失敗:", error);
        setError(error instanceof Error ? error.message : "獲取統計數據失敗");
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  return { stats, loading, error };
}