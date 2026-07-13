import { NOTIFICATION_POLICY } from "./policy";

export type ShowNotificationOptions = NotificationOptions & {
  icon?: string;
};

/** Prefer Service Worker showNotification; fall back to Notification constructor. */
export async function showAppNotification(
  title: string,
  options?: ShowNotificationOptions
): Promise<void> {
  const opts: ShowNotificationOptions = {
    icon: NOTIFICATION_POLICY.icon,
    ...options,
  };

  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, opts);
      return;
    }
  } catch {
    // fall through
  }

  try {
    // eslint-disable-next-line no-new
    new Notification(title, opts);
  } catch {
    // ignore
  }
}
