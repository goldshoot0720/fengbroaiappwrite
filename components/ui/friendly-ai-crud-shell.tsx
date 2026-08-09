"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { Clock, Search, Sparkles, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { WorkspaceModuleIntro } from "@/components/ui/workspace-module-intro";
import { useRecentSearches } from "@/hooks/useRecentSearches";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "blue" | "amber" | "green" | "red";

export interface WorkbenchSummaryItem {
  label: string;
  value: string | number;
  detail?: string;
  tone?: Tone;
}

export interface WorkbenchSuggestionItem {
  title: string;
  body: string;
  tone?: Tone;
}

export interface WorkbenchModeItem {
  key: string;
  label: string;
  count?: number;
}

interface FriendlyAiCrudShellProps {
  title: string;
  description: string;
  searchPlaceholder: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onClearSearch?: () => void;
  intro?: ReactNode;
  workspaceCountText?: string;
  workspaceDescription?: string;
  workspaceStatusText?: string;
  searchExtras?: ReactNode;
  toolbar?: ReactNode;
  modeItems?: WorkbenchModeItem[];
  activeMode?: string;
  onModeChange?: (mode: string) => void;
  suggestions?: WorkbenchSuggestionItem[];
  summaries?: WorkbenchSummaryItem[];
  /** A stable key used to isolate recent-search history per module (e.g. "food", "music"). Defaults to the `title` prop. */
  recentSearchKey?: string;
  /** Historical localStorage keys to merge into `recentSearchKey` once. */
  legacyRecentSearchKeys?: readonly string[];
}

const toneStyles: Record<Tone, string> = {
  neutral: "border-white/60 bg-white/75 text-slate-700",
  blue: "border-sky-200 bg-sky-50 text-sky-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  red: "border-rose-200 bg-rose-50 text-rose-700",
};

