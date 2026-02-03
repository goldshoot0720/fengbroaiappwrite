import { NextResponse } from "next/server";

const sdk = require('node-appwrite');

export const dynamic = 'force-dynamic';

async function getCollectionId(databases, databaseId, name) {
  const allCollections = await databases.listCollections(databaseId);
  const col = allCollections.collections.find(c => c.name === name);
  if (!col) throw new Error(`Collection ${name} not found`);
  return col.$id;
}

function createAppwrite(searchParams) {
  // 從 URL 參數讀取配置（優先），否則使用 .env（支援新舊兩種變數名）
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

// 取得全部銀行資料
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    
    // 嘗試取得 collection ID
    let collectionId;
    try {
      collectionId = await getCollectionId(databases, databaseId, "bank");
    } catch (collectionErr) {
      const errMsg = collectionErr.message || '';
      if (errMsg.includes('Bandwidth') || errMsg.includes('bandwidth') || errMsg.includes('exceeded')) {
        return NextResponse.json({ error: errMsg }, { status: 500 });
      }
      console.error("Collection not found:", collectionErr.message);
      return NextResponse.json(
        { error: "Table bank 不存在，請至「鋒兄設定」中初始化。" },
        { status: 404 }
      );
    }
    const res = await databases.listDocuments(
      databaseId,
      collectionId,
      [
        sdk.Query.limit(100),
      ]
    );
    return NextResponse.json(res.documents);
  } catch (err) {
    console.error("GET /bank error:", err);
    const message = err instanceof Error ? err.message : "Fetch failed";
    // 如果是 collection not found，返回 404
    if (message.includes('not found') || message.includes('could not be found') || (err.code === 404) || (err.type === 'collection_not_found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 新增銀行資料
export async function POST(req) {
  try {
    const body = await req.json();

    // 驗證必填欄位 (name 是必須的，其他可選)
    const { 
      name, 
      deposit, 
      site, 
      address,
      withdrawals,
      transfer,
      activity,
      card,
      account
    } = body;

    if (!name) {
      return NextResponse.json({ error: "Missing name field" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const collectionId = await getCollectionId(databases, databaseId, "bank");

    const payload = {
      name,
      deposit: deposit ? parseInt(deposit, 10) : 0,
      site: site || null,
      address: address || null,
      withdrawals: withdrawals ? parseInt(withdrawals, 10) : 0,
      transfer: transfer ? parseInt(transfer, 10) : 0,
      activity: activity || null,
      card: card || null,
      account: account || null
    };

    const res = await databases.createDocument(
      databaseId,
      collectionId,
      sdk.ID.unique(),
      payload
    );

    return NextResponse.json(res);
  } catch (err) {
    console.error("POST /bank error:", err);
    const message = err instanceof Error ? err.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
