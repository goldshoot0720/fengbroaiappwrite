/**
 * 手機比價 — 預設搜尋型號規則（改這裡即可調整）
 *
 * ── 蘋果旗艦 ─────────────────────────────────────────────
 * - 每年 switchMonth/switchDay **之前** → 上一世代（例：2026/9/30 前 → iPhone 17）
 * - **當天起** → 新世代（例：2026/10/1 起 → iPhone 18）
 * 型號數字 = 上市年 − modelYearOffset（2025→17、2026→18）
 *
 * ── 三星旗艦 ─────────────────────────────────────────────
 * - 每年 switchMonth/switchDay **之前** → 上一世代（例：2026/3/31 前 → Samsung S25）
 * - **當天起** → 新世代（例：2026/4/1 起 → Samsung S26）
 * 型號數字 = 上市年 − modelYearOffset（2025→25、2026→26）
 */

export const APPLE_LANDTOP_DEFAULT_CONFIG = {
  /** 切換月份（1–12）。10 = 十月初開始用新機。 */
  switchMonth: 10,
  /** 切換日（1–31）。 */
  switchDay: 1,
  /**
   * 型號 = 上市年 − modelYearOffset
   * 例：2025 − 2008 = 17 →「iPhone 17」
   */
  modelYearOffset: 2008,
} as const;

export type AppleLandtopDefaultConfig = {
  switchMonth: number;
  switchDay: number;
  modelYearOffset: number;
};

/**
 * 三星 S 旗艦預設切換規則（改這裡即可調整）
 * 三月底前 Samsung S25、四月初起 Samsung S26。
 */
export const SAMSUNG_LANDTOP_DEFAULT_CONFIG = {
  /** 切換月份（1–12）。4 = 四月初開始用新機。 */
  switchMonth: 4,
  /** 切換日（1–31）。 */
  switchDay: 1,
  /**
   * 型號 = 上市年 − modelYearOffset
   * 例：2025 − 2000 = 25 →「Samsung S25」
   */
  modelYearOffset: 2000,
  /**
   * 顯示前綴（不含型號數字）
   * 例：「Samsung S」+ 26 →「Samsung S26」
   */
  namePrefix: "Samsung S",
} as const;

export type SamsungLandtopDefaultConfig = {
  switchMonth: number;
  switchDay: number;
  modelYearOffset: number;
  namePrefix: string;
};

/** 是否已過切換日（含當天）。month/day 為 1-based。 */
function isOnOrAfterSwitch(
  date: Date,
  switchMonth: number,
  switchDay: number
): boolean {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const sm = Math.min(12, Math.max(1, switchMonth));
  const sd = Math.min(31, Math.max(1, switchDay));
  return month > sm || (month === sm && day >= sd);
}

/** 是否為「純自動預設」字串（使用者未再加容量等後綴）。 */
export function isAutoAppleLandtopDefaultQuery(value: string): boolean {
  return /^iphone\s+\d+$/i.test(value.trim());
}

/**
 * 三星自動預設：Samsung S25 / Samsung Galaxy S25 / Samsung 25 等
 * （含舊版「Samsung 26」「Samsung Galaxy S26」寫法，便於季節刷新）
 */
export function isAutoSamsungLandtopDefaultQuery(value: string): boolean {
  const v = value.trim();
  return (
    /^samsung\s+s\d{2}$/i.test(v) ||
    /^samsung\s+galaxy\s+s\d{2}$/i.test(v) ||
    /^samsung\s+\d{2}$/i.test(v)
  );
}

/**
 * 蘋果預設搜尋關鍵字。
 * 9 月底前 iPhone 17、10 月初起 iPhone 18（依 APPLE_LANDTOP_DEFAULT_CONFIG）。
 */
export function getAppleDefaultLandtopQuery(
  date: Date = new Date(),
  config: AppleLandtopDefaultConfig = APPLE_LANDTOP_DEFAULT_CONFIG
): string {
  const year = date.getFullYear();
  const useNewCycle = isOnOrAfterSwitch(date, config.switchMonth, config.switchDay);
  const cycleYear = useNewCycle ? year : year - 1;
  const modelNumber = Math.max(1, cycleYear - config.modelYearOffset);
  return `iPhone ${modelNumber}`;
}

/**
 * 三星預設搜尋關鍵字。
 * 三月底前 Samsung S25、四月初起 Samsung S26
 * （依 SAMSUNG_LANDTOP_DEFAULT_CONFIG）。
 */
export function getSamsungDefaultLandtopQuery(
  date: Date = new Date(),
  config: SamsungLandtopDefaultConfig = SAMSUNG_LANDTOP_DEFAULT_CONFIG
): string {
  const year = date.getFullYear();
  const useNewCycle = isOnOrAfterSwitch(date, config.switchMonth, config.switchDay);
  const cycleYear = useNewCycle ? year : year - 1;
  const modelNumber = Math.max(1, cycleYear - config.modelYearOffset);
  const prefix = (config.namePrefix || "Samsung S").trimEnd();
  // 前綴若已以 S 結尾則直接接數字（Samsung S + 26）；否則加空格
  if (/s$/i.test(prefix)) return `${prefix}${modelNumber}`;
  return `${prefix} ${modelNumber}`;
}

export function getDefaultLandtopQuery(date: Date = new Date()): string {
  return getSamsungDefaultLandtopQuery(date);
}