export function FriendlyAiCrudShell({
  title,
  description,
  searchPlaceholder,
  searchQuery,
  onSearchChange,
  onClearSearch,
  intro,
  workspaceCountText,
  workspaceDescription,
  workspaceStatusText,
  searchExtras,
  toolbar,
  modeItems = [],
  activeMode,
  onModeChange,
  suggestions = [],
  summaries = [],
  recentSearchKey,
  legacyRecentSearchKeys,
}: FriendlyAiCrudShellProps) {
  const storageKey = recentSearchKey || title;
  const { items: recentSearches, addSearch, removeSearch, clearAll } =
    useRecentSearches(storageKey, legacyRecentSearchKeys);

  const [isRecentOpen, setIsRecentOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      // If the new focus target is still within the wrapper, keep open
      if (
        wrapperRef.current &&
        e.relatedTarget instanceof Node &&
        wrapperRef.current.contains(e.relatedTarget)
      ) {
        return;
      }
      setIsRecentOpen(false);
    },
    [],
  );

  /** Submit the current search query – saves to recent searches. */
  const handleSubmitSearch = useCallback(() => {
    const trimmed = searchQuery.trim();
    if (trimmed) {
      addSearch(trimmed);
    }
    setIsRecentOpen(false);
  }, [addSearch, searchQuery]);

  const handleClearSearch = useCallback(() => {
    if (onClearSearch) {
      onClearSearch();
    } else {
      onSearchChange("");
    }
    setIsRecentOpen(false);
    inputRef.current?.focus();
  }, [onClearSearch, onSearchChange]);

  /** Pick a recent search item. */
  const handlePickRecent = useCallback(
    (term: string) => {
      onSearchChange(term);
      addSearch(term);
      setIsRecentOpen(false);
      inputRef.current?.focus();
    },
    [addSearch, onSearchChange],
  );

  /** Remove a single recent search entry (stop propagation so we don't also pick it). */
  const handleRemoveRecent = useCallback(
    (e: React.MouseEvent, term: string) => {
      e.stopPropagation();
      e.preventDefault();
      removeSearch(term);
    },
    [removeSearch],
  );

  return (
    <section className="overflow-hidden rounded-[24px] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(250,204,21,0.14),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.96),_rgba(248,250,252,0.96))] p-3 shadow-sm dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.2),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(250,204,21,0.16),_transparent_28%),linear-gradient(180deg,_rgba(15,23,42,0.98),_rgba(15,23,42,0.96))] sm:p-4 md:rounded-[28px] md:p-5 xl:p-6">
      <div className="flex flex-col gap-4 md:gap-5">
        <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
          <div className="min-w-0 flex-1">
            {intro ?? (workspaceCountText || workspaceDescription ? (
              <WorkspaceModuleIntro
                title={title}
                countText={workspaceCountText || ""}
                description={workspaceDescription || description}
                statusText={workspaceStatusText}
              />
            ) : (
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-3 py-1 text-xs font-semibold tracking-wide text-sky-700 dark:border-sky-900 dark:bg-slate-900/70 dark:text-sky-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  Friendly AI CRUD
                </div>
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
                    {title}
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {toolbar ? (
            <div className="flex w-full flex-wrap items-stretch gap-2 2xl:w-auto 2xl:items-center 2xl:justify-end">
              {toolbar}
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(300px,0.92fr)] 2xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
          <div className="rounded-2xl border border-white/70 bg-white/80 p-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70 sm:p-4">
            {/* ── Search input with recent searches ── */}
            <div ref={wrapperRef} className="relative" onBlur={handleBlur}>
              <div className="relative flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    ref={inputRef}
                    value={searchQuery}
                    onChange={(event) => onSearchChange(event.target.value)}
                    onFocus={() => setIsRecentOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSubmitSearch();
                      }
                    }}
                    placeholder={searchPlaceholder}
                    className="h-11 rounded-xl border-slate-200 bg-white pl-10 pr-10 dark:border-slate-700 dark:bg-slate-950"
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      aria-label="清除搜尋內容"
                      title="清除搜尋內容"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>

                {/* Submit / search button */}
                <button
                  type="button"
                  onClick={handleSubmitSearch}
                  className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 dark:border-slate-700 dark:bg-sky-500 dark:hover:bg-sky-400"
                >
                  <Search className="h-4 w-4" />
                  <span className="hidden sm:inline">提交</span>
                </button>
              </div>

              {/* ── Recent searches dropdown ── */}
              {isRecentOpen && recentSearches.length > 0 && (
                <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 max-h-[420px] overflow-y-auto rounded-2xl border border-[var(--line-soft)] bg-[color:var(--panel-strong)] shadow-xl backdrop-blur-lg">
                  {/* Header */}
                  <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-4 py-2.5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <Clock className="h-3.5 w-3.5" />
                      最近搜尋
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        {recentSearches.length}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        clearAll();
                      }}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30 dark:hover:text-rose-400"
                    >
                      <Trash2 className="h-3 w-3" />
                      清除全部
                    </button>
                  </div>

                  {/* Items */}
                  <div className="py-1">
                    {recentSearches.map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => handlePickRecent(term)}
                        className="group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      >
                        <Search className="h-3.5 w-3.5 shrink-0 text-slate-300 dark:text-slate-600" />
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">
                          {term}
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => handleRemoveRecent(e, term)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.stopPropagation();
                              e.preventDefault();
                              removeSearch(term);
                            }
                          }}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-300 opacity-0 transition-all hover:bg-rose-100 hover:text-rose-500 group-hover:opacity-100 dark:text-slate-600 dark:hover:bg-rose-900/40 dark:hover:text-rose-400"
                        >
                          <X className="h-3.5 w-3.5" />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {searchExtras ? <div className="mt-3">{searchExtras}</div> : null}
            {modeItems.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {modeItems.map((mode) => {
                  const selected = mode.key === activeMode;
                  return (
                    <button
                      key={mode.key}
                      type="button"
                      onClick={() => onModeChange?.(mode.key)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                        selected
                          ? "border-slate-900 bg-slate-900 text-white dark:border-sky-400 dark:bg-sky-400 dark:text-slate-950"
                          : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                      )}
                    >
                      <span>{mode.label}</span>
                      {typeof mode.count === "number" ? (
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-xs",
                            selected
                              ? "bg-white/20 text-white dark:bg-slate-950/20 dark:text-slate-950"
                              : "bg-white text-slate-500 dark:bg-slate-800 dark:text-slate-300"
                          )}
                        >
                          {mode.count}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
            {summaries.length > 0 ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {summaries.map((item) => (
                  <div
                    key={item.label}
                    className={cn("rounded-2xl border p-4 shadow-sm", toneStyles[item.tone || "neutral"])}
                  >
                    <div className="text-xs font-semibold uppercase tracking-wide opacity-80">{item.label}</div>
                    <div className="mt-2 text-2xl font-black">{item.value}</div>
                    {item.detail ? <div className="mt-1 text-xs opacity-80">{item.detail}</div> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-white/70 bg-slate-950 p-3 text-white shadow-sm dark:border-slate-800 sm:p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Sparkles className="h-4 w-4 text-amber-300" />
              AI 建議
            </div>
            <div className="mt-4 space-y-3">
              {suggestions.length > 0 ? (
                suggestions.map((item) => (
                  <div
                    key={item.title}
                    className={cn(
                      "rounded-2xl border px-4 py-3",
                      item.tone === "amber" && "border-amber-400/30 bg-amber-400/10",
                      item.tone === "green" && "border-emerald-400/30 bg-emerald-400/10",
                      item.tone === "red" && "border-rose-400/30 bg-rose-400/10",
                      item.tone === "blue" && "border-sky-400/30 bg-sky-400/10",
                      (!item.tone || item.tone === "neutral") && "border-white/10 bg-white/5"
                    )}
                  >
                    <div className="text-sm font-semibold">{item.title}</div>
                    <div className="mt-1 text-sm leading-6 text-slate-300">{item.body}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-slate-300">
                  資料一進來，這裡就會開始提示異常、重複與下一步整理方向。
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
