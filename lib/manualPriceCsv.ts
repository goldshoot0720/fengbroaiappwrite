/**
 * CSV export / import for 手動價格紀錄 (Appwrite manualprice products + price history).
 *
 * One row per price record. Products with no records export a single empty-price row.
 *
 * Columns:
 * name,currency,price,date,note,productId,recordId
 */

export const MANUAL_PRICE_CSV_HEADERS = [
  "name",
  "currency",
  "price",
  "date",
  "note",
  "productId",
  "recordId",
] as const;

export type ManualPriceCsvHeader = (typeof MANUAL_PRICE_CSV_HEADERS)[number];

export type ManualPriceCsvCurrency = "TWD" | "USD" | "JPY";

export type ManualPriceCsvRecord = {
  id: string;
  price: number;
  date: string;
  note?: string;
};

export type ManualPriceCsvProduct = {
  id: string;
  name: string;
  currency: ManualPriceCsvCurrency;
  createdAt: number;
  updatedAt: number;
  records: ManualPriceCsvRecord[];
};

const HEADER_ALIASES: Record<string, ManualPriceCsvHeader> = {
  name: "name",
  商品: "name",
  商品名稱: "name",
  product: "name",
  productname: "name",
  currency: "currency",
  幣別: "currency",
  貨幣: "currency",
  price: "price",
  價錢: "price",
  價格: "price",
  date: "date",
  日期: "date",
  note: "note",
  備註: "note",
  註記: "note",
  productid: "productId",
  product_id: "productId",
  商品id: "productId",
  recordid: "recordId",
  record_id: "recordId",
  紀錄id: "recordId",
};

const MAX_PRODUCTS = 50;
const MAX_RECORDS_PER_PRODUCT = 200;
const ALLOWED_CURRENCIES = new Set<ManualPriceCsvCurrency>(["TWD", "USD", "JPY"]);

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function escapeManualPriceCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function normalizeCurrency(value: unknown): ManualPriceCsvCurrency {
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";
  return ALLOWED_CURRENCIES.has(code as ManualPriceCsvCurrency)
    ? (code as ManualPriceCsvCurrency)
    : "TWD";
}

function sortRecords(records: ManualPriceCsvRecord[]) {
  return [...records].sort((a, b) => {
    if (a.date === b.date) return a.id.localeCompare(b.id);
    return a.date.localeCompare(b.date);
  });
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

function mapHeader(raw: string): ManualPriceCsvHeader | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  for (const header of MANUAL_PRICE_CSV_HEADERS) {
    if (header.toLowerCase() === lower) return header;
  }
  return HEADER_ALIASES[normalizeHeaderKey(trimmed)] ?? HEADER_ALIASES[trimmed] ?? null;
}

function normalizeDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  // YYYY/MM/DD
  const slash = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (slash) {
    return `${slash[1]}-${String(Number(slash[2])).padStart(2, "0")}-${String(Number(slash[3])).padStart(2, "0")}`;
  }
  // YYYY.MM.DD
  const dot = trimmed.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})$/);
  if (dot) {
    return `${dot[1]}-${String(Number(dot[2])).padStart(2, "0")}-${String(Number(dot[3])).padStart(2, "0")}`;
  }
  return null;
}

export function toManualPriceCsvRow(product: ManualPriceCsvProduct, record?: ManualPriceCsvRecord): string {
  return [
    escapeManualPriceCsvValue(product.name),
    escapeManualPriceCsvValue(product.currency),
    escapeManualPriceCsvValue(record ? record.price : ""),
    escapeManualPriceCsvValue(record ? record.date : ""),
    escapeManualPriceCsvValue(record?.note || ""),
    escapeManualPriceCsvValue(product.id),
    escapeManualPriceCsvValue(record?.id || ""),
  ].join(",");
}

export function buildManualPriceCsv(products: ManualPriceCsvProduct[]): string {
  const rows = [MANUAL_PRICE_CSV_HEADERS.join(",")];
  for (const product of products) {
    if (!product.records.length) {
      rows.push(toManualPriceCsvRow(product));
      continue;
    }
    for (const record of sortRecords(product.records)) {
      rows.push(toManualPriceCsvRow(product, record));
    }
  }
  return rows.join("\n");
}

/**
 * Merge imported products into existing list.
 * Match by productId when present, else by name+currency (case-sensitive name trim).
 * Records upsert by recordId, else by date+price+note fingerprint.
 */
