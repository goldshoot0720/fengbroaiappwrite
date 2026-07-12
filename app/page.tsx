"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
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
  Landmark,
  Settings,
  Smartphone,
  Star,
  Wrench,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { hasRequiredAppwriteConfig } from "@/lib/utils";
import { MenuItem } from "@/types";

const ModuleFallback = () => (
  <div className="flex min-h-[40vh] items-center justify-center">
    <LoadingSpinner />
  </div>
);

// Lazy-load heavy modules so initial dashboard JS stays small.
const EnhancedDashboard = dynamic(
  () => import("@/components/modules/EnhancedDashboard"),
  { loading: ModuleFallback }
);
const AppwriteSetupEmptyState = dynamic(
  () =>
    import("@/components/modules/EnhancedDashboard").then((m) => m.AppwriteSetupEmptyState),
  { loading: ModuleFallback }
);
const AboutUs = dynamic(() => import("@/components/modules/AboutUs"), {
  loading: ModuleFallback,
});
const BankManagement = dynamic(() => import("@/components/modules/BankManagement"), {
  loading: ModuleFallback,
});
const CommonAccountManagement = dynamic(
  () => import("@/components/modules/CommonAccountManagement"),
  { loading: ModuleFallback }
);
const CommonDocumentManagement = dynamic(
  () => import("@/components/modules/CommonDocumentManagement"),
  { loading: ModuleFallback }
);
const FoodManagement = dynamic(() => import("@/components/modules/FoodManagement"), {
  loading: ModuleFallback,
});
const ImageGallery = dynamic(() => import("@/components/modules/ImageGallery"), {
  loading: ModuleFallback,
});
const MusicManagement = dynamic(() => import("@/components/modules/MusicManagement"), {
  loading: ModuleFallback,
});
const NotesManagement = dynamic(() => import("@/components/modules/NotesManagement"), {
  loading: ModuleFallback,
});
const PodcastManagement = dynamic(() => import("@/components/modules/PodcastManagement"), {
  loading: ModuleFallback,
});
const RoutineManagement = dynamic(() => import("@/components/modules/RoutineManagement"), {
  loading: ModuleFallback,
});
const SettingsManagement = dynamic(() => import("@/components/modules/SettingsManagement"), {
  loading: ModuleFallback,
});
const SubscriptionManagement = dynamic(
  () => import("@/components/modules/SubscriptionManagement"),
  { loading: ModuleFallback }
);
const ToolsManagement = dynamic(() => import("@/components/modules/ToolsManagement"), {
  loading: ModuleFallback,
});
const VideoIntroduction = dynamic(() => import("@/components/modules/VideoIntroduction"), {
  loading: ModuleFallback,
});

const MENU_ITEMS: MenuItem[] = [
  { id: "home", label: "鋒兄首頁", icon: <Home size={18} /> },
  { id: "dashboard", label: "鋒兄儀表", icon: <BarChart3 size={18} /> },
  { id: "subscription", label: "鋒兄訂閱", icon: <CreditCard size={18} /> },
  { id: "food", label: "鋒兄食品", subtitle: "（＋商品庫存）", icon: <Package size={18} /> },
  { id: "notes", label: "鋒兄筆記", icon: <FileText size={18} /> },
  { id: "common", label: "鋒兄常用", icon: <Star size={18} /> },
  { id: "images", label: "鋒兄圖片", icon: <ImageIcon size={18} /> },
  { id: "videos", label: "鋒兄影片", icon: <Play size={18} /> },
  { id: "music", label: "鋒兄音樂", icon: <Music size={18} /> },
  { id: "documents", label: "鋒兄文件", icon: <FolderOpen size={18} /> },
  { id: "podcast", label: "鋒兄播客", icon: <Podcast size={18} /> },
  { id: "bank-stats", label: "鋒兄銀行\n(+電子票證)", icon: <Building2 size={18} /> },
  { id: "routine", label: "鋒兄例行", icon: <CalendarClock size={18} /> },
  {
    id: "tools",
    label: "鋒兄工具",
    subtitle: "（＋比價）",
    icon: <Wrench size={18} />,
    children: [
      { id: "price-compare", label: "鋒兄比價", icon: <Wrench size={18} /> },
      { id: "landtop", label: "手機比價", icon: <Smartphone size={18} /> },
      { id: "fengbro-tube", label: "鋒兄Tube", icon: <Play size={18} /> },
      { id: "fengbro-finance", label: "鋒兄金融", subtitle: "CNBC 報價", icon: <Landmark size={18} /> },
    ],
  },
  { id: "settings", label: "鋒兄設定", icon: <Settings size={18} /> },
  { id: "about", label: "鋒兄關於", icon: <Info size={18} /> },
];

const APPWRITE_REQUIRED_MODULES = new Set([
  "dashboard",
  "subscription",
  "food",
  "notes",
  "common",
  "images",
  "videos",
  "music",
  "documents",
  "podcast",
  "bank-stats",
  "routine",
]);

export default function DashboardPage() {
  const [currentModule, setCurrentModule] = useState("home");
  const [appwriteSetupMissing, setAppwriteSetupMissing] = useState(
    () => !hasRequiredAppwriteConfig({ requireApiKey: true })
  );

  const handleModuleChange = useCallback((moduleId: string) => {
    setCurrentModule(moduleId);
  }, []);

  useEffect(() => {
    setAppwriteSetupMissing(!hasRequiredAppwriteConfig({ requireApiKey: true }));
  }, [currentModule]);

  const currentContent = useMemo(() => {
    if (appwriteSetupMissing && APPWRITE_REQUIRED_MODULES.has(currentModule)) {
      return <AppwriteSetupEmptyState onNavigate={() => handleModuleChange("settings")} />;
    }

    switch (currentModule) {
      case "home":
        return (
          <EnhancedDashboard onNavigate={handleModuleChange} title="鋒兄首頁" onlyTitle />
        );
      case "dashboard":
        return <EnhancedDashboard onNavigate={handleModuleChange} title="鋒兄儀表" />;
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
      case "price-compare":
        return <ToolsManagement initialTab="price-compare" />;
      case "landtop":
        return <ToolsManagement initialTab="landtop" />;
      case "fengbro-tube":
        return <ToolsManagement initialTab="fengbro-tube" />;
      case "fengbro-finance":
        return <ToolsManagement initialTab="fengbro-finance" />;
      case "settings":
        return <SettingsManagement />;
      case "about":
        return <AboutUs />;
      default:
        return <NotFoundModule />;
    }
  }, [appwriteSetupMissing, currentModule, handleModuleChange]);

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
          找不到對應模組
        </h1>
      </div>
      <div className="surface-panel rounded-[28px] p-8">
        <p className="max-w-2xl text-sm leading-7 text-[var(--muted-foreground)] sm:text-base">
          這個模組尚未建立，或是目前的選單設定沒有對應到正確內容。你可以回到其他模組，或稍後再檢查這個入口。
        </p>
      </div>
    </section>
  );
}
