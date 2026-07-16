"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  Focus,
  Lock,
  MapPin,
  Newspaper,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Unlock,
  UtensilsCrossed,
  Wrench,
} from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_FENGBRO_NEWS_SITES,
  FENGBRO_NEWS_QUERY_KEY,
  FENGBRO_NEWS_SITES_KEY,
  normalizeDomain,
  normalizeFengbroNewsSite,
  normalizeFengbroNewsSites,
  type FengbroNewsAdapter,
  type FengbroNewsSiteConfig,
} from "@/lib/fengbroNewsSites";

type NewsArticle = {
  title: string;
  url: string;
  siteId: string;
  siteName: string;
  domain: string;
  publishedAt?: string;
  snippet?: string;
};

type SiteSearchResult = {
  siteId: string;
  siteName: string;
  domain: string;
  articles: NewsArticle[];
  error?: string;
  source?: string;
};

type FengbroNewsResult = {
  query: string;
  onlyLocked: boolean;
  siteCount: number;
  resultCount: number;
  fetchedAt: string;
  results: NewsArticle[];
  bySite: SiteSearchResult[];
  warnings?: string[];
  exampleNote?: string;
  error?: string;
};

type TraBentoStore = {
  name: string;
  detail: string;
  focus?: boolean;
  stationHint?: string;
};

type TraBentoStoresResult = {
  sourceUrl: string;
  sourceLabel: string;
  focusOnly: boolean;
  fetchedAt: string;
  count: number;
  stores: TraBentoStore[];
  live: boolean;
  warning?: string;
  error?: string;
};

const TRA_BENTO_STORE_URL =
  "https://www.railway.gov.tw/tra-tip-web/tip/tip004/tip421/storeLocation";

const ADAPTER_OPTIONS: Array<{ id: FengbroNewsAdapter; label: string; hint: string }> = [
  { id: "tycg-traffic", label: "桃園交通局", hint: "businessd/post 關鍵字列表" },
  { id: "rb-nreo", label: "鐵道局北工", hint: "NREO 最新消息（reader）" },
  { id: "tycg-zhongli", label: "中壢區公所", hint: "News.aspx 分頁掃標題" },
  { id: "generic-keyword-url", label: "通用模板", hint: "searchUrlTemplate 含 {q}" },
];

function loadSites(): FengbroNewsSiteConfig[] {
  if (typeof window === "undefined") return DEFAULT_FENGBRO_NEWS_SITES.map((s) => ({ ...s }));
  try {
    const raw = window.localStorage.getItem(FENGBRO_NEWS_SITES_KEY);
    if (!raw) return DEFAULT_FENGBRO_NEWS_SITES.map((s) => ({ ...s }));
    return normalizeFengbroNewsSites(JSON.parse(raw));
  } catch {
    return DEFAULT_FENGBRO_NEWS_SITES.map((s) => ({ ...s }));
  }
}

function loadQuery(): string {
  if (typeof window === "undefined") return "中新地下道";
  try {
    return window.localStorage.getItem(FENGBRO_NEWS_QUERY_KEY) || "中新地下道";
  } catch {
    return "中新地下道";
  }
}

function adapterLabel(adapter: FengbroNewsAdapter) {
  return ADAPTER_OPTIONS.find((a) => a.id === adapter)?.label || adapter;
}

