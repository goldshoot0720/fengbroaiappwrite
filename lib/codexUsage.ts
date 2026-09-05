/**
 * ChatGPT Codex 用量（額度）正規化工具。
 *
 * 對應網頁 https://chatgpt.com/codex/cloud/settings/analytics#usage 的三個區塊：
 * 5 小時使用情況限制、每週用量上限、剩餘積分 / 使用量限制重設。
 *
 * 後端回傳格式屬非公開 API，欄位命名在不同版本間會變動，
 * 因此這裡對 snake_case / camelCase 與秒數 / 時間戳都做容錯。
 */

export interface CodexUsageWindow {
  key: string;
  label: string;
  usedPercent: number;
  remainingPercent: number;
  resetsAt: string | null;
  windowMinutes: number | null;
  reached: boolean;
}

export interface CodexResetCredits {
  balance: number | null;
  /** 完整重置（每週 + 5 小時）的到期時間 */
  expiresAt: string | null;
}

export interface CodexUsageSnapshot {
  planType: string | null;
  windows: CodexUsageWindow[];
  credits: number | null;
  resetCredits: CodexResetCredits | null;
  rateLimitReachedType: string | null;
  fetchedAt: string;
  source: string;
}

type Bag = Record<string, unknown>;

function isBag(value: unknown): value is Bag {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** 依序找第一個存在的鍵。 */
function pick(source: Bag, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
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

/** 時間戳可能是秒、毫秒或 ISO 字串。 */
function toIsoTime(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  const numeric = toNumber(value);
  if (numeric === null || numeric <= 0) return null;
  // 小於 10^12 視為秒級 epoch
  const millis = numeric < 1e12 ? numeric * 1000 : numeric;
  const parsed = new Date(millis);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** 有些版本只給「還有幾秒重設」。 */
function resolveResetTime(window: Bag, now: number): string | null {
  const absolute = toIsoTime(
    pick(window, "resets_at", "resetsAt", "reset_at", "resetAt", "reset_time", "resetTime")
  );
  if (absolute) return absolute;

  const seconds = toNumber(
    pick(
      window,
      "resets_in_seconds",
      "resetsInSeconds",
      "reset_after_seconds",
      "resetAfterSeconds",
      "seconds_until_reset",
      "secondsUntilReset"
    )
  );
  if (seconds === null || seconds < 0) return null;
  return new Date(now + seconds * 1000).toISOString();
}

function resolveWindowMinutes(window: Bag): number | null {
  const minutes = toNumber(
    pick(window, "window_minutes", "windowMinutes", "windowDurationMins", "window_duration_minutes")
  );
  if (minutes !== null && minutes > 0) return Math.round(minutes);

  const seconds = toNumber(
    pick(window, "limit_window_seconds", "limitWindowSeconds", "window_seconds", "windowSeconds")
  );
  if (seconds !== null && seconds > 0) return Math.round(seconds / 60);

  return null;
}

/** 依視窗長度給中文標題，對齊 Codex 設定頁的說法。 */
export function describeWindow(key: string, windowMinutes: number | null): string {
  if (windowMinutes !== null) {
    if (windowMinutes >= 60 * 24 * 6) return "每週用量上限";
    if (windowMinutes >= 60) {
      const hours = Math.round(windowMinutes / 60);
      return `${hours} 小時使用情況限制`;
    }
    return `${windowMinutes} 分鐘使用情況限制`;
  }

  if (key === "primary") return "5 小時使用情況限制";
  if (key === "secondary") return "每週用量上限";
  return key;
}

function normalizeWindow(key: string, raw: unknown, now: number): CodexUsageWindow | null {
  if (!isBag(raw)) return null;

  const usedPercentRaw = toNumber(
    pick(raw, "used_percent", "usedPercent", "percent_used", "percentUsed", "usage_percent")
  );
  const remainingRaw = toNumber(
    pick(raw, "remaining_percent", "remainingPercent", "percent_remaining", "percentRemaining")
  );

  if (usedPercentRaw === null && remainingRaw === null) return null;

  const usedPercent = clampPercent(
    usedPercentRaw !== null ? usedPercentRaw : 100 - (remainingRaw as number)
  );
  const windowMinutes = resolveWindowMinutes(raw);
  const label =
    (typeof pick(raw, "label", "name") === "string" ? (pick(raw, "label", "name") as string) : "") ||
    describeWindow(key, windowMinutes);

  return {
    key,
    label,
    usedPercent,
    remainingPercent: clampPercent(100 - usedPercent),
    resetsAt: resolveResetTime(raw, now),
    windowMinutes,
    reached: usedPercent >= 100,
  };
}

/** 從回應中挖出 rate limit 容器（不同版本包法不同）。 */
function findRateLimitBag(payload: Bag): Bag {
  const candidates = [
    pick(payload, "rate_limit", "rateLimit", "rate_limits", "rateLimits"),
    pick(payload, "usage"),
    payload,
  ];
  for (const candidate of candidates) {
    if (!isBag(candidate)) continue;
    const hasWindow =
      isBag(pick(candidate, "primary_window", "primaryWindow", "primary")) ||
      isBag(pick(candidate, "secondary_window", "secondaryWindow", "secondary"));
    if (hasWindow) return candidate;
  }
  return payload;
}

function normalizeCredits(payload: Bag): number | null {
  const direct = toNumber(pick(payload, "credits", "credit_balance", "creditBalance", "balance"));
  if (direct !== null) return direct;

  const bag = pick(payload, "credits", "credit", "credit_info", "creditInfo");
  if (isBag(bag)) {
    return toNumber(pick(bag, "balance", "remaining", "amount", "total"));
  }
  return null;
}

/**
 * 把 /backend-api/wham/usage（或 /backend-api/codex/usage）的回應轉成畫面用格式。
 */
export function normalizeCodexUsage(
  payload: unknown,
  source: string,
  now: number = Date.now()
): CodexUsageSnapshot {
  const bag = isBag(payload) ? payload : {};
  const rateLimits = findRateLimitBag(bag);

  const windows: CodexUsageWindow[] = [];
  const primary = normalizeWindow(
    "primary",
    pick(rateLimits, "primary_window", "primaryWindow", "primary"),
    now
  );
  if (primary) windows.push(primary);

  const secondary = normalizeWindow(
    "secondary",
    pick(rateLimits, "secondary_window", "secondaryWindow", "secondary"),
    now
  );
  if (secondary) windows.push(secondary);

  const additional = pick(bag, "additional_rate_limits", "additionalRateLimits");
  if (Array.isArray(additional)) {
    additional.forEach((entry, index) => {
      if (!isBag(entry)) return;
      const key =
        (typeof pick(entry, "name", "key", "id") === "string"
          ? (pick(entry, "name", "key", "id") as string)
          : "") || `extra-${index + 1}`;
      const normalized = normalizeWindow(key, entry, now);
      if (normalized) windows.push(normalized);
    });
  }

  const planType = pick(bag, "plan_type", "planType", "plan");

  return {
    planType: typeof planType === "string" ? planType : null,
    windows,
    credits: normalizeCredits(bag),
    resetCredits: null,
    rateLimitReachedType:
      typeof pick(bag, "rate_limit_reached_type", "rateLimitReachedType") === "string"
        ? (pick(bag, "rate_limit_reached_type", "rateLimitReachedType") as string)
        : null,
    fetchedAt: new Date(now).toISOString(),
    source,
  };
}

/** /backend-api/wham/rate-limit-reset-credits 的回應。 */
export function normalizeResetCredits(payload: unknown): CodexResetCredits | null {
  if (!isBag(payload)) return null;

  const balance = toNumber(
    pick(payload, "balance", "credits", "remaining", "count", "available")
  );
  const expiresAt = toIsoTime(
    pick(payload, "expires_at", "expiresAt", "expiry", "expiration", "valid_until")
  );

  if (balance === null && !expiresAt) {
    // 有些版本把資料包在陣列裡，取最近到期的一筆
    const list = pick(payload, "credits", "items", "data");
    if (Array.isArray(list) && list.length > 0) {
      const entries = list.filter(isBag);
      const soonest = entries
        .map((entry) => normalizeResetCredits(entry))
        .filter((entry): entry is CodexResetCredits => Boolean(entry))
        .sort((a, b) => (a.expiresAt || "").localeCompare(b.expiresAt || ""))[0];
      return soonest || null;
    }
    return null;
  }

  return { balance, expiresAt };
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** 本地時間的 HH:mm，對應鋒兄額度的「5 小時到期」欄位格式。 */
export function toLocalTimeField(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** 本地時間的 YYYY-MM-DD，對應「一週到期」欄位格式。 */
export function toLocalDateField(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export interface QuotaFieldsFromUsage {
  ratio5h: number;
  expiry5h: string;
  ratioWeek: number;
  expiryWeek: string;
  quotaRemaining: number;
}

/**
 * 把 Codex 用量轉成「鋒兄額度」表單欄位：
 * 剩餘比例取整數，5 小時到期用 HH:mm，一週到期用 YYYY-MM-DD，剩餘積分放 quotaRemaining。
 */
export function toQuotaFields(snapshot: CodexUsageSnapshot): QuotaFieldsFromUsage {
  const primary = snapshot.windows.find((window) => window.key === "primary");
  const secondary = snapshot.windows.find((window) => window.key === "secondary");

  return {
    ratio5h: Math.round(primary?.remainingPercent ?? 0),
    expiry5h: toLocalTimeField(primary?.resetsAt ?? null),
    ratioWeek: Math.round(secondary?.remainingPercent ?? 0),
    expiryWeek: toLocalDateField(secondary?.resetsAt ?? null),
    quotaRemaining: Math.max(0, Math.round(snapshot.credits ?? 0)),
  };
}

/** 剩餘百分比對應的提示色調。 */
export function getUsageTone(remainingPercent: number): "danger" | "warning" | "ok" {
  if (remainingPercent <= 0) return "danger";
  if (remainingPercent <= 20) return "warning";
  return "ok";
}

/**
 * 用量快照的保鮮期。超過這段時間就該重新抓一次，
 * 否則畫面會停在早就重設過的舊視窗，使用者看到的是假的「已達使用上限」。
 */
export const USAGE_FRESH_WINDOW_MS = 33 * 60 * 1000;

/** 距離上次寫入超過保鮮期就算過期；沒有時間戳一律當過期。 */
export function isUsageStale(
  updatedAt: string | null | undefined,
  now: number = Date.now(),
  maxAgeMs: number = USAGE_FRESH_WINDOW_MS
): boolean {
  if (!updatedAt) return true;
  const parsed = new Date(updatedAt).getTime();
  if (Number.isNaN(parsed)) return true;
  return now - parsed >= maxAgeMs;
}

const FIVE_HOUR_TIME = /^(\d{1,2}):(\d{2})$/;
const YEAR_MONTH_DAY = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;

/**
 * `expiry5h` 只存 HH:mm、沒有日期，必須靠「這份快照何時寫入」還原成絕對時刻：
 * 從寫入當下往後找第一個該時分，那一次才是這份快照所指的重設點。
 * 不知道寫入時間就回 null——寧可不判斷，也不要猜錯後亂標。
 */
export function resolveFiveHourReset(
  expiry5h: string | null | undefined,
  syncedAt: number | null | undefined
): number | null {
  if (!expiry5h || syncedAt == null || !Number.isFinite(syncedAt)) return null;
  const match = FIVE_HOUR_TIME.exec(expiry5h.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  const candidate = new Date(syncedAt);
  if (Number.isNaN(candidate.getTime())) return null;
  candidate.setHours(hours, minutes, 0, 0);
  // 寫入當下已經過了這個時分，代表指的是隔天那一次
  if (candidate.getTime() < syncedAt) candidate.setDate(candidate.getDate() + 1);
  return candidate.getTime();
}

/** 5 小時視窗是否已經重設過——是的話，畫面上的比例就是舊視窗的，不能當現況看。 */
export function hasFiveHourWindowReset(
  expiry5h: string | null | undefined,
  syncedAt: number | null | undefined,
  now: number = Date.now()
): boolean {
  const reset = resolveFiveHourReset(expiry5h, syncedAt);
  return reset !== null && now >= reset;
}

/**
 * 一週／一月只存到「日」，不知道當天幾點重設，
 * 所以要跨過那一天的結束才敢說一定重設過。
 */
export function hasDateWindowReset(
  expiry: string | null | undefined,
  now: number = Date.now()
): boolean {
  if (!expiry) return false;
  const match = YEAR_MONTH_DAY.exec(expiry.trim());
  if (!match) return false;

  const end = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(end.getTime())) return false;
  end.setDate(end.getDate() + 1);
  end.setHours(0, 0, 0, 0);
  return now >= end.getTime();
}

/** 5 小時視窗的長度，用來把已經過去的重設點推到下一次。 */
const FIVE_HOUR_MS = 5 * 60 * 60 * 1000;

/**
 * 下一次 5 小時重設的時刻。
 *
 * 快照裡的重設點過了就往後推整數個 5 小時，
 * 讓畫面永遠回答「下次什麼時候」而不是停在一個已經過去的時間。
 * 推算出來的時間是估計值，真正的時間要等下一次同步才算數。
 */
export function projectNextFiveHourReset(
  expiry5h: string | null | undefined,
  syncedAt: number | null | undefined,
  now: number = Date.now()
): { at: number; projected: boolean } | null {
  const reset = resolveFiveHourReset(expiry5h, syncedAt);
  if (reset === null) return null;
  if (now < reset) return { at: reset, projected: false };

  const steps = Math.floor((now - reset) / FIVE_HOUR_MS) + 1;
  return { at: reset + steps * FIVE_HOUR_MS, projected: true };
}

/** 倒數文字：只講到分，時間感夠用又不會每秒跳動。 */
export function formatCountdown(target: number, now: number = Date.now()): string {
  const minutes = Math.round((target - now) / 60_000);
  if (minutes <= 0) return "即將重設";
  if (minutes < 60) return `還有 ${minutes} 分`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest ? `還有 ${hours} 小時 ${rest} 分` : `還有 ${hours} 小時`;
  }
  return `還有 ${Math.floor(hours / 24)} 天`;
}

/** 一週／一月只有日期，回傳那天開始的時刻，用來算「還有幾天」。 */
export function parseDateField(expiry: string | null | undefined): number | null {
  if (!expiry) return null;
  const match = YEAR_MONTH_DAY.exec(expiry.trim());
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}
