import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildReinstallSoftwareWritePayload,
  buildTrialPurchaseWritePayload,
  emptyReinstallSoftwareForm,
  emptyTrialPurchaseForm,
  formatReinstallSubscriptionPeriod,
  matchesReinstallViewPassword,
  parseReinstallSubscriptionPeriod,
  reinstallSubscriptionPeriodLabel,
  safeSoftwareUrl,
} from "../../lib/managementRecords.ts";

describe("trial/purchase records", () => {
  it("starts a new account in the action-needed states", () => {
    assert.deepEqual(emptyTrialPurchaseForm("ChatGPT"), {
      name: "ChatGPT",
      eventDate: "",
      firstPurchasePrice: 0,
      regularPrice: 0,
      account: "",
      note: "",
      trialStatus: "untried",
      purchaseStatus: "not_purchased",
    });
  });

  it("normalizes a complete create payload", () => {
    assert.deepEqual(
      buildTrialPurchaseWritePayload(
        {
          name: "  ChatGPT  ",
          eventDate: "2026-09-30",
          firstPurchasePrice: "300",
          regularPrice: 660,
          account: "  owner@example.com ",
          note: " 主帳號 ",
          trialStatus: "tried",
          purchaseStatus: "purchased",
        },
        "create",
      ),
      {
        name: "ChatGPT",
        eventDate: "2026-09-30T00:00:00.000Z",
        firstPurchasePrice: 300,
        regularPrice: 660,
        account: "owner@example.com",
        note: "主帳號",
        trialStatus: "tried",
        purchaseStatus: "purchased",
      },
    );
  });

  it("clears an optional date on update and rejects invalid prices", () => {
    const payload = buildTrialPurchaseWritePayload(
      {
        name: "服務",
        eventDate: "",
        firstPurchasePrice: 0,
        regularPrice: 0,
      },
      "update",
    );
    assert.equal(payload.eventDate, null);
    assert.throws(
      () => buildTrialPurchaseWritePayload({ name: "服務", firstPurchasePrice: -1 }, "create"),
      /0 以上的整數/,
    );
  });

  it("rejects invalid calendar dates, status values, and oversized fields", () => {
    for (const eventDate of ["2026-02-30", "2026-13-01", "tomorrow"]) {
      assert.throws(() => buildTrialPurchaseWritePayload({ name: "服務", eventDate }, "create"), /日期格式/);
    }
    assert.throws(() => buildTrialPurchaseWritePayload({ name: "服務", trialStatus: "unknown" }, "create"), /試用狀態/);
    assert.throws(() => buildTrialPurchaseWritePayload({ name: "服務", purchaseStatus: "unknown" }, "create"), /首購狀態/);
    assert.throws(() => buildTrialPurchaseWritePayload({ name: "x".repeat(101) }, "create"), /最多 100/);
    assert.throws(() => buildTrialPurchaseWritePayload({ name: "服務", firstPurchasePrice: true }, "create"), /整數/);
    assert.throws(() => buildTrialPurchaseWritePayload(null, "create"), /物件/);
  });
});

