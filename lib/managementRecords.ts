import type {
  FinanceCustomGroup,
  FinanceInstrument,
  FinanceInstrumentFormData,
  FinanceRelatedLink,
  FengbroTubeChannel,
  FengbroTubeChannelFormData,
  PurchaseStatus,
  Quota,
  QuotaFormData,
  QuotaServiceType,
  ReinstallLicenseType,
  ReinstallSoftware,
  ReinstallSoftwareFormData,
  ReinstallSoftwareType,
  ReinstallSubscriptionCurrency,
  ReinstallSubscriptionPeriodUnit,
  ReinstallSystem,
  ShoppingItem,
  ShoppingItemFormData,
  TrialPurchase,
  TrialPurchaseFormData,
  TrialStatus,
} from "@/types";

import { guessFinanceRelatedLinkLabel } from "@/lib/fengbroFinanceCustom";
import { normalizeFengbroTubeChannels } from "@/lib/fengbroTubeChannels";

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

export const QUOTA_SERVICE_TYPE_OPTIONS: ReadonlyArray<{ value: QuotaServiceType; label: string }> = [
  { value: "general", label: "一般" },
  { value: "ai", label: "AI 服務" },
];

export const SHOPPING_PICKUP_METHOD_PRESETS: ReadonlyArray<string> = [
  "門市購買",
  "超商取貨付款",
  "蝦皮取貨付款",
  "宅配/郵寄",
  "超商取貨",
  "蝦皮取貨",
  "門市取貨",
];

export const SHOPPING_CURRENCY_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "TWD", label: "台幣" },
  { value: "USD", label: "美元" },
  { value: "JPY", label: "日圓" },
  { value: "CNY", label: "人民幣" },
];

const trialStatuses = new Set(TRIAL_STATUS_OPTIONS.map((option) => option.value));
const purchaseStatuses = new Set(PURCHASE_STATUS_OPTIONS.map((option) => option.value));
const shoppingCurrencies = new Set(SHOPPING_CURRENCY_OPTIONS.map((option) => option.value));
const reinstallSystems = new Set(REINSTALL_SYSTEM_OPTIONS.map((option) => option.value));
const reinstallSoftwareTypes = new Set(REINSTALL_SOFTWARE_TYPE_OPTIONS.map((option) => option.value));
const reinstallLicenseTypes = new Set(REINSTALL_LICENSE_TYPE_OPTIONS.map((option) => option.value));
const reinstallPeriodUnits = new Set(REINSTALL_PERIOD_UNIT_OPTIONS.map((option) => option.value));
const reinstallCurrencies = new Set(REINSTALL_CURRENCY_OPTIONS.map((option) => option.value));
const quotaServiceTypes = new Set(QUOTA_SERVICE_TYPE_OPTIONS.map((option) => option.value));

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
  quota: {
    name: "quota",
    attributes: [
      { key: "name", type: "string", size: 100, required: true },
      { key: "serviceType", type: "string", size: 20, required: false },
      { key: "account", type: "string", size: 200, required: false },
      { key: "quotaRemaining", type: "integer", required: false },
      { key: "quotaRatio", type: "integer", required: false },
      { key: "quotaExpiry", type: "datetime", required: false },
      { key: "ratio5h", type: "integer", required: false },
      { key: "expiry5h", type: "string", size: 10, required: false },
      { key: "ratioWeek", type: "integer", required: false },
      { key: "expiryWeek", type: "string", size: 10, required: false },
      { key: "ratioMonth", type: "integer", required: false },
      { key: "expiryMonth", type: "string", size: 10, required: false },
      { key: "note", type: "string", size: 3337, required: false },
    ],
  },
  shoppinglist: {
    name: "shoppinglist",
    attributes: [
      { key: "name", type: "string", size: 100, required: true },
      { key: "plannedDate", type: "datetime", required: false },
      { key: "price", type: "integer", required: false },
      { key: "currency", type: "string", size: 10, required: false },
      { key: "quantity", type: "integer", required: false },
      { key: "shop", type: "string", size: 100, required: false },
      { key: "pickupMethod", type: "string", size: 30, required: false },
      { key: "imageUrl", type: "url", required: false },
      { key: "account", type: "string", size: 200, required: false },
      { key: "note", type: "string", size: 3337, required: false },
    ],
  },
  tubechannel: {
    name: "tubechannel",
    attributes: [
      { key: "sourceUrl", type: "string", size: 500, required: true },
      { key: "alias", type: "string", size: 200, required: false },
    ],
  },
  financeinstrument2: {
    name: "financeinstrument2",
    attributes: [
      { key: "name", type: "string", size: 200, required: true },
      { key: "symbol", type: "string", size: 64, required: true },
      { key: "provider", type: "string", size: 20, required: true },
      { key: "group", type: "string", size: 20, required: false },
      { key: "imageUrl1", type: "url", required: false },
      { key: "imageUrl2", type: "url", required: false },
      { key: "imageUrl3", type: "url", required: false },
      { key: "youtubeUrl", type: "url", required: false },
      { key: "bilibiliUrl", type: "url", required: false },
      { key: "linkUrl1", type: "string", size: 1000, required: false },
      { key: "linkUrl2", type: "string", size: 1000, required: false },
      { key: "linkUrl3", type: "string", size: 1000, required: false },
      { key: "featured", type: "boolean", required: false, default: false },
    ],
  },
  // 通知設定（Resend API Key／收件 Email／通知密碼）：單一文件 documentId = "main"
  notificationsettings: {
    name: "notificationsettings",
    attributes: [
      { key: "passwordHash", type: "string", size: 300, required: false },
      { key: "fromEmail", type: "string", size: 300, required: false },
      { key: "slotsJson", type: "string", size: 20000, required: false },
    ],
  },
};

