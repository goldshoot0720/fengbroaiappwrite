import { NOTIFICATION_SETTINGS_MAX_SLOTS } from "./notificationSettings";
import type { NotificationSettingSlot } from "./notificationSettings";

/**
 * Resend 通知設定的 CSV 匯出／匯入（純函式，不含密碼欄位）。
 * 欄位沿用既有環境變數命名：RESEND_API_KEY / RESEND_TO_EMAIL，一組一列。
 */

export const RESEND_SETTINGS_CSV_HEADERS = [
  "RESEND_API_KEY",
  "RESEND_TO_EMAIL",
] as const;

export type ResendSettingsCsvHeader = (typeof RESEND_SETTINGS_CSV_HEADERS)[number];

const HEADER_ALIASES: Record<string, ResendSettingsCsvHeader> = {
  resendapikey: "RESEND_API_KEY",
  resend_api_key: "RESEND_API_KEY",
  apikey: "RESEND_API_KEY",
  api_key: "RESEND_API_KEY",
  key: "RESEND_API_KEY",
  "api key": "RESEND_API_KEY",
  resendtoemail: "RESEND_TO_EMAIL",
  resend_to_email: "RESEND_TO_EMAIL",
  toemail: "RESEND_TO_EMAIL",
  to_email: "RESEND_TO_EMAIL",
  email: "RESEND_TO_EMAIL",
  收件: "RESEND_TO_EMAIL",
  收件人: "RESEND_TO_EMAIL",
  收件email: "RESEND_TO_EMAIL",
  收件電子郵件: "RESEND_TO_EMAIL",
  通知email: "RESEND_TO_EMAIL",
  通知收件: "RESEND_TO_EMAIL",
  通知收件email: "RESEND_TO_EMAIL",
  通知收件電子郵件: "RESEND_TO_EMAIL",
  電子郵件: "RESEND_TO_EMAIL",
};

export function escapeResendCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export function buildResendSettingsCsv(
  slots: NotificationSettingSlot[]
): string {
  const rows = slots
    .filter((slot) => slot.apiKey && slot.toEmail)
    .map((slot) =>
      [escapeResendCsvValue(slot.apiKey), escapeResendCsvValue(slot.toEmail)].join(",")
    );
  return [RESEND_SETTINGS_CSV_HEADERS.join(","), ...rows].join("\n");
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

function mapHeader(raw: string): ResendSettingsCsvHeader | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  for (const header of RESEND_SETTINGS_CSV_HEADERS) {
    if (header.toLowerCase() === lower) return header;
  }
  return HEADER_ALIASES[normalizeHeaderKey(trimmed)] ?? HEADER_ALIASES[trimmed] ?? null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseResendSettingsCsv(
  text: string
): { slots: NotificationSettingSlot[]; errors: string[] } {
  const errors: string[] = [];
  const slots: NotificationSettingSlot[] = [];
  const rows = parseFullCsv(text);

  if (rows.length < 2) {
    errors.push("CSV 檔案至少需要表頭（RESEND_API_KEY,RESEND_TO_EMAIL）和一組資料");
    return { slots, errors };
  }

  const columnIndex: Partial<Record<ResendSettingsCsvHeader, number>> = {};
  for (let i = 0; i < rows[0].length; i++) {
    const mapped = mapHeader(rows[0][i] || "");
    if (mapped && columnIndex[mapped] == null) columnIndex[mapped] = i;
  }

  if (columnIndex.RESEND_API_KEY == null) {
    errors.push('表頭缺少必要欄位 "RESEND_API_KEY"（或 API Key）');
    return { slots, errors };
  }
  if (columnIndex.RESEND_TO_EMAIL == null) {
    errors.push('表頭缺少必要欄位 "RESEND_TO_EMAIL"（或收件 Email）');
    return { slots, errors };
  }

  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    const lineNumber = i + 1;
    const cell = (header: ResendSettingsCsvHeader) => {
      const idx = columnIndex[header];
      if (idx == null) return "";
      return values[idx] ?? "";
    };

    const apiKey = cell("RESEND_API_KEY").trim();
    const toEmail = cell("RESEND_TO_EMAIL").trim();

    if (!apiKey) {
      errors.push(`第 ${lineNumber} 行: RESEND_API_KEY 不能為空`);
      continue;
    }
    if (!toEmail) {
      errors.push(`第 ${lineNumber} 行: RESEND_TO_EMAIL 不能為空`);
      continue;
    }
    if (!EMAIL_PATTERN.test(toEmail)) {
      errors.push(`第 ${lineNumber} 行: 收件 Email「${toEmail}」格式不正確`);
      continue;
    }
    if (slots.length >= NOTIFICATION_SETTINGS_MAX_SLOTS) {
      errors.push(`最多 ${NOTIFICATION_SETTINGS_MAX_SLOTS} 組，已略過第 ${lineNumber} 行以後的資料`);
      break;
    }

    slots.push({ apiKey, toEmail });
  }

  return { slots, errors };
}
