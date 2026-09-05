/**
 * ChatGPT / Codex 憑證解析工具。
 *
 * 訂閱表的 `accessToken` 欄位可存兩種格式：
 * 1. 純 JWT（`eyJ...`）
 * 2. 精簡 JSON：`{"accessToken":"eyJ...","accountId":"..."}`
 *
 * 第 2 種是貼上 https://chatgpt.com/api/auth/session 下載的 session.json 後
 * 自動整理的結果（只留呼叫用量 API 需要的兩個值，不存 sessionToken）。
 */

export interface ChatGptCredential {
  accessToken: string;
  accountId?: string;
}

export interface ChatGptSessionSummary extends ChatGptCredential {
  email?: string;
  planType?: string;
  expires?: string;
}

function asTrimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** 看起來像 JWT（三段 base64url）就當作 access token。 */
export function looksLikeJwt(value: string): boolean {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value.trim());
}

function decodeBase64Url(segment: string): string {
  const padded = segment.replace(/-/g, "+").replace(/_/g, "/");
  const withPadding = padded + "=".repeat((4 - (padded.length % 4)) % 4);

  if (typeof atob === "function") {
    const binary = atob(withPadding);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  return Buffer.from(withPadding, "base64").toString("utf8");
}

/** 解析 JWT payload；失敗回傳 null（不丟例外）。 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const segment = token.split(".")[1];
  if (!segment) return null;
  try {
    const parsed = JSON.parse(decodeBase64Url(segment));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** 從 JWT claims 取 ChatGPT 帳號 ID（用於 ChatGPT-Account-Id 標頭）。 */
export function readAccountIdFromToken(token: string): string {
  const payload = decodeJwtPayload(token);
  if (!payload) return "";

  const authClaim = payload["https://api.openai.com/auth"];
  if (authClaim && typeof authClaim === "object") {
    const claim = authClaim as Record<string, unknown>;
    const candidate =
      asTrimmed(claim.chatgpt_account_id) ||
      asTrimmed(claim.organization_id) ||
      asTrimmed(claim.account_id);
    if (candidate) return candidate;
  }

  return asTrimmed(payload.chatgpt_account_id) || asTrimmed(payload.account_id);
}

/** JWT 的到期時間（exp claim）。 */
export function readTokenExpiry(token: string): string {
  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;
  if (typeof exp !== "number" || !Number.isFinite(exp)) return "";
  return new Date(exp * 1000).toISOString();
}

/**
 * 解析使用者貼上的內容：可以是整份 session.json、JSON 片段，或純 JWT。
 * 解析不出 accessToken 時回傳 null。
 */
export function parseChatGptSession(input: string): ChatGptSessionSummary | null {
  const raw = asTrimmed(input);
  if (!raw) return null;

  if (looksLikeJwt(raw)) {
    return { accessToken: raw, accountId: readAccountIdFromToken(raw) || undefined };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  const source = parsed as Record<string, unknown>;

  const accessToken = asTrimmed(source.accessToken) || asTrimmed(source.access_token);
  if (!accessToken) return null;

  const account = (source.account && typeof source.account === "object"
    ? (source.account as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const user = (source.user && typeof source.user === "object"
    ? (source.user as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const accountId =
    asTrimmed(source.accountId) ||
    asTrimmed(source.account_id) ||
    asTrimmed(account.id) ||
    readAccountIdFromToken(accessToken);

  return {
    accessToken,
    accountId: accountId || undefined,
    email: asTrimmed(user.email) || undefined,
    planType: asTrimmed(account.planType) || asTrimmed(account.plan_type) || undefined,
    expires: asTrimmed(source.expires) || undefined,
  };
}

/** 組成要寫進 Appwrite 的字串（有帳號 ID 才用 JSON，省空間）。 */
export function buildStoredCredential(credential: ChatGptCredential): string {
  const accessToken = asTrimmed(credential.accessToken);
  if (!accessToken) return "";
  const accountId = asTrimmed(credential.accountId);
  if (!accountId) return accessToken;
  return JSON.stringify({ accessToken, accountId });
}

/** 讀回 Appwrite 欄位內容；兩種格式都吃。 */
export function readStoredCredential(stored?: string | null): ChatGptCredential | null {
  const raw = asTrimmed(stored);
  if (!raw) return null;

  if (looksLikeJwt(raw)) {
    return { accessToken: raw, accountId: readAccountIdFromToken(raw) || undefined };
  }

  const parsed = parseChatGptSession(raw);
  if (!parsed) return null;
  return { accessToken: parsed.accessToken, accountId: parsed.accountId };
}

/** 遮罩顯示：只留開頭與結尾各 4 碼。 */
export function maskAccessToken(token?: string | null): string {
  const raw = asTrimmed(token);
  if (!raw) return "";
  if (raw.length <= 12) return "•".repeat(raw.length);
  return `${raw.slice(0, 4)}${"•".repeat(12)}${raw.slice(-4)}`;
}

/** 提供列表用的非敏感提示（末 4 碼）。 */
export function buildAccessTokenHint(stored?: string | null): string {
  const credential = readStoredCredential(stored);
  if (!credential) return "";
  return credential.accessToken.slice(-4);
}
