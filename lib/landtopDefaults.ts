/**
 * 手機比價 — 預設搜尋型號規則（改這裡即可調整）
 *
 * 蘋果旗艦：
 * - 每年 switchMonth/switchDay **之前** → 上一世代（例：2026/9/30 前 → iPhone 17）
 * - **當天起** → 新世代（例：2026/10/1 起 → iPhone 18）
 *
 * 型號數字 = 該世代上市年 − modelYearOffset
 * （2025 年機 = iPhone 17 → offset 2008；2026 年機 = iPhone 18）
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
 * 三星旗艦預設：3 月前用前一年型號數字，之後用當年
 * （例：2026/2 → Samsung 25；2026/3 → Samsung 26）
 */
export const SAMSUNG_LANDTOP_DEFAULT_CONFIG = {
  /** 0-indexed month threshold：month < switchBeforeMonth → 用前一年 */
  switchBeforeMonth: 2, // March starts new cycle (month index 2)
} as const;

/** 是否為「純自動預設」字串（使用者未再加容量等後綴）。 */
export function isAutoAppleLandtopDefaultQuery(value: string): boolean {
  return /^iphone\s+\d+$/i.test(value.trim());
}

export function isAutoSamsungLandtopDefaultQuery(value: string): boolean {
  return /^samsung\s+\d{2}$/i.test(value.trim());
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
  const month = date.getMonth() + 1; // 1–12
  const day = date.getDate();

  const switchMonth = Math.min(12, Math.max(1, config.switchMonth));
  const switchDay = Math.min(31, Math.max(1, config.switchDay));

  const useNewCycle =
    month > switchMonth || (month === switchMonth && day >= switchDay);

  // 新週期用當年上市機；切換前用前一年機
  const cycleYear = useNewCycle ? year : year - 1;
  const modelNumber = cycleYear - config.modelYearOffset;

  // 防呆：至少 iPhone 1
  const safeModel = Math.max(1, modelNumber);
  return `iPhone ${safeModel}`;
}

/** 三星預設搜尋關鍵字（例：Samsung 26）。 */
export function getSamsungDefaultLandtopQuery(
  date: Date = new Date(),
  config: { switchBeforeMonth: number } = SAMSUNG_LANDTOP_DEFAULT_CONFIG
): string {
  const samsungYear =
    date.getMonth() < config.switchBeforeMonth
      ? date.getFullYear() - 1
      : date.getFullYear();
  return `Samsung ${samsungYear.toString().slice(-2)}`;
}

export function getDefaultLandtopQuery(date: Date = new Date()): string {
  return getSamsungDefaultLandtopQuery(date);
}
