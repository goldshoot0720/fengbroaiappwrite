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
