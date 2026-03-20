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
  gradient = "from-[#6f8f76] via-[#8fa67f] to-[#c79541]",
  className,
  onClick,
}: StatCardProps) {
  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-[26px] border border-white/35 bg-[rgba(255,255,255,0.72)] p-4 text-left shadow-[var(--shadow-soft)] backdrop-blur-xl transition-all duration-200 dark:border-white/8 dark:bg-white/4 sm:p-5 lg:p-6",
        onClick &&
          "cursor-pointer hover:-translate-y-1 hover:shadow-[var(--shadow-strong)]",
        className
      )}
    >
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-1 rounded-t-[26px] bg-gradient-to-r opacity-90",
          gradient
        )}
      />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.26em] text-[var(--muted-foreground)]">
            {title}
          </p>
          <p className="mt-3 break-words font-display text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">
            {value}
          </p>
        </div>
        {(Icon || iconElement) && (
          <div className="flex size-12 shrink-0 items-center justify-center rounded-[18px] border border-[var(--line-soft)] bg-[linear-gradient(145deg,rgba(255,255,255,0.88),rgba(238,233,224,0.88))] text-[var(--accent-strong)] dark:bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))]">
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
        "rounded-[22px] border border-[var(--line-soft)] p-4 text-center shadow-[var(--shadow-soft)]",
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
