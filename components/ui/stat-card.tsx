"use client";

import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  iconElement?: React.ReactNode;
  gradient?: string;
  className?: string;
  onClick?: () => void;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  iconElement,
  className,
  onClick,
}: StatCardProps) {
  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-[var(--line-soft)] bg-[var(--card)] p-4 text-left shadow-[var(--shadow-soft)] transition-impeccable sm:p-5 lg:p-6",
        onClick &&
          "cursor-pointer hover:bg-[var(--panel-strong)]",
        className
      )}
    >
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-[var(--muted-foreground)]">
            {title}
          </p>
          <p className="tabular-nums mt-3 break-words font-display text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">
            {value}
          </p>
        </div>
        {(Icon || iconElement) && (
          <div className="surface-inset flex size-12 shrink-0 items-center justify-center rounded-xl text-[var(--accent-strong)]">
            {Icon ? <Icon className="size-5" /> : iconElement}
          </div>
        )}
      </div>
    </Wrapper>
  );
}

interface SimpleStatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  bgColor?: string;
  textColor?: string;
  className?: string;
}

export function SimpleStatCard({
  title,
  value,
  icon,
  bgColor = "bg-white/70 dark:bg-white/5",
  textColor = "text-[var(--foreground)]",
  className,
}: SimpleStatCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--line-soft)] bg-[var(--panel-soft)] p-4 text-center shadow-[var(--shadow-soft)]",
        bgColor,
        className
      )}
    >
      <div className={cn("font-display text-2xl font-semibold", textColor)}>
        {value}
      </div>
      <div className="mt-2 flex items-center justify-center gap-1 text-sm text-[var(--muted-foreground)]">
        {icon}
        {title}
      </div>
    </div>
  );
}
