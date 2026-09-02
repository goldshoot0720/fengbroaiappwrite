"use client";

import { type ReactNode, useId, useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { RecentSearchInput } from "@/components/ui/recent-search-input";
import { WorkspaceModuleIntro } from "@/components/ui/workspace-module-intro";
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
  /** Start with the AI 建議 panel expanded (defaults to collapsed). */
  defaultSuggestionsOpen?: boolean;
  /** "compact" tightens outer padding, gaps and chip sizing for data-dense modules. Defaults to "cozy" (unchanged). */
  density?: "cozy" | "compact";
  /**
   * Optional panel rendered beside the AI 建議 panel on the same row (e.g. a
   * module's VoiceCommandBar). When omitted the AI 建議 panel keeps its
   * existing full-width position below the search/summary area.
   */
  voicePanel?: ReactNode;
  /**
   * Optional compact control rendered in the same row as voicePanel/AI 建議
   * (e.g. a "清除篩選" button), instead of taking its own full-width row below.
   */
  extraPanel?: ReactNode;
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
  defaultSuggestionsOpen = false,
  density = "cozy",
  voicePanel,
  extraPanel,
}: FriendlyAiCrudShellProps) {
  const storageKey = recentSearchKey || title;
  const suggestionsContentId = useId();
  const [suggestionsOpen, setSuggestionsOpen] = useState(defaultSuggestionsOpen);
  const toggleSuggestionsLabel = suggestionsOpen ? "收起 AI 建議" : "展開 AI 建議";
  const compact = density === "compact";

  return (
    <section
      data-slot="module-workbench"
      className={cn(
        "surface-panel overflow-hidden rounded-2xl",
        compact ? "p-3 sm:p-3.5 md:p-4" : "p-3 sm:p-4 md:p-5 xl:p-6"
      )}
    >
      <div className={cn("flex flex-col", compact ? "gap-3" : "gap-4 md:gap-5")}>
        <div className={cn("flex flex-col 2xl:flex-row 2xl:items-start 2xl:justify-between", compact ? "gap-3" : "gap-4")}>
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

        <div className={cn("flex flex-col", compact ? "gap-2.5" : "gap-4")}>
          <div className={cn("surface-inset rounded-2xl shadow-sm", compact ? "p-2.5 sm:p-3" : "p-3 sm:p-4")}>
            {/* ── Search input with recent searches ── */}
            <RecentSearchInput
              value={searchQuery}
              onChange={onSearchChange}
              onClearSearch={onClearSearch}
              placeholder={searchPlaceholder}
              storageKey={storageKey}
              legacyStorageKeys={legacyRecentSearchKeys}
              showRecentSearches={showRecentSearches}
            />
            {searchExtras ? <div className={compact ? "mt-2" : "mt-3"}>{searchExtras}</div> : null}
            {modeItems.length > 0 ? (
              <div className={cn("flex flex-wrap gap-2", compact ? "mt-2.5" : "mt-4")}>
                {modeItems.map((mode) => {
                  const selected = mode.key === activeMode;
                  return (
                    <button
                      key={mode.key}
                      type="button"
                      onClick={() => onModeChange?.(mode.key)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border text-sm font-medium transition-colors",
                        compact ? "px-2.5 py-1" : "px-3 py-1.5",
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
              <div className={cn("flex flex-wrap", compact ? "mt-2.5 gap-2" : "mt-4 gap-3")}>
                {summaries.map((item) => (
                  <div
                    key={item.label}
                    className={cn(
                      "w-fit rounded-2xl border shadow-sm",
                      compact ? "px-3 py-2" : "px-4 py-3",
                      toneStyles[item.tone || "neutral"]
                    )}
                  >
                    <div className="text-xs font-semibold uppercase tracking-wide opacity-80">{item.label}</div>
                    <div className={cn("font-black leading-none", compact ? "mt-1 text-lg" : "mt-1.5 text-2xl")}>{item.value}</div>
                    {item.detail ? <div className="mt-1 text-xs opacity-80">{item.detail}</div> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div
            className={cn(
              voicePanel
                ? cn("grid gap-2.5 xl:items-start", extraPanel ? "xl:grid-cols-[1fr_1fr_auto]" : "xl:grid-cols-2")
                : extraPanel
                  ? "grid gap-2.5 xl:grid-cols-[1fr_auto] xl:items-start"
                  : "flex flex-col",
              !voicePanel && !extraPanel && (compact ? "gap-2.5" : "gap-4")
            )}
          >
            {voicePanel ? (
              <div className="min-w-0">{voicePanel}</div>
            ) : null}
            <div className="flex min-w-0 flex-col rounded-2xl border border-[var(--line-strong)] bg-slate-950 text-white shadow-sm dark:bg-[var(--panel-strong)] dark:text-[var(--foreground)]">
              <button
                type="button"
                onClick={() => setSuggestionsOpen((open) => !open)}
                className={cn("flex items-center justify-between gap-2 text-left", compact ? "p-2.5 sm:p-3" : "p-3 sm:p-4")}
                aria-expanded={suggestionsOpen}
                aria-controls={suggestionsContentId}
                aria-label={toggleSuggestionsLabel}
                title={toggleSuggestionsLabel}
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-200 dark:text-[var(--foreground)]">
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  AI 建議
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-slate-400 transition-transform duration-200",
                    suggestionsOpen && "rotate-180"
                  )}
                />
              </button>
              {suggestionsOpen ? (
                <div id={suggestionsContentId} className={cn(compact ? "px-2.5 pb-2.5 sm:px-3 sm:pb-3" : "px-3 pb-3 sm:px-4 sm:pb-4")}>
                  {suggestions.length > 0 ? (
                    <div className={cn("grid gap-3", voicePanel ? "lg:grid-cols-1 xl:grid-cols-1" : "sm:grid-cols-2 xl:grid-cols-3")}>
                      {suggestions.map((item) => (
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
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-slate-300 dark:border-[var(--line-soft)] dark:bg-[var(--panel-soft)] dark:text-[var(--muted-foreground)]">
                      資料一進來，這裡就會開始提示異常、重複與下一步整理方向。
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            {extraPanel ? (
              <div className="flex items-start xl:justify-end">{extraPanel}</div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
