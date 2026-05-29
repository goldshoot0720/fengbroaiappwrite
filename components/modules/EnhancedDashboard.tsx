"use client";

import NextImage from "next/image";
import { useEffect, useState, useRef } from "react";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useMediaStats } from "@/hooks/useMediaStats";
import { Package, CreditCard, AlertTriangle, TrendingUp, DollarSign, Cloud, Layout, Server, FileVideo, Shield, Zap, Image, Music, HardDrive, FileText, Star, Building2, ChevronDown, ChevronUp, CalendarClock, Mic, Bell, BellRing, BellOff, X, Download } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { DataCard } from "@/components/ui/data-card";
import { FullPageLoading } from "@/components/ui/loading-spinner";
import { StatusDot } from "@/components/ui/status-badge";
import { PageTitle } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import { FaviconImage } from "@/components/ui/favicon-image";
import { formatCurrency, formatDaysRemaining } from "@/lib/formatters";
import { FoodDetail, SubscriptionDetail } from "@/types";

type FengbroTubeRecentVideo = {
  videoId: string;
  title: string;
  url: string;
  publishedAt: string;
  channelTitle: string;
};

type ShillerPeNotice = {
  current: number | null;
  recordHigh: number;
  recordHighDate: string;
  sourceUrl: string;
  updatedAt?: string;
  isRecordHigh: boolean;
};

interface EnhancedDashboardProps {
  onNavigate: (moduleId: string) => void;
  title?: string;
  onlyTitle?: boolean;
}

const FENG_BRO_ASCII = String.raw`
 _______  _______  __    _  _______    _______  ______    _______
|       ||       ||  |  | ||       |  |  _    ||    _ |  |       |
|    ___||    ___||   |_| ||    ___|  | |_|   ||   | ||  |   _   |
|   |___ |   |___ |       ||   | __   |       ||   |_||_ |  | |  |
|    ___||    ___||  _    ||   ||  |  |  _   | |    __  ||  |_|  |
|   |    |   |___ | | |   ||   |_| |  | |_|   ||   |  | ||       |
|___|    |_______||_|  |__||_______|  |_______||___|  |_||_______|
`;

const FENG_BRO_ASCII_MOBILE = String.raw`
 ______  ______  _   _   _____
|  ____||  ____|| \ | | / ____|
| |__   | |__   |  \| || |  __
|  __|  |  __|  | .^| || | |_ |
| |     | |____ | |\  || |__| |
|_|     |______||_| \_| \_____|

 ____   _____   ____
|  _ \ |  __ \ / __ \
| |_) || |__) | |  | |
|  _ < |  _  /| |  | |
| |_) || | \ \| |__| |
|____/ |_|  \_\\____/
`;

