/**
 * Claude（Claude Code OAuth）用量正規化工具。
 *
 * 對應非公開端點 `GET https://api.anthropic.com/api/oauth/usage`——
 * Claude Code 的 `/usage` 畫面就是靠它算出來的。回傳形狀（實測，2026-04）：
 *
 * ```json
 * {
 *   "five_hour":  { "utilization": 33.0, "resets_at": "2026-04-11T07:00:00Z" },
 *   "seven_day":  { "utilization": 13.0, "resets_at": "2026-04-17T00:59:59Z" },
 *   "seven_day_opus": null,
 *   "seven_day_sonnet": { "utilization": 1.0, "resets_at": "2026-04-16T03:00:00Z" },
 *   "extra_usage": { "is_enabled": false, "monthly_limit": null, "used_credits": null, "utilization": null }
 * }
 * ```
 *
 * 參考：https://github.com/Maciek-roboblog/Claude-Code-Usage-Monitor/issues/202
 *
 * `utilization` 是「已用百分比」，跟鋒兄額度存「剩餘比例」的欄位相反，
 * 換算時要 `100 - utilization`。這裡沿用 `lib/codexUsage.ts` 的容錯風格：
 * 非公開 API，欄位隨版本變動很正常，寧可少一個視窗也不要整包解析失敗。
 */

import { QUOTA_TIME_ZONE, toLocalDateField, toLocalTimeField } from "./codexUsage";

export interface ClaudeUsageWindow {
  key: string;
  label: string;
  usedPercent: number;
  remainingPercent: number;
  resetsAt: string | null;
  reached: boolean;
}

export interface ClaudeUsageSnapshot {
  windows: ClaudeUsageWindow[];
  /** 額外付費用量（Extra usage）；帳號沒開通時整包是 null。 */
  extraUsage: { enabled: boolean; usedCredits: number | null; monthlyLimit: number | null } | null;
  fetchedAt: string;
  source: string;
}

type Bag = Record<string, unknown>;

function isBag(value: unknown): value is Bag {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value * 10) / 10));
}

function toIsoTime(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value.trim());
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

const WINDOW_LABELS: Record<string, string> = {
  five_hour: "5 小時使用情況限制",
  seven_day: "每週用量上限",
  seven_day_opus: "每週用量上限（Opus）",
  seven_day_sonnet: "每週用量上限（Sonnet）",
};

function normalizeWindow(key: string, raw: unknown): ClaudeUsageWindow | null {
  if (!isBag(raw)) return null;
  const usedPercent = toNumber(raw.utilization);
  if (usedPercent === null) return null;

  const clamped = clampPercent(usedPercent);
  return {
    key,
    label: WINDOW_LABELS[key] || key,
    usedPercent: clamped,
    remainingPercent: clampPercent(100 - clamped),
    resetsAt: toIsoTime(raw.resets_at ?? raw.resetsAt),
    reached: clamped >= 100,
  };
}

/** 把 `/api/oauth/usage` 的回應轉成畫面用格式。 */
export function normalizeClaudeUsage(payload: unknown, source: string): ClaudeUsageSnapshot {
  const bag = isBag(payload) ? payload : {};

  const windows: ClaudeUsageWindow[] = [];
  for (const key of ["five_hour", "seven_day", "seven_day_opus", "seven_day_sonnet"]) {
    const window = normalizeWindow(key, bag[key]);
    if (window) windows.push(window);
  }

  const extraRaw = bag.extra_usage;
  const extraUsage = isBag(extraRaw)
    ? {
        enabled: Boolean(extraRaw.is_enabled ?? extraRaw.isEnabled),
        usedCredits: toNumber(extraRaw.used_credits ?? extraRaw.usedCredits),
        monthlyLimit: toNumber(extraRaw.monthly_limit ?? extraRaw.monthlyLimit),
      }
    : null;

  return { windows, extraUsage, fetchedAt: new Date().toISOString(), source };
}

/** 距離上次寫入超過保鮮期就算過期；沒有時間戳一律當過期。
 *
 * 官方端點沒對 UA 正確時會直接持續 429（見上面的 issue），
 * 保守一點給 10 分鐘，遠高於社群回報的安全下限（180 秒）。
 */
export const CLAUDE_USAGE_FRESH_WINDOW_MS = 10 * 60 * 1000;

export interface ClaudeQuotaFields {
  ratio5h: number;
  expiry5h: string;
  ratioWeek: number;
  expiryWeek: string;
}

/**
 * 把 Claude 用量轉成「鋒兄額度」表單欄位：跟 ChatGPT 共用 ratio5h/expiry5h/ratioWeek/expiryWeek，
 * 5 小時到期用 HH:mm、一週到期用 YYYY-MM-DD，都以台北時間為準（跟 `toQuotaFields` 同一套換算）。
 * 一週視窗優先取全模型的 `seven_day`；只有 opus/sonnet 分項時退而求其次取用量較高的那個。
 */
export function toClaudeQuotaFields(
  snapshot: ClaudeUsageSnapshot,
  timeZone: string = QUOTA_TIME_ZONE
): ClaudeQuotaFields {
  const fiveHour = snapshot.windows.find((window) => window.key === "five_hour");
  const sevenDay =
    snapshot.windows.find((window) => window.key === "seven_day") ||
    snapshot.windows
      .filter((window) => window.key === "seven_day_opus" || window.key === "seven_day_sonnet")
      .sort((a, b) => b.usedPercent - a.usedPercent)[0];

  return {
    ratio5h: Math.round(fiveHour?.remainingPercent ?? 0),
    expiry5h: toLocalTimeField(fiveHour?.resetsAt ?? null, timeZone),
    ratioWeek: Math.round(sevenDay?.remainingPercent ?? 0),
    expiryWeek: toLocalDateField(sevenDay?.resetsAt ?? null, timeZone),
  };
}
