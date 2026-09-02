import { NextResponse } from "next/server";
import { createAppwrite, getCollectionId } from "../_lib/appwriteClient";

const sdk = require("node-appwrite");

export const dynamic = "force-dynamic";

// 鋒兄關於：選單使用次數與頻率。每個 moduleId 一筆文件，count 累加、lastUsedAt 記錄最近一次使用。
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);

    const collectionId = await getCollectionId(databases, databaseId, "menuusage", { required: false });
    if (!collectionId) {
      return NextResponse.json({ items: [], exists: false });
    }

    const docs = await databases.listDocuments(databaseId, collectionId, [
      sdk.Query.orderDesc("count"),
      sdk.Query.limit(100),
    ]);

    return NextResponse.json({
      items: docs.documents.map((doc) => ({
        moduleId: doc.moduleId,
        count: doc.count || 0,
        lastUsedAt: doc.lastUsedAt || null,
      })),
      exists: true,
    });
  } catch (err) {
    console.error("GET /menu-usage error:", err);
    return NextResponse.json({ items: [], exists: false, error: err.message });
  }
}

// 記錄一次選單點擊（由前端在切換模組時呼叫，fire-and-forget）
export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const body = await request.json();
    const moduleId = String(body?.moduleId || "").trim();

    if (!moduleId) {
      return NextResponse.json({ success: false, error: "缺少 moduleId" }, { status: 400 });
    }

    const collectionId = await getCollectionId(databases, databaseId, "menuusage", { required: false });
    if (!collectionId) {
      return NextResponse.json(
        { success: false, error: "Table menuusage 不存在，請至「鋒兄設定」中初始化。" },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();
    const docs = await databases.listDocuments(databaseId, collectionId, [
      sdk.Query.equal("moduleId", moduleId),
      sdk.Query.limit(1),
    ]);
    const existing = docs.documents[0];

    if (existing) {
      const updated = await databases.updateDocument(databaseId, collectionId, existing.$id, {
        count: (existing.count || 0) + 1,
        lastUsedAt: now,
      });
      return NextResponse.json({ success: true, count: updated.count });
    }

    const created = await databases.createDocument(databaseId, collectionId, sdk.ID.unique(), {
      moduleId,
      count: 1,
      lastUsedAt: now,
    });
    return NextResponse.json({ success: true, count: created.count });
  } catch (err) {
    console.error("POST /menu-usage error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
