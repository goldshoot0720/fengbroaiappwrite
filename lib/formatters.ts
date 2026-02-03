// 格式化工具函數

/**
 * 格式化日期為 YYYY-MM-DD 格式
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  return new Date(dateStr).toISOString().split("T")[0];
}

/**
 * 格式化日期為本地化格式
 */
export function formatLocalDate(dateStr: string): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * 格式化日期為短格式 (MM/DD)
 */
export function formatShortDate(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return `${(date.getMonth() + 1).toString().padStart(2, "0")}/${date.getDate().toString().padStart(2, "0")}`;
}

/**
 * 格式化日期為數字格式 (M/D)
 */
export function formatNumericDate(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * 格式化檔案大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * 幣別匹率（對台幣）
 */
const EXCHANGE_RATES: Record<string, number> = {
  TWD: 1,      // 台幣
  USD: 35,     // 美元
  EUR: 40,     // 歐元
  JPY: 0.35,   // 日圓
  CNY: 4.5,    // 人民幣
  HKD: 4       // 港幣
};

/**
 * 將外幣轉換為台幣
 */
export function convertToTWD(amount: number | undefined, currency: string = "TWD"): number {
  if (amount === undefined || amount === null) {
    return 0;
  }
  const rate = EXCHANGE_RATES[currency] || 1;
  return Math.round(amount * rate);
}

/**
 * 格式化金額（帶幣別轉換）
 */
export function formatCurrencyWithExchange(amount: number | undefined, currency: string = "TWD"): string {
  if (amount === undefined || amount === null) {
    return `NT$ 0`;
  }
  const twdAmount = convertToTWD(amount, currency);
  if (currency === "TWD") {
    return `NT$ ${amount.toLocaleString()}`;
  }
  return `NT$ ${twdAmount.toLocaleString()} (${getCurrencySymbol(currency)} ${amount.toLocaleString()})`;
}

/**
 * 獲取幣別符號
 */
export function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    TWD: "NT$",
    USD: "$",
    EUR: "€",
    JPY: "¥",
    CNY: "¥",
    HKD: "HK$"
  };
  return symbols[currency] || currency;
}

/**
 * 格式化金額
 */
export function formatCurrency(amount: number | undefined, currency = "NT$"): string {
  if (amount === undefined || amount === null) {
    return `${currency} 0`;
  }
  return `${currency} ${amount.toLocaleString()}`;
}

/**
 * 計算距離今天的天數
 */
export function getDaysFromToday(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(dateStr);
  targetDate.setHours(0, 0, 0, 0);
  return Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * 獲取過期狀態
 */
export function getExpiryStatus(daysRemaining: number): "expired" | "urgent" | "warning" | "normal" {
  if (daysRemaining < 0) return "expired";
  if (daysRemaining <= 3) return "urgent";
  if (daysRemaining <= 7) return "warning";
  return "normal";
}

/**
 * 格式化剩餘天數文字
 */
export function formatDaysRemaining(days: number): string {
  if (days === 0) return "今天";
  if (days < 0) return `${Math.abs(days)} 天前`;
  return `${days} 天後`;
}
