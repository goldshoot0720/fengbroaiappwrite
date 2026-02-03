"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, ChevronDown, ChevronRight } from "lucide-react";
import EnhancedScrollNavigation from "@/components/ui/enhanced-scroll-navigation";
import { ThemeToggleCompact } from "@/components/ui/theme-toggle";
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

  // 檢測螢幕尺寸
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const toggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), []);
  const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);

  const toggleExpanded = useCallback((itemId: string) => {
    setExpandedItems(prev =>
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  }, []);

  const handleMenuClick = useCallback((item: MenuItem) => {
    if (item.children?.length) {
      toggleExpanded(item.id);
    } else {
      onModuleChange(item.id);
      if (isMobile) closeSidebar();
    }
  }, [isMobile, onModuleChange, toggleExpanded, closeSidebar]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-colors duration-300">
      {/* 手機版頂部導航欄 */}
      <MobileHeader isSidebarOpen={isSidebarOpen} onToggle={toggleSidebar} />

      <div className="flex">
        {/* 桌面版側邊欄 */}
        <DesktopSidebar
          menuItems={menuItems}
          currentModule={currentModule}
          expandedItems={expandedItems}
          onMenuClick={handleMenuClick}
        />

        {/* 手機版側邊欄覆蓋層 */}
        {isSidebarOpen && (
          <MobileSidebar
            menuItems={menuItems}
            currentModule={currentModule}
            expandedItems={expandedItems}
            onMenuClick={handleMenuClick}
            onClose={closeSidebar}
            isMobile={isMobile}
          />
        )}

        {/* 主要內容區域 */}
        <main className="flex-1 min-h-screen">
          <div className="h-full p-4 lg:p-8 overflow-auto">
            <div className="max-w-7xl mx-auto">{children}</div>
          </div>
        </main>
      </div>

      <EnhancedScrollNavigation showThreshold={200} showProgress quickNavItems={[]} />
    </div>
  );
}

// 手機版頂部導航
function MobileHeader({ isSidebarOpen, onToggle }: { isSidebarOpen: boolean; onToggle: () => void }) {
  return (
    <div className="md:hidden bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
      <div className="flex items-center justify-between p-4">
        <Logo compact />
        <div className="flex items-center gap-2">
          <ThemeToggleCompact />
          <Button variant="ghost" size="sm" onClick={onToggle} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl">
            {isSidebarOpen ? <X size={22} /> : <Menu size={22} />}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Logo 元件
function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn("bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg sm:rounded-xl flex items-center justify-center", compact ? "w-8 h-8" : "w-10 h-10")}>
        <span className={cn("text-white font-bold", compact ? "text-sm" : "text-base")}>鋒</span>
      </div>
      <div>
        <h1 className={cn("font-bold text-gray-800 dark:text-gray-100 leading-tight", compact ? "text-lg" : "text-xl")}>
          鋒兄資訊<br />管理系統
        </h1>
        {!compact && (
          <div className="flex items-center gap-2">
            <ThemeToggleCompact />
            <p className="text-sm text-gray-500 dark:text-gray-400">鋒兄AI</p>
          </div>
        )}
      </div>
    </div>
  );
}

// 桌面版側邊欄
function DesktopSidebar({ menuItems, currentModule, expandedItems, onMenuClick }: {
  menuItems: MenuItem[];
  currentModule: string;
  expandedItems: string[];
  onMenuClick: (item: MenuItem) => void;
}) {
  return (
    <aside className="hidden md:flex md:flex-col w-52 lg:w-56 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-r border-gray-200 dark:border-gray-700 min-h-screen shadow-sm">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <Logo />
      </div>
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {menuItems.map(item => (
          <MenuItemComponent key={item.id} item={item} currentModule={currentModule} expandedItems={expandedItems} onMenuClick={onMenuClick} />
        ))}
      </nav>
    </aside>
  );
}

// 手機版側邊欄
function MobileSidebar({ menuItems, currentModule, expandedItems, onMenuClick, onClose, isMobile }: {
  menuItems: MenuItem[];
  currentModule: string;
  expandedItems: string[];
  onMenuClick: (item: MenuItem) => void;
  onClose: () => void;
  isMobile: boolean;
}) {
  return (
    <div className="md:hidden fixed inset-0 z-50 flex">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative w-80 max-w-[85vw] bg-white dark:bg-gray-900 shadow-2xl">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <Logo />
            <ThemeToggleCompact />
          </div>
        </div>
        <nav className="p-4 space-y-2 h-full overflow-y-auto pb-20">
          {menuItems.map(item => (
            <MenuItemComponent key={item.id} item={item} currentModule={currentModule} expandedItems={expandedItems} onMenuClick={onMenuClick} isMobile={isMobile} />
          ))}
        </nav>
      </aside>
    </div>
  );
}

// 選單項目元件
function MenuItemComponent({ item, currentModule, expandedItems, onMenuClick, level = 0, isMobile = false }: {
  item: MenuItem;
  currentModule: string;
  expandedItems: string[];
  onMenuClick: (item: MenuItem) => void;
  level?: number;
  isMobile?: boolean;
}) {
  const isExpanded = expandedItems.includes(item.id);
  const hasChildren = item.children && item.children.length > 0;
  const isActive = currentModule === item.id;

  return (
    <div className={cn(level > 0 && "ml-4")}>
      <div
        className={cn(
          "flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-200 touch-manipulation",
          isActive
            ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25"
            : "hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 text-gray-700 dark:text-gray-200",
          isMobile && "min-h-[48px]"
        )}
        onClick={() => onMenuClick(item)}
      >
        <div className="flex items-center gap-3">
          <div className={cn(isActive ? "text-white" : "text-gray-600 dark:text-gray-300")}>{item.icon}</div>
          <span className={cn("font-medium", isMobile ? "text-base" : "text-sm")}>{item.label}</span>
        </div>
        {hasChildren && (
          <div className={cn(isActive ? "text-white" : "text-gray-400 dark:text-gray-500")}>
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </div>
        )}
      </div>
      {hasChildren && isExpanded && (
        <div className="mt-1 space-y-1">
          {item.children!.map(child => (
            <MenuItemComponent key={child.id} item={child} currentModule={currentModule} expandedItems={expandedItems} onMenuClick={onMenuClick} level={level + 1} isMobile={isMobile} />
          ))}
        </div>
      )}
    </div>
  );
}
