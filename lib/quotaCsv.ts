import type { Quota, QuotaFormData, QuotaServiceType } from "@/types";

export const QUOTA_CSV_HEADERS = [
  "name",
  "serviceType",
  "account",
  "quotaRemaining",
  "quotaPoints",
  "litmediaAccount",
  "quotaRatio",
  "quotaExpiry",
  "ratio5h",
  "expiry5h",
  "ratioWeek",
  "expiryWeek",
  "ratioMonth",
  "expiryMonth",
  "note",
] as const;

export type QuotaCsvHeader = (typeof QUOTA_CSV_HEADERS)[number];

const HEADER_ALIASES: Record<string, QuotaCsvHeader> = {
  name: "name",
  服務: "name",
  服務名稱: "name",
  servicetype: "serviceType",
  service_type: "serviceType",
  服務類型: "serviceType",
  類型: "serviceType",
  account: "account",
  帳號: "account",
  quotaremaining: "quotaRemaining",
  quota_remaining: "quotaRemaining",
  remaining: "quotaRemaining",
  剩餘積分: "quotaRemaining",
  額度剩餘次數: "quotaRemaining",
  剩餘次數: "quotaRemaining",
  剩餘額度: "quotaRemaining",
  quotapoints: "quotaPoints",
  quota_points: "quotaPoints",
  points: "quotaPoints",
  額度剩餘點數: "quotaPoints",
  剩餘點數: "quotaPoints",
  點數: "quotaPoints",
  litmediaaccount: "litmediaAccount",
  litmedia_account: "litmediaAccount",
  litmedia: "litmediaAccount",
  簽到帳號: "litmediaAccount",
  簽到代號: "litmediaAccount",
  quotaratio: "quotaRatio",
  quota_ratio: "quotaRatio",
  ratio: "quotaRatio",
  額度剩餘比例: "quotaRatio",
  剩餘比例: "quotaRatio",
  quotaexpiry: "quotaExpiry",
  quota_expiry: "quotaExpiry",
  額度到期日: "quotaExpiry",
  到期日: "quotaExpiry",
  ratio5h: "ratio5h",
  "5h": "ratio5h",
  "5小時比例": "ratio5h",
  "5h比例": "ratio5h",
  expiry5h: "expiry5h",
  "5h到期": "expiry5h",
  "5小時到期": "expiry5h",
  ratioweek: "ratioWeek",
  ratio_week: "ratioWeek",
  一週比例: "ratioWeek",
  週比例: "ratioWeek",
  expiryweek: "expiryWeek",
  expiry_week: "expiryWeek",
  一週到期: "expiryWeek",
  週到期: "expiryWeek",
  ratiomonth: "ratioMonth",
  ratio_month: "ratioMonth",
  一月比例: "ratioMonth",
  月比例: "ratioMonth",
  expirymonth: "expiryMonth",
  expiry_month: "expiryMonth",
  一月到期: "expiryMonth",
  月到期: "expiryMonth",
  note: "note",
  備註: "note",
};

const SERVICE_TYPE_ALIASES: Record<string, QuotaServiceType> = {
  general: "general",
  general_service: "general",
  一般: "general",
  一般服務: "general",
  "一般服务": "general",
  ai: "ai",
  ai_service: "ai",
  ai服务: "ai",
  ai服務: "ai",
};

// 與表單／API 一致：5 小時到期採 24 小時制（HH:mm），一週／一月到期採完整西元年-月-日
const FIVE_HOUR_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function escapeQuotaCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export function csvQuotaDate(value?: string): string {
  if (!value) return "";
  return value.slice(0, 10);
}

export function quotaImportKey(item: { name: string; account?: string }): string {
  return `${item.name.trim().toLocaleLowerCase("zh-Hant")}\0${(item.account || "").trim().toLocaleLowerCase("zh-Hant")}`;
}

export function toQuotaCsvRow(item: Pick<Quota, QuotaCsvHeader>): string {
  return [
    escapeQuotaCsvValue(item.name || ""),
    escapeQuotaCsvValue(item.serviceType || "general"),
    escapeQuotaCsvValue(item.account || ""),
    escapeQuotaCsvValue(item.quotaRemaining || 0),
    escapeQuotaCsvValue(item.quotaPoints || 0),
    escapeQuotaCsvValue(item.litmediaAccount || ""),
    escapeQuotaCsvValue(item.quotaRatio || 0),
    escapeQuotaCsvValue(csvQuotaDate(item.quotaExpiry)),
    escapeQuotaCsvValue(item.ratio5h || 0),
    escapeQuotaCsvValue(item.expiry5h || ""),
    escapeQuotaCsvValue(item.ratioWeek || 0),
    escapeQuotaCsvValue(item.expiryWeek || ""),
    escapeQuotaCsvValue(item.ratioMonth || 0),
    escapeQuotaCsvValue(item.expiryMonth || ""),
    escapeQuotaCsvValue(item.note || ""),
  ].join(",");
}

export function buildQuotaCsv(items: Array<Pick<Quota, QuotaCsvHeader>>): string {
  return [QUOTA_CSV_HEADERS.join(","), ...items.map(toQuotaCsvRow)].join("\n");
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

function mapHeader(raw: string): QuotaCsvHeader | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  for (const header of QUOTA_CSV_HEADERS) {
    if (header.toLowerCase() === lower) return header;
  }
  return HEADER_ALIASES[normalizeHeaderKey(trimmed)] ?? HEADER_ALIASES[trimmed] ?? null;
}

function lookup<T>(table: Record<string, T>, raw: string): T | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return table[trimmed] ?? table[trimmed.toLowerCase()] ?? table[normalizeHeaderKey(trimmed)];
}

