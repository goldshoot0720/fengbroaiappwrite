import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RESEND_SETTINGS_CSV_HEADERS,
  buildResendSettingsCsv,
  parseResendSettingsCsv,
  mergeResendSlots,
} from "../../lib/notifications/resendSettingsCsv.ts";

describe("resend settings CSV", () => {
  it("exports RESEND_API_KEY / RESEND_TO_EMAIL with header and one slot per row", () => {
    assert.deepEqual(RESEND_SETTINGS_CSV_HEADERS, [
      "RESEND_API_KEY",
      "RESEND_TO_EMAIL",
    ]);

    const csv = buildResendSettingsCsv([
      { apiKey: "re_abc123", toEmail: "a@example.com" },
      { apiKey: "re_x,1", toEmail: 'b"@example.com' },
    ]);
    const [header, row1, row2] = csv.split("\n");
    assert.equal(header, "RESEND_API_KEY,RESEND_TO_EMAIL");
    assert.equal(row1, "re_abc123,a@example.com");
    assert.equal(row2, '"re_x,1","b""@example.com"');
  });

  it("skips incomplete slots when building CSV", () => {
    const csv = buildResendSettingsCsv([
      { apiKey: "re_abc123", toEmail: "a@example.com" },
      { apiKey: "", toEmail: "empty@example.com" },
      { apiKey: "re_no_email", toEmail: "" },
    ]);
    assert.equal(csv, "RESEND_API_KEY,RESEND_TO_EMAIL\nre_abc123,a@example.com");
  });

  it("round-trips parsed slots through build", () => {
    const { slots, errors } = parseResendSettingsCsv(
      'RESEND_API_KEY,RESEND_TO_EMAIL\nre_abc123,a@example.com\n"re_x,1","b""@example.com"'
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(slots, [
      { apiKey: "re_abc123", toEmail: "a@example.com" },
      { apiKey: "re_x,1", toEmail: 'b"@example.com' },
    ]);
  });

  it("accepts Chinese and alias headers", () => {
    const { slots, errors } = parseResendSettingsCsv(
      "RESEND_API_KEY,通知收件Email\nre_abc123,收件人@example.com\n"
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(slots, [{ apiKey: "re_abc123", toEmail: "收件人@example.com" }]);
  });

  it("reports row errors for empty apiKey / invalid email and missing header", () => {
    const missingHeader = parseResendSettingsCsv("FOO,BAR\nx,y");
    assert.ok(missingHeader.errors.some((error) => error.includes("RESEND_API_KEY")));

    const badRows = parseResendSettingsCsv(
      "RESEND_API_KEY,RESEND_TO_EMAIL\n,no-key@example.com\nre_bad,not-an-email\n"
    );
    assert.equal(badRows.slots.length, 0);
    assert.ok(badRows.errors.some((error) => error.includes("不能為空")));
    assert.ok(badRows.errors.some((error) => error.includes("格式不正確")));
  });

  it("rejects a file with only a header", () => {
    const { slots, errors } = parseResendSettingsCsv("RESEND_API_KEY,RESEND_TO_EMAIL\n");
    assert.deepEqual(slots, []);
    assert.ok(errors.length > 0);
  });

  it("mergeResendSlots updates matching email and appends new ones", () => {
    const current = [{ apiKey: "re_old", toEmail: "a@example.com" }];
    const result = mergeResendSlots(
      [
        { apiKey: "re_new", toEmail: "A@EXAMPLE.com" },
        { apiKey: "re_brand", toEmail: "b@example.com" },
      ],
      current
    );
    assert.deepEqual(result.slots, [
      { apiKey: "re_new", toEmail: "A@EXAMPLE.com" },
      { apiKey: "re_brand", toEmail: "b@example.com" },
    ]);
    assert.deepEqual({ added: result.added, updated: result.updated, skipped: result.skipped }, {
      added: 1,
      updated: 1,
      skipped: 0,
    });
  });

  it("mergeResendSlots keeps ordering and drops empty incoming rows", () => {
    const current = [
      { apiKey: "re_1", toEmail: "a@example.com" },
      { apiKey: "re_2", toEmail: "b@example.com" },
    ];
    const result = mergeResendSlots(
      [{ apiKey: "", toEmail: "x@example.com" }, { apiKey: "re_c", toEmail: "c@example.com" }],
      current
    );
    assert.deepEqual(result.slots, [
      { apiKey: "re_1", toEmail: "a@example.com" },
      { apiKey: "re_2", toEmail: "b@example.com" },
      { apiKey: "re_c", toEmail: "c@example.com" },
    ]);
    assert.equal(result.added, 1);
    assert.equal(result.skipped, 1);
  });
});
