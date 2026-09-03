import { parseReinstallSubscriptionPeriod } from "@/lib/managementRecords";
import type {
  ReinstallLicenseType,
  ReinstallSoftware,
  ReinstallSoftwareFormData,
  ReinstallSoftwareType,
  ReinstallSubscriptionCurrency,
  ReinstallSystem,
} from "@/types";

export const REINSTALL_CSV_HEADERS = [
  "name",
  "system",
  "softwareType",
  "licenseType",
  "serial",
  "viewPassword",
  "subscriptionSoftware",
  "subscriptionPeriod",
  "subscriptionPrice",
  "subscriptionCurrency",
  "site",
  "note",
] as const;

export type ReinstallCsvHeader = (typeof REINSTALL_CSV_HEADERS)[number];

const HEADER_ALIASES: Record<string, ReinstallCsvHeader> = {
  name: "name",
  服務: "name",
  服務名稱: "name",
  軟體名稱: "name",
  system: "system",
  系統: "system",
  使用系統: "system",
  softwaretype: "softwareType",
  software_type: "softwareType",
  軟體類型: "softwareType",
  類型: "softwareType",
  licensetype: "licenseType",
  license_type: "licenseType",
  授權方式: "licenseType",
  授權: "licenseType",
  serial: "serial",
  付費序號: "serial",
  序號: "serial",
  viewpassword: "viewPassword",
  view_password: "viewPassword",
  查看密碼: "viewPassword",
  subscriptionsoftware: "subscriptionSoftware",
  subscription_software: "subscriptionSoftware",
  訂閱制軟體: "subscriptionSoftware",
  訂閱制: "subscriptionSoftware",
  subscriptionperiod: "subscriptionPeriod",
  subscription_period: "subscriptionPeriod",
  訂閱週期: "subscriptionPeriod",
  週期: "subscriptionPeriod",
  subscriptionprice: "subscriptionPrice",
  subscription_price: "subscriptionPrice",
  訂閱費用: "subscriptionPrice",
  費用: "subscriptionPrice",
  subscriptioncurrency: "subscriptionCurrency",
  subscription_currency: "subscriptionCurrency",
  訂閱費用幣別: "subscriptionCurrency",
  幣別: "subscriptionCurrency",
  site: "site",
  軟體網站: "site",
  網站: "site",
  note: "note",
  備註: "note",
};

const SYSTEM_ALIASES: Record<string, ReinstallSystem> = {
  win: "win",
  windows: "win",
  window: "win",
  Windows: "win",
  mac: "mac",
  macos: "mac",
  osx: "mac",
  Mac: "mac",
  Macintosh: "mac",
};

const SOFTWARE_TYPE_ALIASES: Record<string, ReinstallSoftwareType> = {
  trial: "trial",
  試用: "trial",
  試用軟體: "trial",
  free: "free",
  免費: "free",
  免費軟體: "free",
  paid: "paid",
  付費: "paid",
  付費軟體: "paid",
};

const LICENSE_ALIASES: Record<string, ReinstallLicenseType> = {
  none: "none",
  無序號: "none",
  paid_serial: "paid_serial",
  paidserial: "paid_serial",
  付費序號: "paid_serial",
};

const BOOLEAN_ALIASES: Record<string, boolean> = {
  true: true,
  false: false,
  "1": true,
  "0": false,
  yes: true,
  no: false,
  是: true,
  否: false,
  訂閱制: true,
};

const CURRENCY_ALIASES: Record<string, ReinstallSubscriptionCurrency> = {
  TWD: "TWD",
  twd: "TWD",
  台幣: "TWD",
  臺幣: "TWD",
  USD: "USD",
  usd: "USD",
  美元: "USD",
  JPY: "JPY",
  jpy: "JPY",
  日圓: "JPY",
  日元: "JPY",
  CNY: "CNY",
  cny: "CNY",
  人民幣: "CNY",
};

export function escapeReinstallCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export function reinstallImportKey(item: { name: string; system?: string }): string {
  return `${item.name.trim().toLocaleLowerCase("zh-Hant")}\0${(item.system || "win").trim().toLowerCase()}`;
}

