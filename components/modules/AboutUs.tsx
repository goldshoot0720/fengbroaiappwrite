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
    { num: 4, name: "鋒允食品", desc: "食品庫存、分類與過期管理" },
    { num: 5, name: "鋒兄筆記", desc: "多功能筆記系統，支援附件與預覽" },
    { num: 6, name: "鋒允常用", desc: "常用帳號、網站與連結管理" },
    { num: 7, name: "鋒允圖片", desc: "圖片上傳、瀏覽與藝廊管理" },
    { num: 8, name: "鋒允影片", desc: "影片播放與簡介管理" },
    { num: 9, name: "鋒允音樂", desc: "音樂播放、歌詞顯示與專輯管理" },
    { num: 10, name: "鋒允文件", desc: "綜合文件管理（PDF、Office、ZIP）" },
    { num: 11, name: "鋒允播客", desc: "播客音訊播放與進度管理" },
    { num: 12, name: "鋒允銀行", desc: "銀行帳戶、餘額與財務記錄" },
    { num: 13, name: "鋒允例行", desc: "例行公事、週期性任務管理" },
    { num: 14, name: "鋒允設定", desc: "系統配置、API 設定與主題切換" },
    { num: 15, name: "鋒允關於", desc: "系統版本與專案資訊" },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">功能模組一覽</h2>
      
      <p className="text-gray-600 dark:text-gray-400">
        鋒允AI Appwrite 管理系統包含 15 大功能模組，幫助您集中管理日常生活中的各種資料。
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
      <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">使用手冊</h2>
      
      <div className="prose dark:prose-invert max-w-none">
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl p-6">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">📖 快速開始</h3>
          
          <div className="space-y-4 text-gray-700 dark:text-gray-300">
            <div>
              <h4 className="font-bold text-lg mb-2">環境需求</h4>
              <ul className="list-disc list-inside space-y-1">
                <li>Node.js: 18 以上版本</li>
                <li>瀏覽器: Chrome、Firefox、Safari、Edge</li>
                <li>Appwrite: 雲端或自架帳號</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold text-lg mb-2">安裝步驟</h4>
              <div className="bg-gray-900 dark:bg-gray-950 rounded-xl p-4 overflow-x-auto">
                <pre className="text-green-400 text-sm font-mono">
{`# 1. 安裝套件
npm install

# 2. 複製環境設定檔
cp .env.example .env.local

# 3. 編輯 .env.local，填入你的 Appwrite 設定

# 4. 啟動開發伺服器
npm run dev`}
                </pre>
              </div>
            </div>
            
            <div>
              <h4 className="font-bold text-lg mb-2">首次使用</h4>
              <ol className="list-decimal list-inside space-y-1">
                <li>點擊左側選單的「鋒兄設定」</li>
                <li>找到「資料庫欄位統計」區塊</li>
                <li>點擊「一鍵建立所有缺失 Table」按鈕</li>
                <li>等待所有表格建立完成</li>
                <li>回到其他模組即可開始使用</li>
              </ol>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-6">
            <h4 className="font-bold text-lg text-green-900 dark:text-green-100 mb-3">💡 主要特點</h4>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li>✅ 智慧統計與數據分析</li>
              <li>✅ 自動提醒與桌面推播</li>
              <li>✅ 多幣別支援與換算</li>
              <li>✅ CSV/ZIP 批次操作</li>
            </ul>
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6">
            <h4 className="font-bold text-lg text-blue-900 dark:text-blue-100 mb-3">🎨 使用者體驗</h4>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li>✅ 三種主題模式</li>
              <li>✅ 響應式設計</li>
              <li>✅ 離線瀏覽支援</li>
              <li>✅ PWA 安裝支援</li>
            </ul>
          </div>
          
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-6">
            <h4 className="font-bold text-lg text-purple-900 dark:text-purple-100 mb-3">🔒 安全與穩定</h4>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li>✅ API Key 認證</li>
              <li>✅ 雲端資料備份</li>
              <li>✅ 完整錯誤處理</li>
              <li>✅ 自動快取管理</li>
            </ul>
          </div>
        </div>
        
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-6 mt-6">
          <h4 className="font-bold text-lg text-orange-900 dark:text-orange-100 mb-3">❓ 常見問題</h4>
          <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
            <div>
              <p className="font-bold">Q: 資料沒有更新怎麼辦？</p>
              <p>A: 嘗試重新整理頁面 (Ctrl+F5)，或到「鋒兄設定」切換帳號再切回來。</p>
            </div>
            <div>
              <p className="font-bold">Q: 影片/音樂無法播放？</p>
              <p>A: 確認檔案已上傳到 Appwrite Storage，並確認 Bucket 權限設定為公開讀取。</p>
            </div>
            <div>
              <p className="font-bold">Q: 可以離線使用嗎？</p>
              <p>A: 已快取的影片、音樂、圖片、文件可離線瀏覽/播放，新增/修改/刪除需要網路連線。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
