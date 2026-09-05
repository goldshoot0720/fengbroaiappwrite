// 應用程式常數定義

// 導航葉模組 id（主選單以 app/page.tsx 為準；此處供型別與語音等共用）
export const MENU_ITEMS = [
  { id: "home", label: "鋒兄首頁", icon: "Home" },
  { id: "dashboard", label: "鋒兄儀表", icon: "BarChart3" },
  { id: "subscription", label: "鋒兄訂閱", icon: "CreditCard" },
  { id: "trial-purchase", label: "鋒兄試用/首購", icon: "BadgePercent" },
  { id: "reinstall", label: "鋒兄重灌", icon: "Laptop" },
  { id: "quota", label: "鋒兄額度", icon: "Gauge" },
  { id: "food", label: "鋒兄食品", icon: "Package" },
  { id: "shopping-list", label: "鋒兄購物清單", icon: "ShoppingCart" },
  { id: "notes", label: "鋒兄筆記", icon: "FileText" },
  { id: "documents", label: "鋒兄文件", icon: "File" },
  { id: "common", label: "鋒兄常用", icon: "Star" },
  { id: "images", label: "鋒兄圖片", icon: "Image" },
  { id: "videos", label: "鋒兄影片", icon: "Play" },
  { id: "music", label: "鋒兄音樂", icon: "Music" },
  { id: "podcast", label: "鋒兄播客", icon: "Podcast" },
  { id: "bank-stats", label: "鋒兄銀行", icon: "Building2" },
  { id: "routine", label: "鋒兄例行", icon: "CalendarClock" },
  { id: "price-compare", label: "鋒兄比價", icon: "Wrench" },
  { id: "landtop", label: "手機比價", icon: "Smartphone" },
  { id: "image-voice-video", label: "圖片 + 語音 = 影片", icon: "Clapperboard" },
  { id: "image-format-convert", label: "PNG / JPEG 轉換", icon: "Images" },
  { id: "video-merge", label: "影片合併", icon: "Film" },
  { id: "youtube-bilibili-convert", label: "YT / B站轉 MP3/MP4", icon: "Youtube" },
  { id: "fengbro-tube", label: "鋒兄Tube", icon: "Play" },
  { id: "fengbro-finance", label: "鋒兄金融", icon: "Landmark" },
  { id: "fengbro-news", label: "鋒兄新聞", icon: "Newspaper" },
  { id: "settings", label: "鋒兄設定", icon: "Settings" },
  { id: "about", label: "鋒兄關於", icon: "Info" },
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

// 到期前通知窗口（天）：未來日期項目要在「時間到之前」開始通知。
// 每個項目進入窗口後每天通知一次（依台北日期去重），到期當天（0 天）也算。
export const NOTIFY_WINDOW_DAYS = {
  SUBSCRIPTION: 3, // 鋒兄訂閱：3 天內，每天一次，含當天
  FOOD: 7, // 鋒兄食品：7 天前開始，每天一次，含當天
  TRIAL_PURCHASE: 3, // 鋒兄試用／首購：3 天內，每天一次，含當天
  QUOTA_GENERAL: 3, // 鋒兄額度（非 AI 帳號到期）：3 天內，每天一次，含當天
  QUOTA_AI_WEEK: 1, // 額度 AI 一週到期：前一天與當天
  QUOTA_AI_MONTH: 1, // 額度 AI 一月到期：前一天與當天
  SHOPPING_LIST: 3, // 鋒兄購物清單：3 天內，每天一次，含當天
} as const;

// 網站起源日：本專案承繼自 nextshadcn20250928，故以該專案名稱日期為起算點。
export const SITE_ORIGIN_DATE = "2025-09-28";

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
  TRIAL_PURCHASE: "/api/trial-purchase",
  REINSTALL: "/api/reinstall",
  QUOTA: "/api/quota",
  CHATGPT_USAGE: "/api/chatgpt-usage",
  /** 全站共用的四位數密碼（在鋒兄設定建立） */
  ACCESS_PIN: "/api/access-pin",
  SHOPPING_LIST: "/api/shopping-list",
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
  TUBE_CHANNEL: "/api/tubechannel",
  FINANCE_INSTRUMENT: "/api/financeinstrument2",
  MANUAL_PRICE: "/api/manualprice",
  PUSH_SUBSCRIBE: "/api/push-subscribe",
  PUSH_SEND: "/api/push-send",
  CHECK_EXPIRY: "/api/check-expiry",
  RESEND_EXPIRY_NOTIFY: "/api/resend-expiry-notify",
  NOTIFICATION_SETTINGS: "/api/notification-settings",
  NOTIFICATION_SELFCHECK: "/api/notification-selfcheck",
  SITE_VISIT: "/api/site-visit",
  MENU_USAGE: "/api/menu-usage",
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
