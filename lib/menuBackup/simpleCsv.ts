import { buildCsv, parseFullCsv } from "@/lib/csvText";
import {
  detectSubscriptionCsvMode,
  parseSubscriptionCsvRow,
  SUBSCRIPTION_CSV_HEADERS,
  subscriptionFormToCsvValues,
  toSubscriptionForm,
} from "@/lib/subscriptionFields";
import type { CommonAccount, Food, Subscription } from "@/types";

type RoutineLike = {
  name?: string;
  note?: string;
  lastdate1?: string | null;
  lastdate2?: string | null;
  lastdate3?: string | null;
  link?: string;
  photo?: string;
};

type MusicLike = {
  name?: string;
  category?: string;
  language?: string;
  lyrics?: string;
  note?: string;
  ref?: string;
};

type VideoLike = {
  name?: string;
  category?: string;
  note?: string;
  ref?: string;
};

export const FOOD_CSV_HEADERS = ["name", "amount", "todate", "photo", "price", "shop", "photohash"] as const;
export const ROUTINE_CSV_HEADERS = ["name", "note", "lastdate1", "lastdate2", "lastdate3", "link", "photo"] as const;
export const MUSIC_META_CSV_HEADERS = ["name", "category", "language", "lyrics", "note", "ref"] as const;
export const VIDEO_META_CSV_HEADERS = ["name", "category", "note", "ref"] as const;
export const COMMON_ACCOUNT_SITE_COUNT = 37;

export function commonAccountCsvHeaders(): string[] {
  const headers = ["name"];
  for (let i = 1; i <= COMMON_ACCOUNT_SITE_COUNT; i++) {
    const idx = String(i).padStart(2, "0");
    headers.push(`site${idx}`, `note${idx}`);
  }
  return headers;
}

function parseExact(
  text: string,
  headers: readonly string[],
): { data: Record<string, string>[]; errors: string[] } {
  const errors: string[] = [];
  const data: Record<string, string>[] = [];
  const rows = parseFullCsv(text);
  if (rows.length < 2) {
    errors.push("CSV 檔案至少需要表頭和一行資料");
    return { data, errors };
  }
  const headerValues = rows[0].map((header) => header.trim());
  if (headerValues.length !== headers.length) {
    errors.push(`表頭欄位數量錯誤: 預期 ${headers.length} 欄，實際 ${headerValues.length} 欄`);
    return { data, errors };
  }
  for (let i = 0; i < headers.length; i++) {
    if (headerValues[i] !== headers[i]) {
      errors.push(`表頭第 ${i + 1} 欄錯誤: 預期 "${headers[i]}"，實際 "${headerValues[i]}"`);
      if (errors.length >= 5) {
        errors.push("...更多錯誤已省略");
        break;
      }
    }
  }
  if (errors.length > 0) return { data, errors };

  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    if (values.length !== headers.length) {
      errors.push(`第 ${i + 1} 行: 欄位數量錯誤`);
      continue;
    }
    if (!values[0]?.trim()) {
      errors.push(`第 ${i + 1} 行: 第一欄不能為空`);
      continue;
    }
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() || "";
    });
    data.push(row);
  }
  return { data, errors };
}

export function buildFoodCsv(items: Food[]): string {
  return buildCsv(
    [...FOOD_CSV_HEADERS],
    items.map((food) => [
      food.name || "",
      food.amount || 0,
      food.todate || "",
      food.photo || "",
      food.price || 0,
      food.shop || "",
      food.photohash || "",
    ]),
  );
}

export function parseFoodCsv(text: string): { data: Array<{
  name: string;
  amount: number;
  todate: string;
  photo: string;
  price: number;
  shop: string;
  photohash: string;
}>; errors: string[] } {
  const rows = parseFullCsv(text);
  const errors: string[] = [];
  const data: Array<{
    name: string;
    amount: number;
    todate: string;
    photo: string;
    price: number;
    shop: string;
    photohash: string;
  }> = [];
  if (rows.length < 2) {
    errors.push("CSV 檔案至少需要表頭和一行資料");
    return { data, errors };
  }
  const headerValues = rows[0].map((header) => header.trim());
  const missing = FOOD_CSV_HEADERS.filter((header) => !headerValues.includes(header));
  if (missing.length > 0) {
    errors.push(`表頭缺少欄位: ${missing.join(", ")}`);
    return { data, errors };
  }
  const headerIndexMap = Object.fromEntries(headerValues.map((header, index) => [header, index]));
  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    const name = values[headerIndexMap.name]?.trim() || "";
    if (!name) {
      errors.push(`第 ${i + 1} 行: name 欄位不能為空`);
      continue;
    }
    data.push({
      name,
      amount: parseFloat(values[headerIndexMap.amount]) || 0,
      todate: values[headerIndexMap.todate]?.trim() || "",
      photo: values[headerIndexMap.photo]?.trim() || "",
      price: parseFloat(values[headerIndexMap.price]) || 0,
      shop: values[headerIndexMap.shop]?.trim() || "",
      photohash: values[headerIndexMap.photohash]?.trim() || "",
    });
  }
  return { data, errors };
}

