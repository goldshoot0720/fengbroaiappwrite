"use client";

import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

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
  gradient = "from-blue-500 to-blue-600",
  className,
  onClick,
}: StatCardProps) {
  const Wrapper = onClick ? "button" : "div";
  
  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        `bg-gradient-to-r ${gradient} p-4 sm:p-5 lg:p-6 rounded-xl sm:rounded-2xl text-white shadow-lg`,
        onClick && "cursor-pointer hover:scale-105 transition-transform duration-200",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-white/80 text-xs sm:text-sm font-medium truncate">
            {title}
          </p>
          <p className="text-lg sm:text-xl lg:text-2xl font-bold leading-tight mt-1">
            {value}
          </p>
        </div>
        {(Icon || iconElement) && (
          <div className="text-white/70 flex-shrink-0 ml-3">
            {Icon ? <Icon className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8" /> : iconElement}
          </div>
        )}
      </div>
    </Wrapper>
  );
}

// 簡單統計卡片
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
  bgColor = "bg-gray-50 dark:bg-gray-800",
  textColor = "text-gray-900 dark:text-gray-100",
  className,
}: SimpleStatCardProps) {
  return (
    <div className={cn("text-center p-3 sm:p-4 rounded-lg sm:rounded-xl", bgColor, className)}>
      <div className={cn("text-lg sm:text-2xl font-bold mb-1", textColor)}>
        {value}
      </div>
      <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 flex items-center justify-center gap-1">
        {icon}
        {title}
      </div>
    </div>
  );
}
