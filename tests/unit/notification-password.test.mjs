import assert from "node:assert/strict";
import { scryptSync } from "node:crypto";
import { describe, it } from "node:test";
import {
  hashNotificationPassword,
  verifyNotificationPassword,
} from "../../lib/notifications/passwordHash.ts";

describe("notification password protection", () => {
  it("accepts the correct password and rejects a different password", () => {
    const password = "unit-test-password";
    const stored = hashNotificationPassword(password);
    assert.equal(verifyNotificationPassword(password, stored), true);
    assert.equal(verifyNotificationPassword("different-password", stored), false);
  });

  it("accepts existing scrypt:N:salt:hash records without a data migration", () => {
    const password = "legacy-test-password";
    const salt = Buffer.from("00112233445566778899aabbccddeeff", "hex");
    const hash = scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 }).toString("hex");
    assert.equal(verifyNotificationPassword(password, `scrypt:16384:${salt.toString("hex")}:${hash}`), true);
  });

  it("generates a fresh random salt for every password hash", () => {
    const first = hashNotificationPassword("test-pin");
    const second = hashNotificationPassword("test-pin");
    assert.notEqual(first, second);
    assert.match(first, /^scrypt:16384:[0-9a-f]{32}:[0-9a-f]{64}$/);
    assert.equal(verifyNotificationPassword("test-pin", second), true);
  });

  it("fails closed for empty, malformed, and unsupported hashes without throwing", () => {
    const salt = "a".repeat(32);
    const hash = "b".repeat(64);
    for (const stored of ["", "garbage", "scrypt:", `other:16384:${salt}:${hash}`,
      `scrypt:1:${salt}:${hash}`, `scrypt:1073741824:${salt}:${hash}`, `scrypt:NaN:${salt}:${hash}`,
      `scrypt:16384:${salt}:not-hex`, `scrypt:16384:a:${hash}`, `scrypt:16384:${salt}:${hash}:extra`]) {
      assert.equal(verifyNotificationPassword("test-password", stored), false);
    }
    assert.equal(verifyNotificationPassword("", hashNotificationPassword("test-password")), false);
  });
});
