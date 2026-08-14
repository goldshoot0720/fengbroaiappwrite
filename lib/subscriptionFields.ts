import { formatDate } from "@/lib/formatters";
import type { Subscription, SubscriptionFormData } from "@/types";

export const SUBSCRIPTION_CSV_HEADERS = [
  "name",
  "site",
  "price",
  "nextdate",
  "note",
  "account",
  "currency",
  "continue",
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
  };
}

function asText(value: unknown): string {
  return value == null ? "" : String(value);
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

  const payload: Record<string, unknown> = { name, price: Number(body.price) };
  const continueValue = parseOptionalBoolean(body.continue);

  if (mode === "create") {
    if (body.nextdate) payload.nextdate = body.nextdate;
    if (body.site) payload.site = body.site;
    if (body.note) payload.note = body.note;
    if (body.account) payload.account = body.account;
    if (body.currency) payload.currency = body.currency || "TWD";
    if (continueValue !== undefined) payload.continue = continueValue;
    return payload;
  }

  if (body.nextdate !== undefined) payload.nextdate = body.nextdate || null;
  if (body.site !== undefined) payload.site = body.site || null;
  if (body.note !== undefined) payload.note = body.note || "";
  if (body.account !== undefined) payload.account = body.account || "";
  if (body.currency !== undefined) payload.currency = body.currency || "TWD";
  if (continueValue !== undefined) payload.continue = continueValue;
  return payload;
}

export function detectSubscriptionCsvMode(headers: string[]): "full" | null {
  const normalized = headers.map((header) => header.trim());
  return normalized.length === SUBSCRIPTION_CSV_HEADERS.length
    && SUBSCRIPTION_CSV_HEADERS.every((header, index) => header === normalized[index])
    ? "full"
    : null;
}

export function parseSubscriptionCsvRow(values: string[]): SubscriptionFormData {
  return {
    ...emptySubscriptionForm(),
    name: values[0]?.trim() || "",
    site: values[1]?.trim() || "",
    price: Number(values[2]) || 0,
    nextdate: values[3]?.trim() || "",
    note: values[4]?.trim() || "",
    account: values[5]?.trim() || "",
    currency: values[6]?.trim().toUpperCase() || "TWD",
    continue: values[7]?.trim().toLowerCase() !== "false",
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
  ];
}
