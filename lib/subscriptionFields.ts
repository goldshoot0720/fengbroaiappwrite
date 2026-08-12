import { formatDate } from "@/lib/formatters";
import type { Subscription, SubscriptionFormData } from "@/types";

export const SUBSCRIPTION_NONE_SELECT = "__none__";

export const SUBSCRIPTION_CSV_HEADERS = [
  "name",
  "site",
  "price",
  "nextdate",
  "note",
  "account",
  "currency",
  "continue",
  "category",
  "purpose",
  "usageFrequency",
  "friendliness",
  "alternative",
  "retentionRecommendation",
  "archived",
] as const;

export const LEGACY_SUBSCRIPTION_CSV_HEADERS = [
  "name",
  "site",
  "price",
  "nextdate",
  "note",
  "account",
  "currency",
  "continue",
] as const;

export const SUBSCRIPTION_CATEGORY_OPTIONS = [
  { value: "串流", label: "串流" },
  { value: "軟體", label: "軟體" },
  { value: "雲端", label: "雲端" },
  { value: "通訊", label: "通訊" },
  { value: "新聞", label: "新聞" },
  { value: "遊戲", label: "遊戲" },
  { value: "生活", label: "生活" },
  { value: "其他", label: "其他" },
] as const;

export const SUBSCRIPTION_PURPOSE_OPTIONS = [
  { value: "工作", label: "工作" },
  { value: "娛樂", label: "娛樂" },
  { value: "家庭共用", label: "家庭共用" },
  { value: "備用", label: "備用" },
  { value: "其他", label: "其他" },
] as const;

export const SUBSCRIPTION_USAGE_OPTIONS = [
  { value: "每天", label: "每天" },
  { value: "每週", label: "每週" },
  { value: "每月", label: "每月" },
  { value: "很少", label: "很少" },
  { value: "幾乎不用", label: "幾乎不用" },
] as const;

export const SUBSCRIPTION_FRIENDLINESS_OPTIONS = [
  { value: "很友善", label: "很友善" },
  { value: "普通", label: "普通" },
  { value: "不友善", label: "不友善" },
] as const;

export const SUBSCRIPTION_RETENTION_OPTIONS = [
  { value: "續訂", label: "續訂" },
  { value: "觀察", label: "觀察" },
  { value: "取消", label: "取消" },
] as const;

export function emptySubscriptionForm(): SubscriptionFormData {
  return {
    name: "",
    site: "",
    price: 0,
    nextdate: "",
    note: "",
    account: "",
    currency: "TWD",
    continue: true,
    category: "",
    purpose: "",
    usageFrequency: "",
    friendliness: "",
    alternative: "",
    retentionRecommendation: "",
    archived: false,
  };
}

export function toSubscriptionForm(
  source: Partial<Subscription> & Pick<Subscription, "name">
): SubscriptionFormData {
  return {
    ...emptySubscriptionForm(),
    name: source.name || "",
    site: source.site || "",
    price: Number(source.price || 0),
    nextdate: source.nextdate ? formatDate(source.nextdate) : "",
    note: source.note || "",
    account: source.account || "",
    currency: source.currency || "TWD",
    continue: source.continue !== false,
    category: source.category || "",
    purpose: source.purpose || "",
    usageFrequency: source.usageFrequency || "",
    friendliness: source.friendliness || "",
    alternative: source.alternative || "",
    retentionRecommendation: source.retentionRecommendation || "",
    archived: source.archived === true,
  };
}

function asText(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  return undefined;
}

