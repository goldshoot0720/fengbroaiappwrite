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
