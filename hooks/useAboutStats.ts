"use client";

import { useEffect, useState } from "react";
import { fetchApi } from "@/hooks/useApi";
import { API_ENDPOINTS } from "@/lib/constants";

interface SiteVisitStats {
  count: number;
  currentStreak: number;
  lastVisitAt: string | null;
  lastVisitDate: string | null;
  exists: boolean;
  error?: string;
}

export interface MenuUsageItem {
  moduleId: string;
  count: number;
  lastUsedAt: string | null;
}

interface MenuUsageStats {
  items: MenuUsageItem[];
  exists: boolean;
  error?: string;
}

/**
 * 鋒兄關於頁用的統計資料：進站人次、連續進站天數、選單使用次數與頻率。
 * 純讀取，不會送出到站/選單使用紀錄（那部分由 app/page.tsx 在導覽時另外呼叫）。
 */
export function useAboutStats() {
  const [siteVisit, setSiteVisit] = useState<SiteVisitStats | null>(null);
  const [menuUsage, setMenuUsage] = useState<MenuUsageStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [visit, usage] = await Promise.all([
        fetchApi<SiteVisitStats>(API_ENDPOINTS.SITE_VISIT).catch((err) => ({
          count: 0,
          currentStreak: 0,
          lastVisitAt: null,
          lastVisitDate: null,
          exists: false,
          error: err instanceof Error ? err.message : "載入失敗",
        })),
        fetchApi<MenuUsageStats>(API_ENDPOINTS.MENU_USAGE).catch((err) => ({
          items: [],
          exists: false,
          error: err instanceof Error ? err.message : "載入失敗",
        })),
      ]);

      if (cancelled) return;
      setSiteVisit(visit);
      setMenuUsage(usage);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { siteVisit, menuUsage, loading };
}
