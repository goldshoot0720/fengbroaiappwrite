"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Command,
  Menu,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggleCompact } from "@/components/ui/theme-toggle";
import EnhancedScrollNavigation from "@/components/ui/enhanced-scroll-navigation";
import { cn } from "@/lib/utils";
import { MenuItem } from "@/types";

interface DashboardLayoutProps {
  children: React.ReactNode;
  currentModule: string;
  onModuleChange: (moduleId: string) => void;
  menuItems: MenuItem[];
}

export default function DashboardLayout({
  children,
  currentModule,
  onModuleChange,
  menuItems,
}: DashboardLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  const activeItem = useMemo(
    () => menuItems.find((item) => item.id === currentModule),
    [currentModule, menuItems]
  );

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  const toggleExpanded = useCallback((itemId: string) => {
    setExpandedItems((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
  }, []);

  const handleMenuClick = useCallback(
    (item: MenuItem) => {
      if (item.children?.length) {
        toggleExpanded(item.id);
        return;
      }

      onModuleChange(item.id);
      if (isMobile) {
        closeSidebar();
      }
    },
    [closeSidebar, isMobile, onModuleChange, toggleExpanded]
  );

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <AmbientBackdrop />

      <div className="relative z-10 flex min-h-screen">
        <DesktopSidebar
          currentModule={currentModule}
          expandedItems={expandedItems}
          menuItems={menuItems}
          onMenuClick={handleMenuClick}
        />

        {isSidebarOpen && (
          <MobileSidebar
            currentModule={currentModule}
            expandedItems={expandedItems}
            isMobile={isMobile}
            menuItems={menuItems}
            onClose={closeSidebar}
            onMenuClick={handleMenuClick}
          />
        )}

        <div className="relative flex min-h-screen flex-1 flex-col">
          <MobileHeader
            activeLabel={activeItem?.label ?? "控制台"}
            isSidebarOpen={isSidebarOpen}
            onToggle={toggleSidebar}
          />

          <main className="flex-1 px-4 pb-8 pt-4 sm:px-6 lg:px-8 lg:pb-10 lg:pt-6">
            <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
              <TopBar
                activeLabel={activeItem?.label ?? "首頁"}
                moduleCount={menuItems.length}
              />
              <div className="surface-panel rounded-[32px] p-4 sm:p-6 lg:p-8">
                {children}
              </div>
            </div>
          </main>
        </div>
      </div>

      <EnhancedScrollNavigation showThreshold={200} showProgress quickNavItems={[]} />
    </div>
  );
}

function AmbientBackdrop() {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(199,149,65,0.18),transparent_32%),radial-gradient(circle_at_85%_12%,rgba(91,114,95,0.18),transparent_28%),linear-gradient(180deg,rgba(248,245,239,0.94),rgba(238,233,224,0.92))] dark:bg-[radial-gradient(circle_at_top_left,rgba(199,149,65,0.14),transparent_28%),radial-gradient(circle_at_85%_10%,rgba(100,139,111,0.16),transparent_24%),linear-gradient(180deg,rgba(21,26,23,0.96),rgba(12,16,14,0.98))]" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-48 bg-[linear-gradient(180deg,rgba(255,255,255,0.54),transparent)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent)]" />
    </>
  );
}

function MobileHeader({
  activeLabel,
  isSidebarOpen,
  onToggle,
}: {
  activeLabel: string;
  isSidebarOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line-soft)] bg-[color:var(--panel-veil)]/90 px-4 py-3 backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.32em] text-[var(--muted-foreground)]">
            FengBro Console
          </p>
          <p className="truncate font-display text-lg font-semibold">{activeLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggleCompact />
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="rounded-full border border-[var(--line-strong)] bg-white/60 text-[var(--foreground)] hover:bg-white dark:bg-white/5 dark:hover:bg-white/10"
          >
            {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </Button>
        </div>
      </div>
    </header>
  );
}

