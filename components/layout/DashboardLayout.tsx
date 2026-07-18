"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Command,
  LayoutGrid,
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

/** Primary bottom-tab destinations on phone (thumb zone). */
const MOBILE_PRIMARY_TAB_IDS = [
  "home",
  "dashboard",
  "subscription",
  "food",
] as const;

export default function DashboardLayout({
  children,
  currentModule,
  onModuleChange,
  menuItems,
}: DashboardLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  useEffect(() => {
    if (!(isSidebarOpen && isMobile)) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isSidebarOpen, isMobile]);

  const activeItem = useMemo(
    () => findMenuItem(menuItems, currentModule),
    [currentModule, menuItems]
  );

  const leafItems = useMemo(() => flattenLeafMenuItems(menuItems), [menuItems]);

  const primaryTabs = useMemo(() => {
    return MOBILE_PRIMARY_TAB_IDS.map((id) => {
      const item = findMenuItem(menuItems, id);
      return item
        ? { id, item, shortLabel: shortModuleLabel(item.label) }
        : null;
    }).filter(Boolean) as Array<{
      id: string;
      item: MenuItem;
      shortLabel: string;
    }>;
  }, [menuItems]);

  const isPrimaryTabActive = MOBILE_PRIMARY_TAB_IDS.includes(
    currentModule as (typeof MOBILE_PRIMARY_TAB_IDS)[number]
  );

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  const openSidebar = useCallback(() => {
    setIsSidebarOpen(true);
  }, []);

  const handleMenuClick = useCallback(
    (item: MenuItem) => {
      if (item.children?.length) {
        return;
      }

      onModuleChange(item.id);
      if (isMobile) {
        closeSidebar();
      }
    },
    [closeSidebar, isMobile, onModuleChange]
  );

  const handlePrimaryTabClick = useCallback(
    (moduleId: string) => {
      onModuleChange(moduleId);
      closeSidebar();
    },
    [closeSidebar, onModuleChange]
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
          <MobileMenuSheet
            currentModule={currentModule}
            leafItems={leafItems}
            onClose={closeSidebar}
            onNavigateLeaf={(id) => {
              onModuleChange(id);
              closeSidebar();
            }}
          />
        )}

        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <MobileHeader
            activeLabel={activeItem?.label ?? "控制台"}
            isSidebarOpen={isSidebarOpen}
            onToggle={toggleSidebar}
          />

          <main className="min-w-0 flex-1 px-3 pb-[calc(7.25rem+env(safe-area-inset-bottom))] pt-3 sm:px-3 md:px-4 md:pb-8 md:pt-4 xl:px-4 xl:pb-10 xl:pt-5">
            <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-3 md:gap-5 xl:gap-6">
              {currentModule === "home" ? <SleepWarningBanner /> : null}
              <TopBar
                activeLabel={activeItem?.label ?? "首頁"}
                moduleCount={countNavigableMenuItems(menuItems)}
              />
              {currentModule === "home" && (
                <div className="relative overflow-hidden rounded-2xl md:rounded-[28px]">
                  <BirthdayEasterEgg inline />
                </div>
              )}
              <div className="surface-panel pad-panel rounded-2xl md:rounded-[28px] xl:rounded-[32px]">
                {children}
              </div>
            </div>
          </main>
        </div>

        <MobileBottomNav
          currentModule={currentModule}
          isMenuOpen={isSidebarOpen}
          isPrimaryTabActive={isPrimaryTabActive}
          onMoreClick={openSidebar}
          onTabClick={handlePrimaryTabClick}
          tabs={primaryTabs}
        />
      </div>

      <div
        className={cn(isSidebarOpen && isMobile && "pointer-events-none")}
        {...(isSidebarOpen && isMobile ? { inert: true as unknown as boolean } : {})}
      >
        <MusicQueuePanel />
        <PodcastQueuePanel />
        <VideoQueuePanel />
        {/* 右側浮動列：語音在底欄上方一點 */}
        <div className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-2 z-[var(--z-voice)] flex max-w-[min(560px,calc(100vw-1rem))] flex-col items-end gap-2 sm:bottom-6 sm:right-4 md:bottom-6">
          <GlobalVoiceCommandPanel
            currentModule={currentModule}
            menuItems={menuItems}
            onNavigate={onModuleChange}
            docked
          />
          <EnhancedScrollNavigation showThreshold={200} showProgress quickNavItems={[]} docked />
        </div>
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
    <header className="sticky top-0 z-[var(--z-sticky)] border-b border-[var(--line-soft)] bg-[color:var(--panel-veil)]/92 pt-[env(safe-area-inset-top)] backdrop-blur-xl md:hidden">
      <div className="mx-auto flex h-14 max-w-[1680px] items-center justify-between gap-3 px-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(145deg,var(--accent-strong),var(--accent))] text-[var(--accent-foreground)] shadow-[0_8px_20px_rgba(199,149,65,0.2)]">
            <Command size={16} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-medium tracking-[0.18em] text-[var(--muted-foreground)] uppercase">
              FengBro
            </p>
            <h1 className="truncate text-base font-semibold leading-5 tracking-tight text-[var(--foreground)]">
              {activeLabel.replace(/\n/g, " ")}
            </h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <ThemeToggleCompact />
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            aria-expanded={isSidebarOpen}
            aria-controls="mobile-sidebar"
            aria-label={isSidebarOpen ? "關閉選單" : "開啟選單"}
            className="size-11 rounded-full border border-[var(--line-strong)] bg-[color:var(--panel-strong)] text-[var(--foreground)] hover:bg-[color:var(--panel-soft)]"
          >
            {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </Button>
        </div>
      </div>
    </header>
  );
}

