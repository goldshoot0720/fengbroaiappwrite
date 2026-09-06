/**
 * Grok（xAI grok-cli／SuperGrok OAuth）憑證解析工具。
 *
 * grok-cli 把憑證存在 `~/.grok/auth.json`，格式是用 `"<issuer>::<clientId>"` 當 key 的物件
 * （同一份檔案可能同時存了別的 issuer，這裡只挑 `oidc_issuer === "https://auth.x.ai"` 那一筆）：
 *
 * ```json
 * {
 *   "https://auth.x.ai::<clientId>": {
 *     "key": "eyJ...",
 *     "refresh_token": "...",
 *     "expires_at": "2026-09-06T16:51:26.71Z",
 *     "oidc_issuer": "https://auth.x.ai",
 *     "oidc_client_id": "<clientId>"
 *   }
 * }
 * ```
 *
 * 使用者可以直接貼整份 `auth.json`。寫回 Appwrite 前一律轉成精簡格式，
 * 包一層 `grokOauth`——跟 Claude 的 `claudeAiOauth` 同一招，避免跟 ChatGPT 那邊
 * 「頂層有 accessToken 就當 ChatGPT session.json」的判斷打架。
 *
 * 也允許只貼裡面那顆 access token JWT（不包 refresh_token 那層），但這種 JWT
 * 跟 ChatGPT 的 access token還是三段 base64url，外型一樣——唱一能分的只有 payload
 * 裡的 `iss` claim（grok-cli 發的 token 一律是 `https://auth.x.ai`）。没有 refresh_token
 * 就需要過期後手動重貼，跟 ChatGPT 純 JWT 同一套限制。
 */

import { decodeJwtPayload, looksLikeJwt } from "./chatgptSession";

export interface GrokCredential {
  accessToken: string;
  refreshToken?: string;
  /** epoch 毫秒；沒有就當不知道過期時間，一律視為需要重新整理。 */
  expiresAt?: number;
  /** OAuth client id；換 token 時要帶回去，沒有就退回 grok-cli 官方發佈的固定 client id。 */
  clientId?: string;
}

function asTrimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toEpochMs(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    const parsed = new Date(trimmed).getTime();
    if (!Number.isNaN(parsed)) return parsed;
    const asNumber = Number(trimmed);
    if (Number.isFinite(asNumber)) return asNumber;
  }
  return undefined;
}

/** grok-cli 原始 auth.json：物件的每個 value 都帶 `oidc_issuer`，找 x.ai 那一筆。 */
function pickFromRawAuthFile(parsed: unknown): Record<string, unknown> | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const bag = value as Record<string, unknown>;
    if (asTrimmed(bag.oidc_issuer) === "https://auth.x.ai" || key.startsWith("https://auth.x.ai::")) {
      return bag;
    }
  }
  return null;
}

/** 寫回 Appwrite 用的精簡格式：`{"grokOauth":{...}}`。 */
function pickFromSimplifiedBag(parsed: unknown): Record<string, unknown> | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const nested = (parsed as Record<string, unknown>).grokOauth;
  return nested && typeof nested === "object" ? (nested as Record<string, unknown>) : null;
}

/**
 * 解析額度表 `accessToken` 欄位存的內容：吃 grok-cli 原始 `auth.json`、或精簡過的 `{grokOauth:{...}}`。
 * 不是 Grok 格式一律回 null，讓呼叫端去試別的解法（Claude／ChatGPT 等）。
 */
export function readStoredGrokCredential(stored?: string | null): GrokCredential | null {
  const raw = asTrimmed(stored);
  if (!raw) return null;

  // 純 JWT：跟 ChatGPT 的 access token 格式一樣（三段 base64url），唯一能分的只有
  // payload 裡的 iss claim。解不到 payload 或 iss 不對就當作不是 Grok，讓下一個解法試。
  if (looksLikeJwt(raw)) {
    const payload = decodeJwtPayload(raw);
    if (asTrimmed(payload?.iss) !== "https://auth.x.ai") return null;
    const exp = payload?.exp;
    return {
      accessToken: raw,
      expiresAt: typeof exp === "number" && Number.isFinite(exp) ? exp * 1000 : undefined,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const bag = pickFromRawAuthFile(parsed) || pickFromSimplifiedBag(parsed);
  if (!bag) return null;

  const accessToken = asTrimmed(bag.key) || asTrimmed(bag.accessToken);
  if (!accessToken) return null;

  const refreshToken = asTrimmed(bag.refresh_token) || asTrimmed(bag.refreshToken);
  const expiresAt = toEpochMs(bag.expires_at ?? bag.expiresAt);
  const clientId = asTrimmed(bag.oidc_client_id) || asTrimmed(bag.clientId);

  return {
    accessToken,
    refreshToken: refreshToken || undefined,
    expiresAt,
    clientId: clientId || undefined,
  };
}

/** 寫回 Appwrite 前的精簡格式；只留呼叫用量 API 需要的欄位。 */
export function serializeGrokCredential(credential: GrokCredential): string {
  return JSON.stringify({
    grokOauth: {
      accessToken: credential.accessToken,
      refreshToken: credential.refreshToken || "",
      expiresAt: credential.expiresAt ?? null,
      clientId: credential.clientId || "",
    },
  });
}

/** 提供列表用的非敏感提示（末 4 碼）。 */
export function buildGrokAccessTokenHint(stored?: string | null): string {
  const credential = readStoredGrokCredential(stored);
  if (!credential) return "";
  return credential.accessToken.slice(-4);
}
