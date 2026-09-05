import { NextResponse } from "next/server";
import { createAppwrite } from "../../../_lib/appwriteClient";
import { findManagementTable } from "../../../_lib/managementTables";
import {
  maskAccessToken,
  readStoredCredential,
  readTokenExpiry,
} from "../../../../../lib/chatgptSession";
import { QUOTA_PIN_NOT_SET_MESSAGE, verifyQuotaPin } from "../../../_lib/quotaPin";

export const dynamic = "force-dynamic";

/**
 * 取得單筆額度的 accessToken 明文，必須通過四位數密碼。
 * 用 POST 是為了讓 PIN 走 body，不落在 URL 或伺服器存取紀錄。
 */
export async function POST(request, routeContext) {
  try {
    const { id } = await routeContext.params;
    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);

    // 比照 Resend 通知密碼：沒設定過就要求先去設定，不用寫死的預設密碼放行
    const pinCheck = await verifyQuotaPin(databases, databaseId, body?.pin);
    if (!pinCheck.ok) {
      return pinCheck.reason === "not_set"
        ? NextResponse.json({ error: QUOTA_PIN_NOT_SET_MESSAGE, pinNotSet: true }, { status: 428 })
        : NextResponse.json({ error: "四位數密碼錯誤" }, { status: 403 });
    }

    const collection = await findManagementTable(databases, databaseId, "quota");
    if (!collection) {
      return NextResponse.json({ error: "Table quota 不存在，請至「鋒兄設定」建立。" }, { status: 404 });
    }

    const document = await databases.getDocument({
      databaseId,
      collectionId: collection.$id,
      documentId: id,
    });

    const credential = readStoredCredential(document.accessToken);
    if (!credential) {
      return NextResponse.json({ error: "此項目尚未設定 accessToken" }, { status: 404 });
    }

    return NextResponse.json({
      accessToken: credential.accessToken,
      maskedAccessToken: maskAccessToken(credential.accessToken),
      accountId: credential.accountId || null,
      tokenExpiry: readTokenExpiry(credential.accessToken) || null,
    });
  } catch (err) {
    console.error("POST /quota/[id]/access-token error:", err);
    const message = err instanceof Error ? err.message : "讀取 accessToken 失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
