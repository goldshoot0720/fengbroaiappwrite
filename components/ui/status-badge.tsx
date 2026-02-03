"use client";

import { cn } from "@/lib/utils";

type StatusType = "expired" | "urgent" | "warning" | "normal" | "success" | "info";

interface StatusBadgeProps {
  status: StatusType;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const statusStyles: Record<StatusType, string> = {
  expired: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  urgent: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  normal: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
  success: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

const sizeStyles = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-sm",
  lg: "px-3 py-1.5 text-base",
};

export function StatusBadge({ status, children, className, size = "sm" }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full",
        statusStyles[status],
        sizeStyles[size],
        className
      )}
    >
      {children}
    </span>
  );
}

// 狀態指示點
interface StatusDotProps {
  status: StatusType;
  className?: string;
}

const dotStyles: Record<StatusType, string> = {
  expired: "bg-red-500",
  urgent: "bg-orange-500",
  warning: "bg-yellow-500",
  normal: "bg-gray-400",
  success: "bg-green-500",
  info: "bg-blue-500",
};

export function StatusDot({ status, className }: StatusDotProps) {
  return (
    <span className={cn("w-2 h-2 rounded-full", dotStyles[status], className)} />
  );
}
