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
