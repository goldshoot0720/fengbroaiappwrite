import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  TRIAL_PURCHASE_CSV_HEADERS,
  buildTrialPurchaseCsv,
  parseTrialPurchaseCsv,
  trialPurchaseImportKey,
} from "../../lib/trialPurchaseCsv.ts";

const sample = {
  $id: "doc1",
  name: "ChatGPT",
  eventDate: "2026-09-30T00:00:00.000Z",
  firstPurchasePrice: 300,
  regularPrice: 660,
  account: "owner@example.com",
  note: "主帳號, 含逗號",
  trialStatus: "tried",
  purchaseStatus: "purchased",
};

describe("trial-purchase CSV", () => {
  it("exports the eight Appwrite fields and round-trips quoted notes", () => {
    assert.deepEqual(TRIAL_PURCHASE_CSV_HEADERS, [
      "name",
      "eventDate",
      "firstPurchasePrice",
      "regularPrice",
      "account",
      "note",
      "trialStatus",
      "purchaseStatus",
    ]);

    const csv = buildTrialPurchaseCsv([sample]);
    assert.match(csv, /^name,eventDate,firstPurchasePrice,regularPrice,account,note,trialStatus,purchaseStatus\n/);
    assert.match(csv, /"主帳號, 含逗號"/);

    const { data, errors } = parseTrialPurchaseCsv(`\uFEFF${csv}`);
    assert.deepEqual(errors, []);
    assert.deepEqual(data, [
      {
        name: "ChatGPT",
        eventDate: "2026-09-30",
        firstPurchasePrice: 300,
        regularPrice: 660,
        account: "owner@example.com",
        note: "主帳號, 含逗號",
        trialStatus: "tried",
        purchaseStatus: "purchased",
      },
    ]);
  });

  it("accepts Chinese headers and status labels, and matches 服務×帳號", () => {
    const csv = [
      "服務名稱,帳號,試用狀態,首購狀態,首購價格,非首購價格,日期,備註",
      " ChatGPT , Owner@example.com ,已試用,已首購,300,660,2026/09/30,主帳號",
    ].join("\n");

    const { data, errors } = parseTrialPurchaseCsv(csv);
    assert.deepEqual(errors, []);
    assert.equal(data[0].trialStatus, "tried");
    assert.equal(data[0].purchaseStatus, "purchased");
    assert.equal(data[0].eventDate, "2026-09-30");
    assert.equal(
      trialPurchaseImportKey(data[0]),
      trialPurchaseImportKey({ name: "chatgpt", account: "owner@example.com" }),
    );
  });

  it("skips invalid rows and requires a service name", () => {
    const csv = [
      TRIAL_PURCHASE_CSV_HEADERS.join(","),
      ",,0,0,,,,",
      "服務,2026-02-30,0,0,a,,untried,not_purchased",
      "服務,2026-09-01,-1,0,a,,untried,not_purchased",
      "服務,2026-09-01,0,0,a,,unknown,not_purchased",
      "服務,2026-09-01,0,0,a,,untried,maybe",
    ].join("\n");

    const { data, errors } = parseTrialPurchaseCsv(csv);
    assert.equal(data.length, 0);
    assert.ok(errors.some((error) => error.includes("name")));
    assert.ok(errors.some((error) => error.includes("日期")));
    assert.ok(errors.some((error) => error.includes("價格")));
    assert.ok(errors.some((error) => error.includes("試用狀態")));
    assert.ok(errors.some((error) => error.includes("首購狀態")));
  });

  it("reads every trial and purchase state, in code or in Chinese", () => {
    const csv = [
      TRIAL_PURCHASE_CSV_HEADERS.join(","),
      "A,,0,0,,,untried,not_purchased",
      "B,,0,0,,,trialing,purchasing",
      "C,,0,0,,,tried,purchased",
      "D,,0,0,,,no_trial,purchased",
      "E,,0,0,,,未試用,無首購",
      "F,,0,0,,,試用中,首購中",
      "G,,0,0,,,已試用,已首購",
      "H,,0,0,,,無試用,已首購",
    ].join("\n");

    const { data, errors } = parseTrialPurchaseCsv(csv);
    assert.deepEqual(errors, []);
    assert.deepEqual(
      data.map((row) => [row.trialStatus, row.purchaseStatus]),
      [
        ["untried", "not_purchased"],
        ["trialing", "purchasing"],
        ["tried", "purchased"],
        ["no_trial", "purchased"],
        ["untried", "not_purchased"],
        ["trialing", "purchasing"],
        ["tried", "purchased"],
        ["no_trial", "purchased"],
      ],
    );
  });

  it("still imports the wording used before the three-step progression", () => {
    const csv = [
      TRIAL_PURCHASE_CSV_HEADERS.join(","),
      "A,,0,0,,,尚未試用,未首購",
      "B,,0,0,,,已試用,無提供首購",
    ].join("\n");

    const { data, errors } = parseTrialPurchaseCsv(csv);
    assert.deepEqual(errors, []);
    assert.deepEqual(
      data.map((row) => [row.trialStatus, row.purchaseStatus]),
      [
        ["untried", "not_purchased"],
        ["tried", "unavailable"],
      ],
    );
  });

  it("fills defaults when optional columns are omitted", () => {
    const { data, errors } = parseTrialPurchaseCsv("name\nNotion");
    assert.deepEqual(errors, []);
    assert.deepEqual(data, [
      {
        name: "Notion",
        eventDate: "",
        firstPurchasePrice: 0,
        regularPrice: 0,
        account: "",
        note: "",
        trialStatus: "untried",
        purchaseStatus: "not_purchased",
      },
    ]);
  });
});
