/**
 * Command Code CLI 憑證解析工具。
 *
 * Command Code 將登入資訊放在 `~/.commandcode/auth.json`。額度資料只需要 apiKey，
 * 但保留辨識用的帳號 metadata，才能讓日後貼回原始檔或精簡後的資料都能被辨識。
 * 寫入 Appwrite 時包在 `commandCode` 下，避免被 ChatGPT session JSON 的解析誤認。
 */

export interface CommandCodeCredential {
  apiKey: string;
  userId?: string;
  userName?: string;
  keyName?: string;
  authenticatedAt?: string;
}

function asTrimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isBag(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function pickCredentialBag(parsed: unknown): Record<string, unknown> | null {
  if (!isBag(parsed)) return null;
  const nested = parsed.commandCode;
  return isBag(nested) ? nested : parsed;
}

/**
 * 讀取原始 `~/.commandcode/auth.json` 或儲存後的 `{ commandCode: {...} }`。
 * 需要 apiKey 加上至少一個 CLI 的帳號識別欄位，避免把任意 JSON 誤當成 Command Code 憑證。
 */
export function readStoredCommandCodeCredential(stored?: string | null): CommandCodeCredential | null {
  const raw = asTrimmed(stored);
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const bag = pickCredentialBag(parsed);
  if (!bag) return null;

  const apiKey = asTrimmed(bag.apiKey);
  const userId = asTrimmed(bag.userId);
  const userName = asTrimmed(bag.userName);
  const keyName = asTrimmed(bag.keyName);
  const authenticatedAt = asTrimmed(bag.authenticatedAt);

  if (!apiKey || !(userId || userName || keyName || authenticatedAt)) return null;

  return {
    apiKey,
    userId: userId || undefined,
    userName: userName || undefined,
    keyName: keyName || undefined,
    authenticatedAt: authenticatedAt || undefined,
  };
}

/** 寫回 Appwrite 的精簡格式；不保留 CLI 不需要的其他設定。 */
export function serializeCommandCodeCredential(credential: CommandCodeCredential): string {
  return JSON.stringify({
    commandCode: {
      apiKey: credential.apiKey,
      ...(credential.userId ? { userId: credential.userId } : {}),
      ...(credential.userName ? { userName: credential.userName } : {}),
      ...(credential.keyName ? { keyName: credential.keyName } : {}),
      ...(credential.authenticatedAt ? { authenticatedAt: credential.authenticatedAt } : {}),
    },
  });
}

/** 供列表使用的非敏感提示（末 4 碼）。 */
export function buildCommandCodeAccessTokenHint(stored?: string | null): string {
  const credential = readStoredCommandCodeCredential(stored);
  return credential ? credential.apiKey.slice(-4) : "";
}
