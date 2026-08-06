/**
 * CSV export / import for 鋒兄金融 custom instruments (localStorage watchlist).
 *
 * Columns:
 * name,symbol,provider,group,imageUrls,youtubeUrl,bilibiliUrl,relatedLinks,featured
 *
 * Multi-value cells use `;` as separator:
 * - imageUrls: url1;url2  (supports external https and Appwrite Storage view URLs)
 * - relatedLinks: url  or  標籤|url  (multiple joined with `;`)
 *
 * imageUrls notes:
 * - Prefer full Appwrite Storage URLs
 *   (`https://…/storage/buckets/{bucket}/files/{fileId}/view?project=…`)
 * - media-proxy URLs are unwrapped on import/export so API keys are not written to CSV
 * - Cells with `;`, quotes, or commas are quoted per RFC-style CSV escaping
 */

import {
  formatFinanceRelatedLinksText,
  migrateFinanceGroup,
  normalizeCustomFinanceInstrument,
  normalizeFinanceImageUrls,
  normalizeFinanceRelatedLinks,
  type CustomFinanceInstrument,
} from "@/lib/fengbroFinanceCustom";

export const FINANCE_CUSTOM_CSV_HEADERS = [
  "name",
  "symbol",
  "provider",
  "group",
  "imageUrls",
  "youtubeUrl",
  "bilibiliUrl",
  "relatedLinks",
  "featured",
] as const;

export type FinanceCustomCsvHeader = (typeof FINANCE_CUSTOM_CSV_HEADERS)[number];

const HEADER_ALIASES: Record<string, FinanceCustomCsvHeader> = {
  name: "name",
  代稱: "name",
  名稱: "name",
  symbol: "symbol",
  代號: "symbol",
  ticker: "symbol",
  provider: "provider",
  來源: "provider",
  group: "group",
  分類: "group",
  region: "group",
  imageurls: "imageUrls",
  image_urls: "imageUrls",
  images: "imageUrls",
  圖片: "imageUrls",
  圖片網址: "imageUrls",
  youtubeurl: "youtubeUrl",
  youtube: "youtubeUrl",
  bilibiliurl: "bilibiliUrl",
  bilibili: "bilibiliUrl",
  relatedlinks: "relatedLinks",
  related_links: "relatedLinks",
  links: "relatedLinks",
  自訂網址: "relatedLinks",
  連結: "relatedLinks",
  featured: "featured",
  精選: "featured",
  精選焦點: "featured",
};

const MAX_CUSTOM_INSTRUMENTS = 30;

export function escapeFinanceCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  // Always quote when field has `;` (our multi-value sep), `?`/`&` (Appwrite query),
  // commas, quotes, or newlines — safer for Excel re-save of Storage URLs.
  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n") ||
    stringValue.includes(";") ||
    stringValue.includes("?") ||
    stringValue.includes("&")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function relatedLinksToCsvCell(instrument: CustomFinanceInstrument): string {
  if (!instrument.relatedLinks?.length) return "";
  // Same shape as textarea lines, but `;` for multi-value CSV cell.
  return formatFinanceRelatedLinksText(instrument.relatedLinks).replace(/\n+/g, ";");
}

/** Join image URLs for CSV (canonical Appwrite Storage / https only). */
export function imageUrlsToCsvCell(instrument: CustomFinanceInstrument): string {
  const urls = normalizeFinanceImageUrls(
    instrument.imageUrls?.length
      ? instrument.imageUrls
      : instrument.imageUrl
        ? [instrument.imageUrl]
        : []
  );
  return urls.join(";");
}

export function toFinanceCustomCsvRow(instrument: CustomFinanceInstrument): string {
  return [
    escapeFinanceCsvValue(instrument.name),
    escapeFinanceCsvValue(instrument.symbol),
    escapeFinanceCsvValue(instrument.provider),
    escapeFinanceCsvValue(instrument.group),
    escapeFinanceCsvValue(imageUrlsToCsvCell(instrument)),
    escapeFinanceCsvValue(instrument.youtubeUrl || ""),
    escapeFinanceCsvValue(instrument.bilibiliUrl || ""),
    escapeFinanceCsvValue(relatedLinksToCsvCell(instrument)),
    escapeFinanceCsvValue(instrument.featured ? "1" : "0"),
  ].join(",");
}

