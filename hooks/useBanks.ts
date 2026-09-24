"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Bank, BankFormData } from "@/types";
import { API_ENDPOINTS } from "@/lib/constants";
import { fetchApi } from "@/hooks/useApi";
import { bumpRefreshKey } from "@/hooks/useRefreshKey";
import { readMemoryList, writeMemoryList } from "@/lib/memoryListCache";
import { createWriteTracker, patchItem, removeItem, replaceItem, restoreItem, upsertItem } from "@/lib/optimisticList";

const BANK_REFRESH_KEY = "bank_refresh_key";

/** 按存款金額由高至低排序 */
function sortBanks(list: Bank[]): Bank[] {
  return list.sort((a, b) => (b.deposit || 0) - (a.deposit || 0));
}

export function useBanks() {
  // 切換選單回來時直接用記憶體快取上畫，不再整頁載入。
  const [banks, setBanks] = useState<Bank[]>(
    () => readMemoryList<Bank>(API_ENDPOINTS.BANK, BANK_REFRESH_KEY)?.data ?? []
  );
  const [loading, setLoading] = useState(() => !readMemoryList<Bank>(API_ENDPOINTS.BANK, BANK_REFRESH_KEY));
  const [error, setError] = useState<string | null>(null);
  const tracker = useRef(createWriteTracker()).current;

  /** 本地清單更新後維持排序；寫入不再整張表重抓。 */
  const commit = useCallback((updater: (prev: Bank[]) => Bank[]) => {
    setBanks((prev) => {
      const next = sortBanks(updater(prev));
      writeMemoryList(API_ENDPOINTS.BANK, next);
      return next;
    });
  }, []);

  // 載入銀行資料（不使用快取）；silent 時保留目前畫面，不閃載入狀態。
  const loadBanks = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      // 檢查 Appwrite 配置是否存在
      if (typeof window !== 'undefined') {
        const endpoint = localStorage.getItem('NEXT_PUBLIC_APPWRITE_ENDPOINT') || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
        const projectId = localStorage.getItem('NEXT_PUBLIC_APPWRITE_PROJECT_ID') || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
        const databaseId = localStorage.getItem('APPWRITE_DATABASE_ID') || process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
        
        if (!endpoint || !projectId || !databaseId) {
          throw new Error("Appwrite 配置不完整，請至「鋒兄設定」中完成設定");
        }
      }
      
      const resData = await fetchApi<Bank[]>(`/api/bank?t=${Date.now()}`);
      const data = sortBanks(Array.isArray(resData) ? resData : []);
      writeMemoryList(API_ENDPOINTS.BANK, data);
      setBanks(data);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "載入銀行資料失敗";
      setError(message);
      console.error("載入銀行資料失敗:", err);
      return [];
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // 新增銀行
  const createBank = useCallback(async (formData: BankFormData): Promise<Bank | null> => {
    try {
      // 清理 URL 欄位，空值或非 URL 格式處理為 null
      const sanitizedData = { ...formData };
      if (!sanitizedData.activity || sanitizedData.activity.trim() === '') {
        delete (sanitizedData as any).activity; // 刪除空值以避免驗證錯誤
      }
      if (!sanitizedData.site || sanitizedData.site.trim() === '') {
        delete (sanitizedData as any).site; // 刪除空值以避免驗證錯誤
      }
      
      const newBank = await fetchApi<Bank>(API_ENDPOINTS.BANK, {
        method: "POST",
        body: JSON.stringify(sanitizedData),
      });
      // 伺服器回傳即完整資料，直接插入本地清單。
      commit((prev) => upsertItem(prev, newBank));
      bumpRefreshKey(BANK_REFRESH_KEY);
      return newBank;
    } catch (err) {
      console.error("新增銀行失敗:", err);
      throw err;
    }
  }, [commit]);

  // 更新銀行
  const updateBank = useCallback(async (id: string, formData: BankFormData): Promise<Bank | null> => {
    const token = tracker.begin(id);
    let previous: Bank | undefined;
    try {
      // 對於更新操作，保留空字串以便清除欄位內容
      const sanitizedData = { ...formData };
      
      // 僅對 activity 進行 URL 驗證檢查（Appwrite 要求 URL 格式）
      // 空字串可以用於清除現有值
      if (sanitizedData.activity && sanitizedData.activity.trim() !== '') {
        // 有值時保留
      } else {
        // 空字串保留，讓後端清除該欄位
        sanitizedData.activity = '';
      }
      
      // site 欄位允許空字串以清除內容
      if (sanitizedData.site === undefined || sanitizedData.site === null) {
        sanitizedData.site = '';
      }
      
      // 樂觀更新：先改畫面，伺服器回應後再換成正式資料，失敗回滾。
      commit((prev) => {
        const patched = patchItem(prev, id, sanitizedData as Partial<Bank>);
        previous = patched.previous;
        return patched.list;
      });

      const updatedBank = await fetchApi<Bank>(`${API_ENDPOINTS.BANK}/${id}`, {
        method: "PUT",
        body: JSON.stringify(sanitizedData),
      });
      if (tracker.isLatest(id, token)) commit((prev) => replaceItem(prev, id, updatedBank));
      bumpRefreshKey(BANK_REFRESH_KEY);
      return updatedBank;
    } catch (err) {
      console.error("更新銀行失敗:", err);
      if (tracker.isLatest(id, token)) commit((prev) => replaceItem(prev, id, previous));
      throw err;
    } finally {
      tracker.finish(id, token);
    }
  }, [commit, tracker]);

  // 刪除銀行
  const deleteBank = useCallback(async (id: string): Promise<boolean> => {
    // 樂觀刪除：先從畫面移除，失敗再放回原位。
    let removed: Bank | undefined;
    let index = -1;
    commit((prev) => {
      const result = removeItem(prev, id);
      removed = result.removed;
      index = result.index;
      return result.list;
    });
    try {
      await fetchApi(`${API_ENDPOINTS.BANK}/${id}`, { method: "DELETE" });
      bumpRefreshKey(BANK_REFRESH_KEY);
      return true;
    } catch (err) {
      console.error("刪除銀行失敗:", err);
      commit((prev) => restoreItem(prev, removed, index));
      throw err;
    }
  }, [commit]);

  // 初始載入：快取還新鮮就不打 Appwrite；舊了就先顯示快取、背景靜默更新。
  useEffect(() => {
    const cached = readMemoryList<Bank>(API_ENDPOINTS.BANK, BANK_REFRESH_KEY);
    if (cached?.fresh) return;
    void loadBanks(!!cached);
  }, [loadBanks]);

  // 計算統計資料
  const stats = {
    total: Array.isArray(banks) ? banks.length : 0,
    totalDeposit: Array.isArray(banks) ? banks.reduce((sum, b) => sum + (b.deposit || 0), 0) : 0,
  };

  return {
    banks,
    loading,
    error,
    stats,
    loadBanks,
    createBank,
    updateBank,
    deleteBank,
  };
}
