"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, Book, CheckCircle2, ChevronRight, FileText, HardDrive, Info, Menu, Package, ShieldAlert, Sparkles, X } from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import { PageTitle } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import codebaseStats from "@/config/codebase-stats.json";
import { useAboutStats } from "@/hooks/useAboutStats";
import { useBanks } from "@/hooks/useBanks";
import { useBankSessionCompare } from "@/hooks/useBankSessionCompare";
import { getModuleLabel } from "@/lib/moduleLabels";
import { formatCurrency, formatDate } from "@/lib/formatters";

const NAV_SECTIONS = [
  { id: "troubleshooting", title: "障礙排除手冊", icon: AlertTriangle },
  { id: "updates", title: "更新內容", icon: Info },
  { id: "system", title: "系統架構", icon: Package },
  { id: "modules", title: "功能模組", icon: BarChart3 },
  { id: "docs", title: "技術文件", icon: FileText },
  { id: "guide", title: "完整文件", icon: Book },
] as const;

const CODEBASE_MILESTONE_LINES = 100_000;
const CODEBASE_MILESTONE_STORAGE_KEY = "fengbro:codebase-milestone:last-celebration";
let nonPersistentCelebrationMonth = "";

function getTaipeiMonthKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
}

const ABOUT_SUBPAGES = [
  { id: "bilibili-info", title: "Bilibili 資訊", description: "Bilibili 平台資訊與使用說明" },
  { id: "mindvideo-info", title: "MindVideo 資訊", description: "MindVideo 服務資訊與使用說明" },
  { id: "litvideo-info", title: "LitVideo 資訊", description: "LitVideo 服務資訊與使用說明" },
  { id: "musicful-info", title: "Musicful 資訊", description: "Musicful 服務資訊與使用說明" },
  { id: "digen-info", title: "Digen 資訊", description: "Digen 服務資訊與使用說明" },
  { id: "oiioii-info", title: "OiiOii 資訊", description: "OiiOii 服務資訊與使用說明" },
] as const;

const MODULES = [
  { num: 1, name: "鋒兄首頁", category: "入口", desc: "系統總覽與各模組快速入口，同一頁可切換精簡待辦與完整儀表" },
  { num: 2, name: "鋒兄訂閱", category: "生活", desc: "訂閱、扣款日、CSV 匯入匯出、本機垃圾桶與整理提醒" },
  { num: 3, name: "鋒兄食品 （＋商品庫存）", category: "生活", desc: "庫存、到期管理、快速新增與批次清理" },
  { num: 4, name: "鋒兄筆記", category: "知識", desc: "快速筆記、附件預覽、本機垃圾桶與釘選工作台" },
  { num: 5, name: "鋒兄常用", category: "入口", desc: "常用站點、複製、置頂與最近使用控制台" },
  { num: 6, name: "鋒兄圖片", category: "媒體", desc: "圖片管理、標籤整理與工作台摘要" },
  { num: 7, name: "鋒兄影片", category: "媒體", desc: "影片播放、封面管理與播放佇列" },
  { num: 8, name: "鋒兄音樂", category: "媒體", desc: "音樂播放、歌詞、整理摘要與媒體控制" },
  { num: 9, name: "鋒兄文件", category: "知識", desc: "文件預覽、分類、匯入匯出與技術內容整理" },
  { num: 10, name: "鋒兄播客", category: "媒體", desc: "播客播放、批次上傳與摘要式管理" },
  { num: 11, name: "鋒兄銀行", category: "財務", desc: "帳戶資料、電子票證、餘額與異常提醒" },
  { num: 12, name: "鋒兄例行", category: "任務", desc: "例行事項、日期遞移與週期追蹤" },
  { num: 13, name: "鋒兄設定", category: "維運", desc: "Appwrite 設定、Table 初始化、資料統計與 system config" },
  { num: 14, name: "鋒兄關於", category: "文件", desc: "更新內容、架構說明、版本資訊與文件中心" },
  { num: 15, name: "鋒兄比價", category: "工具", desc: "手動商品與價格紀錄（manualprice）" },
  { num: 16, name: "手機比價", category: "工具", desc: "地標網通與傑昇通信雙來源，含週期歷史" },
  { num: 17, name: "圖片 + 語音 = 影片", category: "工具", desc: "FFmpeg 把圖片與語音合成影片" },
  { num: 18, name: "PNG / JPEG 轉換", category: "工具", desc: "瀏覽器端圖片格式轉換" },
  { num: 19, name: "影片合併", category: "工具", desc: "多段影片合併" },
  { num: 20, name: "YT / B站轉 MP3/MP4", category: "工具", desc: "YouTube / Bilibili 下載轉檔" },
  { num: 21, name: "鋒兄Tube", category: "子工具", desc: "頻道最新影片與倒台指數" },
  { num: 22, name: "鋒兄金融", category: "子工具", desc: "CNBC / Yahoo 報價與自訂標的 CSV" },
  { num: 23, name: "鋒兄新聞", category: "子工具", desc: "鎖定網站焦點、人口統計與便當等面板" },
];

const MODULE_COUNT = MODULES.length;

