"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Clock,
  Download,
  ExternalLink,
  Newspaper,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  Wrench,
  X,
} from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import { Button } from "@/components/ui/button";
import { useRecentSearches } from "@/hooks/useRecentSearches";
import {
  DEFAULT_FENGBRO_NEWS_SITES,
  DEFAULT_FENGBRO_NEWS_SITES_COUNT,
  FENGBRO_NEWS_QUERY_KEY,
  FENGBRO_NEWS_SITES_KEY,
  fengbroNewsSiteKey,
  guessFengbroNewsAdapter,
  normalizeFengbroNewsSite,
  normalizeFengbroNewsSites,
  normalizeHomeUrl,
  type FengbroNewsAdapter,
  type FengbroNewsSiteConfig,
} from "@/lib/fengbroNewsSites";
import {
  buildFengbroNewsCsv,
  mergeFengbroNewsSites,
  parseFengbroNewsCsv,
} from "@/lib/fengbroNewsCsv";
import type { FengbroNewsSearchResult } from "@/lib/fengbroNews/types";
import { getExportFilename } from "@/lib/utils";
import { NewsSitesManager } from "@/components/modules/fengbro-news/NewsSitesManager";
import { TraBentoStoresPanel } from "@/components/modules/fengbro-news/TraBentoStoresPanel";

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

/** Client hard stop so UI never spins forever if server/network hangs. */
const CLIENT_SEARCH_TIMEOUT_MS = 55_000;

