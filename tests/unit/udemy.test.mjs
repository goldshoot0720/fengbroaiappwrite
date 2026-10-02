import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  UDEMY_CSV_HEADERS,
  buildUdemyCsv,
  parseUdemyCsv,
  splitUdemyTags,
  udemyImportKey,
  udemyWatchedPercent,
} from "../../lib/udemyCsv.ts";
import {
  ADDITIVE_SETUP_TABLES,
  MANAGEMENT_TABLE_SCHEMAS,
  buildUdemyCourseWritePayload,
  toUdemyCourseForm,
} from "../../lib/managementRecords.ts";

const sample = {
  $id: "course1",
  name: "The Complete JavaScript Course, 2026",
  instructor: "Jonas Schmedtmann",
  language: "JavaScript",
  framework: "",
  technology: "DOM、Async",
  watchedLectures: 120,
  totalLectures: 320,
  courseUpdatedAt: "2025-08-01T00:00:00.000Z",
  totalHours: 69.5,
  completed: false,
};

describe("udemy table", () => {
  it("registers an additive udemy table with the agreed columns", () => {
    assert.ok(ADDITIVE_SETUP_TABLES.includes("udemy"));
    assert.deepEqual(
      MANAGEMENT_TABLE_SCHEMAS.udemy.attributes.map((attr) => [attr.key, attr.type]),
      [
        ["name", "string"],
        ["instructor", "string"],
        ["language", "string"],
        ["framework", "string"],
        ["technology", "string"],
        ["watchedLectures", "integer"],
        ["totalLectures", "integer"],
        ["courseUpdatedAt", "datetime"],
        ["totalHours", "float"],
        ["completed", "boolean"],
      ],
    );
  });

  it("normalizes a write payload and clears the date on update", () => {
    const payload = buildUdemyCourseWritePayload({ ...toUdemyCourseForm(sample), name: "  JS  ", courseUpdatedAt: "" }, "update");
    assert.equal(payload.name, "JS");
    assert.equal(payload.totalHours, 69.5);
    assert.equal(payload.completed, false);
    assert.equal(payload.courseUpdatedAt, null);
    assert.equal(buildUdemyCourseWritePayload({ name: "x", courseUpdatedAt: "2025-08-01" }, "create").courseUpdatedAt, "2025-08-01T00:00:00.000Z");
  });

  it("rejects watched lectures beyond the total and negative hours", () => {
    assert.throws(() => buildUdemyCourseWritePayload({ name: "x", watchedLectures: 11, totalLectures: 10 }, "create"), /不能超過/);
    assert.throws(() => buildUdemyCourseWritePayload({ name: "x", totalHours: -1 }, "create"), /0 以上的數字/);
    assert.throws(() => buildUdemyCourseWritePayload({ name: " " }, "create"), /課程名稱/);
  });
});

describe("udemy helpers", () => {
  it("computes the watched percent, treating completed courses as 100%", () => {
    assert.equal(udemyWatchedPercent({ watchedLectures: 120, totalLectures: 320 }), 38);
    assert.equal(udemyWatchedPercent({ watchedLectures: 5, totalLectures: 0 }), 0);
    assert.equal(udemyWatchedPercent({ watchedLectures: 0, totalLectures: 10, completed: true }), 100);
  });

  it("splits multi-value tags on commas and 、", () => {
    assert.deepEqual(splitUdemyTags("React, Next.js、React，Vue"), ["React", "Next.js", "Vue"]);
    assert.deepEqual(splitUdemyTags(""), []);
  });
});

describe("udemy CSV", () => {
  it("round-trips every column including quoted names", () => {
    const csv = buildUdemyCsv([sample]);
    assert.equal(csv.split("\n")[0], UDEMY_CSV_HEADERS.join(","));
    const parsed = parseUdemyCsv(csv);
    assert.deepEqual(parsed.errors, []);
    assert.deepEqual(parsed.data, [{
      name: sample.name,
      instructor: sample.instructor,
      language: "JavaScript",
      framework: "",
      technology: "DOM、Async",
      watchedLectures: 120,
      totalLectures: 320,
      courseUpdatedAt: "2025-08-01",
      totalHours: 69.5,
      completed: false,
    }]);
  });

  it("accepts Chinese headers, year-month dates and 是/否", () => {
    const parsed = parseUdemyCsv("課程名稱,講師名稱,框架,已觀看堂數,課程總堂數,課程上次更新時間,課程總時長小時,課程已經完整收看\nReact 課,Max,React,10,10,2025/8,40,是\n");
    assert.deepEqual(parsed.errors, []);
    assert.equal(parsed.data[0].courseUpdatedAt, "2025-08-01");
    assert.equal(parsed.data[0].framework, "React");
    assert.equal(parsed.data[0].completed, true);
  });

  it("reports bad rows without importing them", () => {
    const parsed = parseUdemyCsv("name,watchedLectures,totalLectures\nA,5,3\nB,x,3\n,1,1\n");
    assert.equal(parsed.data.length, 0);
    assert.equal(parsed.errors.length, 3);
  });

  it("matches existing courses by name case-insensitively", () => {
    assert.equal(udemyImportKey({ name: " React Course " }), udemyImportKey({ name: "react course" }));
  });
});
