import { NextResponse } from "next/server";
import { listAllDocuments } from "../_lib/listAllDocuments";
import { createAppwrite, getCollectionId, getCollection, filterPayloadByAttributes } from "../_lib/appwriteClient";
import { buildSubscriptionWritePayload } from "../../../lib/subscriptionFields";

const sdk = require('node-appwrite');

export const dynamic = 'force-dynamic';

// 取得全部訂閱，依 nextdate 排序
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);

    // 嘗試取得 collection ID
    let collectionId;
    try {
      collectionId = await getCollectionId(databases, databaseId, "subscription");
    } catch (collectionErr) {
      const errMsg = collectionErr.message || '';
      if (errMsg.includes('Bandwidth') || errMsg.includes('bandwidth') || errMsg.includes('exceeded')) {
        return NextResponse.json({ error: errMsg }, { status: 500 });
      }
      console.error("Collection not found:", collectionErr.message);
      return NextResponse.json(
        { error: "Table subscription 不存在，請至「鋒兄設定」中初始化。" },
        { status: 404 }
      );
    }

    const documents = await listAllDocuments(databases, databaseId, collectionId, sdk, [
      sdk.Query.orderAsc('nextdate')
    ]);
    return NextResponse.json(documents);
  } catch (err) {
    console.error("GET /subscription error:", err);
    const message = err instanceof Error ? err.message : "Fetch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 新增訂閱
export async function POST(req) {
  try {
    const { searchParams } = new URL(req.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const collection = await getCollection(databases, databaseId, "subscription");
    const collectionId = collection.$id;

    const body = await req.json();
    let payload;
    try {
      payload = buildSubscriptionWritePayload(body, "create");
    } catch (payloadError) {
      return NextResponse.json(
        { error: payloadError instanceof Error ? payloadError.message : "Missing required fields" },
        { status: 400 }
      );
    }

    const filteredPayload = filterPayloadByAttributes(payload, collection);

    const res = await databases.createDocument(
      databaseId,
      collectionId,
      sdk.ID.unique(),
      filteredPayload
    );

    return NextResponse.json(res);
  } catch (err) {
    console.error("POST /subscription error:", err);
    const message = err instanceof Error ? err.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
