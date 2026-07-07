"use client";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  emoji?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  emoji,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("text-center py-8 sm:py-12", className)}>
      <div className="flex flex-col items-center gap-3">
        {(icon || emoji) && (
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
            {icon || <span className="text-2xl sm:text-3xl">{emoji}</span>}
          </div>
        )}
        <p className="text-gray-500 dark:text-gray-400 font-medium">{title}</p>
        {description && (
          <p className="text-sm text-gray-400 dark:text-gray-500">{description}</p>
        )}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}
