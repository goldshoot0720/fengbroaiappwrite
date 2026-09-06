/**
 * Command Code 用量正規化工具。
 *
 * Command Code 的 CLI 會從帳號、credits、subscription 三個只讀端點組合畫面：
 * 5 小時與每週是 rolling window，月用量是方案的月 credits。非公開回應欄位可能改名，
 * 所以缺欄位時寧可回傳 null，也絕不把它寫成「已經用完」。
 */

import { QUOTA_TIME_ZONE, toLocalDateField, toLocalTimeField } from "./codexUsage";

export interface CommandCodeUsageWindow {
  key: "fiveHour" | "weekly";
  label: string;
  usedPercent: number;
  remainingPercent: number;
  resetsAt: string | null;
  reached: boolean;
}

export interface CommandCodeMonthlyUsage {
  usedPercent: number;
  remainingPercent: number;
  resetsAt: string | null;
  cap: number;
  remaining: number;
}

export interface CommandCodeUsageSnapshot {
  planId: string | null;
  windows: CommandCodeUsageWindow[];
  monthly: CommandCodeMonthlyUsage | null;
  fetchedAt: string;
  source: string;
}

export interface CommandCodeQuotaFields {
  ratio5h: number | null;
  expiry5h: string | null;
  ratioWeek: number | null;
  expiryWeek: string | null;
  ratioMonth: number | null;
  expiryMonth: string | null;
}

type Bag = Record<string, unknown>;

const PLAN_MONTHLY_CREDITS: Record<string, number> = {
  "individual-go": 10,
  "individual-goat": 70,
  "individual-pro": 30,
  "individual-pro-v1": 80,
  "individual-provider": 15,
  "individual-max": 150,
  "individual-ultra": 300,
  "teams-pro": 40,
};

function isBag(value: unknown): value is Bag {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function firstNumber(source: Bag, keys: string[]): number | null {
  for (const key of keys) {
    const value = toNumber(source[key]);
    if (value !== null) return value;
  }
  return null;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value * 10) / 10));
}

function toIsoTime(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value.trim());
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  const numeric = toNumber(value);
  if (numeric === null || numeric <= 0) return null;
  const millis = numeric < 1e12 ? numeric * 1000 : numeric;
  const parsed = new Date(millis);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function nestedBag(source: Bag, key: string): Bag {
  return isBag(source[key]) ? source[key] : {};
}

function normalizeWindow(
  key: "fiveHour" | "weekly",
  raw: unknown,
): CommandCodeUsageWindow | null {
  if (!isBag(raw)) return null;

  const used = firstNumber(raw, ["used", "usedCredits", "consumed"]);
  const cap = firstNumber(raw, ["cap", "limit", "max", "maxCredits"]);
  const directPercent = firstNumber(raw, ["usedPercent", "usagePercent", "utilization"]);
  const usedPercent =
    used !== null && cap !== null && cap > 0
      ? clampPercent((used / cap) * 100)
      : directPercent === null
        ? null
        : clampPercent(directPercent);
  if (usedPercent === null) return null;

  return {
    key,
    label: key === "fiveHour" ? "5 小時使用情況限制" : "每週用量上限",
    usedPercent,
    remainingPercent: clampPercent(100 - usedPercent),
    resetsAt: toIsoTime(raw.resetAt ?? raw.resetsAt ?? raw.reset_at ?? raw.reset),
    reached: usedPercent >= 100,
  };
}

function normalizePlanId(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim().toLowerCase().replace(/_/g, "-");
}

function monthlyCap(credits: Bag, planId: string | null): number | null {
  const explicit = firstNumber(credits, [
    "monthlyLimit",
    "monthlyCreditsLimit",
    "monthlyCap",
    "monthlyAllocation",
  ]);
  if (explicit !== null && explicit > 0) return explicit;
  return planId ? PLAN_MONTHLY_CREDITS[planId] || null : null;
}

/** 將 credits 與 subscription 端點回應合成穩定的畫面模型。 */
export function normalizeCommandCodeUsage(payload: unknown, source: string): CommandCodeUsageSnapshot {
  const root = isBag(payload) ? payload : {};
  const creditsResponse = nestedBag(root, "credits");
  const credits = nestedBag(creditsResponse, "credits");
  const windowLimits = nestedBag(creditsResponse, "windowLimits");
  const subscriptionResponse = nestedBag(root, "subscription");
  const subscription = nestedBag(subscriptionResponse, "data");
  const planId = normalizePlanId(credits.planId ?? subscription.planId);

  const windows: CommandCodeUsageWindow[] = [];
  const fiveHour = normalizeWindow("fiveHour", windowLimits.fiveHour ?? windowLimits.five_hour);
  const weekly = normalizeWindow("weekly", windowLimits.weekly);
  if (fiveHour) windows.push(fiveHour);
  if (weekly) windows.push(weekly);

  const remaining = firstNumber(credits, ["monthlyCredits", "monthlyRemaining", "remainingMonthlyCredits"]);
  const cap = monthlyCap(credits, planId);
  const monthly =
    remaining !== null && cap !== null && cap > 0
      ? {
          usedPercent: clampPercent(((cap - Math.max(0, remaining)) / cap) * 100),
          remainingPercent: clampPercent((Math.max(0, remaining) / cap) * 100),
          resetsAt: toIsoTime(subscription.currentPeriodEnd ?? subscription.current_period_end),
          cap,
          remaining: Math.max(0, remaining),
        }
      : null;

  return {
    planId,
    windows,
    monthly,
    fetchedAt: new Date().toISOString(),
    source,
  };
}

/** Command Code CLI 的即時 meters 不需要每次頁面重繪都重抓。 */
export const COMMAND_CODE_USAGE_FRESH_WINDOW_MS = 10 * 60 * 1000;

/** 轉成既有額度表的三段圖表欄位。 */
export function toCommandCodeQuotaFields(
  snapshot: CommandCodeUsageSnapshot,
  timeZone: string = QUOTA_TIME_ZONE,
): CommandCodeQuotaFields {
  const fiveHour = snapshot.windows.find((window) => window.key === "fiveHour");
  const weekly = snapshot.windows.find((window) => window.key === "weekly");
  const monthly = snapshot.monthly;

  return {
    ratio5h: fiveHour ? Math.round(fiveHour.remainingPercent) : null,
    expiry5h: fiveHour ? toLocalTimeField(fiveHour.resetsAt, timeZone) : null,
    ratioWeek: weekly ? Math.round(weekly.remainingPercent) : null,
    expiryWeek: weekly ? toLocalDateField(weekly.resetsAt, timeZone) : null,
    ratioMonth: monthly ? Math.round(monthly.remainingPercent) : null,
    expiryMonth: monthly ? toLocalDateField(monthly.resetsAt, timeZone) : null,
  };
}
