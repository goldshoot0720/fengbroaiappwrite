import { NextResponse } from "next/server";
import { createAppwrite, getCollectionId, getCollection, filterPayloadByAttributes } from "../../_lib/appwriteClient";
import { buildSubscriptionWritePayload } from "../../../../lib/subscriptionFields";


export const dynamic = 'force-dynamic';

// 更新訂閱
export async function PUT(req, context) {
  try {
    const { searchParams } = new URL(req.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const collection = await getCollection(databases, databaseId, "subscription");
    const collectionId = collection.$id;
    
    const { params } = context;
    const { id } = await params;
    const body = await req.json();

    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    let bodyData;
    try {
      bodyData = buildSubscriptionWritePayload(body, "update");
    } catch (payloadError) {
      return NextResponse.json(
        { error: payloadError instanceof Error ? payloadError.message : "Missing required fields" },
        { status: 400 }
      );
    }

    const filteredBodyData = filterPayloadByAttributes(bodyData, collection);

    const res = await databases.updateDocument(
      databaseId,
      collectionId,
      id,
      filteredBodyData
    );
    return NextResponse.json(res);
  } catch (err) {
    console.error("PUT /subscription/[id] error:", err);
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 刪除訂閱
export async function DELETE(req, context) {
  try {
    const { searchParams } = new URL(req.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const collectionId = await getCollectionId(databases, databaseId, "subscription");
    
    const { params } = context;
    const { id } = await params;

    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    await databases.deleteDocument(databaseId, collectionId, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /subscription/[id] error:", err);
    const message = err instanceof Error ? err.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