export default function EnhancedDashboard({ onNavigate, title = "鋒兄儀表", onlyTitle = false }: EnhancedDashboardProps) {
  const { stats, loading, error: dashboardError } = useDashboardStats();
  const { stats: mediaStats, loading: mediaLoading, error: mediaError } = useMediaStats();
  const notificationSentRef = useRef(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [permissionDismissed, setPermissionDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [tubeRecentVideos, setTubeRecentVideos] = useState<FengbroTubeRecentVideo[]>([]);
  const [tubeNoticeDismissed, setTubeNoticeDismissed] = useState(false);
  const [shillerPeNotice, setShillerPeNotice] = useState<ShillerPeNotice | null>(null);
  const [shillerPeDismissed, setShillerPeDismissed] = useState(false);

  // 偵測環境：iOS、standalone（已安裝 PWA）
  useEffect(() => {
    if (typeof window === "undefined") return;

    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIOS(ios);

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);
  }, []);

  useEffect(() => {
    if (onlyTitle) return;
    let active = true;
    const loadTubeNotice = async () => {
      try {
        const dismissedKey = window.localStorage.getItem("fengbroTubeNoticeDismissed");
        const today = new Date().toISOString().slice(0, 10);
        if (dismissedKey === today) {
          setTubeNoticeDismissed(true);
          return;
        }

        const response = await fetch("/api/fengbro-tube");
        const data = (await response.json()) as { recentVideos?: FengbroTubeRecentVideo[] };
        if (active) setTubeRecentVideos((data.recentVideos || []).slice(0, 8));
      } catch {
        if (active) setTubeRecentVideos([]);
      }
    };
    void loadTubeNotice();
    return () => {
      active = false;
    };
  }, [onlyTitle]);

  useEffect(() => {
    let active = true;
    const loadShillerPeNotice = async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        if (window.localStorage.getItem("fengbroShillerPeNoticeDismissed") === today) {
          setShillerPeDismissed(true);
          return;
        }

        const response = await fetch("/api/fengbro-finance");
        const data = (await response.json()) as { shillerPe?: ShillerPeNotice };
        if (!active) return;
        setShillerPeNotice(data.shillerPe?.isRecordHigh ? data.shillerPe : null);
      } catch {
        if (active) setShillerPeNotice(null);
      }
    };

    void loadShillerPeNotice();
    return () => {
      active = false;
    };
  }, []);

  const handleDismissTubeNotice = () => {
    setTubeNoticeDismissed(true);
    try {
      window.localStorage.setItem("fengbroTubeNoticeDismissed", new Date().toISOString().slice(0, 10));
    } catch {}
  };

  const handleDismissShillerPeNotice = () => {
    setShillerPeDismissed(true);
    try {
      window.localStorage.setItem("fengbroShillerPeNoticeDismissed", new Date().toISOString().slice(0, 10));
    } catch {}
  };

  // 檢查通知權限狀態
  useEffect(() => {
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      setNotificationPermission("unsupported");
      return;
    }
    setNotificationPermission(Notification.permission);

    // 檢查是否已經關閉過提示
    try {
      const dismissed = window.localStorage.getItem("notificationBannerDismissed");
      if (dismissed === "true") setPermissionDismissed(true);
    } catch {}
  }, []);

  // 透過 Service Worker 發送通知（手機和桌面皆可）
  const showSwNotification = async (ntTitle: string, options?: NotificationOptions) => {
    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(ntTitle, options);
        return;
      }
    } catch {}
    // fallback: 桌面直接用 Notification API
    try { new Notification(ntTitle, options); } catch {}
  };

  // 請求通知權限，授權後立刻發送實際到期項目通知
  const handleRequestPermission = async () => {
    if (typeof Notification === "undefined") return;
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === "granted") {
        // 授權後立刻發送實際通知，而非僅顯示確認訊息
        await sendNotifications();
      }
    } catch {}
  };

  const handleDismissBanner = () => {
    setPermissionDismissed(true);
    try {
      window.localStorage.setItem("notificationBannerDismissed", "true");
    } catch {}
  };

  // 發送到期/過期通知的核心函數
  const sendNotifications = async () => {
    if (typeof window === "undefined") return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;

    const now = new Date();
    if (now.getHours() < 5) return;

    const today = now.toISOString().slice(0, 10);
    const storageKey = "dashboardNotificationSession";
    let notified: Record<string, string> = {};

    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (raw) notified = JSON.parse(raw) as Record<string, string>;
    } catch {}

    const updated = { ...notified };
    let hasNew = false;

    // 訂閱到期通知
    const subItems = stats.subscriptionsExpiring3DaysList.filter(
      (item) => item.daysRemaining >= 0 && item.daysRemaining <= 3
    );
    for (const item of subItems) {
      const key = `sub-${item.id}-${item.nextDate}-${today}`;
      if (notified[key] !== "shown") {
        await showSwNotification("訂閱即將到期提醒", {
          body: `${item.name} 將在 ${item.daysRemaining} 天內到期`,
          icon: "/favicon.ico",
          tag: `sub-${item.id}`,
        });
        updated[key] = "shown";
        hasNew = true;
      }
    }

    // 食品過期通知
    const foodItems = stats.foodsExpiring7DaysList.filter(
      (item) => item.daysRemaining >= 0 && item.daysRemaining <= 3
    );
    for (const item of foodItems) {
      const key = `food-${item.id}-${today}`;
      if (notified[key] !== "shown") {
        await showSwNotification("食品即將過期提醒", {
          body: `${item.name} 將在 ${item.daysRemaining} 天內過期`,
          icon: "/favicon.ico",
          tag: `food-${item.id}`,
        });
        updated[key] = "shown";
        hasNew = true;
      }
    }

    // 已過期食品通知
    const expiredFoods = stats.expiredFoodsList.slice(0, 3);
    for (const item of expiredFoods) {
      const key = `expired-${item.id}-${today}`;
      if (notified[key] !== "shown") {
        await showSwNotification("食品已過期", {
          body: `${item.name} 已過期 ${Math.abs(item.daysRemaining)} 天`,
          icon: "/favicon.ico",
          tag: `expired-${item.id}`,
        });
        updated[key] = "shown";
        hasNew = true;
      }
    }

    if (shillerPeNotice?.isRecordHigh) {
      const key = `shiller-pe-${shillerPeNotice.current ?? "na"}-${today}`;
      if (notified[key] !== "shown") {
        await showSwNotification("Shiller PE Ratio 創新高", {
          body: `目前 ${shillerPeNotice.current ?? "--"}，歷史 Max ${shillerPeNotice.recordHigh} (${shillerPeNotice.recordHighDate})`,
          icon: "/favicon.ico",
          tag: "shiller-pe-record-high",
        });
        updated[key] = "shown";
        hasNew = true;
      }
    }

    if (hasNew) {
      try {
        window.sessionStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {}
    }
  };

  // 頁面載入時發送通知
  useEffect(() => {
    if (onlyTitle || loading || dashboardError || notificationSentRef.current) return;
    sendNotifications();
    notificationSentRef.current = true;
  }, [loading, dashboardError, onlyTitle, stats.subscriptionsExpiring3DaysList.length, stats.foodsExpiring7DaysList.length, stats.expiredFoodsList.length, shillerPeNotice?.isRecordHigh, shillerPeNotice?.current]);

  // PWA 從背景回到前景時重新檢查通知
  useEffect(() => {
    if (onlyTitle) return;
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        notificationSentRef.current = false;
        if (!loading && !dashboardError) {
          sendNotifications();
          notificationSentRef.current = true;
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [onlyTitle, loading, dashboardError, stats]);

  useEffect(() => {
    if (onlyTitle || loading || dashboardError) return;

    const scheduleNextDailyCheck = () => {
      const now = new Date();
      const next = new Date(now);
      next.setHours(5, 21, 0, 0);
      if (next.getTime() <= now.getTime()) {
        next.setDate(next.getDate() + 1);
      }

      const timeout = window.setTimeout(() => {
        notificationSentRef.current = false;
        void sendNotifications();
        scheduleNextDailyCheck();
      }, next.getTime() - now.getTime());

      return timeout;
    };

    const timeout = scheduleNextDailyCheck();
    return () => window.clearTimeout(timeout);
  }, [onlyTitle, loading, dashboardError, stats, shillerPeNotice?.isRecordHigh, shillerPeNotice?.current]);

  if (onlyTitle) {
    return (
      <div className="space-y-6 lg:space-y-8">
        <PageTitle title={title} />

        <ShillerPeNoticeCard
          notice={shillerPeNotice}
          dismissed={shillerPeDismissed}
          onDismiss={handleDismissShillerPeNotice}
          onNavigate={() => onNavigate("fengbro-finance")}
        />

        <DataCard className="overflow-hidden border-[var(--line-strong)] bg-[linear-gradient(135deg,rgba(18,25,22,0.96),rgba(42,56,49,0.92))] p-0 text-emerald-50 shadow-[0_24px_50px_rgba(15,23,20,0.28)]">
          <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(110,231,183,0.2),transparent_38%),linear-gradient(90deg,rgba(255,255,255,0.04),transparent)] px-3 py-2.5 sm:px-5 sm:py-3">
            <p className="text-[10px] uppercase tracking-[0.28em] text-emerald-200/80 sm:text-[11px] sm:tracking-[0.38em]">ASCII Welcome</p>
          </div>
          <div className="grid gap-4 px-3 py-3 lg:grid-cols-[minmax(0,1.8fr)_minmax(260px,0.7fr)] sm:px-5 sm:py-5">
            <div className="overflow-hidden rounded-[28px] border border-slate-300/80 bg-[linear-gradient(180deg,rgba(241,244,248,0.98),rgba(223,229,236,0.96))] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
              <div className="flex items-center gap-2 border-b border-slate-300/80 px-3 py-3 sm:px-4">
                <span className="h-3 w-3 rounded-full bg-[#e9c86b]" />
                <span className="h-3 w-3 rounded-full bg-[#e2a56f]" />
                <span className="h-3 w-3 rounded-full bg-[#7fc88e]" />
                <p className="ml-1 text-[10px] uppercase tracking-[0.14em] text-slate-500 sm:ml-2 sm:text-[11px] sm:tracking-[0.18em]">Feng Bro / Home Signal</p>
              </div>
              <div className="px-3 py-5 sm:px-6 sm:py-7">
                <div className="sm:hidden overflow-hidden">
                  <pre className="mx-auto inline-block whitespace-pre font-mono text-[8px] font-bold leading-[1.12] tracking-[-0.02em] text-[#25456f]">
                    {FENG_BRO_ASCII_MOBILE}
                  </pre>
                </div>
                <pre className="hidden sm:inline-block min-w-max whitespace-pre font-mono text-[11px] font-bold leading-[1.08] text-[#183b63] [text-shadow:3px_3px_0_rgba(255,255,255,0.95),6px_6px_0_rgba(24,59,99,0.38)]">
                  {FENG_BRO_ASCII}
                </pre>
              </div>
            </div>
            <figure className="relative m-0 min-h-[280px] overflow-hidden rounded-[28px] border border-white/15 bg-white/10 shadow-[0_18px_36px_rgba(0,0,0,0.24)] sm:min-h-[360px] lg:min-h-0">
              <NextImage
                src="/fengbro-profile.png"
                alt="鋒兄人物圖"
                width={1086}
                height={1448}
                priority
                className="h-full w-full object-cover"
                sizes="(max-width: 1024px) 100vw, 340px"
              />
            </figure>
          </div>
        </DataCard>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <DataCard className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border-blue-100 dark:border-blue-800">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                <Zap size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">精美介紹</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">鋒兄管理資訊系統核心架構</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <IntroItem icon={Cloud} label="網頁部署" value="Vercel 雲端空間" color="text-blue-600" />
              <IntroItem icon={Layout} label="前端框架" value="Next.js (基於 React)" color="text-indigo-600" />
              <IntroItem icon={Server} label="後端服務" value="Appwrite (BaaS 解決方案)" color="text-pink-600" />
              <IntroItem icon={FileVideo} label="多媒體儲存" value="Appwrite Storage (圖片/音樂/影片/文件)" color="text-orange-600" />
            </div>
          </DataCard>

          <DataCard className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/10 dark:to-pink-900/10 border-purple-100 dark:border-purple-800 flex flex-col justify-center">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl rotate-3 hover:rotate-0 transition-transform duration-300">
                <span className="text-white font-bold text-3xl">鋒</span>
              </div>
              <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">本網站建置</h3>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed max-w-sm mx-auto">
                透過現代化的技術棧，為您提供極致流暢且安全的資訊管理體驗。
              </p>
            </div>
          </DataCard>
        </div>
      </div>
    );
  }

  const error = dashboardError || mediaError;

  if (loading || mediaLoading) return <FullPageLoading text="載入統計數據中..." />;

  const needsAttention = stats.foodsExpiring7Days > 0 || stats.subscriptionsExpiring3Days > 0 || stats.expiredFoods > 0 || stats.overdueSubscriptions > 0;

  return (
    <div className="space-y-4 lg:space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-600 dark:text-red-400 whitespace-pre-line">
          {error}
        </div>
      )}

      <ShillerPeNoticeCard
        notice={shillerPeNotice}
        dismissed={shillerPeDismissed}
        onDismiss={handleDismissShillerPeNotice}
        onNavigate={() => onNavigate("fengbro-finance")}
      />

      {tubeRecentVideos.length > 0 && !tubeNoticeDismissed && (
        <DataCard className="p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
              <Bell className="text-red-600 dark:text-red-400" size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-red-900 dark:text-red-100">
                鋒兄Tube 有 {tubeRecentVideos.length} 部 3 天內新影片
              </p>
              <div className="mt-2 grid gap-1 text-xs text-red-800 dark:text-red-200 sm:grid-cols-2">
                {tubeRecentVideos.slice(0, 4).map((video) => (
                  <a key={video.videoId} href={video.url} target="_blank" rel="noreferrer" className="line-clamp-1 hover:underline">
                    {video.channelTitle}：{video.title}
                  </a>
                ))}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => onNavigate("tools")}
                className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                查看
              </button>
              <button onClick={handleDismissTubeNotice} className="p-2 text-red-400 hover:text-red-600 transition-colors" title="今天不再提醒">
                <X size={16} />
              </button>
            </div>
          </div>
        </DataCard>
      )}

      {/* iOS 未安裝 PWA 提示 */}
      {isIOS && !isStandalone && notificationPermission === "unsupported" && !permissionDismissed && (
        <DataCard className="p-4 bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
              <Download className="text-amber-600 dark:text-amber-400" size={20} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                要接收通知，請先安裝至主畫面
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                點 Safari 下方「分享」按鈕 → 「加入主畫面」→ 從主畫面開啟後即可啟用通知
              </p>
            </div>
            <button onClick={handleDismissBanner} className="p-2 text-amber-400 hover:text-amber-600 transition-colors" title="關閉提示">
              <X size={16} />
            </button>
          </div>
        </DataCard>
      )}

      {/* 通知權限提示（桌面或已安裝 PWA） */}
      {notificationPermission === "default" && !permissionDismissed && (
        <DataCard className="p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <BellRing className="text-blue-600 dark:text-blue-400" size={20} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                啟用通知，訂閱到期、食品過期時即時提醒
              </p>
              {isIOS && (
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  點下方按鈕後，請在彈出視窗中選擇「允許」
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRequestPermission}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                啟用通知
              </button>
              <button onClick={handleDismissBanner} className="p-2 text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors" title="關閉提示">
                <X size={16} />
              </button>
            </div>
          </div>
        </DataCard>
      )}

      {/* 通知被拒絕提示 */}
      {notificationPermission === "denied" && !permissionDismissed && (
        <DataCard className="p-4 bg-gray-50 dark:bg-gray-800/50 border-l-4 border-gray-400">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center">
              <BellOff className="text-gray-500 dark:text-gray-400" size={20} />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {isIOS
                  ? "通知已被拒絕，請至 iOS「設定」→ 找到本 App →「通知」→ 開啟允許通知"
                  : "通知已被封鎖，請至瀏覽器設定 > 網站權限 > 通知，允許此網站發送通知"}
              </p>
            </div>
            <button onClick={handleDismissBanner} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" title="關閉提示">
              <X size={16} />
            </button>
          </div>
        </DataCard>
      )}

      <PageTitle title={title} description="鋒兄管理資訊系統 - 數據匯總與分析" />

      {/* 詳細統計區域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <FoodStatsCard stats={stats} onNavigate={onNavigate} />
        <SubscriptionStatsCard stats={stats} onNavigate={onNavigate} />
      </div>

      {/* 多媒體儲存統計 */}
      <MediaStorageStats stats={mediaStats} onNavigate={onNavigate} />
      
      {/* 訂閱到期提醒 */}
      {stats.subscriptionsExpiring3Days > 0 && (
        <DataCard className="p-4 bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
              <Bell className="text-orange-600 dark:text-orange-400" size={20} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
                🔔 有 {stats.subscriptionsExpiring3Days} 項訂閱將在3天內到期
              </p>
              <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                請至「鋒兄訂閱」查看詳情
              </p>
            </div>
            <button
              onClick={() => onNavigate('subscription')}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              查看
            </button>
          </div>
        </DataCard>
      )}
      
      {/* 主要統計卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard title="訂閱服務" value={stats.totalSubscriptions} icon={CreditCard} gradient="from-green-500 to-green-600" />
        <StatCard title="年費總計" value={formatCurrency(stats.totalAnnualFee)} icon={DollarSign} gradient="from-purple-500 to-purple-600" />
        <StatCard title="食品項目" value={stats.totalFoods} icon={Package} gradient="from-blue-500 to-blue-600" />
        <StatCard title="需要關注" value={stats.foodsExpiring7Days + stats.subscriptionsExpiring3Days} icon={AlertTriangle} gradient="from-yellow-500 to-orange-500" />
      </div>

      {/* 其他統計 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <StatCard title="筆記總數" value={stats.totalArticles} icon={FileText} gradient="from-indigo-500 to-indigo-600" />
        <StatCard title="常用帳號總數" value={stats.totalCommonAccounts} icon={Star} gradient="from-pink-500 to-pink-600" />
      </div>

      {/* 多媒體統計 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard title="音樂總數" value={mediaStats.totalMusic} icon={Music} gradient="from-violet-500 to-violet-600" />
        <StatCard title="文件總數" value={mediaStats.totalDocuments} icon={FileText} gradient="from-green-500 to-green-600" />
        <StatCard title="播客總數" value={mediaStats.totalPodcasts} icon={Mic} gradient="from-orange-500 to-orange-600" />
      </div>

      {/* 銀行統計 + 例行統計 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard title="銀行總數" value={stats.totalBanks} icon={Building2} gradient="from-cyan-500 to-cyan-600" />
        <StatCard title="銀行存款" value={formatCurrency(stats.totalBankDeposit)} icon={Building2} gradient="from-emerald-500 to-emerald-600" />
        <StatCard title="例行數量" value={stats.totalRoutines} icon={CalendarClock} gradient="from-purple-500 to-purple-600" />
      </div>

      {/* 提醒和建議 */}
      {needsAttention && <AlertSection stats={stats} />}
    </div>
  );
}

