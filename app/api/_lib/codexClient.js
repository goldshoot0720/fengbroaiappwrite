import { readTokenExpiry } from "../../../lib/chatgptSession";
import { normalizeCodexUsage, normalizeResetCredits } from "../../../lib/codexUsage";

/**
 * ChatGPT Codex 用量查詢（非公開 API，欄位可能變動）。
 * 官方對照頁：https://chatgpt.com/codex/cloud/settings/analytics#usage
 *
 * 手動查詢（/api/chatgpt-usage）與自動更新（/api/quota-refresh）共用這裡，
 * 兩邊對端點順序、逾期判斷與錯誤訊息才不會各說各話。
 */
const USAGE_ENDPOINTS = [
  "https://chatgpt.com/backend-api/wham/usage",
  "https://chatgpt.com/backend-api/codex/usage",
];
const RESET_CREDITS_ENDPOINT = "https://chatgpt.com/backend-api/wham/rate-limit-reset-credits";

function buildHeaders(credential) {
  const headers = {
    Authorization: `Bearer ${credential.accessToken}`,
    Accept: "application/json",
    "User-Agent": "fengbro-ai-appwrite/1.0",
  };
  if (credential.accountId) headers["ChatGPT-Account-Id"] = credential.accountId;
  return headers;
}

async function fetchJson(url, headers) {
  const response = await fetch(url, { headers, cache: "no-store" });
  const text = await response.text();

  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  return { ok: response.ok, status: response.status, data, text };
}

/** 依序嘗試候選端點，回傳第一個成功的結果。 */
async function fetchUsage(credential) {
  const headers = buildHeaders(credential);
  const attempts = [];

  for (const url of USAGE_ENDPOINTS) {
    let result;
    try {
      result = await fetchJson(url, headers);
    } catch (err) {
      attempts.push({ url, error: err instanceof Error ? err.message : "fetch failed" });
      continue;
    }

    if (result.ok && result.data) {
      return { url, data: result.data, attempts };
    }

    attempts.push({
      url,
      status: result.status,
      error: result.text ? result.text.slice(0, 200) : "empty response",
    });

    // 401/403 換端點也不會過，直接停手
    if (result.status === 401 || result.status === 403) break;
  }

  return { url: null, data: null, attempts };
}

async function fetchResetCredits(credential) {
  try {
    const result = await fetchJson(RESET_CREDITS_ENDPOINT, buildHeaders(credential));
    return result.ok ? normalizeResetCredits(result.data) : null;
  } catch {
    return null;
  }
}

/**
 * 取一份 Codex 用量快照。
 *
 * @param {{ accessToken: string, accountId?: string }} credential
 * @returns {Promise<
 *   | { ok: true, snapshot: any, tokenExpiry: string | null }
 *   | { ok: false, status: number, error: string, tokenExpiry: string | null, attempts?: any[] }
 * >}
 */
export async function loadCodexSnapshot(credential) {
  const tokenExpiry = readTokenExpiry(credential.accessToken) || null;
  if (tokenExpiry && new Date(tokenExpiry).getTime() < Date.now()) {
    return {
      ok: false,
      status: 401,
      error: "accessToken 已過期，請重新從 chatgpt.com/api/auth/session 取得。",
      tokenExpiry,
    };
  }

  const usage = await fetchUsage(credential);
  if (!usage.data) {
    const unauthorized = usage.attempts.some(
      (attempt) => attempt.status === 401 || attempt.status === 403
    );
    return {
      ok: false,
      status: unauthorized ? 401 : 502,
      error: unauthorized
        ? "accessToken 無效或權限不足，請重新取得 session.json。"
        : "無法取得 Codex 用量資料（非公開 API 可能已變動）。",
      tokenExpiry,
      attempts: usage.attempts,
    };
  }

  const snapshot = normalizeCodexUsage(usage.data, usage.url);
  snapshot.resetCredits = await fetchResetCredits(credential);
  return { ok: true, snapshot, tokenExpiry };
}
