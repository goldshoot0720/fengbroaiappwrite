"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getExistingPushSubscription,
  getPushPublicKey,
  subscribePush,
  unsubscribePush,
} from "@/lib/notifications/pushClient";
import type { NotificationPermissionState } from "@/lib/notifications/policy";

type UseWebPushOptions = {
  envVapidPublicKey?: string;
};

export function useWebPush(options: UseWebPushOptions = {}) {
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermissionState | string>("default");
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }
    setNotificationPermission(Notification.permission);
    if (Notification.permission === "granted") {
      void getExistingPushSubscription().then((sub) => setPushSubscribed(!!sub));
    }
  }, []);

  const enablePush = useCallback(async () => {
    if (!("Notification" in window)) return;
    setPushLoading(true);
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission !== "granted") return;

      const reg = await navigator.serviceWorker.ready;
      const vapidKey = getPushPublicKey(options.envVapidPublicKey);
      if (!vapidKey) {
        alert("請先在鋒兄設定填入 NEXT_PUBLIC_VAPID_PUBLIC_KEY，再啟用推播通知");
        return;
      }

      const result = await subscribePush(reg, { vapidPublicKey: vapidKey });
      if (result.action === "unsupported") {
        alert("此瀏覽器不支援推播通知");
        return;
      }
      if (result.subscription) {
        setPushSubscribed(true);
      }
    } catch (err) {
      console.error("Push subscribe error:", err);
      alert(
        "啟用推播通知失敗：" + (err instanceof Error ? err.message : "未知錯誤")
      );
    } finally {
      setPushLoading(false);
    }
  }, [options.envVapidPublicKey]);

  const disablePush = useCallback(async () => {
    setPushLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      await unsubscribePush(reg);
      setPushSubscribed(false);
    } catch (err) {
      console.error("Push unsubscribe error:", err);
      alert(
        "取消推播通知失敗：" + (err instanceof Error ? err.message : "未知錯誤")
      );
    } finally {
      setPushLoading(false);
    }
  }, []);

  return {
    notificationPermission,
    setNotificationPermission,
    pushSubscribed,
    pushLoading,
    enablePush,
    disablePush,
  };
}
