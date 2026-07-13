"use client";

import { useEffect } from "react";
import { NOTIFICATION_POLICY } from "@/lib/notifications/policy";
import { getPushPublicKey, subscribePush } from "@/lib/notifications/pushClient";

function hasAppwriteConfig(): boolean {
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

function sendConfigToSW(registration: ServiceWorkerRegistration) {
  try {
    const config = {
      endpoint: localStorage.getItem("NEXT_PUBLIC_APPWRITE_ENDPOINT") || "",
      projectId: localStorage.getItem("NEXT_PUBLIC_APPWRITE_PROJECT_ID") || "",
      databaseId: localStorage.getItem("APPWRITE_DATABASE_ID") || "",
      apiKey: localStorage.getItem("APPWRITE_API_KEY") || "",
    };
    const sw = registration.active || registration.installing || registration.waiting;
    if (sw) {
      sw.postMessage({ type: "SAVE_CONFIG", config });
    }
  } catch {
    // ignore
  }
}

async function maybeSubscribePush(registration: ServiceWorkerRegistration) {
  if (!hasAppwriteConfig()) return;
  try {
    await subscribePush(registration, {
      vapidPublicKey: getPushPublicKey(),
    });
  } catch (e) {
    console.error("[SW] Push subscribe error:", e);
  }
}

/**
 * Registers the service worker, syncs Appwrite config into SW IndexedDB,
 * auto-subscribes Web Push when permission is already granted, and
 * registers periodic/background sync for expiry checks.
 */
export function ServiceWorkerBootstrap() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let cancelled = false;
    const swVersion = NOTIFICATION_POLICY.swVersion;

    const bootstrap = async () => {
      try {
        let reloadedForSw =
          sessionStorage.getItem("fengbro_sw_reloaded") === swVersion;

        const onControllerChange = () => {
          if (reloadedForSw) return;
          reloadedForSw = true;
          sessionStorage.setItem("fengbro_sw_reloaded", swVersion);
          window.location.reload();
        };
        navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

        const reg = await navigator.serviceWorker.register(`/sw.js?v=${swVersion}`, {
          scope: "/",
          updateViaCache: "none",
        });
        if (cancelled) return;

        await reg.update();

        if (reg.active) {
          sendConfigToSW(reg);
          await maybeSubscribePush(reg);
        } else {
          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (!newWorker) return;
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "activated" && !cancelled) {
                sendConfigToSW(reg);
                void maybeSubscribePush(reg);
              }
            });
          });
        }

        if (hasAppwriteConfig() && "periodicSync" in reg) {
          try {
            const status = await navigator.permissions.query({
              name: "periodic-background-sync" as PermissionName,
            });
            if (status.state === "granted") {
              // @ts-expect-error periodicSync is experimental
              await reg.periodicSync.register("check-expiry", {
                minInterval: NOTIFICATION_POLICY.pushAndSw.periodicSyncMinIntervalMs,
              });
            }
          } catch {
            // unsupported
          }
        }

        if (hasAppwriteConfig() && "sync" in reg) {
          try {
            // @ts-expect-error Background Sync API
            await reg.sync.register("check-expiry-sync");
          } catch {
            // unsupported
          }
        }

        return () => {
          navigator.serviceWorker.removeEventListener(
            "controllerchange",
            onControllerChange
          );
        };
      } catch (e) {
        console.error("SW registration failed:", e);
      }
    };

    let cleanup: (() => void) | undefined;
    if (document.readyState === "complete") {
      void bootstrap().then((fn) => {
        cleanup = fn;
      });
    } else {
      const onLoad = () => {
        void bootstrap().then((fn) => {
          cleanup = fn;
        });
      };
      window.addEventListener("load", onLoad);
      return () => {
        cancelled = true;
        window.removeEventListener("load", onLoad);
        cleanup?.();
      };
    }

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return null;
}
