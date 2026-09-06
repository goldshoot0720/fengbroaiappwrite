import { normalizeClaudeUsage } from "../../../lib/claudeUsage";

/**
 * Claude（Claude Code OAuth）用量查詢（非公開 API，欄位可能變動）。
 * 端點與必要 header 來自社群逆向：
 * https://github.com/Maciek-roboblog/Claude-Code-Usage-Monitor/issues/202
 *
 * access token 只活 ~60 分鐘，過期就得先用 refresh token 換一顆新的——
 * 跟 ChatGPT 那邊（純 JWT、過期要使用者手動重貼 session.json）不同，
 * 這邊有 refresh token 就儘量自動換，能少一次手動操作是一次。
 */
const USAGE_ENDPOINT = "https://api.anthropic.com/api/oauth/usage";
const REFRESH_ENDPOINT = "https://console.anthropic.com/v1/oauth/token";
/** Claude Code CLI 對外公開、固定不變的 OAuth client id（非帳號密鑰）。 */
const OAUTH_CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
/**
 * 缺少正確格式的 User-Agent 會被丟進另一個限流特別嚴的桶子、持續 429
 * （見上面那個 issue）。可用環境變數覆寫，版本落後太多被限流時不用改程式碼重部署。
 */
const USER_AGENT = process.env.CLAUDE_CODE_USER_AGENT || "claude-code/2.0.1";
/** 過期判斷抓 60 秒緩衝，避免請求送到一半才跨過期線。 */
const EXPIRY_BUFFER_MS = 60 * 1000;

function buildHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    "anthropic-beta": "oauth-2025-04-20",
    "User-Agent": USER_AGENT,
  };
}

async function fetchJson(url, init) {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { ok: response.ok, status: response.status, data, text };
}

function isExpired(credential, now) {
  return typeof credential.expiresAt === "number" && credential.expiresAt - EXPIRY_BUFFER_MS <= now;
}

/**
 * 用 refresh token 換一顆新的 access token。
 * Anthropic 這條端點會回傳*新的* refresh token（沿用舊的下次會失敗），
 * 呼叫端務必把回傳的 credential 整組寫回存放處，不能只留 accessToken。
 *
 * @returns {Promise<{ ok: true, credential: { accessToken: string, refreshToken: string, expiresAt: number } } | { ok: false, status: number, error: string }>}
 */
async function refreshAccessToken(refreshToken) {
  let result;
  try {
    result = await fetchJson(REFRESH_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: OAUTH_CLIENT_ID,
      }),
    });
  } catch (err) {
    return { ok: false, status: 502, error: err instanceof Error ? err.message : "換新 access token 失敗" };
  }

  if (!result.ok || !result.data) {
    const message =
      result.data?.error?.message ||
      result.data?.error_description ||
      (result.status === 429 ? "換新 access token 被限流，稍後再試。" : "refresh token 無效或已過期，請重新登入取得新憑證。");
    return { ok: false, status: result.status || 502, error: message };
  }

  const accessToken = result.data.access_token;
  const newRefreshToken = result.data.refresh_token || refreshToken;
  const expiresIn = Number(result.data.expires_in);
  if (typeof accessToken !== "string" || !accessToken) {
    return { ok: false, status: 502, error: "refresh 回應缺少 access_token" };
  }

  return {
    ok: true,
    credential: {
      accessToken,
      refreshToken: newRefreshToken,
      expiresAt: Number.isFinite(expiresIn) ? Date.now() + expiresIn * 1000 : undefined,
    },
  };
}

/**
 * 取一份 Claude 用量快照，需要時自動用 refresh token 換新的 access token。
 *
 * @param {{ accessToken: string, refreshToken?: string, expiresAt?: number }} credential
 * @returns {Promise<
 *   | { ok: true, snapshot: any, tokenExpiry: string | null, rotatedCredential: { accessToken: string, refreshToken?: string, expiresAt?: number } | null }
 *   | { ok: false, status: number, error: string, tokenExpiry: string | null, rotatedCredential: null }
 * >}
 */
export async function loadClaudeSnapshot(credential) {
  let current = credential;
  let rotated = null;
  const now = Date.now();

  if (isExpired(current, now)) {
    if (!current.refreshToken) {
      return {
        ok: false,
        status: 401,
        error: "access token 已過期，且沒有 refresh token 可以自動換新，請重新貼上憑證。",
        tokenExpiry: current.expiresAt ? new Date(current.expiresAt).toISOString() : null,
        rotatedCredential: null,
      };
    }
    const refreshed = await refreshAccessToken(current.refreshToken);
    if (!refreshed.ok) {
      return { ok: false, status: refreshed.status, error: refreshed.error, tokenExpiry: null, rotatedCredential: null };
    }
    current = refreshed.credential;
    rotated = refreshed.credential;
  }

  let usage = await fetchJson(USAGE_ENDPOINT, { headers: buildHeaders(current.accessToken) });

  // access token 沒過期紀錄、但其實已經失效（例如伺服器端提早撤銷）：401 就補一次 refresh 重試
  if (!usage.ok && usage.status === 401 && current.refreshToken) {
    const refreshed = await refreshAccessToken(current.refreshToken);
    if (refreshed.ok) {
      current = refreshed.credential;
      rotated = refreshed.credential;
      usage = await fetchJson(USAGE_ENDPOINT, { headers: buildHeaders(current.accessToken) });
    }
  }

  if (!usage.ok || !usage.data) {
    const message =
      usage.data?.error?.message ||
      (usage.status === 429
        ? "查詢用量被限流，稍後再試（Claude 官方端點對頻繁查詢很敏感）。"
        : usage.status === 401
          ? "access token 無效，請重新登入 Claude Code 或重新貼上憑證。"
          : "無法取得 Claude 用量資料（非公開 API 可能已變動）。");
    return {
      ok: false,
      status: usage.status || 502,
      error: message,
      tokenExpiry: current.expiresAt ? new Date(current.expiresAt).toISOString() : null,
      rotatedCredential: rotated,
    };
  }

  const snapshot = normalizeClaudeUsage(usage.data, USAGE_ENDPOINT);
  return {
    ok: true,
    snapshot,
    tokenExpiry: current.expiresAt ? new Date(current.expiresAt).toISOString() : null,
    rotatedCredential: rotated,
  };
}