function parseNonNegativeInteger(value: string, label: string): { ok: true; value: number } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: 0 };
  if (!/^\d+$/.test(trimmed)) return { ok: false, error: `${label}必須是 0 以上的整數` };
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < 0) return { ok: false, error: `${label}必須是 0 以上的整數` };
  return { ok: true, value: parsed };
}

function normalizeDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "";
  let isoDate = "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    isoDate = trimmed;
  } else {
    const slash = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    const dot = trimmed.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})$/);
    const match = slash || dot;
    if (!match) return null;
    isoDate = `${match[1]}-${String(Number(match[2])).padStart(2, "0")}-${String(Number(match[3])).padStart(2, "0")}`;
  }
  const calendarDate = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== isoDate) {
    return null;
  }
  return isoDate;
}

export function parseQuotaCsv(text: string): { data: QuotaFormData[]; errors: string[] } {
  const errors: string[] = [];
  const data: QuotaFormData[] = [];
  const rows = parseFullCsv(text);

  if (rows.length < 2) {
    errors.push("CSV 檔案至少需要表頭和一行資料");
    return { data, errors };
  }

  const columnIndex: Partial<Record<QuotaCsvHeader, number>> = {};
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
    const cell = (header: QuotaCsvHeader) => {
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

    const typeRaw = cell("serviceType").trim();
    const serviceType = typeRaw ? lookup(SERVICE_TYPE_ALIASES, typeRaw) : "general";
    if (!serviceType) {
      errors.push(`第 ${lineNumber} 行: 服務類型不正確`);
      continue;
    }

    const account = cell("account").trim();
    if (account.length > 200) {
      errors.push(`第 ${lineNumber} 行: 帳號最多 200 個字元`);
      continue;
    }

    const quotaRemaining = parseNonNegativeInteger(cell("quotaRemaining"), "剩餘額度");
    if (!quotaRemaining.ok) {
      errors.push(`第 ${lineNumber} 行: ${quotaRemaining.error}`);
      continue;
    }
    const quotaPoints = parseNonNegativeInteger(cell("quotaPoints"), "額度剩餘點數");
    if (!quotaPoints.ok) {
      errors.push(`第 ${lineNumber} 行: ${quotaPoints.error}`);
      continue;
    }
    const litmediaAccount = cell("litmediaAccount").trim();
    if (litmediaAccount.length > 100) {
      errors.push(`第 ${lineNumber} 行: LitMedia 簽到帳號最多 100 個字元`);
      continue;
    }

    const quotaRatio = parseNonNegativeInteger(cell("quotaRatio"), "額度剩餘比例");
    if (!quotaRatio.ok) {
      errors.push(`第 ${lineNumber} 行: ${quotaRatio.error}`);
      continue;
    }

    const quotaExpiry = normalizeDate(cell("quotaExpiry"));
    if (quotaExpiry === null) {
      errors.push(`第 ${lineNumber} 行: 額度到期日格式不正確`);
      continue;
    }

    const note = cell("note").trim();
    if (note.length > 3337) {
      errors.push(`第 ${lineNumber} 行: 備註最多 3337 個字元`);
      continue;
    }

    const row: QuotaFormData = {
      name,
      serviceType,
      account,
      quotaRemaining: quotaRemaining.value,
      quotaPoints: quotaPoints.value,
      litmediaAccount,
      quotaRatio: quotaRatio.value,
      quotaExpiry,
      ratio5h: 0,
      expiry5h: "",
      ratioWeek: 0,
      expiryWeek: "",
      ratioMonth: 0,
      expiryMonth: "",
      note,
    };

    if (serviceType === "ai") {
      const ratio5h = parseNonNegativeInteger(cell("ratio5h"), "5 小時比例");
      if (!ratio5h.ok) {
        errors.push(`第 ${lineNumber} 行: ${ratio5h.error}`);
        continue;
      }
      const ratioWeek = parseNonNegativeInteger(cell("ratioWeek"), "一週比例");
      if (!ratioWeek.ok) {
        errors.push(`第 ${lineNumber} 行: ${ratioWeek.error}`);
        continue;
      }
      const ratioMonth = parseNonNegativeInteger(cell("ratioMonth"), "一月比例");
      if (!ratioMonth.ok) {
        errors.push(`第 ${lineNumber} 行: ${ratioMonth.error}`);
        continue;
      }

      const expiry5hRaw = cell("expiry5h").trim();
      if (expiry5hRaw && !FIVE_HOUR_TIME_PATTERN.test(expiry5hRaw)) {
        errors.push(`第 ${lineNumber} 行: 5 小時到期需為 HH:mm（24 小時制，例如 14:30）`);
        continue;
      }

      const expiryWeekRaw = cell("expiryWeek").trim();
      let expiryWeek = "";
      if (expiryWeekRaw) {
        const weekDate = normalizeDate(expiryWeekRaw);
        if (weekDate === null) {
          errors.push(`第 ${lineNumber} 行: 一週到期格式需為 西元年-月-日（例如 2026-09-30）`);
          continue;
        }
        expiryWeek = weekDate;
      }

      const expiryMonthRaw = cell("expiryMonth").trim();
      let expiryMonth = "";
      if (expiryMonthRaw) {
        const monthDate = normalizeDate(expiryMonthRaw);
        if (monthDate === null) {
          errors.push(`第 ${lineNumber} 行: 一月到期格式需為 西元年-月-日（例如 2026-12-31）`);
          continue;
        }
        expiryMonth = monthDate;
      }

      row.ratio5h = ratio5h.value;
      row.expiry5h = expiry5hRaw;
      row.ratioWeek = ratioWeek.value;
      row.expiryWeek = expiryWeek;
      row.ratioMonth = ratioMonth.value;
      row.expiryMonth = expiryMonth;
    }

    data.push(row);
  }

  return { data, errors };
}
