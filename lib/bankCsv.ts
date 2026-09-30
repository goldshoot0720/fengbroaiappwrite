import type { Bank, BankFormData } from "@/types";
import { toDateInputValue } from "@/lib/bankForm";
import { mapCsvHeader } from "@/lib/csvText";

export const BANK_CSV_HEADERS = ["name", "deposit", "site", "address", "withdrawals", "transfer", "activity", "card", "account", "note", "category", "expiry"];

/** 鋒兄 Supabase 版銀行匯出的中文表頭。 */
const BANK_CSV_HEADER_ALIASES: Record<string, string> = {
  銀行名稱: "name",
  存款: "deposit",
  "分行/網點": "site",
  地址: "address",
  提款: "withdrawals",
  轉帳: "transfer",
  "活動/備註": "activity",
  卡號: "card",
  帳號: "account",
  備註: "note",
  分類: "category",
  有效期限: "expiry",
};

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
    escapeCsvValue(bank.note || ""),
    escapeCsvValue(bank.category || ""),
    escapeCsvValue(toDateInputValue(bank.expiry)),
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

  const headerValues = rows[0];
  // 依表頭名稱對應欄位：舊備份缺少的尾欄（note、category、expiry）當空值，
  // 鋒兄 Supabase 版匯出的中文表頭也能直接匯入。
  const { index, errors: headerErrors } = mapCsvHeader(headerValues, {
    fields: BANK_CSV_HEADERS,
    aliases: BANK_CSV_HEADER_ALIASES,
    required: ["name"],
  });
  if (headerErrors.length > 0) return { data, errors: headerErrors };

  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    const lineNumber = i + 1;

    if (values.length !== headerValues.length) {
      errors.push(`第 ${lineNumber} 行: 欄位數量錯誤`);
      continue;
    }

    const text = (field: string) => {
      const column = index.get(field);
      return column === undefined ? "" : values[column]?.trim() || "";
    };

    const name = text("name");
    if (!name) {
      errors.push(`第 ${lineNumber} 行: name 欄位不能為空`);
      continue;
    }

    data.push({
      name,
      deposit: parseFloat(text("deposit")) || 0,
      site: text("site"),
      address: text("address"),
      withdrawals: parseFloat(text("withdrawals")) || 0,
      transfer: parseFloat(text("transfer")) || 0,
      activity: text("activity"),
      card: text("card"),
      account: text("account"),
      note: text("note"),
      category: text("category"),
      expiry: text("expiry"),
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