describe("reinstall software records", () => {
  it("defaults to Windows free software without a serial", () => {
    assert.deepEqual(emptyReinstallSoftwareForm(), {
      name: "",
      system: "win",
      softwareType: "free",
      licenseType: "none",
      serial: "",
      viewPassword: "",
      subscriptionSoftware: false,
      subscriptionPeriodCount: 1,
      subscriptionPeriodUnit: "month",
      subscriptionPrice: 0,
      subscriptionCurrency: "TWD",
      site: "",
      note: "",
    });
  });

  it("never keeps a serial or view password when the license type says no serial", () => {
    const payload = buildReinstallSoftwareWritePayload(
      {
        name: "7-Zip",
        system: "win",
        softwareType: "free",
        licenseType: "none",
        serial: "SHOULD-NOT-BE-SAVED",
        viewPassword: "SHOULD-NOT-BE-SAVED",
        site: "https://www.7-zip.org",
      },
      "create",
    );
    assert.equal(payload.serial, "");
    assert.equal(payload.viewPassword, "");
    assert.equal(payload.site, "https://www.7-zip.org/");
  });

  it("keeps paid serials and view passwords, and clears empty websites on update", () => {
    const paid = buildReinstallSoftwareWritePayload(
      {
        name: "付費軟體",
        system: "mac",
        softwareType: "paid",
        licenseType: "paid_serial",
        serial: " AAAA-BBBB ",
        viewPassword: " secret ",
      },
      "create",
    );
    assert.equal(paid.serial, "AAAA-BBBB");
    assert.equal(paid.viewPassword, "secret");

    const cleared = buildReinstallSoftwareWritePayload({ name: "付費軟體", site: "" }, "update");
    assert.equal(cleared.site, null);
  });

  it("rejects an oversized view password and matches the stored value", () => {
    assert.throws(
      () => buildReinstallSoftwareWritePayload({
        name: "付費軟體",
        licenseType: "paid_serial",
        viewPassword: "x".repeat(101),
      }, "create"),
      /查看密碼/,
    );
    assert.equal(matchesReinstallViewPassword("secret", "secret"), true);
    assert.equal(matchesReinstallViewPassword(" secret ", "secret"), true);
    assert.equal(matchesReinstallViewPassword("secret", "wrong"), false);
  });

  it("stores subscription period as ?年/?月 with TWD/USD/JPY/CNY fees", () => {
    const payload = buildReinstallSoftwareWritePayload(
      {
        name: "Adobe",
        subscriptionSoftware: true,
        subscriptionPeriodCount: 1,
        subscriptionPeriodUnit: "year",
        subscriptionPrice: 990,
        subscriptionCurrency: "USD",
      },
      "create",
    );
    assert.equal(payload.subscriptionSoftware, true);
    assert.equal(payload.subscriptionPeriod, "1年");
    assert.equal(payload.subscriptionPrice, 990);
    assert.equal(payload.subscriptionCurrency, "USD");

    const fromLabel = buildReinstallSoftwareWritePayload(
      { name: "Adobe", subscriptionSoftware: true, subscriptionPeriod: "3月", subscriptionPrice: "120", subscriptionCurrency: "JPY" },
      "create",
    );
    assert.equal(fromLabel.subscriptionPeriod, "3月");
    assert.equal(fromLabel.subscriptionCurrency, "JPY");

    const cleared = buildReinstallSoftwareWritePayload(
      { name: "Adobe", subscriptionSoftware: false, subscriptionPeriod: "1年", subscriptionPrice: 990, subscriptionCurrency: "USD" },
      "create",
    );
    assert.equal(cleared.subscriptionSoftware, false);
    assert.equal(cleared.subscriptionPeriod, "");
    assert.equal(cleared.subscriptionPrice, 0);
    assert.equal(cleared.subscriptionCurrency, "TWD");

    assert.deepEqual(parseReinstallSubscriptionPeriod("2年"), { count: 2, unit: "year" });
    assert.equal(formatReinstallSubscriptionPeriod(3, "month"), "3月");
    assert.equal(reinstallSubscriptionPeriodLabel("1年"), "1 年");
    assert.equal(reinstallSubscriptionPeriodLabel("3月"), "3 個月");
  });

  it("rejects invalid subscription period and currency", () => {
    assert.throws(
      () => buildReinstallSoftwareWritePayload({ name: "Adobe", subscriptionSoftware: true, subscriptionPeriod: "一年" }, "create"),
      /訂閱週期/,
    );
    assert.throws(
      () => buildReinstallSoftwareWritePayload({ name: "Adobe", subscriptionSoftware: true, subscriptionPeriodCount: 0 }, "create"),
      /1 以上/,
    );
    assert.throws(
      () => buildReinstallSoftwareWritePayload({ name: "Adobe", subscriptionSoftware: true, subscriptionCurrency: "EUR" }, "create"),
      /訂閱費用幣別/,
    );
  });

  it("rejects non-web protocols", () => {
    assert.throws(
      () => buildReinstallSoftwareWritePayload({ name: "危險連結", site: "javascript:alert(1)" }, "create"),
      /http 或 https/,
    );
  });

  it("rejects unknown categories and never renders unsafe stored links", () => {
    assert.throws(() => buildReinstallSoftwareWritePayload({ name: "工具", system: "linux" }, "create"), /使用系統/);
    assert.throws(() => buildReinstallSoftwareWritePayload({ name: "工具", softwareType: "unknown" }, "create"), /軟體類型/);
    assert.throws(() => buildReinstallSoftwareWritePayload({ name: "工具", licenseType: "unknown" }, "create"), /授權方式/);
    assert.equal(safeSoftwareUrl("javascript:alert(1)"), undefined);
    assert.equal(safeSoftwareUrl("https://example.test"), "https://example.test/");
  });
});
