'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FinanceData {
  quotes: unknown[];
  fetchedAt: string;
}

export default function FinancePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 預設精選標的已清空；仍打 API 確認連線，頁面僅顯示狀態說明。
      const params = new URLSearchParams({
        defaults: JSON.stringify([]),
        skipHistory: '1',
      });
      const response = await fetch(`/api/fengbro-finance?${params.toString()}`);
      if (!response.ok) throw new Error('載入失敗');
      const result = (await response.json()) as FinanceData;
      setFetchedAt(result.fetchedAt || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '發生錯誤');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="space-y-4 text-center">
            <RefreshCw className="mx-auto h-12 w-12 animate-spin text-blue-500" />
            <p className="text-gray-600 dark:text-gray-400">載入金融資料中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <Button onClick={() => void loadData()} className="mt-4">
            重新載入
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="mb-2 text-4xl font-bold">鋒兄金融</h1>
          <p className="text-muted-foreground">即時金融市場資訊 - 來自 CNBC & Yahoo Finance</p>
        </div>
        <Button onClick={() => void loadData()} variant="outline" className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          重新整理
        </Button>
      </div>

      {fetchedAt && (
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          最後更新: {new Date(fetchedAt).toLocaleString('zh-TW')}
        </p>
      )}

      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900/40">
        <p className="text-base font-medium text-foreground">目前沒有預設精選標的</p>
        <p className="mt-2 text-sm text-muted-foreground">
          KOSPI Index 等預設標的已移除。請至「鋒兄工具 → 鋒兄金融」新增或追蹤你要的指數與股票。
        </p>
      </div>

      <div className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>資料來源: CNBC, Yahoo Finance & Investing.com</p>
        <p className="mt-2">本資訊僅供參考,不構成投資建議</p>
      </div>
    </div>
  );
}
