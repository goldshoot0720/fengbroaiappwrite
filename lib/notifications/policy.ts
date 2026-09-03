import { DATE_THRESHOLDS, NOTIFY_WINDOW_DAYS } from "@/lib/constants";

/**
 * Shared notification policy.
 *
 * 到期前通知規則（未來日期項目「時間到之前」開始通知，進入窗口後每天通知一次，含到期當天）：
 * - 訂閱 (subscription)：剩 0~3 天
 * - 食品 (food)：剩 0~7 天
 * - 試用／首購 (trialpurchase)：剩 0~3 天（eventDate）
 * - 額度非 AI (quota general)：剩 0~3 天（quotaExpiry）
 * - 額度 AI：一週／一月到期 只提醒前一天與當天（剩 0~1 天）
 * - 購物清單 (shoppinglist)：剩 0~3 天（plannedDate）
 */
export const NOTIFICATION_POLICY = {
  timezone: "Asia/Taipei",
  swVersion: "v14",
  dashboardOs: {
    /** 每日通知窗口上限（天）。 */
    subscriptionMaxDays: NOTIFY_WINDOW_DAYS.SUBSCRIPTION,
    foodMaxDays: NOTIFY_WINDOW_DAYS.FOOD,
    trialPurchaseMaxDays: NOTIFY_WINDOW_DAYS.TRIAL_PURCHASE,
    quotaGeneralMaxDays: NOTIFY_WINDOW_DAYS.QUOTA_GENERAL,
    quotaAiMaxDays: NOTIFY_WINDOW_DAYS.QUOTA_AI_WEEK,
    shoppingListMaxDays: NOTIFY_WINDOW_DAYS.SHOPPING_LIST,
    maxExpiredFoodNotices: 3,
    maxOverdueSubscriptionNotices: 3,
    maxOverdueShoppingNotices: 3,
    earliestLocalHour: 5,
    dailyCheckHour: 5,
    dailyCheckMinute: 21,
    sessionStorageKey: "dashboardNotificationSession",
    bannerDismissKey: "notificationBannerDismissed",
  },
  pushAndSw: {
    warnDays: 7,
    periodicSyncMinIntervalMs: 12 * 60 * 60 * 1000,
  },
  email: {
    subscriptionExactDays: 1,
    foodExactDays: 7,
  },
  ui: {
    foodSoon: DATE_THRESHOLDS.FOOD_EXPIRING_SOON,
    foodWarning: DATE_THRESHOLDS.FOOD_EXPIRING_WARNING,
    subUrgent: DATE_THRESHOLDS.SUBSCRIPTION_URGENT,
    subWarning: DATE_THRESHOLDS.SUBSCRIPTION_WARNING,
  },
  icon: "/favicon.ico",
} as const;

export type NotificationPermissionState = NotificationPermission | "unsupported";
