/**
 * accessToken 顯示用的四位數密碼。
 *
 * 預設 0720（鋒兄慣用碼），可用環境變數 SUBSCRIPTION_TOKEN_PIN 覆寫。
 * 驗證只在 API route（伺服器端）進行，PIN 不會出現在前端 bundle。
 */

export const TOKEN_PIN_LENGTH = 4;

const DEFAULT_TOKEN_PIN = "0720";

export function getTokenPin(): string {
  const configured = (process.env.SUBSCRIPTION_TOKEN_PIN || "").trim();
  return isPinFormatValid(configured) ? configured : DEFAULT_TOKEN_PIN;
}

export function isPinFormatValid(pin: unknown): boolean {
  return typeof pin === "string" && new RegExp(`^\\d{${TOKEN_PIN_LENGTH}}$`).test(pin);
}

/** 定長比較，避免逐字元早退。 */
export function verifyTokenPin(pin: unknown): boolean {
  if (!isPinFormatValid(pin)) return false;
  const expected = getTokenPin();
  const candidate = pin as string;
  if (candidate.length !== expected.length) return false;

  let diff = 0;
  for (let index = 0; index < expected.length; index += 1) {
    diff |= candidate.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return diff === 0;
}
