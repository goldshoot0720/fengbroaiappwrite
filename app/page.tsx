"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  BadgePercent,
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
  Laptop,
  Clapperboard,
  Film,
  Images,
  Newspaper,
  Settings,
  Smartphone,
  Star,
  Wrench,
  Youtube,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { hasRequiredAppwriteConfig } from "@/lib/utils";
import { fetchApi } from "@/hooks/useApi";
import { API_ENDPOINTS } from "@/lib/constants";
import { MenuItem } from "@/types";

const SITE_VISIT_SESSION_KEY = "fengbro-site-visit-logged";
const LAST_MODULE_STORAGE_KEY = "fengbro:last-module";

/** 合併後「儀表」不再獨立成項，舊紀錄一律落到同頁的鋒兄首頁。 */
function normalizeStoredModule(stored: string): string {
  return stored === "dashboard" ? "home" : stored;
}

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
const BilibiliInfo = dynamic(() => import("@/components/modules/BilibiliInfo"), {
  loading: ModuleFallback,
});
const MindVideoInfo = dynamic(() => import("@/components/modules/MindVideoInfo"), { loading: ModuleFallback });
const LitVideoInfo = dynamic(() => import("@/components/modules/LitVideoInfo"), { loading: ModuleFallback });
const MusicfulInfo = dynamic(() => import("@/components/modules/MusicfulInfo"), { loading: ModuleFallback });
const DigenInfo = dynamic(() => import("@/components/modules/DigenInfo"), { loading: ModuleFallback });
const OiiOiiInfo = dynamic(() => import("@/components/modules/OiiOiiInfo"), { loading: ModuleFallback });
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
const TrialPurchaseManagement = dynamic(
  () => import("@/components/modules/TrialPurchaseManagement"),
  { loading: ModuleFallback }
);
const ReinstallManagement = dynamic(
  () => import("@/components/modules/ReinstallManagement"),
  { loading: ModuleFallback }
);
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
  {
    id: "home-group",
    label: "鋒兄首頁",
    icon: <Home size={18} />,
    children: [
      { id: "home", label: "首頁", icon: <Home size={18} /> },
    ],
  },
  {
    id: "daily-mgmt",
    label: "鋒兄管理",
    icon: <CalendarClock size={18} />,
    children: [
      { id: "subscription", label: "訂閱", icon: <CreditCard size={18} /> },
      { id: "trial-purchase", label: "試用/首購", icon: <BadgePercent size={18} /> },
      { id: "reinstall", label: "重灌", icon: <Laptop size={18} /> },
      { id: "food", label: "食品", icon: <Package size={18} /> },
      { id: "common", label: "常用", icon: <Star size={18} /> },
      { id: "bank-stats", label: "銀行", icon: <Building2 size={18} /> },
      { id: "notes", label: "筆記", icon: <FileText size={18} /> },
      { id: "music", label: "音樂", icon: <Music size={18} /> },
      { id: "images", label: "圖片", icon: <ImageIcon size={18} /> },
      { id: "videos", label: "影片", icon: <Play size={18} /> },
      { id: "documents", label: "文件", icon: <FolderOpen size={18} /> },
      { id: "podcast", label: "播客", icon: <Podcast size={18} /> },
      { id: "routine", label: "例行", icon: <CalendarClock size={18} /> },
    ],
  },
  {
    id: "tools",
    label: "鋒兄工具",
    icon: <Wrench size={18} />,
    children: [
      { id: "fengbro-finance", label: "金融", icon: <Landmark size={18} /> },
      { id: "fengbro-news", label: "新聞", icon: <Newspaper size={18} /> },
      { id: "price-compare", label: "比價", icon: <Wrench size={18} /> },
      { id: "landtop", label: "手機", icon: <Smartphone size={18} /> },
      { id: "fengbro-tube", label: "Tube", icon: <Play size={18} /> },
      { id: "image-voice-video", label: "圖片+語音=影片", icon: <Clapperboard size={18} /> },
      { id: "image-format-convert", label: "PNG/JPEG", icon: <Images size={18} /> },
      { id: "video-merge", label: "影片合併", icon: <Film size={18} /> },
      { id: "youtube-bilibili-convert", label: "YouTube/Bilibili", icon: <Youtube size={18} /> },
    ],
  },
  {
    id: "settings-group",
    label: "設定",
    icon: <Settings size={18} />,
    children: [
      { id: "settings", label: "鋒兄設定", icon: <Settings size={18} /> },
      { id: "about", label: "鋒兄關於", icon: <Info size={18} /> },
    ],
  },
];

