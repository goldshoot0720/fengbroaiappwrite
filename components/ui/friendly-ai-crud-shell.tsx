"use client";

import type { ReactNode } from "react";
import { Search, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
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
  toolbar?: ReactNode;
  modeItems?: WorkbenchModeItem[];
  activeMode?: string;
  onModeChange?: (mode: string) => void;
  suggestions?: WorkbenchSuggestionItem[];
  summaries?: WorkbenchSummaryItem[];
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
  toolbar,
  modeItems = [],
  activeMode,
  onModeChange,
  suggestions = [],
  summaries = [],
}: FriendlyAiCrudShellProps) {
  return (
    <section className="overflow-hidden rounded-[24px] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(250,204,21,0.14),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.96),_rgba(248,250,252,0.96))] p-4 shadow-sm dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.2),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(250,204,21,0.16),_transparent_28%),linear-gradient(180deg,_rgba(15,23,42,0.98),_rgba(15,23,42,0.96))] sm:p-5 2xl:rounded-[28px] 2xl:p-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 min-[1400px]:flex-row min-[1400px]:items-start min-[1400px]:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-3 py-1 text-xs font-semibold tracking-wide text-sky-700 dark:border-sky-900 dark:bg-slate-900/70 dark:text-sky-300">
              <Sparkles className="h-3.5 w-3.5" />
              Friendly AI CRUD
            </div>
            <div>
              <h1 className="text-[clamp(2rem,2.6vw,3rem)] font-black tracking-tight text-slate-900 dark:text-slate-100">
                {title}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300 xl:max-w-2xl 2xl:max-w-3xl">
                {description}
              </p>
            </div>
          </div>
          {toolbar ? <div className="flex flex-wrap items-center gap-2 min-[1400px]:max-w-[46%] min-[1400px]:justify-end">{toolbar}</div> : null}
        </div>

        <div className="grid gap-4 min-[1400px]:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.85fr)] 2xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.9fr)]">
          <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={searchPlaceholder}
                className="h-11 rounded-xl border-slate-200 bg-white pl-10 dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
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
                        <span className={cn("rounded-full px-1.5 py-0.5 text-xs", selected ? "bg-white/20 text-white dark:bg-slate-950/20 dark:text-slate-950" : "bg-white text-slate-500 dark:bg-slate-800 dark:text-slate-300")}>
                          {mode.count}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
            {summaries.length > 0 ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 min-[1400px]:grid-cols-2 2xl:grid-cols-4">
                {summaries.map((item) => (
                  <div
                    key={item.label}
                    className={cn(
                      "rounded-2xl border p-4 shadow-sm",
                      toneStyles[item.tone || "neutral"]
                    )}
                  >
                    <div className="text-xs font-semibold uppercase tracking-wide opacity-80">{item.label}</div>
                    <div className="mt-2 text-2xl font-black">{item.value}</div>
                    {item.detail ? <div className="mt-1 text-xs opacity-80">{item.detail}</div> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-white/70 bg-slate-950 p-4 text-white shadow-sm dark:border-slate-800">
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
