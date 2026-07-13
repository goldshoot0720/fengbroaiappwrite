"use client";

import { BellOff, BellRing, Download, X } from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import type { NotificationPermissionState } from "@/lib/notifications/policy";

type NotificationPermissionBannerProps = {
  permission: NotificationPermissionState;
  permissionDismissed: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  onRequestPermission: () => void;
  onDismiss: () => void;
};

export function NotificationPermissionBanner({
  permission,
  permissionDismissed,
  isIOS,
  isStandalone,
  onRequestPermission,
  onDismiss,
}: NotificationPermissionBannerProps) {
  if (permissionDismissed) return null;

  if (isIOS && !isStandalone && permission === "unsupported") {
    return (
      <DataCard className="border-l-4 border-amber-500 bg-amber-50 p-4 dark:bg-amber-900/20">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
            <Download className="text-amber-600 dark:text-amber-400" size={20} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
              要接收通知，請先安裝至主畫面
            </p>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              點 Safari 下方「分享」按鈕 → 「加入主畫面」→ 從主畫面開啟後即可啟用通知
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="p-2 text-amber-400 transition-colors hover:text-amber-600"
            title="關閉提示"
          >
            <X size={16} />
          </button>
        </div>
      </DataCard>
    );
  }

  if (permission === "default") {
    return (
      <DataCard className="border-l-4 border-[var(--info)] bg-info/10 p-4 dark:bg-info/15">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-info/15">
            <BellRing className="text-info" size={20} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">
              啟用通知，訂閱到期、食品過期時即時提醒
            </p>
            {isIOS && (
              <p className="mt-1 text-xs text-muted-foreground">
                點下方按鈕後，請在彈出視窗中選擇「允許」
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRequestPermission}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-impeccable hover:bg-primary/90"
            >
              啟用通知
            </button>
            <button
              onClick={onDismiss}
              className="p-2 text-muted-foreground transition-impeccable hover:text-foreground"
              title="關閉提示"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </DataCard>
    );
  }

  if (permission === "denied") {
    return (
      <DataCard className="border-l-4 border-gray-400 bg-gray-50 p-4 dark:bg-gray-800/50">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-700">
            <BellOff className="text-gray-500 dark:text-gray-400" size={20} />
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {isIOS
                ? "通知已被拒絕，請至 iOS「設定」→ 找到本 App →「通知」→ 開啟允許通知"
                : "通知已被封鎖，請至瀏覽器設定 > 網站權限 > 通知，允許此網站發送通知"}
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="p-2 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
            title="關閉提示"
          >
            <X size={16} />
          </button>
        </div>
      </DataCard>
    );
  }

  return null;
}