const APPWRITE_REQUIRED_MODULES = new Set([
  "home",
  "dashboard",
  "subscription",
  "trial-purchase",
  "reinstall",
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
  // Start with the same shell on server and client, then restore the local choice.
  // Reading localStorage in the initializer caused hydration errors on reload.
  const [currentModule, setCurrentModule] = useState<string>("home");
  const [appwriteSetupMissing, setAppwriteSetupMissing] = useState(true);

  useEffect(() => {
    try {
      setCurrentModule(normalizeStoredModule(
        window.localStorage.getItem(LAST_MODULE_STORAGE_KEY) || "home"
      ));
    } catch {
      // Keep the homepage when localStorage is unavailable.
    }
    setAppwriteSetupMissing(!hasRequiredAppwriteConfig({ requireApiKey: true }));
  }, []);

  const handleModuleChange = useCallback((moduleId: string) => {
    setCurrentModule(moduleId);
    try {
      window.localStorage.setItem(LAST_MODULE_STORAGE_KEY, moduleId);
    } catch {
      // localStorage 不可用時（例如隱私模式），僅本次瀏覽期間有效。
    }
    if (hasRequiredAppwriteConfig({ requireApiKey: true })) {
      void fetchApi(API_ENDPOINTS.MENU_USAGE, {
        method: "POST",
        body: JSON.stringify({ moduleId }),
      }).catch(() => {
        // 選單使用統計只是裝飾性資訊，失敗不影響導覽。
      });
    }
  }, []);

  useEffect(() => {
    setAppwriteSetupMissing(!hasRequiredAppwriteConfig({ requireApiKey: true }));
  }, [currentModule]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasRequiredAppwriteConfig({ requireApiKey: true })) return;
    try {
      if (window.sessionStorage.getItem(SITE_VISIT_SESSION_KEY)) return;
      window.sessionStorage.setItem(SITE_VISIT_SESSION_KEY, "1");
    } catch {
      // sessionStorage 不可用時（例如隱私模式），仍然允許這次計數，不並中斷。
    }
    void fetchApi(API_ENDPOINTS.SITE_VISIT, { method: "POST" }).catch(() => {
      // 到站計數只是裝飾性資訊，失敗不影響使用。
    });
  }, []);

  // 離開網站／切到背景前記住目前選單，下次回來沿用。
  useEffect(() => {
    const rememberModule = () => {
      try {
        window.localStorage.setItem(LAST_MODULE_STORAGE_KEY, currentModule);
      } catch {
        // localStorage 不可用時忽略。
      }
    };
    document.addEventListener("visibilitychange", rememberModule);
    window.addEventListener("pagehide", rememberModule);
    return () => {
      document.removeEventListener("visibilitychange", rememberModule);
      window.removeEventListener("pagehide", rememberModule);
    };
  }, [currentModule]);

  const currentContent = useMemo(() => {
    if (appwriteSetupMissing && APPWRITE_REQUIRED_MODULES.has(currentModule)) {
      return <AppwriteSetupEmptyState onNavigate={() => handleModuleChange("settings")} />;
    }

    switch (currentModule) {
      case "home":
      case "dashboard":
        return (
          <EnhancedDashboard
            onNavigate={handleModuleChange}
            title="鋒兄首頁"
          />
        );
      case "subscription":
        return <SubscriptionManagement />;
      case "trial-purchase":
        return <TrialPurchaseManagement onNavigate={handleModuleChange} />;
      case "reinstall":
        return <ReinstallManagement onNavigate={handleModuleChange} />;
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
        return <ToolsManagement onNavigate={handleModuleChange} />;
      case "price-compare":
        return <ToolsManagement initialTab="price-compare" onNavigate={handleModuleChange} />;
      case "landtop":
        return <ToolsManagement initialTab="landtop" onNavigate={handleModuleChange} />;
      case "fengbro-tube":
        return <ToolsManagement initialTab="fengbro-tube" onNavigate={handleModuleChange} />;
      case "fengbro-finance":
        return <ToolsManagement initialTab="fengbro-finance" onNavigate={handleModuleChange} />;
      case "fengbro-news":
        return <ToolsManagement initialTab="fengbro-news" onNavigate={handleModuleChange} />;
      case "image-voice-video":
        return <ToolsManagement initialTab="image-voice-video" onNavigate={handleModuleChange} />;
      case "image-format-convert":
        return (
          <ToolsManagement initialTab="image-format-convert" onNavigate={handleModuleChange} />
        );
      case "video-merge":
        return <ToolsManagement initialTab="video-merge" onNavigate={handleModuleChange} />;
      case "youtube-bilibili-convert":
        return (
          <ToolsManagement
            initialTab="youtube-bilibili-convert"
            onNavigate={handleModuleChange}
          />
        );
      case "settings":
        return <SettingsManagement />;
      case "about":
        return <AboutUs onNavigate={handleModuleChange} />;
      case "bilibili-info":
        return <BilibiliInfo />;
      case "mindvideo-info":
        return <MindVideoInfo />;
      case "litvideo-info":
        return <LitVideoInfo />;
      case "musicful-info":
        return <MusicfulInfo />;
      case "digen-info":
        return <DigenInfo />;
      case "oiioii-info":
        return <OiiOiiInfo />;
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