const DOC_GROUPS = [
  {
    title: "核心導覽文件",
    items: [
      ["INDEX.md", "整體文件入口與模組對照"],
      ["USER_GUIDE.md", "完整使用者操作手冊"],
      ["SYSTEM_ARCHITECTURE.md", "系統分層、資料流與技術結構"],
      ["00_company_introduction.md", "專案定位與模組導讀"],
    ],
  },
  {
    title: "模組文件",
    items: [
      ["03_subscription.md", "訂閱 schema、篩選、CSV 與到期邏輯"],
      ["04_food.md", "食品工作台、到期分區與批次清理"],
      ["05_notes.md", "筆記模板、AI 摘要與知識整理"],
      ["06_common_accounts.md", "常用入口、置頂與最近使用"],
      ["14_settings.md", "設定頁、初始化、統計與維運工具"],
      ["15_about.md", "關於頁與文件中心規格"],
      ["components/modules/ToolsManagement.tsx", "手機比價、BigGo、地標網通與傑昇通信整合"],
    ],
  },
  {
    title: "程式碼重點檔案",
    items: [
      ["components/ui/friendly-ai-crud-shell.tsx", "共用友善 AI CRUD 工作台殼層"],
      ["components/modules/SubscriptionManagement.tsx", "訂閱頁最新平衡版 UI 與 CSV 功能"],
      ["components/modules/SettingsManagement.tsx", "Table 初始化、collection id 與系統設定"],
      ["app/api/_lib/landtop.js", "地標網通品牌頁、商品頁與容量版本解析"],
      ["app/api/_lib/jyes.js", "傑昇通信價格總覽解析與手機比價來源"],
      ["hooks/useSubscriptions.ts", "訂閱資料存取、統計與到期資訊"],
    ],
  },
];

const RELEASE_ITEMS = [
  {
    date: "2026-08-13",
    title: "訂閱整理欄位接到表單",
    bullets: [
      "鋒兄訂閱表單、API 與 CSV 會讀寫分類、用途、頻率、友善度、替代方案、去留建議與封存。",
      "預設只顯示使用中的訂閱；封存與本機垃圾桶分開。",
      "鋒兄設定在結構不符時可「補欄位」，不必重建刪資料。",
      "儀表到期、月費與推播／信件改回計算全部訂閱（含封存、不續訂）。",
    ],
  },
  {
    date: "2026-08-13",
    title: "選單與文件對齊現況",
    bullets: [
      "README、docs/INDEX 與鋒兄關於的模組表改為對齊 app/page.tsx：日常工作台 15 項，加上工具與子工具共 24 個可導覽葉模組。",
      "資料表改為設定頁可建立的 13 個 collection（含 landtophistory、manualprice）。",
      "使用手冊與系統架構文件加上現況以 INDEX 為準的說明，避免繼續引用舊的 15 模組／11 表。",
    ],
  },
  {
    date: "2026-07-18",
    title: "首頁與關於頁程式碼行數口徑修正",
    bullets: [
      "鋒兄首頁 footer 與鋒兄關於的程式碼行數，改為只統計核心產品原始碼（app / components / hooks / lib / types / scripts / tests）。",
      "prebuild 掃描排除 skills、agent 工具複本、Markdown 文件與 node_modules，避免行數膨脹到數十萬。",
      "關於頁統計說明同步更新，與實際 generate-stats 範圍一致。",
    ],
  },
  {
    date: "2026-07-12",
    title: "手機比價介面現代化升級與頻道優化",
    bullets: [
      "手機比價介面全面導入琉璃質感 (Glassmorphism)，加入環境光暈、懸停動畫與質感徽章設計。",
    ],
  },
  {
    date: "2026-07-12",
    title: "鋒兄Tube 優化與統計自動化",
    bullets: [
      "鋒兄Tube 移除了過時頻道並精簡倒台指數邏輯，在沒有近期影片時也能正確回退顯示歷史最後紀錄。",
      "鋒兄關於的程式碼行數改由 Vercel 部署前自動掃描專案計算 (prebuild)，無須再手動更新數據。",
    ],
  },
  {
    date: "2026-04-23",
    title: "手機比價升級為雙來源比價工具",
    bullets: [
      "原本地標網通子頁已更名為手機比價，整合地標網通與傑昇通信兩個來源。",
      "同型號會合併顯示地標網通價、傑昇通信價與最低價來源，方便直接比較。",
      "Samsung A17、iPhone 17、Samsung S26 這類機型會優先展開容量版本，不再只停在品牌頁摘要卡。",
    ],
  },
  {
    date: "2026-04-23",
    title: "地標網通加入每 7 天歷史快照",
    bullets: [
      "手機比價 API 會在查詢後把地標網通價格寫入 Appwrite 的 landtophistory 集合。",
      "前端新增歷史價格圖表，可追蹤不同容量版本的週期變化。",
      "既有 Vercel cron 直接沿用，後續歷史資料會隨每週排程持續累積。",
    ],
  },
  {
    date: "2026-04-23",
    title: "系統維運與清單體驗同步更新",
    bullets: [
      "列表 API 已統一提高到 500 筆並補上自動分頁，避免 100 筆上限截斷資料。",
      "鋒兄筆記新增「有附件」分類篩選，快捷篩選在沒有搜尋字時也能正確生效。",
      "設定頁的應用程式版本與框架版本已改成直接讀 package.json，不再手動寫死。",
    ],
  },
  {
    date: "2026-03-12",
    title: "鋒兄關於改版為文件中心",
    bullets: [
      "把舊版公司宣傳內容改成產品文件導向的關於頁。",
      "整理成更新內容、系統架構、功能模組、技術文件、完整文件五大分頁。",
      "讓關於頁本身可以作為交接與規劃入口，而不是靜態介紹頁。",
    ],
  },
  {
    date: "2026-03-12",
    title: "友善 AI CRUD 工作台第一輪完成",
    bullets: [
      "圖片、影片、音樂、文件、播客、銀行、例行七個模組已統一第一輪工作台骨架。",
      "食品、筆記、常用、訂閱都已往快速新增、摘要卡、AI 建議、批次整理方向收斂。",
      "共用殼層已抽出，後續可以再往共用卡片與 Drawer 編輯器推進。",
    ],
  },
  {
    date: "2026-03-12",
    title: "訂閱模組依真實 schema 收斂",
    bullets: [
      "以 `name / site / price / nextdate / note / account / currency / continue` 為準重做 CRUD。",
      "補上 document ID 搜尋、CSV 匯入匯出、collection id 顯示、日期 ±30 天快捷鍵。",
      "AI 定位改成整理助理，新增重複提醒與未設定扣款日快捷篩選。",
    ],
  },
];

