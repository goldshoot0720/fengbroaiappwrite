"use client";

import { cn } from "@/lib/utils";

type StatusType =
  | "expired"
  | "urgent"
  | "warning"
  | "normal"
  | "success"
  | "info";

interface StatusBadgeProps {
  status: StatusType;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const statusStyles: Record<StatusType, string> = {
  expired:
    "bg-destructive/12 text-destructive dark:bg-destructive/20 dark:text-destructive",
  urgent:
    "bg-warning/20 text-warning-foreground dark:bg-warning/15 dark:text-warning",
  warning:
    "bg-warning/15 text-warning-foreground dark:bg-warning/12 dark:text-warning",
  normal: "bg-muted text-muted-foreground",
  success:
    "bg-success/12 text-success dark:bg-success/15 dark:text-success",
  info: "bg-info/12 text-info dark:bg-info/15 dark:text-info",
};

const sizeStyles = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-sm",
  lg: "px-3 py-1.5 text-base",
};

export function StatusBadge({
  status,
  children,
  className,
  size = "sm",
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        statusStyles[status],
        sizeStyles[size],
        className
      )}
    >
      {children}
    </span>
  );
}

interface StatusDotProps {
  status: StatusType;
  className?: string;
}

const dotStyles: Record<StatusType, string> = {
  expired: "bg-destructive",
  urgent: "bg-warning",
  warning: "bg-warning",
  normal: "bg-muted-foreground/50",
  success: "bg-success",
  info: "bg-info",
};

export function StatusDot({ status, className }: StatusDotProps) {
  return (
    <span
      className={cn("h-2 w-2 rounded-full", dotStyles[status], className)}
    />
  );
}
