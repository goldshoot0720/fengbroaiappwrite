import { API_ENDPOINTS } from "@/lib/constants";
import { NOTIFICATION_POLICY } from "./policy";
import { getPushPublicKey, getExistingPushSubscription } from "./pushClient";
import { showAppNotification } from "./showNotification";

export type CheckStatus = "pass" | "warn" | "fail" | "info";

export type SelfCheckItem = {
  id: string;
  channel: "client" | "server" | "dashboard" | "push" | "sw" | "email";
  label: string;
  status: CheckStatus;
  detail: string;
};

export type SelfCheckReport = {
  checkedAt: string;
  overall: CheckStatus;
  summary: { pass: number; warn: number; fail: number; info: number };
  items: SelfCheckItem[];
  server?: Record<string, unknown>;
};

function summarize(items: SelfCheckItem[]): SelfCheckReport["summary"] {
  return items.reduce(
    (acc, item) => {
      acc[item.status] += 1;
      return acc;
    },
    { pass: 0, warn: 0, fail: 0, info: 0 }
  );
}

function overallFrom(summary: SelfCheckReport["summary"]): CheckStatus {
  if (summary.fail > 0) return "fail";
  if (summary.warn > 0) return "warn";
  if (summary.pass > 0) return "pass";
  return "info";
}

function hasAppwriteLocalConfig(): boolean {
  try {
    return Boolean(
      localStorage.getItem("NEXT_PUBLIC_APPWRITE_ENDPOINT") &&
        localStorage.getItem("NEXT_PUBLIC_APPWRITE_PROJECT_ID") &&
        localStorage.getItem("APPWRITE_DATABASE_ID") &&
        localStorage.getItem("APPWRITE_API_KEY")
    );
  } catch {
    return false;
  }
}

/** Browser-side notification health checks (no network except optional server probe). */
export async function runClientNotificationSelfCheck(): Promise<SelfCheckItem[]> {
  const items: SelfCheckItem[] = [];

  const notifSupported = typeof window !== "undefined" && "Notification" in window;
  items.push({
    id: "client.notificationApi",
    channel: "client",
    label: "瀏覽器 Notification API",
    status: notifSupported ? "pass" : "fail",
    detail: notifSupported ? "支援" : "不支援（部分 iOS Safari 未安裝 PWA 時會如此）",
  });

  if (notifSupported) {
    const permission = Notification.permission;
    items.push({
      id: "client.permission",
      channel: "dashboard",
      label: "通知權限",
      status:
        permission === "granted" ? "pass" : permission === "denied" ? "fail" : "warn",
      detail:
        permission === "granted"
          ? "已授權（Dashboard OS 通知可用）"
          : permission === "denied"
            ? "已拒絕，需在系統/瀏覽器設定手動開啟"
            : "尚未授權",
    });
  }

  const swSupported = "serviceWorker" in navigator;
  items.push({
    id: "sw.support",
    channel: "sw",
    label: "Service Worker 支援",
    status: swSupported ? "pass" : "fail",
    detail: swSupported ? "支援" : "不支援",
  });

  if (swSupported) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const controlling = Boolean(navigator.serviceWorker.controller);
      items.push({
        id: "sw.registered",
        channel: "sw",
        label: "Service Worker 註冊",
        status: reg ? "pass" : "warn",
        detail: reg
          ? `已註冊（scope: ${reg.scope}）${controlling ? "，已控制頁面" : "，尚未控制（可能需重新整理）"}`
          : "尚未註冊，請重新整理或等待 bootstrap",
      });
      items.push({
        id: "sw.version",
        channel: "sw",
        label: "預期 SW 版本",
        status: "info",
        detail: `policy.swVersion = ${NOTIFICATION_POLICY.swVersion}`,
      });

      if (reg) {
        const pushOk = "pushManager" in reg;
        items.push({
          id: "push.manager",
          channel: "push",
          label: "PushManager",
          status: pushOk ? "pass" : "fail",
          detail: pushOk ? "支援" : "此瀏覽器不支援 Web Push",
        });

        if (pushOk) {
          const sub = await reg.pushManager.getSubscription();
          items.push({
            id: "push.subscription",
            channel: "push",
            label: "推播訂閱",
            status: sub ? "pass" : "warn",
            detail: sub
              ? `已訂閱（endpoint …${sub.endpoint.slice(-24)}）`
              : "尚未訂閱（請在設定啟用推播）",
          });
        }

        // periodic background sync (Chrome)
        try {
          const hasPeriodic = "periodicSync" in (reg as ServiceWorkerRegistration & {
            periodicSync?: unknown;
          });
          items.push({
            id: "sw.periodicsync",
            channel: "sw",
            label: "Periodic Background Sync",
            status: "info",
            detail: hasPeriodic
              ? "API 可用（實際授權視 Chrome / 安裝狀態而定）"
              : "此瀏覽器無 periodicsync（屬正常，依賴 Web Push Cron 即可）",
          });
        } catch {
          items.push({
            id: "sw.periodicsync",
            channel: "sw",
            label: "Periodic Background Sync",
            status: "info",
            detail: "無法查詢",
          });
        }
      }
    } catch (err) {
      items.push({
        id: "sw.error",
        channel: "sw",
        label: "Service Worker 檢查",
        status: "fail",
        detail: err instanceof Error ? err.message : "未知錯誤",
      });
    }
  }

  const vapid = getPushPublicKey();
  items.push({
    id: "push.vapidPublic",
    channel: "push",
    label: "VAPID 公鑰（前端）",
    status: vapid ? "pass" : "warn",
    detail: vapid ? `已設定（長度 ${vapid.length}）` : "未設定 NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  });

  items.push({
    id: "client.appwrite",
    channel: "client",
    label: "Appwrite 本機設定",
    status: hasAppwriteLocalConfig() ? "pass" : "warn",
    detail: hasAppwriteLocalConfig()
      ? "localStorage 已有 endpoint / project / database / apiKey"
      : "未在設定頁儲存 Appwrite（SW 背景檢查與部分 API 會失敗）",
  });

  const hour = new Date().getHours();
  const gate = NOTIFICATION_POLICY.dashboardOs.earliestLocalHour;
  items.push({
    id: "dashboard.hourGate",
    channel: "dashboard",
    label: "Dashboard OS 時段門檻",
    status: hour >= gate ? "pass" : "info",
    detail:
      hour >= gate
        ? `目前本地 ${hour}:xx，可發送 OS 通知（門檻 ≥ ${gate}:00）`
        : `目前本地 ${hour}:xx，早於 ${gate}:00，OS 通知會略過（既有行為）`,
  });

  items.push({
    id: "policy.thresholds",
    channel: "client",
    label: "通知門檻政策",
    status: "info",
    detail: `OS 0–${NOTIFICATION_POLICY.dashboardOs.subscriptionMaxDays} 天｜Push/SW 0–${NOTIFICATION_POLICY.pushAndSw.warnDays} 天｜Email 訂閱前 ${NOTIFICATION_POLICY.email.subscriptionExactDays} 天 / 食品前 ${NOTIFICATION_POLICY.email.foodExactDays} 天｜TZ ${NOTIFICATION_POLICY.timezone}`,
  });

  return items;
}

export async function fetchServerNotificationSelfCheck(init?: {
  endpoint?: string;
  projectId?: string;
  databaseId?: string;
  apiKey?: string;
}): Promise<{ items: SelfCheckItem[]; raw: Record<string, unknown> }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const body: Record<string, string> = {};
  if (init?.endpoint) body.endpoint = init.endpoint;
  if (init?.projectId) body.projectId = init.projectId;
  if (init?.databaseId) body.databaseId = init.databaseId;
  if (init?.apiKey) body.appwriteApiKey = init.apiKey;

  const res = await fetch(API_ENDPOINTS.NOTIFICATION_SELFCHECK, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return {
      raw,
      items: [
        {
          id: "server.http",
          channel: "server",
          label: "伺服器自我檢測",
          status: "fail",
          detail: String(raw.error || `HTTP ${res.status}`),
        },
      ],
    };
  }
  const items = Array.isArray(raw.items) ? (raw.items as SelfCheckItem[]) : [];
  return { items, raw };
}