function MobileBottomNav({
  currentModule,
  isMenuOpen,
  isPrimaryTabActive,
  onMoreClick,
  onTabClick,
  tabs,
}: {
  currentModule: string;
  isMenuOpen: boolean;
  isPrimaryTabActive: boolean;
  onMoreClick: () => void;
  onTabClick: (moduleId: string) => void;
  tabs: Array<{ id: string; item: MenuItem; shortLabel: string }>;
}) {
  return (
    <nav
      aria-label="手機快捷選單"
      className="fixed inset-x-0 bottom-0 z-[var(--z-dock)] border-t border-[var(--line-soft)] bg-[color:var(--panel-veil)]/96 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <div className="mx-auto grid h-[3.75rem] max-w-[1680px] grid-cols-5 items-stretch px-1">
        {tabs.map(({ id, item, shortLabel }) => {
          const isActive = currentModule === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTabClick(id)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 transition-impeccable active:scale-[0.97]",
                isActive
                  ? "text-[var(--accent-strong)]"
                  : "text-[var(--muted-foreground)]"
              )}
            >
              {isActive ? (
                <span
                  aria-hidden
                  className="absolute inset-x-3 top-1 h-0.5 rounded-full bg-[var(--accent-strong)]"
                />
              ) : null}
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-xl transition-colors",
                  isActive
                    ? "bg-[var(--accent)]/20 text-[var(--accent-strong)]"
                    : "text-[var(--muted-foreground)]"
                )}
              >
                {item.icon}
              </span>
              <span className="max-w-full truncate text-[10px] font-medium leading-3">
                {shortLabel}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={onMoreClick}
          aria-expanded={isMenuOpen}
          aria-controls="mobile-sidebar"
          aria-label="更多模組"
          className={cn(
            "relative flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 transition-impeccable active:scale-[0.97]",
            !isPrimaryTabActive || isMenuOpen
              ? "text-[var(--accent-strong)]"
              : "text-[var(--muted-foreground)]"
          )}
        >
          {!isPrimaryTabActive || isMenuOpen ? (
            <span
              aria-hidden
              className="absolute inset-x-3 top-1 h-0.5 rounded-full bg-[var(--accent-strong)]"
            />
          ) : null}
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-xl transition-colors",
              !isPrimaryTabActive || isMenuOpen
                ? "bg-[var(--accent)]/20 text-[var(--accent-strong)]"
                : "text-[var(--muted-foreground)]"
            )}
          >
            <LayoutGrid size={18} />
          </span>
          <span className="max-w-full truncate text-[10px] font-medium leading-3">
            更多
          </span>
        </button>
      </div>
    </nav>
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
      className="relative z-10 hidden shrink-0 border-b border-[var(--line-soft)] bg-[color:var(--panel-veil)]/92 px-3 py-3 backdrop-blur-xl md:block md:px-4 xl:px-5"
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
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-9 2xl:grid-cols-10">
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
                        "flex min-h-[4.75rem] flex-col items-center justify-center gap-1.5 rounded-[20px] border px-2 py-2.5 text-center transition-all duration-200 active:scale-[0.97]",
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

