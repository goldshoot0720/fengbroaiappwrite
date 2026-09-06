/**
 * Command Code CLI 憑證解析工具。
 *
 * Command Code 將登入資訊放在 `~/.commandcode/auth.json`。額度資料只需要 apiKey，
 * 因此可直接貼 API key；完整檔案則額外保留辨識用的帳號 metadata。
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
 * 純 API key 沒有官方固定前綴；只接受夠長、無空白、不是 JWT 或 Claude OAuth 的字串。
 * 這樣能支援 CLI 產生的 key，同時不會把 ChatGPT/Grok JWT 或 Claude token 誤判過來。
 */
function looksLikeRawCommandCodeApiKey(value: string): boolean {
  return value.length >= 32 && !/[.\s]/.test(value) && !value.startsWith("sk-ant-");
}

function buildCredential(bag: Record<string, unknown>, apiKey: string): CommandCodeCredential {
  const userId = asTrimmed(bag.userId);
  const userName = asTrimmed(bag.userName);
  const keyName = asTrimmed(bag.keyName);
  const authenticatedAt = asTrimmed(bag.authenticatedAt);
  return {
    apiKey,
    ...(userId ? { userId } : {}),
    ...(userName ? { userName } : {}),
    ...(keyName ? { keyName } : {}),
    ...(authenticatedAt ? { authenticatedAt } : {}),
  };
}

/**
 * 讀取純 API key、原始 `~/.commandcode/auth.json`，或儲存後的 `{ commandCode: {...} }`。
 * JSON 裡明確有 `apiKey` 就可用；純字串則先避開其他 provider 的 token 格式。
 */
export function readStoredCommandCodeCredential(stored?: string | null): CommandCodeCredential | null {
  const raw = asTrimmed(stored);
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return looksLikeRawCommandCodeApiKey(raw) ? { apiKey: raw } : null;
  }

  const bag = pickCredentialBag(parsed);
  if (!bag) return null;

  const apiKey = asTrimmed(bag.apiKey);
  return apiKey ? buildCredential(bag, apiKey) : null;
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
