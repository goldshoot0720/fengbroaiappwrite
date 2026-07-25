"use client";

import NextImage from "next/image";
import { useEffect, useState } from "react";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useMediaStats } from "@/hooks/useMediaStats";
import { useNotificationPermission } from "@/hooks/useNotificationPermission";
import { useExpiryNotifications, sendExpiryOsNotifications } from "@/hooks/useExpiryNotifications";
import { Package, CreditCard, AlertTriangle, TrendingUp, DollarSign, Cloud, Layout, Server, FileVideo, Shield, Zap, Image, Music, HardDrive, FileText, Star, Building2, ChevronDown, ChevronUp, CalendarClock, Mic, Bell, X } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { DataCard } from "@/components/ui/data-card";
import { FullPageLoading } from "@/components/ui/loading-spinner";
import { StatusDot } from "@/components/ui/status-badge";
import { PageTitle } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import { FaviconImage } from "@/components/ui/favicon-image";
import { NotificationPermissionBanner } from "@/components/notifications/NotificationPermissionBanner";
import { formatCurrency, formatDaysRemaining } from "@/lib/formatters";
import { FoodDetail, SubscriptionDetail } from "@/types";
import PlumberTycoon from "@/components/modules/PlumberTycoon";
import CatShowcase from "@/components/modules/CatShowcase";
import CEOProfile from "@/components/modules/CEOProfile";
import codebaseStats from "@/config/codebase-stats.json";

type FengbroTubeRecentVideo = {
  videoId: string;
  title: string;
  url: string;
  publishedAt: string;
  channelTitle: string;
};

