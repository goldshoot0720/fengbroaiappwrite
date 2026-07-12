import { NextResponse } from "next/server";
import { createAppwrite, getCollectionId, getCollection, filterPayloadByAttributes } from "../../_lib/appwriteClient";


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

    // 確保 price 是數字
    const { name, site, price, nextdate, note, account, currency } = body;
    const continueValue = body.continue;
    const bodyData = {
      name,
      price: price !== undefined && price !== null ? Number(price) : 0,
    };

    // 只有在提供值時才添加可選欄位
    if (nextdate !== undefined) bodyData.nextdate = nextdate || null;
    if (site !== undefined) bodyData.site = site || null;
    if (note !== undefined) bodyData.note = note || "";
    if (account !== undefined) bodyData.account = account || "";
    if (currency !== undefined) bodyData.currency = currency || "TWD";
    if (continueValue !== undefined) bodyData.continue = continueValue;

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
