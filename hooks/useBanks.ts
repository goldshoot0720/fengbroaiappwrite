"use client";

import { useState, useEffect, useCallback } from "react";
import { Bank, BankFormData } from "@/types";
import { API_ENDPOINTS } from "@/lib/constants";
import { fetchApi } from "@/hooks/useApi";

export function useBanks() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 載入銀行資料（不使用快取）
  const loadBanks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resData = await fetchApi<Bank[]>(`/api/bank?t=${Date.now()}`);
      let data: Bank[] = Array.isArray(resData) ? resData : [];
      // 按名稱排序
      data = data.sort((a, b) => a.name.localeCompare(b.name));
      
      setBanks(data);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "載入銀行資料失敗";
      setError(message);
      console.error("載入銀行資料失敗:", err);
      return [];
    } finally {
      setLoading(false);
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
      // 重新載入以確保資料同步
      await loadBanks();
      return newBank;
    } catch (err) {
      console.error("新增銀行失敗:", err);
      throw err;
    }
  }, [loadBanks]);

  // 更新銀行
  const updateBank = useCallback(async (id: string, formData: BankFormData): Promise<Bank | null> => {
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
      
      const updatedBank = await fetchApi<Bank>(`${API_ENDPOINTS.BANK}/${id}`, {
        method: "PUT",
        body: JSON.stringify(sanitizedData),
      });
      // 重新載入以確保資料同步
      await loadBanks();
      return updatedBank;
    } catch (err) {
      console.error("更新銀行失敗:", err);
      throw err;
    }
  }, [loadBanks]);

  // 刪除銀行
  const deleteBank = useCallback(async (id: string): Promise<boolean> => {
    try {
      await fetchApi(`${API_ENDPOINTS.BANK}/${id}`, { method: "DELETE" });
      
      // 重新載入以確保資料同步
      await loadBanks();
      return true;
    } catch (err) {
      console.error("刪除銀行失敗:", err);
      throw err;
    }
  }, [loadBanks]);

  // 初始載入
  useEffect(() => {
    loadBanks();
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
