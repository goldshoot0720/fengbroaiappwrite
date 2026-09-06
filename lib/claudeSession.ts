/**
 * Claude（Claude Code OAuth）憑證解析工具。
 *
 * 跟 ChatGPT 那邊（見 `lib/chatgptSession.ts`）同一個道理，只是 Claude 這邊
 * access token 只活 ~60 分鐘，非得配一顆 refresh token 才撐得住自動更新的保鮮期，
 * 所以額度表的 `accessToken` 欄位存的是整理過的 JSON：
 * `{"accessToken":"sk-ant-oat01-...","refreshToken":"sk-ant-ort01-...","expiresAt":1234567890123}`
 *
 * 使用者可以直接貼 `~/.claude/.credentials.json`（或 macOS Keychain 匯出）的原始內容，
 * 不管是整份檔案（帶 `claudeAiOauth` 外殼）還是只有那個子物件，這裡都吃得下去，
 * 寫回 Appwrite 前一律轉成上面那個精簡格式（不留 `scopes`／`subscriptionType` 等不需要的欄位）。
 */

export interface ClaudeCredential {
  accessToken: string;
  refreshToken?: string;
  /** epoch 毫秒；沒有就當不知道過期時間，一律視為需要重新整理。 */
  expiresAt?: number;
}

function asTrimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Claude Code OAuth access token 的固定前綴，用來跟 ChatGPT 的 JWT 區分。 */
export function looksLikeClaudeAccessToken(value: string): boolean {
  return /^sk-ant-oat01-/.test(value.trim());
}

export function looksLikeClaudeRefreshToken(value: string): boolean {
  return /^sk-ant-ort01-/.test(value.trim());
}

function toEpochMs(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const asNumber = Number(value.trim());
    if (Number.isFinite(asNumber) && value.trim() === String(asNumber)) return asNumber;
    const parsed = new Date(value.trim()).getTime();
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
}

function pickCredentialBag(parsed: unknown): Record<string, unknown> | null {
  if (!parsed || typeof parsed !== "object") return null;
  const bag = parsed as Record<string, unknown>;
  // 整份 .credentials.json 會包一層 claudeAiOauth
  const nested = bag.claudeAiOauth;
  if (nested && typeof nested === "object") return nested as Record<string, unknown>;
  return bag;
}

/**
 * 解析額度表 `accessToken` 欄位存的內容。
 * 接受：純 access token 字串（沒有 refresh token，過期後就得手動重貼）、
 * 或整理過／原始的憑證 JSON。不是 Claude 格式一律回 null，讓呼叫端去試別的解法（ChatGPT 等）。
 */
export function readStoredClaudeCredential(stored?: string | null): ClaudeCredential | null {
  const raw = asTrimmed(stored);
  if (!raw) return null;

  if (looksLikeClaudeAccessToken(raw)) {
    return { accessToken: raw };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const bag = pickCredentialBag(parsed);
  if (!bag) return null;

  const accessToken = asTrimmed(bag.accessToken);
  if (!looksLikeClaudeAccessToken(accessToken)) return null;

  const refreshToken = asTrimmed(bag.refreshToken);
  const expiresAt = toEpochMs(bag.expiresAt);

  return {
    accessToken,
    refreshToken: refreshToken || undefined,
    expiresAt,
  };
}

/** 寫回 Appwrite 前的精簡格式；只留呼叫用量 API 需要的三個欄位。 */
export function serializeClaudeCredential(credential: ClaudeCredential): string {
  return JSON.stringify({
    accessToken: credential.accessToken,
    refreshToken: credential.refreshToken || "",
    expiresAt: credential.expiresAt ?? null,
  });
}

/** 提供列表用的非敏感提示（末 4 碼）。 */
export function buildClaudeAccessTokenHint(stored?: string | null): string {
  const credential = readStoredClaudeCredential(stored);
  if (!credential) return "";
  return credential.accessToken.slice(-4);
}
