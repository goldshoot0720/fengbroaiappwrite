"use client";

import { Package, BarChart3, Info, Phone } from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import { PageTitle } from "@/components/ui/section-header";

export default function AboutUs() {
  return (
    <div className="space-y-4 lg:space-y-6">
      <CopyrightBanner />
      
      <PageTitle title="鋒兄關於" description="了解鋒兄管理資訊系統的使命與願景" />
      
      <DataCard className="p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-12">
          <CompanyHeader />
          <TeamMembers />
          <ServiceFeatures />
          <ContactInfo />
          <Copyright />
        </div>
      </DataCard>
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
