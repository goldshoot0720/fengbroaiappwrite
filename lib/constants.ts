// 應用程式常數定義

// 導航選單項目
export const MENU_ITEMS = [
  { id: "home", label: "首頁", icon: "Home" },
  { id: "dashboard", label: "儀表板", icon: "BarChart3" },
  { id: "subscription", label: "訂閱管理", icon: "CreditCard" },
  { id: "food", label: "食品管理", icon: "Package" },
  { id: "videos", label: "影片介紹", icon: "Play" },
  { id: "notes", label: "鋒兄筆記", icon: "FileText" },
  { id: "documents", label: "鋒兄文件", icon: "File" },
  { id: "music", label: "鋒兄音樂", icon: "Music" },
  { id: "common", label: "鋒兄常用", icon: "Star" },
  { id: "bank-stats", label: "銀行統計", icon: "BarChart3" },
  { id: "components", label: "UI 組件", icon: "Palette" },
  { id: "about", label: "關於我們", icon: "Info" },
  { id: "settings", label: "鋒兄設定", icon: "Settings" },
] as const;

export type ModuleId = typeof MENU_ITEMS[number]["id"];

// 快取設定
export const CACHE_CONFIG = {
  MAX_SIZE: 500 * 1024 * 1024, // 500MB
  DB_NAME: "VideoCache",
  DB_VERSION: 1,
  STORE_NAME: "videos",
} as const;

// 日期相關常數
export const DATE_THRESHOLDS = {
  FOOD_EXPIRING_SOON: 7,
  FOOD_EXPIRING_WARNING: 30,
  SUBSCRIPTION_URGENT: 3,
  SUBSCRIPTION_WARNING: 7,
} as const;

// 顏色主題
export const THEME_COLORS = {
  primary: {
    gradient: "from-blue-500 to-blue-600",
    bg: "bg-blue-500",
    text: "text-blue-600",
    light: "bg-blue-50",
  },
  success: {
    gradient: "from-green-500 to-green-600",
    bg: "bg-green-500",
    text: "text-green-600",
    light: "bg-green-50",
  },
  warning: {
    gradient: "from-yellow-500 to-orange-500",
    bg: "bg-yellow-500",
    text: "text-yellow-600",
    light: "bg-yellow-50",
  },
  danger: {
    gradient: "from-red-500 to-red-600",
    bg: "bg-red-500",
    text: "text-red-600",
    light: "bg-red-50",
  },
  purple: {
    gradient: "from-purple-500 to-purple-600",
    bg: "bg-purple-500",
    text: "text-purple-600",
    light: "bg-purple-50",
  },
} as const;

// API 端點
export const API_ENDPOINTS = {
  FOOD: "/api/food",
  SUBSCRIPTION: "/api/subscription",
  BANK: "/api/bank",
  IMAGES: "/api/images",
  IMAGE: "/api/image",
  VIDEOS: "/api/videos",
  VIDEO: "/api/video",
  MUSIC: "/api/music",
  PODCAST: "/api/podcast",
  COMMONDOCUMENT: "/api/commondocument",
  ARTICLE: "/api/article",
  COMMON_ACCOUNT: "/api/commonaccount",
  ROUTINE: "/api/routine",
} as const;

// 動畫設定
export const ANIMATION_CONFIG = {
  duration: {
    fast: 150,
    normal: 200,
    slow: 300,
  },
  easing: "ease-in-out",
} as const;
