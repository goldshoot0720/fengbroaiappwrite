"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getNotificationPreferences,
  setNotificationPreferences,
  subscribeNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/notifications/notificationPreferences";

export function useNotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(() =>
    getNotificationPreferences()
  );

  useEffect(() => {
    setPreferences(getNotificationPreferences());
    return subscribeNotificationPreferences(setPreferences);
  }, []);

  const updatePreferences = useCallback((partial: Partial<NotificationPreferences>) => {
    const next = setNotificationPreferences(partial);
    setPreferences(next);
    return next;
  }, []);

  return { preferences, updatePreferences };
}
