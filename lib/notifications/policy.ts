import { DATE_THRESHOLDS } from "@/lib/constants";

/** Shared notification policy — channel thresholds match pre-refactor behavior. */
export const NOTIFICATION_POLICY = {
  timezone: "Asia/Taipei",
  swVersion: "v11",
  dashboardOs: {
    subscriptionMaxDays: 3,
    foodMaxDays: 3,
    maxExpiredFoodNotices: 3,
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
