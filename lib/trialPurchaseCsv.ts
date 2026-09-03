import type { PurchaseStatus, TrialPurchase, TrialPurchaseFormData, TrialStatus } from "@/types";

export const TRIAL_PURCHASE_CSV_HEADERS = [
  "name",
  "eventDate",
  "firstPurchasePrice",
  "regularPrice",
  "account",
  "note",
  "trialStatus",
  "purchaseStatus",
] as const;

export type TrialPurchaseCsvHeader = (typeof TRIAL_PURCHASE_CSV_HEADERS)[number];

const HEADER_ALIASES: Record<string, TrialPurchaseCsvHeader> = {
  name: "name",
  服務: "name",
  服務名稱: "name",
  eventdate: "eventDate",
  event_date: "eventDate",
  date: "eventDate",
  日期: "eventDate",
  試用日: "eventDate",
  首購日: "eventDate",
  到期日: "eventDate",
  扣款日: "eventDate",
  "試用／首購／到期日": "eventDate",
  "試用/首購/到期日": "eventDate",
  "試用／首購／到期日（扣款日）": "eventDate",
  firstpurchaseprice: "firstPurchasePrice",
  first_purchase_price: "firstPurchasePrice",
  首購價格: "firstPurchasePrice",
  regularprice: "regularPrice",
  regular_price: "regularPrice",
  非首購價格: "regularPrice",
  一般價格: "regularPrice",
  account: "account",
  帳號: "account",
  note: "note",
  備註: "note",
  trialstatus: "trialStatus",
  trial_status: "trialStatus",
  試用狀態: "trialStatus",
  purchasestatus: "purchaseStatus",
  purchase_status: "purchaseStatus",
  首購狀態: "purchaseStatus",
};

const TRIAL_STATUS_ALIASES: Record<string, TrialStatus> = {
  untried: "untried",
  tried: "tried",
  尚未試用: "untried",
  已試用: "tried",
};

const PURCHASE_STATUS_ALIASES: Record<string, PurchaseStatus> = {
  not_purchased: "not_purchased",
  purchased: "purchased",
  unavailable: "unavailable",
  未首購: "not_purchased",
  已首購: "purchased",
  無提供首購: "unavailable",
};

export function escapeTrialPurchaseCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export function csvEventDate(value?: string): string {
  if (!value) return "";
  return value.slice(0, 10);
}

export function trialPurchaseImportKey(item: { name: string; account?: string }): string {
  return `${item.name.trim().toLocaleLowerCase("zh-Hant")}\0${(item.account || "").trim().toLocaleLowerCase("zh-Hant")}`;
}

export function toTrialPurchaseCsvRow(item: Pick<TrialPurchase, TrialPurchaseCsvHeader>): string {
  return [
    escapeTrialPurchaseCsvValue(item.name || ""),
    escapeTrialPurchaseCsvValue(csvEventDate(item.eventDate)),
    escapeTrialPurchaseCsvValue(item.firstPurchasePrice || 0),
    escapeTrialPurchaseCsvValue(item.regularPrice || 0),
    escapeTrialPurchaseCsvValue(item.account || ""),
    escapeTrialPurchaseCsvValue(item.note || ""),
    escapeTrialPurchaseCsvValue(item.trialStatus || "untried"),
    escapeTrialPurchaseCsvValue(item.purchaseStatus || "not_purchased"),
  ].join(",");
}

export function buildTrialPurchaseCsv(items: Array<Pick<TrialPurchase, TrialPurchaseCsvHeader>>): string {
  return [TRIAL_PURCHASE_CSV_HEADERS.join(","), ...items.map(toTrialPurchaseCsvRow)].join("\n");
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

function mapHeader(raw: string): TrialPurchaseCsvHeader | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  for (const header of TRIAL_PURCHASE_CSV_HEADERS) {
    if (header.toLowerCase() === lower) return header;
  }
  return HEADER_ALIASES[normalizeHeaderKey(trimmed)] ?? HEADER_ALIASES[trimmed] ?? null;
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

function parseNonNegativeInteger(value: string, label: string): { ok: true; value: number } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: 0 };
  if (!/^\d+$/.test(trimmed)) return { ok: false, error: `${label}必須是 0 以上的整數` };
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < 0) return { ok: false, error: `${label}必須是 0 以上的整數` };
  return { ok: true, value: parsed };
}

export function parseTrialPurchaseCsv(text: string): { data: TrialPurchaseFormData[]; errors: string[] } {
  const errors: string[] = [];
  const data: TrialPurchaseFormData[] = [];
  const rows = parseFullCsv(text);

  if (rows.length < 2) {
    errors.push("CSV 檔案至少需要表頭和一行資料");
    return { data, errors };
  }

  const columnIndex: Partial<Record<TrialPurchaseCsvHeader, number>> = {};
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
    const cell = (header: TrialPurchaseCsvHeader) => {
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

    const eventDateRaw = cell("eventDate");
    const eventDate = normalizeDate(eventDateRaw);
    if (eventDate === null) {
      errors.push(`第 ${lineNumber} 行: 日期格式不正確`);
      continue;
    }

    const firstPrice = parseNonNegativeInteger(cell("firstPurchasePrice"), "首購價格");
    if (!firstPrice.ok) {
      errors.push(`第 ${lineNumber} 行: ${firstPrice.error}`);
      continue;
    }
    const regularPrice = parseNonNegativeInteger(cell("regularPrice"), "非首購價格");
    if (!regularPrice.ok) {
      errors.push(`第 ${lineNumber} 行: ${regularPrice.error}`);
      continue;
    }

    const account = cell("account").trim();
    if (account.length > 200) {
      errors.push(`第 ${lineNumber} 行: 帳號最多 200 個字元`);
      continue;
    }
    const note = cell("note").trim();
    if (note.length > 3337) {
      errors.push(`第 ${lineNumber} 行: 備註最多 3337 個字元`);
      continue;
    }

    const trialRaw = cell("trialStatus").trim();
    const trialStatus = trialRaw ? TRIAL_STATUS_ALIASES[trialRaw] || TRIAL_STATUS_ALIASES[trialRaw.toLowerCase()] : "untried";
    if (!trialStatus) {
      errors.push(`第 ${lineNumber} 行: 試用狀態不正確`);
      continue;
    }

    const purchaseRaw = cell("purchaseStatus").trim();
    const purchaseStatus = purchaseRaw
      ? PURCHASE_STATUS_ALIASES[purchaseRaw] || PURCHASE_STATUS_ALIASES[purchaseRaw.toLowerCase()]
      : "not_purchased";
    if (!purchaseStatus) {
      errors.push(`第 ${lineNumber} 行: 首購狀態不正確`);
      continue;
    }

    data.push({
      name,
      eventDate,
      firstPurchasePrice: firstPrice.value,
      regularPrice: regularPrice.value,
      account,
      note,
      trialStatus,
      purchaseStatus,
    });
  }

  return { data, errors };
}
