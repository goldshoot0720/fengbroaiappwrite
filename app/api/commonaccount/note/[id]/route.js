import { NextResponse } from "next/server";
import { createAppwrite, getCollectionId } from "../../../_lib/appwriteClient";


export const dynamic = 'force-dynamic';

// 更新 Note
export async function PUT(req, context) {
  try {
    const { params } = context;
    const { id } = await params;
    const body = await req.json();

    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const collectionId = await getCollectionId(databases, databaseId, 'commonaccountnote');

    const res = await databases.updateDocument(
      databaseId,
      collectionId,
      id,
      body
    );
    return NextResponse.json(res);
  } catch (err) {
    console.error("PUT /api/common-account/note/[id] error:", err);
    return NextResponse.json(
      { error: err.message }, 
      { status: err.code || 500 }
    );
  }
}

// 刪除 Note
export async function DELETE(req, context) {
  try {
    const { params } = context;
    const { id } = await params;

    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const collectionId = await getCollectionId(databases, databaseId, 'commonaccountnote');

    await databases.deleteDocument(databaseId, collectionId, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/common-account/note/[id] error:", err);
    return NextResponse.json(
      { error: err.message }, 
      { status: err.code || 500 }
    );
  }
}
