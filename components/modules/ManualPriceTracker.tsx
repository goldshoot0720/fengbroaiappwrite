"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, Pencil, Plus, Trash2 } from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import { Button } from "@/components/ui/button";

type ManualPriceRecord = {
  id: string;
  price: number;
  date: string; // YYYY-MM-DD
  note?: string;
};

const MANUAL_PRICE_CURRENCIES = ["TWD", "USD", "JPY"] as const;
type ManualPriceCurrency = (typeof MANUAL_PRICE_CURRENCIES)[number];

type ManualPriceProduct = {
  id: string;
  name: string;
  note?: string;
  currency: ManualPriceCurrency;
  createdAt: number;
  updatedAt: number;
  records: ManualPriceRecord[];
};

const STORAGE_KEY = "fengbro.tools.manualPrice.products";
const MAX_PRODUCTS = 50;
const MAX_RECORDS_PER_PRODUCT = 200;

function normalizeCurrency(value: unknown): ManualPriceCurrency {
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";
  return (MANUAL_PRICE_CURRENCIES as readonly string[]).includes(code)
    ? (code as ManualPriceCurrency)
    : "TWD";
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function todayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatPrice(price: number | null | undefined, currency = "TWD") {
  if (price == null || Number.isNaN(price)) return "--";
  const formatted = new Intl.NumberFormat("zh-TW").format(price);
  return currency ? `${formatted} ${currency}` : formatted;
}

function formatDisplayDate(date: string) {
  if (!date) return "--";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

function sortRecords(records: ManualPriceRecord[]) {
  return [...records].sort((a, b) => {
    if (a.date === b.date) return a.id.localeCompare(b.id);
    return a.date.localeCompare(b.date);
  });
}

function normalizeRecord(input: Partial<ManualPriceRecord>): ManualPriceRecord | null {
  const price = typeof input.price === "number" ? input.price : Number(input.price);
  if (!Number.isFinite(price) || price < 0) return null;

  const date =
    typeof input.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.date.trim())
      ? input.date.trim()
      : todayIsoDate();

  return {
    id: typeof input.id === "string" && input.id ? input.id : createId(),
    price,
    date,
    note: typeof input.note === "string" && input.note.trim() ? input.note.trim() : undefined,
  };
}

function normalizeProduct(input: Partial<ManualPriceProduct>): ManualPriceProduct | null {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) return null;

  const records = Array.isArray(input.records)
    ? input.records
        .map((record) => normalizeRecord(record as Partial<ManualPriceRecord>))
        .filter((record): record is ManualPriceRecord => record != null)
        .slice(0, MAX_RECORDS_PER_PRODUCT)
    : [];

  const now = Date.now();
  return {
    id: typeof input.id === "string" && input.id ? input.id : createId(),
    name,
    note: typeof input.note === "string" && input.note.trim() ? input.note.trim() : undefined,
    currency: normalizeCurrency(input.currency),
    createdAt: typeof input.createdAt === "number" ? input.createdAt : now,
    updatedAt: typeof input.updatedAt === "number" ? input.updatedAt : now,
    records: sortRecords(records),
  };
}

function loadProducts(): ManualPriceProduct[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizeProduct(item as Partial<ManualPriceProduct>))
      .filter((item): item is ManualPriceProduct => item != null)
      .slice(0, MAX_PRODUCTS);
  } catch {
    return [];
  }
}

function buildChartPath(points: Array<{ x: number; y: number }>) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
}

