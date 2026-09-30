/** Shared RFC-style CSV helpers used by menu backup (and safe to reuse elsewhere). */

export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n") || stringValue.includes("\r")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export function parseFullCsv(text: string): string[][] {
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

export type CsvHeaderSpec = {
  /** Canonical field names, in export order. */
  fields: readonly string[];
  /** Other spellings of a field, e.g. the 鋒兄 Supabase app's Chinese labels. */
  aliases?: Readonly<Record<string, string>>;
  /** Columns other exports carry that have no field here; dropped silently. */
  ignore?: readonly string[];
  /** Fields that must be present in the header. */
  required?: readonly string[];
};

/**
 * Maps a header row onto canonical field names so a CSV imports regardless of
 * column order, header case, or an alias spelling. Unknown columns are still
 * errors: they usually mean the wrong file was picked.
 * Returns field → column index; a column in `ignore` gets no entry.
 */
export function mapCsvHeader(
  headerRow: readonly string[],
  spec: CsvHeaderSpec,
): { index: Map<string, number>; errors: string[] } {
  const lookup = new Map<string, string>();
  for (const field of spec.fields) lookup.set(field.toLowerCase(), field);
  for (const [alias, field] of Object.entries(spec.aliases ?? {})) lookup.set(alias.toLowerCase(), field);
  const ignored = new Set((spec.ignore ?? []).map((name) => name.toLowerCase()));

  const index = new Map<string, number>();
  const errors: string[] = [];
  headerRow.forEach((raw, i) => {
    const name = raw.trim();
    const key = name.toLowerCase();
    if (!name) {
      errors.push(`表頭第 ${i + 1} 欄是空的（可能有多餘的逗號）`);
    } else if (ignored.has(key)) {
      // Known extra column from another export; nothing to store.
    } else if (!lookup.has(key)) {
      errors.push(`表頭第 ${i + 1} 欄無法辨識: "${name}"`);
    } else {
      const field = lookup.get(key)!;
      if (index.has(field)) errors.push(`表頭第 ${i + 1} 欄重複: "${name}"`);
      else index.set(field, i);
    }
  });

  for (const field of spec.required ?? []) {
    if (!index.has(field)) errors.push(`表頭缺少 "${field}" 欄`);
  }

  if (errors.length > 5) return { index, errors: [...errors.slice(0, 5), "...更多錯誤已省略"] };
  return { index, errors };
}

export function withBom(csv: string): string {
  return csv.startsWith("\uFEFF") ? csv : `\uFEFF${csv}`;
}

export function buildCsv(headers: string[], rows: Array<Array<string | number | boolean>>): string {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCsvValue).join(","));
  }
  return lines.join("\n");
}

export function parseCsvObjects(text: string): { headers: string[]; rows: Record<string, string>[]; errors: string[] } {
  const errors: string[] = [];
  const table = parseFullCsv(text);
  if (table.length === 0) {
    return { headers: [], rows: [], errors: ["CSV 檔案是空的"] };
  }
  const headers = table[0].map((header) => header.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < table.length; i++) {
    const values = table[i];
    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] ?? "";
    });
    rows.push(obj);
  }
  return { headers, rows, errors };
}
