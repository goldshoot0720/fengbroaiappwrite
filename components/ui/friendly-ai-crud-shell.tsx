"use client";

import { type ReactNode } from "react";
import { Sparkles } from "lucide-react";
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
            <RecentSearchInput
              value={searchQuery}
              onChange={onSearchChange}
              onClearSearch={onClearSearch}
              placeholder={searchPlaceholder}
              storageKey={storageKey}
              legacyStorageKeys={legacyRecentSearchKeys}
              showRecentSearches={showRecentSearches}
            />
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
