import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyBankRecord,
  hasExplicitCategory,
  isPointsAccount,
  isTaiwanBankAccount,
} from "../../lib/bankClassification.ts";

/** Only the fields the classifier reads. */
const record = (overrides = {}) => ({
  $id: "x",
  name: "",
  $createdAt: "",
  $updatedAt: "",
  ...overrides,
});

// bank-csv.test.mjs already spot-checks the explicit-category precedence;
// this suite pins the whole rule set, including the fallbacks.
describe("bank classification rules", () => {
  it("sorts a record into exactly one of the three sections", () => {
    assert.equal(classifyBankRecord(record({ name: "台新銀行" })), "bank");
    assert.equal(classifyBankRecord(record({ name: "中華郵政" })), "bank");
    assert.equal(classifyBankRecord(record({ name: "LINE Pay Point" })), "points");
    assert.equal(classifyBankRecord(record({ name: "全聯福利點數" })), "points");
    assert.equal(classifyBankRecord(record({ name: "悠遊卡" })), "ticket");
    assert.equal(classifyBankRecord(record({ name: "Xiaomi 手環9 NFC" })), "ticket");
  });

  it("treats a bank as a bank even when the name also mentions points", () => {
    // 玉山銀行紅利點數 is a bank account that happens to accrue points.
    assert.equal(classifyBankRecord(record({ name: "玉山銀行紅利點數" })), "bank");
    assert.ok(isTaiwanBankAccount(record({ name: "玉山銀行紅利點數" })));
    assert.ok(isPointsAccount(record({ name: "玉山銀行紅利點數" })));
  });

  it("lets an explicit category beat the keyword guess", () => {
    assert.equal(
      classifyBankRecord(record({ name: "台新銀行點數卡", category: "points" })),
      "points"
    );
    assert.equal(classifyBankRecord(record({ name: "悠遊卡", category: "bank" })), "bank");
    assert.equal(classifyBankRecord(record({ name: "台新銀行", category: "ticket" })), "ticket");
  });

  it("falls back to inference for blank, unknown or malformed categories", () => {
    for (const category of ["", "   ", "銀行", "nonsense", undefined]) {
      assert.equal(
        classifyBankRecord(record({ name: "台新銀行", category })),
        "bank",
        `category=${JSON.stringify(category)}`
      );
    }
  });

  it("accepts a stored category regardless of case or padding", () => {
    assert.equal(classifyBankRecord(record({ name: "悠遊卡", category: " POINTS " })), "points");
  });

  it("reports whether the category was chosen or inferred", () => {
    assert.equal(hasExplicitCategory(record({ name: "悠遊卡" })), false);
    assert.equal(hasExplicitCategory(record({ name: "悠遊卡", category: "bank" })), true);
    assert.equal(hasExplicitCategory(record({ name: "悠遊卡", category: "oops" })), false);
  });

  it("reads the note as well as the name, so an expiry hint can classify", () => {
    assert.equal(
      classifyBankRecord(record({ name: "某張卡", note: "紅利有效期限至2027年2月7日" })),
      "points"
    );
  });

  it("does not mistake an unrelated 點 for points", () => {
    // Bare 點 would catch names like this; the keyword list requires 點數.
    assert.equal(classifyBankRecord(record({ name: "全家點餐卡" })), "ticket");
  });

  it("classifies an empty record as a ticket rather than throwing", () => {
    assert.equal(classifyBankRecord(record()), "ticket");
  });
});
