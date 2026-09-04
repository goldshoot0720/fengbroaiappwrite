"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { DataCard } from "@/components/ui/data-card";

interface CollapsibleSettingsCardProps {
  icon: ReactNode;
  title: ReactNode;
  subtitle?: string;
  accent?: string;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
}

export function CollapsibleSettingsCard({
  icon,
  title,
  subtitle,
  accent = "bg-gray-100 dark:bg-gray-800/60 text-gray-600 dark:text-gray-400",
  children,
  className,
  defaultOpen = false,
}: CollapsibleSettingsCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <DataCard className={className}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 p-6 text-left"
        aria-expanded={open}
      >
        <div className={`p-2 rounded-lg ${accent}`}>{icon}</div>
        <div className="min-w-0 flex-1 text-left">
          {title}
          {subtitle ? <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p> : null}
        </div>
        {open ? (
          <ChevronDown size={20} className="shrink-0 text-gray-400" />
        ) : (
          <ChevronRight size={20} className="shrink-0 text-gray-400" />
        )}
      </button>
      {open ? <div className="px-6 pb-6">{children}</div> : null}
    </DataCard>
  );
}