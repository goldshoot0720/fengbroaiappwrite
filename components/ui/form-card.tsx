"use client";

import { cn } from "@/lib/utils";
import { SubSectionHeader } from "./section-header";

interface FormCardProps {
  title: string | React.ReactNode;
  /** @deprecated Brand rail is gold by default; gradient class strings are ignored for Impeccable shell. */
  accentColor?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormCard({
  title,
  accentColor: _accentColor,
  children,
  className,
}: FormCardProps) {
  return (
    <div
      className={cn(
        "surface-raised rounded-xl p-4 sm:rounded-2xl lg:p-6",
        className
      )}
    >
      {typeof title === "string" ? (
        <SubSectionHeader title={title} />
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
    3: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4",
  };

  return (
    <div className={cn("grid gap-stack", gridCols[columns], className)}>
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
    <div
      className={cn(
        "mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center [&>*]:w-full sm:[&>*]:w-auto",
        className
      )}
    >
      {children}
    </div>
  );
}