export function mergeManualPriceProducts(
  existing: ManualPriceCsvProduct[],
  incoming: ManualPriceCsvProduct[]
): ManualPriceCsvProduct[] {
  const byId = new Map<string, ManualPriceCsvProduct>();
  const byNameKey = new Map<string, string>(); // name|currency -> id
  const order: string[] = [];

  const nameKey = (name: string, currency: string) => `${name}\0${currency}`;

  for (const product of existing) {
    if (!byId.has(product.id)) order.push(product.id);
    byId.set(product.id, { ...product, records: [...product.records] });
    byNameKey.set(nameKey(product.name, product.currency), product.id);
  }

  for (const item of incoming) {
    let targetId =
      (item.id && byId.has(item.id) ? item.id : undefined) ||
      byNameKey.get(nameKey(item.name, item.currency));

    if (!targetId) {
      targetId = item.id || createId();
      if (!byId.has(targetId)) order.push(targetId);
      byId.set(targetId, {
        id: targetId,
        name: item.name,
        currency: item.currency,
        createdAt: item.createdAt || Date.now(),
        updatedAt: Date.now(),
        records: [],
      });
      byNameKey.set(nameKey(item.name, item.currency), targetId);
    }

    const current = byId.get(targetId)!;
    const recordMap = new Map<string, ManualPriceCsvRecord>();
    const recordOrder: string[] = [];
    const fingerprint = (r: ManualPriceCsvRecord) =>
      `${r.date}|${r.price}|${r.note || ""}`;

    for (const r of current.records) {
      const key = r.id || fingerprint(r);
      if (!recordMap.has(key)) recordOrder.push(key);
      recordMap.set(key, r);
    }
    for (const r of item.records) {
      const key = r.id || fingerprint(r);
      if (!recordMap.has(key)) recordOrder.push(key);
      recordMap.set(key, r);
    }

    const mergedRecords = sortRecords(
      recordOrder
        .map((key) => recordMap.get(key)!)
        .filter(Boolean)
        .slice(0, MAX_RECORDS_PER_PRODUCT)
    );

    byId.set(targetId, {
      ...current,
      name: item.name || current.name,
      currency: item.currency || current.currency,
      updatedAt: Date.now(),
      records: mergedRecords,
    });
    byNameKey.set(nameKey(item.name || current.name, item.currency || current.currency), targetId);
  }

  return order
    .map((id) => byId.get(id)!)
    .filter(Boolean)
    .slice(0, MAX_PRODUCTS);
}

export function parseManualPriceCsv(text: string): {
  data: ManualPriceCsvProduct[];
  errors: string[];
} {
  const errors: string[] = [];
  const rows = parseFullCsv(text);

  if (rows.length < 2) {
    errors.push("CSV 檔案至少需要表頭和一行資料");
    return { data: [], errors };
  }

  const columnIndex: Partial<Record<ManualPriceCsvHeader, number>> = {};
  for (let i = 0; i < rows[0].length; i++) {
    const mapped = mapHeader(rows[0][i] || "");
    if (mapped && columnIndex[mapped] == null) {
      columnIndex[mapped] = i;
    }
  }

  if (columnIndex.name == null) {
    errors.push('表頭缺少必要欄位 "name"（商品名稱）');
    return { data: [], errors };
  }

  type Bucket = {
    id: string;
    name: string;
    currency: ManualPriceCsvCurrency;
    records: ManualPriceCsvRecord[];
    seenRecordKeys: Set<string>;
  };

  const buckets = new Map<string, Bucket>();
  const bucketOrder: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    const lineNumber = i + 1;
    const cell = (header: ManualPriceCsvHeader) => {
      const idx = columnIndex[header];
      if (idx == null) return "";
      return (values[idx] ?? "").trim();
    };

    const name = cell("name");
    if (!name) {
      errors.push(`第 ${lineNumber} 行: name 不能為空`);
      continue;
    }

    const currency = normalizeCurrency(cell("currency") || "TWD");
    const productId = cell("productId");
    const bucketKey = productId || `${name}\0${currency}`;

    let bucket = buckets.get(bucketKey);
    if (!bucket) {
      if (bucketOrder.length >= MAX_PRODUCTS && !buckets.has(bucketKey)) {
        errors.push(`第 ${lineNumber} 行: 已達商品上限 ${MAX_PRODUCTS}，略過`);
        continue;
      }
      bucket = {
        id: productId || createId(),
        name: name.slice(0, 120),
        currency,
        records: [],
        seenRecordKeys: new Set(),
      };
      buckets.set(bucketKey, bucket);
      bucketOrder.push(bucketKey);
    } else {
      // Prefer later non-empty name/currency updates
      if (name) bucket.name = name.slice(0, 120);
      bucket.currency = currency;
    }

    const priceRaw = cell("price");
    const dateRaw = cell("date");
    if (!priceRaw && !dateRaw) {
      // Product shell only (no price record)
      continue;
    }

    const price = Number(priceRaw);
    if (!Number.isFinite(price) || price < 0) {
      errors.push(`第 ${lineNumber} 行: price 無效`);
      continue;
    }

    const date = normalizeDate(dateRaw);
    if (!date) {
      errors.push(`第 ${lineNumber} 行: date 需為 YYYY-MM-DD`);
      continue;
    }

    const recordId = cell("recordId") || createId();
    const note = cell("note").slice(0, 200);
    const recordKey = recordId || `${date}|${price}|${note}`;
    if (bucket.seenRecordKeys.has(recordKey)) {
      errors.push(`第 ${lineNumber} 行: 重複紀錄，已略過`);
      continue;
    }
    if (bucket.records.length >= MAX_RECORDS_PER_PRODUCT) {
      errors.push(`第 ${lineNumber} 行: 「${bucket.name}」已達 ${MAX_RECORDS_PER_PRODUCT} 筆上限`);
      continue;
    }

    bucket.seenRecordKeys.add(recordKey);
    bucket.records.push({
      id: recordId,
      price,
      date,
      ...(note ? { note } : {}),
    });
  }

  const now = Date.now();
  const data: ManualPriceCsvProduct[] = bucketOrder
    .map((key) => buckets.get(key)!)
    .filter(Boolean)
    .map((bucket) => ({
      id: bucket.id,
      name: bucket.name,
      currency: bucket.currency,
      createdAt: now,
      updatedAt: now,
      records: sortRecords(bucket.records),
    }));

  return { data, errors };
}
