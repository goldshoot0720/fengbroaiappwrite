import { NextResponse } from "next/server";

const sdk = require('node-appwrite');

export const dynamic = 'force-dynamic';

const COLLECTION_NAME = 'pushSubscriptions';

function createAppwrite() {
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
  const apiKey = process.env.NEXT_PUBLIC_APPWRITE_API_KEY;

  if (!endpoint || !projectId || !databaseId || !apiKey) {
    throw new Error("Appwrite configuration is missing");
  }

  const client = new sdk.Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

  return { databases: new sdk.Databases(client), databaseId };
}

async function getOrCreateCollection(databases, databaseId) {
  const allCollections = await databases.listCollections(databaseId);
  const col = allCollections.collections.find(c => c.name === COLLECTION_NAME);
  if (col) return col.$id;

  // 建立集合
  const newCol = await databases.createCollection(
    databaseId,
    sdk.ID.unique(),
    COLLECTION_NAME
  );

  // 建立屬性
  await databases.createStringAttribute(databaseId, newCol.$id, 'endpoint', 2048, true);
  await databases.createStringAttribute(databaseId, newCol.$id, 'p256dh', 512, true);
  await databases.createStringAttribute(databaseId, newCol.$id, 'auth', 128, true);

  // 等待屬性就緒（Appwrite 非同步處理）
  for (let i = 0; i < 10; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    try {
      const attrs = await databases.listAttributes(databaseId, newCol.$id);
      const ready = attrs.attributes.filter(a => a.status === 'available');
      if (ready.length >= 3) break;
    } catch (_) {}
  }

  return newCol.$id;
}

// POST /api/push-subscribe — 新增訂閱
export async function POST(request) {
  try {
    const body = await request.json();
    const { endpoint, keys } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: "Invalid subscription data" }, { status: 400 });
    }

    const { databases, databaseId } = createAppwrite();
    const collectionId = await getOrCreateCollection(databases, databaseId);

    // 以 endpoint 去重
    const existing = await databases.listDocuments(databaseId, collectionId, [
      sdk.Query.equal('endpoint', endpoint),
      sdk.Query.limit(1),
    ]);

    if (existing.documents.length > 0) {
      await databases.updateDocument(databaseId, collectionId, existing.documents[0].$id, {
        p256dh: keys.p256dh,
        auth: keys.auth,
      });
      return NextResponse.json({ success: true, action: 'updated' });
    }

    await databases.createDocument(databaseId, collectionId, sdk.ID.unique(), {
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    });

    return NextResponse.json({ success: true, action: 'created' });
  } catch (err) {
    console.error("POST /api/push-subscribe error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/push-subscribe — 取消訂閱
export async function DELETE(request) {
  try {
    const body = await request.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint is required" }, { status: 400 });
    }

    const { databases, databaseId } = createAppwrite();

    const allCollections = await databases.listCollections(databaseId);
    const col = allCollections.collections.find(c => c.name === COLLECTION_NAME);
    if (!col) {
      return NextResponse.json({ success: true, action: 'not_found' });
    }

    const existing = await databases.listDocuments(databaseId, col.$id, [
      sdk.Query.equal('endpoint', endpoint),
      sdk.Query.limit(1),
    ]);

    if (existing.documents.length > 0) {
      await databases.deleteDocument(databaseId, col.$id, existing.documents[0].$id);
    }

    return NextResponse.json({ success: true, action: 'deleted' });
  } catch (err) {
    console.error("DELETE /api/push-subscribe error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