export async function runNotificationSelfCheck(options?: {
  includeServer?: boolean;
  sendTestOsNotification?: boolean;
  appwrite?: {
    endpoint?: string;
    projectId?: string;
    databaseId?: string;
    apiKey?: string;
  };
}): Promise<SelfCheckReport> {
  const items = await runClientNotificationSelfCheck();
  let server: Record<string, unknown> | undefined;

  if (options?.includeServer !== false) {
    try {
      const { items: serverItems, raw } = await fetchServerNotificationSelfCheck(
        options?.appwrite
      );
      items.push(...serverItems);
      server = raw;
    } catch (err) {
      items.push({
        id: "server.fetch",
        channel: "server",
        label: "伺服器自我檢測",
        status: "fail",
        detail: err instanceof Error ? err.message : "無法連線伺服器",
      });
    }
  }

  if (options?.sendTestOsNotification) {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        await showAppNotification("鋒兄通知自我檢測", {
          body: `測試成功 · ${new Date().toLocaleString("zh-TW")} · SW ${NOTIFICATION_POLICY.swVersion}`,
          tag: "fengbro-selfcheck",
          icon: NOTIFICATION_POLICY.icon,
        });
        items.push({
          id: "dashboard.testOs",
          channel: "dashboard",
          label: "測試 OS 通知",
          status: "pass",
          detail: "已呼叫 showNotification（請確認系統通知中心）",
        });
      } catch (err) {
        items.push({
          id: "dashboard.testOs",
          channel: "dashboard",
          label: "測試 OS 通知",
          status: "fail",
          detail: err instanceof Error ? err.message : "發送失敗",
        });
      }
    } else {
      items.push({
        id: "dashboard.testOs",
        channel: "dashboard",
        label: "測試 OS 通知",
        status: "warn",
        detail: "略過：尚未授權通知權限",
      });
    }
  }

  // Cross-check push subscription via helper
  try {
    const sub = await getExistingPushSubscription();
    if (sub && !items.some((i) => i.id === "push.subscription")) {
      items.push({
        id: "push.subscription",
        channel: "push",
        label: "推播訂閱",
        status: "pass",
        detail: "已訂閱",
      });
    }
  } catch {
    // ignore
  }

  const summary = summarize(items);
  return {
    checkedAt: new Date().toISOString(),
    overall: overallFrom(summary),
    summary,
    items,
    server,
  };
}
