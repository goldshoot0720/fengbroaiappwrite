/**
 * CSV export / import for 手機比價「歷史價格」(all models).
 *
 * One row per snapshot:
 * productId,brand,name,sourceUrl,landtopPrice,suggestedPrice,snapshotDate
 */

export const LANDTOP_HISTORY_CSV_HEADERS = [
  "productId",
  "brand",
  "name",
  "sourceUrl",
  "landtopPrice",
  "suggestedPrice",
  "snapshotDate",
] as const;

export type LandtopHistoryCsvHeader = (typeof LANDTOP_HISTORY_CSV_HEADERS)[number];

export type LandtopHistoryCsvRow = {
  productId: string;
  brand: string;
  name: string;
  sourceUrl?: string;
  landtopPrice?: number | null;
  suggestedPrice?: number | null;
  snapshotDate: string; // ISO or YYYY-MM-DD
};

const HEADER_ALIASES: Record<string, LandtopHistoryCsvHeader> = {
  productid: "productId",
  product_id: "productId",
  id: "productId",
  型號id: "productId",
  brand: "brand",
  品牌: "brand",
  name: "name",
  名稱: "name",
  型號: "name",
  商品: "name",
  sourceurl: "sourceUrl",
  source_url: "sourceUrl",
  url: "sourceUrl",
  網址: "sourceUrl",
  landtopprice: "landtopPrice",
  landtop_price: "landtopPrice",
  price: "landtopPrice",
  地標價: "landtopPrice",
  價格: "landtopPrice",
  suggestedprice: "suggestedPrice",
  suggested_price: "suggestedPrice",
  建議售價: "suggestedPrice",
  snapshotdate: "snapshotDate",
  snapshot_date: "snapshotDate",
  date: "snapshotDate",
  日期: "snapshotDate",
};

