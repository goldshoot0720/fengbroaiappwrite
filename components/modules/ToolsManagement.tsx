"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, Clock, ExternalLink, Play, Plus, RefreshCw, RotateCcw, Search, Smartphone, Trash2, Wrench } from "lucide-react";
import { PageTitle } from "@/components/ui/section-header";
import { DataCard } from "@/components/ui/data-card";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_FENGBRO_TUBE_CHANNELS,
  type FengbroTubeChannelConfig,
  getFengbroTubeFallbackTitle,
  normalizeFengbroTubeChannels,
  normalizeFengbroTubeSource,
} from "@/lib/fengbroTubeChannels";

type ToolsTab = "price-compare" | "landtop" | "fengbro-tube" | "fengbro-finance";
type PriceSource = "local" | "biggo-api";

type PriceHistoryEntry = {
  date: string;
  price: number | null;
  currency?: string;
};

type PriceHistoryResult = {
  url: string;
  title?: string;
  source?: string;
  currency?: string;
  currentPrice?: number | null;
  history?: PriceHistoryEntry[];
  resolvedAt?: string;
  notice?: string;
};

type RecentLink = {
  url: string;
  title?: string;
  updatedAt: number;
};

type LandtopProduct = {
  id: string;
  brand: "apple" | "samsung";
  name: string;
  suggestedPrice: number | null;
  landtopPrice: number | null;
  landtopPriceLabel: string;
  sourceUrl: string;
  jyesPrice?: number | null;
  jyesPriceLabel?: string | null;
  jyesUrl?: string | null;
  bestPrice?: number | null;
  bestSourceLabel?: string | null;
};

type LandtopHistoryPoint = {
  date: string;
  landtopPrice: number | null;
  suggestedPrice: number | null;
};

type LandtopHistorySeries = {
  id: string;
  brand: "apple" | "samsung";
  name: string;
  sourceUrl: string;
  points: LandtopHistoryPoint[];
};

type LandtopResult = {
  source: string;
  sourceUrls: string[];
  query: string;
  refresh: boolean;
  cacheSeconds: number;
  fetchedAt: string;
  warnings?: string[];
  total: number;
  products: LandtopProduct[];
  histories?: LandtopHistorySeries[];
  historyAvailable?: boolean;
  snapshotStored?: number;
};

type FengbroTubeVideo = {
  videoId: string;
  title: string;
  url: string;
  publishedAt: string;
  updatedAt: string;
  thumbnail: string;
  channelTitle?: string;
};

type FengbroTubeChannel = {
  sourceUrl: string;
  channelId: string;
  title: string;
  videos: FengbroTubeVideo[];
  error?: string;
  downfallIndexUpdate?: {
    value: string;
    title: string;
    url: string;
    publishedAt: string;
  } | null;
};

type FengbroTubeResult = {
  fetchedAt: string;
  sourceCount?: number;
  defaultSourceCount?: number;
  channels: FengbroTubeChannel[];
  recentVideos: Array<FengbroTubeVideo & { channelTitle: string; channelId: string }>;
};

type FinanceRecordTag = "new-high" | "new-low" | null;

type FengbroFinanceQuote = {
  id: string;
  name: string;
  displayName: string;
  symbol: string;
  sourceUrl: string;
  group: "tw" | "asia" | "commodities" | "rates" | "us" | "crypto" | "valuation";
  provider?: "cnbc" | "yahoo" | "multpl";
  price: number | null;
  change: number | null;
  changePercent: number | null;
  currency: string;
  high52: number | null;
  low52: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  lastUpdated: string;
  recordTag: FinanceRecordTag;
  recordNote?: string;
  error?: string;
};

type ShillerPeRatio = {
  id: string;
  name: string;
  sourceUrl: string;
  current: number | null;
  recordHigh: number;
  recordHighDate: string;
  updatedAt: string;
  isRecordHigh: boolean;
  error?: string;
};

type FengbroFinanceResult = {
  fetchedAt: string;
  source: string;
  quotes: FengbroFinanceQuote[];
  shillerPe?: ShillerPeRatio;
};

const TOOL_TABS: { id: ToolsTab; label: string }[] = [
  { id: "price-compare", label: "鋒兄比價" },
  { id: "landtop", label: "手機比價" },
  { id: "fengbro-tube", label: "鋒兄Tube" },
  { id: "fengbro-finance", label: "\u92d2\u5144\u91d1\u878d" },
];

const PRICE_SOURCES: Array<{ id: PriceSource; label: string; hint: string }> = [
  { id: "biggo-api", label: "BigGo API", hint: "查詢 BigGo 歷史價格資料" },
  { id: "local", label: "本地佔位", hint: "保留本地測試流程，不連外查價" },
];

const RECENT_KEY = "fengbro.tools.priceHistory.recent";
const SOURCE_KEY = "fengbro.tools.priceHistory.source";
const LANDTOP_QUERY_KEY = "fengbro.tools.landtop.query";
const TUBE_CHANNELS_KEY = "fengbro.tools.tube.channels";

function getSavedTubeChannels() {
  if (typeof window === "undefined") return DEFAULT_FENGBRO_TUBE_CHANNELS;

  try {
    const savedTubeChannels = window.localStorage.getItem(TUBE_CHANNELS_KEY);
    if (!savedTubeChannels) return DEFAULT_FENGBRO_TUBE_CHANNELS;
    const parsedChannels = JSON.parse(savedTubeChannels) as unknown;
    if (!Array.isArray(parsedChannels)) return DEFAULT_FENGBRO_TUBE_CHANNELS;
    const channels = normalizeFengbroTubeChannels(parsedChannels);
    return channels.length > 0 ? channels : DEFAULT_FENGBRO_TUBE_CHANNELS;
  } catch {
    return DEFAULT_FENGBRO_TUBE_CHANNELS;
  }
}

function hasCustomTubeAlias(alias: string) {
  const normalizedAlias = alias.trim();
  return Boolean(normalizedAlias && normalizedAlias !== "未命名頻道");
}

function getDefaultLandtopQuery() {
  const yearSuffix = new Date().getFullYear().toString().slice(-2);
  return `Samsung ${yearSuffix}`;
}

function normalizeSavedLandtopQuery(value: string) {
  const defaultQuery = getDefaultLandtopQuery();
  const legacyDefaultQuery = `Samsung S${new Date().getFullYear().toString().slice(-2)}`;
  return value.trim() === legacyDefaultQuery ? defaultQuery : value;
}

function formatCurrency(price: number | null) {
  return price == null ? "--" : `NT$ ${price.toLocaleString("zh-TW")}`;
}

function formatPriceWithCurrency(price: number | null | undefined, currency?: string) {
  if (price == null) return "--";
  const formatted = new Intl.NumberFormat("zh-TW").format(price);
  return currency ? `${formatted} ${currency}` : formatted;
}

function formatPublishedDate(value: string) {
  if (!value) return "--";
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function normalizeTubeDigits(value: string) {
  return value.replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0));
}

