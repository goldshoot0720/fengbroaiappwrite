// 鋒兄關於：選單使用次數與頻率需要把 moduleId 轉成人類可讀的名稱。
// 與 app/page.tsx 的 MENU_ITEMS 保持同步（那裡的清單含圖示，這裡只留純文字方便共用）。
export const MODULE_LABELS: Record<string, string> = {
  home: "首頁",
  dashboard: "儀表",
  subscription: "訂閱",
  "trial-purchase": "試用/首購",
  reinstall: "重灌",
  quota: "額度",
  food: "食品",
  "shopping-list": "購物清單",
  common: "常用",
  "bank-stats": "銀行",
  notes: "筆記",
  music: "音樂",
  images: "圖片",
  videos: "影片",
  documents: "文件",
  podcast: "播客",
  routine: "例行",
  "fengbro-finance": "金融",
  "fengbro-news": "新聞",
  "price-compare": "比價",
  landtop: "手機",
  "fengbro-tube": "Tube",
  "image-voice-video": "圖片+語音=影片",
  "image-format-convert": "PNG/JPEG",
  "video-merge": "影片合併",
  "youtube-bilibili-convert": "YouTube/Bilibili",
  settings: "鋒兄設定",
  about: "鋒兄關於",
};

export function getModuleLabel(moduleId: string): string {
  return MODULE_LABELS[moduleId] || moduleId;
}
