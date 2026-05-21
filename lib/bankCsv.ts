import { Bank, BankFormData } from "@/types";

export const BANK_CSV_HEADERS = ["name", "deposit", "site", "address", "withdrawals", "transfer", "activity", "card", "account"];

const EXPECTED_BANK_CSV_COLUMN_COUNT = BANK_CSV_HEADERS.length;

export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (stringValue.includes(",") || stringValue.includes("\"") || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export function toBankCsvRow(bank: Bank): string {
  return [
    escapeCsvValue(bank.name),
    escapeCsvValue(bank.deposit || 0),
    escapeCsvValue(bank.site || ""),
    escapeCsvValue(bank.address || ""),
    escapeCsvValue(bank.withdrawals || 0),
    escapeCsvValue(bank.transfer || 0),
    escapeCsvValue(bank.activity || ""),
    escapeCsvValue(bank.card || ""),
    escapeCsvValue(bank.account || ""),
  ].join(",");
}

export function parseBankCsv(text: string): { data: BankFormData[]; errors: string[] } {
  const errors: string[] = [];
  const data: BankFormData[] = [];
  const rows = parseFullCsv(text);

  if (rows.length < 2) {
    errors.push("CSV 檔案至少需要表頭和一行資料");
    return { data, errors };
  }

  const headerValues = rows[0].map((header) => header.trim());
  if (headerValues.length !== EXPECTED_BANK_CSV_COLUMN_COUNT) {
    errors.push(`表頭欄位數量錯誤: 預期 ${EXPECTED_BANK_CSV_COLUMN_COUNT} 欄，實際 ${headerValues.length} 欄`);
    return { data, errors };
  }

  for (let i = 0; i < BANK_CSV_HEADERS.length; i++) {
    if (headerValues[i] !== BANK_CSV_HEADERS[i]) {
      errors.push(`表頭第 ${i + 1} 欄錯誤: 預期 "${BANK_CSV_HEADERS[i]}"，實際 "${headerValues[i]}"`);
      if (errors.length >= 5) {
        errors.push("...更多錯誤已省略");
        break;
      }
    }
  }

  if (errors.length > 0) return { data, errors };

  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    const lineNumber = i + 1;

    if (values.length !== EXPECTED_BANK_CSV_COLUMN_COUNT) {
      errors.push(`第 ${lineNumber} 行: 欄位數量錯誤`);
      continue;
    }

    if (!values[0]?.trim()) {
      errors.push(`第 ${lineNumber} 行: name 欄位不能為空`);
      continue;
    }

    data.push({
      name: values[0].trim(),
      deposit: parseFloat(values[1]) || 0,
      site: values[2]?.trim() || "",
      address: values[3]?.trim() || "",
      withdrawals: parseFloat(values[4]) || 0,
      transfer: parseFloat(values[5]) || 0,
      activity: values[6]?.trim() || "",
      card: values[7]?.trim() || "",
      account: values[8]?.trim() || "",
    });
  }

  return { data, errors };
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
      if (char === "\"") {
        if (cleanText[i + 1] === "\"") {
          currentField += "\"";
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else if (char === "\"") {
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
