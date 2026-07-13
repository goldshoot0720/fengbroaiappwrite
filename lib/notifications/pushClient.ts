import { API_ENDPOINTS } from "@/lib/constants";

export function getPushPublicKey(envFallback?: string): string {
  const fallback = envFallback ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  if (typeof window === "undefined") return fallback;
  try {
    return localStorage.getItem("NEXT_PUBLIC_VAPID_PUBLIC_KEY") || fallback || "";
  } catch {
    return fallback;
  }
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

export function isSameApplicationServerKey(
  subscription: PushSubscription | null | undefined,
  vapidPublicKey: string
): boolean {
  if (!subscription?.options?.applicationServerKey) return true;
  try {
    const expectedKey = urlBase64ToUint8Array(vapidPublicKey);
    const currentBytes = new Uint8Array(subscription.options.applicationServerKey);
    return (
      expectedKey.length === currentBytes.length &&
      expectedKey.every((byte, index) => byte === currentBytes[index])
    );
  } catch {
    return true;
  }
}

async function fetchPushSubscription(init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(API_ENDPOINTS.PUSH_SUBSCRIBE, {
      ...init,
      signal: controller.signal,
    });

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const data = await response.json();
        if (data?.error) message = data.error;
      } catch {
        // ignore
      }
      throw new Error(message);
    }

    return response;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Push subscribe request timed out. Please try again.");
    }
    throw err;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export type SubscribePushResult = {
  subscription: PushSubscription | null;
  action: "created" | "updated" | "skipped" | "missing_key" | "unsupported";
};

/** Ensure browser push subscription exists and is registered with the server. */
export async function subscribePush(
  registration: ServiceWorkerRegistration,
  options?: { vapidPublicKey?: string }
): Promise<SubscribePushResult> {
  if (!("pushManager" in registration)) {
    return { subscription: null, action: "unsupported" };
  }
  if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    return { subscription: null, action: "skipped" };
  }

  const vapidKey = options?.vapidPublicKey ?? getPushPublicKey();
  if (!vapidKey) {
    return { subscription: null, action: "missing_key" };
  }

  let sub = await registration.pushManager.getSubscription();
  if (sub && !isSameApplicationServerKey(sub, vapidKey)) {
    await sub.unsubscribe();
    sub = null;
  }
  if (!sub) {
    sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
    });
  }

  if (sub) {
    await fetchPushSubscription({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
    return { subscription: sub, action: "created" };
  }

  return { subscription: null, action: "skipped" };
}

export async function unsubscribePush(
  registration: ServiceWorkerRegistration
): Promise<boolean> {
  const sub = await registration.pushManager.getSubscription();
  if (!sub) return false;

  await fetchPushSubscription({
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  });
  await sub.unsubscribe();
  return true;
}

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    if (!("pushManager" in reg)) return null;
    return (await reg.pushManager.getSubscription()) ?? null;
  } catch {
    return null;
  }
}
