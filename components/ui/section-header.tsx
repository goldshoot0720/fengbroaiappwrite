"use client";

import { useState, useEffect } from "react";
import { cn, getCurrentAccountLabel } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  accentColor?: string;
  className?: string;
  showAccountLabel?: boolean;
}

export function SectionHeader({
  title,
  subtitle,
  action,
  accentColor = "from-blue-500 to-blue-600",
  className,
  showAccountLabel = false,
}: SectionHeaderProps) {
  const [accountLabel, setAccountLabel] = useState<string>('');

  useEffect(() => {
    if (showAccountLabel) {
      setAccountLabel(getCurrentAccountLabel());
    }
  }, [showAccountLabel]);

  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4", className)}>
      <div className="flex-1 min-w-0">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100 truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
        )}
        {showAccountLabel && accountLabel && (
          <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 font-medium">
            當前帳號: {accountLabel}
          </p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

// 帶有裝飾線的小節標題
interface SubSectionHeaderProps {
  title: string;
  accentColor?: string;
  className?: string;
}

export function SubSectionHeader({
  title,
  accentColor = "from-blue-500 to-blue-600",
  className,
}: SubSectionHeaderProps) {
  return (
    <div className={cn("flex items-center gap-2 mb-4", className)}>
      <div className={cn("w-1 h-6 bg-gradient-to-b rounded-full", accentColor)} />
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
    </div>
  );
}

// 頁面標題
interface PageTitleProps {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  className?: string;
  showAccountLabel?: boolean;
}

export function PageTitle({ title, description, badge, className, showAccountLabel = false }: PageTitleProps) {
  const [accountLabel, setAccountLabel] = useState<string>('');

  useEffect(() => {
    if (showAccountLabel) {
      setAccountLabel(getCurrentAccountLabel());
    }
  }, [showAccountLabel]);

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100">
          {title}
        </h1>
        {badge}
      </div>
      {description && (
        <p className="text-gray-500 dark:text-gray-400">{description}</p>
      )}
      {showAccountLabel && accountLabel && (
        <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 font-medium">
          當前帳號: {accountLabel}
        </p>
      )}
    </div>
  );
}