function DesktopSidebar({
  currentModule,
  expandedItems,
  menuItems,
  onMenuClick,
}: {
  currentModule: string;
  expandedItems: string[];
  menuItems: MenuItem[];
  onMenuClick: (item: MenuItem) => void;
}) {
  return (
    <aside className="hidden w-[320px] shrink-0 border-r border-[var(--line-soft)] px-5 py-6 lg:flex">
      <div className="surface-panel flex w-full flex-col rounded-[34px] p-5">
        <BrandBlock />

        <div className="mt-8 flex items-center justify-between rounded-[24px] border border-[var(--line-strong)] bg-white/60 px-4 py-3 dark:bg-white/5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted-foreground)]">
              Design Mode
            </p>
            <p className="mt-1 text-sm font-medium text-[var(--foreground)]">
              Impeccable 2026
            </p>
          </div>
          <ThemeToggleCompact />
        </div>

        <nav className="mt-8 flex-1 space-y-2 overflow-y-auto pr-1">
          {menuItems.map((item) => (
            <MenuItemComponent
              key={item.id}
              currentModule={currentModule}
              expandedItems={expandedItems}
              item={item}
              onMenuClick={onMenuClick}
            />
          ))}
        </nav>

        <div className="mt-6 rounded-[28px] border border-[var(--line-strong)] bg-[linear-gradient(145deg,rgba(199,149,65,0.16),rgba(199,149,65,0.04))] p-5 dark:bg-[linear-gradient(145deg,rgba(199,149,65,0.14),rgba(255,255,255,0.03))]">
          <div className="flex items-start gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-[var(--accent)]/15 text-[var(--accent-strong)]">
              <Sparkles size={18} />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Unified Household Workspace
              </p>
              <p className="text-sm leading-6 text-[var(--muted-foreground)]">
                將食材、訂閱、影音、文件與帳號集中在一個節奏一致的介面裡。
              </p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function MobileSidebar({
  currentModule,
  expandedItems,
  isMobile,
  menuItems,
  onClose,
  onMenuClick,
}: {
  currentModule: string;
  expandedItems: string[];
  isMobile: boolean;
  menuItems: MenuItem[];
  onClose: () => void;
  onMenuClick: (item: MenuItem) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div
        className="absolute inset-0 bg-[rgba(17,23,20,0.32)] backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="surface-panel absolute inset-y-0 left-0 flex w-[88vw] max-w-[360px] flex-col rounded-r-[32px] border-l-0 p-5">
        <div className="flex items-center justify-between">
          <BrandBlock compact />
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full border border-[var(--line-strong)]"
          >
            <X size={18} />
          </Button>
        </div>

        <nav className="mt-8 flex-1 space-y-2 overflow-y-auto pr-1">
          {menuItems.map((item) => (
            <MenuItemComponent
              key={item.id}
              currentModule={currentModule}
              expandedItems={expandedItems}
              isMobile={isMobile}
              item={item}
              onMenuClick={onMenuClick}
            />
          ))}
        </nav>
      </aside>
    </div>
  );
}

function BrandBlock({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-[18px] bg-[linear-gradient(145deg,var(--accent-strong),var(--accent))] text-[var(--accent-foreground)] shadow-[0_18px_40px_rgba(199,149,65,0.22)]">
        <Command size={compact ? 18 : 20} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.34em] text-[var(--muted-foreground)]">
          FengBro
        </p>
        <h1 className="truncate font-display text-xl font-semibold tracking-tight text-[var(--foreground)]">
          AI Appwrite Console
        </h1>
      </div>
    </div>
  );
}

function TopBar({
  activeLabel,
  moduleCount,
}: {
  activeLabel: string;
  moduleCount: number;
}) {
  const today = new Intl.DateTimeFormat("zh-TW", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());

  return (
    <div className="hidden items-center justify-between gap-4 rounded-[30px] border border-[var(--line-soft)] bg-[color:var(--panel-veil)]/72 px-6 py-4 backdrop-blur-xl lg:flex">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.34em] text-[var(--muted-foreground)]">
          Active Surface
        </p>
        <h2 className="truncate font-display text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          {activeLabel}
        </h2>
      </div>

      <div className="flex items-center gap-3">
        <StatusPill label={today} value="Today" />
        <StatusPill label={`${moduleCount} 個模組`} value="Modules" />
      </div>
    </div>
  );
}

function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-[var(--line-strong)] bg-white/68 px-4 py-2 text-right dark:bg-white/5">
      <p className="text-[10px] uppercase tracking-[0.26em] text-[var(--muted-foreground)]">
        {value}
      </p>
      <p className="text-sm font-medium text-[var(--foreground)]">{label}</p>
    </div>
  );
}

function MenuItemComponent({
  currentModule,
  expandedItems,
  item,
  onMenuClick,
  level = 0,
  isMobile = false,
}: {
  currentModule: string;
  expandedItems: string[];
  item: MenuItem;
  onMenuClick: (item: MenuItem) => void;
  level?: number;
  isMobile?: boolean;
}) {
  const hasChildren = Boolean(item.children?.length);
  const isExpanded = expandedItems.includes(item.id);
  const isActive = currentModule === item.id;

  return (
    <div className={cn(level > 0 && "pl-4")}>
      <button
        onClick={() => onMenuClick(item)}
        className={cn(
          "group flex w-full items-center justify-between rounded-[22px] px-4 py-3 text-left transition-all duration-200",
          isActive
            ? "bg-[linear-gradient(135deg,var(--accent-strong),var(--accent))] text-[var(--accent-foreground)] shadow-[0_18px_36px_rgba(199,149,65,0.25)]"
            : "bg-transparent text-[var(--muted-foreground)] hover:bg-white/60 hover:text-[var(--foreground)] dark:hover:bg-white/5",
          isMobile && "min-h-12"
        )}
      >
        <span className="flex items-center gap-3">
          <span
            className={cn(
              "flex size-9 items-center justify-center rounded-2xl border transition-colors",
              isActive
                ? "border-white/25 bg-white/12 text-[var(--accent-foreground)]"
                : "border-[var(--line-soft)] bg-white/70 text-[var(--foreground)] dark:bg-white/5"
            )}
          >
            {item.icon}
          </span>
          <span className="text-sm font-medium tracking-[0.01em]">{item.label}</span>
        </span>

        {hasChildren ? (
          isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
        ) : null}
      </button>

      {hasChildren && isExpanded ? (
        <div className="mt-2 space-y-2">
          {item.children?.map((child) => (
            <MenuItemComponent
              key={child.id}
              currentModule={currentModule}
              expandedItems={expandedItems}
              isMobile={isMobile}
              item={child}
              level={level + 1}
              onMenuClick={onMenuClick}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
