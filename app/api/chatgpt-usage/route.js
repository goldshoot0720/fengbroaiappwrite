import { NextResponse } from "next/server";
import { createAppwrite } from "../_lib/appwriteClient";
import { findManagementTable } from "../_lib/managementTables";
import { loadCodexSnapshot } from "../_lib/codexClient";
import { readStoredCredential } from "../../../lib/chatgptSession";
import { ACCESS_PIN_NOT_SET_MESSAGE, verifyAccessPin } from "../_lib/accessPin";

export const dynamic = "force-dynamic";

/**
 * 手動查詢 ChatGPT Codex 用量，把結果帶進額度表單。
 * 背景自動更新走 /api/quota-refresh（不回傳明文，所以不需要密碼）。
 */

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
      const pinCheck = await verifyAccessPin(databases, databaseId, pin);
      if (!pinCheck.ok) {
        return pinCheck.reason === "not_set"
          ? NextResponse.json({ error: ACCESS_PIN_NOT_SET_MESSAGE, pinNotSet: true }, { status: 428 })
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

    const outcome = await loadCodexSnapshot(credential);
    if (!outcome.ok) {
      return NextResponse.json(
        { error: outcome.error, attempts: outcome.attempts, tokenExpiry: outcome.tokenExpiry },
        { status: outcome.status }
      );
    }

    return NextResponse.json({
      ...outcome.snapshot,
      quotaId: quotaId || null,
      quotaName,
      tokenExpiry: outcome.tokenExpiry,
    });
  } catch (err) {
    console.error("POST /chatgpt-usage error:", err);
    const message = err instanceof Error ? err.message : "查詢用量失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
