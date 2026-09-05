import { NextResponse } from "next/server";
import { createAppwrite } from "../_lib/appwriteClient";
import { findManagementTable } from "../_lib/managementTables";
import { readStoredCredential, readTokenExpiry } from "../../../lib/chatgptSession";
import { normalizeCodexUsage, normalizeResetCredits } from "../../../lib/codexUsage";
import { QUOTA_PIN_NOT_SET_MESSAGE, verifyQuotaPin } from "../_lib/quotaPin";

export const dynamic = "force-dynamic";

/**
 * ChatGPT Codex 用量查詢（非公開 API，欄位可能變動）。
 * 官方對照頁：https://chatgpt.com/codex/cloud/settings/analytics#usage
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

/** 從 Appwrite 額度文件取出憑證（需通過四位數密碼）。 */
async function loadCredentialFromQuota(searchParams, quotaId) {
  const { databases, databaseId } = createAppwrite(searchParams);
  const collection = await findManagementTable(databases, databaseId, "quota");
  if (!collection) throw new Error("Table quota 不存在");
  const document = await databases.getDocument({
    databaseId,
    collectionId: collection.$id,
    documentId: quotaId,
  });
  return { credential: readStoredCredential(document.accessToken), document };
}

export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const body = await request.json();
    const { quotaId, pin } = body || {};

    let credential = null;
    let quotaName = "";

    if (quotaId) {
      // 比照 Resend 通知密碼：沒設定過就要求先去設定，不用寫死的預設密碼放行
      const { databases, databaseId } = createAppwrite(searchParams);
      const pinCheck = await verifyQuotaPin(databases, databaseId, pin);
      if (!pinCheck.ok) {
        return pinCheck.reason === "not_set"
          ? NextResponse.json({ error: QUOTA_PIN_NOT_SET_MESSAGE, pinNotSet: true }, { status: 428 })
          : NextResponse.json({ error: "四位數密碼錯誤" }, { status: 403 });
      }

      let loaded;
      try {
        loaded = await loadCredentialFromQuota(searchParams, quotaId);
      } catch (err) {
        console.error("POST /chatgpt-usage load error:", err);
        return NextResponse.json({ error: "找不到額度資料或 accessToken 欄位" }, { status: 404 });
      }

      credential = loaded.credential;
      quotaName = loaded.document?.name || "";
    } else if (typeof body?.accessToken === "string" && body.accessToken.trim()) {
      credential = readStoredCredential(body.accessToken);
    }

    if (!credential) {
      return NextResponse.json(
        { error: "沒有可用的 accessToken，請先在額度項目填入。" },
        { status: 400 }
      );
    }

    const tokenExpiry = readTokenExpiry(credential.accessToken);
    if (tokenExpiry && new Date(tokenExpiry).getTime() < Date.now()) {
      return NextResponse.json(
        {
          error: "accessToken 已過期，請重新從 chatgpt.com/api/auth/session 取得。",
          tokenExpiry,
        },
        { status: 401 }
      );
    }

    const usage = await fetchUsage(credential);
    if (!usage.data) {
      const unauthorized = usage.attempts.some(
        (attempt) => attempt.status === 401 || attempt.status === 403
      );
      return NextResponse.json(
        {
          error: unauthorized
            ? "accessToken 無效或權限不足，請重新取得 session.json。"
            : "無法取得 Codex 用量資料（非公開 API 可能已變動）。",
          attempts: usage.attempts,
          tokenExpiry,
        },
        { status: unauthorized ? 401 : 502 }
      );
    }

    const snapshot = normalizeCodexUsage(usage.data, usage.url);
    snapshot.resetCredits = await fetchResetCredits(credential);

    return NextResponse.json({
      ...snapshot,
      quotaId: quotaId || null,
      quotaName,
      tokenExpiry: tokenExpiry || null,
    });
  } catch (err) {
    console.error("POST /chatgpt-usage error:", err);
    const message = err instanceof Error ? err.message : "查詢用量失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
