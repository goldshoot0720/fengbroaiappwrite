import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  QUOTA_CSV_HEADERS,
  buildQuotaCsv,
  parseQuotaCsv,
  quotaImportKey,
} from "../../lib/quotaCsv.ts";

const sample = {
  $id: "doc1",
  name: "ChatGPT",
  serviceType: "ai",
  account: "owner@example.com",
  quotaRemaining: 30,
  quotaPoints: 45,
  litmediaAccount: "19",
  quotaRatio: 60,
  quotaExpiry: "2026-09-30T00:00:00.000Z",
  ratio5h: 100,
  expiry5h: "14:30",
  ratioWeek: 50,
  expiryWeek: "2026-09-15",
  ratioMonth: 20,
  expiryMonth: "2026-12-31",
  note: "主帳號, 含逗號",
};

describe("quota CSV", () => {
  it("exports the fifteen Appwrite fields and round-trips quoted notes", () => {
    assert.deepEqual(QUOTA_CSV_HEADERS, [
      "name",
      "serviceType",
      "account",
      "quotaRemaining",
      "quotaPoints",
      "litmediaAccount",
      "quotaRatio",
      "quotaExpiry",
      "ratio5h",
      "expiry5h",
      "ratioWeek",
      "expiryWeek",
      "ratioMonth",
      "expiryMonth",
      "note",
    ]);

    const csv = buildQuotaCsv([sample]);
    assert.match(csv, /^name,serviceType,account,quotaRemaining,quotaPoints,litmediaAccount,quotaRatio,quotaExpiry,ratio5h,expiry5h,ratioWeek,expiryWeek,ratioMonth,expiryMonth,note\n/);
    assert.match(csv, /"主帳號, 含逗號"/);

    const { data, errors } = parseQuotaCsv(`\uFEFF${csv}`);
    assert.deepEqual(errors, []);
    assert.deepEqual(data, [
      {
        name: "ChatGPT",
        serviceType: "ai",
        account: "owner@example.com",
        quotaRemaining: 30,
        quotaPoints: 45,
        litmediaAccount: "19",
        quotaRatio: 60,
        quotaExpiry: "2026-09-30",
        ratio5h: 100,
        expiry5h: "14:30",
        ratioWeek: 50,
        expiryWeek: "2026-09-15",
        ratioMonth: 20,
        expiryMonth: "2026-12-31",
        note: "主帳號, 含逗號",
      },
    ]);
  });

  it("accepts Chinese headers and labels, and matches 服務×帳號", () => {
    const csv = [
      "服務名稱,服務類型,帳號,剩餘次數,剩餘點數,簽到帳號,剩餘比例,到期日,備註",
      " ChatGPT ,AI 服務,Owner@example.com ,30,45,19,60,2026/09/30,主帳號",
    ].join("\n");

    const { data, errors } = parseQuotaCsv(csv);
    assert.deepEqual(errors, []);
    assert.equal(data[0].serviceType, "ai");
    assert.equal(data[0].quotaRemaining, 30);
    assert.equal(data[0].quotaPoints, 45);
    assert.equal(data[0].litmediaAccount, "19");
    assert.equal(data[0].quotaRatio, 60);
    assert.equal(data[0].quotaExpiry, "2026-09-30");
    assert.equal(
      quotaImportKey(data[0]),
      quotaImportKey({ name: "chatgpt", account: "owner@example.com" }),
    );
  });

  it("skips invalid rows and requires a service name", () => {
    // 欄位順序對應 QUOTA_CSV_HEADERS（15 欄）
    const csv = [
      QUOTA_CSV_HEADERS.join(","),
      ["", "general", "", "0", "0", "", "0", "", "", "", "", "", "", "", ""].join(","),
      ["服務", "unknown", "a", "0", "0", "", "0", "", "", "", "", "", "", "", ""].join(","),
      ["服務", "general", "a", "0", "0", "", "0", "2026-02-30", "", "", "", "", "", "", ""].join(","),
      ["服務", "general", "a", "-1", "0", "", "0", "", "", "", "", "", "", "", ""].join(","),
      ["服務", "general", "a", "0", "-1", "", "0", "", "", "", "", "", "", "", ""].join(","),
      ["服務", "ai", "a", "0", "0", "", "0", "", "100", "下午", "10", "", "10", "", ""].join(","),
      ["服務", "ai", "a", "0", "0", "", "0", "", "100", "09:00", "10", "09-30", "10", "", ""].join(","),
    ].join("\n");

    const { data, errors } = parseQuotaCsv(csv);
    assert.equal(data.length, 0);
    assert.ok(errors.some((error) => error.includes("name")));
    assert.ok(errors.some((error) => error.includes("服務類型")));
    assert.ok(errors.some((error) => error.includes("到期日")));
    assert.ok(errors.some((error) => error.includes("次數")));
    assert.ok(errors.some((error) => error.includes("點數")));
    assert.ok(errors.some((error) => error.includes("5 小時到期")));
    assert.ok(errors.some((error) => error.includes("一週到期")));
  });

  it("fills defaults when optional columns are omitted", () => {
    const { data, errors } = parseQuotaCsv("name\nNotion");
    assert.deepEqual(errors, []);
    assert.deepEqual(data, [
      {
        name: "Notion",
        serviceType: "general",
        account: "",
        quotaRemaining: 0,
        quotaPoints: 0,
        litmediaAccount: "",
        quotaRatio: 0,
        quotaExpiry: "",
        ratio5h: 0,
        expiry5h: "",
        ratioWeek: 0,
        expiryWeek: "",
        ratioMonth: 0,
        expiryMonth: "",
        note: "",
      },
    ]);
  });
});