// 介紹項目組件
function IntroItem({ icon: Icon, label, value, color }: { icon: any, label: string, value: string, color: string }) {
  return (
    <div className="flex items-center gap-4 p-3 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-white dark:border-gray-700 shadow-sm">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-white dark:bg-gray-800 shadow-inner ${color}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{value}</p>
      </div>
    </div>
  );
}

// 食品統計卡片
function ShillerPeNoticeCard({
  notice,
  dismissed,
  onDismiss,
  onNavigate,
}: {
  notice: ShillerPeNotice | null;
  dismissed: boolean;
  onDismiss: () => void;
  onNavigate: () => void;
}) {
  if (!notice?.isRecordHigh || dismissed) return null;

  return (
    <DataCard className="p-4 bg-rose-50 dark:bg-rose-900/20 border-l-4 border-rose-500">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-rose-100 dark:bg-rose-900/30 rounded-xl flex items-center justify-center">
          <TrendingUp className="text-rose-600 dark:text-rose-400" size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-rose-900 dark:text-rose-100">
            Shiller PE Ratio 創新高提醒
          </p>
          <p className="mt-1 text-xs leading-5 text-rose-800 dark:text-rose-200">
            目前 {notice.current?.toFixed(2) ?? "--"}，已突破歷史高點 {notice.recordHigh.toFixed(2)}
            （{notice.recordHighDate}）。請留意美股估值風險。
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={onNavigate}
            className="px-3 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            查看金融
          </button>
          <a
            href={notice.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 rounded-lg border border-rose-200 bg-white text-sm font-medium text-rose-700 hover:bg-rose-50"
          >
            來源
          </a>
          <button onClick={onDismiss} className="p-2 text-rose-400 hover:text-rose-600 transition-colors" title="今天不再提示">
            <X size={16} />
          </button>
        </div>
      </div>
    </DataCard>
  );
}

function FoodStatsCard({ stats, onNavigate }: { stats: ReturnType<typeof useDashboardStats>["stats"]; onNavigate: (id: string) => void }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <DataCard className="p-4 sm:p-6">
      <div 
        className="flex items-center justify-between mb-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
            <Package className="text-blue-600 dark:text-blue-400" size={20} />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">食品管理統計</h2>
        </div>
        {isExpanded ? (
          <ChevronUp className="text-gray-500 dark:text-gray-400" size={20} />
        ) : (
          <ChevronDown className="text-gray-500 dark:text-gray-400" size={20} />
        )}
      </div>
      
      {isExpanded && (
        <div className="space-y-3">
          <StatRow label="正常食品" value={stats.totalFoods - stats.foodsExpiring30Days - stats.expiredFoods} status="success" />
          <DetailStatRow label="7天內過期" value={stats.foodsExpiring7Days} status="warning" items={stats.foodsExpiring7DaysList} bgColor="bg-yellow-50 dark:bg-yellow-900/20" />
          <DetailStatRow label="30天內過期" value={stats.foodsExpiring30Days} status="urgent" items={stats.foodsExpiring30DaysList} bgColor="bg-orange-50 dark:bg-orange-900/20" />
          <DetailStatRow label="已過期" value={stats.expiredFoods} status="expired" items={stats.expiredFoodsList} bgColor="bg-red-50 dark:bg-red-900/20" isExpired />
        </div>
      )}
    </DataCard>
  );
}

