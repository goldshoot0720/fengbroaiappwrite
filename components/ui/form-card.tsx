"use client";

import { cn } from "@/lib/utils";
import { SubSectionHeader } from "./section-header";

interface FormCardProps {
  title: string | React.ReactNode;
  accentColor?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormCard({
  title,
  accentColor = "from-blue-500 to-blue-600",
  children,
  className,
}: FormCardProps) {
  return (
    <div
      className={cn(
        "bg-white dark:bg-gray-800 p-4 lg:p-6 rounded-xl sm:rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700",
        className
      )}
    >
      {typeof title === 'string' ? (
        <SubSectionHeader title={title} accentColor={accentColor} />
      ) : (
        <div className="mb-4">{title}</div>
      )}
      {children}
    </div>
  );
}

// 表單網格佈局
interface FormGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

export function FormGrid({ children, columns = 4, className }: FormGridProps) {
  const gridCols = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
  };

  return (
    <div className={cn("grid gap-4", gridCols[columns], className)}>
      {children}
    </div>
  );
}

// 表單操作按鈕區
interface FormActionsProps {
  children: React.ReactNode;
  className?: string;
}

export function FormActions({ children, className }: FormActionsProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row gap-3 mt-4", className)}>
      {children}
    </div>
  );
}
