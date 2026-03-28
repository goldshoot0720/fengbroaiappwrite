"use client";

import { getCurrentAccountLabel } from "@/lib/utils";

interface WorkspaceModuleIntroProps {
  title: string;
  countText: string;
  description: string;
  statusText?: string;
  showAccountLabel?: boolean;
}

export function WorkspaceModuleIntro({
  title,
  countText,
  description,
  statusText = "即時同步",
  showAccountLabel = true,
}: WorkspaceModuleIntroProps) {
  const accountLabel = showAccountLabel ? getCurrentAccountLabel() : "";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-end 2xl:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500 dark:text-slate-400">
            Workspace Section
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl lg:text-4xl">
            {title}
          </h1>
          <p className="text-base leading-7 text-slate-600 dark:text-slate-300">{countText}</p>
          {accountLabel ? (
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--accent-strong)]">
              {accountLabel}
            </p>
          ) : null}
        </div>
        <div className="inline-flex items-center gap-2 self-start rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 2xl:self-auto">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span>{statusText}</span>
        </div>
      </div>
      <p className="max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300 sm:text-base">
        {description}
      </p>
    </div>
  );
}
