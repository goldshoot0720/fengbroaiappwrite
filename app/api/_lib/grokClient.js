import { decodeGrokCreditsResponse } from "./grokProtobuf";

/**
 * Grok（xAI grok-cli／SuperGrok OAuth）用量查詢（非公開 API，欄位可能變動）。
 *
 * 查的是 grok.com 網頁版「設定 → 用量」卡片背後打的 gRPC-web 方法：
 *   POST https://grok.com/grok_api_v2.GrokBuildBilling/GetGrokCreditsConfig
 * 回應是 protobuf（沒有公開 .proto，解碼邏輯見 grokProtobuf.js）。
 *
 * OAuth 常數（issuer / token endpoint）來自 xAI 官方 grok-cli 的裝置流程，
 * access token 效期短，靠 refresh token 換新——跟 Claude Code 同一套邏輯
 * （見 claudeClient.js），差別只在端點跟回應格式。
 */
const USAGE_ENDPOINT = "https://grok.com/grok_api_v2.GrokBuildBilling/GetGrokCreditsConfig";
const TOKEN_ENDPOINT = "https://auth.x.ai/oauth2/token";
/** grok-cli 官方發佈、固定不變的 OAuth client id（非帳號密鑰），沒帶 clientId 時的退路。 */
const DEFAULT_CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828";
/** 過期判斷抓 60 秒緩衝，避免請求送到一半才跨過期線。 */
const EXPIRY_BUFFER_MS = 60 * 1000;

function isExpired(credential, now) {
  return typeof credential.expiresAt === "number" && credential.expiresAt - EXPIRY_BUFFER_MS <= now;
}

/**
 * 用 refresh token 換一顆新的 access token。
 * @returns {Promise<{ ok: true, credential: { accessToken: string, refreshToken: string, expiresAt: number } } | { ok: false, status: number, error: string }>}
 */
async function refreshAccessToken(refreshToken, clientId) {
  let response;
  try {
    response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId || DEFAULT_CLIENT_ID,
      }).toString(),
      cache: "no-store",
    });
  } catch (err) {
    return { ok: false, status: 502, error: err instanceof Error ? err.message : "換新 access token 失敗" };
  }

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok || !data) {
    const message =
      data?.error_description ||
      data?.error ||
      (response.status === 429
        ? "換新 access token 被限流，稍後再試。"
        : "refresh token 無效或已過期，請重新登入 grok-cli 取得新憑證。");
    return { ok: false, status: response.status || 502, error: message };
  }

  const accessToken = data.access_token;
  const newRefreshToken = data.refresh_token || refreshToken;
  const expiresIn = Number(data.expires_in);
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

async function fetchUsage(accessToken) {
  const response = await fetch(USAGE_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "*/*",
      "Content-Type": "application/grpc-web+proto",
      "x-grpc-web": "1",
    },
    // GetGrokCreditsConfig 不吃任何參數，空 body 就會回目前帳號的額度
    body: Buffer.alloc(0),
    cache: "no-store",
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  return { ok: response.ok, status: response.status, buffer };
}

/**
 * 取一份 Grok 用量快照，需要時自動用 refresh token 換新的 access token。
 *
 * @param {{ accessToken: string, refreshToken?: string, expiresAt?: number, clientId?: string }} credential
 * @returns {Promise<
 *   | { ok: true, snapshot: { decoded: { usageRatio: number | null, resetsAtIso: string | null }, fetchedAt: string, source: string }, tokenExpiry: string | null, rotatedCredential: object | null }
 *   | { ok: false, status: number, error: string, tokenExpiry: string | null, rotatedCredential: object | null }
 * >}
 */
export async function loadGrokSnapshot(credential) {
  let current = credential;
  let rotated = null;
  const now = Date.now();

  if (isExpired(current, now)) {
    if (!current.refreshToken) {
      return {
        ok: false,
        status: 401,
        error: "access token 已過期，且沒有 refresh token 可以自動換新，請重新貼上 ~/.grok/auth.json。",
        tokenExpiry: current.expiresAt ? new Date(current.expiresAt).toISOString() : null,
        rotatedCredential: null,
      };
    }
    const refreshed = await refreshAccessToken(current.refreshToken, current.clientId);
    if (!refreshed.ok) {
      return { ok: false, status: refreshed.status, error: refreshed.error, tokenExpiry: null, rotatedCredential: null };
    }
    current = { ...refreshed.credential, clientId: current.clientId };
    rotated = current;
  }

  let usage = await fetchUsage(current.accessToken);

  // access token 沒過期紀錄、但其實已經失效：401 就補一次 refresh 重試
  if (!usage.ok && usage.status === 401 && current.refreshToken) {
    const refreshed = await refreshAccessToken(current.refreshToken, current.clientId);
    if (refreshed.ok) {
      current = { ...refreshed.credential, clientId: current.clientId };
      rotated = current;
      usage = await fetchUsage(current.accessToken);
    }
  }

  if (!usage.ok) {
    const message =
      usage.status === 429
        ? "查詢用量被限流，稍後再試。"
        : usage.status === 401
          ? "access token 無效，請重新登入 grok-cli 或重新貼上 auth.json。"
          : `無法取得 Grok 用量資料（HTTP ${usage.status}，非公開 API 可能已變動）。`;
    return {
      ok: false,
      status: usage.status || 502,
      error: message,
      tokenExpiry: current.expiresAt ? new Date(current.expiresAt).toISOString() : null,
      rotatedCredential: rotated,
    };
  }

  const decoded = decodeGrokCreditsResponse(usage.buffer);
  if (!decoded) {
    return {
      ok: false,
      status: 502,
      error: "無法解析 Grok 用量回應（非公開 API 格式可能已變動）。",
      tokenExpiry: current.expiresAt ? new Date(current.expiresAt).toISOString() : null,
      rotatedCredential: rotated,
    };
  }

  return {
    ok: true,
    snapshot: { decoded, fetchedAt: new Date().toISOString(), source: USAGE_ENDPOINT },
    tokenExpiry: current.expiresAt ? new Date(current.expiresAt).toISOString() : null,
    rotatedCredential: rotated,
  };
}
