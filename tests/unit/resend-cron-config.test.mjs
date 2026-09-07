import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveResendConfig, validateResendConfigs } from "../../lib/notifications/resolveResendConfig.mjs";

const stored = { passwordHash: "locked", fromEmail: "sender@example.com", slotsJson: JSON.stringify([{ apiKey: "re_test", toEmail: "recipient@example.com" }]) };

test("Cron reads locked table settings without RESEND environment variables", async () => {
  const result = await resolveResendConfig({ env: {}, readSettings: async () => stored });
  assert.equal(result.source, "notificationsettings");
  assert.equal(result.configs.length, 1);
  assert.equal(result.configs[0].apiKey, "re_test");
  assert.equal(result.configs[0].to, "recipient@example.com");
  assert.equal(result.configs[0].from, "sender@example.com");
  validateResendConfigs(result.configs);
});

test("table replaces environment recipients without merging or duplicate sending", async () => {
  const result = await resolveResendConfig({ env: { RESEND_API_KEY: "re_old", RESEND_TO_EMAIL: "old@example.com" }, readSettings: async () => stored });
  assert.equal(result.configs.length, 1);
  assert.equal(result.configs[0].apiKey, "re_test");
});

test("missing or empty settings fall back to environment", async () => {
  for (const doc of [null, { slotsJson: "[]" }]) {
    const result = await resolveResendConfig({ env: { RESEND_API_KEY: "re_env", RESEND_TO_EMAIL: "env@example.com" }, readSettings: async () => doc });
    assert.equal(result.source, "environment");
    assert.equal(result.configs[0].apiKey, "re_env");
  }
});

test("manual send uses supplied configuration without reading stored secrets", async () => {
  const result = await resolveResendConfig({ env: {}, body: { resendApiKey: "re_manual", resendTo: "manual@example.com" }, readSettings: async () => { throw new Error("must not read"); } });
  assert.equal(result.source, "manual");
  assert.equal(result.configs[0].apiKey, "re_manual");
});

test("read and parse failures do not silently send to environment recipients", async () => {
  await assert.rejects(resolveResendConfig({ readSettings: async () => { throw new Error("denied"); } }), /denied/);
  for (const slotsJson of ["broken", "{}", '[{"toEmail":"a@example.com"}]']) {
    await assert.rejects(resolveResendConfig({ readSettings: async () => ({ slotsJson }) }), /格式錯誤/);
  }
});

test("incomplete or masked saved keys fail validation", async () => {
  for (const apiKey of ["", "re_••••test"]) {
    const { configs } = await resolveResendConfig({ readSettings: async () => ({ slotsJson: JSON.stringify([{ apiKey, toEmail: "a@example.com" }]) }) });
    assert.throws(() => validateResendConfigs(configs));
  }
});
