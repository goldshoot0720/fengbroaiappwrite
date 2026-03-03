"use client";

import { cn } from "@/lib/utils";

interface DataCardProps {
  children: React.ReactNode;
  className?: string;
  highlight?: "expired" | "warning" | "normal";
}

const highlightStyles = {
  expired: "bg-red-50 dark:bg-red-900/20",
  warning: "bg-yellow-50 dark:bg-yellow-900/20",
  normal: "",
};

export function DataCard({ children, className, highlight = "normal" }: DataCardProps) {
  return (
    <div
      className={cn(
        "bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden",
        className
      )}
    >
      {children}
    </div>
  );
}

// 資料卡片項目
interface DataCardItemProps {
  children: React.ReactNode;
  className?: string;
  highlight?: "expired" | "warning" | "normal";
  onClick?: () => void;
}

export function DataCardItem({
  children,
  className,
  highlight = "normal",
  onClick,
}: DataCardItemProps) {
  const Wrapper = onClick ? "button" : "div";
  
  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        "p-4 w-full text-left",
        highlightStyles[highlight],
        onClick && "hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer",
        className
      )}
    >
      {children}
    </Wrapper>
  );
}

// 資料卡片列表
interface DataCardListProps {
  children: React.ReactNode;
  className?: string;
  divided?: boolean;
}

export function DataCardList({ children, className, divided = true }: DataCardListProps) {
  return (
    <div className={cn(divided && "divide-y divide-gray-100 dark:divide-gray-700", className)}>
      {children}
    </div>
  );
}
