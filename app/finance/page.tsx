'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Activity, ExternalLink, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FinanceQuote {
  id: string;
  name: string;
  displayName: string;
  symbol: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  currency: string;
  high52: number | null;
  low52: number | null;
  lastUpdated: string;
  sourceUrl: string;
  localLabel?: string;
  periodLabel?: string;
  imageUrl?: string;
  imageUrls?: string[];
  error?: string;
}

interface FinanceData {
  quotes: FinanceQuote[];
  fetchedAt: string;
}

function getFinanceImageUrls(quote?: Pick<FinanceQuote, 'imageUrl' | 'imageUrls'> | null) {
  if (!quote) return [] as string[];
  const urls = (quote.imageUrls || []).filter((url): url is string => typeof url === 'string' && url.trim().length > 0);
  if (urls.length > 0) return Array.from(new Set(urls));
  if (quote.imageUrl && quote.imageUrl.trim()) return [quote.imageUrl];
  return [];
}

function FinanceImageCarousel({
  quote,
  alt,
}: {
  quote?: Pick<FinanceQuote, 'name' | 'imageUrl' | 'imageUrls'> | null;
  alt: string;
}) {
  const images = useMemo(() => getFinanceImageUrls(quote), [quote?.imageUrl, quote?.imageUrls]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [images.join('|')]);

  useEffect(() => {
    if (images.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % images.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [images.length]);

  if (images.length === 0) return null;

  const activeIndex = index % images.length;

  return (
    <div className="relative mt-4 aspect-[4/3] w-full overflow-hidden rounded-lg bg-slate-100 shadow-md dark:bg-slate-900">
      <img
        src={images[activeIndex]}
        alt={`${alt} ${activeIndex + 1}`}
        className="h-full w-full object-contain rounded-lg"
      />
      {images.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="上一張"
            className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white"
            onClick={() => setIndex((current) => (current - 1 + images.length) % images.length)}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="下一張"
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white"
            onClick={() => setIndex((current) => (current + 1) % images.length)}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/40 px-2 py-1">
            {images.map((url, dotIndex) => (
              <button
                key={url}
                type="button"
                aria-label={`第 ${dotIndex + 1} 張`}
                className={`h-1.5 rounded-full ${dotIndex === activeIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`}
                onClick={() => setIndex(dotIndex)}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function FinancePage() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/fengbro-finance');
      if (!response.ok) throw new Error('載入失敗');
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '發生錯誤');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 獲取特定商品的報價
  const getQuote = (id: string) => data?.quotes.find(q => q.id === id);

  // 格式化數字
  const formatNumber = (value: number | null | undefined, decimals = 2) => {
    if (value === null || value === undefined) return 'N/A';
    return value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  // 格式化變化百分比
  const formatChange = (change: number | null, changePercent: number | null) => {
    if (change === null && changePercent === null) return '';
    const changeStr = change !== null ? formatNumber(change) : '';
    const percentStr = changePercent !== null ? `(${changePercent >= 0 ? '+' : ''}${formatNumber(changePercent)}%)` : '';
    return `${changeStr} ${percentStr}`.trim();
  };

  // 判斷漲跌
  const isPositive = (value: number | null | undefined) => value != null && value > 0;
  const isNegative = (value: number | null | undefined) => value != null && value < 0;

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <RefreshCw className="w-12 h-12 animate-spin text-blue-500 mx-auto" />
            <p className="text-gray-600 dark:text-gray-400">載入金融資料中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <Button onClick={loadData} className="mt-4">
            重新載入
          </Button>
        </div>
      </div>
    );
  }

  const kospi = getQuote('kospi');
  const phlxSemi = getQuote('phlx-semiconductor');
  const tsmc = getQuote('tsmc');

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* 頁面標題 */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2">鋒兄金融</h1>
          <p className="text-muted-foreground">即時金融市場資訊 - 來自 CNBC & Yahoo Finance</p>
        </div>
        <Button onClick={loadData} variant="outline" className="flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          重新整理
        </Button>
      </div>

      {/* 更新時間 */}
      {data?.fetchedAt && (
        <div className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          最後更新: {new Date(data.fetchedAt).toLocaleString('zh-TW')}
        </div>
      )}

      {/* 第一區塊: KOSPI Index */}
      <section className="mb-8">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Activity className="w-6 h-6 text-blue-600" />
                  KOSPI Index
                </CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {kospi?.localLabel || '코스피'} • 韓國綜合股價指數 • 6000點以上不再製作AI圖片與AI影片
                </p>
              </div>
              {kospi?.sourceUrl && (
                <a
                  href={kospi.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  <ExternalLink className="w-5 h-5" />
                </a>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {kospi?.error ? (
              <div className="text-red-600 dark:text-red-400">
                載入失敗: {kospi.error}
              </div>
            ) : (
              <div className="space-y-4">
                {/* 當前價格 */}
                <div className="flex items-baseline gap-3">
                  <div className="text-5xl font-bold text-blue-600 dark:text-blue-400">
                    {formatNumber(kospi?.price, 2)}
                  </div>
                  {kospi?.currency && (
                    <div className="text-lg text-gray-500">{kospi.currency}</div>
                  )}
                </div>

                {/* 漲跌資訊 */}
                {(kospi?.change !== null || kospi?.changePercent !== null) && (
                  <div className={`flex items-center gap-2 text-lg font-semibold ${
                    isPositive(kospi?.change) 
                      ? 'text-green-600 dark:text-green-400' 
                      : isNegative(kospi?.change)
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {isPositive(kospi?.change) ? (
                      <TrendingUp className="w-5 h-5" />
                    ) : isNegative(kospi?.change) ? (
                      <TrendingDown className="w-5 h-5" />
                    ) : null}
                    <span>{formatChange(kospi?.change ?? null, kospi?.changePercent ?? null)}</span>
                  </div>
                )}

                {/* 52週高低點 */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-blue-200 dark:border-blue-800">
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">52週最高</div>
                    <div className="flex items-end gap-2">
                      <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                        {formatNumber(kospi?.high52)}
                      </div>
                      {typeof kospi?.price === 'number' && typeof kospi?.high52 === 'number' && (
                        <div className={`text-sm font-semibold mb-0.5 ${kospi.price >= kospi.high52 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {kospi.price >= kospi.high52 ? '+' : ''}{((kospi.price - kospi.high52) / kospi.high52 * 100).toFixed(2)}%
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">52週最低</div>
                    <div className="flex items-end gap-2">
                      <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                        {formatNumber(kospi?.low52)}
                      </div>
                      {typeof kospi?.price === 'number' && typeof kospi?.low52 === 'number' && kospi.low52 > 0 && (
                        <div className={`text-sm font-semibold mb-0.5 ${kospi.price >= kospi.low52 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {kospi.price >= kospi.low52 ? '+' : ''}{((kospi.price - kospi.low52) / kospi.low52 * 100).toFixed(2)}%
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 額外資訊 */}
                {kospi?.periodLabel && (
                  <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <div className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      預測週期: {kospi.periodLabel}
                    </div>
                  </div>
                )}

                {/* 圖片輪播 */}
                <FinanceImageCarousel quote={kospi} alt="KOSPI Index Chart" />
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* 第二區塊: 費城半導體指數 */}
      <section className="mb-8">
        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border-purple-200 dark:border-purple-800">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Activity className="w-6 h-6 text-purple-600" />
                  費城半導體指數
                </CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {phlxSemi?.localLabel || 'Philadelphia Semiconductor Index'} • SOX
                </p>
              </div>
              {phlxSemi?.sourceUrl && (
                <a
                  href={phlxSemi.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-600 hover:text-purple-700 dark:text-purple-400"
                >
                  <ExternalLink className="w-5 h-5" />
                </a>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {phlxSemi?.error ? (
              <div className="text-red-600 dark:text-red-400">
                載入失敗: {phlxSemi.error}
              </div>
            ) : (
              <div className="space-y-4">
                {/* 當前價格 */}
                <div className="flex items-baseline gap-3">
                  <div className="text-5xl font-bold text-purple-600 dark:text-purple-400">
                    {formatNumber(phlxSemi?.price, 2)}
                  </div>
                  {phlxSemi?.currency && (
                    <div className="text-lg text-gray-500">{phlxSemi.currency}</div>
                  )}
                </div>

                {/* 漲跌資訊 */}
                {(phlxSemi?.change !== null || phlxSemi?.changePercent !== null) && (
                  <div className={`flex items-center gap-2 text-lg font-semibold ${
                    isPositive(phlxSemi?.change) 
                      ? 'text-green-600 dark:text-green-400' 
                      : isNegative(phlxSemi?.change)
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {isPositive(phlxSemi?.change) ? (
                      <TrendingUp className="w-5 h-5" />
                    ) : isNegative(phlxSemi?.change) ? (
                      <TrendingDown className="w-5 h-5" />
                    ) : null}
                    <span>{formatChange(phlxSemi?.change ?? null, phlxSemi?.changePercent ?? null)}</span>
                  </div>
                )}

                {/* 52週高低點 */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-purple-200 dark:border-purple-800">
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">52週最高</div>
                    <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                      {formatNumber(phlxSemi?.high52)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">52週最低</div>
                    <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                      {formatNumber(phlxSemi?.low52)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* 第三區塊: 台積電 */}
      <section className="mb-8">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Activity className="w-6 h-6 text-green-600" />
                  台積電
                </CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Taiwan Semiconductor Manufacturing Company • 2330.TW
                </p>
              </div>
              {tsmc?.sourceUrl && (
                <a
                  href={tsmc.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-600 hover:text-green-700 dark:text-green-400"
                >
                  <ExternalLink className="w-5 h-5" />
                </a>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {tsmc?.error ? (
              <div className="text-red-600 dark:text-red-400">
                載入失敗: {tsmc.error}
              </div>
            ) : (
              <div className="space-y-4">
                {/* 當前價格 */}
                <div className="flex items-baseline gap-3">
                  <div className="text-5xl font-bold text-green-600 dark:text-green-400">
                    {formatNumber(tsmc?.price, 2)}
                  </div>
                  {tsmc?.currency && (
                    <div className="text-lg text-gray-500">{tsmc.currency}</div>
                  )}
                </div>

                {/* 漲跌資訊 */}
                {(tsmc?.change !== null || tsmc?.changePercent !== null) && (
                  <div className={`flex items-center gap-2 text-lg font-semibold ${
                    isPositive(tsmc?.change) 
                      ? 'text-green-600 dark:text-green-400' 
                      : isNegative(tsmc?.change)
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {isPositive(tsmc?.change) ? (
                      <TrendingUp className="w-5 h-5" />
                    ) : isNegative(tsmc?.change) ? (
                      <TrendingDown className="w-5 h-5" />
                    ) : null}
                    <span>{formatChange(tsmc?.change ?? null, tsmc?.changePercent ?? null)}</span>
                  </div>
                )}

                {/* 52週高低點 */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-green-200 dark:border-green-800">
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">52週最高</div>
                    <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                      {formatNumber(tsmc?.high52)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">52週最低</div>
                    <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                      {formatNumber(tsmc?.low52)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* 頁尾資訊 */}
      <div className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>資料來源: CNBC & Yahoo Finance</p>
        <p className="mt-2">本資訊僅供參考,不構成投資建議</p>
      </div>
    </div>
  );
}
