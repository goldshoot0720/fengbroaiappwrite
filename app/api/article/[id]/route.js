import { NextResponse } from "next/server";
import { createAppwrite, getCollectionId } from "../../_lib/appwriteClient";


export const dynamic = 'force-dynamic';

// 更新文章
export async function PUT(req, context) {
  try {
    const { searchParams } = new URL(req.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const collectionId = await getCollectionId(databases, databaseId, "article");
    
    const { params } = context;
    const { id } = await params;
    const body = await req.json();

    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    const res = await databases.updateDocument(
      databaseId,
      collectionId,
      id,
      body
    );
    return NextResponse.json(res);
  } catch (err) {
    console.error("PUT /article/[id] error:", err);
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 刪除文章
export async function DELETE(req, context) {
  try {
    const { searchParams } = new URL(req.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const collectionId = await getCollectionId(databases, databaseId, "article");
    
    const { params } = context;
    const { id } = await params;

    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    await databases.deleteDocument(databaseId, collectionId, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /article/[id] error:", err);
    const message = err instanceof Error ? err.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