// 訂閱統計卡片
function SubscriptionStatsCard({ stats, onNavigate }: { stats: ReturnType<typeof useDashboardStats>["stats"]; onNavigate: (id: string) => void }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <DataCard className="p-4 sm:p-6">
      <div 
        className="flex items-center justify-between mb-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
            <CreditCard className="text-green-600 dark:text-green-400" size={20} />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">訂閱管理統計</h2>
        </div>
        {isExpanded ? (
          <ChevronUp className="text-gray-500 dark:text-gray-400" size={20} />
        ) : (
          <ChevronDown className="text-gray-500 dark:text-gray-400" size={20} />
        )}
      </div>
      
      {isExpanded && (
        <div className="space-y-3">
          <StatRow label="正常訂閱" value={stats.totalSubscriptions - stats.subscriptionsExpiring7Days - stats.overdueSubscriptions} status="success" />
          <DetailStatRowSub label="3天內到期" value={stats.subscriptionsExpiring3Days} status="warning" items={stats.subscriptionsExpiring3DaysList} bgColor="bg-yellow-50 dark:bg-yellow-900/20" />
          <DetailStatRowSub label="7天內到期" value={stats.subscriptionsExpiring7Days} status="urgent" items={stats.subscriptionsExpiring7DaysList} bgColor="bg-orange-50 dark:bg-orange-900/20" />
          <DetailStatRowSub label="已逾期" value={stats.overdueSubscriptions} status="expired" items={stats.overdueSubscriptionsList} bgColor="bg-red-50 dark:bg-red-900/20" isExpired />
        </div>
      )}
    </DataCard>
  );
}

