import { NextResponse } from "next/server";
import { createAppwrite } from "../_lib/appwriteClient";
import { findManagementTable } from "../_lib/managementTables";
import { loadCommandCodeSnapshot } from "../_lib/commandCodeClient";
import { readStoredCommandCodeCredential } from "../../../lib/commandCodeSession";
import { ACCESS_PIN_NOT_SET_MESSAGE, verifyAccessPin } from "../_lib/accessPin";

export const dynamic = "force-dynamic";

/** 對不是 Command Code auth.json 的輸入回固定訊息，供前端安全地接著嘗試其他憑證。 */
export const COMMAND_CODE_CREDENTIAL_MISMATCH_ERROR =
  "沒有可用的 Command Code API key，請貼上 API key 或 ~/.commandcode/auth.json。";

async function loadCredentialFromQuota(searchParams, quotaId) {
  const { databases, databaseId } = createAppwrite(searchParams);
  const collection = await findManagementTable(databases, databaseId, "quota");
  if (!collection) throw new Error("Table quota 不存在");
  const document = await databases.getDocument({
    databaseId,
    collectionId: collection.$id,
    documentId: quotaId,
  });
  return { credential: readStoredCommandCodeCredential(document.accessToken), document };
}

/**
 * 手動查詢 Command Code 用量，把 5 小時、每週、每月三個 meters 帶入表單。
 * 已存憑證必須先通過四位數密碼；回應絕不含 API key。
 */
export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const body = await request.json();
    const { quotaId, pin } = body || {};

    let credential = null;
    let quotaName = "";

    if (quotaId) {
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
        console.error("POST /command-code-usage load error:", err);
        return NextResponse.json({ error: "找不到額度資料或 accessToken 欄位" }, { status: 404 });
      }
      credential = loaded.credential;
      quotaName = loaded.document?.name || "";
    } else if (typeof body?.accessToken === "string" && body.accessToken.trim()) {
      credential = readStoredCommandCodeCredential(body.accessToken);
    }

    if (!credential) {
      return NextResponse.json({ error: COMMAND_CODE_CREDENTIAL_MISMATCH_ERROR }, { status: 400 });
    }

    const outcome = await loadCommandCodeSnapshot(credential);
    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    }

    return NextResponse.json({
      ...outcome.snapshot,
      quotaId: quotaId || null,
      quotaName,
    });
  } catch (err) {
    console.error("POST /command-code-usage error:", err);
    const message = err instanceof Error ? err.message : "查詢用量失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