export function buildFinanceCustomCsv(instruments: CustomFinanceInstrument[]): string {
  const rows = [FINANCE_CUSTOM_CSV_HEADERS.join(",")];
  for (const instrument of instruments) {
    rows.push(toFinanceCustomCsvRow(instrument));
  }
  return rows.join("\n");
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

function mapHeader(raw: string): FinanceCustomCsvHeader | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Direct English match (case-insensitive for ascii keys)
  const lower = trimmed.toLowerCase();
  for (const header of FINANCE_CUSTOM_CSV_HEADERS) {
    if (header.toLowerCase() === lower) return header;
  }
  const alias = HEADER_ALIASES[normalizeHeaderKey(trimmed)] ?? HEADER_ALIASES[trimmed];
  return alias ?? null;
}

function parseFeaturedFlag(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "y" || v === "是" || v === "精選";
}

/**
 * Merge imported instruments into existing list (upsert by provider|symbol).
 * Keeps existing order; appends new keys; enforces max 30.
 */
export function mergeFinanceCustomInstruments(
  existing: CustomFinanceInstrument[],
  incoming: CustomFinanceInstrument[]
): CustomFinanceInstrument[] {
  const map = new Map<string, CustomFinanceInstrument>();
  const order: string[] = [];

  for (const item of existing) {
    const key = `${item.provider}|${item.symbol}`;
    if (!map.has(key)) order.push(key);
    map.set(key, item);
  }
  for (const item of incoming) {
    const key = `${item.provider}|${item.symbol}`;
    if (!map.has(key)) order.push(key);
    map.set(key, item);
  }

  return order
    .map((key) => map.get(key)!)
    .filter(Boolean)
    .slice(0, MAX_CUSTOM_INSTRUMENTS);
}

export function parseFinanceCustomCsv(text: string): {
  data: CustomFinanceInstrument[];
  errors: string[];
} {
  const errors: string[] = [];
  const data: CustomFinanceInstrument[] = [];
  const rows = parseFullCsv(text);

  if (rows.length < 2) {
    errors.push("CSV 檔案至少需要表頭和一行資料");
    return { data, errors };
  }

  const headerCells = rows[0];
  const columnIndex: Partial<Record<FinanceCustomCsvHeader, number>> = {};
  for (let i = 0; i < headerCells.length; i++) {
    const mapped = mapHeader(headerCells[i] || "");
    if (mapped && columnIndex[mapped] == null) {
      columnIndex[mapped] = i;
    }
  }

  if (columnIndex.symbol == null) {
    errors.push('表頭缺少必要欄位 "symbol"（代號）');
    return { data, errors };
  }

  const seenKeys = new Set<string>();

  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    const lineNumber = i + 1;
    const cell = (header: FinanceCustomCsvHeader) => {
      const idx = columnIndex[header];
      if (idx == null) return "";
      return (values[idx] ?? "").trim();
    };

    const symbol = cell("symbol");
    if (!symbol) {
      errors.push(`第 ${lineNumber} 行: symbol 不能為空`);
      continue;
    }

    // Keep `;` / newlines; normalizeFinanceImageUrls understands both and Appwrite Storage URLs.
    const imageUrlsRaw = cell("imageUrls");
    const relatedLinksRaw = cell("relatedLinks").replace(/;/g, "\n");
    const featured = parseFeaturedFlag(cell("featured"));

    const providerRaw = (cell("provider") || "yahoo").toLowerCase();
    const provider = providerRaw === "cnbc" ? "cnbc" : "yahoo";
    const group = migrateFinanceGroup(cell("group") || "other");

    const imageUrls = normalizeFinanceImageUrls(imageUrlsRaw);
    const normalized = normalizeCustomFinanceInstrument({
      name: cell("name") || symbol,
      symbol,
      provider,
      group,
      imageUrls,
      youtubeUrl: cell("youtubeUrl"),
      bilibiliUrl: cell("bilibiliUrl"),
      relatedLinks: normalizeFinanceRelatedLinks(relatedLinksRaw),
      featured,
    });

    if (!normalized) {
      errors.push(`第 ${lineNumber} 行: 無法解析標的（請檢查 symbol / provider）`);
      continue;
    }

    const key = `${normalized.provider}|${normalized.symbol}`;
    if (seenKeys.has(key)) {
      errors.push(`第 ${lineNumber} 行: 重複的 ${normalized.provider}:${normalized.symbol}，已略過`);
      continue;
    }
    seenKeys.add(key);
    data.push(normalized);

    if (data.length >= MAX_CUSTOM_INSTRUMENTS) {
      if (i < rows.length - 1) {
        errors.push(`已達上限 ${MAX_CUSTOM_INSTRUMENTS} 筆，其餘列略過`);
      }
      break;
    }
  }

  return { data, errors };
}
