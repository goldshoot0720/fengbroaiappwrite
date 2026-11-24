"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown, List } from "lucide-react";

interface QuickNavItem {
  id: string;
  label: string;
  elementId: string;
}

interface EnhancedScrollNavigationProps {
  showThreshold?: number;
  showProgress?: boolean;
  quickNavItems?: QuickNavItem[];
  /** When true, parent provides fixed right dock positioning. */
  docked?: boolean;
}

export default function EnhancedScrollNavigation({ 
  showThreshold = 300,
  showProgress = true,
  quickNavItems = [],
  docked = false,
}: EnhancedScrollNavigationProps) {
  const [showButtons, setShowButtons] = useState(false);
  const [isAtTop, setIsAtTop] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showQuickNav, setShowQuickNav] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;

      setShowButtons(scrollTop > showThreshold);
      setIsAtTop(scrollTop <= 10);
      setIsAtBottom(scrollTop + window.innerHeight >= document.documentElement.scrollHeight - 10);
      setScrollProgress(scrollPercent);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [showThreshold]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  const scrollToBottom = () => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth'
    });
  };

  const scrollToElement = (elementId: string) => {
    const element = document.getElementById(elementId);
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
    setShowQuickNav(false);
  };

  if (!showButtons) return null;

  // Docked: parent provides the right-side positioning. Standalone: bottom-right dock.
  // Outer pointer-events-none so the FAB stack does not block page controls (e.g. edit pens)
  // under empty space / the non-interactive progress ring; only real controls receive clicks.
  return (
    <div
      className={
        docked
          ? "pointer-events-none relative z-[var(--z-dock)] flex flex-col items-end gap-2"
          : "pointer-events-none fixed right-2 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[var(--z-dock)] flex flex-col items-end gap-3 sm:right-4 sm:bottom-6"
      }
    >
      {/* 快速導航選單 */}
      {showQuickNav && quickNavItems.length > 0 && (
        <div className="pointer-events-auto mb-2 min-w-[200px] max-w-[250px] rounded-2xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-[var(--shadow-soft)] sm:min-w-[220px]">
          <div className="border-b border-[var(--line-soft)] px-3 py-2 text-xs font-medium text-[var(--muted-foreground)]">
            快速導航
          </div>
          <div className="py-1 max-h-60 overflow-y-auto">
            {quickNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToElement(item.elementId)}
                className="w-full text-left px-3 py-2.5 text-sm text-[var(--foreground)] hover:bg-[color:var(--panel-soft)] hover:text-[var(--accent-strong)] rounded-lg transition-colors duration-150 touch-manipulation"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={`pointer-events-none flex flex-col gap-3 ${docked ? "items-end" : "items-center"}`}>
        {/* 滾動進度指示器（僅顯示，不攔截點擊） */}
        {showProgress && (
          <div className="pointer-events-none relative">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-soft)]">
              <div className="text-xs font-semibold text-[var(--foreground)]">
                {Math.round(scrollProgress)}%
              </div>
            </div>
            <svg className="absolute inset-0 h-14 w-14 -rotate-90" aria-hidden="true">
              <circle
                cx="28"
                cy="28"
                r="24"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                className="text-[var(--line-strong)]"
              />
              <circle
                cx="28"
                cy="28"
                r="24"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 24}`}
                strokeDashoffset={`${2 * Math.PI * 24 * (1 - scrollProgress / 100)}`}
                className="text-[var(--accent)]"
                strokeLinecap="round"
              />
            </svg>
          </div>
        )}

        {/* 導航按鈕容器 */}
        <div className="pointer-events-auto flex flex-col gap-2">
          {/* 快速導航按鈕 */}
          {quickNavItems.length > 0 && (
            <Button
              onClick={() => setShowQuickNav(!showQuickNav)}
              size="sm"
              variant={showQuickNav ? "default" : "outline"}
              className={`h-12 w-12 touch-manipulation rounded-full transition-impeccable active:scale-[0.97] sm:h-14 sm:w-14 ${
                showQuickNav
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[var(--shadow-soft)]"
                  : "border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] shadow-[var(--shadow-soft)] hover:bg-[var(--panel-strong)]"
              }`}
              title="快速導航選單"
            >
              <List size={18} className={showQuickNav ? "rotate-90" : ""} style={{ transition: "transform 0.2s" }} />
            </Button>
          )}

          {/* 跳轉至頂部按鈕 */}
          {!isAtTop && (
            <Button
              onClick={scrollToTop}
              size="sm"
              className="group h-12 w-12 touch-manipulation rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[var(--shadow-soft)] transition-impeccable active:scale-[0.97] sm:h-14 sm:w-14"
              title="跳轉至頂部"
            >
              <ArrowUp size={18} className="group-hover:-translate-y-0.5 transition-transform duration-200" />
            </Button>
          )}
          
          {/* 跳轉至底部按鈕 */}
          {!isAtBottom && (
            <Button
              onClick={scrollToBottom}
              size="sm"
              className="group h-12 w-12 touch-manipulation rounded-full bg-[var(--secondary)] text-[var(--secondary-foreground)] shadow-[var(--shadow-soft)] transition-impeccable active:scale-[0.97] sm:h-14 sm:w-14"
              title="跳轉至底部"
            >
              <ArrowDown size={18} className="group-hover:translate-y-0.5 transition-transform duration-200" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
