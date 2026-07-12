"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowUp, BarChart3, ChevronDown, Clock, ExternalLink, Play, Plus, RefreshCw, RotateCcw, Search, Smartphone, Trash2, Wrench } from "lucide-react";
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
  downfallChannel?: FengbroTubeChannel | null;
  recentVideos: Array<FengbroTubeVideo & { channelTitle: string; channelId: string }>;
};

type FinanceRecordTag = "new-high" | "new-low" | null;

type FengbroFinanceQuote = {
  id: string;
  name: string;
  displayName: string;
  symbol: string;
  sourceUrl: string;
  localLabel?: string;
  youtubeUrl?: string;
  youtubeLabel?: string;
  youtubeLinks?: Array<{ label: string; url: string }>;
  bilibiliUrl?: string;
  imageUrl?: string;
  group: "tw" | "asia" | "korea" | "fx" | "commodities" | "rates" | "us" | "crypto" | "valuation";
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
  periodLabel?: string;
  historyRanges?: Record<string, PriceHistoryEntry[]>;
  historyErrors?: Record<string, string>;
  isThresholdAlert?: boolean;
  alertMessage?: string;
  alertThreshold?: number;
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

type CustomFinanceInstrument = {
  name: string;
  symbol: string;
  provider: "cnbc" | "yahoo";
  group: FengbroFinanceQuote["group"];
};

type DefaultFinanceInstrumentSummary = {
  id: string;
  name: string;
  symbol: string;
  provider: "cnbc" | "yahoo" | "multpl";
  group: FengbroFinanceQuote["group"];
};

const TOOL_TABS: { id: ToolsTab; label: string }[] = [
  { id: "price-compare", label: "鋒兄比價" },
  { id: "landtop", label: "手機比價" },
  { id: "fengbro-tube", label: "鋒兄Tube" },
  { id: "fengbro-finance", label: "\u92d2\u5144\u91d1\u878d" },
];

function getPlatformInfo(url?: string, title?: string, source?: string) {
  const combined = `${url} ${title} ${source}`.toLowerCase();
  if (combined.includes("pchome")) return { name: "PChome 24h", colorClass: "bg-red-50 text-red-700 border-red-200" };
  if (combined.includes("momo")) return { name: "Momo購物網", colorClass: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200" };
  if (combined.includes("shopee") || combined.includes("蝦皮")) return { name: "蝦皮購物", colorClass: "bg-orange-50 text-orange-700 border-orange-200" };
  if (combined.includes("books") || combined.includes("博客來")) return { name: "博客來", colorClass: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (combined.includes("yahoo")) return { name: "Yahoo購物中心", colorClass: "bg-purple-50 text-purple-700 border-purple-200" };
  return { name: source || "其他平台", colorClass: "bg-slate-50 text-slate-700 border-slate-200" };
}

const PRICE_SOURCES: Array<{ id: PriceSource; label: string; hint: string }> = [
  { id: "biggo-api", label: "BigGo API", hint: "查詢 BigGo 歷史價格資料" },
  { id: "local", label: "本地佔位", hint: "保留本地測試流程，不連外查價" },
];

const RECENT_KEY = "fengbro.tools.priceHistory.recent";
const SOURCE_KEY = "fengbro.tools.priceHistory.source";
const LANDTOP_QUERY_KEY = "fengbro.tools.landtop.query";
const LANDTOP_APPLE_QUERY_KEY = "fengbro.tools.landtop.appleQuery";
const LANDTOP_SAMSUNG_QUERY_KEY = "fengbro.tools.landtop.samsungQuery";
const TUBE_CHANNELS_KEY = "fengbro.tools.tube.channels";
const FINANCE_CUSTOM_INSTRUMENTS_KEY = "fengbro.tools.finance.customInstruments";
const FINANCE_DEFAULT_INSTRUMENT_IDS_KEY = "fengbro.tools.finance.defaultInstrumentIds";
const DEFAULT_FINANCE_INSTRUMENTS: DefaultFinanceInstrumentSummary[] = [
  { id: "taiex", name: "加權指數", symbol: "^TWII", provider: "yahoo", group: "tw" },
  { id: "tsmc", name: "台積電", symbol: "2330.TW", provider: "yahoo", group: "tw" },
  { id: "tsm", name: "台積電 ADR", symbol: "TSM", provider: "yahoo", group: "us" },
  { id: "dow", name: "Dow Jones Industrial Average", symbol: ".DJI", provider: "cnbc", group: "us" },
  { id: "sp500", name: "S&P 500 Index", symbol: ".SPX", provider: "cnbc", group: "us" },
  { id: "nasdaq", name: "NASDAQ Composite", symbol: ".IXIC", provider: "cnbc", group: "us" },
  { id: "phlx-semiconductor", name: "費城半導體指數", symbol: ".SOX", provider: "cnbc", group: "us" },
  { id: "berkshire-a", name: "Berkshire Hathaway Inc Class A", symbol: "BRK.A", provider: "cnbc", group: "us" },
  { id: "berkshire-b", name: "Berkshire Hathaway Inc Class B", symbol: "BRK.B", provider: "cnbc", group: "us" },
  { id: "intel", name: "Intel Corp", symbol: "INTC", provider: "cnbc", group: "us" },
  { id: "amd", name: "Advanced Micro Devices Inc", symbol: "AMD", provider: "cnbc", group: "us" },
  { id: "nvidia", name: "NVIDIA Corp", symbol: "NVDA", provider: "cnbc", group: "us" },
  { id: "micron", name: "美光科技", symbol: "MU", provider: "cnbc", group: "us" },
  { id: "spacex", name: "SpaceX", symbol: "SPCX", provider: "cnbc", group: "us" },
  { id: "apple", name: "蘋果", symbol: "AAPL", provider: "cnbc", group: "us" },
  { id: "vix", name: "CBOE Volatility Index", symbol: ".VIX", provider: "cnbc", group: "us" },
  { id: "shiller-pe", name: "Shiller PE Ratio", symbol: "CAPE", provider: "multpl", group: "valuation" },
  { id: "nikkei-225", name: "Nikkei 225 Index", symbol: ".N225", provider: "cnbc", group: "asia" },
  { id: "kioxia", name: "キオクシア 鎧俠", symbol: "285A.T", provider: "yahoo", group: "asia" },
  { id: "kospi", name: "KOSPI Index", symbol: ".KS11", provider: "cnbc", group: "asia" },
  { id: "samsung-electronics", name: "三星電子", symbol: "005930.KS", provider: "yahoo", group: "korea" },
  { id: "sk-hynix", name: "SK 海力士", symbol: "000660.KS", provider: "yahoo", group: "korea" },
  { id: "sk-hynix-adr", name: "SK hynix Inc. ADR", symbol: "SKHY", provider: "yahoo", group: "korea" },
  { id: "usd-twd", name: "美元對台幣匯率", symbol: "USDTWD=X", provider: "yahoo", group: "fx" },
  { id: "usd-jpy", name: "美元對日元匯率", symbol: "USDJPY=X", provider: "yahoo", group: "fx" },
  { id: "brent", name: "ICE Brent Crude", symbol: "@LCO.1", provider: "cnbc", group: "commodities" },
  { id: "gold", name: "Gold COMEX", symbol: "@GC.1", provider: "cnbc", group: "commodities" },
  { id: "us30y", name: "U.S. 30 Year Treasury", symbol: "US.30", provider: "cnbc", group: "rates" },
  { id: "bitcoin", name: "Bitcoin/USD Coin Metrics", symbol: "BTC.CM=", provider: "cnbc", group: "crypto" },
  { id: "ether", name: "Ether/USD Coin Metrics", symbol: "ETH.CM=", provider: "cnbc", group: "crypto" },
];
const DEFAULT_FINANCE_INSTRUMENT_IDS = DEFAULT_FINANCE_INSTRUMENTS.map((instrument) => instrument.id);

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

const FINANCE_CUSTOM_GROUPS: FengbroFinanceQuote["group"][] = ["tw", "asia", "korea", "fx", "commodities", "rates", "us", "crypto"];

function normalizeCustomFinanceInstrument(input: Partial<CustomFinanceInstrument>): CustomFinanceInstrument | null {
  const symbol = typeof input.symbol === "string" ? input.symbol.trim().toUpperCase() : "";
  if (!symbol) return null;

  const name = typeof input.name === "string" && input.name.trim() ? input.name.trim() : symbol;
  const provider = input.provider === "yahoo" ? "yahoo" : "cnbc";
  const group = FINANCE_CUSTOM_GROUPS.includes(input.group as FengbroFinanceQuote["group"])
    ? (input.group as FengbroFinanceQuote["group"])
    : "us";

  return { name, symbol, provider, group };
}

function getSavedCustomFinanceInstruments() {
  if (typeof window === "undefined") return [];

  try {
    const savedInstruments = window.localStorage.getItem(FINANCE_CUSTOM_INSTRUMENTS_KEY);
    if (!savedInstruments) return [];
    const parsedInstruments = JSON.parse(savedInstruments) as unknown;
    if (!Array.isArray(parsedInstruments)) return [];
    return parsedInstruments
      .map((instrument) => normalizeCustomFinanceInstrument(instrument as Partial<CustomFinanceInstrument>))
      .filter((instrument): instrument is CustomFinanceInstrument => instrument != null)
      .slice(0, 30);
  } catch {
    return [];
  }
}

function getSavedDefaultFinanceInstrumentIds() {
  if (typeof window === "undefined") return DEFAULT_FINANCE_INSTRUMENT_IDS;

  try {
    const savedIds = window.localStorage.getItem(FINANCE_DEFAULT_INSTRUMENT_IDS_KEY);
    if (!savedIds) return DEFAULT_FINANCE_INSTRUMENT_IDS;
    const parsedIds = JSON.parse(savedIds) as unknown;
    if (!Array.isArray(parsedIds)) return DEFAULT_FINANCE_INSTRUMENT_IDS;
    const validIds = parsedIds.filter((id): id is string =>
      typeof id === "string" && DEFAULT_FINANCE_INSTRUMENT_IDS.includes(id)
    );
    return [...new Set(validIds)];
  } catch {
    return DEFAULT_FINANCE_INSTRUMENT_IDS;
  }
}

function hasCustomTubeAlias(alias: string) {
  const normalizedAlias = alias.trim();
  return Boolean(normalizedAlias && normalizedAlias !== "未命名頻道");
}

function getSamsungDefaultLandtopQuery(date = new Date()) {
  const samsungYear = date.getMonth() < 2 ? date.getFullYear() - 1 : date.getFullYear();
  return `Samsung ${samsungYear.toString().slice(-2)}`;
}

function getAppleDefaultLandtopQuery(date = new Date()) {
  const releaseYear = date.getMonth() >= 8 ? date.getFullYear() : date.getFullYear() - 1;
  const modelNumber = releaseYear - 2008;
  return `iPhone ${modelNumber}`;
}

function getDefaultLandtopQuery() {
  return getSamsungDefaultLandtopQuery();
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
  const formatIndex = (value: string) => Number(value).toFixed(2).padStart(5, "0");
  const labelMatch = /倒台指[數数]/.exec(normalizedTitle);
  if (labelMatch) {
    const afterLabelText = normalizedTitle.slice(labelMatch.index + labelMatch[0].length, labelMatch.index + labelMatch[0].length + 80);
    const movementValue = afterLabelText.match(new RegExp(`(?:飆至|飙至|升至|漲至|涨至|達到|达到|達|达|至|突破|破)\\s*${numberPattern}`));
    if (movementValue?.[1]) return formatIndex(movementValue[1]);

    const afterLabelNumbers = [...afterLabelText.matchAll(new RegExp(numberPattern, "g"))];
    const firstNonDateNumber = afterLabelNumbers.find((match) => {
      const nextText = afterLabelText.slice((match.index || 0) + match[0].length).trimStart();
      return !/^[月日號号]/.test(nextText);
    });
    if (firstNonDateNumber?.[1]) return formatIndex(firstNonDateNumber[1]);
  }
  const beforeLabel = normalizedTitle.match(new RegExp(`${numberPattern}\\s*(?:分|%|％)?\\s*倒台指[數数]`));
  return beforeLabel?.[1] ? formatIndex(beforeLabel[1]) : "";
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

const HARDCODED_DOWNFALL_INDEX_HISTORY: PriceHistoryEntry[] = [
  { date: "2023-10-01T00:00:00Z", price: 67.44 },
  { date: "2023-11-01T00:00:00Z", price: 68.28 },
  { date: "2024-06-01T00:00:00Z", price: 70.58 },
];

function getAllChannelDownfallIndexUpdates(channel: FengbroTubeChannel | undefined): PriceHistoryEntry[] {
  if (!channel) return HARDCODED_DOWNFALL_INDEX_HISTORY;
  const isHenrenChannel = /henren778/i.test(channel.sourceUrl) || /一[個个]狠人/.test(channel.title);
  if (!isHenrenChannel) return HARDCODED_DOWNFALL_INDEX_HISTORY;

  const dynamicPoints = channel.videos
    .map((video) => ({ video, value: extractTubeDownfallIndex(video.title) }))
    .filter((item) => item.value)
    .map(item => ({ date: item.video.publishedAt, price: Number(item.value) }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const lastHardcodedDate = new Date(HARDCODED_DOWNFALL_INDEX_HISTORY[HARDCODED_DOWNFALL_INDEX_HISTORY.length - 1].date).getTime();
  const newDynamicPoints = dynamicPoints.filter(p => new Date(p.date).getTime() > lastHardcodedDate);

  return [...HARDCODED_DOWNFALL_INDEX_HISTORY, ...newDynamicPoints];
}

const FENGBRO_TUBE_TOP_ID = "fengbro-tube-top";

function getTubeChannelAnchor(index: number) {
  return `fengbro-tube-channel-${index}`;
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
    korea: "韓股",
    fx: "匯率",
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

const FENGBRO_FINANCE_TOP_ID = "fengbro-finance-top";

function getFinanceGroupAnchor(group: FengbroFinanceQuote["group"]) {
  return `fengbro-finance-${group}`;
}

function getFinanceQuoteSortValue(quote: FengbroFinanceQuote) {
  return typeof quote.price === "number" && Number.isFinite(quote.price)
    ? quote.price
    : Number.NEGATIVE_INFINITY;
}

const FINANCE_HISTORY_RANGE_ITEMS = [
  { key: "1y", label: "最近一年走勢" },
  { key: "5y", label: "最近五年走勢" },
  { key: "10y", label: "最近十年走勢" },
  { key: "20y", label: "最近二十年走勢" },
  { key: "30y", label: "最近三十年走勢" },
];

function FinanceHistoryChart({
  quote,
  rangeKey,
  label,
}: {
  quote: FengbroFinanceQuote;
  rangeKey: string;
  label: string;
}) {
  const chart = useMemo(() => {
    const priced = (quote.historyRanges?.[rangeKey] || []).filter(
      (entry): entry is PriceHistoryEntry & { price: number } => typeof entry.price === "number"
    );
    if (priced.length < 2) return null;

    const width = 420;
    const height = 120;
    const padding = { top: 14, right: 10, bottom: 18, left: 10 };
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;
    const prices = priced.map((entry) => entry.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const domain = Math.max(maxPrice - minPrice, Math.max(1, maxPrice * 0.02));
    const domainMin = minPrice - domain * 0.1;
    const domainMax = maxPrice + domain * 0.1;
    const adjustedDomain = Math.max(domainMax - domainMin, 1);
    const points = priced.map((entry, index) => {
      const x = padding.left + (index / (priced.length - 1)) * innerWidth;
      const y = padding.top + ((domainMax - entry.price) / adjustedDomain) * innerHeight;
      return { ...entry, x, y };
    });
    const linePath = buildChartPath(points);
    const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${(height - padding.bottom).toFixed(2)} L ${points[0].x.toFixed(2)} ${(height - padding.bottom).toFixed(2)} Z`;
    const earliest = priced[0];
    const latest = priced[priced.length - 1];
    const changePercent = earliest.price ? ((latest.price - earliest.price) / earliest.price) * 100 : null;

    return {
      width,
      height,
      areaPath,
      linePath,
      minPrice,
      maxPrice,
      earliest,
      latest,
      changePercent,
      isUp: latest.price >= earliest.price,
      gradientId: `financeHistoryArea-${quote.id}-${rangeKey}`,
    };
  }, [quote.historyRanges, quote.id, rangeKey]);

  if (!chart) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-3 py-4 text-center text-xs text-muted-foreground">
        {label}暫無資料{quote.historyErrors?.[rangeKey] ? `：${quote.historyErrors[rangeKey]}` : ""}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.98))]">
      <div className="flex items-center justify-between gap-3 px-3 pt-3 text-xs">
        <div>
          <p className="font-semibold text-slate-700">{label}</p>
          <p className="mt-0.5 text-muted-foreground">
            {chart.earliest.date.slice(0, 7)} - {chart.latest.date.slice(0, 7)}
          </p>
        </div>
        <div className={`text-right font-semibold ${chart.isUp ? "text-emerald-700" : "text-red-600"}`}>
          <p>{chart.changePercent != null ? `${chart.changePercent >= 0 ? "+" : ""}${formatFinanceNumber(chart.changePercent, 2)}%` : "--"}</p>
          <p className="text-[11px] font-medium text-muted-foreground">
            {formatFinanceNumber(chart.minPrice, 2)} / {formatFinanceNumber(chart.maxPrice, 2)}
          </p>
        </div>
      </div>
      <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className="h-28 w-full">
        <defs>
          <linearGradient id={chart.gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={chart.isUp ? "rgba(16,185,129,0.30)" : "rgba(239,68,68,0.28)"} />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
        <path d={chart.areaPath} fill={`url(#${chart.gradientId})`} />
        <path
          d={chart.linePath}
          fill="none"
          stroke={chart.isUp ? "rgb(5,150,105)" : "rgb(220,38,38)"}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
        />
      </svg>
    </div>
  );
}

function FinanceHistoryPanels({ quote }: { quote: FengbroFinanceQuote }) {
  return (
    <div className="mt-4 space-y-2">
      {FINANCE_HISTORY_RANGE_ITEMS.map((item, index) => (
        <details
          key={item.key}
          className="group rounded-2xl border border-slate-100 bg-white/80 shadow-sm open:border-emerald-200 open:bg-emerald-50/30"
          open={index === 0}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-semibold text-slate-700">
            <span>{item.label}</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 group-open:bg-emerald-100 group-open:text-emerald-700">
              可折疊
            </span>
          </summary>
          <div className="px-3 pb-3">
            <FinanceHistoryChart quote={quote} rangeKey={item.key} label={item.label} />
          </div>
        </details>
      ))}
    </div>
  );
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
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

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

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!chart || chart.points.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const scaleX = chart.width / rect.width;
    const svgX = x * scaleX;
    
    let closestIndex = 0;
    let minDiff = Infinity;
    chart.points.forEach((point, index) => {
      const diff = Math.abs(point.x - svgX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = index;
      }
    });
    setHoveredIndex(closestIndex);
  };

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
          <svg 
            viewBox={`0 0 ${chart.width} ${chart.height}`} 
            className="h-[260px] w-full cursor-crosshair"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredIndex(null)}
          >
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
            {hoveredIndex !== null && (
              <line
                x1={chart.points[hoveredIndex].x}
                x2={chart.points[hoveredIndex].x}
                y1={0}
                y2={chart.height}
                stroke="rgba(217, 119, 6, 0.4)"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
            )}
            {chart.points.map((point, index) => {
              const isHovered = index === hoveredIndex;
              const isLast = index === chart.points.length - 1;
              return (
                <circle
                  key={`${point.date}-${index}`}
                  cx={point.x}
                  cy={point.y}
                  fill={isHovered ? "rgba(217, 119, 6, 1)" : "white"}
                  r={isHovered ? 8 : (isLast ? 6 : 4.5)}
                  stroke="rgba(217, 119, 6, 0.96)"
                  strokeWidth={isHovered ? "4" : "3"}
                  className="transition-all duration-200"
                />
              );
            })}
          </svg>
          
          {hoveredIndex !== null && (
            <div 
              className="absolute pointer-events-none rounded-xl border border-amber-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm transition-all duration-75 z-10"
              style={{
                left: `max(16px, min(calc(100% - 120px), calc(${(chart.points[hoveredIndex].x / chart.width) * 100}% - 60px)))`,
                top: `max(16px, min(calc(100% - 80px), calc(${(chart.points[hoveredIndex].y / chart.height) * 100}% - 70px)))`
              }}
            >
              <p className="text-xs font-semibold text-amber-700/80">
                {new Date(chart.points[hoveredIndex].date).toLocaleDateString()}
              </p>
              <p className="mt-1 text-lg font-bold text-amber-900">
                {formatPriceWithCurrency(chart.points[hoveredIndex].price, chart.currency)}
              </p>
            </div>
          )}
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
  const channelNavOpenState = useState(false);
  const [channelNavOpen, setChannelNavOpen] = channelNavOpenState;
  
  const visibleChannels = useMemo(() => {
    return result?.channels.filter(c => !c.sourceUrl.includes("henren778")) || [];
  }, [result]);
  
  const channelCount = result ? visibleChannels.length : channelConfigs.length;
  const resolvedChannelTitleBySource = useMemo(() => {
    return new Map((result?.channels || []).map((channel) => [channel.sourceUrl, channel.title]));
  }, [result]);
  const getChannelConfigLabel = (channel: FengbroTubeChannelConfig) =>
    hasCustomTubeAlias(channel.alias)
      ? channel.alias
      : getFengbroTubeFallbackTitle(channel.sourceUrl, resolvedChannelTitleBySource.get(channel.sourceUrl) || "");

  return (
    <div id={FENGBRO_TUBE_TOP_ID} className="space-y-5 scroll-mt-6">
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
            <div className="sticky top-3 z-20 rounded-[24px] border border-red-100 bg-white/95 shadow-sm backdrop-blur">
              <button
                type="button"
                onClick={() => setChannelNavOpen((prev) => !prev)}
                className="flex w-full items-center justify-between gap-3 p-3 text-left"
                aria-expanded={channelNavOpen}
              >
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-foreground">頻道導航</h4>
                  <p className="mt-0.5 text-xs text-muted-foreground">{visibleChannels.length} 個頻道</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] transition-colors ${channelNavOpen ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}`}>
                  {channelNavOpen ? "收合 ▲" : "展開 ▼"}
                </span>
              </button>
              {channelNavOpen && (
                <div className="border-t border-red-50 px-3 pb-3">
                  <div className="flex items-center justify-between gap-3 py-2">
                    <a
                      href={`#${FENGBRO_TUBE_TOP_ID}`}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:border-red-200 hover:bg-red-100"
                    >
                      <ArrowUp size={13} />
                      頂端
                    </a>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-7">
                    {visibleChannels.map((channel, index) => (
                      <a
                        key={channel.sourceUrl}
                        href={`#${getTubeChannelAnchor(index)}`}
                        className="inline-flex min-w-0 items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                        title={channel.title}
                      >
                        <Play size={12} className="shrink-0" />
                        <span className="min-w-0 truncate">{channel.title}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

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
              {visibleChannels.map((channel, index) => {
                const downfallIndexUpdate = getChannelDownfallIndexUpdate(channel);

                return (
                <div id={getTubeChannelAnchor(index)} key={channel.sourceUrl} className="min-w-0 max-w-full scroll-mt-28 overflow-hidden rounded-[28px] border border-border bg-white p-4 shadow-sm">
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
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      {channel.error ? (
                        <span className="rounded-full bg-red-50 px-3 py-1 text-xs text-red-600">{channel.error}</span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-muted-foreground">
                          {channel.videos.length} 部影片
                        </span>
                      )}
                      <a
                        href={`#${FENGBRO_TUBE_TOP_ID}`}
                        className="inline-flex items-center gap-1 rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 transition hover:border-red-200 hover:bg-red-100"
                      >
                        <ArrowUp size={12} />
                        頂端
                      </a>
                    </div>
                  </div>
                  <div className="grid min-w-0 justify-center gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),320px))]">
                    {channel.videos.map((video) => (
                      <a
                        key={video.videoId}
                        href={video.url}
                        target="_blank"
                        rel="noreferrer"
                        className="group min-w-0 overflow-hidden rounded-2xl border border-border bg-slate-50 transition hover:border-red-300 hover:bg-white hover:shadow-md"
                      >
                        <div className="aspect-video w-full overflow-hidden bg-red-50">
                          {video.thumbnail ? (
                            <img src={video.thumbnail} alt={video.title} className="h-full w-full object-cover transition group-hover:scale-[1.03]" loading="lazy" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-red-500">
                              <Play size={24} />
                            </div>
                          )}
                        </div>
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

            {/* 倒台指數獨立區塊 */}
            {(() => {
              const henrenChannel = result.downfallChannel || result.channels.find(c => c.sourceUrl.includes("henren778"));
              let downfallIndexUpdate = henrenChannel ? getChannelDownfallIndexUpdate(henrenChannel) : null;
              const historyEntries = getAllChannelDownfallIndexUpdates(henrenChannel);
              
              if (!downfallIndexUpdate && historyEntries.length > 0) {
                 const lastEntry = historyEntries[historyEntries.length - 1];
                 downfallIndexUpdate = {
                    value: lastEntry.price.toFixed(2),
                    title: "倒台指數歷史紀錄",
                    url: "https://www.youtube.com/@henren778",
                    publishedAt: lastEntry.date
                 };
              }
              if (!downfallIndexUpdate) return null;
              
              const pseudoQuote: FengbroFinanceQuote = {
                id: "downfall-index",
                name: "倒台指數",
                displayName: "倒台指數",
                symbol: "DFI",
                sourceUrl: "https://www.youtube.com/@henren778",
                group: "us",
                price: null,
                change: null,
                changePercent: null,
                currency: "",
                high52: null,
                low52: null,
                dayHigh: null,
                dayLow: null,
                lastUpdated: new Date().toISOString(),
                recordTag: null,
                historyRanges: {
                  "1y": historyEntries
                }
              };

              return (
                <div className="mt-8 flex flex-col items-center gap-4">
                  <a
                    href={downfallIndexUpdate.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex flex-col items-center gap-1 rounded-3xl border-2 border-amber-200 bg-gradient-to-b from-amber-50 to-white px-8 py-4 shadow-sm transition hover:scale-105 hover:border-amber-400 hover:shadow-md"
                    title={downfallIndexUpdate.title}
                  >
                    <span className="text-sm font-bold text-amber-700 tracking-wider">📊 倒台指數</span>
                    <span className="text-4xl font-black text-amber-600 tracking-tighter">{downfallIndexUpdate.value}</span>
                    <span className="text-xs text-amber-600/70 font-medium mt-1">
                      {formatPublishedDate(downfallIndexUpdate.publishedAt)} 更新
                    </span>
                  </a>
                  
                  {historyEntries.length > 1 && (
                    <div className="w-full max-w-md rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
                      <FinanceHistoryChart quote={pseudoQuote} rangeKey="1y" label="倒台指數走勢圖" />
                    </div>
                  )}
                </div>
              );
            })()}

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
  defaultInstruments,
  selectedDefaultInstrumentIds,
  onAddDefaultInstrument,
  onDeleteDefaultInstrument,
  onResetDefaultInstruments,
  customInstruments,
  customDraft,
  onCustomDraftChange,
  onSaveCustomInstrument,
  onDeleteCustomInstrument,
  onRefresh,
}: {
  result: FengbroFinanceResult | null;
  loading: boolean;
  error: string;
  defaultInstruments: DefaultFinanceInstrumentSummary[];
  selectedDefaultInstrumentIds: string[];
  onAddDefaultInstrument: (id: string) => void;
  onDeleteDefaultInstrument: (id: string) => void;
  onResetDefaultInstruments: () => void;
  customInstruments: CustomFinanceInstrument[];
  customDraft: CustomFinanceInstrument;
  onCustomDraftChange: (draft: CustomFinanceInstrument) => void;
  onSaveCustomInstrument: () => void;
  onDeleteCustomInstrument: (instrument: CustomFinanceInstrument) => void;
  onRefresh: () => void;
}) {
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const groupedQuotes = useMemo(() => {
    const order: FengbroFinanceQuote["group"][] = ["tw", "us", "valuation", "asia", "korea", "fx", "commodities", "rates", "crypto"];
    const query = searchQuery.trim().toLowerCase();
    return order
      .map((group) => ({
        group,
        quotes: (result?.quotes || [])
          .filter((quote) => quote.group === group)
          .filter((quote) => {
            if (!query) return true;
            return (
              quote.name.toLowerCase().includes(query) ||
              quote.symbol.toLowerCase().includes(query) ||
              (quote.localLabel && quote.localLabel.toLowerCase().includes(query))
            );
          })
          .sort((left, right) => getFinanceQuoteSortValue(right) - getFinanceQuoteSortValue(left)),
      }))
      .filter((item) => item.quotes.length > 0);
  }, [result, searchQuery]);
  const selectedDefaultIdSet = useMemo(() => new Set(selectedDefaultInstrumentIds), [selectedDefaultInstrumentIds]);
  const selectedDefaultInstruments = useMemo(
    () => defaultInstruments.filter((instrument) => selectedDefaultIdSet.has(instrument.id)),
    [defaultInstruments, selectedDefaultIdSet]
  );
  const deletedDefaultInstruments = useMemo(
    () => defaultInstruments.filter((instrument) => !selectedDefaultIdSet.has(instrument.id)),
    [defaultInstruments, selectedDefaultIdSet]
  );

  return (
    <div className="space-y-5">
      <DataCard className="overflow-hidden p-0">
        <div
          id={FENGBRO_FINANCE_TOP_ID}
          className="flex flex-col gap-4 border-b border-emerald-100 bg-[linear-gradient(135deg,rgba(236,253,245,0.98),rgba(255,255,255,0.96))] p-6 lg:flex-row lg:items-end lg:justify-between"
        >
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

        <div className="border-b border-emerald-100 bg-white/80 p-4 sm:p-6">
          <div className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50/70">
            <button
              type="button"
              onClick={() => setWatchlistOpen((prev) => !prev)}
              className="flex w-full cursor-pointer items-center justify-between gap-3 p-4 text-left"
              aria-expanded={watchlistOpen}
            >
              <div>
                <p className="text-sm font-semibold text-emerald-950">預設追蹤清單</p>
                <p className="mt-1 text-xs text-emerald-800/80">
                  已啟用 {selectedDefaultInstruments.length} / {defaultInstruments.length} 個預設標的，可刪除、加回或重設。
                </p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[11px] transition-colors ${watchlistOpen ? "bg-white text-emerald-800" : "bg-emerald-100 text-emerald-700"}`}>
                {watchlistOpen ? "收合 ▲" : "展開 ▼"}
              </span>
            </button>
            {watchlistOpen && (
              <div className="border-t border-emerald-100 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <select
                      value=""
                      onChange={(event) => {
                        if (event.target.value) onAddDefaultInstrument(event.target.value);
                      }}
                      disabled={deletedDefaultInstruments.length === 0}
                      className="h-10 min-w-[220px] rounded-xl border border-emerald-100 bg-white px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="">{deletedDefaultInstruments.length ? "加回預設標的" : "預設標的已全數啟用"}</option>
                      {deletedDefaultInstruments.map((instrument) => (
                        <option key={instrument.id} value={instrument.id}>
                          {instrument.name} ({instrument.symbol})
                        </option>
                      ))}
                    </select>
                    <Button type="button" variant="outline" onClick={onResetDefaultInstruments} className="h-10 gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                      <RotateCcw size={16} />
                      重設預設
                    </Button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedDefaultInstruments.map((instrument) => (
                    <span
                      key={instrument.id}
                      className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white px-3 py-1 text-xs text-emerald-900 shadow-sm"
                    >
                      <span className="font-semibold">{instrument.name}</span>
                      <span className="text-emerald-700">{instrument.symbol}</span>
                      <button
                        type="button"
                        onClick={() => onDeleteDefaultInstrument(instrument.id)}
                        className="rounded-full p-0.5 text-emerald-700 hover:bg-emerald-50 hover:text-red-600"
                        aria-label={`刪除 ${instrument.name}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.2fr_0.9fr_0.9fr_0.9fr_auto] lg:items-end">
            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-foreground">名稱</span>
              <input
                value={customDraft.name}
                onChange={(event) => onCustomDraftChange({ ...customDraft, name: event.target.value })}
                placeholder="Intel Corp"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-foreground">代號</span>
              <input
                value={customDraft.symbol}
                onChange={(event) => onCustomDraftChange({ ...customDraft, symbol: event.target.value })}
                placeholder="INTC / ^TWII / .IXIC"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm uppercase outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-foreground">來源</span>
              <select
                value={customDraft.provider}
                onChange={(event) => onCustomDraftChange({ ...customDraft, provider: event.target.value as CustomFinanceInstrument["provider"] })}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="cnbc">CNBC</option>
                <option value="yahoo">Yahoo</option>
              </select>
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-foreground">分類</span>
              <select
                value={customDraft.group}
                onChange={(event) => onCustomDraftChange({ ...customDraft, group: event.target.value as FengbroFinanceQuote["group"] })}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              >
                {FINANCE_CUSTOM_GROUPS.map((group) => (
                  <option key={group} value={group}>
                    {getFinanceGroupLabel(group)}
                  </option>
                ))}
              </select>
            </label>
            <Button type="button" onClick={onSaveCustomInstrument} className="h-10 gap-2 bg-emerald-600 hover:bg-emerald-700">
              <Plus size={16} />
              新增
            </Button>
          </div>

          {customInstruments.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {customInstruments.map((instrument) => (
                <span
                  key={`${instrument.provider}-${instrument.symbol}`}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs text-emerald-800"
                >
                  <span className="font-semibold">{instrument.name}</span>
                  <span>{instrument.provider.toUpperCase()}: {instrument.symbol}</span>
                  <button
                    type="button"
                    onClick={() => onDeleteCustomInstrument(instrument)}
                    className="rounded-full p-0.5 text-emerald-700 hover:bg-white hover:text-red-600"
                    aria-label={`刪除 ${instrument.name}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {error && <div className="m-6 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

        {!error && loading && !result && (
          <div className="p-8 text-center text-sm text-muted-foreground">正在讀取 CNBC 金融報價...</div>
        )}

        {!error && result && (
          <div className="space-y-6 p-4 sm:p-6">
            {groupedQuotes.length > 0 && (
              <div className="rounded-[22px] border border-emerald-100 bg-emerald-50/70 p-3 shadow-sm">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {groupedQuotes.map(({ group, quotes }) => (
                    <a
                      key={group}
                      href={`#${getFinanceGroupAnchor(group)}`}
                      className="shrink-0 rounded-full border border-emerald-100 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50"
                    >
                      {getFinanceGroupLabel(group)}
                      <span className="ml-1 text-emerald-500">{quotes.length}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
            {/* ── 精選焦點區塊 ─────────────────────────────────────── */}
            {(() => {
              const featuredIds = ["gold", "kospi", "nikkei-225", "phlx-semiconductor", "tsmc", "bitcoin"];
              const featuredQuotes = featuredIds
                .map((id) => (result?.quotes || []).find((q) => q.id === id))
                .filter((q): q is NonNullable<typeof q> => !!q)
                .sort((a, b) => (b.price || 0) - (a.price || 0));
              if (featuredQuotes.length === 0) return null;
              const featuredLabels: Record<string, { title: string; subtitle: string; accentClass: string; bgClass: string; borderClass: string }> = {
                gold: {
                  title: "Gold COMEX",
                  subtitle: "黃金期貨 @GC.1",
                  accentClass: "text-amber-600",
                  bgClass: "bg-[linear-gradient(135deg,rgba(254,243,199,0.8),rgba(255,255,255,0.98))]",
                  borderClass: "border-amber-200",
                },
                kospi: {
                  title: "KOSPI Index",
                  subtitle: "韓國綜合指數 코스피",
                  accentClass: "text-sky-700",
                  bgClass: "bg-[linear-gradient(135deg,rgba(224,242,254,0.95),rgba(255,255,255,0.98))]",
                  borderClass: "border-sky-200",
                },
                "nikkei-225": {
                  title: "Nikkei 225 Index",
                  subtitle: "日經平均指數 日経平均株価",
                  accentClass: "text-rose-700",
                  bgClass: "bg-[linear-gradient(135deg,rgba(255,228,230,0.95),rgba(255,255,255,0.98))]",
                  borderClass: "border-rose-200",
                },
                "phlx-semiconductor": {
                  title: "費城半導體指數",
                  subtitle: "Philadelphia Semiconductor · SOX",
                  accentClass: "text-violet-700",
                  bgClass: "bg-[linear-gradient(135deg,rgba(237,233,254,0.95),rgba(255,255,255,0.98))]",
                  borderClass: "border-violet-200",
                },
                tsmc: {
                  title: "台積電",
                  subtitle: "Taiwan Semiconductor · 2330.TW",
                  accentClass: "text-emerald-700",
                  bgClass: "bg-[linear-gradient(135deg,rgba(209,250,229,0.95),rgba(255,255,255,0.98))]",
                  borderClass: "border-emerald-200",
                },
                bitcoin: {
                  title: "Bitcoin",
                  subtitle: "比特幣 BTC",
                  accentClass: "text-amber-700",
                  bgClass: "bg-[linear-gradient(135deg,rgba(254,243,199,0.95),rgba(255,255,255,0.98))]",
                  borderClass: "border-amber-200",
                },
              };
              return (
                <div>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">精選焦點</p>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-6">
                    {featuredQuotes.map((quote, idx) => {
                      const cfg = featuredLabels[quote.id] ?? {
                        title: quote.name,
                        subtitle: quote.symbol,
                        accentClass: "text-emerald-700",
                        bgClass: "bg-white",
                        borderClass: "border-slate-200",
                      };
                      const isUp = (quote.change || 0) >= 0;
                      const recordLabel = getFinanceRecordLabel(quote.recordTag);
                      return (
                        <div
                          key={quote.id}
                          className={`relative overflow-hidden rounded-[28px] border ${cfg.borderClass} ${cfg.bgClass} p-5 shadow-sm transition hover:shadow-md`}
                        >
                          {/* 區塊序號 */}
                          <span className={`absolute right-4 top-4 text-[11px] font-semibold uppercase tracking-widest opacity-40 ${cfg.accentClass}`}>
                            BLOCK {idx + 1}
                          </span>

                          {/* 標題 */}
                          <div className="mb-4 pr-16">
                            <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${cfg.accentClass} opacity-80`}>
                              {cfg.subtitle}
                            </p>
                            <h4 className="mt-1 text-lg font-semibold text-foreground leading-tight">{cfg.title}</h4>
                            {(quote.localLabel || recordLabel) && (
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {quote.localLabel && (
                                  <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                                    {quote.localLabel}
                                  </span>
                                )}
                                {recordLabel && (
                                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold border ${quote.recordTag === "new-high" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-sky-50 text-sky-700 border-sky-200"}`}>
                                    {recordLabel}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* 價格 & 漲跌 */}
                          {quote.error ? (
                            <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">{quote.error}</p>
                          ) : (
                            <>
                              {quote.imageUrl && (
                                <img
                                  src={quote.imageUrl}
                                  alt={`${quote.name} image`}
                                  className="mb-4 aspect-[4/3] w-full rounded-xl border border-slate-200 bg-slate-950/5 object-cover shadow-sm"
                                  loading="lazy"
                                />
                              )}
                              <div className="flex items-end justify-between gap-2">
                                <div>
                                  <p className="text-xs text-muted-foreground">最新價</p>
                                  <p className="mt-0.5 text-3xl font-bold text-foreground tabular-nums">
                                    {formatFinanceNumber(quote.price, 2)}
                                    {quote.currency && (
                                      <span className="ml-1 text-sm font-medium text-muted-foreground">{quote.currency}</span>
                                    )}
                                  </p>
                                </div>
                                <div className={`text-right text-sm font-semibold tabular-nums ${isUp ? "text-emerald-700" : "text-red-600"}`}>
                                  <p>{isUp ? "+" : ""}{formatFinanceNumber(quote.change, 2)}</p>
                                  <p className="text-base">{isUp ? "+" : ""}{formatFinanceNumber(quote.changePercent, 2)}%</p>
                                </div>
                              </div>

                              {/* 52W High / Low */}
                              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                <div className="rounded-xl bg-white/70 px-3 py-2 border border-slate-100">
                                  <p className="text-muted-foreground">52W High</p>
                                  <p className="mt-0.5 font-semibold">{formatFinanceNumber(quote.high52, 2)}</p>
                                </div>
                                <div className="rounded-xl bg-white/70 px-3 py-2 border border-slate-100">
                                  <p className="text-muted-foreground">52W Low</p>
                                  <p className="mt-0.5 font-semibold">{formatFinanceNumber(quote.low52, 2)}</p>
                                </div>
                              </div>

                              {/* 走勢圖（最近一年） */}
                              <div className="mt-3">
                                <FinanceHistoryChart quote={quote} rangeKey="1y" label="最近一年走勢" />
                              </div>

                              {/* 外部連結 */}
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {quote.youtubeUrl && (
                                  <a href={quote.youtubeUrl} target="_blank" rel="noreferrer" className="rounded-full border border-red-100 bg-red-50 px-2.5 py-1 text-xs text-red-700 hover:bg-red-100">
                                    {quote.youtubeLabel || "YouTube"} <Play className="inline h-3 w-3" />
                                  </a>
                                )}
                                {quote.youtubeLinks?.map((link) => (
                                  <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className="rounded-full border border-red-100 bg-red-50 px-2.5 py-1 text-xs text-red-700 hover:bg-red-100">
                                    {link.label} <Play className="inline h-3 w-3" />
                                  </a>
                                ))}
                                {quote.bilibiliUrl && (
                                  <a href={quote.bilibiliUrl} target="_blank" rel="noreferrer" className="rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-xs text-sky-700 hover:bg-sky-100">
                                    Bilibili <Play className="inline h-3 w-3" />
                                  </a>
                                )}
                                <a href={quote.sourceUrl} target="_blank" rel="noreferrer" className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50">
                                  {quote.provider === "yahoo" ? "Yahoo" : "CNBC"} <ExternalLink className="inline h-3 w-3" />
                                </a>
                              </div>

                              {quote.alertMessage && (
                                <p className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                                  {quote.alertMessage}
                                </p>
                              )}

                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
            {/* ── END 精選焦點區塊 ─────────────────────────────────── */}

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
            {/* ── 搜尋列 ─────────────────────────────────────── */}
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <Search className="h-4 w-4 text-emerald-600/60" />
              </div>
              <input
                type="text"
                placeholder="搜尋金融標的名稱或代號..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full rounded-[20px] border border-emerald-100 bg-white/60 py-3.5 pl-11 pr-4 text-sm text-emerald-950 placeholder-emerald-600/50 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50"
              />
            </div>
            {groupedQuotes.length === 0 && searchQuery && (
              <div className="rounded-[24px] border border-emerald-100 bg-white/60 p-8 text-center shadow-sm">
                <p className="text-sm font-medium text-emerald-800">找不到符合「{searchQuery}」的標的</p>
                <Button variant="link" onClick={() => setSearchQuery("")} className="mt-2 text-emerald-600">
                  清除搜尋
                </Button>
              </div>
            )}
            {groupedQuotes.map(({ group, quotes }) => (
              <div key={group} id={getFinanceGroupAnchor(group)} className="scroll-mt-28 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold text-emerald-800">{getFinanceGroupLabel(group)}</h4>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700">{quotes.length} 項</span>
                    <a
                      href={`#${FENGBRO_FINANCE_TOP_ID}`}
                      className="rounded-full border border-emerald-100 bg-white px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50"
                    >
                      回到最頂端
                    </a>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {quotes.map((quote) => {
                    const recordLabel = getFinanceRecordLabel(quote.recordTag);
                    const isUp = (quote.change || 0) >= 0;
                    return (
                      <div key={quote.id} className="rounded-[24px] border border-border bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-md">
                        <div className="flex flex-col gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h5 className="font-semibold text-foreground">{quote.name}</h5>
                              {quote.localLabel && (
                                <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                                  {quote.localLabel}
                                </span>
                              )}
                              {quote.periodLabel && (
                                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                  {quote.periodLabel}
                                </span>
                              )}
                              {recordLabel && (
                                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${quote.recordTag === "new-high" ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-sky-50 text-sky-700 border border-sky-200"}`}>
                                  {recordLabel}
                                </span>
                              )}
                              {quote.isThresholdAlert && (
                                <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                                  突破門檻
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{quote.symbol}</p>
                          </div>
                          <div className="flex w-full flex-wrap justify-start gap-1.5">
                            {quote.youtubeUrl && (
                              <a href={quote.youtubeUrl} target="_blank" rel="noreferrer" className="rounded-full border border-red-100 bg-red-50 px-2.5 py-1 text-xs text-red-700 hover:bg-red-100">
                                {quote.youtubeLabel || "YouTube"} <Play className="inline h-3 w-3" />
                              </a>
                            )}
                            {quote.youtubeLinks?.map((link) => (
                              <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className="rounded-full border border-red-100 bg-red-50 px-2.5 py-1 text-xs text-red-700 hover:bg-red-100">
                                {link.label} <Play className="inline h-3 w-3" />
                              </a>
                            ))}
                            {quote.bilibiliUrl && (
                              <a href={quote.bilibiliUrl} target="_blank" rel="noreferrer" className="rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-xs text-sky-700 hover:bg-sky-100">
                                Bilibili <Play className="inline h-3 w-3" />
                              </a>
                            )}
                            <a href={quote.sourceUrl} target="_blank" rel="noreferrer" className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700 hover:bg-emerald-100">
                              {quote.provider === "yahoo" ? "Yahoo" : quote.provider === "multpl" || quote.id === "shiller-pe" ? "Multpl" : "CNBC"} <ExternalLink className="inline h-3 w-3" />
                            </a>
                          </div>
                        </div>

                        {quote.imageUrl ? (
                          <img
                            src={quote.imageUrl}
                            alt={`${quote.name} image`}
                            className="mt-4 aspect-[16/9] w-full rounded-2xl border border-emerald-100 bg-slate-950/5 object-contain shadow-sm"
                            loading="lazy"
                          />
                        ) : null}

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
                            <FinanceHistoryPanels quote={quote} />
                            {quote.recordNote ? (
                              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                {quote.recordNote}
                              </p>
                            ) : null}
                            {quote.alertMessage ? (
                              <p className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                                {quote.alertMessage}
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

function LandtopProductCard({ product }: { product: LandtopProduct }) {
  const savings =
    product.bestPrice && product.suggestedPrice
      ? product.suggestedPrice - product.bestPrice
      : null;

  return (
    <div className="group rounded-2xl border border-border bg-white/80 p-4 shadow-sm backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:border-sky-400 hover:shadow-md hover:shadow-sky-100 dark:border-slate-800 dark:bg-[#1f2022]/80 dark:hover:shadow-sky-900/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground transition-colors group-hover:text-sky-700 dark:group-hover:text-sky-400">{product.name}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">{product.brand}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {product.sourceUrl && (
            <a
              href={product.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-sky-200/60 bg-sky-50/60 px-2.5 py-1 text-xs font-medium text-sky-700 transition hover:border-sky-300 hover:bg-sky-100 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-400 dark:hover:bg-sky-500/20"
              title="查看地標網通"
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
              className="inline-flex items-center gap-1 rounded-full border border-violet-200/60 bg-violet-50/60 px-2.5 py-1 text-xs font-medium text-violet-700 transition hover:border-violet-300 hover:bg-violet-100 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-400 dark:hover:bg-violet-500/20"
              title="查看傑昇通信"
            >
              傑昇通信
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs lg:grid-cols-4">
        <div className="rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2 transition-colors group-hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50 dark:group-hover:bg-slate-800">
          <p className="text-muted-foreground">建議售價</p>
          <p className="mt-1 font-semibold">{formatCurrency(product.suggestedPrice)}</p>
        </div>
        <div className="rounded-xl border border-sky-100 bg-sky-50/50 px-3 py-2 transition-colors group-hover:bg-sky-50 dark:border-sky-900/50 dark:bg-sky-900/20 dark:group-hover:bg-sky-900/40">
          <p className="text-sky-700/80 dark:text-sky-400/80">地標網通</p>
          <p className="mt-1 font-semibold text-sky-700 dark:text-sky-400">{product.landtopPriceLabel}</p>
        </div>
        <div className="rounded-xl border border-violet-100 bg-violet-50/50 px-3 py-2 transition-colors group-hover:bg-violet-50 dark:border-violet-900/50 dark:bg-violet-900/20 dark:group-hover:bg-violet-900/40">
          <p className="text-violet-700/80 dark:text-violet-400/80">傑昇通信</p>
          <p className="mt-1 font-semibold text-violet-700 dark:text-violet-400">
            {product.jyesPriceLabel || (product.jyesPrice ? formatCurrency(product.jyesPrice) : "--")}
          </p>
        </div>
        <div className="relative overflow-hidden rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2 transition-colors group-hover:bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:group-hover:bg-emerald-900/40">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-100/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100 dark:from-emerald-500/10" />
          <p className="relative z-10 text-emerald-700/80 dark:text-emerald-400/80">最低價</p>
          <p className="relative z-10 mt-1 font-semibold text-emerald-700 dark:text-emerald-400">
            {product.bestPrice == null
              ? "--"
              : `${formatCurrency(product.bestPrice)}${product.bestSourceLabel ? ` (${product.bestSourceLabel})` : ""}`}
          </p>
        </div>
      </div>
      {savings != null && (
        <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50 px-3 py-2 dark:border-emerald-800/50 dark:from-emerald-900/30 dark:to-teal-900/30">
          <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">比建議售價省下</p>
          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(savings)}</p>
        </div>
      )}
    </div>
  );
}

function LandtopProductSection({
  title,
  defaultQuery,
  products,
  open,
  onToggle,
}: {
  title: string;
  defaultQuery: string;
  products: LandtopProduct[];
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white/40 p-1 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-[#121212]/40">
      <button 
        type="button" 
        onClick={onToggle} 
        className="group flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-4 text-left transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
      >
        <div>
          <h4 className="text-sm font-bold text-foreground transition-colors group-hover:text-sky-600 dark:group-hover:text-sky-400">{title}</h4>
          <p className="mt-1 text-xs text-muted-foreground">預設 {defaultQuery}，目前 {products.length} 筆</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition-colors group-hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:group-hover:border-slate-600">
          {open ? "收合" : "展開"}
          <ChevronDown size={14} className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && (
        <div className="px-2 pb-2 pt-1">
          <div className="grid gap-3 md:grid-cols-2">
            {products.length > 0 ? (
              products.slice(0, 12).map((product) => <LandtopProductCard key={product.id} product={product} />)
            ) : (
              <p className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white/50 px-3 py-8 text-center text-sm text-muted-foreground backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/30">
                目前沒有這個區塊的比價結果。
              </p>
            )}
          </div>
        </div>
      )}
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
  const [landtopAppleQuery, setLandtopAppleQuery] = useState(getAppleDefaultLandtopQuery);
  const [landtopSamsungQuery, setLandtopSamsungQuery] = useState(getSamsungDefaultLandtopQuery);
  const [landtopLoading, setLandtopLoading] = useState(false);
  const [landtopError, setLandtopError] = useState("");
  const [landtopResult, setLandtopResult] = useState<LandtopResult | null>(null);
  const [landtopLoadedOnce, setLandtopLoadedOnce] = useState(false);
  const [landtopAppleOpen, setLandtopAppleOpen] = useState(true);
  const [landtopSamsungOpen, setLandtopSamsungOpen] = useState(true);
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
  const [selectedDefaultFinanceInstrumentIds, setSelectedDefaultFinanceInstrumentIds] = useState<string[]>(
    getSavedDefaultFinanceInstrumentIds
  );
  const [customFinanceInstruments, setCustomFinanceInstruments] = useState<CustomFinanceInstrument[]>(getSavedCustomFinanceInstruments);
  const [customFinanceDraft, setCustomFinanceDraft] = useState<CustomFinanceInstrument>({
    name: "",
    symbol: "",
    provider: "cnbc",
    group: "us",
  });

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
      const savedAppleQuery = window.localStorage.getItem(LANDTOP_APPLE_QUERY_KEY);
      if (savedAppleQuery) setLandtopAppleQuery(normalizeSavedLandtopQuery(savedAppleQuery));
      const savedSamsungQuery = window.localStorage.getItem(LANDTOP_SAMSUNG_QUERY_KEY);
      if (savedSamsungQuery) setLandtopSamsungQuery(normalizeSavedLandtopQuery(savedSamsungQuery));

    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(TUBE_CHANNELS_KEY, JSON.stringify(tubeChannelConfigs));
  }, [tubeChannelConfigs]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(FINANCE_CUSTOM_INSTRUMENTS_KEY, JSON.stringify(customFinanceInstruments));
    } catch {}
  }, [customFinanceInstruments]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(FINANCE_DEFAULT_INSTRUMENT_IDS_KEY, JSON.stringify(selectedDefaultFinanceInstrumentIds));
    } catch {}
  }, [selectedDefaultFinanceInstrumentIds]);

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
      window.localStorage.setItem(LANDTOP_APPLE_QUERY_KEY, landtopAppleQuery);
      window.localStorage.setItem(LANDTOP_SAMSUNG_QUERY_KEY, landtopSamsungQuery);
    } catch {}
  }, [landtopAppleQuery, landtopQuery, landtopSamsungQuery]);

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

    const currentPrice = result.currentPrice ?? fallbackCurrent;
    const highestPrice = historyPrices.length ? Math.max(...historyPrices, currentPrice ?? 0) : currentPrice ?? null;
    const lowestPrice = historyPrices.length ? Math.min(...historyPrices, currentPrice ?? Infinity) : currentPrice ?? null;

    let dropPercent = null;
    let isAllTimeLow = false;

    if (currentPrice !== null && highestPrice !== null && highestPrice > 0) {
      dropPercent = ((highestPrice - currentPrice) / highestPrice) * 100;
    }
    if (currentPrice !== null && lowestPrice !== null && historyPrices.length > 0) {
      isAllTimeLow = currentPrice <= lowestPrice;
    }

    return {
      currentPrice,
      highestPrice,
      lowestPrice,
      dropPercent,
      isAllTimeLow,
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

  const runLandtopSearch = useCallback(
    (query: string, refresh = false) => {
      setLandtopQuery(query);
      void loadLandtop(refresh, query);
    },
    [loadLandtop]
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
        body: JSON.stringify({ 
          channels: [
            ...tubeChannelConfigs,
            { sourceUrl: "https://www.youtube.com/@henren778", alias: "一个狠人" }
          ] 
        }),
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
      const params = new URLSearchParams();
      params.set("defaults", JSON.stringify(selectedDefaultFinanceInstrumentIds));
      if (customFinanceInstruments.length > 0) {
        params.set("custom", JSON.stringify(customFinanceInstruments));
      }
      const response = await fetch(`/api/fengbro-finance${params.size ? `?${params.toString()}` : ""}`);
      const data = (await response.json()) as FengbroFinanceResult & { error?: string };
      if (!response.ok) throw new Error(data.error || "\u92d2\u5144\u91d1\u878d\u8b80\u53d6\u5931\u6557");
      setFinanceResult(data);
    } catch (error) {
      setFinanceError(error instanceof Error ? error.message : "\u92d2\u5144\u91d1\u878d\u8b80\u53d6\u5931\u6557");
    } finally {
      setFinanceLoading(false);
    }
  }, [customFinanceInstruments, selectedDefaultFinanceInstrumentIds]);

  const handleSaveCustomFinanceInstrument = useCallback(() => {
    const normalizedInstrument = normalizeCustomFinanceInstrument(customFinanceDraft);
    if (!normalizedInstrument) {
      setFinanceError("請輸入指數或股票代號");
      return;
    }

    setFinanceError("");
    setCustomFinanceInstruments((currentInstruments) => {
      const nextInstruments = currentInstruments.filter(
        (instrument) =>
          !(
            instrument.provider === normalizedInstrument.provider &&
            instrument.symbol.toUpperCase() === normalizedInstrument.symbol.toUpperCase()
          )
      );
      return [...nextInstruments, normalizedInstrument].slice(-30);
    });
    setCustomFinanceDraft({ name: "", symbol: "", provider: customFinanceDraft.provider, group: customFinanceDraft.group });
    setFinanceLoadedOnce(false);
  }, [customFinanceDraft]);

  const handleAddDefaultFinanceInstrument = useCallback((id: string) => {
    if (!DEFAULT_FINANCE_INSTRUMENT_IDS.includes(id)) return;
    setSelectedDefaultFinanceInstrumentIds((currentIds) => {
      if (currentIds.includes(id)) return currentIds;
      const nextIds = new Set([...currentIds, id]);
      return DEFAULT_FINANCE_INSTRUMENT_IDS.filter((defaultId) => nextIds.has(defaultId));
    });
    setFinanceLoadedOnce(false);
  }, []);

  const handleDeleteDefaultFinanceInstrument = useCallback((id: string) => {
    setSelectedDefaultFinanceInstrumentIds((currentIds) => currentIds.filter((currentId) => currentId !== id));
    setFinanceLoadedOnce(false);
  }, []);

  const handleResetDefaultFinanceInstruments = useCallback(() => {
    setSelectedDefaultFinanceInstrumentIds(DEFAULT_FINANCE_INSTRUMENT_IDS);
    setFinanceLoadedOnce(false);
  }, []);

  const handleDeleteCustomFinanceInstrument = useCallback((targetInstrument: CustomFinanceInstrument) => {
    setCustomFinanceInstruments((currentInstruments) =>
      currentInstruments.filter(
        (instrument) =>
          !(
            instrument.provider === targetInstrument.provider &&
            instrument.symbol.toUpperCase() === targetInstrument.symbol.toUpperCase()
          )
      )
    );
    setFinanceLoadedOnce(false);
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
                {(() => {
                  const platform = getPlatformInfo(result.url, result.title, result.source);
                  return (
                    <div className="rounded-2xl border border-border bg-white p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold">{result.title || "未命名商品"}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold tracking-wider border ${platform.colorClass}`}>
                              {platform.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {result.resolvedAt ? `最後更新：${result.resolvedAt}` : ""}
                            </span>
                          </div>
                        </div>
                        <div className="text-right text-sm sm:text-right">
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
                  );
                })()}

                {priceSummary && (
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className={`rounded-2xl border px-4 py-3 ${
                      priceSummary.isAllTimeLow
                        ? "border-emerald-300 bg-emerald-50 shadow-sm animate-pulse"
                        : "border-amber-200 bg-amber-50/60"
                    }`}>
                      <div className="flex items-center justify-between">
                        <p className={`text-xs ${priceSummary.isAllTimeLow ? "text-emerald-700 font-bold" : "text-amber-700/80"}`}>
                          {priceSummary.isAllTimeLow ? "🎉 歷史新低" : "現在價格"}
                        </p>
                        {priceSummary.dropPercent !== null && priceSummary.dropPercent > 0 && (
                          <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                            降幅 {priceSummary.dropPercent.toFixed(1)}%
                          </span>
                        )}
                      </div>
                      <p className={`mt-1 text-lg font-semibold ${priceSummary.isAllTimeLow ? "text-emerald-700" : "text-amber-700"}`}>
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
        <DataCard className="relative overflow-hidden border-0 bg-gradient-to-br from-sky-50 to-indigo-50 p-6 shadow-sm ring-1 ring-inset ring-sky-100/50 backdrop-blur-3xl dark:from-sky-950/40 dark:to-indigo-950/40 dark:ring-sky-900/20">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-sky-400/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-indigo-400/10 blur-3xl" />
          
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-lg shadow-sky-500/20">
                <Smartphone size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">手機比價</h3>
                <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-400">
                  根據地標網通與傑昇通信比價，可搜尋 {getAppleDefaultLandtopQuery()}、{getSamsungDefaultLandtopQuery()}、Samsung A17 等機型。
                </p>
              </div>
            </div>
            {landtopResult && (
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/50 bg-white/60 px-4 py-1.5 text-xs font-medium text-slate-600 backdrop-blur-md dark:border-sky-800/50 dark:bg-slate-900/60 dark:text-slate-300">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500"></span>
                </span>
                更新：{new Date(landtopResult.fetchedAt).toLocaleString("zh-TW")}，共 {landtopResult.total} 筆
                {typeof landtopResult.snapshotStored === "number"
                  ? ` (寫入 ${landtopResult.snapshotStored} 筆)`
                  : ""}
              </div>
            )}
          </div>

          <div className="relative mt-8 grid gap-4 lg:grid-cols-2">
            {/* Apple Search Block */}
            <div className="group/section rounded-3xl border border-white/60 bg-white/40 p-1.5 shadow-sm ring-1 ring-black/5 backdrop-blur-xl transition-all hover:bg-white/60 dark:border-slate-800/60 dark:bg-slate-900/40 dark:ring-white/5 dark:hover:bg-slate-900/60">
              <button
                type="button"
                onClick={() => setLandtopAppleOpen((open) => !open)}
                className="group flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-white/50 dark:hover:bg-slate-800/50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    <Search size={14} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 transition-colors group-hover:text-sky-600 dark:text-slate-100 dark:group-hover:text-sky-400">蘋果手機搜尋</p>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">預設：{getAppleDefaultLandtopQuery()}</p>
                  </div>
                </div>
                <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500 shadow-sm transition-colors group-hover:text-sky-600 dark:bg-slate-800">
                  {landtopAppleOpen ? "收合" : "展開"}
                  <ChevronDown size={14} className={`transition-transform duration-300 ${landtopAppleOpen ? "rotate-180" : ""}`} />
                </span>
              </button>
              {landtopAppleOpen && (
                <div className="px-3 pb-3 pt-1">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      value={landtopAppleQuery}
                      onChange={(event) => setLandtopAppleQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") runLandtopSearch(landtopAppleQuery.trim() || getAppleDefaultLandtopQuery(), false);
                      }}
                      placeholder={`例如 ${getAppleDefaultLandtopQuery()}、iPhone 17 512GB`}
                      className="min-w-0 flex-1 rounded-xl border border-sky-100 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                    <Button
                      type="button"
                      onClick={() => runLandtopSearch(landtopAppleQuery.trim() || getAppleDefaultLandtopQuery(), false)}
                      disabled={landtopLoading}
                      className="gap-2 rounded-xl bg-slate-900 px-5 hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500"
                    >
                      <Search size={16} />
                      {landtopLoading ? "搜尋中" : "搜尋蘋果"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => runLandtopSearch(landtopAppleQuery.trim() || getAppleDefaultLandtopQuery(), true)}
                      disabled={landtopLoading}
                      className="gap-2 rounded-xl border-slate-200 px-5 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                      <RefreshCw size={16} className={landtopLoading ? "animate-spin" : ""} />
                      重新抓取
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Samsung Search Block */}
            <div className="group/section rounded-3xl border border-white/60 bg-white/40 p-1.5 shadow-sm ring-1 ring-black/5 backdrop-blur-xl transition-all hover:bg-white/60 dark:border-slate-800/60 dark:bg-slate-900/40 dark:ring-white/5 dark:hover:bg-slate-900/60">
              <button
                type="button"
                onClick={() => setLandtopSamsungOpen((open) => !open)}
                className="group flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-white/50 dark:hover:bg-slate-800/50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    <Search size={14} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 transition-colors group-hover:text-sky-600 dark:text-slate-100 dark:group-hover:text-sky-400">三星手機搜尋</p>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">預設：{getSamsungDefaultLandtopQuery()}</p>
                  </div>
                </div>
                <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500 shadow-sm transition-colors group-hover:text-sky-600 dark:bg-slate-800">
                  {landtopSamsungOpen ? "收合" : "展開"}
                  <ChevronDown size={14} className={`transition-transform duration-300 ${landtopSamsungOpen ? "rotate-180" : ""}`} />
                </span>
              </button>
              {landtopSamsungOpen && (
                <div className="px-3 pb-3 pt-1">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      value={landtopSamsungQuery}
                      onChange={(event) => setLandtopSamsungQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") runLandtopSearch(landtopSamsungQuery.trim() || getSamsungDefaultLandtopQuery(), false);
                      }}
                      placeholder={`例如 ${getSamsungDefaultLandtopQuery()}、Samsung A17`}
                      className="min-w-0 flex-1 rounded-xl border border-sky-100 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                    <Button
                      type="button"
                      onClick={() => runLandtopSearch(landtopSamsungQuery.trim() || getSamsungDefaultLandtopQuery(), false)}
                      disabled={landtopLoading}
                      className="gap-2 rounded-xl bg-slate-900 px-5 hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500"
                    >
                      <Search size={16} />
                      {landtopLoading ? "搜尋中" : "搜尋三星"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => runLandtopSearch(landtopSamsungQuery.trim() || getSamsungDefaultLandtopQuery(), true)}
                      disabled={landtopLoading}
                      className="gap-2 rounded-xl border-slate-200 px-5 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                      <RefreshCw size={16} className={landtopLoading ? "animate-spin" : ""} />
                      重新抓取
                    </Button>
                  </div>
                </div>
              )}
            </div>
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

              <div className="space-y-3">
                <LandtopProductSection
                  title="蘋果手機區塊"
                  defaultQuery={getAppleDefaultLandtopQuery()}
                  products={landtopResult.products.filter((product) => product.brand === "apple")}
                  open={landtopAppleOpen}
                  onToggle={() => setLandtopAppleOpen((open) => !open)}
                />
                <LandtopProductSection
                  title="三星手機區塊"
                  defaultQuery={getSamsungDefaultLandtopQuery()}
                  products={landtopResult.products.filter((product) => product.brand === "samsung")}
                  open={landtopSamsungOpen}
                  onToggle={() => setLandtopSamsungOpen((open) => !open)}
                />
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
          defaultInstruments={DEFAULT_FINANCE_INSTRUMENTS}
          selectedDefaultInstrumentIds={selectedDefaultFinanceInstrumentIds}
          onAddDefaultInstrument={handleAddDefaultFinanceInstrument}
          onDeleteDefaultInstrument={handleDeleteDefaultFinanceInstrument}
          onResetDefaultInstruments={handleResetDefaultFinanceInstruments}
          customInstruments={customFinanceInstruments}
          customDraft={customFinanceDraft}
          onCustomDraftChange={setCustomFinanceDraft}
          onSaveCustomInstrument={handleSaveCustomFinanceInstrument}
          onDeleteCustomInstrument={handleDeleteCustomFinanceInstrument}
          onRefresh={() => void loadFinance()}
        />
      )}
    </section>
  );
}
