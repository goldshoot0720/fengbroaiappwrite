"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Search, Wrench } from "lucide-react";
import { PageTitle } from "@/components/ui/section-header";
import { DataCard } from "@/components/ui/data-card";
import { Button } from "@/components/ui/button";

type ToolsTab = "price-compare";
type PriceSource = "local" | "biggo-api";

const TOOL_TABS: { id: ToolsTab; label: string }[] = [
  { id: "price-compare", label: "鋒兄比價" },
];

const PRICE_SOURCES: Array<{ id: PriceSource; label: string; hint: string }> = [
  { id: "biggo-api", label: "BigGo API", hint: "查詢 BigGo 歷史價格資料" },
  { id: "local", label: "本地佔位", hint: "只測試介面流程，不連外查價" },
];

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

const RECENT_KEY = "fengbro.tools.priceHistory.recent";
const SOURCE_KEY = "fengbro.tools.priceHistory.source";

export default function ToolsManagement() {
  const [activeTab, setActiveTab] = useState<ToolsTab>("price-compare");
  const [targetUrl, setTargetUrl] = useState("");
  const [priceSource, setPriceSource] = useState<PriceSource>("biggo-api");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<PriceHistoryResult | null>(null);
  const [recentLinks, setRecentLinks] = useState<RecentLink[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(RECENT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as RecentLink[];
        setRecentLinks(parsed);
      }
    } catch {}

    try {
      const savedSource = window.localStorage.getItem(SOURCE_KEY) as PriceSource | null;
      if (savedSource === "local" || savedSource === "biggo-api") {
        setPriceSource(savedSource);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(SOURCE_KEY, priceSource);
    } catch {}
  }, [priceSource]);

  const sortedRecent = useMemo(() => {
    return [...recentLinks].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);
  }, [recentLinks]);

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
    const next = [{ url, title, updatedAt: now }, ...existing].slice(0, 12);
    persistRecentLinks(next);
  };

  const handleResolve = async (overrideUrl?: string) => {
    const url = (overrideUrl ?? targetUrl).trim();
    if (!url) {
      setErrorMessage("請先輸入商品連結");
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

      if (!response.ok) {
        throw new Error(data.error || "查詢失敗，請稍後再試");
      }

      setResult(data);
      upsertRecentLink(url, data.title);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "查詢失敗");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-6">
      <PageTitle title="鋒兄工具" description="工具模組集中入口與查價工作台。" />

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

      <DataCard className="space-y-4 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <Wrench size={20} />
          </div>
          <div>
            <h3 className="text-lg font-semibold">鋒兄比價</h3>
            <p className="text-sm text-muted-foreground">查詢商品歷史價格與價格變動</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-amber-200 bg-amber-50/50 p-4">
          <label className="text-sm font-medium">商品連結</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={targetUrl}
              onChange={(event) => setTargetUrl(event.target.value)}
              placeholder="貼上商品頁面連結，例如 https://..."
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

          <p className="text-xs text-muted-foreground">
            目前會透過 <code>/api/resolve</code> 查詢，並把你選擇的資料來源一起送出。最近連結仍保留在瀏覽器端。
          </p>
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
          <h4 className="text-sm font-semibold">歷史價格結果</h4>
          {result?.url && (
            <a
              href={result.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700"
            >
              開啟原頁 <ExternalLink size={12} />
            </a>
          )}
        </div>

        {loading && <p className="text-sm text-muted-foreground">正在查詢歷史價格資料...</p>}
        {!loading && errorMessage && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{errorMessage}</p>
        )}

        {!loading && !errorMessage && !result && (
          <p className="text-sm text-muted-foreground">輸入連結後即可看到最新價格與歷史記錄。</p>
        )}

        {!loading && result && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-white p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">{result.title || "未命名商品"}</p>
                  <p className="text-xs text-muted-foreground">
                    來源：{result.source || "未設定"}
                    {result.resolvedAt ? ` ・更新 ${result.resolvedAt}` : ""}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="text-xs text-muted-foreground">目前價格</p>
                  <p className="text-lg font-semibold text-amber-700">
                    {result.currentPrice ?? "--"} {result.currency || ""}
                  </p>
                </div>
              </div>
              {result.notice && (
                <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  {result.notice}
                </p>
              )}
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-white">
              <div className="grid grid-cols-3 border-b border-border bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700">
                <span>日期</span>
                <span className="text-center">價格</span>
                <span className="text-right">幣別</span>
              </div>
              {result.history && result.history.length > 0 ? (
                result.history.map((entry, index) => (
                  <div
                    key={`${entry.date}-${index}`}
                    className="grid grid-cols-3 border-b border-border px-4 py-2 text-xs text-muted-foreground last:border-b-0"
                  >
                    <span>{entry.date}</span>
                    <span className="text-center">{entry.price ?? "--"}</span>
                    <span className="text-right">{entry.currency || result.currency || ""}</span>
                  </div>
                ))
              ) : (
                <div className="px-4 py-3 text-xs text-muted-foreground">尚無歷史價格資料。</div>
              )}
            </div>
          </div>
        )}
      </DataCard>
    </section>
  );
}
