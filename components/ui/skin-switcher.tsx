"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A module can present the same records through several borrowed interfaces —
 * a video library that reads as Netflix, YouTube or Bilibili; a drive that
 * reads as Google Drive, MEGA or Dropbox. Those looks live outside the app's
 * own clay palette on purpose: the whole point is that each one feels like the
 * product it imitates, so the brand color is passed in per option rather than
 * pulled from a token.
 */
export interface SkinOption<T extends string> {
  value: T;
  /** Shown from `sm` up; the icon carries the button on phones. */
  label: string;
  icon?: React.ReactNode;
  /** Brand fill for the active pill, e.g. "#E50914". */
  color: string;
  /** Text drawn on that fill. Defaults to white. */
  onColor?: string;
  title?: string;
}

interface SkinSwitcherProps<T extends string> {
  value: T;
  options: readonly SkinOption<T>[];
  onChange: (value: T) => void;
  /** Accessible name for the group, e.g. "列表版型". */
  label: string;
  className?: string;
  /** Hide text labels entirely; useful in dense toolbars. */
  iconOnly?: boolean;
}

export function SkinSwitcher<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
  iconOnly = false,
}: SkinSwitcherProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "flex items-center gap-0.5 rounded-full bg-neutral-100 p-1 dark:bg-neutral-800/80",
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            title={option.title ?? option.label}
            aria-pressed={active}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent",
              active
                ? "shadow-sm"
                : "text-neutral-600 hover:bg-neutral-200/80 dark:text-neutral-300 dark:hover:bg-neutral-700"
            )}
            style={
              active
                ? {
                    backgroundColor: option.color,
                    color: option.onColor ?? "#ffffff",
                  }
                : undefined
            }
          >
            {option.icon}
            {!iconOnly && <span className="hidden sm:inline">{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

interface SkinChipsProps {
  values: readonly string[];
  active: string | null;
  onChange: (value: string | null) => void;
  /** Label for the "show everything" chip. */
  allLabel?: string;
  label: string;
  /** Chip look: YouTube uses solid ink, Bilibili a soft blue wash. */
  variant?: "youtube" | "bilibili";
  className?: string;
}

/**
 * The horizontal filter rail both YouTube and Bilibili put above a grid.
 * Scrolls rather than wraps, so a long category list never pushes the grid
 * down the page.
 */
export function SkinChips({
  values,
  active,
  onChange,
  allLabel = "全部",
  label,
  variant = "youtube",
  className,
}: SkinChipsProps) {
  const chip = (chipValue: string | null, text: string) => {
    const isActive = chipValue === active;
    const base =
      "inline-flex h-8 shrink-0 items-center rounded-lg px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2";
    const youtube = isActive
      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
      : "bg-neutral-200/70 text-neutral-800 hover:bg-neutral-300/70 dark:bg-white/10 dark:text-neutral-200 dark:hover:bg-white/20";
    const bilibili = isActive
      ? "bg-[#00a1d6] text-white"
      : "bg-white text-neutral-700 hover:bg-[#e5f6fd] hover:text-[#00a1d6] dark:bg-white/10 dark:text-neutral-200 dark:hover:bg-[#00a1d6]/25";

    return (
      <button
        key={chipValue ?? "__all__"}
        type="button"
        onClick={() => onChange(chipValue)}
        aria-pressed={isActive}
        className={cn(base, variant === "bilibili" ? bilibili : youtube)}
      >
        {text}
      </button>
    );
  };

  return (
    <div
      role="group"
      aria-label={label}
      className={cn("no-scrollbar flex items-center gap-2 overflow-x-auto pb-1", className)}
    >
      {chip(null, allLabel)}
      {values.map((entry) => chip(entry, entry))}
    </div>
  );
}
