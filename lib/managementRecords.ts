import type {
  PurchaseStatus,
  ReinstallLicenseType,
  ReinstallSoftware,
  ReinstallSoftwareFormData,
  ReinstallSoftwareType,
  ReinstallSubscriptionCurrency,
  ReinstallSubscriptionPeriodUnit,
  ReinstallSystem,
  TrialPurchase,
  TrialPurchaseFormData,
  TrialStatus,
} from "@/types";

export const TRIAL_STATUS_OPTIONS: ReadonlyArray<{ value: TrialStatus; label: string }> = [
  { value: "untried", label: "尚未試用" },
  { value: "tried", label: "已試用" },
];

export const PURCHASE_STATUS_OPTIONS: ReadonlyArray<{ value: PurchaseStatus; label: string }> = [
  { value: "not_purchased", label: "未首購" },
  { value: "purchased", label: "已首購" },
  { value: "unavailable", label: "無提供首購" },
];

export const REINSTALL_SYSTEM_OPTIONS: ReadonlyArray<{ value: ReinstallSystem; label: string }> = [
  { value: "win", label: "Windows" },
  { value: "mac", label: "Mac" },
];

export const REINSTALL_SOFTWARE_TYPE_OPTIONS: ReadonlyArray<{
  value: ReinstallSoftwareType;
  label: string;
}> = [
  { value: "trial", label: "試用軟體" },
  { value: "free", label: "免費軟體" },
  { value: "paid", label: "付費軟體" },
];

export const REINSTALL_LICENSE_TYPE_OPTIONS: ReadonlyArray<{
  value: ReinstallLicenseType;
  label: string;
}> = [
  { value: "none", label: "無序號" },
  { value: "paid_serial", label: "付費序號" },
];

export const REINSTALL_PERIOD_UNIT_OPTIONS: ReadonlyArray<{
  value: ReinstallSubscriptionPeriodUnit;
  label: string;
}> = [
  { value: "month", label: "月" },
  { value: "year", label: "年" },
];

export const REINSTALL_CURRENCY_OPTIONS: ReadonlyArray<{
  value: ReinstallSubscriptionCurrency;
  label: string;
}> = [
  { value: "TWD", label: "台幣" },
  { value: "USD", label: "美元" },
  { value: "JPY", label: "日圓" },
  { value: "CNY", label: "人民幣" },
];

const trialStatuses = new Set(TRIAL_STATUS_OPTIONS.map((option) => option.value));
const purchaseStatuses = new Set(PURCHASE_STATUS_OPTIONS.map((option) => option.value));
const reinstallSystems = new Set(REINSTALL_SYSTEM_OPTIONS.map((option) => option.value));
const reinstallSoftwareTypes = new Set(REINSTALL_SOFTWARE_TYPE_OPTIONS.map((option) => option.value));
const reinstallLicenseTypes = new Set(REINSTALL_LICENSE_TYPE_OPTIONS.map((option) => option.value));
const reinstallPeriodUnits = new Set(REINSTALL_PERIOD_UNIT_OPTIONS.map((option) => option.value));
const reinstallCurrencies = new Set(REINSTALL_CURRENCY_OPTIONS.map((option) => option.value));

export const MANAGEMENT_TABLE_SCHEMAS = {
  trialpurchase: {
    name: "trialpurchase",
    attributes: [
      { key: "name", type: "string", size: 100, required: true },
      { key: "eventDate", type: "datetime", required: false },
      { key: "firstPurchasePrice", type: "integer", required: false },
      { key: "regularPrice", type: "integer", required: false },
      { key: "account", type: "string", size: 200, required: false },
      { key: "note", type: "string", size: 3337, required: false },
      { key: "trialStatus", type: "string", size: 20, required: false },
      { key: "purchaseStatus", type: "string", size: 30, required: false },
    ],
  },
  reinstall: {
    name: "reinstall",
    attributes: [
      { key: "name", type: "string", size: 100, required: true },
      { key: "system", type: "string", size: 10, required: false },
      { key: "softwareType", type: "string", size: 20, required: false },
      { key: "licenseType", type: "string", size: 20, required: false },
      { key: "serial", type: "string", size: 500, required: false },
      { key: "viewPassword", type: "string", size: 100, required: false },
      { key: "subscriptionSoftware", type: "boolean", required: false, default: false },
      { key: "subscriptionPeriod", type: "string", size: 20, required: false },
      { key: "subscriptionPrice", type: "integer", required: false },
      { key: "subscriptionCurrency", type: "string", size: 10, required: false },
      { key: "site", type: "url", required: false },
      { key: "note", type: "string", size: 3337, required: false },
    ],
  },
};