type FinanceAlertNotice = {
  id: string;
  name: string;
  displayName?: string;
  symbol: string;
  current: number | null;
  threshold: number;
  currency?: string;
  sourceUrl: string;
  updatedAt?: string;
  message?: string;
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
  const { stats, loading, error: dashboardError, setupRequired: dashboardSetupRequired } = useDashboardStats();
  const { stats: mediaStats, loading: mediaLoading, error: mediaError, setupRequired: mediaSetupRequired } = useMediaStats();
  const {
    permission: notificationPermission,
    permissionDismissed,
    dismissBanner,
    requestPermission,
    isIOS,
    isStandalone,
  } = useNotificationPermission();
  const [tubeRecentVideos, setTubeRecentVideos] = useState<FengbroTubeRecentVideo[]>([]);
  const [tubeNoticeDismissed, setTubeNoticeDismissed] = useState(false);
  const [financeAlerts, setFinanceAlerts] = useState<FinanceAlertNotice[]>([]);
  const [financeAlertsDismissed, setFinanceAlertsDismissed] = useState(false);

  useExpiryNotifications({
    stats,
    financeAlerts,
    enabled: !onlyTitle && !loading && !dashboardError,
    depsKey: `${stats.subscriptionsExpiring3DaysList.length}-${stats.foodsExpiring7DaysList.length}-${stats.expiredFoodsList.length}-${financeAlerts.length}`,
  });

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
    const loadFinanceAlerts = async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        if (window.localStorage.getItem("fengbroFinanceAlertsDismissed") === today) {
          setFinanceAlertsDismissed(true);
          return;
        }

        const response = await fetch("/api/fengbro-finance");
        const data = (await response.json()) as { financeAlerts?: FinanceAlertNotice[] };
        if (!active) return;
        setFinanceAlerts(data.financeAlerts || []);
      } catch {
        if (active) setFinanceAlerts([]);
      }
    };

    void loadFinanceAlerts();
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

  const handleDismissFinanceAlerts = () => {
    setFinanceAlertsDismissed(true);
    try {
      window.localStorage.setItem("fengbroFinanceAlertsDismissed", new Date().toISOString().slice(0, 10));
    } catch {}
  };

  const handleRequestPermission = async () => {
    const permission = await requestPermission();
    if (permission === "granted") {
      await sendExpiryOsNotifications({ stats, financeAlerts });
    }
  };

  if (dashboardSetupRequired) {
    return (
      <div className="space-y-6 lg:space-y-8">
        <PageTitle title={title} />
        <AppwriteSetupEmptyState onNavigate={() => onNavigate("settings")} />
      </div>
    );
  }

  if (onlyTitle) {
    return (
      <div className="space-y-6 lg:space-y-8">
        <PageTitle title={title} />

        <FinanceAlertsNoticeCard
          alerts={financeAlerts}
          dismissed={financeAlertsDismissed}
          onDismiss={handleDismissFinanceAlerts}
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
          <DataCard className="surface-raised border-[var(--line-soft)] p-6">
            <div className="mb-6 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,var(--accent-strong),var(--accent))] text-[var(--accent-foreground)] shadow-[var(--shadow-soft)]">
                <Zap size={24} />
              </div>
              <div>
                <h2 className="font-display text-xl font-semibold text-foreground">精美介紹</h2>
                <p className="text-sm text-muted-foreground">鋒兄管理資訊系統核心架構</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <IntroItem icon={Cloud} label="網頁部署" value="Vercel 雲端空間" color="text-[var(--accent-strong)]" />
              <IntroItem icon={Layout} label="前端框架" value="Next.js (基於 React)" color="text-[var(--chart-2)]" />
              <IntroItem icon={Server} label="後端服務" value="Appwrite (BaaS 解決方案)" color="text-[var(--chart-5)]" />
              <IntroItem icon={FileVideo} label="多媒體儲存" value="Appwrite Storage (圖片/音樂/影片/文件)" color="text-[var(--chart-4)]" />
            </div>
          </DataCard>

          <DataCard className="surface-raised flex flex-col justify-center border-[var(--line-soft)] p-6">
            <div className="space-y-4 text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 rotate-3 items-center justify-center rounded-3xl bg-[linear-gradient(145deg,var(--accent-strong),var(--accent))] shadow-[var(--shadow-strong)] transition-impeccable hover:rotate-0">
                <span className="text-3xl font-bold text-[var(--accent-foreground)]">鋒</span>
              </div>
              <h3 className="font-display text-2xl font-semibold text-foreground">本網站建置</h3>
              <p className="mx-auto max-w-sm leading-relaxed text-muted-foreground">
                透過現代化的技術棧，為您提供極致流暢且安全的資訊管理體驗。
              </p>
            </div>
          </DataCard>
        </div>
        
        {/* 水電大亨事業版圖 */}
        <div className="mt-8">
          <PlumberTycoon />
        </div>
        
        {/* 人工智慧水電行執行長 */}
        <div className="mt-8">
          <CEOProfile />
        </div>
        
        {/* 鋒兄的貓咪家族 */}
        <div className="mt-8">
          <CatShowcase />
        </div>

        <footer className="mt-10 border-t border-[var(--line-soft)] pt-6 pb-2 text-center">
          <p className="text-sm text-muted-foreground tracking-wide">
            鋒兄 © 2026-2027 FengBroAI Appwrite
          </p>
          <p className="mt-2 text-xs text-muted-foreground/80">
            上次更新日期 {codebaseStats.snapshotDate}
            <span className="mx-2 text-[var(--line-strong)]" aria-hidden>
              ·
            </span>
            程式碼行數 {codebaseStats.totalLines.toLocaleString()}
          </p>
        </footer>
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

      <FinanceAlertsNoticeCard
        alerts={financeAlerts}
        dismissed={financeAlertsDismissed}
        onDismiss={handleDismissFinanceAlerts}
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

      <NotificationPermissionBanner
        permission={notificationPermission}
        permissionDismissed={permissionDismissed}
        isIOS={isIOS}
        isStandalone={isStandalone}
        onRequestPermission={() => void handleRequestPermission()}
        onDismiss={dismissBanner}
      />

      <PageTitle title={title} description="鋒兄管理資訊系統 - 數據匯總與分析" />

      {/* 詳細統計區域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <FoodStatsCard stats={stats} onNavigate={onNavigate} />
        <SubscriptionStatsCard stats={stats} onNavigate={onNavigate} />
      </div>

      {/* 多媒體儲存統計 */}
      <MediaStorageStats stats={mediaStats} setupRequired={mediaSetupRequired} onNavigate={onNavigate} />
      
      {/* 訂閱到期提醒 */}
      {stats.subscriptionsExpiring3Days > 0 && (
        <DataCard className="p-4 bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-500">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 shrink-0 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
              <Bell className="text-orange-600 dark:text-orange-400" size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
                🔔 有 {stats.subscriptionsExpiring3Days} 項訂閱將在 3 天內到期
              </p>
              <ul className="mt-2 space-y-1 max-h-36 overflow-y-auto">
                {[...stats.subscriptionsExpiring3DaysList]
                  .sort((a, b) => a.daysRemaining - b.daysRemaining)
                  .slice(0, 8)
                  .map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-2 text-xs text-orange-800 dark:text-orange-200"
                    >
                      <span className="flex items-center gap-2 min-w-0 truncate">
                        <FaviconImage siteUrl={item.site} siteName={item.name} size={14} />
                        <span className="truncate">{item.name}</span>
                      </span>
                      <span className="shrink-0 font-medium">
                        {formatDaysRemaining(item.daysRemaining)}
                      </span>
                    </li>
                  ))}
              </ul>
              {stats.subscriptionsExpiring3DaysList.length > 8 && (
                <p className="text-xs text-orange-700/80 dark:text-orange-300/80 mt-1">
                  還有 {stats.subscriptionsExpiring3DaysList.length - 8} 項…
                </p>
              )}
            </div>
            <button
              onClick={() => onNavigate("subscription")}
              className="px-4 py-2 shrink-0 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              查看
            </button>
          </div>
        </DataCard>
      )}
      
      {/* 主要統計卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard title="訂閱服務" value={stats.totalSubscriptions} icon={CreditCard} />
        <StatCard title="年費總計" value={formatCurrency(stats.totalAnnualFee)} icon={DollarSign} />
        <StatCard title="食品項目" value={stats.totalFoods} icon={Package} />
        <StatCard title="需要關注" value={stats.foodsExpiring7Days + stats.subscriptionsExpiring3Days} icon={AlertTriangle} gradient="from-[var(--warning)] to-[var(--chart-5)]" />
      </div>

      {/* 其他統計 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <StatCard title="筆記總數" value={stats.totalArticles} icon={FileText} />
        <StatCard title="常用帳號總數" value={stats.totalCommonAccounts} icon={Star} />
      </div>

      {/* 多媒體統計 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard title="音樂總數" value={mediaStats.totalMusic} icon={Music} />
        <StatCard title="文件總數" value={mediaStats.totalDocuments} icon={FileText} />
        <StatCard title="播客總數" value={mediaStats.totalPodcasts} icon={Mic} />
      </div>

      {/* 銀行統計 + 例行統計 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard title="銀行總數" value={stats.totalBanks} icon={Building2} />
        <StatCard title="銀行存款" value={formatCurrency(stats.totalBankDeposit)} icon={Building2} />
        <StatCard title="例行數量" value={stats.totalRoutines} icon={CalendarClock} />
      </div>

      {/* 提醒和建議 */}
      {needsAttention && <AlertSection stats={stats} />}
    </div>
  );
}