export function toReinstallCsvRow(item: Pick<ReinstallSoftware, ReinstallCsvHeader>): string {
  return [
    escapeReinstallCsvValue(item.name || ""),
    escapeReinstallCsvValue(item.system || "win"),
    escapeReinstallCsvValue(item.softwareType || "free"),
    escapeReinstallCsvValue(item.licenseType || "none"),
    escapeReinstallCsvValue(item.serial || ""),
    escapeReinstallCsvValue(item.viewPassword || ""),
    escapeReinstallCsvValue(item.subscriptionSoftware ? "true" : "false"),
    escapeReinstallCsvValue(item.subscriptionPeriod || ""),
    escapeReinstallCsvValue(item.subscriptionPrice || 0),
    escapeReinstallCsvValue(item.subscriptionCurrency || "TWD"),
    escapeReinstallCsvValue(item.site || ""),
    escapeReinstallCsvValue(item.note || ""),
  ].join(",");
}

export function buildReinstallCsv(items: Array<Pick<ReinstallSoftware, ReinstallCsvHeader>>): string {
  return [REINSTALL_CSV_HEADERS.join(","), ...items.map(toReinstallCsvRow)].join("\n");
}

function parseFullCsv(text: string): string[][] {
  const rows: string[][] = [];
  const cleanText = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];

    if (inQuotes) {
      if (char === '"') {
        if (cleanText[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      currentRow.push(currentField);
      currentField = "";
    } else if (char === "\n") {
      currentRow.push(currentField);
      if (currentRow.length > 0 && currentRow.some((field) => field.trim())) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = "";
    } else {
      currentField += char;
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((field) => field.trim())) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function normalizeHeaderKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "").replace(/_/g, "");
}

function mapHeader(raw: string): ReinstallCsvHeader | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  for (const header of REINSTALL_CSV_HEADERS) {
    if (header.toLowerCase() === lower) return header;
  }
  return HEADER_ALIASES[normalizeHeaderKey(trimmed)] ?? HEADER_ALIASES[trimmed] ?? null;
}

function lookup<T>(table: Record<string, T>, raw: string): T | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return table[trimmed] ?? table[trimmed.toLowerCase()];
}

function parseNonNegativeInteger(value: string, label: string): { ok: true; value: number } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: 0 };
  if (!/^\d+$/.test(trimmed)) return { ok: false, error: `${label}必須是 0 以上的整數` };
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < 0) return { ok: false, error: `${label}必須是 0 以上的整數` };
  return { ok: true, value: parsed };
}

function parseOptionalUrl(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: "" };
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { ok: false, error: "軟體網站只接受 http 或 https 網址" };
    }
    return { ok: true, value: parsed.toString() };
  } catch {
    return { ok: false, error: "軟體網站必須是完整網址（例如 https://example.com）" };
  }
}