function extractTubeDownfallIndex(title: string) {
  const normalizedTitle = normalizeTubeDigits(title);
  const numberPattern = "([0-9]+(?:\\.[0-9]+)?)";
  const afterLabel = normalizedTitle.match(new RegExp(`倒台指[數数][^0-9]{0,24}${numberPattern}`));
  const beforeLabel = normalizedTitle.match(new RegExp(`${numberPattern}\\s*(?:分|%|％)?\\s*倒台指[數数]`));
  return afterLabel?.[1] || beforeLabel?.[1] || "";
}

function getChannelDownfallIndexUpdate(channel: FengbroTubeChannel) {
  if (channel.downfallIndexUpdate) return channel.downfallIndexUpdate;
  const isHenrenChannel = /henren778/i.test(channel.sourceUrl) || /一[個个]狠人/.test(channel.title);
  if (!isHenrenChannel) return null;

  const matched = channel.videos
    .map((video) => ({ video, value: extractTubeDownfallIndex(video.title) }))
    .find((item) => item.value);

  return matched
    ? {
        value: matched.value,
        title: matched.video.title,
        url: matched.video.url,
        publishedAt: matched.video.publishedAt,
      }
    : null;
}


function formatFinanceNumber(value: number | null, maximumFractionDigits = 2) {
  if (value == null) return "--";
  return new Intl.NumberFormat("zh-TW", {
    maximumFractionDigits,
  }).format(value);
}

function getFinanceGroupLabel(group: FengbroFinanceQuote["group"]) {
  const labels: Record<FengbroFinanceQuote["group"], string> = {
    tw: "台股",
    asia: "\u4e9e\u6d32\u6307\u6578",
    commodities: "\u5546\u54c1",
    rates: "\u5229\u7387",
    us: "\u7f8e\u80a1\u6307\u6578",
    crypto: "\u52a0\u5bc6\u8ca8\u5e63",
    valuation: "估值指標",
  };
  return labels[group];
}

function getFinanceRecordLabel(tag: FinanceRecordTag) {
  if (tag === "new-high") return "\u5275\u65b0\u9ad8";
  if (tag === "new-low") return "\u5275\u65b0\u4f4e";
  return "";
}

function buildChartPath(points: Array<{ x: number; y: number }>) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
}

