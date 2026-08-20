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

export default function DashboardLayout({
  children,
  currentModule,
  onModuleChange,
  menuItems,
}: DashboardLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);
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

  // All modules: browser tab title follows the active menu (not static AI Appwrite Console).
  useEffect(() => {
    document.title = `${activeLabel} · FengBro`;
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
        <DesktopSidebar
          collapsed={isDesktopSidebarCollapsed}
          currentModule={currentModule}
          menuItems={menuItems}
          onMenuClick={handleMenuClick}
          onToggle={() => setIsDesktopSidebarCollapsed((value) => !value)}
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
            activeLabel={activeLabel}
            isSidebarOpen={isSidebarOpen}
            onToggle={toggleSidebar}
          />

          <main className="min-w-0 flex-1 px-3 pb-[calc(7.25rem+env(safe-area-inset-bottom))] pt-3 sm:px-3 md:px-5 md:pb-8 md:pt-5 xl:px-7 xl:pb-10 xl:pt-7">
            <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-3 md:gap-5 xl:gap-6">
              {currentModule === "home" ? <SleepWarningBanner /> : null}
              <TopBar
                activeLabel={activeLabel}
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

      {/*
        Voice FAB stacks above the open mobile drawer (z-voice > z-drawer-open).
        While the drawer is open: hide + inert so labels like「鋒兄金融」are not covered
        and docks cannot steal taps (KD-16).
      */}
      <div
        className={cn(isSidebarOpen && isMobile && "pointer-events-none hidden")}
        {...(isSidebarOpen && isMobile ? { inert: true as unknown as boolean } : {})}
        aria-hidden={isSidebarOpen && isMobile ? true : undefined}
      >
        <MusicQueuePanel />
        <PodcastQueuePanel />
        <VideoQueuePanel />
        {/* 右側浮動列：語音在底欄上方一點 */}
        {/* pointer-events-none：避免整塊右下角遮住頁面「編輯」等按鈕；子元件自行開啟可點區域 */}
        <div className="pointer-events-none fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-2 z-[var(--z-voice)] flex max-w-[min(560px,calc(100vw-1rem))] flex-col items-end gap-2 sm:bottom-6 sm:right-4 md:bottom-6">
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
            <p className="truncate text-xs font-medium tracking-[0.16em] text-[var(--muted-foreground)] uppercase">
              FengBro
            </p>
            <h1 className="truncate text-lg font-semibold leading-6 tracking-tight text-[var(--foreground)]">
              {activeLabel}
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

/** Desktop / tablet: task-first navigation that keeps the workspace in view. */
function DesktopSidebar({
  collapsed,
  currentModule,
  menuItems,
  onMenuClick,
  onToggle,
}: {
  collapsed: boolean;
  currentModule: string;
  menuItems: MenuItem[];
  onMenuClick: (item: MenuItem) => void;
  onToggle: () => void;
}) {
  const groups = useMemo(() => buildTopNavGroups(menuItems), [menuItems]);

  return (
    <aside
      aria-label="主要選單"
      className={cn(
        "sticky top-0 z-[var(--z-sidebar)] hidden h-dvh shrink-0 flex-col border-r border-[var(--line-soft)] bg-[color:var(--panel-veil)]/94 px-3 py-4 backdrop-blur-xl transition-[width] duration-200 md:flex",
        collapsed ? "w-[76px]" : "w-[264px]"
      )}
    >
      <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between gap-2")}>
        <BrandBlock compact={collapsed} title={collapsed ? "" : "鋒兄控制台"} />
        {!collapsed ? <ThemeToggleCompact /> : null}
      </div>

      <nav className="mt-6 min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain pr-1" aria-label="模組導覽">
        {groups.map((group) => (
          <section key={group.id} aria-label={group.label}>
            {!collapsed ? (
              <p className="mb-1.5 px-2 text-[11px] font-medium tracking-[0.08em] text-[var(--muted-foreground)]">
                {group.id === "main" ? "總覽與管理" : group.label}
              </p>
            ) : null}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = currentModule === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={formatActiveModuleLabel(item, item.label)}
                    onClick={() => onMenuClick(item)}
                    aria-current={isActive ? "page" : undefined}
                    aria-label={formatActiveModuleLabel(item, item.label)}
                    className={cn(
                      "flex w-full min-h-11 items-center rounded-xl px-2.5 text-left transition-impeccable focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]",
                      collapsed ? "justify-center" : "gap-2.5",
                      isActive
                        ? "bg-[linear-gradient(135deg,var(--accent-strong),var(--accent))] text-[var(--accent-foreground)] shadow-[0_8px_20px_rgba(199,149,65,0.18)]"
                        : "text-[var(--muted-foreground)] hover:bg-[color:var(--panel-soft)] hover:text-[var(--foreground)]"
                    )}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center">{item.icon}</span>
                    {!collapsed ? <span className="truncate text-sm font-medium">{shortModuleLabel(item.label)}</span> : null}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </nav>

      <div className={cn("mt-3 flex items-center gap-1", collapsed ? "flex-col" : "justify-between")}>
        {!collapsed ? <DensityToggleCompact /> : <ThemeToggleCompact />}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          aria-label={collapsed ? "展開側邊欄" : "收合側邊欄"}
          className="size-11 rounded-xl border border-[var(--line-soft)] bg-[color:var(--panel-soft)] hover:bg-[color:var(--panel-strong)]"
        >
          <Menu size={18} />
        </Button>
      </div>
    </aside>
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

function BrandBlock({
  compact = false,
  title = "控制台",
}: {
  compact?: boolean;
  /** Current module title (e.g. 鋒兄訂閱) — not the product codename. */
  title?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <div
        className={cn(
          "flex shrink-0 items-center justify-center bg-[linear-gradient(145deg,var(--accent-strong),var(--accent))] text-[var(--accent-foreground)]",
          compact
            ? "size-7 rounded-md shadow-[0_2px_8px_rgba(199,149,65,0.18)]"
            : "size-12 rounded-[18px] shadow-[0_18px_40px_rgba(199,149,65,0.22)]"
        )}
      >
        <Command size={compact ? 14 : 20} />
      </div>
      <div className="min-w-0">
        <p
          className={cn(
            "uppercase text-[var(--muted-foreground)]",
            compact
              ? "text-[10px] tracking-[0.16em] leading-none"
              : "text-[11px] tracking-[0.34em]"
          )}
        >
          FengBro
        </p>
        <h1
          className={cn(
            "truncate font-semibold tracking-tight text-[var(--foreground)]",
            compact
              ? "text-sm font-medium leading-5"
              : "font-display text-xl"
          )}
        >
          {title}
        </h1>
      </div>
    </div>
  );
}

/** Primary title + optional second line (subtitle or `\n` in label). */
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

/** Single-line module title for shell chrome (top brand, mobile header, document title). */
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

/** Preferred second-row tool groups (desktop top nav order after main). */
const TOP_NAV_SECOND_ROW_GROUP_IDS = ["tools", "sub-tools"] as const;

/** Same-row combo groups: notes/docs · music/podcast · settings/about. */
const TOP_NAV_COMBO_ROW_GROUP_IDS = [
  "notes-docs",
  "music-podcast",
  "settings-about",
] as const;

/** Build top-nav groups: main → tools row → combo row → remaining nested groups. */
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

  const secondRowIds = new Set<string>(TOP_NAV_SECOND_ROW_GROUP_IDS);
  const comboRowIds = new Set<string>(TOP_NAV_COMBO_ROW_GROUP_IDS);
  const secondRowGroups = TOP_NAV_SECOND_ROW_GROUP_IDS.map((id) =>
    childGroups.find((group) => group.id === id)
  ).filter(Boolean) as TopNavGroup[];
  const comboRowGroups = TOP_NAV_COMBO_ROW_GROUP_IDS.map((id) =>
    childGroups.find((group) => group.id === id)
  ).filter(Boolean) as TopNavGroup[];
  const otherChildGroups = childGroups.filter(
    (group) => !secondRowIds.has(group.id) && !comboRowIds.has(group.id)
  );

  const groups: TopNavGroup[] = [];
  if (rootLeaves.length) {
    groups.push({
      id: "main",
      label: "主要模組",
      showLabel: false,
      items: rootLeaves,
    });
  }
  // Second row: 鋒兄工具 + 鋒兄子工具
  groups.push(...secondRowGroups);
  // Combo row: 筆記/文件 · 音樂/播客 · 設定/關於
  groups.push(...comboRowGroups);
  groups.push(...otherChildGroups);
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
        <p className="text-[11px] font-medium tracking-[0.12em] text-[var(--muted-foreground)]">
          目前模組
        </p>
        <h2 className="truncate font-display text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          {activeLabel}
        </h2>
      </div>

      <div className="flex flex-wrap items-center gap-2 xl:gap-3">
        <StatusPill label={today} value="今日" />
        <StatusPill label={`${moduleCount} 個模組`} value="已啟用模組" />
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
