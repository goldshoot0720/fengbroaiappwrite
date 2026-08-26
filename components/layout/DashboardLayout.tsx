"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Command,
  LayoutGrid,
  Menu,
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

/** Derive active parent from leaf module id + menu tree */
function findActiveParent(
  items: MenuItem[],
  leafId: string
): MenuItem | undefined {
  for (const item of items) {
    if (item.children?.length) {
      if (item.children.some((c) => c.id === leafId)) return item;
      const deeper = findActiveParent(item.children, leafId);
      if (deeper) return item;
    }
  }
  return undefined;
}

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
  const activeLabel = useMemo(
    () => formatActiveModuleLabel(activeItem, "控制台"),
    [activeItem]
  );

  useEffect(() => {
    document.title = activeLabel === "首頁" ? "鋒兄AI Appwrite" : `${activeLabel} · 鋒兄AI Appwrite`;
  }, [activeLabel]);

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
    (moduleId: string) => {
      onModuleChange(moduleId);
      if (isMobile) closeSidebar();
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
        {/* Desktop horizontal top nav */}
        <DesktopTopNav
          activeLabel={activeLabel}
          currentModule={currentModule}
          menuItems={menuItems}
          onModuleChange={handleMenuClick}
        />

        {/* Mobile header bar */}
        <MobileHeader
          activeLabel={activeLabel}
          isSidebarOpen={isSidebarOpen}
          onToggle={toggleSidebar}
        />

        {/* Mobile full-screen menu sheet */}
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

        {/* Main content */}
        <main className="min-w-0 flex-1 px-3 pb-[calc(7.25rem+env(safe-area-inset-bottom))] pt-3 sm:px-4 md:px-6 md:pb-10 md:pt-6 xl:px-8 xl:pb-12 xl:pt-8">
          <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-3 md:gap-5 xl:gap-6">
            {currentModule === "home" ? <SleepWarningBanner /> : null}
            {currentModule === "home" && (
              <div className="relative overflow-hidden rounded-2xl md:rounded-[28px]">
                <BirthdayEasterEgg inline />
              </div>
            )}
            <div className="surface-panel pad-panel rounded-2xl md:rounded-[28px] xl:rounded-[32px]">
              <div className="mb-5 flex flex-col gap-3 border-b border-[var(--line-soft)] pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--foreground)]">語音 CRUD 管理</p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">快速導覽與操作目前頁面</p>
                </div>
                <GlobalVoiceCommandPanel
                  currentModule={currentModule}
                  menuItems={menuItems}
                  onNavigate={onModuleChange}
                  docked
                />
              </div>
              {children}
            </div>
          </div>
        </main>

        {/* Mobile bottom nav */}
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
        className={cn(isSidebarOpen && isMobile && "pointer-events-none hidden")}
        {...(isSidebarOpen && isMobile ? { inert: true as unknown as boolean } : {})}
        aria-hidden={isSidebarOpen && isMobile ? true : undefined}
      >
        <MusicQueuePanel />
        <PodcastQueuePanel />
        <VideoQueuePanel />
        <div className="pointer-events-none fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-2 z-[var(--z-voice)] flex max-w-[min(560px,calc(100vw-1rem))] flex-col items-end gap-2 sm:bottom-6 sm:right-4 md:bottom-6">
          <EnhancedScrollNavigation showThreshold={200} showProgress quickNavItems={[]} docked />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Desktop Horizontal Top Navigation (2 rows)
// ─────────────────────────────────────────────

function DesktopTopNav({
  activeLabel,
  currentModule,
  menuItems,
  onModuleChange,
}: {
  activeLabel: string;
  currentModule: string;
  menuItems: MenuItem[];
  onModuleChange: (id: string) => void;
}) {
  const activeParent = useMemo(
    () => findActiveParent(menuItems, currentModule),
    [menuItems, currentModule]
  );

  const activeTopId = useMemo(() => {
    const rootLeaf = menuItems.find((m) => m.id === currentModule && !m.children?.length);
    if (rootLeaf) return rootLeaf.id;
    return activeParent?.id ?? currentModule;
  }, [menuItems, currentModule, activeParent]);

  const subItems = useMemo(() => {
    const parent = menuItems.find((m) => m.id === activeTopId);
    return parent?.children ?? [];
  }, [menuItems, activeTopId]);

  const handleTopClick = useCallback(
    (item: MenuItem) => {
      if (!item.children?.length) {
        onModuleChange(item.id);
        return;
      }
      const alreadyInGroup =
        currentModule === item.id ||
        item.children.some((child) => child.id === currentModule);
      if (alreadyInGroup) return;
      onModuleChange(item.children[0].id);
    },
    [currentModule, onModuleChange]
  );

  return (
    <header
      id="desktop-top-nav"
      className="sticky top-0 z-[var(--z-sticky)] hidden border-b border-[var(--line-soft)] bg-[color:var(--panel-veil)]/95 backdrop-blur-xl md:block"
    >
      <div className="mx-auto flex h-14 max-w-[1680px] items-center gap-1.5 px-2 sm:gap-2 sm:px-3 xl:gap-3 xl:px-5">
        <BrandBlock compact title={activeLabel} />
        <nav
          aria-label="主要導覽"
          className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto overscroll-x-contain py-1 [scrollbar-width:thin]"
        >
          {menuItems.map((item) => {
            const isActive = activeTopId === item.id;
            return (
              <TopNavTab
                key={item.id}
                item={item}
                isActive={isActive}
                onClick={() => handleTopClick(item)}
              />
            );
          })}
        </nav>
        <DesignModeCluster />
      </div>

      {subItems.length > 0 ? (
        <div className="border-t border-[var(--line-soft)] bg-[color:var(--panel-soft)]/55">
          <nav
            aria-label="子導覽"
            className="mx-auto flex max-w-[1680px] items-center gap-0.5 overflow-x-auto overscroll-x-contain px-3 py-1 xl:px-5 [scrollbar-width:thin]"
          >
            {subItems.map((child) => {
              const isActive = currentModule === child.id;
              return (
                <TopNavTab
                  key={child.id}
                  compact
                  item={child}
                  isActive={isActive}
                  onClick={() => onModuleChange(child.id)}
                />
              );
            })}
          </nav>
        </div>
      ) : null}
    </header>
  );
}

function TopNavTab({
  compact = false,
  item,
  isActive,
  onClick,
}: {
  compact?: boolean;
  item: MenuItem;
  isActive: boolean;
  onClick: () => void;
}) {
  const { primary, secondary } = splitMenuLabel(item);
  const title = formatActiveModuleLabel(item, primary);

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "nav-item flex shrink-0 items-center whitespace-nowrap rounded-xl text-left transition-impeccable focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]",
        compact ? "min-h-11 gap-1.5 px-2.5" : "min-h-11 gap-1.5 px-2.5 xl:gap-2 xl:px-3",
        isActive
          ? "nav-item-active"
          : "text-[var(--muted-foreground)] hover:bg-[color:var(--panel-soft)] hover:text-[var(--foreground)]"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "shrink-0 items-center justify-center",
          compact
            ? "flex size-4 [&_svg]:size-3.5"
            : "hidden size-[18px] [&_svg]:size-4 xl:flex",
          isActive ? "text-[var(--accent-foreground)]" : "opacity-85"
        )}
      >
        {item.icon}
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block font-medium leading-4",
            compact ? "text-[13px]" : "text-sm"
          )}
        >
          {primary}
        </span>
        {secondary ? (
          <span
            className={cn(
              "block text-[11px] leading-4",
              isActive
                ? "text-[var(--accent-foreground)]/80"
                : "text-[var(--muted-foreground)]/85"
            )}
          >
            {secondary}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function DesignModeCluster() {
  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-[var(--line-strong)] bg-white/60 px-1 py-1 dark:bg-white/5">
      <ThemeToggleCompact />
      <DensityToggleCompact />
      <div className="hidden min-w-0 pr-1.5 leading-none xl:block">
        <p className="whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          Design Mode
        </p>
        <p className="text-xs font-medium leading-tight text-[var(--foreground)]">
          Impeccable 2026~2027
        </p>
      </div>
    </div>
  );
}

function BrandBlock({
  compact = false,
  title = "控制台",
}: {
  compact?: boolean;
  title?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", compact && "shrink-0")}>
      <div
        className={cn(
          "flex shrink-0 items-center justify-center bg-[linear-gradient(145deg,var(--accent-strong),var(--accent))] text-[var(--accent-foreground)]",
          compact
            ? "size-8 rounded-lg shadow-[0_4px_12px_rgba(199,149,65,0.18)]"
            : "size-9 rounded-xl shadow-[0_8px_20px_rgba(199,149,65,0.2)]"
        )}
      >
        <Command size={compact ? 14 : 16} />
      </div>
      <div className={cn("min-w-0", compact && "hidden lg:block")}>
        <p
          className={cn(
            "uppercase text-[var(--muted-foreground)]",
            compact
              ? "text-[10px] font-medium leading-none tracking-[0.16em]"
              : "truncate text-xs font-medium tracking-[0.16em]"
          )}
        >
          FengBro
        </p>
        {compact ? null : (
          <h1 className="truncate text-lg font-semibold leading-6 tracking-tight text-[var(--foreground)]">
            {title}
          </h1>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Ambient backdrop
// ─────────────────────────────────────────────

function AmbientBackdrop() {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(199,149,65,0.18),transparent_32%),radial-gradient(circle_at_85%_12%,rgba(91,114,95,0.18),transparent_28%),linear-gradient(180deg,rgba(248,245,239,0.94),rgba(238,233,224,0.92))] dark:bg-[radial-gradient(circle_at_top_left,rgba(199,149,65,0.14),transparent_28%),radial-gradient(circle_at_85%_10%,rgba(100,139,111,0.16),transparent_24%),linear-gradient(180deg,rgba(21,26,23,0.96),rgba(12,16,14,0.98))]" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-48 bg-[linear-gradient(180deg,rgba(255,255,255,0.54),transparent)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent)]" />
    </>
  );
}

// ─────────────────────────────────────────────
// Mobile Header
// ─────────────────────────────────────────────

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
        <BrandBlock title={activeLabel} />
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

// ─────────────────────────────────────────────
// Mobile Bottom Nav
// ─────────────────────────────────────────────

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
              <span className="max-w-full truncate text-xs font-medium leading-4">
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
          <span className="max-w-full truncate text-xs font-medium leading-4">
            更多
          </span>
        </button>
      </div>
    </nav>
  );
}

