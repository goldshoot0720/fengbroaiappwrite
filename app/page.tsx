"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import FoodManagement from "@/components/modules/FoodManagement";
import SubscriptionManagement from "@/components/modules/SubscriptionManagement";
import EnhancedDashboard from "@/components/modules/EnhancedDashboard";
import VideoIntroduction from "@/components/modules/VideoIntroduction";
import ImageGallery from "@/components/modules/ImageGallery";
import AboutUs from "@/components/modules/AboutUs";
import MusicManagement from "@/components/modules/MusicManagement";
import PodcastManagement from "@/components/modules/PodcastManagement";
import CommonDocumentManagement from "@/components/modules/CommonDocumentManagement";
import NotesManagement from "@/components/modules/NotesManagement";
import CommonAccountManagement from "@/components/modules/CommonAccountManagement";
import SettingsManagement from "@/components/modules/SettingsManagement";
import BankManagement from "@/components/modules/BankManagement";
import RoutineManagement from "@/components/modules/RoutineManagement";
import { Package, CreditCard, Home, BarChart3, Info, Play, Music, FileText, Star, Link as LinkIcon, FileText as NoteIcon, Plus, Settings, Image, Building2, CalendarClock, FolderOpen, Podcast } from "lucide-react";
import { MenuItem, CommonAccount } from "@/types";
import { Input, DataCard, StatCard, Button, Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui";
import { FaviconImage } from "@/components/ui/favicon-image";
import { useCrud } from "@/hooks/useApi";
import { API_ENDPOINTS } from "@/lib/constants";

// 選單項目配置
const MENU_ITEMS: MenuItem[] = [
  { id: "home", label: "鋒兄首頁", icon: <Home size={18} /> },
  { id: "dashboard", label: "鋒兄儀表", icon: <BarChart3 size={18} /> },
  { id: "subscription", label: "鋒兄訂閱", icon: <CreditCard size={18} /> },
  { id: "food", label: "鋒兄食品", icon: <Package size={18} /> },
  { id: "notes", label: "鋒兄筆記", icon: <FileText size={18} /> },
  { id: "common", label: "鋒兄常用", icon: <Star size={18} /> },
  { id: "images", label: "鋒兄圖片", icon: <Image size={18} /> },
  { id: "videos", label: "鋒兄影片", icon: <Play size={18} /> },
  { id: "music", label: "鋒兄音樂", icon: <Music size={18} /> },
  { id: "documents", label: "鋒兄文件", icon: <FolderOpen size={18} /> },
  { id: "podcast", label: "鋒兄播客", icon: <Podcast size={18} /> },
  { id: "bank-stats", label: "鋒兄銀行", icon: <Building2 size={18} /> },
  { id: "routine", label: "鋒兄例行", icon: <CalendarClock size={18} /> },
  { id: "settings", label: "鋒兄設定", icon: <Settings size={18} /> },
  { id: "about", label: "鋒兄關於", icon: <Info size={18} /> },
];

export default function DashboardPage() {
  const [currentModule, setCurrentModule] = useState("home");

  const handleModuleChange = useCallback((moduleId: string) => {
    setCurrentModule(moduleId);
  }, []);

  // 渲染當前模組內容
  const currentContent = useMemo(() => {
    switch (currentModule) {
      case "home":
        return <EnhancedDashboard onNavigate={handleModuleChange} title="鋒兄首頁" onlyTitle={true} />;
      case "images":
        return <ImageGallery />;
      case "dashboard":
        return <EnhancedDashboard onNavigate={handleModuleChange} title="鋒兄儀表" />;
      case "subscription":
        return <SubscriptionManagement />;
      case "food":
        return <FoodManagement />;
      case "videos":
        return <VideoIntroduction />;
      case "notes":
        return <NotesManagement />;
      case "music":
        return <MusicManagement />;
      case "documents":
        return <CommonDocumentManagement />;
      case "podcast":
        return <PodcastManagement />;
      case "common":
        return <CommonAccountManagement />;
      case "bank-stats":
        return <BankManagement />;
      case "routine":
        return <RoutineManagement />;
      case "about":
        return <AboutUs />;
      case "settings":
        return <SettingsManagement />;
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

// 404 模組
function NotFoundModule() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">頁面未找到</h1>
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <p className="text-gray-500 dark:text-gray-400">請選擇有效的功能模組</p>
      </div>
    </div>
  );
}
