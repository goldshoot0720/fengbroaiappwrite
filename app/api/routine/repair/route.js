import { NextResponse } from "next/server";

const sdk = require('node-appwrite');

export const dynamic = 'force-dynamic';

// GET /api/routine/repair - 刪除並重建 routine collection，然後測試
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('_endpoint') || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId = searchParams.get('_project') || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const databaseId = searchParams.get('_database') || process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
  const apiKey = searchParams.get('_key') || process.env.NEXT_PUBLIC_APPWRITE_API_KEY;

  if (!endpoint || !projectId || !databaseId || !apiKey) {
    return NextResponse.json({ error: "Missing config" }, { status: 400 });
  }

  const client = new sdk.Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const databases = new sdk.Databases(client);
  const log = [];

  try {
    // Step 1: 找到並刪除所有 routine collection
    const allCollections = await databases.listCollections(databaseId);
    const routineCollections = allCollections.collections.filter(c => c.name === 'routine');
    log.push(`Found ${routineCollections.length} routine collection(s)`);

    for (const col of routineCollections) {
      await databases.deleteCollection(databaseId, col.$id);
      log.push(`Deleted collection ${col.$id}`);
    }

    // Step 2: 等 3 秒
    await new Promise(r => setTimeout(r, 3000));
    log.push('Waited 3s after deletion');

    // Step 3: 建新 collection
    const collection = await databases.createCollection(
      databaseId, sdk.ID.unique(), 'routine',
      [
        sdk.Permission.read(sdk.Role.any()),
        sdk.Permission.create(sdk.Role.any()),
        sdk.Permission.update(sdk.Role.any()),
        sdk.Permission.delete(sdk.Role.any()),
      ]
    );
    log.push(`Created collection ${collection.$id}`);

    // Step 4: 逐一建 attributes，每個間隔 2 秒
    const attrs = [
      { key: 'name', fn: () => databases.createStringAttribute(databaseId, collection.$id, 'name', 100, true) },
      { key: 'note', fn: () => databases.createStringAttribute(databaseId, collection.$id, 'note', 100, false) },
      { key: 'lastdate1', fn: () => databases.createDatetimeAttribute(databaseId, collection.$id, 'lastdate1', false) },
      { key: 'lastdate2', fn: () => databases.createDatetimeAttribute(databaseId, collection.$id, 'lastdate2', false) },
      { key: 'lastdate3', fn: () => databases.createDatetimeAttribute(databaseId, collection.$id, 'lastdate3', false) },
      { key: 'link', fn: () => databases.createUrlAttribute(databaseId, collection.$id, 'link', false) },
      { key: 'photo', fn: () => databases.createUrlAttribute(databaseId, collection.$id, 'photo', false) },
    ];

    for (const attr of attrs) {
      try {
        await attr.fn();
        log.push(`Created attribute: ${attr.key}`);
      } catch (e) {
        log.push(`Failed attribute ${attr.key}: ${e.message}`);
      }
      await new Promise(r => setTimeout(r, 2000));
    }

    // Step 5: 等 10 秒讓 Appwrite validator cache 更新
    log.push('Waiting 10s for Appwrite validator cache...');
    await new Promise(r => setTimeout(r, 10000));

    // Step 6: 驗證 attributes
    const verifyCol = await databases.getCollection(databaseId, collection.$id);
    const availableAttrs = verifyCol.attributes?.filter(a => a.status === 'available') || [];
    log.push(`Verification: ${availableAttrs.length}/7 attributes available`);
    for (const a of verifyCol.attributes || []) {
      log.push(`  ${a.key}: ${a.status} (${a.type})`);
    }

    // Step 7: 測試建文件
    try {
      const testDoc = await databases.createDocument(
        databaseId, collection.$id, sdk.ID.unique(),
        { name: '__repair_test__' }
      );
      log.push(`Test document created: ${testDoc.$id}`);
      // 刪除測試文件
      await databases.deleteDocument(databaseId, collection.$id, testDoc.$id);
      log.push('Test document deleted. REPAIR SUCCESS!');
    } catch (testErr) {
      log.push(`Test document FAILED: ${testErr.message} (type: ${testErr.type})`);
    }

    return NextResponse.json({ success: true, log });
  } catch (err) {
    log.push(`ERROR: ${err.message}`);
    return NextResponse.json({ success: false, log, error: err.message }, { status: 500 });
  }
}
