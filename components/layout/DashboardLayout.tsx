"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Command,
  Menu,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BirthdayEasterEgg } from "@/components/ui/birthday-easter-egg";
import { GlobalVoiceCommandPanel } from "@/components/ui/global-voice-command-panel";
import { MusicQueuePanel } from "@/components/ui/music-queue-panel";
import { PodcastQueuePanel } from "@/components/ui/podcast-queue-panel";
import {
  DensityToggleCompact,
  ThemeToggleCompact,
} from "@/components/ui/theme-toggle";
import EnhancedScrollNavigation from "@/components/ui/enhanced-scroll-navigation";
import { VideoQueuePanel } from "@/components/ui/video-queue-panel";
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
  const [expandedItems, setExpandedItems] = useState<string[]>(["tools"]);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  const activeItem = useMemo(
    () => findMenuItem(menuItems, currentModule),
    [currentModule, menuItems]
  );

  useEffect(() => {
    const parentIds = findMenuParentIds(menuItems, currentModule);
    if (!parentIds.length) return;

    setExpandedItems((prev) => Array.from(new Set([...prev, ...parentIds])));
  }, [currentModule, menuItems]);

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

      <div className="relative z-10 flex min-h-screen flex-col">
        <DesktopTopNav
          currentModule={currentModule}
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

        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <MobileHeader
            activeLabel={activeItem?.label ?? "控制台"}
            isSidebarOpen={isSidebarOpen}
            onToggle={toggleSidebar}
          />

          <main className="min-w-0 flex-1 px-2 pb-[calc(11rem+env(safe-area-inset-bottom))] pt-3 sm:px-3 md:px-4 md:pb-8 md:pt-4 xl:px-4 xl:pb-10 xl:pt-5">
            <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-4 md:gap-5 xl:gap-6">
              {currentModule === "home" ? <SleepWarningBanner /> : null}
              <TopBar
                activeLabel={activeItem?.label ?? "首頁"}
                moduleCount={countNavigableMenuItems(menuItems)}
              />
              {currentModule === "home" && (
                <div className="relative overflow-hidden rounded-[28px]">
                  <BirthdayEasterEgg inline />
                </div>
              )}
              <div className="surface-panel pad-panel rounded-[24px] md:rounded-[28px] xl:rounded-[32px]">
                {children}
              </div>
            </div>
          </main>
        </div>
      </div>

      <div
        className={cn(isSidebarOpen && isMobile && "pointer-events-none")}
        {...(isSidebarOpen && isMobile ? { inert: true as unknown as boolean } : {})}
      >
        <MusicQueuePanel />
        <PodcastQueuePanel />
        <VideoQueuePanel />
        <GlobalVoiceCommandPanel
          currentModule={currentModule}
          menuItems={menuItems}
          onNavigate={onModuleChange}
        />
        <EnhancedScrollNavigation showThreshold={200} showProgress quickNavItems={[]} />
      </div>
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
    <header className="sticky top-0 z-[var(--z-sticky)] border-b border-[var(--line-soft)] bg-[color:var(--panel-veil)]/90 px-3 py-3.5 backdrop-blur-xl md:hidden">
      <div className="mx-auto flex max-w-[1680px] items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.32em] text-[var(--muted-foreground)]">
            FengBro Console
          </p>
          <p className="mt-1 truncate font-display text-lg font-semibold">{activeLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggleCompact />
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            aria-expanded={isSidebarOpen}
            aria-controls="mobile-sidebar"
            aria-label={isSidebarOpen ? "關閉選單" : "開啟選單"}
            className="rounded-full border border-[var(--line-strong)] bg-white/60 text-[var(--foreground)] hover:bg-white dark:bg-white/5 dark:hover:bg-white/10"
          >
            {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </Button>
        </div>
      </div>
    </header>
  );
}

