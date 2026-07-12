import { NextResponse } from "next/server";
import { createAppwrite, getCollectionId } from "../../_lib/appwriteClient";


export const dynamic = 'force-dynamic';

export async function PUT(req, context) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const { searchParams } = new URL(req.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const collectionId = await getCollectionId(databases, databaseId, 'commonaccount');

    const res = await databases.updateDocument(
      databaseId,
      collectionId,
      id,
      body
    );
    return NextResponse.json(res);
  } catch (err) {
    console.error("PUT /api/common-account/[id] error:", err);
    return NextResponse.json(
      { error: err.message }, 
      { status: err.code || 500 }
    );
  }
}

export async function DELETE(req, context) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const collectionId = await getCollectionId(databases, databaseId, 'commonaccount');

    await databases.deleteDocument(databaseId, collectionId, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/common-account/[id] error:", err);
    return NextResponse.json(
      { error: err.message }, 
      { status: err.code || 500 }
    );
  }
}
