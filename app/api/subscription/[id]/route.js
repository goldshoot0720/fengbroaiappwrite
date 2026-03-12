import { NextResponse } from "next/server";

const sdk = require('node-appwrite');

export const dynamic = 'force-dynamic';

async function getCollection(databases, databaseId, name) {
  const allCollections = await databases.listCollections(databaseId);
  const col = allCollections.collections.find(c => c.name === name);
  if (!col) throw new Error(`Collection ${name} not found`);
  return col;
}

function filterPayloadByAttributes(payload, collection) {
  const availableKeys = new Set(
    (collection.attributes || [])
      .filter((attr) => (attr.status === 'available' || !attr.status) && !String(attr.key || '').startsWith('$'))
      .map((attr) => attr.key)
  );

  return Object.fromEntries(
    Object.entries(payload).filter(([key]) => key === 'name' || key === 'price' || availableKeys.has(key))
  );
}

function createAppwrite(searchParams) {
  // 從 URL 參數讀取配置（優先），否則使用 .env
  const endpoint = searchParams?.get('_endpoint') || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId = searchParams?.get('_project') || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const databaseId = searchParams?.get('_database') || process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
  const apiKey = searchParams?.get('_key') || process.env.NEXT_PUBLIC_APPWRITE_API_KEY;

  if (!endpoint || !projectId || !databaseId || !apiKey) {
    throw new Error("Appwrite configuration is missing");
  }

  const client = new sdk.Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

  const databases = new sdk.Databases(client);

  return { databases, databaseId };
}

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
    const { name, site, price, nextdate, note, account, currency, category, purpose, usageFrequency, friendliness, alternative, retentionRecommendation } = body;
    const continueValue = body.continue;
    const archived = body.archived;
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
    if (category !== undefined) bodyData.category = category || "";
    if (purpose !== undefined) bodyData.purpose = purpose || "";
    if (usageFrequency !== undefined) bodyData.usageFrequency = usageFrequency || "";
    if (friendliness !== undefined) bodyData.friendliness = friendliness || "";
    if (alternative !== undefined) bodyData.alternative = alternative || "";
    if (retentionRecommendation !== undefined) bodyData.retentionRecommendation = retentionRecommendation || "";
    if (archived !== undefined) bodyData.archived = !!archived;
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