function PriceTrendChart({
  history,
  currency,
}: {
  history: PriceHistoryEntry[];
  currency?: string;
}) {
  const chart = useMemo(() => {
    const priced = history.filter(
      (entry): entry is PriceHistoryEntry & { price: number } => typeof entry.price === "number"
    );

    if (priced.length === 0) return null;

    const width = 720;
    const height = 280;
    const padding = { top: 24, right: 24, bottom: 40, left: 56 };
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;
    const prices = priced.map((entry) => entry.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = Math.max(maxPrice - minPrice, Math.max(1, maxPrice * 0.08));
    const domainMin = Math.max(0, minPrice - range * 0.2);
    const domainMax = maxPrice + range * 0.2;
    const domain = Math.max(domainMax - domainMin, 1);

    const points = priced.map((entry, index) => {
      const x =
        padding.left + (priced.length === 1 ? innerWidth / 2 : (index / (priced.length - 1)) * innerWidth);
      const y = padding.top + ((domainMax - entry.price) / domain) * innerHeight;
      return { ...entry, x, y };
    });

    const linePath = buildChartPath(points);
    const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${(height - padding.bottom).toFixed(2)} L ${points[0].x.toFixed(2)} ${(height - padding.bottom).toFixed(2)} Z`;

    return {
      areaPath,
      linePath,
      points,
      latest: priced[priced.length - 1],
      earliest: priced[0],
      minPrice,
      maxPrice,
      width,
      height,
      currency,
    };
  }, [currency, history]);

  if (!chart) {
    return (
      <div className="rounded-[28px] border border-dashed border-amber-200/80 bg-amber-50/40 px-5 py-10 text-center text-sm text-muted-foreground">
        目前還沒有可繪製的歷史價格資料。
      </div>
    );
  }

  const delta = chart.latest.price - chart.earliest.price;
  const deltaTone = delta > 0 ? "text-rose-600" : delta < 0 ? "text-emerald-600" : "text-amber-700";

  return (
    <div className="overflow-hidden rounded-[28px] border border-amber-200/80 bg-[linear-gradient(180deg,rgba(255,251,235,0.98),rgba(255,255,255,0.98))] shadow-[0_24px_80px_rgba(120,53,15,0.08)]">
      <div className="flex flex-col gap-4 border-b border-amber-100 px-5 py-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-700/80">Price Trend</p>
          <h5 className="mt-2 text-xl font-semibold text-foreground">歷史價格走勢</h5>
          <p className="mt-1 text-sm text-muted-foreground">依時間排序顯示目前、最高、最低與價格變化。</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-right text-xs sm:min-w-[320px]">
          <div className="rounded-2xl bg-white/80 px-3 py-2 shadow-sm">
            <p className="text-muted-foreground">最低價</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {formatPriceWithCurrency(chart.minPrice, chart.currency)}
            </p>
          </div>
          <div className="rounded-2xl bg-white/80 px-3 py-2 shadow-sm">
            <p className="text-muted-foreground">最高價</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {formatPriceWithCurrency(chart.maxPrice, chart.currency)}
            </p>
          </div>
          <div className="rounded-2xl bg-white/80 px-3 py-2 shadow-sm">
            <p className="text-muted-foreground">變化</p>
            <p className={`mt-1 text-sm font-semibold ${deltaTone}`}>
              {delta > 0 ? "+" : ""}
              {formatPriceWithCurrency(delta, chart.currency)}
            </p>
          </div>
        </div>
      </div>

      <div className="px-3 pb-4 pt-3 sm:px-5">
        <div className="relative overflow-hidden rounded-[24px] border border-amber-100/80 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.14),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,251,235,0.92))] p-3 sm:p-4">
          <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className="h-[260px] w-full">
            <defs>
              <linearGradient id="priceTrendArea" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(245,158,11,0.34)" />
                <stop offset="100%" stopColor="rgba(245,158,11,0.02)" />
              </linearGradient>
            </defs>
            <path d={chart.areaPath} fill="url(#priceTrendArea)" />
            <path
              d={chart.linePath}
              fill="none"
              stroke="rgba(217, 119, 6, 0.96)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="4"
            />
            {chart.points.map((point, index) => (
              <circle
                key={`${point.date}-${index}`}
                cx={point.x}
                cy={point.y}
                fill="white"
                r={index === chart.points.length - 1 ? 6 : 4.5}
                stroke="rgba(217, 119, 6, 0.96)"
                strokeWidth="3"
              />
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}

function LandtopPriceChart({ products }: { products: LandtopProduct[] }) {
  const chartProducts = products.filter((product) => product.landtopPrice || product.jyesPrice).slice(0, 8);
  const maxPrice = Math.max(
    1,
    ...chartProducts.flatMap((product) => [product.landtopPrice || 0, product.jyesPrice || 0])
  );

  if (chartProducts.length === 0) {
    return (
      <div className="rounded-[28px] border border-dashed border-sky-200 bg-sky-50/50 px-5 py-10 text-center text-sm text-muted-foreground">
        目前查無可比較的價格資料。
      </div>
    );
  }

  return (
    <div className="rounded-[28px] border border-sky-200 bg-[linear-gradient(135deg,rgba(240,249,255,0.95),rgba(255,255,255,0.98))] p-5 shadow-[0_24px_80px_rgba(14,116,144,0.08)]">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-700">Landtop Chart</p>
          <h4 className="mt-1 text-lg font-semibold text-foreground">地標網通 vs 傑昇通信</h4>
        </div>
        <BarChart3 className="text-sky-600" size={22} />
      </div>

      <div className="space-y-4">
        {chartProducts.map((product) => {
          const landtopWidth = `${Math.max(4, ((product.landtopPrice || 0) / maxPrice) * 100)}%`;
          const jyesWidth = `${Math.max(4, ((product.jyesPrice || 0) / maxPrice) * 100)}%`;

          return (
            <div key={product.id} className="grid gap-2 md:grid-cols-[220px_1fr] md:items-center">
              <div>
                <p className="line-clamp-1 text-sm font-semibold text-foreground">{product.name}</p>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{product.brand}</p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-16 text-xs text-sky-700">地標</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-sky-100">
                    <div
                      className="h-full rounded-full bg-sky-500"
                      style={{ width: product.landtopPrice ? landtopWidth : "4%" }}
                    />
                  </div>
                  <span className="w-24 text-right text-xs font-medium text-sky-700">
                    {product.landtopPrice ? formatCurrency(product.landtopPrice) : "最低價"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-16 text-xs text-violet-700">傑昇</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-violet-100">
                    <div
                      className="h-full rounded-full bg-violet-500"
                      style={{ width: product.jyesPrice ? jyesWidth : "4%" }}
                    />
                  </div>
                  <span className="w-24 text-right text-xs font-medium text-violet-700">
                    {product.jyesPrice ? formatCurrency(product.jyesPrice) : "--"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LandtopHistoryChart({
  histories,
  historyAvailable,
}: {
  histories: LandtopHistorySeries[];
  historyAvailable?: boolean;
}) {
  const palette = ["#0ea5e9", "#f97316", "#10b981", "#8b5cf6"];

  const chart = useMemo(() => {
    const series = histories
      .map((item) => ({
        ...item,
        pricedPoints: item.points.filter(
          (point): point is LandtopHistoryPoint & { landtopPrice: number } =>
            typeof point.landtopPrice === "number"
        ),
      }))
      .filter((item) => item.pricedPoints.length > 0)
      .slice(0, 4);

    if (!series.length) return null;

    const width = 720;
    const height = 300;
    const padding = { top: 28, right: 24, bottom: 40, left: 56 };
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;
    const allPoints = series.flatMap((item) => item.pricedPoints);
    const prices = allPoints.map((point) => point.landtopPrice);
    const dates = Array.from(new Set(allPoints.map((point) => point.date))).sort();
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = Math.max(maxPrice - minPrice, Math.max(1, maxPrice * 0.08));
    const domainMin = Math.max(0, minPrice - range * 0.15);
    const domainMax = maxPrice + range * 0.15;
    const domain = Math.max(domainMax - domainMin, 1);

    return {
      width,
      height,
      minPrice,
      maxPrice,
      series: series.map((item, index) => {
        const points = item.pricedPoints.map((point) => {
          const dateIndex = dates.indexOf(point.date);
          const x =
            padding.left + (dates.length === 1 ? innerWidth / 2 : (dateIndex / (dates.length - 1)) * innerWidth);
          const y = padding.top + ((domainMax - point.landtopPrice) / domain) * innerHeight;
          return { ...point, x, y };
        });

        return {
          ...item,
          color: palette[index % palette.length],
          linePath: buildChartPath(points),
          points,
        };
      }),
    };
  }, [histories]);

  if (!chart) {
    return (
      <div className="rounded-[28px] border border-dashed border-sky-200 bg-sky-50/50 px-5 py-10 text-center text-sm text-muted-foreground">
        {historyAvailable ? "目前還沒有每 7 天價格歷史，重新抓取或等待排程累積資料。" : "尚未設定歷史價格儲存。"}
      </div>
    );
  }

  return (
    <div className="rounded-[28px] border border-sky-200 bg-[linear-gradient(180deg,rgba(239,246,255,0.96),rgba(255,255,255,0.98))] p-5 shadow-[0_24px_80px_rgba(14,116,144,0.08)]">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-700">Weekly History</p>
          <h4 className="mt-1 text-lg font-semibold text-foreground">地標網通歷史價格</h4>
          <p className="mt-1 text-sm text-muted-foreground">每 7 天記錄一次，目前保存地標網通的不同容量版本價格走勢。</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-right text-xs sm:min-w-[220px]">
          <div className="rounded-2xl bg-white/80 px-3 py-2 shadow-sm">
            <p className="text-muted-foreground">歷史最低</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(chart.minPrice)}</p>
          </div>
          <div className="rounded-2xl bg-white/80 px-3 py-2 shadow-sm">
            <p className="text-muted-foreground">歷史最高</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(chart.maxPrice)}</p>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {chart.series.map((item) => (
          <a
            key={item.id}
            href={item.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs shadow-sm"
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="font-medium text-foreground">{item.name}</span>
          </a>
        ))}
      </div>

      <div className="overflow-hidden rounded-[24px] border border-sky-100/80 bg-white/80 p-3 sm:p-4">
        <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className="h-[280px] w-full">
          {chart.series.map((item) => (
            <g key={item.id}>
              <path
                d={item.linePath}
                fill="none"
                stroke={item.color}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3.5"
              />
              {item.points.map((point, index) => (
                <circle
                  key={`${item.id}-${point.date}-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r={index === item.points.length - 1 ? 5.5 : 4}
                  fill="white"
                  stroke={item.color}
                  strokeWidth="2.5"
                />
              ))}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

function FengbroTubeSection({
  result,
  loading,
  error,
  channelManagerOpen,
  channelConfigs,
  channelAliasDraft,
  channelUrlDraft,
  editingChannelUrl,
  onToggleChannelManager,
  onChannelAliasDraftChange,
  onChannelUrlDraftChange,
  onSaveChannel,
  onEditChannel,
  onDeleteChannel,
  onCancelEditChannel,
  onResetChannels,
  onRefresh,
}: {
  result: FengbroTubeResult | null;
  loading: boolean;
  error: string;
  channelManagerOpen: boolean;
  channelConfigs: FengbroTubeChannelConfig[];
  channelAliasDraft: string;
  channelUrlDraft: string;
  editingChannelUrl: string | null;
  onToggleChannelManager: () => void;
  onChannelAliasDraftChange: (value: string) => void;
  onChannelUrlDraftChange: (value: string) => void;
  onSaveChannel: () => void;
  onEditChannel: (channel: FengbroTubeChannelConfig) => void;
  onDeleteChannel: (sourceUrl: string) => void;
  onCancelEditChannel: () => void;
  onResetChannels: () => void;
  onRefresh: () => void;
}) {
  const channelCount = result?.sourceCount ?? channelConfigs.length;
  const resolvedChannelTitleBySource = useMemo(() => {
    return new Map((result?.channels || []).map((channel) => [channel.sourceUrl, channel.title]));
  }, [result]);
  const getChannelConfigLabel = (channel: FengbroTubeChannelConfig) =>
    hasCustomTubeAlias(channel.alias)
      ? channel.alias
      : getFengbroTubeFallbackTitle(channel.sourceUrl, resolvedChannelTitleBySource.get(channel.sourceUrl) || "");

  return (
    <div className="space-y-5">
      <DataCard className="overflow-hidden p-0">
        <div className="flex flex-col gap-4 border-b border-red-100 bg-[linear-gradient(135deg,rgba(254,242,242,0.98),rgba(255,255,255,0.96))] p-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600">
              <Play size={22} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-600/80">FengBro Tube</p>
              <h3 className="mt-1 text-2xl font-semibold text-foreground">鋒兄Tube</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                追蹤指定 YouTube 頻道最新影片，每個頻道顯示 10 部；目前追蹤 {channelCount} 個頻道。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {result?.fetchedAt && (
              <span className="rounded-full border border-red-100 bg-white px-3 py-1 text-xs text-muted-foreground">
                更新：{new Date(result.fetchedAt).toLocaleString("zh-TW")}
              </span>
            )}
            <span className="rounded-full border border-red-100 bg-white px-3 py-1 text-xs text-muted-foreground">
              頻道：{channelConfigs.length} / 預設 {DEFAULT_FENGBRO_TUBE_CHANNELS.length}
            </span>
            <Button type="button" variant="outline" onClick={onToggleChannelManager} className="gap-2 rounded-xl">
              <Wrench size={16} />
              頻道管理
            </Button>
            <Button onClick={onRefresh} disabled={loading} className="gap-2 bg-red-600 hover:bg-red-700">
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              {loading ? "更新中" : "重新整理"}
            </Button>
          </div>
        </div>

        {channelManagerOpen && (
        <div className="border-b border-red-50 p-4 sm:p-6">
          <div className="rounded-[28px] border border-red-100 bg-white p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h4 className="font-semibold text-foreground">頻道管理</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  可編輯頻道別名與網址。第一次使用預設 {DEFAULT_FENGBRO_TUBE_CHANNELS.length} 個頻道。
                </p>
              </div>
              <Button type="button" variant="outline" onClick={onResetChannels} className="gap-2 rounded-xl">
                <RotateCcw size={16} />
                還原預設
              </Button>
            </div>
            <div className="mt-4 grid gap-2 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.4fr)_auto]">
              <input
                value={channelAliasDraft}
                onChange={(event) => onChannelAliasDraftChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onSaveChannel();
                }}
                placeholder="頻道別名"
                className="h-11 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-red-300 focus:ring-2 focus:ring-red-100"
              />
              <input
                value={channelUrlDraft}
                onChange={(event) => onChannelUrlDraftChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onSaveChannel();
                }}
                placeholder="頻道網址 / @handle"
                className="h-11 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-red-300 focus:ring-2 focus:ring-red-100"
              />
              <Button type="button" onClick={onSaveChannel} className="gap-2 rounded-xl bg-red-600 hover:bg-red-700">
                <Plus size={16} />
                {editingChannelUrl ? "儲存頻道" : "新增頻道"}
              </Button>
            </div>
            {editingChannelUrl && (
              <div className="mt-2">
                <Button type="button" variant="ghost" onClick={onCancelEditChannel} className="h-9 rounded-xl text-sm">
                  取消編輯
                </Button>
              </div>
            )}
            <div className="mt-4 grid gap-2 xl:grid-cols-2">
              {channelConfigs.map((channel) => (
                <div key={channel.sourceUrl} className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-red-100 bg-red-50/70 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{getChannelConfigLabel(channel)}</p>
                    <a href={channel.sourceUrl} target="_blank" rel="noreferrer" className="block truncate text-xs text-red-700 hover:underline">
                      {channel.sourceUrl}
                    </a>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button type="button" variant="outline" onClick={() => onEditChannel(channel)} className="h-9 rounded-xl px-3 text-xs">
                      編輯
                    </Button>
                    <button
                      type="button"
                      onClick={() => onDeleteChannel(channel.sourceUrl)}
                      className="rounded-full p-2 text-red-500 transition hover:bg-red-100 hover:text-red-700"
                      title="刪除頻道"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        )}

        {error && <div className="m-6 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

        {!error && loading && !result && (
          <div className="p-8 text-center text-sm text-muted-foreground">正在讀取 YouTube 頻道最新影片...</div>
        )}

        {!error && result && (
          <div className="space-y-6 p-4 sm:p-6">
            {result.recentVideos.length > 0 && (
              <div className="rounded-[28px] border border-amber-200 bg-amber-50/70 p-4">
                <div className="mb-3 flex items-center gap-2 text-amber-800">
                  <Clock size={18} />
                  <h4 className="font-semibold">3 天內新影片：{result.recentVideos.length} 部</h4>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {result.recentVideos.slice(0, 8).map((video) => (
                    <a
                      key={`${video.channelId}-${video.videoId}`}
                      href={video.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-2xl border border-amber-100 bg-white px-3 py-2 text-sm transition hover:border-amber-300"
                    >
                      <div className="line-clamp-1 font-medium text-foreground">{video.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {video.channelTitle} / {formatPublishedDate(video.publishedAt)}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-5">
              {result.channels.map((channel) => {
                const downfallIndexUpdate = getChannelDownfallIndexUpdate(channel);

                return (
                <div key={channel.sourceUrl} className="rounded-[28px] border border-border bg-white p-4 shadow-sm">
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-lg font-semibold text-foreground">{channel.title}</h4>
                        {downfallIndexUpdate && (
                          <a
                            href={downfallIndexUpdate.url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 transition hover:border-amber-300 hover:bg-amber-100"
                            title={downfallIndexUpdate.title}
                          >
                            更新：倒台指數 {downfallIndexUpdate.value}
                          </a>
                        )}
                      </div>
                      <a href={channel.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-red-600 hover:text-red-700">
                        開啟頻道 <ExternalLink className="inline h-3 w-3" />
                      </a>
                    </div>
                    {channel.error ? (
                      <span className="rounded-full bg-red-50 px-3 py-1 text-xs text-red-600">{channel.error}</span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-muted-foreground">
                        {channel.videos.length} 部影片
                      </span>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    {channel.videos.map((video) => (
                      <a
                        key={video.videoId}
                        href={video.url}
                        target="_blank"
                        rel="noreferrer"
                        className="group overflow-hidden rounded-2xl border border-border bg-slate-50 transition hover:border-red-300 hover:bg-white hover:shadow-md"
                      >
                        {video.thumbnail ? (
                          <img src={video.thumbnail} alt={video.title} className="aspect-video w-full object-cover transition group-hover:scale-[1.03]" />
                        ) : (
                          <div className="flex aspect-video items-center justify-center bg-red-50 text-red-500">
                            <Play size={24} />
                          </div>
                        )}
                        <div className="space-y-1 p-3">
                          <div className="line-clamp-2 text-sm font-medium leading-5 text-foreground">{video.title}</div>
                          <div className="text-xs text-muted-foreground">{formatPublishedDate(video.publishedAt)}</div>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}
      </DataCard>
    </div>
  );
}


function FengbroFinanceSection({
  result,
  loading,
  error,
  onRefresh,
}: {
  result: FengbroFinanceResult | null;
  loading: boolean;
  error: string;
  onRefresh: () => void;
}) {
  const groupedQuotes = useMemo(() => {
    const order: FengbroFinanceQuote["group"][] = ["tw", "us", "valuation", "asia", "commodities", "rates", "crypto"];
    return order
      .map((group) => ({ group, quotes: (result?.quotes || []).filter((quote) => quote.group === group) }))
      .filter((item) => item.quotes.length > 0);
  }, [result]);

  return (
    <div className="space-y-5">
      <DataCard className="overflow-hidden p-0">
        <div className="flex flex-col gap-4 border-b border-emerald-100 bg-[linear-gradient(135deg,rgba(236,253,245,0.98),rgba(255,255,255,0.96))] p-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <BarChart3 size={22} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-700/80">FengBro Finance</p>
              <h3 className="mt-1 text-2xl font-semibold text-foreground">鋒兄金融</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                CNBC 報價監控：股指、商品、利率與加密貨幣，觸及新高或新低時自動標註。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {result?.fetchedAt && (
              <span className="rounded-full border border-emerald-100 bg-white px-3 py-1 text-xs text-muted-foreground">
                更新：{new Date(result.fetchedAt).toLocaleString("zh-TW")}
              </span>
            )}
            <Button onClick={onRefresh} disabled={loading} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              {loading ? "更新中" : "重新整理"}
            </Button>
          </div>
        </div>

        {error && <div className="m-6 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

        {!error && loading && !result && (
          <div className="p-8 text-center text-sm text-muted-foreground">正在讀取 CNBC 金融報價...</div>
        )}

        {!error && result && (
          <div className="space-y-6 p-4 sm:p-6">
            {result.shillerPe && (
              <div
                className={`rounded-[24px] border p-4 shadow-sm ${
                  result.shillerPe.isRecordHigh
                    ? "border-rose-300 bg-rose-50 text-rose-950"
                    : "border-emerald-100 bg-emerald-50/70 text-emerald-950"
                }`}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                        result.shillerPe.isRecordHigh ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {result.shillerPe.isRecordHigh ? <AlertTriangle size={20} /> : <BarChart3 size={20} />}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold">Shiller PE Ratio</h4>
                        {result.shillerPe.isRecordHigh && (
                          <span className="rounded-full border border-rose-200 bg-white px-2.5 py-1 text-xs font-semibold text-rose-700">
                            創歷史新高
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm opacity-80">
                        Max: {formatFinanceNumber(result.shillerPe.recordHigh, 2)} ({result.shillerPe.recordHighDate})
                        {result.shillerPe.updatedAt ? ` / ${result.shillerPe.updatedAt}` : ""}
                      </p>
                      {result.shillerPe.error && <p className="mt-2 text-sm text-rose-600">{result.shillerPe.error}</p>}
                    </div>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-70">Current</p>
                    <p className="mt-1 text-3xl font-semibold">{formatFinanceNumber(result.shillerPe.current, 2)}</p>
                    <a
                      href={result.shillerPe.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium underline-offset-4 hover:underline"
                    >
                      multpl.com <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
            )}
            {groupedQuotes.map(({ group, quotes }) => (
              <div key={group} className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold text-emerald-800">{getFinanceGroupLabel(group)}</h4>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700">{quotes.length} 項</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {quotes.map((quote) => {
                    const recordLabel = getFinanceRecordLabel(quote.recordTag);
                    const isUp = (quote.change || 0) >= 0;
                    return (
                      <div key={quote.id} className="rounded-[24px] border border-border bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-md">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h5 className="font-semibold text-foreground">{quote.name}</h5>
                              {recordLabel && (
                                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${quote.recordTag === "new-high" ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-sky-50 text-sky-700 border border-sky-200"}`}>
                                  {recordLabel}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{quote.symbol}</p>
                          </div>
                          <a href={quote.sourceUrl} target="_blank" rel="noreferrer" className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700 hover:bg-emerald-100">
                            {quote.provider === "yahoo" ? "Yahoo" : quote.provider === "multpl" || quote.id === "shiller-pe" ? "Multpl" : "CNBC"} <ExternalLink className="inline h-3 w-3" />
                          </a>
                        </div>

                        {quote.error ? (
                          <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">{quote.error}</p>
                        ) : (
                          <>
                            <div className="mt-4 flex items-end justify-between gap-3">
                              <div>
                                <p className="text-xs text-muted-foreground">最新價</p>
                                <p className="mt-1 text-2xl font-semibold text-foreground">
                                  {formatFinanceNumber(quote.price, group === "rates" ? 3 : 2)}
                                  {quote.currency ? <span className="ml-1 text-xs font-medium text-muted-foreground">{quote.currency}</span> : null}
                                </p>
                              </div>
                              <div className={`text-right text-sm font-semibold ${isUp ? "text-emerald-700" : "text-red-600"}`}>
                                <p>{isUp ? "+" : ""}{formatFinanceNumber(quote.change, 2)}</p>
                                <p>{isUp ? "+" : ""}{formatFinanceNumber(quote.changePercent, 2)}%</p>
                              </div>
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                              <div className="rounded-xl bg-slate-50 px-3 py-2">
                                <p className="text-muted-foreground">52W High</p>
                                <p className="mt-1 font-semibold">{formatFinanceNumber(quote.high52, 2)}</p>
                              </div>
                              <div className="rounded-xl bg-slate-50 px-3 py-2">
                                <p className="text-muted-foreground">52W Low</p>
                                <p className="mt-1 font-semibold">{formatFinanceNumber(quote.low52, 2)}</p>
                              </div>
                            </div>
                            {quote.recordNote ? (
                              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                {quote.recordNote}
                              </p>
                            ) : null}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </DataCard>
    </div>
  );
}

export default function ToolsManagement({ initialTab = "price-compare" }: { initialTab?: ToolsTab }) {
  const [activeTab, setActiveTab] = useState<ToolsTab>(initialTab);
  const [targetUrl, setTargetUrl] = useState("");
  const [priceSource, setPriceSource] = useState<PriceSource>("biggo-api");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<PriceHistoryResult | null>(null);
  const [recentLinks, setRecentLinks] = useState<RecentLink[]>([]);
  const [landtopQuery, setLandtopQuery] = useState(getDefaultLandtopQuery);
  const [landtopLoading, setLandtopLoading] = useState(false);
  const [landtopError, setLandtopError] = useState("");
  const [landtopResult, setLandtopResult] = useState<LandtopResult | null>(null);
  const [landtopLoadedOnce, setLandtopLoadedOnce] = useState(false);
  const [tubeLoading, setTubeLoading] = useState(false);
  const [tubeError, setTubeError] = useState("");
  const [tubeResult, setTubeResult] = useState<FengbroTubeResult | null>(null);
  const [tubeLoadedOnce, setTubeLoadedOnce] = useState(false);
  const [tubeChannelManagerOpen, setTubeChannelManagerOpen] = useState(false);
  const [tubeChannelConfigs, setTubeChannelConfigs] = useState<FengbroTubeChannelConfig[]>(getSavedTubeChannels);
  const [tubeChannelAliasDraft, setTubeChannelAliasDraft] = useState("");
  const [tubeChannelUrlDraft, setTubeChannelUrlDraft] = useState("");
  const [editingTubeChannelUrl, setEditingTubeChannelUrl] = useState<string | null>(null);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [financeError, setFinanceError] = useState("");
  const [financeResult, setFinanceResult] = useState<FengbroFinanceResult | null>(null);
  const [financeLoadedOnce, setFinanceLoadedOnce] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(RECENT_KEY);
      if (raw) setRecentLinks(JSON.parse(raw) as RecentLink[]);
    } catch {}

    try {
      const savedSource = window.localStorage.getItem(SOURCE_KEY) as PriceSource | null;
      if (savedSource === "local" || savedSource === "biggo-api") setPriceSource(savedSource);
    } catch {}

    try {
      const savedQuery = window.localStorage.getItem(LANDTOP_QUERY_KEY);
      if (savedQuery) setLandtopQuery(normalizeSavedLandtopQuery(savedQuery));

    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(TUBE_CHANNELS_KEY, JSON.stringify(tubeChannelConfigs));
  }, [tubeChannelConfigs]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(SOURCE_KEY, priceSource);
    } catch {}
  }, [priceSource]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(LANDTOP_QUERY_KEY, landtopQuery);
    } catch {}
  }, [landtopQuery]);

  const sortedRecent = useMemo(() => {
    return [...recentLinks].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);
  }, [recentLinks]);

  const priceSummary = useMemo(() => {
    if (!result) return null;

    const pricedHistory = (result.history || []).filter(
      (entry): entry is PriceHistoryEntry & { price: number } => typeof entry.price === "number"
    );
    const historyPrices = pricedHistory.map((entry) => entry.price);
    const fallbackCurrent = pricedHistory.at(-1)?.price ?? null;

    return {
      currentPrice: result.currentPrice ?? fallbackCurrent,
      highestPrice: historyPrices.length ? Math.max(...historyPrices) : result.currentPrice ?? null,
      lowestPrice: historyPrices.length ? Math.min(...historyPrices) : result.currentPrice ?? null,
    };
  }, [result]);

  const persistRecentLinks = (links: RecentLink[]) => {
    setRecentLinks(links);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(links));
    } catch {}
  };

  const upsertRecentLink = (url: string, title?: string) => {
    const now = Date.now();
    const existing = recentLinks.filter((item) => item.url !== url);
    persistRecentLinks([{ url, title, updatedAt: now }, ...existing].slice(0, 12));
  };

  const loadLandtop = useCallback(
    async (refresh = false, overrideQuery?: string) => {
      const query = (overrideQuery ?? landtopQuery).trim();
      setLandtopLoadedOnce(true);
      setLandtopLoading(true);
      setLandtopError("");

      try {
        const params = new URLSearchParams();
        if (query) params.set("query", query);
        if (refresh) params.set("refresh", "1");

        const response = await fetch(`/api/landtop?${params.toString()}`);
        const data = (await response.json()) as LandtopResult & { error?: string };
        if (!response.ok) throw new Error(data.error || "地標網通查詢失敗");
        setLandtopResult(data);
      } catch (error) {
        setLandtopError(error instanceof Error ? error.message : "地標網通查詢失敗");
      } finally {
        setLandtopLoading(false);
      }
    },
    [landtopQuery]
  );

  useEffect(() => {
    if (activeTab === "landtop" && !landtopLoadedOnce && !landtopLoading) {
      void loadLandtop(false);
    }
  }, [activeTab, landtopLoadedOnce, landtopLoading, loadLandtop]);

  const loadTube = useCallback(async () => {
    setTubeLoadedOnce(true);
    setTubeLoading(true);
    setTubeError("");
    try {
      const response = await fetch("/api/fengbro-tube", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channels: tubeChannelConfigs }),
      });
      const data = (await response.json()) as FengbroTubeResult & { error?: string };
      if (!response.ok) throw new Error(data.error || "鋒兄Tube 讀取失敗");
      setTubeResult(data);
      const resolvedTitles = new Map(data.channels.map((channel) => [channel.sourceUrl, channel.title]));
      setTubeChannelConfigs((currentChannels) =>
        normalizeFengbroTubeChannels(
          currentChannels.map((channel) => {
            const fallbackTitle = getFengbroTubeFallbackTitle(channel.sourceUrl);
            if (hasCustomTubeAlias(channel.alias) && channel.alias.trim() !== fallbackTitle) return channel;
            const resolvedTitle = resolvedTitles.get(channel.sourceUrl);
            return {
              ...channel,
              alias: getFengbroTubeFallbackTitle(channel.sourceUrl, resolvedTitle || ""),
            };
          })
        )
      );
    } catch (error) {
      setTubeError(error instanceof Error ? error.message : "鋒兄Tube 讀取失敗");
    } finally {
      setTubeLoading(false);
    }
  }, [tubeChannelConfigs]);

  const clearTubeChannelForm = useCallback(() => {
    setTubeChannelAliasDraft("");
    setTubeChannelUrlDraft("");
    setEditingTubeChannelUrl(null);
  }, []);

  const handleSaveTubeChannel = useCallback(() => {
    const sourceUrl = normalizeFengbroTubeSource(tubeChannelUrlDraft);
    if (!sourceUrl) {
      setTubeError("請輸入正確的 YouTube 頻道網址或 @handle");
      return;
    }

    setTubeError("");
    setTubeChannelConfigs((currentChannels) => {
      const nextChannel = { alias: tubeChannelAliasDraft.trim(), sourceUrl };
      const filteredChannels = editingTubeChannelUrl
        ? currentChannels.filter((channel) => channel.sourceUrl !== editingTubeChannelUrl && channel.sourceUrl !== sourceUrl)
        : currentChannels.filter((channel) => channel.sourceUrl !== sourceUrl);
      return normalizeFengbroTubeChannels([...filteredChannels, nextChannel]);
    });
    clearTubeChannelForm();
    setTubeLoadedOnce(false);
  }, [clearTubeChannelForm, editingTubeChannelUrl, tubeChannelAliasDraft, tubeChannelUrlDraft]);

  const handleEditTubeChannel = useCallback((channel: FengbroTubeChannelConfig) => {
    setTubeChannelManagerOpen(true);
    setTubeChannelAliasDraft(channel.alias);
    setTubeChannelUrlDraft(channel.sourceUrl);
    setEditingTubeChannelUrl(channel.sourceUrl);
  }, []);

  const handleDeleteTubeChannel = useCallback((sourceUrl: string) => {
    const targetChannel = tubeChannelConfigs.find((channel) => channel.sourceUrl === sourceUrl);
    const label = targetChannel
      ? hasCustomTubeAlias(targetChannel.alias)
        ? targetChannel.alias
        : getFengbroTubeFallbackTitle(targetChannel.sourceUrl)
      : "這個頻道";
    if (typeof window !== "undefined" && !window.confirm(`確定刪除「${label}」？`)) return;

    setTubeChannelConfigs((currentChannels) => currentChannels.filter((channel) => channel.sourceUrl !== sourceUrl));
    if (editingTubeChannelUrl === sourceUrl) clearTubeChannelForm();
    setTubeLoadedOnce(false);
  }, [clearTubeChannelForm, editingTubeChannelUrl, tubeChannelConfigs]);

  const handleResetTubeChannels = useCallback(() => {
    if (typeof window !== "undefined" && !window.confirm(`確定還原預設 ${DEFAULT_FENGBRO_TUBE_CHANNELS.length} 個頻道？`)) return;
    setTubeChannelConfigs(DEFAULT_FENGBRO_TUBE_CHANNELS);
    clearTubeChannelForm();
    setTubeLoadedOnce(false);
  }, [clearTubeChannelForm]);

  useEffect(() => {
    if (activeTab === "fengbro-tube" && !tubeLoadedOnce && !tubeLoading) {
      void loadTube();
    }
  }, [activeTab, tubeLoadedOnce, tubeLoading, loadTube]);

  const loadFinance = useCallback(async () => {
    setFinanceLoadedOnce(true);
    setFinanceLoading(true);
    setFinanceError("");
    try {
      const response = await fetch("/api/fengbro-finance");
      const data = (await response.json()) as FengbroFinanceResult & { error?: string };
      if (!response.ok) throw new Error(data.error || "\u92d2\u5144\u91d1\u878d\u8b80\u53d6\u5931\u6557");
      setFinanceResult(data);
    } catch (error) {
      setFinanceError(error instanceof Error ? error.message : "\u92d2\u5144\u91d1\u878d\u8b80\u53d6\u5931\u6557");
    } finally {
      setFinanceLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "fengbro-finance" && !financeLoadedOnce && !financeLoading) {
      void loadFinance();
    }
  }, [activeTab, financeLoadedOnce, financeLoading, loadFinance]);


  const handleResolve = async (overrideUrl?: string) => {
    const url = (overrideUrl ?? targetUrl).trim();
    if (!url) {
      setErrorMessage("請先貼上商品網址");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setResult(null);

    try {
      const response = await fetch(
        `/api/resolve?url=${encodeURIComponent(url)}&source=${encodeURIComponent(priceSource)}`
      );
      const data = (await response.json()) as PriceHistoryResult & { error?: string };
      if (!response.ok) throw new Error(data.error || "比價查詢失敗");
      setResult(data);
      upsertRecentLink(url, data.title);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "比價查詢失敗");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-6">
      <PageTitle title="鋒兄工具" description="工具模組集中入口與手機比價工作台。" />

      <DataCard className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          {TOOL_TABS.map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </DataCard>

      {activeTab === "price-compare" ? (
        <>
          <DataCard className="space-y-4 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <Wrench size={20} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">鋒兄比價</h3>
                <p className="text-sm text-muted-foreground">貼上商品網址，取得目前價格與歷史價格圖表。</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-amber-200 bg-amber-50/50 p-4">
              <label className="text-sm font-medium">商品網址</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={targetUrl}
                  onChange={(event) => setTargetUrl(event.target.value)}
                  placeholder="例如 https://24h.pchome.com.tw/prod/..."
                  className="flex-1 rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-amber-400"
                />
                <Button onClick={() => handleResolve()} className="gap-2" disabled={loading}>
                  <Search size={16} />
                  {loading ? "查詢中" : "查詢歷史價格"}
                </Button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {PRICE_SOURCES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPriceSource(item.id)}
                    className={`rounded-2xl border px-3 py-3 text-left transition ${
                      priceSource === item.id
                        ? "border-amber-400 bg-white shadow-sm"
                        : "border-amber-200/80 bg-white/60 hover:border-amber-300"
                    }`}
                  >
                    <div className="text-sm font-semibold text-foreground">{item.label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{item.hint}</div>
                  </button>
                ))}
              </div>
            </div>
          </DataCard>

          {sortedRecent.length > 0 && (
            <DataCard className="p-6">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold">最近連結</h4>
                <span className="text-xs text-muted-foreground">{sortedRecent.length} 筆</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {sortedRecent.map((item) => (
                  <button
                    key={item.url}
                    type="button"
                    onClick={() => {
                      setTargetUrl(item.url);
                      void handleResolve(item.url);
                    }}
                    className="flex flex-col rounded-xl border border-border bg-white px-3 py-2 text-left text-xs shadow-sm transition hover:border-amber-300"
                  >
                    <span className="line-clamp-1 font-medium text-foreground">{item.title || "未命名商品"}</span>
                    <span className="line-clamp-1 text-muted-foreground">{item.url}</span>
                  </button>
                ))}
              </div>
            </DataCard>
          )}

          <DataCard className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">比價結果</h4>
              {result?.url && (
                <a
                  href={result.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700"
                >
                  開啟商品 <ExternalLink size={12} />
                </a>
              )}
            </div>

            {loading && <p className="text-sm text-muted-foreground">正在查詢歷史價格資料...</p>}
            {!loading && errorMessage && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{errorMessage}</p>
            )}
            {!loading && !errorMessage && !result && (
              <p className="text-sm text-muted-foreground">輸入商品網址後，這裡會顯示目前價格、歷史高低點與圖表。</p>
            )}

            {!loading && result && (
              <div className="space-y-3">
                <div className="rounded-2xl border border-border bg-white p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold">{result.title || "未命名商品"}</p>
                      <p className="text-xs text-muted-foreground">
                        來源：{result.source || "未指定"}
                        {result.resolvedAt ? `，更新：${result.resolvedAt}` : ""}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-xs text-muted-foreground">現在價格</p>
                      <p className="text-lg font-semibold text-amber-700">
                        {formatPriceWithCurrency(result.currentPrice, result.currency)}
                      </p>
                    </div>
                  </div>
                  {result.notice && (
                    <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      {result.notice}
                    </p>
                  )}
                </div>

                {priceSummary && (
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3">
                      <p className="text-xs text-amber-700/80">現在價格</p>
                      <p className="mt-1 text-lg font-semibold text-amber-700">
                        {formatPriceWithCurrency(priceSummary.currentPrice, result.currency)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-rose-200 bg-rose-50/60 px-4 py-3">
                      <p className="text-xs text-rose-700/80">歷史最高價</p>
                      <p className="mt-1 text-lg font-semibold text-rose-700">
                        {formatPriceWithCurrency(priceSummary.highestPrice, result.currency)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
                      <p className="text-xs text-emerald-700/80">歷史最低價</p>
                      <p className="mt-1 text-lg font-semibold text-emerald-700">
                        {formatPriceWithCurrency(priceSummary.lowestPrice, result.currency)}
                      </p>
                    </div>
                  </div>
                )}

                <PriceTrendChart history={result.history || []} currency={result.currency} />
              </div>
            )}
          </DataCard>
        </>
      ) : activeTab === "landtop" ? (
        <DataCard className="space-y-5 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                <Smartphone size={20} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">手機比價</h3>
                <p className="text-sm text-muted-foreground">
                  根據地標網通與傑昇通信比價，可搜尋 iPhone 17、Samsung 26、Samsung A17 等機型。
                </p>
              </div>
            </div>
            {landtopResult && (
              <p className="text-xs text-muted-foreground">
                更新：{new Date(landtopResult.fetchedAt).toLocaleString("zh-TW")}，結果 {landtopResult.total} 筆
                {typeof landtopResult.snapshotStored === "number"
                  ? `，本次寫入 ${landtopResult.snapshotStored} 筆歷史快照`
                  : ""}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 rounded-2xl border border-sky-200 bg-sky-50/60 p-4 sm:flex-row">
            <input
              value={landtopQuery}
              onChange={(event) => setLandtopQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void loadLandtop(false);
              }}
              placeholder={`例如 ${getDefaultLandtopQuery()}、iPhone 17 512GB、Samsung A17`}
              className="flex-1 rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-sky-400"
            />
            <Button onClick={() => loadLandtop(false)} className="gap-2" disabled={landtopLoading}>
              <Search size={16} />
              {landtopLoading ? "搜尋中" : "開始比價"}
            </Button>
            <Button onClick={() => loadLandtop(true)} variant="outline" className="gap-2" disabled={landtopLoading}>
              <RefreshCw size={16} />
              重新抓取
            </Button>
          </div>

          {landtopError && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{landtopError}</p>
          )}

          {!landtopError && landtopResult?.warnings?.length ? (
            <div className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {landtopResult.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}

          {!landtopError && landtopResult && (
            <>
              <LandtopPriceChart products={landtopResult.products} />

              <div className="grid gap-3 md:grid-cols-2">
                {landtopResult.products.slice(0, 12).map((product) => {
                  const savings =
                    product.bestPrice && product.suggestedPrice
                      ? product.suggestedPrice - product.bestPrice
                      : null;

                  return (
                    <div
                      key={product.id}
                      className="rounded-2xl border border-border bg-white p-4 shadow-sm transition hover:border-sky-300 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{product.name}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">{product.brand}</p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          {product.sourceUrl && (
                            <a
                              href={product.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 transition hover:border-sky-300 hover:bg-sky-100"
                            >
                              地標網通
                              <ExternalLink size={12} />
                            </a>
                          )}
                          {product.jyesUrl && (
                            <a
                              href={product.jyesUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 transition hover:border-violet-300 hover:bg-violet-100"
                            >
                              傑昇通信
                              <ExternalLink size={12} />
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
                        <div className="rounded-xl bg-slate-50 px-3 py-2">
                          <p className="text-muted-foreground">建議售價</p>
                          <p className="mt-1 font-semibold">{formatCurrency(product.suggestedPrice)}</p>
                        </div>
                        <div className="rounded-xl bg-sky-50 px-3 py-2">
                          <p className="text-sky-700/80">地標網通</p>
                          <p className="mt-1 font-semibold text-sky-700">{product.landtopPriceLabel}</p>
                        </div>
                        <div className="rounded-xl bg-violet-50 px-3 py-2">
                          <p className="text-violet-700/80">傑昇通信</p>
                          <p className="mt-1 font-semibold text-violet-700">
                            {product.jyesPriceLabel || (product.jyesPrice ? formatCurrency(product.jyesPrice) : "--")}
                          </p>
                        </div>
                        <div className="rounded-xl bg-emerald-50 px-3 py-2">
                          <p className="text-emerald-700/80">最低價</p>
                          <p className="mt-1 font-semibold text-emerald-700">
                            {product.bestPrice == null
                              ? "--"
                              : `${formatCurrency(product.bestPrice)}${product.bestSourceLabel ? ` (${product.bestSourceLabel})` : ""}`}
                          </p>
                        </div>
                      </div>
                      {savings != null && (
                        <p className="mt-3 text-xs text-emerald-700/80">比建議售價省下 {formatCurrency(savings)}</p>
                      )}
                    </div>
                  );
                })}
              </div>

              <LandtopHistoryChart
                histories={landtopResult.histories || []}
                historyAvailable={landtopResult.historyAvailable}
              />
            </>
          )}
        </DataCard>
      ) : activeTab === "fengbro-tube" ? (
        <FengbroTubeSection
          result={tubeResult}
          loading={tubeLoading}
          error={tubeError}
          channelManagerOpen={tubeChannelManagerOpen}
          channelConfigs={tubeChannelConfigs}
          channelAliasDraft={tubeChannelAliasDraft}
          channelUrlDraft={tubeChannelUrlDraft}
          editingChannelUrl={editingTubeChannelUrl}
          onToggleChannelManager={() => setTubeChannelManagerOpen((open) => !open)}
          onChannelAliasDraftChange={setTubeChannelAliasDraft}
          onChannelUrlDraftChange={setTubeChannelUrlDraft}
          onSaveChannel={handleSaveTubeChannel}
          onEditChannel={handleEditTubeChannel}
          onDeleteChannel={handleDeleteTubeChannel}
          onCancelEditChannel={clearTubeChannelForm}
          onResetChannels={handleResetTubeChannels}
          onRefresh={() => void loadTube()}
        />
      ) : (
        <FengbroFinanceSection
          result={financeResult}
          loading={financeLoading}
          error={financeError}
          onRefresh={() => void loadFinance()}
        />
      )}
    </section>
  );
}