// 統計行
function StatRow({ label, value, status }: { label: string; value: number; status: "success" | "warning" | "urgent" | "expired" }) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
      <div className="flex items-center gap-3">
        <StatusDot status={status} />
        <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
      </div>
      <span className="font-semibold text-gray-900 dark:text-gray-100">{value}</span>
    </div>
  );
}

// 詳細統計行 (食品)
function DetailStatRow({ label, value, status, items, bgColor, isExpired = false }: { label: string; value: number; status: "warning" | "urgent" | "expired"; items: FoodDetail[]; bgColor: string; isExpired?: boolean }) {
  const textColor = status === "expired" ? "text-red-700 dark:text-red-400" : status === "urgent" ? "text-orange-700 dark:text-orange-400" : "text-yellow-700 dark:text-yellow-400";
  
  return (
    <div className={`p-3 ${bgColor} rounded-xl`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <StatusDot status={status} />
          <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
        </div>
        <span className={`font-semibold ${textColor}`}>{value}</span>
      </div>
      {items.length > 0 && (
        <div className="space-y-1 mt-2">
          {items.slice(0, 3).map((item) => (
            <div key={item.id} className="flex justify-between items-center text-xs">
              <span className="text-gray-600 dark:text-gray-400 truncate flex-1 mr-2">{item.name}</span>
              <span className={`font-medium ${textColor}`}>
                {isExpired ? `${Math.abs(item.daysRemaining)}天前` : formatDaysRemaining(item.daysRemaining)}
              </span>
            </div>
          ))}
          {items.length > 3 && <div className="text-xs text-gray-500 text-center">還有 {items.length - 3} 項...</div>}
        </div>
      )}
    </div>
  );
}

// 詳細統計行 (訂閱)
function DetailStatRowSub({ label, value, status, items, bgColor, isExpired = false }: { label: string; value: number; status: "warning" | "urgent" | "expired"; items: SubscriptionDetail[]; bgColor: string; isExpired?: boolean }) {
  const textColor = status === "expired" ? "text-red-700 dark:text-red-400" : status === "urgent" ? "text-orange-700 dark:text-orange-400" : "text-yellow-700 dark:text-yellow-400";
  
  return (
    <div className={`p-3 ${bgColor} rounded-xl`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <StatusDot status={status} />
          <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
        </div>
        <span className={`font-semibold ${textColor}`}>{value}</span>
      </div>
      {items.length > 0 && (
        <div className="space-y-1 mt-2">
          {items.slice(0, 3).map((item) => (
            <div key={item.id} className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-2 truncate flex-1 mr-2">
                <FaviconImage siteUrl={item.site} siteName={item.name} size={16} />
                <span className="text-gray-600 dark:text-gray-400 truncate">{item.name}</span>
              </div>
              <span className={`font-medium ${textColor}`}>
                {isExpired ? `${Math.abs(item.daysRemaining)}天前` : formatDaysRemaining(item.daysRemaining)}
              </span>
            </div>
          ))}
          {items.length > 3 && <div className="text-xs text-gray-500 text-center">還有 {items.length - 3} 項...</div>}
        </div>
      )}
    </div>
  );
}

// 警告區塊
function AlertSection({ stats }: { stats: ReturnType<typeof useDashboardStats>["stats"] }) {
  return (
    <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-4">
        <AlertTriangle className="text-red-600 dark:text-red-400" size={24} />
        <h2 className="text-lg font-semibold text-red-900 dark:text-red-100">需要注意</h2>
      </div>
      <div className="space-y-2 text-sm">
        {stats.expiredFoods > 0 && <p className="text-red-700 dark:text-red-300">⚠️ 有 {stats.expiredFoods} 項食品已過期，建議立即處理</p>}
        {stats.foodsExpiring7Days > 0 && <p className="text-orange-700 dark:text-orange-300">📅 有 {stats.foodsExpiring7Days} 項食品將在7天內過期</p>}
        {stats.overdueSubscriptions > 0 && <p className="text-red-700 dark:text-red-300">💳 有 {stats.overdueSubscriptions} 項訂閱已逾期付款</p>}
        {stats.subscriptionsExpiring3Days > 0 && <p className="text-orange-700 dark:text-orange-300">🔔 有 {stats.subscriptionsExpiring3Days} 項訂閱將在3天內到期</p>}
      </div>
    </div>
  );
}

// 多媒體儲存統計
function MediaStorageStats({ stats, onNavigate }: { stats: { totalImages: number; totalVideos: number; totalMusic: number; totalDocuments: number; totalPodcasts: number; storageImagesCount: number; storageVideosCount: number; storageMusicCount: number; imagesSize: number; videosSize: number; musicSize: number; documentsSize: number; otherSize: number; totalSize: number; totalFiles: number; storageLimit: number; usagePercentage: number }; onNavigate: (id: string) => void }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [includeDbRecords, setIncludeDbRecords] = useState(false);
  
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const usageColor = stats.usagePercentage > 80 ? 'text-red-600 dark:text-red-400' : stats.usagePercentage > 50 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400';
  const progressColor = stats.usagePercentage > 80 ? 'bg-red-500' : stats.usagePercentage > 50 ? 'bg-orange-500' : 'bg-green-500';

  return (
    <DataCard className="p-4 sm:p-6">
      <div 
        className="flex items-center justify-between mb-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
            <HardDrive className="text-purple-600 dark:text-purple-400" size={20} />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">多媒體儲存統計</h2>
        </div>
        {isExpanded ? (
          <ChevronUp className="text-gray-500 dark:text-gray-400" size={20} />
        ) : (
          <ChevronDown className="text-gray-500 dark:text-gray-400" size={20} />
        )}
      </div>

      {isExpanded && (
        <>
          {/* 選項勾選 */}
          <div className="mb-4 flex items-center gap-2">
            <input
              type="checkbox"
              id="includeDbRecords"
              checked={includeDbRecords}
              onChange={(e) => setIncludeDbRecords(e.target.checked)}
              className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 dark:focus:ring-purple-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <label htmlFor="includeDbRecords" className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
              包含所有圖片、影片、音樂、文件、播客（鋒兄圖片、鋒兄影片、鋒兄音樂、鋒兄文件、鋒兄播客）
            </label>
          </div>

          {/* 儲存總覽 */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600 dark:text-gray-400">累積容量</span>
              <span className={`font-semibold ${usageColor}`}>
                {formatBytes(stats.totalSize)} / {formatBytes(stats.storageLimit)} ({stats.usagePercentage.toFixed(1)}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
              <div
                className={`${progressColor} h-3 rounded-full transition-all duration-300`}
                style={{ width: `${Math.min(stats.usagePercentage, 100)}%` }}
              />
            </div>
            {stats.totalSize >= stats.storageLimit ? (
              <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                File Storage 已超過 1.8GB，上傳已停用。請手動刪除 Appwrite Storage 檔案，直到容量低於 1.8GB 以下。
              </p>
            ) : null}
          </div>

          {/* 分類統計 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <MediaStatCard 
          icon={Image} 
          title="鋒兄圖片" 
          count={includeDbRecords ? stats.totalImages + stats.storageImagesCount : stats.totalImages} 
          size={formatBytes(stats.imagesSize)} 
          color="blue"
        />
        <MediaStatCard 
          icon={FileVideo} 
          title="鋒兄影片" 
          count={includeDbRecords ? stats.totalVideos + stats.storageVideosCount : stats.totalVideos} 
          size={formatBytes(stats.videosSize)} 
          color="indigo"
        />
        <MediaStatCard 
          icon={Music} 
          title="鋒兄音樂" 
          count={includeDbRecords ? stats.totalMusic + stats.storageMusicCount : stats.totalMusic} 
          size={formatBytes(stats.musicSize)} 
          color="purple"
        />
        <MediaStatCard 
          icon={FileText} 
          title="鋒兄文件" 
          count={includeDbRecords ? stats.totalDocuments : 0} 
          size={formatBytes(stats.documentsSize)} 
          color="green"
        />
        <MediaStatCard 
          icon={Mic} 
          title="鋒兄播客" 
          count={stats.totalPodcasts} 
          size="-" 
          color="orange"
        />
      </div>
        </>
      )}
    </DataCard>
  );
}

// 多媒體統計卡片
function MediaStatCard({ icon: Icon, title, count, size, color }: { icon: any; title: string; count: number; size: string; color: string }) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400' },
    indigo: { bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-600 dark:text-indigo-400' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400' },
    green: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-600 dark:text-green-400' },
    orange: { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400' },
  };

  const colors = colorMap[color];

  return (
    <div className={`${colors.bg} p-4 rounded-xl border border-transparent`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={colors.text} size={20} />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</span>
      </div>
      <div className="space-y-1">
        <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{count}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">容量: {size}</p>
      </div>
    </div>
  );
}