/** Desktop / tablet: top multi-column multi-row navigation (replaces left sidebar). */
function DesktopTopNav({
  currentModule,
  menuItems,
  onMenuClick,
}: {
  currentModule: string;
  menuItems: MenuItem[];
  onMenuClick: (item: MenuItem) => void;
}) {
  const groups = useMemo(() => buildTopNavGroups(menuItems), [menuItems]);

  return (
    <header
      id="desktop-top-nav"
      className="sticky top-0 z-[var(--z-sticky)] hidden border-b border-[var(--line-soft)] bg-[color:var(--panel-veil)]/92 px-3 py-3 backdrop-blur-xl md:block md:px-4 xl:px-5"
    >
      <div className="mx-auto w-full max-w-[1680px] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <BrandBlock />
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-[18px] border border-[var(--line-strong)] bg-white/60 px-3 py-2 dark:bg-white/5">
              <div className="flex shrink-0 items-center gap-1">
                <ThemeToggleCompact />
                <DensityToggleCompact />
              </div>
              <div className="min-w-0">
                <p className="whitespace-nowrap text-[10px] uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                  Design Mode
                </p>
                <p className="text-xs font-medium text-[var(--foreground)]">Impeccable 2026~2027</p>
              </div>
            </div>
            <div className="hidden items-center gap-2 rounded-[18px] border border-[var(--line-strong)] bg-[linear-gradient(145deg,rgba(199,149,65,0.14),rgba(199,149,65,0.04))] px-3 py-2 lg:flex dark:bg-[linear-gradient(145deg,rgba(199,149,65,0.12),rgba(255,255,255,0.03))]">
              <Sparkles size={16} className="shrink-0 text-[var(--accent-strong)]" />
              <p className="max-w-[220px] text-xs leading-4 text-[var(--muted-foreground)]">
                Unified Household Workspace
              </p>
            </div>
          </div>
        </div>

        <nav aria-label="主要選單" className="space-y-2.5">
          {groups.map((group) => (
            <div key={group.id} className="space-y-1.5">
              {group.showLabel ? (
                <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--muted-foreground)]">
                  {group.label}
                </p>
              ) : null}
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10">
                {group.items.map((item) => {
                  const isActive = currentModule === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      title={item.label.replace(/\n/g, " ")}
                      onClick={() => onMenuClick(item)}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex min-h-[4.25rem] flex-col items-center justify-center gap-1 rounded-[18px] border px-1.5 py-2 text-center transition-all duration-200",
                        isActive
                          ? "border-transparent bg-[linear-gradient(135deg,var(--accent-strong),var(--accent))] text-[var(--accent-foreground)] shadow-[0_12px_28px_rgba(199,149,65,0.22)]"
                          : "border-[var(--line-soft)] bg-white/55 text-[var(--muted-foreground)] hover:border-[var(--line-strong)] hover:bg-white/80 hover:text-[var(--foreground)] dark:bg-white/5 dark:hover:bg-white/10"
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-8 items-center justify-center rounded-xl border transition-colors",
                          isActive
                            ? "border-white/25 bg-white/12 text-[var(--accent-foreground)]"
                            : "border-[var(--line-soft)] bg-white/80 text-[var(--foreground)] dark:bg-white/5"
                        )}
                      >
                        {item.icon}
                      </span>
                      <span className="line-clamp-2 w-full whitespace-pre-line text-[11px] font-medium leading-4">
                        {item.label}
                      </span>
                      {item.subtitle ? (
                        <span
                          className={cn(
                            "line-clamp-1 w-full text-[9px] leading-3",
                            isActive ? "text-[var(--accent-foreground)]/75" : "text-[var(--muted-foreground)]/80"
                          )}
                        >
                          {item.subtitle}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </header>
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
    <div className="fixed inset-0 z-[var(--z-drawer-open)] md:hidden">
      <div
        className="absolute inset-0 bg-[rgba(17,23,20,0.32)] backdrop-blur-sm"
        onClick={onClose}
      />
      <aside
        id="mobile-sidebar"
        className="surface-floating absolute inset-y-0 left-0 flex w-[90vw] max-w-[380px] flex-col rounded-r-[32px] border-l-0 p-4"
      >
        <div className="flex items-center justify-between">
          <BrandBlock />
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
    <div className="flex items-center gap-3">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-[18px] bg-[linear-gradient(145deg,var(--accent-strong),var(--accent))] text-[var(--accent-foreground)] shadow-[0_18px_40px_rgba(199,149,65,0.22)]">
        <Command size={compact ? 18 : 20} />
      </div>
      <div className={cn("min-w-0", compact && "hidden")}>
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

function getTaipeiHour() {
  const hourPart = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Taipei",
  })
    .formatToParts(new Date())
    .find((part) => part.type === "hour");

  return Number(hourPart?.value ?? new Date().getHours());
}

function findMenuItem(items: MenuItem[], targetId: string): MenuItem | undefined {
  for (const item of items) {
    if (item.id === targetId) return item;
    const child = item.children?.length ? findMenuItem(item.children, targetId) : undefined;
    if (child) return child;
  }

  return undefined;
}

function findMenuParentIds(items: MenuItem[], targetId: string, parents: string[] = []): string[] {
  for (const item of items) {
    if (item.id === targetId) return parents;
    if (item.children?.length) {
      const childParents = findMenuParentIds(item.children, targetId, [...parents, item.id]);
      if (childParents.length) return childParents;
    }
  }

  return [];
}

function flattenLeafMenuItems(items: MenuItem[]): MenuItem[] {
  return items.flatMap((item) => (item.children?.length ? flattenLeafMenuItems(item.children) : item));
}

function countNavigableMenuItems(items: MenuItem[]): number {
  return flattenLeafMenuItems(items).length;
}

type TopNavGroup = {
  id: string;
  label: string;
  showLabel: boolean;
  items: MenuItem[];
};

/** Build top-nav groups: leaf modules first, then each parent with children as its own multi-row block. */
function buildTopNavGroups(items: MenuItem[]): TopNavGroup[] {
  const rootLeaves: MenuItem[] = [];
  const childGroups: TopNavGroup[] = [];

  for (const item of items) {
    if (item.children?.length) {
      childGroups.push({
        id: item.id,
        label: item.label.replace(/\n/g, " "),
        showLabel: true,
        items: flattenLeafMenuItems(item.children),
      });
    } else {
      rootLeaves.push(item);
    }
  }

  const groups: TopNavGroup[] = [];
  if (rootLeaves.length) {
    groups.push({
      id: "main",
      label: "主要模組",
      showLabel: false,
      items: rootLeaves,
    });
  }
  groups.push(...childGroups);
  return groups;
}

function getSleepWarning() {
  const hour = getTaipeiHour();
  if (hour >= 0 && hour <= 2) {
    return {
      label: "\u8acb\u5165\u7761",
      range: "00:00 - 02:59",
      className: "border-amber-300 bg-amber-50 text-amber-900 shadow-[0_18px_44px_rgba(217,119,6,0.14)]",
      iconClassName: "bg-amber-100 text-amber-700",
    };
  }

  if (hour >= 3 && hour <= 6) {
    return {
      label: "\u8acb\u5165\u7761",
      range: "03:00 - 06:59",
      className: "border-red-300 bg-red-50 text-red-900 shadow-[0_18px_44px_rgba(220,38,38,0.14)]",
      iconClassName: "bg-red-100 text-red-700",
    };
  }

  return null;
}

function SleepWarningBanner() {
  const [warning, setWarning] = useState<ReturnType<typeof getSleepWarning>>(null);

  useEffect(() => {
    const updateWarning = () => setWarning(getSleepWarning());
    updateWarning();
    const timer = window.setInterval(updateWarning, 60 * 1000);
    document.addEventListener("visibilitychange", updateWarning);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", updateWarning);
    };
  }, []);

  if (!warning) return null;

  return (
    <div className={`flex items-center gap-3 rounded-[24px] border px-4 py-3 ${warning.className}`}>
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${warning.iconClassName}`}>
        <AlertTriangle size={20} />
      </span>
      <div className="min-w-0">
        <p className="text-base font-semibold leading-6">{warning.label}</p>
        <p className="text-xs leading-5 opacity-80">{warning.range}</p>
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
  const [today, setToday] = useState("今日");

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat("zh-TW", {
      month: "long",
      day: "numeric",
      weekday: "long",
      timeZone: "Asia/Taipei",
    });

    const updateToday = () => setToday(formatter.format(new Date()));
    updateToday();

    const timer = window.setInterval(updateToday, 60 * 1000);
    document.addEventListener("visibilitychange", updateToday);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", updateToday);
    };
  }, []);

  return (
    <div className="hidden flex-col gap-3 rounded-[24px] border border-[var(--line-soft)] bg-[color:var(--panel-veil)]/72 px-4 py-4 backdrop-blur-xl md:flex lg:flex-row lg:items-center lg:justify-between lg:gap-4 xl:rounded-[30px] xl:px-6">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.34em] text-[var(--muted-foreground)]">
          Active Surface
        </p>
        <h2 className="truncate font-display text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          {activeLabel}
        </h2>
      </div>

      <div className="flex flex-wrap items-center gap-2 xl:gap-3">
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
  const isChildActive = hasChildren ? Boolean(findMenuItem(item.children || [], currentModule)) : false;
  const isActive = currentModule === item.id;

  return (
    <div className={cn(level > 0 && "pl-4")}>
      <button
        type="button"
        onClick={() => onMenuClick(item)}
        aria-current={!hasChildren && isActive ? "page" : undefined}
        className={cn(
          "nav-item group flex w-full items-center justify-between rounded-[22px] px-3 text-left transition-impeccable",
          isActive || isChildActive
            ? "nav-item-active"
            : "bg-transparent text-[var(--muted-foreground)] hover:bg-white/60 hover:text-[var(--foreground)] dark:hover:bg-white/5",
          isMobile && "min-h-12"
        )}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "flex size-9 items-center justify-center rounded-2xl border transition-colors",
              isActive || isChildActive
                ? "border-white/25 bg-white/12 text-[var(--accent-foreground)]"
                : "border-[var(--line-soft)] bg-white/70 text-[var(--foreground)] dark:bg-white/5"
            )}
          >
            {item.icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block whitespace-pre-line text-sm font-medium tracking-[0.01em]">{item.label}</span>
            {item.subtitle ? (
              <span
                className={cn(
                  "mt-0.5 block text-[11px] leading-4",
                  isActive || isChildActive ? "text-[var(--accent-foreground)]/75" : "text-[var(--muted-foreground)]/80"
                )}
              >
                {item.subtitle}
              </span>
            ) : null}
          </span>
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