export default function FengbroNewsTool() {
  const [sites, setSites] = useState<FengbroNewsSiteConfig[]>(loadSites);
  const [query, setQuery] = useState(loadQuery);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<FengbroNewsSearchResult | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [searchElapsedSec, setSearchElapsedSec] = useState(0);
  const searchAbortRef = useRef<AbortController | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const {
    items: recentTitleQueries,
    addSearch: addRecentTitleQuery,
    removeSearch: removeRecentTitleQuery,
    clearAll: clearRecentTitleQueries,
  } = useRecentSearches("fengbro-news-titles");

  const [draftName, setDraftName] = useState("");
  const [draftHomeUrl, setDraftHomeUrl] = useState("");
  const [draftAdapter, setDraftAdapter] = useState<FengbroNewsAdapter>("generic-keyword-url");
  const [draftTemplate, setDraftTemplate] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState("");
  const csvInputRef = useRef<HTMLInputElement>(null);

  const lockedCount = useMemo(() => sites.reduce((n, s) => n + (s.locked ? 1 : 0), 0), [sites]);
  const displaySites = useMemo(
    () => [...sites].sort((a, b) => Number(b.locked) - Number(a.locked)),
    [sites]
  );

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
    setDraftHomeUrl("");
    setDraftAdapter("generic-keyword-url");
    setDraftTemplate("");
    setEditingId(null);
    setAdvancedOpen(false);
    setFormMessage("");
  };

  const handleSaveSite = () => {
    const homeUrl = normalizeHomeUrl(draftHomeUrl);
    if (!homeUrl && !draftName.trim()) {
      setFormMessage("請至少填寫網站網址（或名稱＋網址）");
      return;
    }
    if (!homeUrl) {
      setFormMessage("請填寫網站網址，例如 https://example.gov.tw/");
      return;
    }

    const adapter =
      draftAdapter === "generic-keyword-url"
        ? guessFengbroNewsAdapter(homeUrl)
        : draftAdapter;

    const site = normalizeFengbroNewsSite({
      id: editingId || undefined,
      name: draftName,
      homeUrl,
      adapter,
      searchUrlTemplate: draftTemplate || undefined,
      locked: true,
    });
    const existing = site
      ? editingId
        ? sites.find((s) => s.id === editingId)
        : sites.find((s) => fengbroNewsSiteKey(s) === fengbroNewsSiteKey(site))
      : undefined;
    if (site && existing && !editingId) {
      site.locked = existing.locked;
      site.id = existing.id;
    }
    if (!site) {
      setFormMessage("無法解析此網站，請檢查網址格式");
      return;
    }

    const wasEditing = Boolean(editingId);
    const siteKey = fengbroNewsSiteKey(site);
    setSites((prev) => {
      if (editingId) {
        return prev.map((s) => (s.id === editingId ? { ...site, id: editingId, locked: s.locked } : s));
      }
      const withoutDup = prev.filter(
        (s) => fengbroNewsSiteKey(s) !== siteKey && s.id !== site.id
      );
      return [...withoutDup, { ...site, locked: true }];
    });
    setDraftName("");
    setDraftHomeUrl("");
    setDraftAdapter("generic-keyword-url");
    setDraftTemplate("");
    setEditingId(null);
    setAdvancedOpen(false);
    setFormMessage(wasEditing ? `已更新來源「${site.name}」` : `已新增並鎖定來源「${site.name}」`);
    setError("");
  };

  const handleEditSite = (site: FengbroNewsSiteConfig) => {
    setEditingId(site.id);
    setDraftName(site.name);
    setDraftHomeUrl(site.homeUrl);
    setDraftAdapter(site.adapter);
    setDraftTemplate(site.searchUrlTemplate || "");
    setAdvancedOpen(site.adapter !== "generic-keyword-url" || Boolean(site.searchUrlTemplate));
    setFormMessage("");
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

  const stopSearchTimer = useCallback(() => {
    if (searchTimerRef.current) {
      clearInterval(searchTimerRef.current);
      searchTimerRef.current = null;
    }
  }, []);

  const cancelSearch = useCallback(() => {
    searchAbortRef.current?.abort();
    searchAbortRef.current = null;
    stopSearchTimer();
    setLoading(false);
    setSearchElapsedSec(0);
  }, [stopSearchTimer]);

  useEffect(() => {
    return () => {
      searchAbortRef.current?.abort();
      stopSearchTimer();
    };
  }, [stopSearchTimer]);

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

      if (overrideQuery !== undefined) {
        setQuery(q);
      }

      searchAbortRef.current?.abort();
      stopSearchTimer();

      const controller = new AbortController();
      searchAbortRef.current = controller;
      const clientTimeout = setTimeout(() => controller.abort(), CLIENT_SEARCH_TIMEOUT_MS);

      setLoading(true);
      setError("");
      setSearchElapsedSec(0);
      const started = Date.now();
      searchTimerRef.current = setInterval(() => {
        setSearchElapsedSec(Math.floor((Date.now() - started) / 1000));
      }, 500);

      try {
        const locked = sites.filter((s) => s.locked);
        const response = await fetch("/api/fengbro-news", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            q,
            onlyLocked: true,
            sites: locked,
          }),
          signal: controller.signal,
        });
        const data = (await response.json()) as FengbroNewsSearchResult;
        if (!response.ok) {
          throw new Error(data.error || "鋒兄新聞搜尋失敗");
        }
        setResult(data);
        addRecentTitleQuery(q);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          setError(
            controller.signal.aborted
              ? `搜尋已中止或逾時（>${Math.round(CLIENT_SEARCH_TIMEOUT_MS / 1000)} 秒）。可減少鎖定來源後再試。`
              : "搜尋已取消"
          );
        } else {
          setResult(null);
          setError(err instanceof Error ? err.message : "鋒兄新聞搜尋失敗");
        }
      } finally {
        clearTimeout(clientTimeout);
        if (searchAbortRef.current === controller) {
          searchAbortRef.current = null;
        }
        stopSearchTimer();
        setLoading(false);
        setSearchElapsedSec(0);
      }
    },
    [query, lockedCount, sites, addRecentTitleQuery, stopSearchTimer]
  );

  const handleExportCsv = useCallback(() => {
    try {
      const csv = buildFengbroNewsCsv(sites);
      const BOM = "\uFEFF";
      const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = getExportFilename("fengbro-news");
      link.click();
      URL.revokeObjectURL(link.href);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "輸出 CSV 失敗");
    }
  }, [sites]);

  const handleImportCsv = useCallback(
    (file: File) => {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        setError("請選擇 .csv 檔案");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = typeof reader.result === "string" ? reader.result : "";
          const { data, errors } = parseFengbroNewsCsv(text);

          if (data.length === 0) {
            setError(
              errors.length > 0
                ? `CSV 匯入失敗：${errors.slice(0, 5).join("；")}`
                : "CSV 沒有可匯入的新聞來源"
            );
            return;
          }

          if (sites.length > 0) {
            const ok = window.confirm(
              `將合併匯入 ${data.length} 個新聞來源（相同網站會覆蓋）。\n` +
                `目前 ${sites.length} 個，合併後最多 80 個。\n\n` +
                `確定匯入？`
            );
            if (!ok) return;
          }

          const merged = mergeFengbroNewsSites(sites, data);
          setSites(merged);
          setError("");
          setManagerOpen(true);
          const warn =
            errors.length > 0
              ? `\n警告 ${errors.length}：${errors.slice(0, 5).join("\n")}${errors.length > 5 ? "\n…" : ""}`
              : "";
          const lockedIn = data.filter((s) => s.locked).length;
          window.alert(
            `匯入完成！\n新增／覆蓋：${data.length} 個（其中鎖定 ${lockedIn}）\n合併後共 ${merged.length} 個來源${warn}`
          );
        } catch (err) {
          setError(err instanceof Error ? err.message : "輸入 CSV 失敗");
        }
      };
      reader.onerror = () => setError("讀取 CSV 檔案失敗");
      reader.readAsText(file, "UTF-8");
    },
    [sites]
  );

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
                鎖定網站焦點後，只在指定網站搜尋「標題包含關鍵字」的文章（最多三年內）。可輸出／輸入 CSV 備份來源清單。
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
              來源總數 {sites.length} · 鎖定 {lockedCount}
              {sites.length !== DEFAULT_FENGBRO_NEWS_SITES_COUNT
                ? ` · 預設 ${DEFAULT_FENGBRO_NEWS_SITES_COUNT}`
                : ""}
            </span>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleImportCsv(file);
                event.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleExportCsv}
              className="gap-2 rounded-xl border-sky-200 text-sky-800 hover:bg-sky-50"
              title="匯出新聞來源清單為 CSV"
            >
              <Download size={16} />
              輸出 CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => csvInputRef.current?.click()}
              className="gap-2 rounded-xl border-sky-200 text-sky-800 hover:bg-sky-50"
              title="從 CSV 匯入新聞來源（同網站覆蓋合併）"
            >
              <Upload size={16} />
              輸入 CSV
            </Button>
            <Button
              type="button"
              onClick={() => {
                setManagerOpen(true);
                clearDraft();
              }}
              className="gap-2 rounded-xl bg-sky-600 hover:bg-sky-700"
            >
              <Plus size={16} />
              新增新聞來源
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setManagerOpen((o) => !o)}
              className="gap-2 rounded-xl"
            >
              <Wrench size={16} />
              {managerOpen ? "收合來源" : "展開來源"}
            </Button>
          </div>
        </div>

        {managerOpen && (
          <NewsSitesManager
            displaySites={displaySites}
            lockedCount={lockedCount}
            sitesCount={sites.length}
            draftName={draftName}
            draftHomeUrl={draftHomeUrl}
            draftAdapter={draftAdapter}
            draftTemplate={draftTemplate}
            editingId={editingId}
            advancedOpen={advancedOpen}
            formMessage={formMessage}
            onDraftNameChange={setDraftName}
            onDraftHomeUrlChange={setDraftHomeUrl}
            onDraftAdapterChange={setDraftAdapter}
            onDraftTemplateChange={setDraftTemplate}
            onAdvancedOpenChange={setAdvancedOpen}
            onSaveSite={handleSaveSite}
            onClearDraft={clearDraft}
            onResetSites={handleResetSites}
            onToggleLock={handleToggleLock}
            onEditSite={handleEditSite}
            onDeleteSite={handleDeleteSite}
          />
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
                {loading ? `搜尋中${searchElapsedSec > 0 ? ` ${searchElapsedSec}s` : "…"}` : "搜尋新聞"}
              </Button>
              {loading ? (
                <Button type="button" variant="outline" onClick={cancelSearch} className="gap-2 rounded-xl">
                  <X size={16} />
                  取消
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void runSearch()}
                  className="gap-2 rounded-xl"
                >
                  <RefreshCw size={16} />
                  重新整理
                </Button>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              僅顯示近三年內可判斷日期的新聞；無日期者保留。目前鎖定 {lockedCount}{" "}
              站（並行抓取，單站逾時會略過；常擋爬蟲站優先走 Google News）。
              範例：標題含「中新地下道」。
            </p>

            <div className="mt-3 rounded-2xl border border-sky-100 bg-white/80 px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <Clock size={14} className="text-sky-600" />
                  最近搜尋文章標題
                  {recentTitleQueries.length > 0 && (
                    <span className="rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] tabular-nums text-sky-700">
                      {recentTitleQueries.length}
                    </span>
                  )}
                </div>
                {recentTitleQueries.length > 0 && (
                  <button
                    type="button"
                    onClick={() => clearRecentTitleQueries()}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 size={12} />
                    清除全部
                  </button>
                )}
              </div>

              {recentTitleQueries.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  搜尋過的文章標題會出現在這裡，點一下可再次搜尋。
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {recentTitleQueries.map((term) => (
                    <span
                      key={term}
                      className="inline-flex max-w-full items-center gap-1 rounded-full border border-sky-200 bg-sky-50/80 pl-2.5 text-xs text-sky-900"
                    >
                      <button
                        type="button"
                        onClick={() => void runSearch(term)}
                        disabled={loading}
                        className="min-w-0 truncate py-1 font-medium hover:text-sky-700 disabled:opacity-60"
                        title={`搜尋「${term}」`}
                      >
                        {term}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRecentTitleQuery(term)}
                        className="rounded-full p-1 text-sky-500 transition hover:bg-sky-100 hover:text-sky-800"
                        aria-label={`移除最近搜尋 ${term}`}
                        title="移除"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
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
                    （焦點 {result.siteCount} 站
                    {result.maxAgeYears ? ` · 近 ${result.maxAgeYears} 年` : ""}）
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
                          {article.publishedAt ? (
                            <>
                              <span className="mx-1.5 text-slate-300">·</span>
                              {new Date(article.publishedAt).toLocaleDateString("zh-TW")}
                            </>
                          ) : null}
                        </p>
                        <p className="truncate text-[11px] text-sky-700/80">{article.url}</p>
                      </div>
                      <ExternalLink
                        size={16}
                        className="mt-1 shrink-0 text-sky-500 opacity-70 group-hover:opacity-100"
                      />
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

      <TraBentoStoresPanel />
    </div>
  );
}
