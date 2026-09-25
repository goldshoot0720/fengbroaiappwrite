"use client";

import { cn } from "@/lib/utils";

interface DataCardProps {
  children: React.ReactNode;
  className?: string;
  highlight?: "expired" | "warning" | "normal";
  id?: string;
  /** 新增／修改後捲動定位用，見 lib/revealItem.ts。 */
  "data-reveal-id"?: string;
}

const highlightStyles = {
  expired:
    "border-[rgba(170,78,60,0.25)] bg-[linear-gradient(145deg,rgba(170,78,60,0.08),rgba(255,255,255,0.72))] dark:bg-[linear-gradient(145deg,rgba(170,78,60,0.18),rgba(255,255,255,0.04))]",
  warning:
    "border-[rgba(199,149,65,0.25)] bg-[linear-gradient(145deg,rgba(199,149,65,0.1),rgba(255,255,255,0.72))] dark:bg-[linear-gradient(145deg,rgba(199,149,65,0.2),rgba(255,255,255,0.04))]",
  normal: "surface-panel",
};

export function DataCard({
  children,
  className,
  highlight = "normal",
  id,
  "data-reveal-id": dataRevealId,
}: DataCardProps) {
  return (
    <div
      id={id}
      data-reveal-id={dataRevealId}
      className={cn(
        "overflow-hidden rounded-[20px] border shadow-[var(--shadow-soft)]",
        highlightStyles[highlight],
        className
      )}
    >
      {children}
    </div>
  );
}

interface DataCardItemProps {
  children: React.ReactNode;
  className?: string;
  highlight?: "expired" | "warning" | "normal";
  onClick?: () => void;
  /** 新增／修改後捲動定位用，見 lib/revealItem.ts。 */
  "data-reveal-id"?: string;
}

export function DataCardItem({
  children,
  className,
  highlight = "normal",
  onClick,
  "data-reveal-id": dataRevealId,
}: DataCardItemProps) {
  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      onClick={onClick}
      data-reveal-id={dataRevealId}
      className={cn(
        "w-full p-4 text-left transition-colors sm:p-5",
        highlight === "expired" &&
          "bg-[rgba(170,78,60,0.05)] dark:bg-[rgba(170,78,60,0.1)]",
        highlight === "warning" &&
          "bg-[rgba(199,149,65,0.07)] dark:bg-[rgba(199,149,65,0.1)]",
        onClick &&
          "cursor-pointer hover:bg-[rgba(255,255,255,0.55)] dark:hover:bg-white/5",
        className
      )}
    >
      {children}
    </Wrapper>
  );
}

interface DataCardListProps {
  children: React.ReactNode;
  className?: string;
  divided?: boolean;
}

export function DataCardList({
  children,
  className,
  divided = true,
}: DataCardListProps) {
  return (
    <div
      className={cn(
        divided && "divide-y divide-[var(--line-soft)]",
        className
      )}
    >
      {children}
    </div>
  );
}
