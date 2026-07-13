"use client";

import { useEffect, useRef } from "react";
import {
  dashboardOsFoodExpiredMessage,
  dashboardOsFoodExpiringMessage,
  dashboardOsSubscriptionMessage,
  financeBreakthroughMessage,
} from "@/lib/notifications/messages";
import { NOTIFICATION_POLICY } from "@/lib/notifications/policy";
import { showAppNotification } from "@/lib/notifications/showNotification";
import type { FoodDetail, SubscriptionDetail } from "@/types";

export type FinanceAlertForNotification = {
  id: string;
  name: string;
  current?: number | null;
  threshold: number;
  currency?: string;
};

type ExpiryNotificationStats = {
  subscriptionsExpiring3DaysList: SubscriptionDetail[];
  foodsExpiring7DaysList: FoodDetail[];
  expiredFoodsList: FoodDetail[];
};

type UseExpiryNotificationsOptions = {
  stats: ExpiryNotificationStats;
  financeAlerts?: FinanceAlertForNotification[];
  enabled: boolean;
  /** Bump when underlying lists change so visibility handler stays fresh. */
  depsKey?: string | number;
};

export async function sendExpiryOsNotifications(params: {
  stats: ExpiryNotificationStats;
  financeAlerts?: FinanceAlertForNotification[];
}): Promise<void> {
  if (typeof window === "undefined") return;
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;

  const policy = NOTIFICATION_POLICY.dashboardOs;
  const now = new Date();
  if (now.getHours() < policy.earliestLocalHour) return;

  const today = now.toISOString().slice(0, 10);
  const storageKey = policy.sessionStorageKey;
  let notified: Record<string, string> = {};

  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (raw) notified = JSON.parse(raw) as Record<string, string>;
  } catch {
    // ignore
  }

  const updated = { ...notified };
  let hasNew = false;

  const subItems = params.stats.subscriptionsExpiring3DaysList.filter(
    (item) =>
      item.daysRemaining >= 0 && item.daysRemaining <= policy.subscriptionMaxDays
  );
  for (const item of subItems) {
    const key = `sub-${item.id}-${item.nextDate}-${today}`;
    if (notified[key] !== "shown") {
      const msg = dashboardOsSubscriptionMessage(item);
      await showAppNotification(msg.title, {
        body: msg.body,
        icon: NOTIFICATION_POLICY.icon,
        tag: `sub-${item.id}`,
      });
      updated[key] = "shown";
      hasNew = true;
    }
  }

  const foodItems = params.stats.foodsExpiring7DaysList.filter(
    (item) => item.daysRemaining >= 0 && item.daysRemaining <= policy.foodMaxDays
  );
  for (const item of foodItems) {
    const key = `food-${item.id}-${today}`;
    if (notified[key] !== "shown") {
      const msg = dashboardOsFoodExpiringMessage(item);
      await showAppNotification(msg.title, {
        body: msg.body,
        icon: NOTIFICATION_POLICY.icon,
        tag: `food-${item.id}`,
      });
      updated[key] = "shown";
      hasNew = true;
    }
  }

  const expiredFoods = params.stats.expiredFoodsList.slice(
    0,
    policy.maxExpiredFoodNotices
  );
  for (const item of expiredFoods) {
    const key = `expired-${item.id}-${today}`;
    if (notified[key] !== "shown") {
      const msg = dashboardOsFoodExpiredMessage(item);
      await showAppNotification(msg.title, {
        body: msg.body,
        icon: NOTIFICATION_POLICY.icon,
        tag: `expired-${item.id}`,
      });
      updated[key] = "shown";
      hasNew = true;
    }
  }

  for (const alert of params.financeAlerts || []) {
    const key = `finance-${alert.id}-${alert.current ?? "na"}-${today}`;
    if (notified[key] !== "shown") {
      const msg = financeBreakthroughMessage(alert);
      await showAppNotification(msg.title, {
        body: msg.body,
        icon: NOTIFICATION_POLICY.icon,
        tag: `finance-${alert.id}`,
      });
      updated[key] = "shown";
      hasNew = true;
    }
  }

  if (hasNew) {
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {
      // ignore
    }
  }
}

export function useExpiryNotifications({
  stats,
  financeAlerts = [],
  enabled,
  depsKey,
}: UseExpiryNotificationsOptions) {
  const notificationSentRef = useRef(false);
  const statsRef = useRef(stats);
  const financeRef = useRef(financeAlerts);
  statsRef.current = stats;
  financeRef.current = financeAlerts;

  const run = async () => {
    await sendExpiryOsNotifications({
      stats: statsRef.current,
      financeAlerts: financeRef.current,
    });
  };

  // Page load / data ready
  useEffect(() => {
    if (!enabled || notificationSentRef.current) return;
    void run().then(() => {
      notificationSentRef.current = true;
    });
  }, [
    enabled,
    depsKey,
    stats.subscriptionsExpiring3DaysList.length,
    stats.foodsExpiring7DaysList.length,
    stats.expiredFoodsList.length,
    financeAlerts.length,
  ]);

  // Foreground resume
  useEffect(() => {
    if (!enabled) return;
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        notificationSentRef.current = false;
        void run().then(() => {
          notificationSentRef.current = true;
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [enabled, depsKey]);

  // Daily local schedule (default 05:21)
  useEffect(() => {
    if (!enabled) return;

    const { dailyCheckHour, dailyCheckMinute } = NOTIFICATION_POLICY.dashboardOs;

    const scheduleNextDailyCheck = () => {
      const now = new Date();
      const next = new Date(now);
      next.setHours(dailyCheckHour, dailyCheckMinute, 0, 0);
      if (next.getTime() <= now.getTime()) {
        next.setDate(next.getDate() + 1);
      }

      return window.setTimeout(() => {
        notificationSentRef.current = false;
        void run().then(() => {
          notificationSentRef.current = true;
        });
        timeout = scheduleNextDailyCheck();
      }, next.getTime() - now.getTime());
    };

    let timeout = scheduleNextDailyCheck();
    return () => window.clearTimeout(timeout);
  }, [enabled, depsKey]);
}