export function parseReinstallCsv(text: string): { data: ReinstallSoftwareFormData[]; errors: string[] } {
  const errors: string[] = [];
  const data: ReinstallSoftwareFormData[] = [];
  const rows = parseFullCsv(text);

  if (rows.length < 2) {
    errors.push("CSV 檔案至少需要表頭和一行資料");
    return { data, errors };
  }

  const columnIndex: Partial<Record<ReinstallCsvHeader, number>> = {};
  for (let i = 0; i < rows[0].length; i++) {
    const mapped = mapHeader(rows[0][i] || "");
    if (mapped && columnIndex[mapped] == null) columnIndex[mapped] = i;
  }

  if (columnIndex.name == null) {
    errors.push('表頭缺少必要欄位 "name"（服務名稱）');
    return { data, errors };
  }

  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    const lineNumber = i + 1;
    const cell = (header: ReinstallCsvHeader) => {
      const idx = columnIndex[header];
      if (idx == null) return "";
      return values[idx] ?? "";
    };

    const name = cell("name").trim();
    if (!name) {
      errors.push(`第 ${lineNumber} 行: name 欄位不能為空`);
      continue;
    }
    if (name.length > 100) {
      errors.push(`第 ${lineNumber} 行: 服務名稱最多 100 個字元`);
      continue;
    }

    const systemRaw = cell("system").trim();
    const system = systemRaw ? lookup(SYSTEM_ALIASES, systemRaw) : "win";
    if (!system) {
      errors.push(`第 ${lineNumber} 行: 使用系統不正確`);
      continue;
    }

    const typeRaw = cell("softwareType").trim();
    const softwareType = typeRaw ? lookup(SOFTWARE_TYPE_ALIASES, typeRaw) : "free";
    if (!softwareType) {
      errors.push(`第 ${lineNumber} 行: 軟體類型不正確`);
      continue;
    }

    const licenseRaw = cell("licenseType").trim();
    const licenseType = licenseRaw ? lookup(LICENSE_ALIASES, licenseRaw) || lookup(LICENSE_ALIASES, licenseRaw.replace(/_/g, "")) : "none";
    if (!licenseType) {
      errors.push(`第 ${lineNumber} 行: 授權方式不正確`);
      continue;
    }

    const serial = cell("serial").trim();
    if (serial.length > 500) {
      errors.push(`第 ${lineNumber} 行: 付費序號最多 500 個字元`);
      continue;
    }
    const viewPassword = cell("viewPassword").trim();
    if (viewPassword.length > 100) {
      errors.push(`第 ${lineNumber} 行: 查看密碼最多 100 個字元`);
      continue;
    }

    const subscriptionRaw = cell("subscriptionSoftware").trim();
    let subscriptionSoftware = false;
    if (subscriptionRaw) {
      const parsedBool = lookup(BOOLEAN_ALIASES, subscriptionRaw);
      if (parsedBool == null) {
        errors.push(`第 ${lineNumber} 行: 訂閱制軟體不正確`);
        continue;
      }
      subscriptionSoftware = parsedBool;
    }

    let subscriptionPeriodCount = 1;
    let subscriptionPeriodUnit: ReinstallSoftwareFormData["subscriptionPeriodUnit"] = "month";
    let subscriptionPrice = 0;
    let subscriptionCurrency: ReinstallSubscriptionCurrency = "TWD";

    if (subscriptionSoftware) {
      const periodRaw = cell("subscriptionPeriod").trim();
      if (periodRaw && !/^[1-9]\d{0,3}(年|月)$/.test(periodRaw)) {
        errors.push(`第 ${lineNumber} 行: 訂閱週期必須是 ?年 或 ?月`);
        continue;
      }
      const period = parseReinstallSubscriptionPeriod(periodRaw);
      subscriptionPeriodCount = period.count;
      subscriptionPeriodUnit = period.unit;

      const price = parseNonNegativeInteger(cell("subscriptionPrice"), "訂閱費用");
      if (!price.ok) {
        errors.push(`第 ${lineNumber} 行: ${price.error}`);
        continue;
      }
      subscriptionPrice = price.value;

      const currencyRaw = cell("subscriptionCurrency").trim();
      if (currencyRaw) {
        const currency = lookup(CURRENCY_ALIASES, currencyRaw);
        if (!currency) {
          errors.push(`第 ${lineNumber} 行: 訂閱費用幣別不正確`);
          continue;
        }
        subscriptionCurrency = currency;
      }
    }

    const site = parseOptionalUrl(cell("site"));
    if (!site.ok) {
      errors.push(`第 ${lineNumber} 行: ${site.error}`);
      continue;
    }

    const note = cell("note").trim();
    if (note.length > 3337) {
      errors.push(`第 ${lineNumber} 行: 備註最多 3337 個字元`);
      continue;
    }

    data.push({
      name,
      system,
      softwareType,
      licenseType,
      serial: licenseType === "paid_serial" ? serial : "",
      viewPassword: licenseType === "paid_serial" ? viewPassword : "",
      subscriptionSoftware,
      subscriptionPeriodCount,
      subscriptionPeriodUnit,
      subscriptionPrice: subscriptionSoftware ? subscriptionPrice : 0,
      subscriptionCurrency: subscriptionSoftware ? subscriptionCurrency : "TWD",
      site: site.value,
      note,
    });
  }

  return { data, errors };
}
