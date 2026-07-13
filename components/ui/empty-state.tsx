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
    <div className={cn("py-8 text-center sm:py-12", className)}>
      <div className="flex flex-col items-center gap-3">
        {(icon || emoji) && (
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--line-soft)] bg-muted sm:h-16 sm:w-16">
            {icon || <span className="text-2xl sm:text-3xl">{emoji}</span>}
          </div>
        )}
        <p className="font-medium text-foreground">{title}</p>
        {description && (
          <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        )}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}
