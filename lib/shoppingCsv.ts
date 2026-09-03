import type { ShoppingItem, ShoppingItemFormData } from "@/types";

export const SHOPPING_CSV_HEADERS = [
  "name",
  "plannedDate",
  "price",
  "currency",
  "quantity",
  "shop",
  "pickupMethod",
  "account",
  "note",
] as const;

export type ShoppingCsvHeader = (typeof SHOPPING_CSV_HEADERS)[number];

const HEADER_ALIASES: Record<string, ShoppingCsvHeader> = {
  name: "name",
  購物名稱: "name",
  商品名稱: "name",
  名稱: "name",
  planneddate: "plannedDate",
  planned_date: "plannedDate",
  預定購買日: "plannedDate",
  購買日: "plannedDate",
  預定日期: "plannedDate",
  price: "price",
  預定價格: "price",
  價格: "price",
  金額: "price",
  currency: "currency",
  幣別: "currency",
  幣種: "currency",
  貨幣: "currency",
  quantity: "quantity",
  預定數量: "quantity",
  數量: "quantity",
  shop: "shop",
  預定商店: "shop",
  商店: "shop",
  店家: "shop",
  pickupmethod: "pickupMethod",
  pickup_method: "pickupMethod",
  預定取貨方式: "pickupMethod",
  取貨方式: "pickupMethod",
  取貨: "pickupMethod",
  account: "account",
  帳號: "account",
  note: "note",
  備註: "note",
};

const CURRENCY_ALIASES: Record<string, string> = {
  TWD: "TWD",
  twd: "TWD",
  台幣: "TWD",
  新台幣: "TWD",
  USD: "USD",
  usd: "USD",
  美元: "USD",
  美金: "USD",
  JPY: "JPY",
  jpy: "JPY",
  日圓: "JPY",
  日幣: "JPY",
  CNY: "CNY",
  cny: "CNY",
  人民幣: "CNY",
  RMB: "CNY",
  rmb: "CNY",
};

export function escapeShoppingCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export function csvShoppingDate(value?: string): string {
  if (!value) return "";
  return value.slice(0, 10);
}

export function shoppingImportKey(item: { name: string }): string {
  return item.name.trim().toLocaleLowerCase("zh-Hant");
}

export function toShoppingCsvRow(item: Pick<ShoppingItem, ShoppingCsvHeader>): string {
  return [
    escapeShoppingCsvValue(item.name || ""),
    escapeShoppingCsvValue(csvShoppingDate(item.plannedDate)),
    escapeShoppingCsvValue(item.price || 0),
    escapeShoppingCsvValue(item.currency || "TWD"),
    escapeShoppingCsvValue(item.quantity || 1),
    escapeShoppingCsvValue(item.shop || ""),
    escapeShoppingCsvValue(item.pickupMethod || ""),
    escapeShoppingCsvValue(item.account || ""),
    escapeShoppingCsvValue(item.note || ""),
  ].join(",");
}

export function buildShoppingCsv(items: Array<Pick<ShoppingItem, ShoppingCsvHeader>>): string {
  return [SHOPPING_CSV_HEADERS.join(","), ...items.map(toShoppingCsvRow)].join("\n");
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

function mapHeader(raw: string): ShoppingCsvHeader | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  for (const header of SHOPPING_CSV_HEADERS) {
    if (header.toLowerCase() === lower) return header;
  }
  return HEADER_ALIASES[normalizeHeaderKey(trimmed)] ?? HEADER_ALIASES[trimmed] ?? null;
}

function lookup<T>(table: Record<string, T>, raw: string): T | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return table[trimmed] ?? table[trimmed.toLowerCase()] ?? table[normalizeHeaderKey(trimmed)];
}

function parseNonNegativeInteger(value: string, label: string, emptyTo: number): { ok: true; value: number } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: emptyTo };
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

export function parseShoppingCsv(text: string): { data: ShoppingItemFormData[]; errors: string[] } {
  const errors: string[] = [];
  const data: ShoppingItemFormData[] = [];
  const rows = parseFullCsv(text);

  if (rows.length < 2) {
    errors.push("CSV 檔案至少需要表頭和一行資料");
    return { data, errors };
  }

  const columnIndex: Partial<Record<ShoppingCsvHeader, number>> = {};
  for (let i = 0; i < rows[0].length; i++) {
    const mapped = mapHeader(rows[0][i] || "");
    if (mapped && columnIndex[mapped] == null) columnIndex[mapped] = i;
  }

  if (columnIndex.name == null) {
    errors.push('表頭缺少必要欄位 "name"（購物名稱）');
    return { data, errors };
  }

  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    const lineNumber = i + 1;
    const cell = (header: ShoppingCsvHeader) => {
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
      errors.push(`第 ${lineNumber} 行: 購物名稱最多 100 個字元`);
      continue;
    }

    const price = parseNonNegativeInteger(cell("price"), "預定價格", 0);
    if (!price.ok) {
      errors.push(`第 ${lineNumber} 行: ${price.error}`);
      continue;
    }
    const quantity = parseNonNegativeInteger(cell("quantity"), "預定數量", 1);
    if (!quantity.ok) {
      errors.push(`第 ${lineNumber} 行: ${quantity.error}`);
      continue;
    }
    if (quantity.value < 1) {
      errors.push(`第 ${lineNumber} 行: 預定數量必須是 1 以上的整數`);
      continue;
    }

    const currencyRaw = cell("currency").trim();
    const currency = currencyRaw ? lookup(CURRENCY_ALIASES, currencyRaw) : "TWD";
    if (!currency) {
      errors.push(`第 ${lineNumber} 行: 幣別需為 台幣／美元／日圓／人民幣（TWD/USD/JPY/CNY）`);
      continue;
    }

    const plannedDate = normalizeDate(cell("plannedDate"));
    if (plannedDate === null) {
      errors.push(`第 ${lineNumber} 行: 預定購買日格式不正確`);
      continue;
    }

    const pickupRaw = cell("pickupMethod").trim();
    const pickupMethod = pickupRaw;
    if (pickupRaw && pickupRaw.length > 100) {
      errors.push(`第 ${lineNumber} 行: 預定取貨方式最多 100 個字元`);
      continue;
    }

    const shop = cell("shop").trim();
    if (shop.length > 100) {
      errors.push(`第 ${lineNumber} 行: 預定商店最多 100 個字元`);
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

    data.push({
      name,
      plannedDate,
      price: price.value,
      currency,
      quantity: quantity.value,
      shop,
      pickupMethod,
      account,
      note,
    });
  }

  return { data, errors };
}
