"use client";

import { useEffect, useState } from "react";
import { cn, getCurrentAccountLabel } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  titleBadge?: React.ReactNode;
  subtitle?: string;
  action?: React.ReactNode;
  accentColor?: string;
  className?: string;
  showAccountLabel?: boolean;
}

export function SectionHeader({
  title,
  titleBadge,
  subtitle,
  action,
  className,
  showAccountLabel = false,
}: SectionHeaderProps) {
  const [accountLabel, setAccountLabel] = useState("");

  useEffect(() => {
    if (showAccountLabel) {
      setAccountLabel(getCurrentAccountLabel());
    }
  }, [showAccountLabel]);

  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="min-w-0 space-y-2">
        <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted-foreground)]">
          Workspace Section
        </p>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="truncate font-display text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl lg:text-4xl">
            {title}
          </h1>
          {titleBadge}
        </div>
        {subtitle ? (
          <p className="max-w-3xl text-base leading-7 text-[var(--muted-foreground)] sm:text-lg">
            {subtitle}
          </p>
        ) : null}
        {showAccountLabel && accountLabel ? (
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            {accountLabel}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

interface SubSectionHeaderProps {
  title: string;
  accentColor?: string;
  className?: string;
}

export function SubSectionHeader({
  title,
  className,
}: SubSectionHeaderProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="h-7 w-1 rounded-full bg-[linear-gradient(180deg,var(--accent-strong),var(--accent))]" />
      <h2 className="font-display text-xl font-semibold tracking-tight text-[var(--foreground)]">
        {title}
      </h2>
    </div>
  );
}

interface PageTitleProps {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  className?: string;
  showAccountLabel?: boolean;
}

export function PageTitle({
  title,
  description,
  badge,
  className,
  showAccountLabel = false,
}: PageTitleProps) {
  const [accountLabel, setAccountLabel] = useState("");

  useEffect(() => {
    if (showAccountLabel) {
      setAccountLabel(getCurrentAccountLabel());
    }
  }, [showAccountLabel]);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted-foreground)]">
          Console View
        </p>
        {badge}
      </div>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--foreground)] sm:text-4xl">
        {title}
      </h1>
      {description ? (
        <p className="max-w-3xl text-base leading-7 text-[var(--muted-foreground)] sm:text-lg">
          {description}
        </p>
      ) : null}
      {showAccountLabel && accountLabel ? (
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--accent-strong)]">
          {accountLabel}
        </p>
      ) : null}
    </div>
  );
}