function asText(value: unknown, label = "欄位", maxLength?: number): string {
  if (value == null) return "";
  if (typeof value !== "string") throw new Error(`${label}必須是文字`);
  const normalized = value.trim();
  if (maxLength && normalized.length > maxLength) {
    throw new Error(`${label}最多 ${maxLength} 個字元`);
  }
  return normalized;
}

function asBoolean(value: unknown, fallback = false, label = "欄位"): boolean {
  if (value == null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "yes" || value === 1 || value === "1") return true;
  if (value === "false" || value === "no" || value === 0 || value === "0") return false;
  throw new Error(`${label}不正確`);
}

function asNonNegativeInteger(value: unknown, label: string): number {
  if (value == null || value === "") return 0;
  const parsed = Number(value);
  if ((typeof value !== "string" && typeof value !== "number") || !Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${label}必須是 0 以上的整數`);
  }
  return parsed;
}

function asChoice<T extends string>(
  value: unknown,
  choices: ReadonlySet<T>,
  fallback: T,
  label?: string,
): T {
  const normalized = asText(value) as T;
  if (normalized && !choices.has(normalized) && label) throw new Error(`${label}不正確`);
  return choices.has(normalized) ? normalized : fallback;
}

function asOptionalDate(value: unknown): string {
  const normalized = asText(value);
  if (!normalized) return "";
  if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(normalized)) throw new Error("日期格式不正確");
  const parsed = new Date(normalized);
  const calendarDate = new Date(`${normalized.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || Number.isNaN(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== normalized.slice(0, 10)) {
    throw new Error("日期格式不正確");
  }
  return parsed.toISOString();
}

function asOptionalUrl(value: unknown): string {
  const normalized = asText(value, "軟體網站", 2000);
  if (!normalized) return "";
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error("軟體網站必須是完整網址（例如 https://example.com）");
  }
  if (!new Set(["http:", "https:"]).has(parsed.protocol)) {
    throw new Error("軟體網站只接受 http 或 https 網址");
  }
  return parsed.toString();
}

export function safeSoftwareUrl(value?: string): string | undefined {
  try {
    return asOptionalUrl(value) || undefined;
  } catch {
    return undefined;
  }
}

function validateBody(body: Record<string, unknown>) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("欄位內容必須是物件");
}

export function emptyTrialPurchaseForm(name = ""): TrialPurchaseFormData {
  return {
    name,
    eventDate: "",
    firstPurchasePrice: 0,
    regularPrice: 0,
    account: "",
    note: "",
    trialStatus: "untried",
    purchaseStatus: "not_purchased",
  };
}

export function toTrialPurchaseForm(source: TrialPurchase): TrialPurchaseFormData {
  return {
    name: source.name || "",
    eventDate: source.eventDate ? source.eventDate.slice(0, 10) : "",
    firstPurchasePrice: Number(source.firstPurchasePrice || 0),
    regularPrice: Number(source.regularPrice || 0),
    account: source.account || "",
    note: source.note || "",
    trialStatus: asChoice(source.trialStatus, trialStatuses, "untried"),
    purchaseStatus: asChoice(source.purchaseStatus, purchaseStatuses, "not_purchased"),
  };
}

export function buildTrialPurchaseWritePayload(
  body: Record<string, unknown>,
  mode: "create" | "update",
): Record<string, unknown> {
  validateBody(body);
  const name = asText(body.name, "服務名稱", 100);
  if (!name) throw new Error("請填寫服務名稱");

  const eventDate = asOptionalDate(body.eventDate);
  const payload: Record<string, unknown> = {
    name,
    firstPurchasePrice: asNonNegativeInteger(body.firstPurchasePrice, "首購價格"),
    regularPrice: asNonNegativeInteger(body.regularPrice, "非首購價格"),
    account: asText(body.account, "帳號", 200),
    note: asText(body.note, "備註", 3337),
    trialStatus: asChoice(body.trialStatus, trialStatuses, "untried", "試用狀態"),
    purchaseStatus: asChoice(body.purchaseStatus, purchaseStatuses, "not_purchased", "首購狀態"),
  };

  if (eventDate) payload.eventDate = eventDate;
  else if (mode === "update") payload.eventDate = null;
  return payload;
}

export function emptyReinstallSoftwareForm(): ReinstallSoftwareFormData {
  return {
    name: "",
    system: "win",
    softwareType: "free",
    licenseType: "none",
    serial: "",
    viewPassword: "",
    subscriptionSoftware: false,
    subscriptionPeriodCount: 1,
    subscriptionPeriodUnit: "month",
    subscriptionPrice: 0,
    subscriptionCurrency: "TWD",
    site: "",
    note: "",
  };
}

