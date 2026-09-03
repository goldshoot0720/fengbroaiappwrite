import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * 通知密碼的 scrypt hash。
 * 只用於設定頁「顯示 / 儲存 Resend API Key」前的解鎖驗證，
 * 不阻擋 server 端 Cron（Cron 以 Appwrite API key 存取設定 Table）。
 */

const HASH_PREFIX = "scrypt:";
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

export function hashNotificationPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const derived = scryptSync(password, salt, KEY_LENGTH, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `${HASH_PREFIX}${SCRYPT_N}:${salt.toString("hex")}:${derived.toString("hex")}`;
}

export function verifyNotificationPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !password) return false;
  const [prefix, nPart, saltHex, hashHex] = storedHash.split(":");
  if (prefix !== HASH_PREFIX || !nPart || !saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  if (!salt.length || expected.length === 0) return false;
  const derived = scryptSync(password, salt, KEY_LENGTH, {
    N: Number(nPart) || SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
