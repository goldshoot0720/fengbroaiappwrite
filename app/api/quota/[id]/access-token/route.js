import { NextResponse } from "next/server";
import { createAppwrite } from "../../../_lib/appwriteClient";
import { findManagementTable } from "../../../_lib/managementTables";
import {
  maskAccessToken,
  readStoredCredential,
  readTokenExpiry,
} from "../../../../../lib/chatgptSession";
import { verifyTokenPin } from "../../../../../lib/tokenPin";

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
    if (!verifyTokenPin(body?.pin)) {
      return NextResponse.json({ error: "四位數密碼錯誤" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);
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
