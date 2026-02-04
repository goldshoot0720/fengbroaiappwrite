"use client";

import { useState } from "react";
import { Package, BarChart3, Info, Phone, Book, FileText, Menu, ChevronRight } from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import { PageTitle } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";

export default function AboutUs() {
  const [activeSection, setActiveSection] = useState<string>("company");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const sections = [
    { id: "company", title: "公司簡介", icon: Info },
    { id: "system", title: "系統架構", icon: Package },
    { id: "modules", title: "功能模組", icon: BarChart3 },
    { id: "docs", title: "技術文件", icon: FileText },
    { id: "guide", title: "使用手冊", icon: Book },
  ];

  return (
    <div className="space-y-4 lg:space-y-6">
      <CopyrightBanner />
      
      <PageTitle title="鋒兄關於" description="鋒兄塗哥公關資訊 — 完整系統文件" />
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
        {/* 側邊欄導航 */}
        <div className="lg:col-span-1">
          <DataCard className="p-4 sticky top-4">
            <div className="flex items-center justify-between lg:hidden mb-4">
              <h3 className="font-bold text-gray-900 dark:text-gray-100">導航選單</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden"
              >
                <Menu size={16} />
              </Button>
            </div>
            <nav className={`space-y-2 ${mobileMenuOpen ? 'block' : 'hidden lg:block'}`}>
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => {
                    setActiveSection(section.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    activeSection === section.id
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
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

        {/* 主要內容區域 */}
        <div className="lg:col-span-3">
          <DataCard className="p-6 lg:p-8">
            <div className="max-w-4xl mx-auto space-y-8">
              {activeSection === "company" && <CompanySection />}
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

// 版權橫幅
function CopyrightBanner() {
  return (
    <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 p-4 sm:p-6 lg:p-8 rounded-xl sm:rounded-2xl text-white shadow-lg">
      <div className="text-center space-y-2">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-wide">鋒兄塗哥公關資訊</h2>
        <div className="text-sm sm:text-base opacity-90">© 版權所有 2025～2125</div>
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-xs sm:text-sm opacity-80">
          <span>前端使用 React (Next.js)</span>
          <span className="hidden sm:inline text-white/50">|</span>
          <span>後端使用 Appwrite</span>
          <span className="hidden sm:inline text-white/50">|</span>
          <span>網頁存放於 Vercel</span>
        </div>
      </div>
    </div>
  );
}

// 公司標誌與介紹
function CompanyHeader() {
  return (
    <div className="text-center">
      <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
        <span className="text-white font-bold text-3xl">鋒塗</span>
      </div>
      
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">鋒兄塗哥公關資訊</h2>
      <p className="text-gray-600 dark:text-gray-300 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
        我們是專業的公關團隊，致力於為客戶提供最優質的公關服務和智能管理解決方案。
        透過創新技術和專業服務，幫助企業和個人實現更高效的管理目標。
      </p>
    </div>
  );
}

// 團隊成員
function TeamMembers() {
  const members = [
    {
      name: "鋒兄",
      role: "技術總監 & 創新領袖",
      description: "專精於系統架構設計與技術創新，擁有豐富的軟體開發經驗，致力於打造用戶友好的智能管理解決方案。",
      gradient: "from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20",
      avatarGradient: "from-blue-500 to-blue-600",
      roleColor: "text-blue-600 dark:text-blue-400",
    },
    {
      name: "塗哥",
      role: "公關總監 & 策略專家",
      description: "擅長品牌策略規劃與公關活動執行，具備敏銳的市場洞察力，專注於建立企業與客戶之間的良好關係。",
      gradient: "from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20",
      avatarGradient: "from-purple-500 to-purple-600",
      roleColor: "text-purple-600 dark:text-purple-400",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
      {members.map((member) => (
        <div key={member.name} className={`bg-gradient-to-br ${member.gradient} rounded-2xl p-6 text-center`}>
          <div className={`w-20 h-20 bg-gradient-to-r ${member.avatarGradient} rounded-full flex items-center justify-center mx-auto mb-4`}>
            <span className="text-white font-bold text-xl">{member.name[0]}</span>
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">{member.name}</h3>
          <p className={`${member.roleColor} font-medium mb-3`}>{member.role}</p>
          <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">{member.description}</p>
        </div>
      ))}
    </div>
  );
}

// 服務特色
function ServiceFeatures() {
  const features = [
    { icon: Package, title: "智能管理", description: "提供全方位的智能管理解決方案，讓生活更有序", gradient: "from-green-400 to-green-500" },
    { icon: BarChart3, title: "數據洞察", description: "深度數據分析，提供精準的決策支援", gradient: "from-orange-400 to-orange-500" },
    { icon: Info, title: "專業服務", description: "24/7 專業客服支援，確保最佳使用體驗", gradient: "from-pink-400 to-pink-500" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
      {features.map((feature) => (
        <div key={feature.title} className="text-center">
          <div className={`w-16 h-16 bg-gradient-to-r ${feature.gradient} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
            <feature.icon className="text-white" size={28} />
          </div>
          <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">{feature.title}</h3>
          <p className="text-gray-600 dark:text-gray-300 text-sm">{feature.description}</p>
        </div>
      ))}
    </div>
  );
}

// 聯絡資訊
function ContactInfo() {
  const contacts = [
    { icon: Phone, title: "業務洽詢", value: "+886-2-1234-5678", color: "bg-blue-500" },
    { icon: "📧", title: "電子郵件", value: "contact@fengtuge.com", color: "bg-green-500" },
    { icon: "🌐", title: "官方網站", value: "www.fengtuge.com", color: "bg-purple-500" },
    { icon: "📍", title: "公司地址", value: "台北市信義區信義路五段7號", color: "bg-orange-500" },
  ];

  return (
    <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-2xl p-6 sm:p-8">
      <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6 text-center">聯絡我們</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {contacts.map((contact) => (
          <div key={contact.title} className="flex items-center gap-3">
            <div className={`w-10 h-10 ${contact.color} rounded-xl flex items-center justify-center`}>
              {typeof contact.icon === "string" ? (
                <span className="text-white text-sm">{contact.icon}</span>
              ) : (
                <contact.icon className="text-white" size={20} />
              )}
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">{contact.title}</p>
              <p className="text-gray-600 dark:text-gray-300 text-sm">{contact.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 版權資訊
function Copyright() {
  return (
    <div className="text-center border-t border-gray-200 dark:border-gray-700 pt-8">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
        <h3 className="text-2xl font-bold mb-4">鋒兄管理資訊系統</h3>
      </div>
      <div className="space-y-2 text-gray-600 dark:text-gray-300">
        <p className="text-lg font-medium">鋒兄塗哥公關資訊有限公司</p>
        <p className="flex items-center justify-center gap-2">
          <span className="text-xl">©</span>
          <span className="font-medium">2025 ～ 2125</span>
          <span>版權所有</span>
        </p>
        <p className="text-sm">Feng & Tu Public Relations Information Co., Ltd.</p>
        <p className="text-sm">All Rights Reserved</p>
      </div>
      
      <div className="mt-6 flex flex-wrap justify-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
        <span>鋒兄管理資訊系統 v2.0.0</span>
        <span className="hidden sm:inline">•</span>
        <span>Next.js + TypeScript</span>
        <span className="hidden sm:inline">•</span>
        <span>Made with ❤️ in Taiwan</span>
      </div>
    </div>
  );
}

// 公司簡介區塊
function CompanySection() {
  return (
    <div className="space-y-8">
      <CompanyHeader />
      <TeamMembers />
      
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl p-6 sm:p-8">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">🏋️ 員工福利</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-bold text-lg text-gray-900 dark:text-gray-100 mb-3">公司環境設施</h4>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              <li>🏊 <strong>游泳池</strong> — 員工專屬休閒空間</li>
              <li>🏋️ <strong>健身房</strong> — 完整健身器材與設備</li>
              <li>☕ <strong>咖啡吧</strong> — 免費咖啡與飲品供應</li>
              <li>🍰 <strong>下午茶</strong> — 每日下午茶點心供應</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold text-lg text-gray-900 dark:text-gray-100 mb-3">工作制度</h4>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              <li>⏰ <strong>工作時數</strong> — 每日 8 小時</li>
              <li>❌ <strong>打卡制度</strong> — 不用打卡</li>
              <li>❌ <strong>加班制度</strong> — 不用加班</li>
              <li>💰 <strong>年終獎金</strong> — 4.6 個月</li>
            </ul>
          </div>
        </div>
      </div>
      
      <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-2xl p-6 sm:p-8">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">📈 公司規模</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">市值</p>
            <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">一兆總統</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">年產利</p>
            <p className="text-3xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">百億市長</p>
          </div>
        </div>
      </div>
      
      <ServiceFeatures />
      <ContactInfo />
      <Copyright />
    </div>
  );
}

// 系統架構區塊
function SystemArchitecture() {
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">系統架構</h2>
      
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-2xl p-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">💻 技術規格</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-gray-700 dark:text-gray-300"><strong>版本</strong>: v1.0.0</p>
            <p className="text-gray-700 dark:text-gray-300"><strong>技術框架</strong>: Next.js 16 / React 19 / Appwrite</p>
            <p className="text-gray-700 dark:text-gray-300"><strong>程式碼規模</strong>: ~28,244 行</p>
          </div>
          <div className="space-y-2">
            <p className="text-gray-700 dark:text-gray-300"><strong>TypeScript</strong>: 23,997 行 (84 檔案)</p>
            <p className="text-gray-700 dark:text-gray-300"><strong>JavaScript</strong>: 3,928 行 (36 檔案)</p>
            <p className="text-gray-700 dark:text-gray-300"><strong>最後更新</strong>: 2026-02-04</p>
          </div>
        </div>
      </div>
      
      <div className="bg-gray-900 dark:bg-gray-950 rounded-2xl p-6 overflow-x-auto">
        <pre className="text-green-400 text-xs sm:text-sm font-mono">
{`┌────────────────────────────────────────────────────┐
│                    瀏覽器前端                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ 模組頁面  │  │ UI 元件   │  │ React Hooks     │  │
│  │ (15 個)   │  │ (34 個)   │  │ (20 個)         │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
│                       │                              │
│              ┌────────┴────────┐                     │
│              │  IndexedDB 快取  │                     │
│              │  (離線瀏覽支援)   │                    │
│              └─────────────────┘                     │
└────────────────────────┬───────────────────────────┘
                         │ HTTP API
┌────────────────────────┴───────────────────────────┐
│                  Next.js API 路由                    │
│              (24 個 API 端點群組)                     │
└────────────────────────┬───────────────────────────┘
                         │ Appwrite SDK
┌────────────────────────┴───────────────────────────┐
│                 Appwrite 後端服務                    │
│  ┌──────────┐  ┌──────────────┐                     │
│  │ Database │  │   Storage    │                     │
│  │ (11 表)   │  │ (檔案儲存)   │                    │
│  └──────────┘  └──────────────┘                     │
└────────────────────────────────────────────────────┘`}
        </pre>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6">
          <h4 className="font-bold text-lg text-blue-900 dark:text-blue-100 mb-3">✨ 核心特色</h4>
          <ul className="space-y-2 text-gray-700 dark:text-gray-300 text-sm">
            <li>✅ 三種主題模式：亮色 / 暗色 / 跟隨系統</li>
            <li>✅ 響應式設計：支援手機、平板、桌面</li>
            <li>✅ 離線功能：媒體快取與離線瀏覽</li>
            <li>✅ PWA 支援：可安裝為手機 App</li>
          </ul>
        </div>
        
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-6">
          <h4 className="font-bold text-lg text-purple-900 dark:text-purple-100 mb-3">🚀 技術優勢</h4>
          <ul className="space-y-2 text-gray-700 dark:text-gray-300 text-sm">
            <li>✅ AI 自動化：智慧化資料處理</li>
            <li>✅ 雲端整合：Appwrite 後端服務</li>
            <li>✅ 動態配置：免重新部署即可切換帳號</li>
            <li>✅ 高效快取：IndexedDB 離線儲存</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// 功能模組區塊
function ModulesOverview() {
  const modules = [
    { num: 1, name: "鋒兄首頁", desc: "系統概覽與快速入口" },
    { num: 2, name: "鋒兄儀表", desc: "詳細數據統計與分析圖表" },
    { num: 3, name: "鋒兄訂閱", desc: "訂閱服務與定期支出管理" },
    { num: 4, name: "鋒兄食品", desc: "食品庫存、分類與過期管理" },
    { num: 5, name: "鋒兄筆記", desc: "多功能筆記系統，支援附件與預覽" },
    { num: 6, name: "鋒兄常用", desc: "常用帳號、網站與連結管理" },
    { num: 7, name: "鋒兄圖片", desc: "圖片上傳、瀏覽與藝廊管理" },
    { num: 8, name: "鋒兄影片", desc: "影片播放與簡介管理" },
    { num: 9, name: "鋒兄音樂", desc: "音樂播放、歌詞顯示與專輯管理" },
    { num: 10, name: "鋒兄文件", desc: "綜合文件管理（PDF、Office、ZIP）" },
    { num: 11, name: "鋒兄播客", desc: "播客音訊播放與進度管理" },
    { num: 12, name: "鋒兄銀行", desc: "銀行帳戶、餘額與財務記錄" },
    { num: 13, name: "鋒兄例行", desc: "例行公事、週期性任務管理" },
    { num: 14, name: "鋒兄設定", desc: "系統配置、API 設定與主題切換" },
    { num: 15, name: "鋒兄關於", desc: "系統版本與專案資訊" },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">功能模組一覽</h2>
      
      <p className="text-gray-600 dark:text-gray-400">
        鋒兄AI Appwrite 管理系統包含 15 大功能模組，幫助您集中管理日常生活中的各種資料。
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((module) => (
          <div
            key={module.num}
            className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-xl p-4 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">{module.num}</span>
              </div>
              <div>
                <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-1">{module.name}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">{module.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 技術文件區塊
function TechnicalDocs() {
  const docs = [
    { name: "INDEX.md", desc: "選單結構索引" },
    { name: "USER_GUIDE.md", desc: "完整使用者教學手冊 (600+ 行)" },
    { name: "00_company_introduction.md", desc: "公司簡介" },
    { name: "01_home.md", desc: "首頁說明" },
    { name: "02_dashboard.md", desc: "儀表板說明" },
    { name: "03_subscription.md", desc: "訂閱管理說明" },
    { name: "04_food.md", desc: "食品管理說明" },
    { name: "05_notes.md", desc: "筆記管理說明" },
    { name: "06_common_accounts.md", desc: "常用帳號說明" },
    { name: "07_images.md", desc: "圖片管理說明" },
    { name: "08_videos.md", desc: "影片管理說明" },
    { name: "09_music.md", desc: "音樂管理說明" },
    { name: "10_documents.md", desc: "文件管理說明" },
    { name: "11_podcast.md", desc: "播客管理說明" },
    { name: "12_bank.md", desc: "銀行管理說明" },
    { name: "13_routine.md", desc: "例行管理說明" },
    { name: "14_settings.md", desc: "系統設定說明" },
    { name: "15_about.md", desc: "關於系統說明" },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">技術文件</h2>
      
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          📚 完整的技術文件位於 <code className="bg-yellow-100 dark:bg-yellow-900 px-2 py-1 rounded">\fengbroaiappwrite-main\docs</code> 目錄
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {docs.map((doc) => (
          <div key={doc.name} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-blue-500 flex-shrink-0 mt-1" />
              <div>
                <h4 className="font-mono text-sm text-gray-900 dark:text-gray-100 mb-1">{doc.name}</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">{doc.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 使用手冊區塊
function UserGuide() {
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">完整文件內容</h2>
      
      <div className="prose dark:prose-invert max-w-none space-y-8">
        {/* USER_GUIDE.md 內容 */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl p-6">
          <div className="space-y-4">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">鋒兄AI Appwrite 管理系統 — 使用者教學手冊</h1>
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <p><strong>版本</strong>: v1.0.0</p>
              <p><strong>技術框架</strong>: Next.js 16 / React 19 / Appwrite</p>
              <p><strong>最後更新</strong>: 2026-02-04</p>
            </div>
          </div>
        </div>

        {/* 1. 系統簡介 */}
        <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">1. 系統簡介</h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            <strong>鋒兄AI Appwrite</strong> 是一套個人資訊管理系統，幫助您集中管理日常生活中的各種資料。
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">功能模組</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">用途</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                <tr><td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">食品管理</td><td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">追蹤食品庫存與到期日，避免浪費</td></tr>
                <tr><td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">訂閱管理</td><td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">管理各種訂閱服務與付費週期</td></tr>
                <tr><td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">筆記管理</td><td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">撰寫、整理個人筆記與文章</td></tr>
                <tr><td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">常用帳號</td><td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">收藏常用網站連結與備忘</td></tr>
                <tr><td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">圖片管理</td><td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">瀏覽與管理圖片庫</td></tr>
                <tr><td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">影片管理</td><td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">管理與播放影片收藏</td></tr>
                <tr><td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">音樂管理</td><td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">音樂庫管理與播放</td></tr>
                <tr><td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">播客管理</td><td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">管理 Podcast 內容</td></tr>
                <tr><td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">文件管理</td><td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">上傳與管理各類文件</td></tr>
                <tr><td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">銀行管理</td><td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">記錄銀行帳戶與存款資訊</td></tr>
                <tr><td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">例行管理</td><td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">管理日常例行事務</td></tr>
              </tbody>
            </table>
          </div>
          <p className="text-gray-700 dark:text-gray-300 mt-4">
            系統支援 <strong>亮色 / 暗色 / 跟隨系統</strong> 三種主題模式，並提供 <strong>手機、平板、桌面</strong> 三種裝置的響應式佈局。
          </p>
        </section>

        {/* 2. 快速開始 */}
        <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">2. 快速開始</h2>
          
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3 mt-6">2.1 環境需求</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
            <li><strong>Node.js</strong>: 18 以上版本</li>
            <li><strong>瀏覽器</strong>: Chrome、Firefox、Safari、Edge（現代瀏覽器）</li>
            <li><strong>Appwrite</strong>: 需要一個 Appwrite 雲端或自架帳號</li>
          </ul>

          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3 mt-6">2.2 安裝步驟</h3>
          <div className="bg-gray-900 dark:bg-gray-950 rounded-xl p-4 overflow-x-auto mb-4">
            <pre className="text-green-400 text-sm font-mono">{`# 1. 安裝套件
npm install

# 2. 複製環境設定檔
cp .env.example .env.local

# 3. 編輯 .env.local，填入你的 Appwrite 設定

# 4. 啟動開發伺服器
npm run dev`}</pre>
          </div>
          <p className="text-gray-700 dark:text-gray-300">
            啟動後在瀏覽器開啟 <code className="bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">http://localhost:3000</code> 即可使用。
          </p>

          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3 mt-6">2.3 首次使用：初始化資料庫</h3>
          <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
            <li>點擊左側選單的 <strong>「鋒兄設定」</strong></li>
            <li>找到 <strong>「資料庫欄位統計」</strong> 區塊</li>
            <li>紅色標示的表格代表尚未建立</li>
            <li>點擊 <strong>「一鍵建立所有缺失 Table」</strong> 按鈕</li>
            <li>等待所有表格建立完成（會顯示進度）</li>
            <li>建立完成後，回到其他模組即可開始使用</li>
          </ol>
        </section>

        {/* 各模組說明 - 簡化版本 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModuleDocCard 
            title="3. 首頁與儀表板"
            content={
              <div className="space-y-2 text-sm">
                <p><strong>首頁（鋒兄首頁）</strong></p>
                <p>首頁顯示系統標題資訊，是進入系統後的預設畫面。</p>
                <p><strong>儀表板（鋒兄儀表）</strong></p>
                <p>儀表板彙整了所有模組的關鍵統計數據，讓你一眼掌握重要資訊。</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>食品區塊：總數、正常、7天內到期、30天內到期、已過期</li>
                  <li>訂閱區塊：總數、3天內到期、7天內到期、已逾期</li>
                  <li>財務概覽：年費總計、月費總計、下月預估費、銀行總存款</li>
                  <li>多媒體儲存：圖片、影片、音樂、文件、播客的數量與佔用空間</li>
                </ul>
              </div>
            }
          />

          <ModuleDocCard 
            title="4. 食品管理"
            content={
              <div className="space-y-2 text-sm">
                <p>食品管理模組幫助你追蹤家中食品的庫存與到期日期。</p>
                <p><strong>到期狀態說明：</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>🟢 正常：距離到期日超過 7 天</li>
                  <li>🟡 即將到期：距離到期日在 3-7 天內</li>
                  <li>🟠 緊急：距離到期日在 3 天內</li>
                  <li>🔴 已過期：已超過到期日</li>
                </ul>
              </div>
            }
          />

          <ModuleDocCard 
            title="5. 訂閱管理"
            content={
              <div className="space-y-2 text-sm">
                <p>管理你的各種付費訂閱服務，追蹤續費日期與費用。</p>
                <p><strong>幣別換算：</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>USD（美元）：1 USD = 35 TWD</li>
                  <li>EUR（歐元）：1 EUR = 40 TWD</li>
                  <li>JPY（日圓）：1 JPY = 0.35 TWD</li>
                  <li>CNY（人民幣）：1 CNY = 4.5 TWD</li>
                  <li>HKD（港幣）：1 HKD = 4 TWD</li>
                </ul>
                <p className="text-xs text-gray-500">注意：匯率為固定值，非即時匯率，僅供預估參考。</p>
              </div>
            }
          />

          <ModuleDocCard 
            title="6. 筆記管理"
            content={
              <div className="space-y-2 text-sm">
                <p>筆記管理模組讓你撰寫與整理個人筆記和文章。</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>標題、內容、日期</li>
                  <li>附件連結：最多可附加 3 個外部網址</li>
                  <li>附件檔案：最多可附加 3 個檔案</li>
                  <li>筆記預設依 <strong>日期由新到舊</strong> 排列</li>
                </ul>
              </div>
            }
          />

          <ModuleDocCard 
            title="7-11. 多媒體模組"
            content={
              <div className="space-y-2 text-sm">
                <p><strong>7. 常用帳號</strong>：最多 37 個常用網站連結、Favicon 自動顯示</p>
                <p><strong>8. 圖片管理</strong>：上傳、瀏覽、分類、離線快取 (500MB)</p>
                <p><strong>9. 影片管理</strong>：播放佇列、串流播放、離線快取</p>
                <p><strong>10. 音樂管理</strong>：歌詞顯示、播放佇列、離線快取</p>
                <p><strong>11. 播客管理</strong>：音訊/視訊 Podcast、離線快取</p>
              </div>
            }
          />

          <ModuleDocCard 
            title="12. 文件管理"
            content={
              <div className="space-y-2 text-sm">
                <p>上傳與管理各類文件。</p>
                <p><strong>支援的檔案格式：</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>文件：PDF、DOC、DOCX</li>
                  <li>試算表：XLS、XLSX</li>
                  <li>簡報：PPT、PPTX</li>
                  <li>文字：TXT、MD、JSON、XML、HTML、CSS、JS</li>
                  <li>壓縮：ZIP</li>
                  <li>圖片：JPG、PNG、GIF、WEBP</li>
                </ul>
                <p>支援 ZIP 匯出、CSV 匯出、ZIP 匯入</p>
              </div>
            }
          />

          <ModuleDocCard 
            title="13-14. 銀行與例行"
            content={
              <div className="space-y-2 text-sm">
                <p><strong>13. 銀行管理</strong></p>
                <p>記錄與追蹤銀行帳戶資訊：銀行名稱、存款金額、網站、地址、提款資訊、轉帳資訊、卡片、帳號。</p>
                <p><strong>14. 例行管理</strong></p>
                <p>管理日常的例行事務與定期任務：最近例行之一、之二、之三，支援日期遞移功能。</p>
              </div>
            }
          />

          <ModuleDocCard 
            title="15. 系統設定"
            content={
              <div className="space-y-2 text-sm">
                <p><strong>Appwrite 帳號切換</strong>：支援動態切換不同的 Appwrite 後端</p>
                <p><strong>資料庫管理</strong>：一鍵建立表格、個別重建、結構修正</p>
                <p><strong>儲存空間管理</strong>：孤立檔案檢測、批次清除、分類統計</p>
                <p><strong>主題切換</strong>：☀ 亮色模式 / 🌙 暗色模式 / 💻 跟隨系統</p>
              </div>
            }
          />
        </div>

        {/* 常見問題 */}
        <section className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">16. 常見問題</h2>
          <div className="space-y-4 text-sm">
            <FAQItem 
              q="Q1: 開啟模組時顯示「Table xxx 不存在」"
              a="解決方式：到「鋒兄設定」→「資料庫欄位統計」，點擊「一鍵建立所有缺失 Table」建立缺失的資料表。"
            />
            <FAQItem 
              q="Q2: 資料沒有更新 / 顯示舊資料"
              a="解決方式：1) 嘗試重新整理瀏覽器頁面（Ctrl+F5 / Cmd+Shift+R） 2) 如果仍有問題，到「鋒兄設定」切換帳號再切回來，會強制清除快取。"
            />
            <FAQItem 
              q="Q3: 影片/音樂無法播放"
              a="可能原因與解決方式：1) 確認檔案已上傳到 Appwrite Storage 2) 確認 Appwrite Bucket 的權限設定為公開讀取 3) 嘗試清除瀏覽器快取後重新載入 4) 確認網路連線正常。"
            />
            <FAQItem 
              q="Q4: 檔案上傳失敗"
              a="可能原因：1) Appwrite 免費方案有頻寬限制，超過後會暫時無法上傳 2) 確認 API Key 有正確的寫入權限 3) 確認 Bucket ID 設定正確。"
            />
            <FAQItem 
              q="Q5: 如何備份資料？"
              a="目前資料儲存在 Appwrite 雲端，可透過 Appwrite Console 進行資料備份。文件管理模組支援 ZIP 匯出功能。"
            />
            <FAQItem 
              q="Q6: 支援哪些瀏覽器？"
              a="支援所有現代瀏覽器：Google Chrome 90+、Mozilla Firefox 90+、Apple Safari 14+、Microsoft Edge 90+。"
            />
            <FAQItem 
              q="Q7: 可以安裝為手機 App 嗎？"
              a="系統為 PWA（漸進式網頁應用），可以透過瀏覽器的「加到主畫面」功能安裝到手機：iOS：Safari → 分享 → 加入主畫面 / Android：Chrome → 選單 → 安裝應用程式。"
            />
            <FAQItem 
              q="Q8: 離線可以使用嗎？"
              a="部分功能支援離線使用：已快取的影片、音樂、圖片、文件可離線瀏覽/播放，新增/修改/刪除等操作需要網路連線。"
            />
            <FAQItem 
              q="Q9: 匯率不正確怎麼辦？"
              a="系統使用固定匯率作為預估參考。如需精確匯率，請以實際銀行匯率為準。目前匯率設定為硬編碼，需修改程式碼才能更新。"
            />
            <FAQItem 
              q="Q10: 儲存空間滿了怎麼辦？"
              a="1) 到「鋒兄設定」檢查「孤立檔案」並清除 2) 刪除不需要的影片、音樂、圖片等媒體檔案 3) 清除瀏覽器的離線快取（每種媒體類型上限 500MB） 4) 考慮升級 Appwrite 方案以獲得更多儲存空間。"
            />
          </div>
        </section>
      </div>
    </div>
  );
}

// 輔助元件
function ModuleDocCard({ title, content }: { title: string; content: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">{title}</h3>
      <div className="text-gray-700 dark:text-gray-300">{content}</div>
    </div>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  return (
    <div className="border-l-4 border-orange-400 pl-4">
      <p className="font-bold text-gray-900 dark:text-gray-100 mb-1">{q}</p>
      <p className="text-gray-700 dark:text-gray-300">{a}</p>
    </div>
  );
}
