"use client";

import { getCurrentAccountLabel } from "@/lib/utils";

interface WorkspaceModuleIntroProps {
  title: string;
  countText?: string;
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
          <p className="text-micro text-[var(--muted-foreground)]">
            Workspace Section
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl lg:text-4xl">
            {title}
          </h1>
          {countText ? <p className="text-base leading-7 text-[var(--muted-foreground)]">{countText}</p> : null}
          {accountLabel ? (
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--accent-strong)]">
              {accountLabel}
            </p>
          ) : null}
        </div>
        <div className="surface-inset inline-flex items-center gap-2 self-start rounded-xl px-4 py-2 text-sm text-[var(--muted-foreground)] 2xl:self-auto">
          <div className="h-2 w-2 rounded-full bg-success" />
          <span>{statusText}</span>
        </div>
      </div>
      <p className="max-w-3xl text-sm leading-7 text-[var(--muted-foreground)] sm:text-base">
        {description}
      </p>
    </div>
  );
}
