'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Activity, ExternalLink, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isKospiMarketOpen, KOSPI_LIVE_POLL_MS } from '@/lib/kospiMarketHours';

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
  /** Horizontal reference levels (e.g. 融資平均水平線). */
  referenceLevels?: Array<{ value: number; label: string }>;
  imageUrl?: string;
  imageUrls?: string[];
  marketSession?: "pre" | "regular" | "post" | "closed" | "";
  marketState?: string;
  preMarketPrice?: number | null;
  preMarketChange?: number | null;
  preMarketChangePercent?: number | null;
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

const FINANCE_IMAGE_SLIDE_MS = 4500;
/** If video metadata never loads / autoplay never starts, skip after this. */
const FINANCE_VIDEO_STALL_MS = 12_000;
/** Extra buffer after known duration before force-advance. */
const FINANCE_VIDEO_END_BUFFER_MS = 2_000;
/** Hard cap so a broken duration cannot hang the carousel. */
const FINANCE_VIDEO_MAX_MS = 180_000;

function isFinanceMediaVideo(url?: string | null) {
  if (!url) return false;
  const path = url.split('?')[0]?.toLowerCase() || '';
  return path.endsWith('.mp4') || path.endsWith('.webm') || path.endsWith('.mov');
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
  const imagesKey = images.join('|');
  const mediaAdvanceLockRef = useRef(false);
  const videoFallbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setIndex(0);
  }, [imagesKey]);

  const activeIndex = images.length > 0 ? index % images.length : 0;
  const activeUrl = images[activeIndex];
  const isVideo = isFinanceMediaVideo(activeUrl);

  const clearVideoFallback = useCallback(() => {
    if (videoFallbackTimerRef.current != null) {
      window.clearTimeout(videoFallbackTimerRef.current);
      videoFallbackTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    mediaAdvanceLockRef.current = false;
    clearVideoFallback();
  }, [activeUrl, clearVideoFallback]);

  const advance = useCallback(() => {
    setIndex((current) => (images.length > 0 ? (current + 1) % images.length : 0));
  }, [images.length]);

  /** Media-driven advance (ended/error/fallback): at most once per active slide. */
  const advanceFromMedia = useCallback(() => {
    if (mediaAdvanceLockRef.current || images.length <= 1) return;
    mediaAdvanceLockRef.current = true;
    clearVideoFallback();
    advance();
  }, [advance, clearVideoFallback, images.length]);

  const scheduleVideoFallback = useCallback(
    (ms: number) => {
      clearVideoFallback();
      const capped = Math.min(Math.max(ms, FINANCE_VIDEO_STALL_MS), FINANCE_VIDEO_MAX_MS);
      videoFallbackTimerRef.current = window.setTimeout(advanceFromMedia, capped);
    },
    [advanceFromMedia, clearVideoFallback],
  );

  // Images: fixed interval. Videos: prefer onEnded; stall/duration fallbacks prevent freeze.
  useEffect(() => {
    if (images.length <= 1) return;

    if (isVideo) {
      scheduleVideoFallback(FINANCE_VIDEO_STALL_MS);
      return () => clearVideoFallback();
    }

    const timer = window.setInterval(advance, FINANCE_IMAGE_SLIDE_MS);
    return () => window.clearInterval(timer);
  }, [images.length, isVideo, activeUrl, advance, scheduleVideoFallback, clearVideoFallback]);

  if (images.length === 0) return null;

  return (
    <div className="relative mt-4 aspect-[4/3] w-full overflow-hidden rounded-lg bg-slate-100 shadow-md dark:bg-slate-900">
      {isVideo ? (
        <video
          key={activeUrl}
          src={activeUrl}
          className="h-full w-full object-contain rounded-lg"
          autoPlay
          muted
          playsInline
          preload="auto"
          onLoadedMetadata={(event) => {
            const durationSec = event.currentTarget.duration;
            if (Number.isFinite(durationSec) && durationSec > 0) {
              scheduleVideoFallback(durationSec * 1000 + FINANCE_VIDEO_END_BUFFER_MS);
            }
          }}
          onEnded={advanceFromMedia}
          onError={advanceFromMedia}
        />
      ) : (
        <img
          key={activeUrl}
          src={activeUrl}
          alt={`${alt} ${activeIndex + 1}`}
          className="h-full w-full object-contain rounded-lg"
          onError={advanceFromMedia}
        />
      )}
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
            onClick={advance}
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
  const [kospiLiveOpen, setKospiLiveOpen] = useState(false);
  const [kospiLiveRefreshing, setKospiLiveRefreshing] = useState(false);
  const [kospiLiveUpdatedAt, setKospiLiveUpdatedAt] = useState<string | null>(null);
  const kospiLiveInFlightRef = useRef(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Only the cards shown on this page — parallel quote fetch, no chart history.
      const params = new URLSearchParams({
        defaults: JSON.stringify([
          'kospi',
        ]),
        skipHistory: '1',
      });
      const response = await fetch(`/api/fengbro-finance?${params.toString()}`);
      if (!response.ok) throw new Error('載入失敗');
      const result = await response.json() as FinanceData;
      setData(result);
      setKospiLiveUpdatedAt(result.fetchedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : '發生錯誤');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshKospiLive = useCallback(async () => {
    if (kospiLiveInFlightRef.current) return;
    if (!isKospiMarketOpen()) return;

    kospiLiveInFlightRef.current = true;
    setKospiLiveRefreshing(true);
    try {
      const params = new URLSearchParams({
        defaults: JSON.stringify(['kospi']),
        skipHistory: '1',
      });
      const response = await fetch(`/api/fengbro-finance?${params.toString()}`);
      if (!response.ok) throw new Error('KOSPI 更新失敗');
      const result = await response.json() as FinanceData;
      const kospiQuote = result.quotes.find((quote) => quote.id === 'kospi');
      if (!kospiQuote) return;

      // Never seed the page with a KOSPI-only live payload (would hide other cards).
      let applied = false;
      setData((previous) => {
        if (!previous) return previous;
        applied = true;
        return {
          ...previous,
          fetchedAt: result.fetchedAt,
          quotes: previous.quotes.map((quote) =>
            quote.id === 'kospi'
              ? {
                  ...kospiQuote,
                  imageUrl: quote.imageUrl || kospiQuote.imageUrl,
                  imageUrls: quote.imageUrls?.length ? quote.imageUrls : kospiQuote.imageUrls,
                  periodLabel: quote.periodLabel || kospiQuote.periodLabel,
                  localLabel: quote.localLabel || kospiQuote.localLabel,
                  referenceLevels: quote.referenceLevels?.length
                    ? quote.referenceLevels
                    : kospiQuote.referenceLevels,
                }
              : quote
          ),
        };
      });
      if (applied) setKospiLiveUpdatedAt(result.fetchedAt);
    } catch {
      // Silent live poll failures.
    } finally {
      kospiLiveInFlightRef.current = false;
      setKospiLiveRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const syncOpen = () => setKospiLiveOpen(isKospiMarketOpen());
    syncOpen();
    const clockTimer = window.setInterval(syncOpen, 15_000);
    return () => window.clearInterval(clockTimer);
  }, []);

  useEffect(() => {
    const tick = () => {
      if (isKospiMarketOpen()) void refreshKospiLive();
    };
    const startTimer = window.setTimeout(tick, 2_000);
    const pollTimer = window.setInterval(tick, KOSPI_LIVE_POLL_MS);
    return () => {
      window.clearTimeout(startTimer);
      window.clearInterval(pollTimer);
    };
  }, [refreshKospiLive]);

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

  /** 現價相對 52 週高點回檔 ≥ 20% 標註熊市。 */
  const isBearMarketFrom52WHigh = (
    price: number | null | undefined,
    high52: number | null | undefined
  ) => {
    if (typeof price !== 'number' || typeof high52 !== 'number') return false;
    if (!(high52 > 0) || !Number.isFinite(price) || !Number.isFinite(high52)) return false;
    return ((high52 - price) / high52) * 100 >= 20;
  };

  const bearMarketBadge = (
    <span className="ml-2 rounded-full border border-stone-300 bg-stone-900 px-2 py-0.5 text-sm font-bold text-stone-50 dark:border-stone-600 dark:bg-stone-100 dark:text-stone-900">
      熊市
    </span>
  );

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

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* 頁面標題 */}
      <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl font-bold mb-2">鋒兄金融</h1>
          <p className="text-muted-foreground">即時金融市場資訊 - 來自 CNBC & Yahoo Finance</p>
          <p className="mt-1 text-sm text-sky-700 dark:text-sky-400">
            KOSPI：週一至週五 09:00–15:30（首爾時間）每分鐘自動更新
            {kospiLiveOpen ? ' · 交易中' : ' · 目前休市'}
          </p>
        </div>
        <Button onClick={() => void loadData()} variant="outline" className="flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${loading || kospiLiveRefreshing ? 'animate-spin' : ''}`} />
          重新整理
        </Button>
      </div>

      {/* 更新時間 */}
      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
        {data?.fetchedAt && (
          <span>最後更新: {new Date(data.fetchedAt).toLocaleString('zh-TW')}</span>
        )}
        {kospiLiveOpen && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
            <span className={`h-1.5 w-1.5 rounded-full bg-sky-500 ${kospiLiveRefreshing ? 'animate-pulse' : ''}`} />
            KOSPI 即時
            {kospiLiveUpdatedAt
              ? ` · ${new Date(kospiLiveUpdatedAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
              : ''}
          </span>
        )}
      </div>

      {/* 精選標的：同時並排同步顯示（不再先 KOSPI 再其他） */}
      <div className="mb-8 grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 xl:grid-cols-3">
      {/* KOSPI Index */}
      <section className="min-w-0">
        <Card className="h-full bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="text-xl flex flex-wrap items-center gap-2">
                  <Activity className="w-5 h-5 shrink-0 text-blue-600" />
                  KOSPI Index
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                      kospiLiveOpen
                        ? 'border-sky-200 bg-sky-100 text-sky-800 dark:border-sky-800 dark:bg-sky-900/50 dark:text-sky-300'
                        : 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {kospiLiveOpen
                      ? kospiLiveRefreshing
                        ? '即時更新中…'
                        : '即時 · 每分鐘'
                      : '休市'}
                  </span>
                </CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {kospi?.localLabel || '코스피'} • 韓國綜合股價指數 • 週一至週五 09:00–15:30 每分鐘更新
                </p>
              </div>
              {kospi?.sourceUrl && (
                <a
                  href={kospi.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-blue-600 hover:text-blue-700 dark:text-blue-400"
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
                  <div className="text-4xl font-bold tabular-nums text-blue-600 dark:text-blue-400">
                    {formatNumber(kospi?.price, 2)}
                  </div>
                  {kospi?.currency && (
                    <div className="text-lg text-gray-500">{kospi.currency}</div>
                  )}
                </div>

                {/* 漲跌資訊 */}
                {(kospi?.change !== null || kospi?.changePercent !== null) && (
                  <div className={`flex flex-wrap items-center gap-2 text-base font-semibold ${
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
                    {isBearMarketFrom52WHigh(kospi?.price, kospi?.high52) && bearMarketBadge}
                    {typeof kospi?.changePercent === 'number' && Math.abs(kospi.changePercent) > 8 && (
                      <span className="rounded-full border border-orange-200 bg-orange-100 px-2 py-0.5 text-sm font-bold text-orange-700 dark:border-orange-900 dark:bg-orange-900/50 dark:text-orange-400">
                        熔斷機制
                      </span>
                    )}
                  </div>
                )}

                {/* 52週高低點 */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-blue-200 dark:border-blue-800">
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">52週最高</div>
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {formatNumber(kospi?.high52)}
                      </div>
                      {typeof kospi?.price === 'number' && typeof kospi?.high52 === 'number' && (
                        <div className={`text-sm font-semibold mb-0.5 ${kospi.price >= kospi.high52 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {kospi.price >= kospi.high52 ? '+' : ''}{((kospi.price - kospi.high52) / kospi.high52 * 100).toFixed(2)}%
                        </div>
                      )}
                      {isBearMarketFrom52WHigh(kospi?.price, kospi?.high52) && (
                        <span className="mb-0.5 rounded-full border border-stone-300 bg-stone-900 px-2 py-0.5 text-[11px] font-bold text-stone-50 dark:border-stone-600 dark:bg-stone-100 dark:text-stone-900">
                          熊市
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">52週最低</div>
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
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

                {(kospi?.referenceLevels || []).map((level) => {
                  const vsPct =
                    typeof kospi?.price === "number" && level.value > 0
                      ? ((kospi.price - level.value) / level.value) * 100
                      : null;
                  const broken = vsPct != null && vsPct < 0;
                  return (
                    <div
                      key={`${level.label}-${level.value}`}
                      className={`rounded-lg border p-3 ${
                        broken
                          ? "border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40"
                          : "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40"
                      }`}
                    >
                      <div
                        className={`text-sm font-bold ${
                          broken
                            ? "text-rose-900 dark:text-rose-200"
                            : "text-amber-950 dark:text-amber-100"
                        }`}
                      >
                        {level.label}
                      </div>
                      <div className="mt-1 text-xs font-semibold text-amber-900/80 dark:text-amber-200/90">
                        水平線 ≈ {formatNumber(level.value, 0)} 點（防守底線）
                      </div>
                      {vsPct != null && (
                        <div
                          className={`mt-1 text-xs font-semibold ${
                            broken
                              ? "text-red-600 dark:text-red-400"
                              : "text-green-600 dark:text-green-400"
                          }`}
                        >
                          {broken ? "⚠ 現價已破水平線 " : "現價相對水平線 "}
                          {vsPct >= 0 ? "+" : ""}
                          {vsPct.toFixed(2)}%
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* 圖片輪播 */}
                <FinanceImageCarousel quote={kospi} alt="KOSPI Index Chart" />
              </div>
            )}
          </CardContent>
        </Card>
      </section>
      </div>

      {/* 頁尾資訊 */}
      <div className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>資料來源: CNBC, Yahoo Finance & Investing.com</p>
        <p className="mt-2">本資訊僅供參考,不構成投資建議</p>
      </div>
    </div>
  );
}