export function AppwriteSetupEmptyState({ onNavigate }: { onNavigate: () => void }) {
  return (
    <DataCard className="overflow-hidden border-sky-200 bg-sky-50/70 p-0">
      <div className="flex flex-col gap-5 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
            <Server size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-700/80">Setup Required</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">尚未設定 Appwrite</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              首頁已暫停自動載入音樂、影片、圖片、播客、Storage 統計與到期檢查，避免未設定時連續產生 500。完成 endpoint、project、database、API key 與 bucket 設定後，儀表板會恢復同步。
            </p>
          </div>
        </div>
        <Button onClick={onNavigate} className="shrink-0 gap-2 bg-sky-600 hover:bg-sky-700">
          前往鋒兄設定
        </Button>
      </div>
    </DataCard>
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

function formatFinanceAlertValue(value: number | null, currency?: string) {
  const formatted = value == null
    ? "--"
    : new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 2 }).format(value);
  return currency ? `${formatted} ${currency}` : formatted;
}

function FinanceAlertsNoticeCard({
  alerts,
  dismissed,
  onDismiss,
  onNavigate,
}: {
  alerts: FinanceAlertNotice[];
  dismissed: boolean;
  onDismiss: () => void;
  onNavigate: () => void;
}) {
  if (alerts.length === 0 || dismissed) return null;

  return (
    <DataCard className="p-4 bg-rose-50 dark:bg-rose-900/20 border-l-4 border-rose-500">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-rose-100 dark:bg-rose-900/30 rounded-xl flex items-center justify-center">
          <TrendingUp className="text-rose-600 dark:text-rose-400" size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-rose-900 dark:text-rose-100">
            鋒兄金融突破提醒
          </p>
          <div className="mt-2 grid gap-1 text-xs leading-5 text-rose-800 dark:text-rose-200 sm:grid-cols-2">
            {alerts.slice(0, 6).map((alert) => (
              <a key={alert.id} href={alert.sourceUrl} target="_blank" rel="noreferrer" className="line-clamp-1 hover:underline">
                {alert.name}：{formatFinanceAlertValue(alert.current, alert.currency)} / 門檻 {formatFinanceAlertValue(alert.threshold, alert.currency)}
              </a>
            ))}
          </div>
          {alerts.length > 6 ? (
            <p className="mt-1 text-xs text-rose-700 dark:text-rose-200">另有 {alerts.length - 6} 項突破門檻，請至鋒兄金融查看。</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={onNavigate}
            className="px-3 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            查看金融
          </button>
          <button onClick={onDismiss} className="p-2 text-rose-400 hover:text-rose-600 transition-colors" title="今天不再提示">
            <X size={16} />
          </button>
        </div>
      </div>
    </DataCard>
  );
}

function FoodStatsCard({ stats, onNavigate }: { stats: ReturnType<typeof useDashboardStats>["stats"]; onNavigate: (id: string) => void }) {
  const hasAttention =
    stats.foodsExpiring7Days > 0 || stats.foodsExpiring30Days > 0 || stats.expiredFoods > 0;
  const [isExpanded, setIsExpanded] = useState(hasAttention);

  return (
    <DataCard className="p-4 sm:p-6">
      <div
        className="flex items-center justify-between mb-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 shrink-0 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
            <Package className="text-blue-600 dark:text-blue-400" size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">食品管理統計</h2>
            {!isExpanded && hasAttention && (
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5 truncate">
                {[
                  stats.expiredFoods > 0 ? `${stats.expiredFoods} 已過期` : null,
                  stats.foodsExpiring7Days > 0 ? `${stats.foodsExpiring7Days} 項 7 天內` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="text-gray-500 dark:text-gray-400 shrink-0" size={20} />
        ) : (
          <ChevronDown className="text-gray-500 dark:text-gray-400 shrink-0" size={20} />
        )}
      </div>

      {isExpanded && (
        <div className="space-y-3">
          <StatRow label="正常食品" value={stats.totalFoods - stats.foodsExpiring30Days - stats.expiredFoods} status="success" />
          <DetailStatRow label="7天內過期" value={stats.foodsExpiring7Days} status="warning" items={stats.foodsExpiring7DaysList} bgColor="bg-yellow-50 dark:bg-yellow-900/20" onNavigate={() => onNavigate("food")} />
          <DetailStatRow label="30天內過期" value={stats.foodsExpiring30Days} status="urgent" items={stats.foodsExpiring30DaysList} bgColor="bg-orange-50 dark:bg-orange-900/20" onNavigate={() => onNavigate("food")} />
          <DetailStatRow label="已過期" value={stats.expiredFoods} status="expired" items={stats.expiredFoodsList} bgColor="bg-red-50 dark:bg-red-900/20" isExpired onNavigate={() => onNavigate("food")} />
        </div>
      )}
    </DataCard>
  );
}

// 訂閱統計卡片
function SubscriptionStatsCard({ stats, onNavigate }: { stats: ReturnType<typeof useDashboardStats>["stats"]; onNavigate: (id: string) => void }) {
  const hasAttention =
    stats.subscriptionsExpiring3Days > 0 ||
    stats.subscriptionsExpiring7Days > 0 ||
    stats.overdueSubscriptions > 0;
  const [isExpanded, setIsExpanded] = useState(hasAttention);

  return (
    <DataCard className="p-4 sm:p-6">
      <div
        className="flex items-center justify-between mb-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 shrink-0 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
            <CreditCard className="text-green-600 dark:text-green-400" size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">訂閱管理統計</h2>
            {!isExpanded && hasAttention && (
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5 truncate">
                {[
                  stats.overdueSubscriptions > 0 ? `${stats.overdueSubscriptions} 已逾期` : null,
                  stats.subscriptionsExpiring3Days > 0
                    ? `${stats.subscriptionsExpiring3Days} 項 3 天內`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="text-gray-500 dark:text-gray-400 shrink-0" size={20} />
        ) : (
          <ChevronDown className="text-gray-500 dark:text-gray-400 shrink-0" size={20} />
        )}
      </div>

      {isExpanded && (
        <div className="space-y-3">
          <StatRow label="正常訂閱" value={stats.totalSubscriptions - stats.subscriptionsExpiring7Days - stats.overdueSubscriptions} status="success" />
          <DetailStatRowSub label="3天內到期" value={stats.subscriptionsExpiring3Days} status="warning" items={stats.subscriptionsExpiring3DaysList} bgColor="bg-yellow-50 dark:bg-yellow-900/20" onNavigate={() => onNavigate("subscription")} />
          <DetailStatRowSub label="7天內到期" value={stats.subscriptionsExpiring7Days} status="urgent" items={stats.subscriptionsExpiring7DaysList} bgColor="bg-orange-50 dark:bg-orange-900/20" onNavigate={() => onNavigate("subscription")} />
          <DetailStatRowSub label="已逾期" value={stats.overdueSubscriptions} status="expired" items={stats.overdueSubscriptionsList} bgColor="bg-red-50 dark:bg-red-900/20" isExpired onNavigate={() => onNavigate("subscription")} />
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

const DETAIL_LIST_PREVIEW = 8;

// 詳細統計行 (食品)
function DetailStatRow({
  label,
  value,
  status,
  items,
  bgColor,
  isExpired = false,
  onNavigate,
}: {
  label: string;
  value: number;
  status: "warning" | "urgent" | "expired";
  items: FoodDetail[];
  bgColor: string;
  isExpired?: boolean;
  onNavigate?: () => void;
}) {
  const textColor = status === "expired" ? "text-red-700 dark:text-red-400" : status === "urgent" ? "text-orange-700 dark:text-orange-400" : "text-yellow-700 dark:text-yellow-400";
  const sorted = [...items].sort((a, b) => a.daysRemaining - b.daysRemaining);

  return (
    <div className={`p-3 ${bgColor} rounded-xl`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <StatusDot status={status} />
          <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
        </div>
        <span className={`font-semibold ${textColor}`}>{value}</span>
      </div>
      {sorted.length > 0 && (
        <div className="space-y-1.5 mt-2 max-h-48 overflow-y-auto">
          {sorted.slice(0, DETAIL_LIST_PREVIEW).map((item) => (
            <div key={item.id} className="flex justify-between items-center gap-2 text-xs">
              <span className="text-gray-700 dark:text-gray-300 truncate flex-1 min-w-0">{item.name}</span>
              <span className={`font-medium shrink-0 ${textColor}`}>
                {isExpired ? `${Math.abs(item.daysRemaining)}天前` : formatDaysRemaining(item.daysRemaining)}
              </span>
            </div>
          ))}
          {sorted.length > DETAIL_LIST_PREVIEW && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNavigate?.();
              }}
              className="w-full text-xs text-center text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 py-1"
            >
              還有 {sorted.length - DETAIL_LIST_PREVIEW} 項…{onNavigate ? " 查看全部" : ""}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// 詳細統計行 (訂閱)
function DetailStatRowSub({
  label,
  value,
  status,
  items,
  bgColor,
  isExpired = false,
  onNavigate,
}: {
  label: string;
  value: number;
  status: "warning" | "urgent" | "expired";
  items: SubscriptionDetail[];
  bgColor: string;
  isExpired?: boolean;
  onNavigate?: () => void;
}) {
  const textColor = status === "expired" ? "text-red-700 dark:text-red-400" : status === "urgent" ? "text-orange-700 dark:text-orange-400" : "text-yellow-700 dark:text-yellow-400";
  const sorted = [...items].sort((a, b) => a.daysRemaining - b.daysRemaining);

  return (
    <div className={`p-3 ${bgColor} rounded-xl`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <StatusDot status={status} />
          <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
        </div>
        <span className={`font-semibold ${textColor}`}>{value}</span>
      </div>
      {sorted.length > 0 && (
        <div className="space-y-1.5 mt-2 max-h-48 overflow-y-auto">
          {sorted.slice(0, DETAIL_LIST_PREVIEW).map((item) => (
            <div key={item.id} className="flex justify-between items-center gap-2 text-xs">
              <div className="flex items-center gap-2 truncate flex-1 min-w-0 mr-1">
                <FaviconImage siteUrl={item.site} siteName={item.name} size={16} />
                <span className="text-gray-700 dark:text-gray-300 truncate">{item.name}</span>
              </div>
              <span className={`font-medium shrink-0 ${textColor}`}>
                {isExpired ? `${Math.abs(item.daysRemaining)}天前` : formatDaysRemaining(item.daysRemaining)}
              </span>
            </div>
          ))}
          {sorted.length > DETAIL_LIST_PREVIEW && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNavigate?.();
              }}
              className="w-full text-xs text-center text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 py-1"
            >
              還有 {sorted.length - DETAIL_LIST_PREVIEW} 項…{onNavigate ? " 查看全部" : ""}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AlertItemList({
  items,
  isExpired = false,
  tone,
}: {
  items: Array<{ id: string; name: string; daysRemaining: number }>;
  isExpired?: boolean;
  tone: "red" | "orange";
}) {
  if (items.length === 0) return null;
  const sorted = [...items].sort((a, b) => a.daysRemaining - b.daysRemaining);
  const nameColor = tone === "red" ? "text-red-800 dark:text-red-200" : "text-orange-800 dark:text-orange-200";
  const dayColor = tone === "red" ? "text-red-600 dark:text-red-300" : "text-orange-600 dark:text-orange-300";

  return (
    <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto border-t border-black/5 dark:border-white/10 pt-2">
      {sorted.slice(0, DETAIL_LIST_PREVIEW).map((item) => (
        <li key={item.id} className="flex justify-between gap-2 text-xs">
          <span className={`truncate min-w-0 ${nameColor}`}>{item.name}</span>
          <span className={`shrink-0 font-medium ${dayColor}`}>
            {isExpired
              ? `已過期 ${Math.abs(item.daysRemaining)} 天`
              : formatDaysRemaining(item.daysRemaining)}
          </span>
        </li>
      ))}
      {sorted.length > DETAIL_LIST_PREVIEW && (
        <li className="text-xs text-muted-foreground text-center pt-0.5">
          還有 {sorted.length - DETAIL_LIST_PREVIEW} 項…
        </li>
      )}
    </ul>
  );
}

// 警告區塊
function AlertSection({ stats }: { stats: ReturnType<typeof useDashboardStats>["stats"] }) {
  return (
    <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-4">
        <AlertTriangle className="text-red-600 dark:text-red-400 shrink-0" size={24} />
        <div>
          <h2 className="text-lg font-semibold text-red-900 dark:text-red-100">需要注意</h2>
          <p className="text-xs text-red-700/80 dark:text-red-300/80 mt-0.5">依剩餘天數排序，可直接對照名稱與期限</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 text-sm">
        {stats.expiredFoods > 0 && (
          <div className="rounded-xl bg-white/60 dark:bg-black/20 p-3">
            <p className="font-medium text-red-700 dark:text-red-300">
              ⚠️ 有 {stats.expiredFoods} 項食品已過期
            </p>
            <AlertItemList items={stats.expiredFoodsList} isExpired tone="red" />
          </div>
        )}
        {stats.foodsExpiring7Days > 0 && (
          <div className="rounded-xl bg-white/60 dark:bg-black/20 p-3">
            <p className="font-medium text-orange-700 dark:text-orange-300">
              📅 有 {stats.foodsExpiring7Days} 項食品將在 7 天內過期
            </p>
            <AlertItemList items={stats.foodsExpiring7DaysList} tone="orange" />
          </div>
        )}
        {stats.overdueSubscriptions > 0 && (
          <div className="rounded-xl bg-white/60 dark:bg-black/20 p-3">
            <p className="font-medium text-red-700 dark:text-red-300">
              💳 有 {stats.overdueSubscriptions} 項訂閱已逾期付款
            </p>
            <AlertItemList items={stats.overdueSubscriptionsList} isExpired tone="red" />
          </div>
        )}
        {stats.subscriptionsExpiring3Days > 0 && (
          <div className="rounded-xl bg-white/60 dark:bg-black/20 p-3">
            <p className="font-medium text-orange-700 dark:text-orange-300">
              🔔 有 {stats.subscriptionsExpiring3Days} 項訂閱將在 3 天內到期
            </p>
            <AlertItemList items={stats.subscriptionsExpiring3DaysList} tone="orange" />
          </div>
        )}
      </div>
    </div>
  );
}

// 多媒體儲存統計
function MediaStorageStats({ stats, setupRequired, onNavigate }: { stats: { totalImages: number; totalVideos: number; totalMusic: number; totalDocuments: number; totalPodcasts: number; storageImagesCount: number; storageVideosCount: number; storageMusicCount: number; imagesSize: number; videosSize: number; musicSize: number; documentsSize: number; otherSize: number; totalSize: number; totalFiles: number; storageLimit: number; usagePercentage: number }; setupRequired: boolean; onNavigate: (id: string) => void }) {
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
  const isOverStorageLimit = !setupRequired && stats.storageLimit > 0 && stats.totalSize >= stats.storageLimit;

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

      {isOverStorageLimit ? (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          <p className="font-semibold">File Storage 已超過 1.8GB，上傳已停用</p>
          <p className="mt-1">
            目前使用 {formatBytes(stats.totalSize)} / {formatBytes(stats.storageLimit)}。請手動刪除 Appwrite Storage 檔案，直到容量低於 1.8GB 以下。
          </p>
        </div>
      ) : null}

      {isExpanded && (
        <>
          {setupRequired ? (
            <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-100">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">尚未完成 Storage 設定</p>
                  <p className="mt-1 text-sky-800/80 dark:text-sky-200/80">
                    多媒體統計已暫停載入，請補上 Bucket ID 與 API Key 後再同步。
                  </p>
                </div>
                <Button onClick={() => onNavigate("settings")} className="shrink-0 bg-sky-600 hover:bg-sky-700">
                  前往設定
                </Button>
              </div>
            </div>
          ) : null}

          {/* 選項勾選 */}
          {!setupRequired && <div className="mb-4 flex items-center gap-2">
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
          </div>}

          {/* 儲存總覽 */}
          {!setupRequired && <div className="mb-4">
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
            {isOverStorageLimit ? (
              <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                File Storage 已超過 1.8GB，上傳已停用。請手動刪除 Appwrite Storage 檔案，直到容量低於 1.8GB 以下。
              </p>
            ) : null}
          </div>}

          {/* 分類統計 */}
          {!setupRequired && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
      </div>}
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