export default function AboutUs({ onNavigate }: { onNavigate: (moduleId: string) => void }) {
  const [activeSection, setActiveSection] = useState<string>("updates");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showMilestoneCelebration, setShowMilestoneCelebration] = useState(false);

  useEffect(() => {
    if (codebaseStats.totalLines < CODEBASE_MILESTONE_LINES) return;

    const monthKey = getTaipeiMonthKey();
    try {
      if (window.localStorage.getItem(CODEBASE_MILESTONE_STORAGE_KEY) === monthKey) return;
      window.localStorage.setItem(CODEBASE_MILESTONE_STORAGE_KEY, monthKey);
      setShowMilestoneCelebration(true);
    } catch {
      if (nonPersistentCelebrationMonth === monthKey) return;
      nonPersistentCelebrationMonth = monthKey;
      setShowMilestoneCelebration(true);
    }
  }, []);

  return (
    <div className="space-y-4 lg:space-y-6">
      {showMilestoneCelebration ? (
        <CodebaseMilestoneCelebration onDismiss={() => setShowMilestoneCelebration(false)} />
      ) : null}
      <AboutBanner />
      <PageTitle title="鋒兄關於" description="產品更新、系統架構、模組導覽與技術文件中心" />
      <SiteUsageStatsSection />
      <AboutSubpageLinks onNavigate={onNavigate} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 lg:gap-6">
        <div className="lg:col-span-1">
          <DataCard className="sticky top-4 p-4">
            <div className="mb-4 flex items-center justify-between lg:hidden">
              <h3 className="font-bold text-gray-900 dark:text-gray-100">文件導航</h3>
              <Button variant="outline" size="sm" onClick={() => setMobileMenuOpen((value) => !value)} className="lg:hidden">
                <Menu size={16} />
              </Button>
            </div>
            <nav className={`space-y-2 ${mobileMenuOpen ? "block" : "hidden lg:block"}`}>
              {NAV_SECTIONS.map((section) => (
                <button
                  key={section.id}
                  onClick={() => {
                    setActiveSection(section.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-all ${
                    activeSection === section.id
                      ? "bg-slate-900 text-white shadow-lg dark:bg-slate-100 dark:text-slate-900"
                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                  }`}
                >
                  <section.icon size={18} />
                  <span className="font-medium">{section.title}</span>
                  <ChevronRight size={16} className="ml-auto" />
                </button>
              ))}
            </nav>
          </DataCard>
        </div>

        <div className="lg:col-span-3">
          <DataCard className="p-6 lg:p-8">
            <div className="mx-auto max-w-5xl space-y-8">
              {activeSection === "troubleshooting" && <TroubleshootingGuide />}
              {activeSection === "updates" && <UpdatesSection />}
              {activeSection === "system" && <SystemArchitecture />}
              {activeSection === "modules" && <ModulesOverview />}
              {activeSection === "docs" && <TechnicalDocs />}
              {activeSection === "guide" && <UserGuide />}
            </div>
          </DataCard>
        </div>
      </div>
    </div>
  );
}

function CodebaseMilestoneCelebration({ onDismiss }: { onDismiss: () => void }) {
  const sparks = useMemo(
    () => Array.from({ length: 16 }, (_, index) => ({
      id: index,
      side: index % 2 === 0 ? "left" : "right",
      delay: `${(index % 8) * 90}ms`,
      offset: `${12 + (index % 8) * 10}%`,
    })),
    []
  );

  return (
    <section aria-label="十萬行程式碼里程碑" className="relative overflow-hidden rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-amber-950 dark:border-amber-500/45 dark:bg-amber-950/40 dark:text-amber-50">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {sparks.map((spark) => (
          <span
            key={spark.id}
            data-codebase-firecracker
            className={`codebase-firecracker-spark codebase-firecracker-spark--${spark.side}`}
            style={{ animationDelay: spark.delay, top: spark.offset }}
          />
        ))}
      </div>
      <div className="relative flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-200 text-amber-900 dark:bg-amber-400/20 dark:text-amber-100">
          <Sparkles size={21} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold">十萬行程式碼里程碑</h2>
          <p className="mt-1 text-sm leading-6 text-amber-900/85 dark:text-amber-100/85">
            核心原始碼已突破 {CODEBASE_MILESTONE_LINES.toLocaleString()} 行，放鞭炮慶祝一下！
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-amber-900 transition-colors hover:bg-amber-200/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 dark:text-amber-100 dark:hover:bg-amber-200/15"
          aria-label="關閉里程碑慶祝"
        >
          <X size={18} />
        </button>
      </div>
    </section>
  );
}

function AboutSubpageLinks({ onNavigate }: { onNavigate: (moduleId: string) => void }) {
  return (
    <section aria-labelledby="about-subpages-title" className="rounded-2xl border border-[var(--line-soft)] bg-[color:var(--panel-soft)] p-4">
      <div className="mb-3">
        <h2 id="about-subpages-title" className="text-base font-semibold text-[var(--foreground)]">相關服務資訊</h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">這些子頁面只在進入鋒兄關於後顯示。</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {ABOUT_SUBPAGES.map((page) => (
          <button
            key={page.id}
            type="button"
            onClick={() => onNavigate(page.id)}
            className="group flex min-h-14 items-center gap-3 rounded-xl border border-[var(--line-soft)] bg-[color:var(--panel-veil)] px-3 py-2 text-left transition-colors duration-150 hover:border-[var(--line-strong)] hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] dark:hover:bg-white/10"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/15 text-[var(--primary)]">
              <Info size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-[var(--foreground)]">{page.title}</span>
              <span className="block truncate text-xs text-[var(--muted-foreground)]">{page.description}</span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-[var(--muted-foreground)] transition-transform duration-150 group-hover:translate-x-0.5" />
          </button>
        ))}
      </div>
    </section>
  );
}

function AboutBanner() {
  const { githubStats, siteVisit } = useAboutStats();

  const daysLabel = githubStats?.daysSinceCreated != null ? `${githubStats.daysSinceCreated} 天` : "—";
  const daysDetail = githubStats?.createdAt
    ? `參考 GitHub 建立日 ${formatDate(githubStats.createdAt)}`
    : "GitHub 資料載入中或暫時取不到";
  const visitLabel = siteVisit?.exists ? String(siteVisit.count) : "—";
  const visitDetail = siteVisit?.exists
    ? "每個瀏覽器 session 計一次"
    : "尚未在「鋒兄設定」初始化 sitevisit 表";

  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-900 p-6 text-white shadow-xl sm:p-8">
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">Fengbro System Docs</p>
          <h2 className="text-2xl font-bold sm:text-3xl">鋒兄系統文件中心</h2>
          <p className="max-w-2xl text-sm text-slate-200 sm:text-base">
            這裡不是品牌介紹頁，而是專案現況入口。你可以直接看到最近改了什麼、系統怎麼分層、{MODULE_COUNT} 個可導覽葉模組目前各自負責什麼，以及後續實作應該從哪份文件接手。
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <MetricCard label="模組數" value={String(MODULE_COUNT)} detail="日常工作台、工具、子工具" />
          <MetricCard label="文件頁" value="18+" detail="模組文件、使用手冊、架構文件" />
          <MetricCard label="程式碼行數" value={codebaseStats.totalLines.toLocaleString()} detail={`共 ${codebaseStats.totalFiles} 檔，核心原始碼（app / components / hooks / lib…）`} />
          <MetricCard label="技術骰架" value="AI CRUD" detail="統一摘要卡、搜尋、批次操作與 AI 建議" />
          <MetricCard label="網站營運天數" value={daysLabel} detail={daysDetail} />
          <MetricCard label="網站到站次數" value={visitLabel} detail={visitDetail} />
        </div>
      </div>
    </div>
  );
}

function SiteUsageStatsSection() {
  const { menuUsage, loading: statsLoading } = useAboutStats();
  const { banks, loading: banksLoading } = useBanks();
  const {
    currentTotal,
    maxTotal,
    minTotal,
    lastTotal,
    highestAccount,
    delta,
    lastCapturedAt,
  } = useBankSessionCompare(banks);

  const topMenus = (menuUsage?.items || []).slice(0, 5);

  const deltaLabel =
    delta == null
      ? "尚無上次紀錄"
      : delta === 0
        ? "與上次相同"
        : `${delta > 0 ? "比上次多" : "比上次少"} ${formatCurrency(Math.abs(delta))}`;

  const deltaTone =
    delta == null || delta === 0
      ? "text-[var(--muted-foreground)]"
      : delta > 0
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-rose-600 dark:text-rose-400";

  const lastDetail = lastTotal == null
    ? "第一次使用，尚無上次紀錄"
    : `上次 ${formatCurrency(lastTotal)} · ${lastCapturedAt ? formatDate(lastCapturedAt) : ""}`;

  const maxDetail = highestAccount
    ? `目前最高帳戶 ${highestAccount.name} · ${formatCurrency(highestAccount.deposit)}`
    : "尚無銀行資料";

  return (
    <section aria-labelledby="site-usage-stats-title" className="rounded-2xl border border-[var(--line-soft)] bg-[color:var(--panel-soft)] p-4">
      <div className="mb-3">
        <h2 id="site-usage-stats-title" className="text-base font-semibold text-[var(--foreground)]">選單使用與銀行存款統計</h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">選單點擊次數跟銀行存款現況都依實際使用與資料自動更新，尚無資料時先顯示預設狀態。銀行最高／最低存款指「總存款」的歷史極值，會跟上次使用網站的紀錄比對。</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <h3 className="text-sm font-semibold text-[var(--foreground)]">選單使用次數與頻率（Top 5）</h3>
          {statsLoading ? (
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">載入中…</p>
          ) : topMenus.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              尚沒有選單使用紀錄，可能是還沒切換過其他頁面，或 menuusage 表尚未在「鋒兄設定」初始化。
            </p>
          ) : (
            <ol className="mt-2 space-y-1.5">
              {topMenus.map((item, index) => (
                <li
                  key={item.moduleId}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line-soft)] bg-[color:var(--panel-veil)] px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate text-[var(--foreground)]">
                    {index + 1}. {getModuleLabel(item.moduleId)}
                  </span>
                  <span className="shrink-0 text-xs text-[var(--muted-foreground)]">{item.count} 次</span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <StatTile
            label="目前總存款"
            value={banksLoading ? "載入中…" : formatCurrency(currentTotal)}
            detail={lastTotal == null ? "第一次使用，尚無上次紀錄" : `上次 ${formatDate(lastCapturedAt ?? "")}`}
          />
          <StatTile
            label="與上次比對"
            value={banksLoading ? "載入中…" : deltaLabel}
            detail={lastTotal == null ? "—" : `上次 ${formatCurrency(lastTotal)}`}
            valueClassName={banksLoading ? undefined : deltaTone}
          />
          <StatTile
            label="銀行最高存款（總存款歷史高點）"
            value={banksLoading ? "載入中…" : formatCurrency(maxTotal)}
            detail={maxDetail}
          />
          <StatTile
            label="銀行最低存款（總存款歷史低點）"
            value={banksLoading ? "載入中…" : formatCurrency(minTotal)}
            detail={lastDetail}
          />
        </div>
      </div>
    </section>
  );
}

function StatTile({ label, value, detail, valueClassName }: { label: string; value: string; detail: string; valueClassName?: string }) {
  return (
    <div className="rounded-xl border border-[var(--line-soft)] bg-[color:var(--panel-veil)] p-3">
      <div className="text-xs font-medium text-[var(--muted-foreground)]">{label}</div>
      <div className={`mt-1 text-xl font-bold text-[var(--foreground)] ${valueClassName ?? ""}`}>{value}</div>
      <div className="mt-1 text-xs text-[var(--muted-foreground)]">{detail}</div>
    </div>
  );
}

function UpdatesSection() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="更新內容"
        description="這一區只講最近真的變了什麼，方便你快速掌握專案現況。"
      />

      <div className="grid gap-4 md:grid-cols-3">
        <InfoCard title="手機比價上線" body="工具頁已整合 BigGo、地標網通、傑昇通信，開始從單一來源查價走向真正比價。" />
        <InfoCard title="歷史價格落地" body="地標網通價格已能每 7 天寫入 Appwrite，前端也有對應歷史圖表。" />
        <InfoCard title="版本與文件同步" body="關於頁、設定頁與 package.json 已開始同步，減少顯示版本與實際版本不一致的情況。" />
      </div>

      <div className="space-y-4">
        {RELEASE_ITEMS.map((item) => (
          <DataCard key={`${item.date}-${item.title}`} className="border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/40">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{item.date}</div>
                <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">{item.title}</h3>
              </div>
              <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                已更新
              </span>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-slate-700 dark:text-slate-300">
              {item.bullets.map((bullet) => (
                <li key={bullet}>• {bullet}</li>
              ))}
            </ul>
          </DataCard>
        ))}
      </div>
    </div>
  );
}

function SystemArchitecture() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="系統架構"
        description="目前專案的主軸是以 Next.js + Appwrite 建立家庭中控台：日常 CRUD 工作台、工具與子工具。前端逐步收斂成同一套友善 AI CRUD 骨架。"
      />

      <div className="grid gap-4 md:grid-cols-2">
        <DataCard className="p-5">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">前端層 (Frontend Layer)</h3>
          <ul className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <li>• Next.js App Router + React 19 + TypeScript 5.9</li>
            <li>• `components/modules/` 維護日常工作台、工具與子工具頁</li>
            <li>• `components/ui/` 逐步抽出共用工作台元件</li>
            <li>• 目前已導入 `friendly-ai-crud-shell.tsx` 作為第一層共用骨架</li>
          </ul>
        </DataCard>

        <DataCard className="p-5">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">後端與 API 層 (Backend Layer)</h3>
          <ul className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <li>• Next.js API routes 負責 CRUD、檔案操作與 table 初始化</li>
            <li>• 支援 30+ 個 RESTful API 端點與 13 個可初始化 collection</li>
            <li>• 整合 Appwrite Backend Services (Database, Storage, Auth)</li>
            <li>• 手機比價額外接入 BigGo、地標網通、傑昇通信與每週歷史快照</li>
          </ul>
        </DataCard>

        <DataCard className="p-5">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">儲存層 (Storage Layer)</h3>
          <ul className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <li>• Appwrite Database 儲存結構化資料 (採用模組獨立 collection)</li>
            <li>• Appwrite Storage 管理圖片、影片、音樂、文件、播客等媒體</li>
            <li>• 支援多對多關聯與細粒度權限控制</li>
            <li>• 設定頁可動態初始化與檢查 Schema 狀態</li>
          </ul>
        </DataCard>

        <DataCard className="p-5">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">部署與維運層 (Deployment Layer)</h3>
          <ul className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <li>• Vercel Platform 自動化 CI/CD 部署</li>
            <li>• 支援 Docker 容器化生產環境部署</li>
            <li>• 快取機制 (客戶端 + 服務端) 確保首屏載入 &lt; 3 秒</li>
            <li>• 模組化設計確保無限擴充與高並發支援</li>
          </ul>
        </DataCard>
      </div>

      <DataCard className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">程式碼行數統計</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              統計時間：{codebaseStats.snapshotDate}。範圍為核心產品原始碼（`app`、`components`、`hooks`、`lib`、`types`、`scripts`、`tests` 的 `.tsx` / `.ts` / `.js` / `.mjs` / `.css`）。已排除 `node_modules`、`.next`、`.git`、`skills`、agent 工具複本、Markdown 文件與 `public`。
            </p>
          </div>
          <div className="rounded-2xl bg-slate-900 px-4 py-3 text-white dark:bg-slate-100 dark:text-slate-900">
            <div className="text-xs uppercase tracking-[0.2em] opacity-70">Total</div>
            <div className="mt-1 text-2xl font-bold">{codebaseStats.totalLines.toLocaleString()} lines</div>
            <div className="text-xs opacity-70">{codebaseStats.totalFiles} files</div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          {codebaseStats.breakdown.map((item) => (
            <div key={item.label} className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-800 dark:bg-gray-900/40">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{item.label}</div>
              <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{item.lines.toLocaleString()}</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.files} files</div>
            </div>
          ))}
        </div>
      </DataCard>

      <div className="rounded-2xl bg-slate-950 p-5 text-slate-100">
        <pre className="overflow-x-auto text-xs leading-6 text-emerald-300 sm:text-sm">
{`Browser / PWA
  -> Module Pages (${MODULE_COUNT})
  -> Shared UI Shell + Hooks
  -> Next.js API Routes
  -> Appwrite Database / Storage

核心資料流：
搜尋 / 篩選 / 批次操作 / AI 提醒
        ↓
模組 hook 計算摘要與狀態
        ↓
API 與 Appwrite 寫入真實 schema
        ↓
設定頁負責初始化、校正與統計`}
        </pre>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <InfoCard title="設計原則" body="人先做決策，AI 先做整理。AI 不取代表單，只負責分類、提醒、排序與異常發現。" />
        <InfoCard title="UI 原則" body="各模組盡量共用搜尋列、摘要卡、AI 建議、批次工具列與卡片/表格視圖切換。" />
        <InfoCard title="資料原則" body="前端 UI 不能假設 schema，像 subscription 已改成完全依真實欄位收斂。" />
      </div>
    </div>
  );
}

function ModulesOverview() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="功能模組一覽"
        description={`${MODULE_COUNT} 個葉模組裡，日常 15 項共用資料工作台骨架；工具與子工具走 ToolsManagement 與各自 API。`}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {MODULES.map((module) => (
          <DataCard key={module.num} className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white dark:bg-slate-100 dark:text-slate-900">
                {module.num}
              </div>
              <div className="space-y-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{module.category}</div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{module.name}</h3>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">{module.desc}</p>
              </div>
            </div>
          </DataCard>
        ))}
      </div>

      <DataCard className="p-5">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">目前統一中的共通能力</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <BulletList
            title="CRUD 骨架"
            items={[
              "快速新增 + 完整新增",
              "卡片 / 表格雙視圖",
              "列表快改 + 詳細編輯",
              "單筆刪除 + 批次刪除 + 安全提醒",
            ]}
          />
          <BulletList
            title="AI 輔助"
            items={[
              "自動摘要與狀態整理",
              "重複提醒與異常提示",
              "建議下一步與優先順序",
              "批次整理與後續 schema 擴充入口",
            ]}
          />
        </div>
      </DataCard>
    </div>
  );
}

function TechnicalDocs() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="技術文件"
        description="這一區給開發與維護使用。你可以從 docs 看規格，也可以直接對照目前最重要的程式檔案。"
      />

      <DataCard className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
        `docs/` 目錄目前是正式文件入口；`components/modules/` 與 `hooks/` 則反映最新實作狀態。規格若與程式不一致，以實際程式與設定頁驗證結果為準，再回補文件。
      </DataCard>

      <div className="space-y-4">
        {DOC_GROUPS.map((group) => (
          <DataCard key={group.title} className="p-5">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{group.title}</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {group.items.map(([name, desc]) => (
                <div key={name} className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-900/40">
                  <div className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">{name}</div>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{desc}</p>
                </div>
              ))}
            </div>
          </DataCard>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <InfoCard title="文件維護原則" body="先改實作，再補 docs；但對外顯示的關於頁與 docs/15_about.md 要一起更新。" />
        <InfoCard title="高風險區" body="settings、subscription、storage 相關檔案一旦 schema 或 bucket 變動，要同步更新說明。" />
        <InfoCard title="推薦讀法" body="先看 INDEX，再看 About、Settings、對應模組文件，最後再進 hooks 與 API routes。" />
      </div>
    </div>
  );
}

function TroubleshootingGuide() {
  return (
    <div className="space-y-8">
      <SectionHeader
        title="INACCESSIBLE_BOOT_DEVICE（0x7B）障礙排除手冊"
        description="Windows 無法存取開機磁碟時，先確認儲存控制器模式是否為 AHCI；不要在未確認原設定前直接切換模式。"
      />

      <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950 dark:border-amber-500/50 dark:bg-amber-950/35 dark:text-amber-50">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div>
            <h3 className="text-lg font-bold">先保留現況，再做任何變更</h3>
            <p className="mt-2 text-sm leading-6 text-amber-900/90 dark:text-amber-100/90">
              若藍畫面是在調整 BIOS/UEFI、更新 Intel RST/VMD 驅動、換硬碟或複製系統後發生，先拍下目前設定與錯誤畫面。直接把 RAID、RST、VMD 或 IDE 改成 AHCI，可能讓原本可開機的 Windows 立即出現 0x7B。
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="ahci-first-step" className="border-y border-[var(--line-soft)] py-6">
        <div className="flex items-start gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--primary)]">
            <HardDrive size={20} aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 id="ahci-first-step" className="text-xl font-bold text-[var(--foreground)]">第一步：確認是否為 AHCI</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">
              重新開機進入 BIOS/UEFI，尋找 <strong className="font-semibold text-[var(--foreground)]">Storage、SATA Configuration、SATA Mode</strong> 或同義選項，記錄目前顯示的模式。常見值為 AHCI、IDE、RAID、Intel RST 或 VMD；各主機板與筆電品牌的名稱可能不同。
            </p>
          </div>
        </div>
      </section>

      <div className="divide-y divide-[var(--line-soft)] border-y border-[var(--line-soft)]">
        <div className="grid gap-4 py-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <div className="flex items-start gap-3 text-[var(--foreground)]">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            <h3 className="font-bold">已經是 AHCI</h3>
          </div>
          <div className="text-sm leading-6 text-[var(--muted-foreground)]">
            AHCI 不是這次錯誤的直接切換原因。接著確認 BIOS 是否仍看得到系統碟、開機順序是否正確，以及硬碟與主機板連接是否鬆動；若硬體都正常，再進 Windows 修復環境處理啟動修復或最近的驅動變更。
          </div>
        </div>
        <div className="grid gap-4 py-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <div className="flex items-start gap-3 text-[var(--foreground)]">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            <h3 className="font-bold">顯示 RAID、Intel RST、VMD 或 IDE</h3>
          </div>
          <div className="text-sm leading-6 text-[var(--muted-foreground)]">
            先還原為 Windows 原本安裝時使用的模式，再嘗試開機。若要改用 AHCI，請先依設備廠商的遷移步驟讓 Windows 在安全模式載入 AHCI 驅動，完成後才切換 BIOS；不確定原模式時，請不要猜測或反覆切換。
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <h3 className="text-xl font-bold text-[var(--foreground)]">確認後的最小處置順序</h3>
        <ol className="space-y-3 text-sm leading-6 text-[var(--muted-foreground)]">
          <li><strong className="text-[var(--foreground)]">1. 記錄設定：</strong>拍下 AHCI / RAID / RST / VMD 狀態與開機碟資訊。</li>
          <li><strong className="text-[var(--foreground)]">2. 還原最後可開機設定：</strong>若錯誤剛好出現在 BIOS 變更後，先回復那次變更。</li>
          <li><strong className="text-[var(--foreground)]">3. 檢查系統碟：</strong>確認 BIOS 可偵測到磁碟、開機順序與資料線／插槽無異常。</li>
          <li><strong className="text-[var(--foreground)]">4. 再進修復：</strong>在硬體與控制器模式確認無誤後，才使用 Windows 修復環境的啟動修復、系統還原或驅動回復。</li>
        </ol>
      </section>
    </div>
  );
}

function UserGuide() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="完整文件內容"
        description="這一區不是把所有文件全文貼上，而是給你最快的閱讀順序、操作流程和維護清單。"
      />

      <div className="grid gap-4 md:grid-cols-2">
        <DataCard className="p-5">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">第一次接手專案</h3>
          <ol className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <li>1. 看 `docs/INDEX.md` 了解模組與文件對照。</li>
            <li>2. 看 `docs/15_about.md` 掌握最新改版方向。</li>
            <li>3. 到「鋒兄設定」確認 Appwrite 連線與 table 狀態。</li>
            <li>4. 若缺表，直接用設定頁或模組內初始化按鈕建立。</li>
            <li>5. 再進對應模組頁確認 schema、操作流程與實際 UI 是否一致。</li>
          </ol>
        </DataCard>

        <DataCard className="p-5">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">目前最重要的維護流程</h3>
          <ol className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <li>1. 先確認真實 Appwrite schema，不要只看前端欄位。</li>
            <li>2. 調整模組 UI 時，優先維持共用工作台骨架一致。</li>
            <li>3. 涉及 collection id、table 初始化、匯入匯出時，要順手檢查設定頁。</li>
            <li>4. 完成後同步更新對應 docs，至少補 About 與模組文件。</li>
          </ol>
        </DataCard>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <BulletList
          title="使用者視角"
          items={[
            "新增要快",
            "搜尋要強",
            "編輯要輕",
            "刪除要安心",
            "AI 只做整理與提醒",
          ]}
        />
        <BulletList
          title="開發者視角"
          items={[
            "先看真實 schema",
            "避免前後端欄位漂移",
            "抽共用 UI，不重複造輪子",
            "先做可用，再做完整 AI",
            "修改後同步文件",
          ]}
        />
        <BulletList
          title="接下來可做"
          items={[
            "共用 Drawer 編輯器",
            "垃圾桶 / 封存統一化",
            "重複檢查與批次整理深化",
            "更多模組對齊友善 AI CRUD",
            "docs 與 settings 持續同步",
          ]}
        />
      </div>

      <DataCard className="p-5">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">完整文件閱讀順序</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/40">
            <div className="font-semibold text-gray-900 dark:text-gray-100">產品與架構</div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">`00_company_introduction.md` → `15_about.md` → `SYSTEM_ARCHITECTURE.md`</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900/40">
            <div className="font-semibold text-gray-900 dark:text-gray-100">模組與操作</div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">`INDEX.md` → 模組文件 → `USER_GUIDE.md` → 實際模組頁程式碼</p>
          </div>
        </div>
      </DataCard>

      <DataCard className="p-5">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">完整文件清單 (docs 目錄)</h3>
        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
          <div className="grid grid-cols-[1fr_2fr] gap-4 bg-gray-50 p-3 text-sm font-semibold text-gray-900 dark:bg-gray-900/50 dark:text-gray-100 md:grid-cols-[1.5fr_3fr]">
            <div>檔案名稱</div>
            <div>內容說明</div>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {[
              { file: "00_company_introduction.md", desc: "專案緣起與背景說明" },
              { file: "01_home.md", desc: "系統概覽與首頁模組" },
              { file: "02_dashboard.md", desc: "數據統計與儀表板" },
              { file: "03_subscription.md", desc: "訂閱服務與定期支出管理" },
              { file: "04_food.md", desc: "食品庫存、分類與過期管理" },
              { file: "05_notes.md", desc: "多功能筆記系統，支援附件預覽" },
              { file: "06_common_accounts.md", desc: "常用帳號、網站與連結管理" },
              { file: "07_images.md", desc: "圖片上傳、瀏覽與藝廊管理" },
              { file: "08_videos.md", desc: "影片串流播放與快取管理" },
              { file: "09_music.md", desc: "音樂播放、歌詞顯示與專輯管理" },
              { file: "10_documents.md", desc: "綜合文件管理 (PDF/Office/ZIP)" },
              { file: "11_podcast.md", desc: "播客播放與快取管理" },
              { file: "12_bank.md", desc: "銀行帳戶、餘額與財務記錄" },
              { file: "13_routine.md", desc: "例行公事與週期性任務管理" },
              { file: "14_settings.md", desc: "系統配置與資料庫管理" },
              { file: "15_about.md", desc: "更新內容、系統架構與文件中心" },
              { file: "INDEX.md", desc: "文件索引與資料表對照清單" },
              { file: "SYSTEM_ARCHITECTURE.md", desc: "系統架構與技術堆疊說明" },
              { file: "USER_GUIDE.md", desc: "完整使用者指南與開發維護手冊" },
            ].map((doc) => (
              <div key={doc.file} className="grid grid-cols-[1fr_2fr] gap-4 p-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-900/40 md:grid-cols-[1.5fr_3fr]">
                <code className="text-emerald-600 dark:text-emerald-400">{doc.file}</code>
                <span className="text-gray-600 dark:text-gray-400">{doc.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </DataCard>
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-2">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{title}</h2>
      <p className="text-gray-600 dark:text-gray-400">{description}</p>
    </div>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
      <div className="text-xs text-slate-300">{label}</div>
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
      <div className="mt-1 text-xs text-slate-400">{detail}</div>
    </div>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <DataCard className="p-5">
      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-400">{body}</p>
    </DataCard>
  );
}

function BulletList({ title, items }: { title: string; items: string[] }) {
  return (
    <DataCard className="p-5">
      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-300">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </DataCard>
  );
}