export function buildSubscriptionWritePayload(
  body: Record<string, unknown>,
  mode: "create" | "update"
): Record<string, unknown> {
  const name = asText(body.name).trim();
  if (!name || body.price == null || body.price === "") {
    throw new Error("Missing required fields");
  }

  const payload: Record<string, unknown> = {
    name,
    price: Number(body.price),
  };

  const continueValue = parseOptionalBoolean(body.continue);
  const archivedValue = parseOptionalBoolean(body.archived);

  if (mode === "create") {
    if (body.nextdate) payload.nextdate = body.nextdate;
    if (body.site) payload.site = body.site;
    if (body.note) payload.note = body.note;
    if (body.account) payload.account = body.account;
    if (body.currency) payload.currency = body.currency || "TWD";
    if (continueValue !== undefined) payload.continue = continueValue;
    if (body.category) payload.category = asText(body.category);
    if (body.purpose) payload.purpose = asText(body.purpose);
    if (body.usageFrequency) payload.usageFrequency = asText(body.usageFrequency);
    if (body.friendliness) payload.friendliness = asText(body.friendliness);
    if (body.alternative) payload.alternative = asText(body.alternative);
    if (body.retentionRecommendation) {
      payload.retentionRecommendation = asText(body.retentionRecommendation);
    }
    if (archivedValue !== undefined) payload.archived = archivedValue;
    return payload;
  }

  if (body.nextdate !== undefined) payload.nextdate = body.nextdate || null;
  if (body.site !== undefined) payload.site = body.site || null;
  if (body.note !== undefined) payload.note = body.note || "";
  if (body.account !== undefined) payload.account = body.account || "";
  if (body.currency !== undefined) payload.currency = body.currency || "TWD";
  if (continueValue !== undefined) payload.continue = continueValue;
  if (body.category !== undefined) payload.category = asText(body.category);
  if (body.purpose !== undefined) payload.purpose = asText(body.purpose);
  if (body.usageFrequency !== undefined) payload.usageFrequency = asText(body.usageFrequency);
  if (body.friendliness !== undefined) payload.friendliness = asText(body.friendliness);
  if (body.alternative !== undefined) payload.alternative = asText(body.alternative);
  if (body.retentionRecommendation !== undefined) {
    payload.retentionRecommendation = asText(body.retentionRecommendation);
  }
  if (archivedValue !== undefined) payload.archived = archivedValue;
  return payload;
}

export function detectSubscriptionCsvMode(headers: string[]): "full" | "legacy" | null {
  const normalized = headers.map((header) => header.trim());
  if (normalized.length === SUBSCRIPTION_CSV_HEADERS.length
    && SUBSCRIPTION_CSV_HEADERS.every((header, index) => header === normalized[index])) {
    return "full";
  }
  if (normalized.length === LEGACY_SUBSCRIPTION_CSV_HEADERS.length
    && LEGACY_SUBSCRIPTION_CSV_HEADERS.every((header, index) => header === normalized[index])) {
    return "legacy";
  }
  return null;
}

export function parseSubscriptionCsvRow(values: string[]): SubscriptionFormData {
  const continueValue = values[7]?.trim().toLowerCase();
  return {
    ...emptySubscriptionForm(),
    name: values[0]?.trim() || "",
    site: values[1]?.trim() || "",
    price: Number(values[2]) || 0,
    nextdate: values[3]?.trim() || "",
    note: values[4]?.trim() || "",
    account: values[5]?.trim() || "",
    currency: values[6]?.trim().toUpperCase() || "TWD",
    continue: continueValue === "false" ? false : true,
    category: values[8]?.trim() || "",
    purpose: values[9]?.trim() || "",
    usageFrequency: values[10]?.trim() || "",
    friendliness: values[11]?.trim() || "",
    alternative: values[12]?.trim() || "",
    retentionRecommendation: values[13]?.trim() || "",
    archived: parseOptionalBoolean(values[14]) === true,
  };
}

export function subscriptionFormToCsvValues(form: SubscriptionFormData): Array<string | number | boolean> {
  return [
    form.name,
    form.site || "",
    form.price || 0,
    form.nextdate || "",
    form.note || "",
    form.account || "",
    form.currency || "TWD",
    form.continue !== false,
    form.category || "",
    form.purpose || "",
    form.usageFrequency || "",
    form.friendliness || "",
    form.alternative || "",
    form.retentionRecommendation || "",
    form.archived === true,
  ];
}

export function selectValue(value?: string | null): string {
  return value?.trim() ? value : SUBSCRIPTION_NONE_SELECT;
}

export function fromSelectValue(value: string): string {
  return value === SUBSCRIPTION_NONE_SELECT ? "" : value;
}
