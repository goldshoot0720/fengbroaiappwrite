export type NotificationPreferences = {
  /** Dashboard OS 本機到期提醒（開啟／返回前景時跳出），與「推播通知」背景推播分開控制。 */
  dashboardOsEnabled: boolean;
};

export const NOTIFICATION_PREFERENCES_KEY = "fengbro.notifications.preferences";
export const NOTIFICATION_PREFERENCES_EVENT = "fengbro:notification-preferences";

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  dashboardOsEnabled: true,
};

function isBrowser() {
  return typeof window !== "undefined";
}

export function getNotificationPreferences(): NotificationPreferences {
  if (!isBrowser()) return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  try {
    const raw = localStorage.getItem(NOTIFICATION_PREFERENCES_KEY);
    if (!raw) return { ...DEFAULT_NOTIFICATION_PREFERENCES };
    const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
    return {
      dashboardOsEnabled:
        typeof parsed.dashboardOsEnabled === "boolean"
          ? parsed.dashboardOsEnabled
          : DEFAULT_NOTIFICATION_PREFERENCES.dashboardOsEnabled,
    };
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }
}

export function setNotificationPreferences(
  partial: Partial<NotificationPreferences>
): NotificationPreferences {
  const next = { ...getNotificationPreferences(), ...partial };
  if (isBrowser()) {
    localStorage.setItem(NOTIFICATION_PREFERENCES_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(NOTIFICATION_PREFERENCES_EVENT, { detail: next }));
  }
  return next;
}

export function subscribeNotificationPreferences(
  listener: (prefs: NotificationPreferences) => void
) {
  if (!isBrowser()) return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key && event.key !== NOTIFICATION_PREFERENCES_KEY) return;
    listener(getNotificationPreferences());
  };
  const onCustom = (event: Event) => {
    const detail = (event as CustomEvent<NotificationPreferences>).detail;
    listener(
      detail ? { ...DEFAULT_NOTIFICATION_PREFERENCES, ...detail } : getNotificationPreferences()
    );
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(NOTIFICATION_PREFERENCES_EVENT, onCustom as EventListener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(NOTIFICATION_PREFERENCES_EVENT, onCustom as EventListener);
  };
}
