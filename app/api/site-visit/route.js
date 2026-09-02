import { NextResponse } from "next/server";
import { createAppwrite, getCollectionId } from "../_lib/appwriteClient";

const sdk = require("node-appwrite");

export const dynamic = "force-dynamic";

// 鋒兄關於：網站到站次數。單一計數文件（第一筆文件即為計數器），沒有表格時安全回退成 0。
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);

    const collectionId = await getCollectionId(databases, databaseId, "sitevisit", { required: false });
    if (!collectionId) {
      return NextResponse.json({ count: 0, lastVisitAt: null, exists: false });
    }

    const docs = await databases.listDocuments(databaseId, collectionId, [sdk.Query.limit(1)]);
    const doc = docs.documents[0];

    return NextResponse.json({
      count: doc?.count || 0,
      lastVisitAt: doc?.lastVisitAt || null,
      exists: true,
    });
  } catch (err) {
    console.error("GET /site-visit error:", err);
    return NextResponse.json({ count: 0, lastVisitAt: null, exists: false, error: err.message });
  }
}

// 新增一次到站紀錄（由前端每個瀏覽器 session 呼叫一次）
export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);

    const collectionId = await getCollectionId(databases, databaseId, "sitevisit", { required: false });
    if (!collectionId) {
      return NextResponse.json(
        { success: false, error: "Table sitevisit 不存在，請至「鋒兄設定」中初始化。" },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();
    const docs = await databases.listDocuments(databaseId, collectionId, [sdk.Query.limit(1)]);
    const existing = docs.documents[0];

    if (existing) {
      const updated = await databases.updateDocument(databaseId, collectionId, existing.$id, {
        count: (existing.count || 0) + 1,
        lastVisitAt: now,
      });
      return NextResponse.json({ success: true, count: updated.count, lastVisitAt: updated.lastVisitAt });
    }

    const created = await databases.createDocument(databaseId, collectionId, sdk.ID.unique(), {
      count: 1,
      lastVisitAt: now,
    });
    return NextResponse.json({ success: true, count: created.count, lastVisitAt: created.lastVisitAt });
  } catch (err) {
    console.error("POST /site-visit error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
