/**
 * 將額度資料庫存的「剩餘比例」轉成圖表所需的兩個互補區段。
 *
 * 上游服務（Claude / Codex）通常回傳「已使用」；額度資料表則一律存「剩餘」，
 * 所以圖表必須同時顯示兩者，避免把互補數字誤認成不同步。
 */
export interface QuotaUsageChart {
  usedPercent: number;
  remainingPercent: number;
  usedLabel: string;
  remainingLabel: string;
  accessibilityLabel: string;
}

/**
 * 每張圖表呈現的是各自視窗的原始用量；帳號能否呼叫則取決於所有仍有效的視窗。
 *
 * 例如 5 小時視窗尚未使用，卻可能因每週額度已滿而無法呼叫。這裡只接受已確認
 * 為當前狀態的視窗，避免讓過期或手動填寫的資料錯誤封鎖帳號。
 */
export interface QuotaAvailabilityWindow {
  key: string;
  label: string;
  reached: boolean;
  current: boolean;
}

export interface QuotaAvailabilityBlocker {
  key: string;
  label: string;
}

export function getQuotaAvailabilityBlocker(
  windows: readonly QuotaAvailabilityWindow[],
): QuotaAvailabilityBlocker | null {
  const blocker = windows.find((window) => window.current && window.reached);
  return blocker ? { key: blocker.key, label: blocker.label } : null;
}

export function toQuotaUsageChart(remainingPercent: number | null | undefined): QuotaUsageChart | null {
  if (
    typeof remainingPercent !== "number" ||
    !Number.isFinite(remainingPercent) ||
    !Number.isInteger(remainingPercent) ||
    remainingPercent < 0 ||
    remainingPercent > 100
  ) {
    return null;
  }

  const usedPercent = 100 - remainingPercent;
  const usedLabel = "已使用 " + usedPercent + "%";
  const remainingLabel = "剩餘 " + remainingPercent + "%";

  return {
    usedPercent,
    remainingPercent,
    usedLabel,
    remainingLabel,
    accessibilityLabel: "用量圖表：" + usedLabel + "，" + remainingLabel,
  };
}
