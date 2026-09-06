import { NextResponse } from "next/server";
import { createAppwrite } from "../_lib/appwriteClient";
import { findManagementTable } from "../_lib/managementTables";
import { loadGrokSnapshot } from "../_lib/grokClient";
import { readStoredGrokCredential, serializeGrokCredential } from "../../../lib/grokSession";
import { ACCESS_PIN_NOT_SET_MESSAGE, verifyAccessPin } from "../_lib/accessPin";

export const dynamic = "force-dynamic";

/**
 * 手動查詢 Grok（xAI grok-cli／SuperGrok OAuth）用量，把結果帶進額度表單。
 * 背景自動更新走 /api/quota-refresh（不回傳明文，所以不需要密碼），做法照抄 /api/claude-usage。
 */

/** 對「不是 Grok 格式」的 accessToken 一律回這句，前端靠這句判斷要不要接著試別種憑證。 */
export const GROK_CREDENTIAL_MISMATCH_ERROR = "沒有可用的 Grok 憑證，請先貼上 ~/.grok/auth.json 或憑證 JSON。";

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
  return { credential: readStoredGrokCredential(document.accessToken), document };
}

export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const body = await request.json();
    const { quotaId, pin } = body || {};

    let credential = null;
    let quotaName = "";
    let quotaIdForWriteback = null;

    if (quotaId) {
      // 比照 ChatGPT／Claude：沒設定過密碼就要求先去設定，不用寫死的預設密碼放行
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
        console.error("POST /grok-usage load error:", err);
        return NextResponse.json({ error: "找不到額度資料或 accessToken 欄位" }, { status: 404 });
      }

      credential = loaded.credential;
      quotaName = loaded.document?.name || "";
      quotaIdForWriteback = quotaId;
    } else if (typeof body?.accessToken === "string" && body.accessToken.trim()) {
      credential = readStoredGrokCredential(body.accessToken);
    }

    if (!credential) {
      return NextResponse.json({ error: GROK_CREDENTIAL_MISMATCH_ERROR }, { status: 400 });
    }

    const outcome = await loadGrokSnapshot(credential);

    // 手動查詢也順便把換到的新 access token 寫回去，不然它就白換了、下次還是拿舊的重試
    if (outcome.rotatedCredential && quotaIdForWriteback) {
      try {
        const { databases, databaseId } = createAppwrite(searchParams);
        const collection = await findManagementTable(databases, databaseId, "quota");
        if (collection) {
          await databases.updateDocument({
            databaseId,
            collectionId: collection.$id,
            documentId: quotaIdForWriteback,
            data: {
              accessToken: serializeGrokCredential({ ...outcome.rotatedCredential, clientId: credential.clientId }),
            },
          });
        }
      } catch (err) {
        console.error("POST /grok-usage writeback error:", err);
      }
    }

    if (!outcome.ok) {
      return NextResponse.json(
        { error: outcome.error, tokenExpiry: outcome.tokenExpiry },
        { status: outcome.status }
      );
    }

    return NextResponse.json({
      decoded: outcome.snapshot.decoded,
      fetchedAt: outcome.snapshot.fetchedAt,
      source: outcome.snapshot.source,
      quotaId: quotaId || null,
      quotaName,
      tokenExpiry: outcome.tokenExpiry,
    });
  } catch (err) {
    console.error("POST /grok-usage error:", err);
    const message = err instanceof Error ? err.message : "查詢用量失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
