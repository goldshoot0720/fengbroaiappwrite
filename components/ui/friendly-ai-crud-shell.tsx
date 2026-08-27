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
  /** Keep a visible recent-search row below the search controls. */
  showRecentSearches?: boolean;
}

const toneStyles: Record<Tone, string> = {
  neutral: "border-[var(--line-soft)] bg-[var(--panel-soft)] text-[var(--foreground)]",
  blue: "border-info/30 bg-info/10 text-info",
  amber: "border-warning/30 bg-warning/10 text-warning-foreground dark:text-warning",
  green: "border-success/30 bg-success/10 text-success",
  red: "border-destructive/30 bg-destructive/10 text-destructive",
};

const suggestionToneStyles: Record<Tone, string> = {
  neutral: "border-white/10 bg-white/5",
  blue: "border-info/30 bg-info/10",
  amber: "border-warning/30 bg-warning/10",
  green: "border-success/30 bg-success/10",
  red: "border-destructive/30 bg-destructive/10",
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
  showRecentSearches = true,
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
    <section data-slot="module-workbench" className="surface-panel overflow-hidden rounded-2xl p-3 sm:p-4 md:p-5 xl:p-6">
      <div className="flex flex-col gap-4 md:gap-5">
        <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
          <div className="min-w-0 flex-1">
            {intro ?? (
              <WorkspaceModuleIntro
                title={title}
                countText={workspaceCountText}
                description={workspaceDescription || description}
                statusText={workspaceStatusText}
              />
            )}
          </div>
          {toolbar ? (
            <div className="flex w-full flex-wrap items-stretch gap-2 2xl:w-auto 2xl:items-center 2xl:justify-end">
              {toolbar}
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(300px,0.92fr)] 2xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
          <div className="surface-inset rounded-2xl p-3 shadow-sm sm:p-4">
            {/* ── Search input with recent searches ── */}
            <div ref={wrapperRef} className="relative" onBlur={handleBlur}>
              <div className="relative flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
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
                    className="h-11 rounded-xl border-input bg-[var(--card)] pl-10 pr-10 text-[var(--foreground)]"
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
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
                  aria-label="提交搜尋"
                  className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-transparent bg-foreground px-4 text-sm font-semibold text-background shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  <Search className="h-4 w-4" />
                  <span className="hidden sm:inline">提交</span>
                </button>
              </div>

              {/* ── Recent searches dropdown ── */}
              {isRecentOpen && recentSearches.length > 0 && (
                <div className="surface-floating absolute left-0 right-0 top-[calc(100%+6px)] z-20 max-h-[420px] overflow-y-auto rounded-2xl">
                  {/* Header */}
                  <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--line-soft)] bg-[var(--panel-veil)] px-4 py-2.5 backdrop-blur">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                      <Clock className="h-3.5 w-3.5" />
                      最近搜尋
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
                        {recentSearches.length}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        clearAll();
                      }}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                      清除全部
                    </button>
                  </div>

                  {/* Items */}
                  <div className="py-1">
                    {recentSearches.map((term) => (
                      <div key={term} className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/70">
                        <button
                          type="button"
                          onClick={() => handlePickRecent(term)}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left text-sm text-foreground"
                        >
                          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate">{term}</span>
                        </button>
                        <button
                          type="button"
                          aria-label={`移除最近搜尋 ${term}`}
                          onClick={(event) => handleRemoveRecent(event, term)}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {showRecentSearches ? (
              recentSearches.length > 0 ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold text-muted-foreground">最近搜尋</span>
                  {recentSearches.map((term) => (
                    <span
                      key={term}
                      className="inline-flex items-center overflow-hidden rounded-full border border-[var(--line-soft)] bg-[var(--panel-soft)] text-foreground transition-colors hover:border-accent hover:bg-accent/10"
                    >
                      <button
                        type="button"
                        onClick={() => handlePickRecent(term)}
                        className="px-3 py-1"
                      >
                        {term}
                      </button>
                      <button
                        type="button"
                        aria-label={`移除最近搜尋 ${term}`}
                        onClick={(event) => handleRemoveRecent(event, term)}
                        className="border-l border-[var(--line-soft)] px-1.5 py-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={clearAll}
                    className="rounded-full px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                  >
                    清除
                  </button>
                </div>
              ) : null
            ) : null}
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
                          ? "border-foreground bg-foreground text-background"
                          : "border-[var(--line-soft)] bg-[var(--panel-soft)] text-[var(--muted-foreground)] hover:border-accent hover:bg-accent/10 hover:text-foreground"
                      )}
                    >
                      <span>{mode.label}</span>
                      {typeof mode.count === "number" ? (
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-xs",
                            selected
                              ? "bg-background/20 text-background"
                              : "bg-muted text-muted-foreground"
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

          <div className="rounded-2xl border border-[var(--line-strong)] bg-slate-950 p-3 text-white shadow-sm dark:bg-[var(--panel-strong)] dark:text-[var(--foreground)] sm:p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200 dark:text-[var(--foreground)]">
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
                      suggestionToneStyles[item.tone || "neutral"]
                    )}
                  >
                    <div className="text-sm font-semibold">{item.title}</div>
                    <div className="mt-1 text-sm leading-6 text-slate-300 dark:text-[var(--muted-foreground)]">{item.body}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-slate-300 dark:border-[var(--line-soft)] dark:bg-[var(--panel-soft)] dark:text-[var(--muted-foreground)]">
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
