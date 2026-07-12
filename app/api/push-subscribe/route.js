import { NextResponse } from "next/server";
import {
  clearCollectionCache,
  createAppwrite,
  getCollection,
  sdk,
} from "../_lib/appwriteClient";

export const dynamic = 'force-dynamic';

const COLLECTION_NAME = 'pushSubscriptions';
const REQUIRED_ATTRIBUTES = [
  { key: 'endpoint', size: 2048 },
  { key: 'p256dh', size: 512 },
  { key: 'auth', size: 128 },
];

async function getOrCreateCollection(databases, databaseId) {
  const col = await getCollection(databases, databaseId, COLLECTION_NAME, { required: false });
  if (col) {
    await ensureAttributes(databases, databaseId, col.$id);
    return col.$id;
  }

  // 建立集合
  const newCol = await databases.createCollection(
    databaseId,
    sdk.ID.unique(),
    COLLECTION_NAME
  );
  clearCollectionCache(databaseId);

  // 建立屬性
  await databases.createStringAttribute(databaseId, newCol.$id, 'endpoint', 2048, true);
  await ensureAttributes(databases, databaseId, newCol.$id);

  // 等待屬性就緒（Appwrite 非同步處理）
  return newCol.$id;
}

async function ensureAttributes(databases, databaseId, collectionId) {
  const attrs = await databases.listAttributes(databaseId, collectionId);
  const existing = new Set(attrs.attributes.map((attr) => attr.key));

  for (const attr of REQUIRED_ATTRIBUTES) {
    if (existing.has(attr.key)) continue;
    try {
      await databases.createStringAttribute(databaseId, collectionId, attr.key, attr.size, true);
    } catch (err) {
      if (err?.code !== 409) throw err;
    }
  }

  for (let i = 0; i < 15; i++) {
    const latest = await databases.listAttributes(databaseId, collectionId);
    const readyKeys = new Set(
      latest.attributes
        .filter((attr) => attr.status === 'available' || !attr.status)
        .map((attr) => attr.key)
    );
    if (REQUIRED_ATTRIBUTES.every((attr) => readyKeys.has(attr.key))) return;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error("Push subscription attributes are not ready yet. Please try again in a moment.");
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

    const col = await getCollection(databases, databaseId, COLLECTION_NAME, { required: false });
    if (!col) {
      return NextResponse.json({ success: true, action: 'not_found' });
    }
    await ensureAttributes(databases, databaseId, col.$id);

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