export default function FengbroNewsTool() {
  const [sites, setSites] = useState<FengbroNewsSiteConfig[]>(loadSites);
  const [query, setQuery] = useState(loadQuery);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<FengbroNewsResult | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);

  const [draftName, setDraftName] = useState("");
  const [draftDomain, setDraftDomain] = useState("");
  const [draftHomeUrl, setDraftHomeUrl] = useState("");
  const [draftAdapter, setDraftAdapter] = useState<FengbroNewsAdapter>("generic-keyword-url");
  const [draftTemplate, setDraftTemplate] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [bentoLoading, setBentoLoading] = useState(false);
  const [bentoError, setBentoError] = useState("");
  const [bentoResult, setBentoResult] = useState<TraBentoStoresResult | null>(null);
  const [bentoFocusOnly, setBentoFocusOnly] = useState(true);

  const lockedSites = useMemo(() => sites.filter((s) => s.locked), [sites]);
  const lockedCount = lockedSites.length;

  useEffect(() => {
    try {
      window.localStorage.setItem(FENGBRO_NEWS_SITES_KEY, JSON.stringify(sites));
    } catch {
      // ignore
    }
  }, [sites]);

  useEffect(() => {
    try {
      window.localStorage.setItem(FENGBRO_NEWS_QUERY_KEY, query);
    } catch {
      // ignore
    }
  }, [query]);

  const clearDraft = () => {
    setDraftName("");
    setDraftDomain("");
    setDraftHomeUrl("");
    setDraftAdapter("generic-keyword-url");
    setDraftTemplate("");
    setEditingId(null);
  };

  const handleSaveSite = () => {
    const site = normalizeFengbroNewsSite({
      id: editingId || undefined,
      name: draftName,
      domain: draftDomain || draftHomeUrl,
      homeUrl: draftHomeUrl || (draftDomain ? `https://${normalizeDomain(draftDomain)}/` : ""),
      adapter: draftAdapter,
      searchUrlTemplate: draftTemplate || undefined,
      locked: true,
    });
    if (!site) {
      setError("請填寫網站名稱與網域（或首頁網址）");
      return;
    }
    setSites((prev) => {
      const without = prev.filter((s) => s.id !== site.id && s.domain !== site.domain);
      if (editingId) {
        const idx = prev.findIndex((s) => s.id === editingId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...site, id: editingId, locked: prev[idx].locked };
          return next;
        }
      }
      return [...without, site];
    });
    clearDraft();
    setError("");
  };

  const handleEditSite = (site: FengbroNewsSiteConfig) => {
    setEditingId(site.id);
    setDraftName(site.name);
    setDraftDomain(site.domain);
    setDraftHomeUrl(site.homeUrl);
    setDraftAdapter(site.adapter);
    setDraftTemplate(site.searchUrlTemplate || "");
    setManagerOpen(true);
  };

  const handleDeleteSite = (id: string) => {
    setSites((prev) => prev.filter((s) => s.id !== id));
    if (editingId === id) clearDraft();
  };

  const handleToggleLock = (id: string) => {
    setSites((prev) => prev.map((s) => (s.id === id ? { ...s, locked: !s.locked } : s)));
  };

  const handleResetSites = () => {
    setSites(DEFAULT_FENGBRO_NEWS_SITES.map((s) => ({ ...s })));
    clearDraft();
  };

  const runSearch = useCallback(
    async (overrideQuery?: string) => {
      const q = (overrideQuery ?? query).trim();
      if (!q) {
        setError("請輸入文章標題關鍵字");
        return;
      }
      if (lockedCount === 0) {
        setError("請先鎖定至少一個網站焦點");
        return;
      }

      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/fengbro-news", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            q,
            onlyLocked: true,
            sites,
          }),
        });
        const data = (await response.json()) as FengbroNewsResult;
        if (!response.ok) {
          throw new Error(data.error || "鋒兄新聞搜尋失敗");
        }
        setResult(data);
      } catch (err) {
        setResult(null);
        setError(err instanceof Error ? err.message : "鋒兄新聞搜尋失敗");
      } finally {
        setLoading(false);
      }
    },
    [query, lockedCount, sites]
  );

  const loadBentoStores = useCallback(async (focusOnly: boolean) => {
    setBentoLoading(true);
    setBentoError("");
    try {
      const response = await fetch(`/api/fengbro-news/bento-stores?focus=${focusOnly ? "1" : "0"}`);
      const data = (await response.json()) as TraBentoStoresResult;
      if (!response.ok) {
        throw new Error(data.error || "台鐵便當門市讀取失敗");
      }
      setBentoResult(data);
    } catch (err) {
      setBentoResult(null);
      setBentoError(err instanceof Error ? err.message : "台鐵便當門市讀取失敗");
    } finally {
      setBentoLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBentoStores(true);
  }, [loadBentoStores]);

  return (
    <div className="space-y-5">
      <DataCard className="overflow-hidden p-0">
        <div className="flex flex-col gap-4 border-b border-sky-100 bg-[linear-gradient(135deg,rgba(224,242,254,0.98),rgba(255,255,255,0.96))] p-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
              <Newspaper size={22} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-600/80">FengBro News</p>
              <h3 className="mt-1 text-2xl font-semibold text-foreground">鋒兄新聞</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                鎖定網站焦點後，只在指定網站搜尋「標題包含關鍵字」的文章。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {result?.fetchedAt && (
              <span className="rounded-full border border-sky-100 bg-white px-3 py-1 text-xs text-muted-foreground">
                更新：{new Date(result.fetchedAt).toLocaleString("zh-TW")}
              </span>
            )}
            <span className="rounded-full border border-sky-100 bg-white px-3 py-1 text-xs text-muted-foreground">
              焦點：{lockedCount} / {sites.length}
            </span>
            <Button type="button" variant="outline" onClick={() => setManagerOpen((o) => !o)} className="gap-2 rounded-xl">
              <Wrench size={16} />
              網站焦點
            </Button>
          </div>
        </div>

        {managerOpen && (
          <div className="border-b border-sky-50 p-4 sm:p-6">
            <div className="rounded-[28px] border border-sky-100 bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h4 className="flex items-center gap-2 font-semibold text-foreground">
                    <Focus size={16} className="text-sky-600" />
                    鎖定網站焦點
                  </h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    預設範例：桃園市政府交通局、交通部鐵道局北部工程分局、桃園市中壢區公所。
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={handleResetSites} className="gap-2 rounded-xl">
                  <RotateCcw size={16} />
                  還原預設
                </Button>
              </div>

              <div className="mt-4 grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="網站名稱（如 桃園市政府交通局）"
                  className="h-11 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                />
                <input
                  value={draftDomain}
                  onChange={(e) => setDraftDomain(e.target.value)}
                  placeholder="網域（如 traffic.tycg.gov.tw）"
                  className="h-11 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                />
                <input
                  value={draftHomeUrl}
                  onChange={(e) => setDraftHomeUrl(e.target.value)}
                  placeholder="首頁網址（可選）"
                  className="h-11 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                />
                <select
                  value={draftAdapter}
                  onChange={(e) => setDraftAdapter(e.target.value as FengbroNewsAdapter)}
                  className="h-11 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                >
                  {ADAPTER_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label} — {opt.hint}
                    </option>
                  ))}
                </select>
                <input
                  value={draftTemplate}
                  onChange={(e) => setDraftTemplate(e.target.value)}
                  placeholder="通用模板 URL，關鍵字用 {q}"
                  className="h-11 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100 lg:col-span-2"
                  disabled={draftAdapter !== "generic-keyword-url"}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" onClick={handleSaveSite} className="gap-2 rounded-xl bg-sky-600 hover:bg-sky-700">
                  <Plus size={16} />
                  {editingId ? "儲存網站" : "新增並鎖定"}
                </Button>
                {editingId && (
                  <Button type="button" variant="ghost" onClick={clearDraft} className="rounded-xl">
                    取消編輯
                  </Button>
                )}
              </div>

              <div className="mt-4 grid gap-2 xl:grid-cols-2">
                {sites.map((site) => (
                  <div
                    key={site.id}
                    className={`flex min-w-0 items-center justify-between gap-3 rounded-2xl border px-3 py-2 ${
                      site.locked
                        ? "border-sky-200 bg-sky-50/80"
                        : "border-slate-200 bg-slate-50/80 opacity-80"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {site.locked ? "🔒 " : "🔓 "}
                        {site.name}
                      </p>
                      <a
                        href={site.homeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-xs text-sky-700 hover:underline"
                      >
                        {site.domain} · {adapterLabel(site.adapter)}
                      </a>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleToggleLock(site.id)}
                        className="h-9 rounded-xl px-2 text-xs"
                        title={site.locked ? "解除鎖定" : "鎖定焦點"}
                      >
                        {site.locked ? <Lock size={14} /> : <Unlock size={14} />}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleEditSite(site)}
                        className="h-9 rounded-xl px-3 text-xs"
                      >
                        編輯
                      </Button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSite(site.id)}
                        className="rounded-full p-2 text-sky-600 transition hover:bg-sky-100 hover:text-sky-800"
                        title="刪除網站"
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

        <div className="space-y-4 p-4 sm:p-6">
          <div className="rounded-2xl border border-dashed border-sky-200 bg-sky-50/40 p-4">
            <label className="text-sm font-medium">文章標題包含</label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runSearch();
                }}
                placeholder="例如 中新地下道"
                className="min-w-0 flex-1 rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
              <Button
                type="button"
                onClick={() => void runSearch()}
                disabled={loading}
                className="gap-2 rounded-xl bg-sky-600 hover:bg-sky-700"
              >
                <Search size={16} />
                {loading ? "搜尋中" : "搜尋新聞"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void runSearch()}
                disabled={loading}
                className="gap-2 rounded-xl"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                重新整理
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              範例：鎖定三個公部門網站，標題含「中新地下道」→ 應得到交通局、鐵道局、中壢區公所各一則。
            </p>
          </div>

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          {result && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-foreground">
                  「{result.query}」共 {result.resultCount} 則
                  <span className="ml-2 font-normal text-muted-foreground">
                    （焦點 {result.siteCount} 站）
                  </span>
                </h4>
              </div>

              {result.warnings && result.warnings.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {result.warnings.map((w) => (
                    <p key={w}>{w}</p>
                  ))}
                </div>
              )}

              {result.results.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-10 text-center text-sm text-muted-foreground">
                  鎖定網站內沒有標題符合的文章。
                </p>
              ) : (
                <div className="grid gap-3">
                  {result.results.map((article) => (
                    <a
                      key={article.url}
                      href={article.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex items-start justify-between gap-3 rounded-2xl border border-sky-100 bg-white p-4 shadow-sm transition hover:border-sky-300 hover:shadow-md"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-semibold text-foreground group-hover:text-sky-700">
                          {article.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {article.siteName}
                          <span className="mx-1.5 text-slate-300">·</span>
                          {article.domain}
                        </p>
                        <p className="truncate text-[11px] text-sky-700/80">{article.url}</p>
                      </div>
                      <ExternalLink size={16} className="mt-1 shrink-0 text-sky-500 opacity-70 group-hover:opacity-100" />
                    </a>
                  ))}
                </div>
              )}

              {result.bySite?.length > 0 && (
                <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">各站結果</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {result.bySite.map((site) => (
                      <div key={site.siteId} className="rounded-xl border border-white bg-white px-3 py-2 text-xs">
                        <p className="font-semibold text-foreground">{site.siteName}</p>
                        <p className="text-muted-foreground">
                          {site.articles.length} 則
                          {site.error ? ` · ${site.error}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DataCard>

      {/* 最下方：台鐵便當門市據點（桃園／中壢焦點） */}
      <DataCard className="overflow-hidden p-0">
        <div className="flex flex-col gap-3 border-b border-amber-100 bg-[linear-gradient(135deg,rgba(254,243,199,0.95),rgba(255,255,255,0.96))] p-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <UtensilsCrossed size={20} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700/80">TRA Bento</p>
              <h3 className="mt-0.5 text-lg font-semibold text-foreground">台鐵便當門市據點</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                來源：臺鐵官網門市據點（預設顯示桃園／中壢）
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={TRA_BENTO_STORE_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 transition hover:border-amber-400 hover:bg-amber-50"
            >
              <ExternalLink size={12} />
              官方門市據點
            </a>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const next = !bentoFocusOnly;
                setBentoFocusOnly(next);
                void loadBentoStores(next);
              }}
              className="rounded-xl text-xs"
            >
              {bentoFocusOnly ? "顯示臺北分處全部" : "只看桃園／中壢"}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void loadBentoStores(bentoFocusOnly)}
              disabled={bentoLoading}
              className="gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700"
            >
              <RefreshCw size={14} className={bentoLoading ? "animate-spin" : ""} />
              {bentoLoading ? "讀取中" : "更新"}
            </Button>
          </div>
        </div>

        <div className="space-y-3 p-4 sm:p-5">
          <p className="break-all text-[11px] text-muted-foreground">{TRA_BENTO_STORE_URL}</p>

          {bentoError && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{bentoError}</p>
          )}
          {bentoResult?.warning && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {bentoResult.warning}
            </p>
          )}

          {bentoLoading && !bentoResult ? (
            <p className="py-8 text-center text-sm text-muted-foreground">讀取台鐵便當門市…</p>
          ) : bentoResult && bentoResult.stores.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {bentoResult.stores.map((store) => (
                <div
                  key={`${store.name}-${store.detail}`}
                  className={`rounded-2xl border p-4 shadow-sm ${
                    store.focus
                      ? "border-amber-300 bg-gradient-to-br from-amber-50 to-white"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <MapPin size={16} className={`mt-0.5 shrink-0 ${store.focus ? "text-amber-600" : "text-slate-400"}`} />
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-semibold text-foreground">{store.name}</p>
                      <p className="text-sm leading-relaxed text-muted-foreground">{store.detail}</p>
                      {store.stationHint && (
                        <span className="inline-flex rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[11px] font-medium text-amber-800">
                          {store.stationHint}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-muted-foreground">
              尚無門市資料
            </p>
          )}

          {bentoResult?.fetchedAt && (
            <p className="text-right text-[11px] text-muted-foreground">
              {bentoResult.live ? "即時" : "備援"} · {new Date(bentoResult.fetchedAt).toLocaleString("zh-TW")}
            </p>
          )}
        </div>
      </DataCard>
    </div>
  );
}
