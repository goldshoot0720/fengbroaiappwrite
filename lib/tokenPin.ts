/**
 * accessToken 顯示用的四位數密碼。
 *
 * 不設環境變數也能用，預設 0720（鋒兄慣用碼）。
 * 要換成自己的四位數字：QUOTA_TOKEN_PIN=1234
 * （SUBSCRIPTION_TOKEN_PIN 是搬到額度頁之前的舊名，仍可用。）
 *
 * 驗證只在 API route（伺服器端）進行，PIN 不會出現在前端 bundle。
 */

export const TOKEN_PIN_LENGTH = 4;

export const DEFAULT_TOKEN_PIN = "0720";

export function getTokenPin(): string {
  const configured = (
    process.env.QUOTA_TOKEN_PIN ||
    process.env.SUBSCRIPTION_TOKEN_PIN ||
    ""
  ).trim();
  // 格式不對（例如打成 5 碼）就退回預設，不會把所有人鎖在門外
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
