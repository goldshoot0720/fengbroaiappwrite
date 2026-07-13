"use client";

import { useCallback, useEffect, useState } from "react";
import {
  NOTIFICATION_POLICY,
  type NotificationPermissionState,
} from "@/lib/notifications/policy";

export function useNotificationPermission() {
  const [permission, setPermission] =
    useState<NotificationPermissionState>("unsupported");
  const [permissionDismissed, setPermissionDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const ua = navigator.userAgent;
    const ios =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIOS(ios);

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    if (typeof Notification === "undefined") {
      setPermission("unsupported");
    } else {
      setPermission(Notification.permission);
    }

    try {
      const dismissed = window.localStorage.getItem(
        NOTIFICATION_POLICY.dashboardOs.bannerDismissKey
      );
      if (dismissed === "true") setPermissionDismissed(true);
    } catch {
      // ignore
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<NotificationPermissionState> => {
    if (typeof Notification === "undefined") return "unsupported";
    try {
      const next = await Notification.requestPermission();
      setPermission(next);
      return next;
    } catch {
      return permission;
    }
  }, [permission]);

  const dismissBanner = useCallback(() => {
    setPermissionDismissed(true);
    try {
      window.localStorage.setItem(
        NOTIFICATION_POLICY.dashboardOs.bannerDismissKey,
        "true"
      );
    } catch {
      // ignore
    }
  }, []);

  return {
    permission,
    setPermission,
    permissionDismissed,
    dismissBanner,
    requestPermission,
    isIOS,
    isStandalone,
  };
}