export function escapeLandtopHistoryCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function createProductId(brand: string, name: string) {
  const base = `${brand || "phone"}-${name || "item"}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return base.slice(0, 160) || `product-${Date.now()}`;
}

function normalizeSnapshotDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T00:00:00.000Z`;
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const slash = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (slash) {
    const y = slash[1];
    const m = String(Number(slash[2])).padStart(2, "0");
    const day = String(Number(slash[3])).padStart(2, "0");
    return `${y}-${m}-${day}T00:00:00.000Z`;
  }
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function parseOptionalPrice(value: string): number | null {
  if (!value || !value.trim()) return null;
  const n = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

export function toLandtopHistoryCsvRow(row: LandtopHistoryCsvRow): string {
  return [
    escapeLandtopHistoryCsvValue(row.productId),
    escapeLandtopHistoryCsvValue(row.brand),
    escapeLandtopHistoryCsvValue(row.name),
    escapeLandtopHistoryCsvValue(row.sourceUrl || ""),
    escapeLandtopHistoryCsvValue(
      typeof row.landtopPrice === "number" ? row.landtopPrice : ""
    ),
    escapeLandtopHistoryCsvValue(
      typeof row.suggestedPrice === "number" ? row.suggestedPrice : ""
    ),
    escapeLandtopHistoryCsvValue(row.snapshotDate),
  ].join(",");
}

export function buildLandtopHistoryCsv(rows: LandtopHistoryCsvRow[]): string {
  const lines = [LANDTOP_HISTORY_CSV_HEADERS.join(",")];
  for (const row of rows) {
    lines.push(toLandtopHistoryCsvRow(row));
  }
  return lines.join("\n");
}

/** Flatten chart histories into CSV rows. */
export function historiesToLandtopHistoryCsvRows(
  histories: Array<{
    id: string;
    brand: string;
    name: string;
    sourceUrl?: string | null;
    points: Array<{
      date: string;
      landtopPrice?: number | null;
      suggestedPrice?: number | null;
    }>;
  }>
): LandtopHistoryCsvRow[] {
  const rows: LandtopHistoryCsvRow[] = [];
  for (const series of histories) {
    for (const point of series.points || []) {
      if (!point?.date) continue;
      rows.push({
        productId: series.id,
        brand: series.brand || "",
        name: series.name || "",
        sourceUrl: series.sourceUrl || undefined,
        landtopPrice: typeof point.landtopPrice === "number" ? point.landtopPrice : null,
        suggestedPrice: typeof point.suggestedPrice === "number" ? point.suggestedPrice : null,
        snapshotDate: point.date,
      });
    }
  }
  // Stable sort: name, date
  return rows.sort((a, b) => {
    const byName = a.name.localeCompare(b.name, "zh-TW");
    if (byName !== 0) return byName;
    return String(a.snapshotDate).localeCompare(String(b.snapshotDate));
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

function mapHeader(raw: string): LandtopHistoryCsvHeader | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  for (const header of LANDTOP_HISTORY_CSV_HEADERS) {
    if (header.toLowerCase() === lower) return header;
  }
  return HEADER_ALIASES[normalizeHeaderKey(trimmed)] ?? HEADER_ALIASES[trimmed] ?? null;
}

export function parseLandtopHistoryCsv(text: string): {
  data: LandtopHistoryCsvRow[];
  errors: string[];
} {
  const errors: string[] = [];
  const table = parseFullCsv(text);

  if (table.length < 2) {
    errors.push("CSV 檔案至少需要表頭和一行資料");
    return { data: [], errors };
  }

  const columnIndex: Partial<Record<LandtopHistoryCsvHeader, number>> = {};
  for (let i = 0; i < table[0].length; i++) {
    const mapped = mapHeader(table[0][i] || "");
    if (mapped && columnIndex[mapped] == null) {
      columnIndex[mapped] = i;
    }
  }

  if (columnIndex.name == null && columnIndex.productId == null) {
    errors.push('表頭缺少 "name" 或 "productId"');
    return { data: [], errors };
  }
  if (columnIndex.snapshotDate == null) {
    errors.push('表頭缺少必要欄位 "snapshotDate"（日期）');
    return { data: [], errors };
  }

  const data: LandtopHistoryCsvRow[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < table.length; i++) {
    const values = table[i];
    const lineNumber = i + 1;
    const cell = (header: LandtopHistoryCsvHeader) => {
      const idx = columnIndex[header];
      if (idx == null) return "";
      return (values[idx] ?? "").trim();
    };

    const name = cell("name");
    const brand = (cell("brand") || "unknown").trim().toLowerCase();
    let productId = cell("productId");
    if (!productId) {
      if (!name) {
        errors.push(`第 ${lineNumber} 行: name / productId 不能皆空`);
        continue;
      }
      productId = createProductId(brand, name);
    }

    const snapshotDate = normalizeSnapshotDate(cell("snapshotDate"));
    if (!snapshotDate) {
      errors.push(`第 ${lineNumber} 行: snapshotDate 無效`);
      continue;
    }

    const landtopPrice = parseOptionalPrice(cell("landtopPrice"));
    const suggestedPrice = parseOptionalPrice(cell("suggestedPrice"));
    if (landtopPrice == null && suggestedPrice == null) {
      errors.push(`第 ${lineNumber} 行: 至少需要 landtopPrice 或 suggestedPrice`);
      continue;
    }

    const day = snapshotDate.slice(0, 10);
    const dedupeKey = `${day}::${productId}`;
    if (seen.has(dedupeKey)) {
      errors.push(`第 ${lineNumber} 行: 重複 ${dedupeKey}，已略過`);
      continue;
    }
    seen.add(dedupeKey);

    data.push({
      productId,
      brand: brand === "unknown" && name ? "phone" : brand,
      name: name || productId,
      sourceUrl: cell("sourceUrl") || undefined,
      landtopPrice,
      suggestedPrice,
      snapshotDate,
    });

    if (data.length >= 5000) {
      errors.push("已達匯入上限 5000 列，其餘略過");
      break;
    }
  }

  return { data, errors };
}
