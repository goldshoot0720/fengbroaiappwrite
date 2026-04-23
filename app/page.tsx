"use client";

import { useCallback, useMemo, useState } from "react";
import {
  BarChart3,
  Building2,
  CalendarClock,
  CreditCard,
  FileText,
  FolderOpen,
  Home,
  Image as ImageIcon,
  Info,
  Music,
  Package,
  Play,
  Podcast,
  Wrench,
  Settings,
  Star,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AboutUs from "@/components/modules/AboutUs";
import BankManagement from "@/components/modules/BankManagement";
import CommonAccountManagement from "@/components/modules/CommonAccountManagement";
import CommonDocumentManagement from "@/components/modules/CommonDocumentManagement";
import EnhancedDashboard from "@/components/modules/EnhancedDashboard";
import FoodManagement from "@/components/modules/FoodManagement";
import ImageGallery from "@/components/modules/ImageGallery";
import MusicManagement from "@/components/modules/MusicManagement";
import NotesManagement from "@/components/modules/NotesManagement";
import PodcastManagement from "@/components/modules/PodcastManagement";
import RoutineManagement from "@/components/modules/RoutineManagement";
import SettingsManagement from "@/components/modules/SettingsManagement";
import SubscriptionManagement from "@/components/modules/SubscriptionManagement";
import ToolsManagement from "@/components/modules/ToolsManagement";
import VideoIntroduction from "@/components/modules/VideoIntroduction";
import { MenuItem } from "@/types";

const MENU_ITEMS: MenuItem[] = [
  { id: "home", label: "首頁", icon: <Home size={18} /> },
  { id: "dashboard", label: "總覽儀表板", icon: <BarChart3 size={18} /> },
  { id: "subscription", label: "訂閱管理", icon: <CreditCard size={18} /> },
  { id: "food", label: "鋒兄食品", subLabel: "（＋商品庫存）", icon: <Package size={18} /> },
  { id: "notes", label: "筆記資料", icon: <FileText size={18} /> },
  { id: "common", label: "常用帳號", icon: <Star size={18} /> },
  { id: "images", label: "圖片庫", icon: <ImageIcon size={18} /> },
  { id: "videos", label: "影片庫", icon: <Play size={18} /> },
  { id: "music", label: "音樂庫", icon: <Music size={18} /> },
  { id: "documents", label: "文件中心", icon: <FolderOpen size={18} /> },
  { id: "podcast", label: "Podcast", icon: <Podcast size={18} /> },
  { id: "bank-stats", label: "銀行與資產", icon: <Building2 size={18} /> },
  { id: "routine", label: "例行追蹤", icon: <CalendarClock size={18} /> },
  { id: "tools", label: "鋒兄工具", icon: <Wrench size={18} /> },
  { id: "settings", label: "設定", icon: <Settings size={18} /> },
  { id: "about", label: "關於系統", icon: <Info size={18} /> },
];

export default function DashboardPage() {
  const [currentModule, setCurrentModule] = useState("home");

  const handleModuleChange = useCallback((moduleId: string) => {
    setCurrentModule(moduleId);
  }, []);

  const currentContent = useMemo(() => {
    switch (currentModule) {
      case "home":
        return (
          <EnhancedDashboard
            onNavigate={handleModuleChange}
            title="首頁"
            onlyTitle
          />
        );
      case "dashboard":
        return (
          <EnhancedDashboard
            onNavigate={handleModuleChange}
            title="總覽儀表板"
          />
        );
      case "subscription":
        return <SubscriptionManagement />;
      case "food":
        return <FoodManagement />;
      case "notes":
        return <NotesManagement />;
      case "common":
        return <CommonAccountManagement />;
      case "images":
        return <ImageGallery />;
      case "videos":
        return <VideoIntroduction />;
      case "music":
        return <MusicManagement />;
      case "documents":
        return <CommonDocumentManagement />;
      case "podcast":
        return <PodcastManagement />;
      case "bank-stats":
        return <BankManagement />;
      case "routine":
        return <RoutineManagement />;
      case "tools":
        return <ToolsManagement />;
      case "settings":
        return <SettingsManagement />;
      case "about":
        return <AboutUs />;
      default:
        return <NotFoundModule />;
    }
  }, [currentModule, handleModuleChange]);

  return (
    <DashboardLayout
      currentModule={currentModule}
      onModuleChange={handleModuleChange}
      menuItems={MENU_ITEMS}
    >
      {currentContent}
    </DashboardLayout>
  );
}

function NotFoundModule() {
  return (
    <section className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.28em] text-[var(--muted-foreground)]">
          Module Missing
        </p>
        <h1 className="font-display text-3xl font-semibold text-[var(--foreground)]">
          找不到這個模組
        </h1>
      </div>
      <div className="surface-panel rounded-[28px] p-8">
        <p className="max-w-2xl text-sm leading-7 text-[var(--muted-foreground)] sm:text-base">
          目前選取的頁面尚未連接到主內容區。你可以從左側重新選擇功能，或稍後再補上這個模組的內容。
        </p>
      </div>
    </section>
  );
}