function MobileMenuSheet({
  currentModule,
  leafItems,
  onClose,
  onNavigateLeaf,
}: {
  currentModule: string;
  leafItems: MenuItem[];
  onClose: () => void;
  onNavigateLeaf: (moduleId: string) => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[var(--z-drawer-open)] md:hidden">
      <button
        type="button"
        aria-label="關閉選單背景"
        className="absolute inset-0 bg-[rgba(17,23,20,0.4)] backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside
        id="mobile-sidebar"
        role="dialog"
        aria-modal="true"
        aria-label="全部模組"
        className="surface-floating absolute inset-x-0 bottom-0 flex max-h-[min(88dvh,720px)] flex-col rounded-t-2xl border-b-0 p-0 shadow-[0_-16px_48px_rgba(0,0,0,0.16)] animate-in slide-in-from-bottom-8 duration-300 ease-out"
      >
        <div className="flex flex-col items-center px-4 pt-3">
          <span
            aria-hidden
            className="mb-3 h-1 w-10 rounded-full bg-[var(--line-strong)]"
          />
          <div className="flex w-full items-center justify-between gap-3 pb-3">
            <div className="min-w-0">
              <p className="text-[10px] font-medium tracking-[0.2em] text-[var(--muted-foreground)] uppercase">
                All modules
              </p>
              <p className="truncate text-lg font-semibold tracking-tight text-[var(--foreground)]">
                全部模組
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <DensityToggleCompact />
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                aria-label="關閉選單"
                className="size-11 rounded-full border border-[var(--line-strong)]"
              >
                <X size={18} />
              </Button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <section aria-label="快捷網格" className="pb-2">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {leafItems.map((item) => {
                const isActive = currentModule === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigateLeaf(item.id)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-2xl border px-1.5 py-2.5 text-center transition-impeccable active:scale-[0.97]",
                      isActive
                        ? "border-transparent bg-[linear-gradient(135deg,var(--accent-strong),var(--accent))] text-[var(--accent-foreground)] shadow-[0_10px_24px_rgba(199,149,65,0.2)]"
                        : "border-[var(--line-soft)] bg-[color:var(--panel-soft)] text-[var(--muted-foreground)]"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-8 items-center justify-center rounded-xl border",
                        isActive
                          ? "border-white/25 bg-white/12"
                          : "border-[var(--line-soft)] bg-white/70 text-[var(--foreground)] dark:bg-white/5"
                      )}
                    >
                      {item.icon}
                    </span>
                    <span className="line-clamp-2 w-full text-[11px] font-medium leading-tight">
                      {shortModuleLabel(item.label)}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
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

function shortModuleLabel(label: string) {
  return label
    .replace(/\n/g, " ")
    .replace(/^鋒兄/, "")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s*\（[^）]*\）/g, "")
    .trim();
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
    <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 md:rounded-[24px] ${warning.className}`}>
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