export function buildRoutineCsv(items: RoutineLike[]): string {
  return buildCsv(
    [...ROUTINE_CSV_HEADERS],
    items.map((routine) => [
      routine.name || "",
      routine.note || "",
      routine.lastdate1 || "",
      routine.lastdate2 || "",
      routine.lastdate3 || "",
      routine.link || "",
      routine.photo || "",
    ]),
  );
}

export function parseRoutineCsv(text: string) {
  const parsed = parseExact(text, ROUTINE_CSV_HEADERS);
  return {
    errors: parsed.errors,
    data: parsed.data.map((row) => ({
      name: row.name,
      note: row.note,
      lastdate1: row.lastdate1 || "",
      lastdate2: row.lastdate2 || "",
      lastdate3: row.lastdate3 || "",
      link: row.link,
      photo: row.photo,
    })),
  };
}

export function buildCommonAccountCsv(items: CommonAccount[]): string {
  const headers = commonAccountCsvHeaders();
  const rows = items.map((account) => {
    const row: Array<string | number | boolean> = [account.name || ""];
    for (let i = 1; i <= COMMON_ACCOUNT_SITE_COUNT; i++) {
      const idx = String(i).padStart(2, "0");
      row.push((account[`site${idx}` as keyof CommonAccount] as string) || "");
      row.push((account[`note${idx}` as keyof CommonAccount] as string) || "");
    }
    return row;
  });
  return buildCsv(headers, rows);
}

export function parseCommonAccountCsv(text: string) {
  const headers = commonAccountCsvHeaders();
  const parsed = parseExact(text, headers);
  return {
    errors: parsed.errors,
    data: parsed.data.map((row) => {
      const form: Record<string, string> = { name: row.name };
      for (let i = 1; i <= COMMON_ACCOUNT_SITE_COUNT; i++) {
        const idx = String(i).padStart(2, "0");
        form[`site${idx}`] = row[`site${idx}`] || "";
        form[`note${idx}`] = row[`note${idx}`] || "";
      }
      return form;
    }),
  };
}

export function buildMusicMetaCsv(items: MusicLike[]): string {
  return buildCsv(
    [...MUSIC_META_CSV_HEADERS],
    items.map((item) => [
      item.name || "",
      item.category || "",
      item.language || "",
      item.lyrics || "",
      item.note || "",
      item.ref || "",
    ]),
  );
}

export function parseMusicMetaCsv(text: string) {
  const parsed = parseExact(text, MUSIC_META_CSV_HEADERS);
  return {
    errors: parsed.errors,
    data: parsed.data.map((row) => ({
      name: row.name,
      category: row.category,
      language: row.language,
      lyrics: row.lyrics,
      note: row.note,
      ref: row.ref,
    })),
  };
}

export function buildVideoMetaCsv(items: VideoLike[]): string {
  return buildCsv(
    [...VIDEO_META_CSV_HEADERS],
    items.map((item) => [item.name || "", item.category || "", item.note || "", item.ref || ""]),
  );
}

export function parseVideoMetaCsv(text: string) {
  const parsed = parseExact(text, VIDEO_META_CSV_HEADERS);
  return {
    errors: parsed.errors,
    data: parsed.data.map((row) => ({
      name: row.name,
      category: row.category,
      note: row.note,
      ref: row.ref,
    })),
  };
}

export function buildSubscriptionCsv(items: Subscription[]): string {
  return buildCsv(
    [...SUBSCRIPTION_CSV_HEADERS],
    items.map((item) => subscriptionFormToCsvValues(toSubscriptionForm(item))),
  );
}

export function parseSubscriptionBackupCsv(text: string) {
  const errors: string[] = [];
  const rows = parseFullCsv(text);
  if (rows.length < 2) {
    return { data: [], errors: ["CSV 檔案至少需要表頭和一行資料"] };
  }
  const headerValues = rows[0].map((header) => header.trim());
  if (!detectSubscriptionCsvMode(headerValues)) {
    errors.push(`表頭無法辨識：請使用 ${SUBSCRIPTION_CSV_HEADERS.length} 欄完整格式`);
    return { data: [], errors };
  }
  const data = [];
  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    if (!values[0]?.trim()) {
      errors.push(`第 ${i + 1} 行: name 欄位不能為空`);
      continue;
    }
    data.push(parseSubscriptionCsvRow(values));
  }
  return { data, errors };
}