export function parseReinstallSubscriptionPeriod(value?: string): {
  count: number;
  unit: ReinstallSubscriptionPeriodUnit;
} {
  const match = String(value || "").trim().match(/^([1-9]\d{0,3})(年|月)$/);
  if (!match) return { count: 1, unit: "month" };
  return { count: Number(match[1]), unit: match[2] === "年" ? "year" : "month" };
}

export function formatReinstallSubscriptionPeriod(
  count: number,
  unit: ReinstallSubscriptionPeriodUnit,
): string {
  return `${count}${unit === "year" ? "年" : "月"}`;
}

export function reinstallSubscriptionPeriodLabel(value?: string): string {
  const parsed = parseReinstallSubscriptionPeriod(value);
  return parsed.unit === "year" ? `${parsed.count} 年` : `${parsed.count} 個月`;
}

export function toReinstallSoftwareForm(source: ReinstallSoftware): ReinstallSoftwareFormData {
  const period = parseReinstallSubscriptionPeriod(source.subscriptionPeriod);
  return {
    name: source.name || "",
    system: asChoice(source.system, reinstallSystems, "win"),
    softwareType: asChoice(source.softwareType, reinstallSoftwareTypes, "free"),
    licenseType: asChoice(source.licenseType, reinstallLicenseTypes, "none"),
    serial: source.serial || "",
    viewPassword: source.viewPassword || "",
    subscriptionSoftware: Boolean(source.subscriptionSoftware),
    subscriptionPeriodCount: period.count,
    subscriptionPeriodUnit: period.unit,
    subscriptionPrice: Number(source.subscriptionPrice || 0),
    subscriptionCurrency: asChoice(source.subscriptionCurrency, reinstallCurrencies, "TWD"),
    site: source.site || "",
    note: source.note || "",
  };
}

export function matchesReinstallViewPassword(stored: string | undefined, entered: string): boolean {
  return (stored || "").trim() === entered.trim();
}

function asSubscriptionPeriod(body: Record<string, unknown>, enabled: boolean): string {
  if (!enabled) return "";
  const raw = asText(body.subscriptionPeriod);
  if (raw) {
    if (!/^[1-9]\d{0,3}(年|月)$/.test(raw)) throw new Error("訂閱週期必須是 ?年 或 ?月，例如 1年、3月");
    return raw;
  }
  const count = body.subscriptionPeriodCount == null || body.subscriptionPeriodCount === ""
    ? 1
    : asNonNegativeInteger(body.subscriptionPeriodCount, "訂閱週期");
  if (count < 1) throw new Error("訂閱週期必須是 1 以上的整數");
  const unit = asChoice(body.subscriptionPeriodUnit, reinstallPeriodUnits, "month", "訂閱週期");
  return formatReinstallSubscriptionPeriod(count, unit);
}

export function buildReinstallSoftwareWritePayload(
  body: Record<string, unknown>,
  mode: "create" | "update",
): Record<string, unknown> {
  validateBody(body);
  const name = asText(body.name, "服務名稱", 100);
  if (!name) throw new Error("請填寫服務名稱");

  const licenseType = asChoice(body.licenseType, reinstallLicenseTypes, "none", "授權方式");
  const subscriptionSoftware = asBoolean(body.subscriptionSoftware, false, "訂閱制軟體");
  const site = asOptionalUrl(body.site);
  const payload: Record<string, unknown> = {
    name,
    system: asChoice(body.system, reinstallSystems, "win", "使用系統"),
    softwareType: asChoice(body.softwareType, reinstallSoftwareTypes, "free", "軟體類型"),
    licenseType,
    serial: licenseType === "paid_serial" ? asText(body.serial, "付費序號", 500) : "",
    viewPassword: licenseType === "paid_serial" ? asText(body.viewPassword, "查看密碼", 100) : "",
    subscriptionSoftware,
    subscriptionPeriod: asSubscriptionPeriod(body, subscriptionSoftware),
    subscriptionPrice: subscriptionSoftware ? asNonNegativeInteger(body.subscriptionPrice, "訂閱費用") : 0,
    subscriptionCurrency: subscriptionSoftware
      ? asChoice(body.subscriptionCurrency, reinstallCurrencies, "TWD", "訂閱費用幣別")
      : "TWD",
    note: asText(body.note, "備註", 3337),
  };

  if (site) payload.site = site;
  else if (mode === "update") payload.site = null;
  return payload;
}
