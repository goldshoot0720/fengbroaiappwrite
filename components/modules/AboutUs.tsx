"use client";

import { useState } from "react";
import { BarChart3, Book, ChevronRight, FileText, Info, Menu, Package } from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import { PageTitle } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";

const NAV_SECTIONS = [
  { id: "updates", title: "更新內容", icon: Info },
  { id: "system", title: "系統架構", icon: Package },
  { id: "modules", title: "功能模組", icon: BarChart3 },
  { id: "docs", title: "技術文件", icon: FileText },
  { id: "guide", title: "完整文件", icon: Book },
] as const;

const MODULES = [
  { num: 1, name: "鋒兄首頁", category: "入口", desc: "系統總覽與 15 個模組快速入口" },
  { num: 2, name: "鋒兄儀表", category: "總覽", desc: "跨模組統計、異常提醒與摘要卡" },
  { num: 3, name: "鋒兄訂閱", category: "生活", desc: "訂閱、扣款日、CSV 匯入匯出與 AI 整理提醒" },
  { num: 4, name: "鋒兄食品", category: "生活", desc: "庫存、到期管理、快速新增與批次清理" },
  { num: 5, name: "鋒兄筆記", category: "知識", desc: "快速筆記、模板、AI 摘要與釘選工作台" },
  { num: 6, name: "鋒兄常用", category: "入口", desc: "常用站點、複製、置頂與最近使用控制台" },
  { num: 7, name: "鋒兄圖片", category: "媒體", desc: "圖片管理、標籤整理與工作台摘要" },
  { num: 8, name: "鋒兄影片", category: "媒體", desc: "影片播放、封面管理與工作台骨架" },
  { num: 9, name: "鋒兄音樂", category: "媒體", desc: "音樂播放、歌詞、整理摘要與媒體控制" },
  { num: 10, name: "鋒兄文件", category: "知識", desc: "文件預覽、分類、匯入匯出與技術內容整理" },
  { num: 11, name: "鋒兄播客", category: "媒體", desc: "播客節目、集數與摘要式管理" },
  { num: 12, name: "鋒兄銀行", category: "財務", desc: "帳戶資料、餘額、異常提醒與整理入口" },
  { num: 13, name: "鋒兄例行", category: "任務", desc: "例行事項、排程節奏與週期追蹤" },
  { num: 14, name: "鋒兄設定", category: "維運", desc: "Appwrite 設定、Table 初始化、資料統計與 system config" },
  { num: 15, name: "鋒兄關於", category: "文件", desc: "更新內容、架構說明、版本資訊與文件中心" },
];

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

const CODEBASE_STATS = {
  snapshotDate: "2026-07-12",
  totalFiles: 208,
  totalLines: 70741,
  breakdown: [
    { label: "TSX", files: 66, lines: 43714 },
    { label: "TypeScript", files: 47, lines: 7957 },
    { label: "JavaScript", files: 51, lines: 4954 },
    { label: "JSON", files: 7, lines: 10714 },
    { label: "Markdown", files: 33, lines: 2793 },
    { label: "CSS", files: 1, lines: 286 },
    { label: "HTML", files: 3, lines: 323 },
  ],
};

export default function AboutUs() {
  const [activeSection, setActiveSection] = useState<string>("updates");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="space-y-4 lg:space-y-6">
      <AboutBanner />
      <PageTitle title="鋒兄關於" description="產品更新、系統架構、模組導覽與技術文件中心" />

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

function AboutBanner() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-900 p-6 text-white shadow-xl sm:p-8">
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">Fengbro System Docs</p>
          <h2 className="text-2xl font-bold sm:text-3xl">鋒兄系統文件中心</h2>
          <p className="max-w-2xl text-sm text-slate-200 sm:text-base">
            這裡不是品牌介紹頁，而是專案現況入口。你可以直接看到最近改了什麼、系統怎麼分層、15 個模組目前各自負責什麼，以及後續實作應該從哪份文件接手。
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="模組數" value="15" detail="入口、生活、知識、媒體、財務、維運" />
          <MetricCard label="文件頁" value="18+" detail="模組文件、使用手冊、架構文件" />
          <MetricCard label="程式碼行數" value={CODEBASE_STATS.totalLines.toLocaleString()} detail={`共 ${CODEBASE_STATS.totalFiles} 檔，已排除 node_modules / .next`} />
          <MetricCard label="技術骨架" value="AI CRUD" detail="統一摘要卡、搜尋、批次操作與 AI 建議" />
        </div>
      </div>
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
        description="目前專案的主軸是以 Next.js + Appwrite 建立 15 模組的個人資料工作台，前端逐步收斂成同一套友善 AI CRUD 骨架。"
      />

      <div className="grid gap-4 md:grid-cols-2">
        <DataCard className="p-5">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">前端層</h3>
          <ul className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <li>• Next.js App Router + React 19 + TypeScript</li>
            <li>• `components/modules/` 內維護 15 個主模組頁</li>
            <li>• `components/ui/` 逐步抽出共用工作台元件</li>
            <li>• 目前已導入 `friendly-ai-crud-shell.tsx` 作為第一層共用骨架</li>
          </ul>
        </DataCard>

        <DataCard className="p-5">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">資料與 API 層</h3>
          <ul className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <li>• Next.js API routes 負責 CRUD、檔案操作與 table 初始化</li>
            <li>• Appwrite Database 儲存結構化資料</li>
            <li>• Appwrite Storage 管理圖片、影片、音樂、文件、播客等媒體</li>
            <li>• schema 目前採模組獨立 collection，設定頁可初始化與檢查狀態</li>
            <li>• 手機比價額外接入 BigGo、地標網通、傑昇通信與每週歷史快照</li>
          </ul>
        </DataCard>
      </div>

      <DataCard className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">程式碼行數統計</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              統計時間：{CODEBASE_STATS.snapshotDate}。已排除 `node_modules`、`.next`、`.git`、`dist`、`build`、`coverage`、`out`。
            </p>
          </div>
          <div className="rounded-2xl bg-slate-900 px-4 py-3 text-white dark:bg-slate-100 dark:text-slate-900">
            <div className="text-xs uppercase tracking-[0.2em] opacity-70">Total</div>
            <div className="mt-1 text-2xl font-bold">{CODEBASE_STATS.totalLines.toLocaleString()} lines</div>
            <div className="text-xs opacity-70">{CODEBASE_STATS.totalFiles} files</div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          {CODEBASE_STATS.breakdown.map((item) => (
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
  -> Module Pages (15)
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
        description="15 個模組不是 15 個獨立表單頁，而是同一套資料工作台在不同資料型別上的實作。"
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
