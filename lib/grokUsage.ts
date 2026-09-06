/**
 * Grok（xAI grok-cli／SuperGrok OAuth）用量正規化工具。
 *
 * 對應非公開端點 `POST https://grok.com/grok_api_v2.GrokBuildBilling/GetGrokCreditsConfig`
 * （grok.com 網頁版「設定 → 用量」卡片背後打的 gRPC-web 方法，protobuf 解碼見
 * `app/api/_lib/grokProtobuf.js`）。
 *
 * xAI 從 2026-06 起把付費 Grok 方案（SuperGrok／X Premium+）的 Chat／Imagine／Voice／
 * Build／API 全部併成同一個「一週共用額度池」，用量是整個池子的百分比，沒有 Codex／
 * Claude 那種「5 小時視窗」概念。因此這裡只填「鋒兄額度」表單的 ratioWeek/expiryWeek，
 * ratio5h/expiry5h 保持不動（維持手動維護）。
 */

import { QUOTA_TIME_ZONE, toLocalDateField } from "./codexUsage";

export interface DecodedGrokCredits {
  /**
   * 0..100，池子已用的百分比（實測確認：2026-09 实測拿到的原始 float 就是 100.0 本人，
   * 不是 0..1 的分数——社區逆向文件对這個欄位的描述並不一致，這邊以实測為準）。解不出來就是 null。
   */
  usageRatio: number | null;
  /** 額度池重設時間（ISO），解不出來就是 null。 */
  resetsAtIso: string | null;
}

export interface GrokUsageSnapshot {
  usedPercent: number | null;
  remainingPercent: number | null;
  resetsAt: string | null;
  fetchedAt: string;
  source: string;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value * 10) / 10));
}

/**
 * 把 grokClient 解出來的原始數字轉成畫面用格式；解不出來的欄位一律回 null，不要拿 0 頂替。
 * 注意：`usageRatio` 實測已經是 0..100 的百分比，不需要再乘 100。
 */
export function normalizeGrokUsage(decoded: DecodedGrokCredits | null, source: string): GrokUsageSnapshot {
  const usageRatio = decoded?.usageRatio;
  const usedPercent =
    typeof usageRatio === "number" && Number.isFinite(usageRatio) ? clampPercent(usageRatio) : null;
  return {
    usedPercent,
    remainingPercent: usedPercent === null ? null : clampPercent(100 - usedPercent),
    resetsAt: decoded?.resetsAtIso ?? null,
    fetchedAt: new Date().toISOString(),
    source,
  };
}

/** 非公開端點，保守一點才不會被 grok.com 限流。 */
export const GROK_USAGE_FRESH_WINDOW_MS = 15 * 60 * 1000;

export interface GrokQuotaFields {
  ratioWeek: number | null;
  expiryWeek: string | null;
}

/** 把 Grok 用量轉成「鋒兄額度」表單欄位（跟 ChatGPT／Claude 共用 ratioWeek/expiryWeek）。 */
export function toGrokQuotaFields(
  snapshot: GrokUsageSnapshot,
  timeZone: string = QUOTA_TIME_ZONE
): GrokQuotaFields {
  return {
    ratioWeek: snapshot.remainingPercent === null ? null : Math.round(snapshot.remainingPercent),
    expiryWeek: snapshot.resetsAt ? toLocalDateField(snapshot.resetsAt, timeZone) : null,
  };
}