function ManualPriceTrendChart({
  records,
  currency,
}: {
  records: ManualPriceRecord[];
  currency?: string;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const chart = useMemo(() => {
    const priced = sortRecords(records);
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
  }, [currency, records]);

  if (!chart) {
    return (
      <div className="rounded-[28px] border border-dashed border-violet-200/80 bg-violet-50/40 px-5 py-10 text-center text-sm text-muted-foreground">
        新增至少一筆價格後，這裡會顯示走勢圖。
      </div>
    );
  }

  const delta = chart.latest.price - chart.earliest.price;
  const deltaTone = delta > 0 ? "text-rose-600" : delta < 0 ? "text-emerald-600" : "text-violet-700";

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
    <div className="overflow-hidden rounded-[28px] border border-violet-200/80 bg-[linear-gradient(180deg,rgba(245,243,255,0.98),rgba(255,255,255,0.98))] shadow-[0_24px_80px_rgba(91,33,182,0.08)]">
      <div className="flex flex-col gap-4 border-b border-violet-100 px-5 py-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-700/80">Manual Trend</p>
          <h5 className="mt-2 text-xl font-semibold text-foreground">價格走勢圖</h5>
          <p className="mt-1 text-sm text-muted-foreground">依你手動紀錄的日期排序，顯示最高、最低與變化。</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-right text-xs sm:min-w-[320px]">
          <div className="rounded-2xl bg-white/80 px-3 py-2 shadow-sm">
            <p className="text-muted-foreground">最低價</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {formatPrice(chart.minPrice, chart.currency)}
            </p>
          </div>
          <div className="rounded-2xl bg-white/80 px-3 py-2 shadow-sm">
            <p className="text-muted-foreground">最高價</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {formatPrice(chart.maxPrice, chart.currency)}
            </p>
          </div>
          <div className="rounded-2xl bg-white/80 px-3 py-2 shadow-sm">
            <p className="text-muted-foreground">變化</p>
            <p className={`mt-1 text-sm font-semibold ${deltaTone}`}>
              {delta > 0 ? "+" : ""}
              {formatPrice(delta, chart.currency)}
            </p>
          </div>
        </div>
      </div>

      <div className="px-3 pb-4 pt-3 sm:px-5">
        <div className="relative overflow-hidden rounded-[24px] border border-violet-100/80 bg-[radial-gradient(circle_at_top,rgba(167,139,250,0.16),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(245,243,255,0.92))] p-3 sm:p-4">
          <svg
            viewBox={`0 0 ${chart.width} ${chart.height}`}
            className="h-[260px] w-full cursor-crosshair"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <defs>
              <linearGradient id="manualPriceTrendArea" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(139,92,246,0.34)" />
                <stop offset="100%" stopColor="rgba(139,92,246,0.02)" />
              </linearGradient>
            </defs>
            <path d={chart.areaPath} fill="url(#manualPriceTrendArea)" />
            <path
              d={chart.linePath}
              fill="none"
              stroke="rgba(124, 58, 237, 0.96)"
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
                stroke="rgba(124, 58, 237, 0.4)"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
            )}
            {chart.points.map((point, index) => {
              const isHovered = index === hoveredIndex;
              const isLast = index === chart.points.length - 1;
              return (
                <circle
                  key={`${point.id}-${index}`}
                  cx={point.x}
                  cy={point.y}
                  fill={isHovered ? "rgba(124, 58, 237, 1)" : "white"}
                  r={isHovered ? 8 : isLast ? 6 : 4.5}
                  stroke="rgba(124, 58, 237, 0.96)"
                  strokeWidth={isHovered ? "4" : "3"}
                  className="transition-all duration-200"
                />
              );
            })}
          </svg>

          {hoveredIndex !== null && (
            <div
              className="pointer-events-none absolute z-10 rounded-xl border border-violet-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm transition-all duration-75"
              style={{
                left: `max(16px, min(calc(100% - 120px), calc(${(chart.points[hoveredIndex].x / chart.width) * 100}% - 60px)))`,
                top: `max(16px, min(calc(100% - 80px), calc(${(chart.points[hoveredIndex].y / chart.height) * 100}% - 70px)))`,
              }}
            >
              <p className="text-xs font-semibold text-violet-700/80">
                {formatDisplayDate(chart.points[hoveredIndex].date)}
              </p>
              <p className="mt-1 text-lg font-bold text-violet-900">
                {formatPrice(chart.points[hoveredIndex].price, chart.currency)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ManualPriceTracker() {
  const [products, setProducts] = useState<ManualPriceProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const [productName, setProductName] = useState("");
  const [productNote, setProductNote] = useState("");
  const [productCurrency, setProductCurrency] = useState<ManualPriceCurrency>("TWD");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  const [recordPrice, setRecordPrice] = useState("");
  const [recordDate, setRecordDate] = useState(todayIsoDate);
  const [recordNote, setRecordNote] = useState("");
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const loaded = loadProducts();
    setProducts(loaded);
    if (loaded[0]) setSelectedProductId(loaded[0].id);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    } catch {}
  }, [hydrated, products]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId]
  );

  const selectedSummary = useMemo(() => {
    if (!selectedProduct || selectedProduct.records.length === 0) return null;
    const sorted = sortRecords(selectedProduct.records);
    const prices = sorted.map((record) => record.price);
    const current = sorted[sorted.length - 1];
    const highest = Math.max(...prices);
    const lowest = Math.min(...prices);
    return {
      current,
      highest,
      lowest,
      count: sorted.length,
    };
  }, [selectedProduct]);

  const persistProducts = useCallback((next: ManualPriceProduct[]) => {
    setProducts(next);
  }, []);

  const resetProductForm = () => {
    setProductName("");
    setProductNote("");
    setProductCurrency("TWD");
    setEditingProductId(null);
    setFormError("");
  };

  const resetRecordForm = () => {
    setRecordPrice("");
    setRecordDate(todayIsoDate());
    setRecordNote("");
    setEditingRecordId(null);
    setFormError("");
  };

  const handleSaveProduct = () => {
    const name = productName.trim();
    if (!name) {
      setFormError("請輸入商品名稱");
      return;
    }

    const now = Date.now();

    if (editingProductId) {
      const next = products.map((product) =>
        product.id === editingProductId
          ? {
              ...product,
              name,
              note: productNote.trim() || undefined,
              currency: normalizeCurrency(productCurrency),
              updatedAt: now,
            }
          : product
      );
      persistProducts(next);
      setSelectedProductId(editingProductId);
      resetProductForm();
      return;
    }

    if (products.length >= MAX_PRODUCTS) {
      setFormError(`最多可建立 ${MAX_PRODUCTS} 個商品`);
      return;
    }

    const product = normalizeProduct({
      name,
      note: productNote,
      currency: productCurrency,
      createdAt: now,
      updatedAt: now,
      records: [],
    });
    if (!product) {
      setFormError("商品資料無效");
      return;
    }

    persistProducts([product, ...products]);
    setSelectedProductId(product.id);
    resetProductForm();
  };

  const handleEditProduct = (product: ManualPriceProduct) => {
    setEditingProductId(product.id);
    setProductName(product.name);
    setProductNote(product.note || "");
    setProductCurrency(normalizeCurrency(product.currency));
    setSelectedProductId(product.id);
    setFormError("");
  };

  const handleDeleteProduct = (productId: string) => {
    const next = products.filter((product) => product.id !== productId);
    persistProducts(next);
    if (selectedProductId === productId) {
      setSelectedProductId(next[0]?.id ?? null);
    }
    if (editingProductId === productId) {
      resetProductForm();
    }
    if (editingRecordId) {
      resetRecordForm();
    }
  };

  const handleSaveRecord = () => {
    if (!selectedProduct) {
      setFormError("請先建立或選擇一個商品");
      return;
    }

    const price = Number(recordPrice);
    if (!Number.isFinite(price) || price < 0) {
      setFormError("請輸入有效價錢（0 或以上）");
      return;
    }

    const date = recordDate.trim() || todayIsoDate();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setFormError("日期格式需為 YYYY-MM-DD");
      return;
    }

    const now = Date.now();
    const nextProducts = products.map((product) => {
      if (product.id !== selectedProduct.id) return product;

      if (editingRecordId) {
        const records = sortRecords(
          product.records.map((record) =>
            record.id === editingRecordId
              ? {
                  ...record,
                  price,
                  date,
                  note: recordNote.trim() || undefined,
                }
              : record
          )
        );
        return { ...product, records, updatedAt: now };
      }

      if (product.records.length >= MAX_RECORDS_PER_PRODUCT) {
        return product;
      }

      const record = normalizeRecord({
        price,
        date,
        note: recordNote,
      });
      if (!record) return product;

      return {
        ...product,
        records: sortRecords([...product.records, record]),
        updatedAt: now,
      };
    });

    const target = nextProducts.find((product) => product.id === selectedProduct.id);
    if (!editingRecordId && target && target.records.length >= MAX_RECORDS_PER_PRODUCT && selectedProduct.records.length >= MAX_RECORDS_PER_PRODUCT) {
      setFormError(`每個商品最多 ${MAX_RECORDS_PER_PRODUCT} 筆價格紀錄`);
      return;
    }

    persistProducts(nextProducts);
    resetRecordForm();
  };

  const handleEditRecord = (record: ManualPriceRecord) => {
    setEditingRecordId(record.id);
    setRecordPrice(String(record.price));
    setRecordDate(record.date);
    setRecordNote(record.note || "");
    setFormError("");
  };

  const handleDeleteRecord = (recordId: string) => {
    if (!selectedProduct) return;
    const now = Date.now();
    const nextProducts = products.map((product) => {
      if (product.id !== selectedProduct.id) return product;
      return {
        ...product,
        records: product.records.filter((record) => record.id !== recordId),
        updatedAt: now,
      };
    });
    persistProducts(nextProducts);
    if (editingRecordId === recordId) {
      resetRecordForm();
    }
  };

  const sortedRecordsDesc = useMemo(() => {
    if (!selectedProduct) return [];
    return [...sortRecords(selectedProduct.records)].reverse();
  }, [selectedProduct]);

  return (
    <div className="space-y-4">
      <DataCard className="space-y-4 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
            <ClipboardList size={20} />
          </div>
          <div>
            <h3 className="text-lg font-semibold">手動價格紀錄</h3>
            <p className="text-sm text-muted-foreground">
              自行輸入商品與價錢，保存歷史紀錄並檢視走勢圖。資料存在本機瀏覽器。
            </p>
          </div>
        </div>

        {formError && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</p>
        )}

        <div className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/50 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-foreground">
              {editingProductId ? "編輯商品" : "新增商品"}
            </h4>
            {editingProductId && (
              <Button type="button" variant="ghost" size="sm" onClick={resetProductForm}>
                取消編輯
              </Button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm sm:col-span-2">
              <span className="font-medium">商品名稱 *</span>
              <input
                value={productName}
                onChange={(event) => setProductName(event.target.value)}
                placeholder="例如 iPhone 16 Pro 256GB"
                className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-violet-400"
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">幣別</span>
              <select
                value={productCurrency}
                onChange={(event) => setProductCurrency(normalizeCurrency(event.target.value))}
                className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-violet-400"
              >
                {MANUAL_PRICE_CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">備註</span>
              <input
                value={productNote}
                onChange={(event) => setProductNote(event.target.value)}
                placeholder="可選"
                className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-violet-400"
              />
            </label>
          </div>
          <div className="mt-3">
            <Button type="button" onClick={handleSaveProduct} className="gap-2">
              <Plus size={16} />
              {editingProductId ? "更新商品" : "新增商品"}
            </Button>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold">我的商品</h4>
            <span className="text-xs text-muted-foreground">{products.length} 項</span>
          </div>
          {products.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              還沒有手動商品，先新增一筆開始紀錄價格。
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {products.map((product) => {
                const latest = sortRecords(product.records).at(-1);
                const isSelected = product.id === selectedProductId;
                return (
                  <div
                    key={product.id}
                    className={`rounded-xl border px-3 py-3 text-left shadow-sm transition ${
                      isSelected
                        ? "border-violet-400 bg-white ring-2 ring-violet-200"
                        : "border-border bg-white/80 hover:border-violet-300"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProductId(product.id);
                        resetRecordForm();
                      }}
                      className="w-full text-left"
                    >
                      <p className="line-clamp-1 text-sm font-semibold text-foreground">{product.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{product.records.length} 筆紀錄</p>
                      <p className="mt-1 text-sm font-medium text-violet-700">
                        最新：{latest ? formatPrice(latest.price, product.currency) : "尚無價格"}
                      </p>
                    </button>
                    <div className="mt-2 flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => handleEditProduct(product)}
                      >
                        <Pencil size={14} />
                        編輯
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-rose-600 hover:text-rose-700"
                        onClick={() => handleDeleteProduct(product.id)}
                      >
                        <Trash2 size={14} />
                        刪除
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DataCard>

      {selectedProduct && (
        <>
          <DataCard className="space-y-4 p-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h4 className="text-sm font-semibold">紀錄價格 — {selectedProduct.name}</h4>
                {selectedProduct.note ? (
                  <p className="text-xs text-muted-foreground">{selectedProduct.note}</p>
                ) : null}
              </div>
              {editingRecordId && (
                <Button type="button" variant="ghost" size="sm" onClick={resetRecordForm}>
                  取消編輯紀錄
                </Button>
              )}
            </div>

            <div className="grid gap-3 rounded-2xl border border-dashed border-violet-200 bg-violet-50/40 p-4 sm:grid-cols-3">
              <label className="space-y-1.5 text-sm sm:col-span-1">
                <span className="font-medium">價錢 *</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={recordPrice}
                  onChange={(event) => setRecordPrice(event.target.value)}
                  placeholder="例如 32900"
                  className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-violet-400"
                />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">日期</span>
                <input
                  type="date"
                  value={recordDate}
                  onChange={(event) => setRecordDate(event.target.value)}
                  className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-violet-400"
                />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">備註</span>
                <input
                  value={recordNote}
                  onChange={(event) => setRecordNote(event.target.value)}
                  placeholder="例如 折扣碼、活動價"
                  className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-violet-400"
                />
              </label>
              <div className="sm:col-span-3">
                <Button type="button" onClick={handleSaveRecord} className="gap-2">
                  <Plus size={16} />
                  {editingRecordId ? "更新價格紀錄" : "新增價格紀錄"}
                </Button>
              </div>
            </div>

            {selectedSummary && (
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-violet-200 bg-violet-50/60 px-4 py-3">
                  <p className="text-xs text-violet-700/80">最新價格</p>
                  <p className="mt-1 text-lg font-semibold text-violet-700">
                    {formatPrice(selectedSummary.current.price, selectedProduct.currency)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatDisplayDate(selectedSummary.current.date)} · 共 {selectedSummary.count} 筆
                  </p>
                </div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50/60 px-4 py-3">
                  <p className="text-xs text-rose-700/80">紀錄最高價</p>
                  <p className="mt-1 text-lg font-semibold text-rose-700">
                    {formatPrice(selectedSummary.highest, selectedProduct.currency)}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
                  <p className="text-xs text-emerald-700/80">紀錄最低價</p>
                  <p className="mt-1 text-lg font-semibold text-emerald-700">
                    {formatPrice(selectedSummary.lowest, selectedProduct.currency)}
                  </p>
                </div>
              </div>
            )}

            <ManualPriceTrendChart records={selectedProduct.records} currency={selectedProduct.currency} />
          </DataCard>

          <DataCard className="p-6">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold">價格紀錄明細</h4>
              <span className="text-xs text-muted-foreground">{sortedRecordsDesc.length} 筆</span>
            </div>
            {sortedRecordsDesc.length === 0 ? (
              <p className="text-sm text-muted-foreground">此商品尚無價格紀錄，請在上方新增一筆價錢。</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="px-2 py-2 font-medium">日期</th>
                      <th className="px-2 py-2 font-medium">價錢</th>
                      <th className="px-2 py-2 font-medium">備註</th>
                      <th className="px-2 py-2 font-medium text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRecordsDesc.map((record) => (
                      <tr key={record.id} className="border-b border-border/70 last:border-0">
                        <td className="px-2 py-2.5 whitespace-nowrap">{formatDisplayDate(record.date)}</td>
                        <td className="px-2 py-2.5 font-semibold text-violet-700">
                          {formatPrice(record.price, selectedProduct.currency)}
                        </td>
                        <td className="px-2 py-2.5 text-muted-foreground">{record.note || "—"}</td>
                        <td className="px-2 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => handleEditRecord(record)}
                            >
                              <Pencil size={14} />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-rose-600 hover:text-rose-700"
                              onClick={() => handleDeleteRecord(record.id)}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DataCard>
        </>
      )}
    </div>
  );
}