// ─────────────────────────────────────────────
// Mobile Menu Sheet
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function splitMenuLabel(item: MenuItem): { primary: string; secondary?: string } {
  const lines = item.label
    .split("\n")
    .map((part) => part.trim())
    .filter(Boolean);
  const primary = lines[0] || item.label;
  const fromLabel = lines.slice(1).join(" ").trim();
  const secondary = item.subtitle?.trim() || fromLabel || undefined;
  return { primary, secondary };
}

function formatActiveModuleLabel(item: MenuItem | undefined, fallback = "控制台") {
  if (!item?.label) return fallback;
  const { primary, secondary } = splitMenuLabel(item);
  return (secondary ? `${primary} ${secondary}` : primary).replace(/\s+/g, " ").trim() || fallback;
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
  return items.flatMap((item) =>
    item.children?.length ? flattenLeafMenuItems(item.children) : item
  );
}

function getSleepWarning() {
  const hour = getTaipeiHour();
  if (hour >= 0 && hour <= 2) {
    return {
      label: "\u8acb\u5165\u7761",
      range: "00:00 - 02:59",
      className:
        "border-amber-300 bg-amber-50 text-amber-900 shadow-[0_18px_44px_rgba(217,119,6,0.14)]",
      iconClassName: "bg-amber-100 text-amber-700",
    };
  }

  if (hour >= 3 && hour <= 6) {
    return {
      label: "\u8acb\u5165\u7761",
      range: "03:00 - 06:59",
      className:
        "border-red-300 bg-red-50 text-red-900 shadow-[0_18px_44px_rgba(220,38,38,0.14)]",
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
    <div
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 md:rounded-[24px] ${warning.className}`}
    >
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${warning.iconClassName}`}
      >
        <AlertTriangle size={20} />
      </span>
      <div className="min-w-0">
        <p className="text-base font-semibold leading-6">{warning.label}</p>
        <p className="text-xs leading-5 opacity-80">{warning.range}</p>
      </div>
    </div>
  );
}
