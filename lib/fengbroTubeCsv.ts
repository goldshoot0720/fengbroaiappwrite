/**
 * CSV export / import for 鋒兄Tube channel list (localStorage).
 *
 * Columns: alias,sourceUrl
 */

import {
  getFengbroTubeHandle,
  normalizeFengbroTubeChannels,
  stripRemovedFengbroTubeChannels,
  toFengbroTubeChannelConfig,
  type FengbroTubeChannelConfig,
} from "@/lib/fengbroTubeChannels";

export const FENGBRO_TUBE_CSV_HEADERS = ["alias", "sourceUrl"] as const;

export type FengbroTubeCsvHeader = (typeof FENGBRO_TUBE_CSV_HEADERS)[number];

const HEADER_ALIASES: Record<string, FengbroTubeCsvHeader> = {
  alias: "alias",
  別名: "alias",
  頻道別名: "alias",
  名稱: "alias",
  name: "alias",
  title: "alias",
  sourceurl: "sourceUrl",
  source_url: "sourceUrl",
  url: "sourceUrl",
  網址: "sourceUrl",
  頻道網址: "sourceUrl",
  channel: "sourceUrl",
  handle: "sourceUrl",
};

const MAX_CHANNELS = 80;

export function escapeTubeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export function toFengbroTubeCsvRow(channel: FengbroTubeChannelConfig): string {
  return [
    escapeTubeCsvValue(channel.alias || ""),
    escapeTubeCsvValue(channel.sourceUrl),
  ].join(",");
}

export function buildFengbroTubeCsv(channels: FengbroTubeChannelConfig[]): string {
  const rows = [FENGBRO_TUBE_CSV_HEADERS.join(",")];
  for (const channel of channels) {
    rows.push(toFengbroTubeCsvRow(channel));
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

function mapHeader(raw: string): FengbroTubeCsvHeader | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  for (const header of FENGBRO_TUBE_CSV_HEADERS) {
    if (header.toLowerCase() === lower) return header;
  }
  return HEADER_ALIASES[normalizeHeaderKey(trimmed)] ?? HEADER_ALIASES[trimmed] ?? null;
}

/**
 * Merge imported channels into existing list (upsert by normalized sourceUrl).
 * Imported alias overwrites when non-empty.
 */
export function mergeFengbroTubeChannels(
  existing: FengbroTubeChannelConfig[],
  incoming: FengbroTubeChannelConfig[]
): FengbroTubeChannelConfig[] {
  const map = new Map<string, FengbroTubeChannelConfig>();
  const order: string[] = [];

  for (const channel of existing) {
    if (!map.has(channel.sourceUrl)) order.push(channel.sourceUrl);
    map.set(channel.sourceUrl, channel);
  }
  for (const channel of incoming) {
    if (!map.has(channel.sourceUrl)) order.push(channel.sourceUrl);
    const prev = map.get(channel.sourceUrl);
    map.set(channel.sourceUrl, {
      sourceUrl: channel.sourceUrl,
      alias: channel.alias?.trim() || prev?.alias || "",
    });
  }

  return stripRemovedFengbroTubeChannels(
    order
      .map((url) => map.get(url)!)
      .filter(Boolean)
      .slice(0, MAX_CHANNELS)
  );
}

export function parseFengbroTubeCsv(text: string): {
  data: FengbroTubeChannelConfig[];
  errors: string[];
} {
  const errors: string[] = [];
  const rows = parseFullCsv(text);

  if (rows.length < 2) {
    errors.push("CSV 檔案至少需要表頭和一行資料");
    return { data: [], errors };
  }

  const columnIndex: Partial<Record<FengbroTubeCsvHeader, number>> = {};
  for (let i = 0; i < rows[0].length; i++) {
    const mapped = mapHeader(rows[0][i] || "");
    if (mapped && columnIndex[mapped] == null) {
      columnIndex[mapped] = i;
    }
  }

  // Support headerless single-column "sourceUrl only" if first cell looks like a URL / @handle
  const hasSourceCol = columnIndex.sourceUrl != null;
  const hasAliasCol = columnIndex.alias != null;

  if (!hasSourceCol) {
    // If headers failed, try treating column 0 or 1 as URL for rows that look like channels
    const firstHeader = (rows[0][0] || "").trim();
    if (/^https?:\/\//i.test(firstHeader) || firstHeader.startsWith("@") || firstHeader.includes("youtube") || firstHeader.includes("bilibili")) {
      // No proper header row — reparse all rows as data with sourceUrl in col0
      const data: FengbroTubeChannelConfig[] = [];
      const seen = new Set<string>();
      for (let i = 0; i < rows.length; i++) {
        const source = (rows[i][0] || "").trim();
        const alias = (rows[i][1] || "").trim();
        const channel = toFengbroTubeChannelConfig(
          alias ? { alias, sourceUrl: source } : source
        );
        if (!channel) {
          errors.push(`第 ${i + 1} 行: 無法解析頻道網址`);
          continue;
        }
        if (seen.has(channel.sourceUrl)) continue;
        seen.add(channel.sourceUrl);
        data.push(channel);
        if (data.length >= MAX_CHANNELS) break;
      }
      return {
        data: stripRemovedFengbroTubeChannels(normalizeFengbroTubeChannels(data)),
        errors,
      };
    }

    errors.push('表頭缺少必要欄位 "sourceUrl"（頻道網址）');
    return { data: [], errors };
  }

  const data: FengbroTubeChannelConfig[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    const lineNumber = i + 1;
    const cell = (header: FengbroTubeCsvHeader) => {
      const idx = columnIndex[header];
      if (idx == null) return "";
      return (values[idx] ?? "").trim();
    };

    const sourceUrl = cell("sourceUrl");
    if (!sourceUrl) {
      errors.push(`第 ${lineNumber} 行: sourceUrl 不能為空`);
      continue;
    }

    const alias = hasAliasCol ? cell("alias") : "";
    const channel = toFengbroTubeChannelConfig({
      alias,
      sourceUrl,
    });

    if (!channel) {
      errors.push(`第 ${lineNumber} 行: 無法解析頻道（需為 YouTube / Bilibili 網址或 @handle）`);
      continue;
    }

    if (seen.has(channel.sourceUrl)) {
      errors.push(`第 ${lineNumber} 行: 重複頻道 ${getFengbroTubeHandle(channel.sourceUrl) || channel.sourceUrl}，已略過`);
      continue;
    }
    seen.add(channel.sourceUrl);
    data.push(channel);

    if (data.length >= MAX_CHANNELS) {
      if (i < rows.length - 1) {
        errors.push(`已達上限 ${MAX_CHANNELS} 個頻道，其餘列略過`);
      }
      break;
    }
  }

  return {
    data: stripRemovedFengbroTubeChannels(normalizeFengbroTubeChannels(data)),
    errors,
  };
}