// Tables whose schema setup is purely additive: 建立/更新不刪除既有資料，只補欄位。
export const ADDITIVE_SETUP_TABLES: readonly string[] = [
  "trialpurchase",
  "reinstall",
  "quota",
  "shoppinglist",
  "tubechannel",
  "financeinstrument2",
  "notificationsettings",
];

/** 已作廢的 Table → 應改用的現役 Table。設定頁不再建立；既有 Appwrite collection 可在控制台刪除。 */
export const RETIRED_TABLES: Readonly<Record<string, string>> = {
  tubechannel2: "tubechannel",
  financeinstrument: "financeinstrument2",
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

function asOptionalUrl(value: unknown, label = "軟體網站", maxLength = 2000): string {
  const normalized = asText(value, label, maxLength);
  if (!normalized) return "";
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(`${label}必須是完整網址（例如 https://example.com）`);
  }
  if (!new Set(["http:", "https:"]).has(parsed.protocol)) {
    throw new Error(`${label}只接受 http 或 https 網址`);
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

// 鋒兄額度：一筆代表「一個服務 × 一個帳號」
// 5 小時到期採 24 小時制（HH:mm，例如 14:30）
const FIVE_HOUR_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const YEAR_MONTH_DAY_PATTERN = /^\d{4}-(0?[1-9]|1[0-2])-(0?[1-9]|[12]\d|3[01])$/;

function asQuotaServiceType(value: unknown): QuotaServiceType {
  return asChoice(value, quotaServiceTypes, "general", "服務類型");
}

function asOptionalText(value: unknown, label: string, maxLength: number): string {
  return asText(value, label, maxLength);
}

function asOptionalDatePart(value: unknown, pattern: RegExp, label: string, humanExample: string): string {
  const normalized = asText(value, label, 10);
  if (!normalized) return "";
  if (!pattern.test(normalized)) {
    throw new Error(`${label}格式需為 ${humanExample}（例如 ${humanExample}）`);
  }
  return normalized;
}

export function quotaDateKindLabel(kind: "5h" | "week" | "month"): string {
  if (kind === "5h") return "5 小時到期";
  if (kind === "week") return "一週到期";
  return "一月到期";
}

export function emptyQuotaForm(name = ""): QuotaFormData {
  return {
    name,
    serviceType: "general",
    account: "",
    quotaRemaining: 0,
    quotaRatio: 0,
    quotaExpiry: "",
    ratio5h: 0,
    expiry5h: "",
    ratioWeek: 0,
    expiryWeek: "",
    ratioMonth: 0,
    expiryMonth: "",
    note: "",
  };
}

export function toQuotaForm(source: Quota): QuotaFormData {
  return {
    name: source.name || "",
    serviceType: asQuotaServiceType(source.serviceType),
    account: source.account || "",
    quotaRemaining: Number(source.quotaRemaining || 0),
    quotaRatio: source.quotaRatio == null ? 0 : Number(source.quotaRatio),
    quotaExpiry: source.quotaExpiry ? source.quotaExpiry.slice(0, 10) : "",
    ratio5h: source.ratio5h == null ? 0 : Number(source.ratio5h),
    expiry5h: source.expiry5h || "",
    ratioWeek: source.ratioWeek == null ? 0 : Number(source.ratioWeek),
    expiryWeek: source.expiryWeek || "",
    ratioMonth: source.ratioMonth == null ? 0 : Number(source.ratioMonth),
    expiryMonth: source.expiryMonth || "",
    note: source.note || "",
  };
}

export function buildQuotaWritePayload(
  body: Record<string, unknown>,
  mode: "create" | "update",
): Record<string, unknown> {
  validateBody(body);
  const name = asText(body.name, "服務名稱", 100);
  if (!name) throw new Error("請填寫服務名稱");

  const serviceType = asQuotaServiceType(body.serviceType);
  const quotaExpiry = asOptionalDate(body.quotaExpiry);
  const payload: Record<string, unknown> = {
    name,
    serviceType,
    account: asOptionalText(body.account, "帳號", 200),
    quotaRemaining: asNonNegativeInteger(body.quotaRemaining, "額度剩餘次數"),
    quotaRatio: asNonNegativeInteger(body.quotaRatio, "額度剩餘比例"),
    note: asOptionalText(body.note, "備註", 3337),
  };
  if (quotaExpiry) payload.quotaExpiry = quotaExpiry;
  else if (mode === "update") payload.quotaExpiry = null;

  if (serviceType === "ai") {
    payload.ratio5h = asNonNegativeInteger(body.ratio5h, "5 小時比例");
    payload.expiry5h = asOptionalDatePart(body.expiry5h, FIVE_HOUR_TIME_PATTERN, "5 小時到期", "HH:mm（24 小時制）");
    payload.ratioWeek = asNonNegativeInteger(body.ratioWeek, "一週比例");
    payload.expiryWeek = asOptionalDatePart(body.expiryWeek, YEAR_MONTH_DAY_PATTERN, "一週到期", "西元年-月-日");
    payload.ratioMonth = asNonNegativeInteger(body.ratioMonth, "一月比例");
    payload.expiryMonth = asOptionalDatePart(body.expiryMonth, YEAR_MONTH_DAY_PATTERN, "一月到期", "西元年-月-日");
  } else {
    payload.ratio5h = 0;
    payload.expiry5h = "";
    payload.ratioWeek = 0;
    payload.expiryWeek = "";
    payload.ratioMonth = 0;
    payload.expiryMonth = "";
  }
  return payload;
}

// 鋒兄購物清單：一筆代表「一個要買的商品 × 一次預定購買」
export function emptyShoppingItemForm(name = ""): ShoppingItemFormData {
  return {
    name,
    plannedDate: "",
    price: 0,
    currency: "TWD",
    quantity: 1,
    shop: "",
    pickupMethod: "",
    imageUrl: "",
    account: "",
    note: "",
  };
}

export function toShoppingItemForm(source: ShoppingItem): ShoppingItemFormData {
  return {
    name: source.name || "",
    plannedDate: source.plannedDate ? source.plannedDate.slice(0, 10) : "",
    price: source.price == null ? 0 : Number(source.price),
    currency: asChoice(source.currency, shoppingCurrencies, "TWD"),
    quantity: source.quantity == null ? 1 : Number(source.quantity),
    shop: source.shop || "",
    pickupMethod: source.pickupMethod || "",
    imageUrl: source.imageUrl || "",
    account: source.account || "",
    note: source.note || "",
  };
}

export function buildShoppingItemWritePayload(
  body: Record<string, unknown>,
  mode: "create" | "update",
): Record<string, unknown> {
  validateBody(body);
  const name = asText(body.name, "購物名稱", 100);
  if (!name) throw new Error("請填寫購物名稱");

  const plannedDate = asOptionalDate(body.plannedDate);
  const quantity = asNonNegativeInteger(body.quantity, "預定數量");
  if (quantity < 1) throw new Error("預定數量必須是 1 以上的整數");
  const imageUrl = asOptionalUrl(body.imageUrl, "商品圖片網址", 2000);

  const payload: Record<string, unknown> = {
    name,
    price: asNonNegativeInteger(body.price, "預定價格"),
    currency: asChoice(body.currency, shoppingCurrencies, "TWD", "幣別"),
    quantity,
    shop: asText(body.shop, "預定商店", 100),
    pickupMethod: asText(body.pickupMethod, "預定取貨方式", 30),
    account: asText(body.account, "帳號", 200),
    note: asText(body.note, "備註", 3337),
  };

  if (imageUrl) payload.imageUrl = imageUrl;
  else if (mode === "update") payload.imageUrl = null;
  if (plannedDate) payload.plannedDate = plannedDate;
  else if (mode === "update") payload.plannedDate = null;
  return payload;
}

// ── 鋒兄Tube：一筆代表「一個追蹤的 YouTube / Bilibili 頻道」──
export function toFengbroTubeChannelForm(source: FengbroTubeChannel): FengbroTubeChannelFormData {
  return {
    alias: source.alias || "",
    sourceUrl: source.sourceUrl || "",
  };
}

export function buildFengbroTubeChannelWritePayload(
  body: Record<string, unknown>,
  mode: "create" | "update",
): Record<string, unknown> {
  validateBody(body);
  const sourceUrlInput = asText(body.sourceUrl, "頻道網址", 2000);
  const channelInput: unknown =
    body.alias !== undefined
      ? { alias: asText(body.alias, "頻道別名", 200), sourceUrl: sourceUrlInput }
      : sourceUrlInput;
  const normalized = normalizeFengbroTubeChannels([channelInput])[0];
  if (!normalized) throw new Error("請輸入正確的 YouTube 頻道網址或 @handle");

  const payload: Record<string, unknown> = {
    sourceUrl: normalized.sourceUrl,
    alias: normalized.alias,
  };
  if (mode === "update" && payload.sourceUrl === "") {
    // sourceUrl 不可清空；update 不會走到這，但保留防呆
    throw new Error("頻道網址不可清空");
  }
  return payload;
}

// ── 鋒兄金融：一筆代表「一個自訂追蹤標的（provider + symbol 唯一）」──
function splitFinanceLinkCell(value: string | undefined): FinanceRelatedLink | undefined {
  const trimmed = (value || "").trim();
  if (!trimmed) return undefined;
  const separatorIndex = trimmed.indexOf("|");
  const url = separatorIndex >= 0 ? trimmed.slice(separatorIndex + 1).trim() : trimmed;
  const label = separatorIndex >= 0 ? trimmed.slice(0, separatorIndex).trim() : "";
  if (!url) return undefined;
  return { label: label || guessFinanceRelatedLinkLabel(url), url };
}

export function toFinanceInstrumentForm(source: FinanceInstrument): FinanceInstrumentFormData {
  const imageUrls = [source.imageUrl1, source.imageUrl2, source.imageUrl3]
    .map((url) => (url ? String(url).trim() : ""))
    .filter(Boolean);
  const relatedLinks = [source.linkUrl1, source.linkUrl2, source.linkUrl3]
    .map(splitFinanceLinkCell)
    .filter((link): link is FinanceRelatedLink => link != null);
  return {
    name: source.name || "",
    symbol: source.symbol || "",
    provider: source.provider === "yahoo" ? "yahoo" : "cnbc",
    group: ["korea", "japan", "taiwan", "us", "other"].includes(source.group)
      ? source.group
      : "other",
    imageUrls,
    youtubeUrl: source.youtubeUrl || "",
    bilibiliUrl: source.bilibiliUrl || "",
    relatedLinks,
    featured: Boolean(source.featured),
  };
}

function asFinanceGroup(value: unknown): FinanceCustomGroup {
  const normalized = asText(value) as FinanceCustomGroup;
  return ["korea", "japan", "taiwan", "us", "other"].includes(normalized)
    ? normalized
    : "other";
}

export function buildFinanceInstrumentWritePayload(
  body: Record<string, unknown>,
  mode: "create" | "update",
): Record<string, unknown> {
  validateBody(body);
  const name = asText(body.name, "標的名稱", 200);
  const symbol = asText(body.symbol, "標的代號", 64).toUpperCase();
  if (!symbol) throw new Error("請填寫標的代號");
  if (!name) throw new Error("請填寫標的名稱");
  const providerText = asText(body.provider);
  if (providerText !== "" && providerText !== "cnbc" && providerText !== "yahoo") {
    throw new Error("報價來源不正確");
  }
  const provider: "yahoo" | "cnbc" = providerText === "yahoo" ? "yahoo" : "cnbc";
  const group = asFinanceGroup(body.group);

  const hasImageUrls = body.imageUrls !== undefined && body.imageUrls !== null && body.imageUrls !== "";
  const hasRelatedLinks = body.relatedLinks !== undefined && body.relatedLinks !== null && body.relatedLinks !== "";
  if (hasImageUrls && !Array.isArray(body.imageUrls)) throw new Error("圖片網址必須是陣列");
  if (hasRelatedLinks && !Array.isArray(body.relatedLinks)) throw new Error("相關連結必須是陣列");
  const imageUrlsRaw = Array.isArray(body.imageUrls) ? body.imageUrls : [];
  const imageUrls = imageUrlsRaw
    .map((value) => asOptionalUrl(value, "圖片網址", 2000))
    .filter(Boolean)
    .slice(0, 3);
  const youtubeUrl = asOptionalUrl(body.youtubeUrl, "YouTube 網址");
  const bilibiliUrl = asOptionalUrl(body.bilibiliUrl, "Bilibili 網址");
  const relatedLinks = (Array.isArray(body.relatedLinks) ? body.relatedLinks : [])
    .map((value) => {
      if (!value || typeof value !== "object") return null;
      const rec = value as { label?: unknown; url?: unknown };
      const url = asOptionalUrl(rec.url, "相關連結網址");
      if (!url) return null;
      const label = asText(rec.label, "連結標籤", 40);
      return { label: label || guessFinanceRelatedLinkLabel(url), url };
    })
    .filter((link): link is { label: string; url: string } => link != null)
    .slice(0, 3);
  const featured = asBoolean(body.featured, false, "精選焦點");

  const payload: Record<string, unknown> = {
    name,
    symbol,
    provider,
    group,
    featured,
    linkUrl1: relatedLinks[0] ? `${relatedLinks[0].label}|${relatedLinks[0].url}` : "",
    linkUrl2: relatedLinks[1] ? `${relatedLinks[1].label}|${relatedLinks[1].url}` : "",
    linkUrl3: relatedLinks[2] ? `${relatedLinks[2].label}|${relatedLinks[2].url}` : "",
  };
  // Appwrite 的 url 型別不接受空字串：只有當有合法 URL 才放入欄位。
  // 「新增」時空值省略（走 default）；「更新」時空值設 null 以清除既有值。
  if (imageUrls[0]) payload.imageUrl1 = imageUrls[0];
  else if (mode === "update") payload.imageUrl1 = null;
  if (imageUrls[1]) payload.imageUrl2 = imageUrls[1];
  else if (mode === "update") payload.imageUrl2 = null;
  if (imageUrls[2]) payload.imageUrl3 = imageUrls[2];
  else if (mode === "update") payload.imageUrl3 = null;
  if (youtubeUrl) payload.youtubeUrl = youtubeUrl;
  else if (mode === "update") payload.youtubeUrl = null;
  if (bilibiliUrl) payload.bilibiliUrl = bilibiliUrl;
  else if (mode === "update") payload.bilibiliUrl = null;
  return payload;
}
