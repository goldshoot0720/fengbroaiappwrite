import { buildCsv, mapCsvHeader, parseFullCsv } from "@/lib/csvText";
import type { UdemyCourse, UdemyCourseFormData } from "@/types";

export const UDEMY_CSV_HEADERS = [
  "name",
  "instructor",
  "language",
  "framework",
  "technology",
  "watchedLectures",
  "totalLectures",
  "courseUpdatedAt",
  "totalHours",
  "completed",
] as const;

export type UdemyCsvHeader = (typeof UDEMY_CSV_HEADERS)[number];

const HEADER_ALIASES: Record<string, UdemyCsvHeader> = {
  課程名稱: "name",
  課程: "name",
  名稱: "name",
  講師名稱: "instructor",
  講師: "instructor",
  程式語言: "language",
  語言: "language",
  框架: "framework",
  技術名稱: "technology",
  技術: "technology",
  已觀看堂數: "watchedLectures",
  已看堂數: "watchedLectures",
  課程總堂數: "totalLectures",
  總堂數: "totalLectures",
  課程上次更新時間: "courseUpdatedAt",
  上次更新: "courseUpdatedAt",
  課程總時長小時: "totalHours",
  總時長: "totalHours",
  課程已經完整收看: "completed",
  已看完: "completed",
};

const TRUE_VALUES = new Set(["true", "yes", "1", "是", "已看完", "v", "✓"]);
const FALSE_VALUES = new Set(["", "false", "no", "0", "否", "未看完"]);

/** 程式語言／框架／技術名稱欄位可填多個值，以「,」「、」「，」分隔。 */
export function splitUdemyTags(value?: string): string[] {
  return [...new Set(String(value || "").split(/[,、，]/).map((tag) => tag.trim()).filter(Boolean))];
}

export function udemyImportKey(item: { name: string }): string {
  return item.name.trim().toLocaleLowerCase("zh-Hant");
}

/** 已觀看比重（0–100）；完整收看一律算 100%，未填總堂數算 0%。 */
export function udemyWatchedPercent(course: Pick<UdemyCourseFormData, "watchedLectures" | "totalLectures" | "completed">): number {
  if (course.completed) return 100;
  const total = Number(course.totalLectures) || 0;
  if (total <= 0) return 0;
  return Math.min(100, Math.round(((Number(course.watchedLectures) || 0) / total) * 100));
}

export function buildUdemyCsv(courses: Array<Pick<UdemyCourse, UdemyCsvHeader>>): string {
  return buildCsv(
    [...UDEMY_CSV_HEADERS],
    courses.map((course) => [
      course.name || "",
      course.instructor || "",
      course.language || "",
      course.framework || "",
      course.technology || "",
      course.watchedLectures || 0,
      course.totalLectures || 0,
      course.courseUpdatedAt ? course.courseUpdatedAt.slice(0, 10) : "",
      course.totalHours || 0,
      course.completed === true,
    ]),
  );
}

function normalizeDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "";
  // Udemy 只顯示「上次更新 2025/8」，只有年月時補成當月 1 日
  const match = trimmed.match(/^(\d{4})[-/.](\d{1,2})(?:[-/.](\d{1,2}))?$/);
  if (!match) return null;
  const isoDate = `${match[1]}-${match[2].padStart(2, "0")}-${(match[3] || "1").padStart(2, "0")}`;
  const calendarDate = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== isoDate) return null;
  return isoDate;
}

export function parseUdemyCsv(text: string): { data: UdemyCourseFormData[]; errors: string[] } {
  const data: UdemyCourseFormData[] = [];
  const rows = parseFullCsv(text);
  if (rows.length < 2) return { data, errors: ["CSV 檔案至少需要表頭和一行資料"] };

  const header = mapCsvHeader(rows[0], { fields: UDEMY_CSV_HEADERS, aliases: HEADER_ALIASES, required: ["name"] });
  if (header.errors.length) return { data, errors: header.errors };
  const errors: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const lineNumber = i + 1;
    const cell = (field: UdemyCsvHeader) => {
      const index = header.index.get(field);
      return index == null ? "" : (rows[i][index] ?? "").trim();
    };

    const name = cell("name");
    if (!name) { errors.push(`第 ${lineNumber} 行: 課程名稱不能為空`); continue; }
    if (name.length > 200) { errors.push(`第 ${lineNumber} 行: 課程名稱最多 200 個字元`); continue; }
    const instructor = cell("instructor");
    if (instructor.length > 200) { errors.push(`第 ${lineNumber} 行: 講師名稱最多 200 個字元`); continue; }
    const language = cell("language");
    const framework = cell("framework");
    const technology = cell("technology");
    if ([language, framework, technology].some((value) => value.length > 200)) {
      errors.push(`第 ${lineNumber} 行: 程式語言／框架／技術名稱各最多 200 個字元`);
      continue;
    }

    const watchedRaw = cell("watchedLectures");
    const totalRaw = cell("totalLectures");
    if (!/^\d*$/.test(watchedRaw) || !/^\d*$/.test(totalRaw)) {
      errors.push(`第 ${lineNumber} 行: 堂數必須是 0 以上的整數`);
      continue;
    }
    const watchedLectures = Number(watchedRaw || 0);
    const totalLectures = Number(totalRaw || 0);
    if (totalLectures > 0 && watchedLectures > totalLectures) {
      errors.push(`第 ${lineNumber} 行: 已觀看堂數不能超過課程總堂數`);
      continue;
    }

    const hoursRaw = cell("totalHours");
    const totalHours = Number(hoursRaw || 0);
    if (!/^\d*(?:\.\d+)?$/.test(hoursRaw) || !Number.isFinite(totalHours)) {
      errors.push(`第 ${lineNumber} 行: 課程總時長必須是 0 以上的數字`);
      continue;
    }

    const courseUpdatedAt = normalizeDate(cell("courseUpdatedAt"));
    if (courseUpdatedAt === null) {
      errors.push(`第 ${lineNumber} 行: 課程上次更新時間格式不正確（例如 2025-08-01 或 2025/8）`);
      continue;
    }

    const completedRaw = cell("completed").toLowerCase();
    if (!TRUE_VALUES.has(completedRaw) && !FALSE_VALUES.has(completedRaw)) {
      errors.push(`第 ${lineNumber} 行: 課程已經完整收看需為 true／false（或 是／否）`);
      continue;
    }

    data.push({
      name,
      instructor,
      language,
      framework,
      technology,
      watchedLectures,
      totalLectures,
      courseUpdatedAt,
      totalHours,
      completed: TRUE_VALUES.has(completedRaw),
    });
  }

  return { data, errors };
}
