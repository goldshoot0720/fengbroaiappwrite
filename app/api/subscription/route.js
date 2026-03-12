import { NextResponse } from "next/server";

const sdk = require('node-appwrite');

export const dynamic = 'force-dynamic';

async function getCollection(databases, databaseId, name) {
  const allCollections = await databases.listCollections(databaseId);
  const normalizedName = String(name).toLowerCase();
  const col =
    allCollections.collections.find((c) => c.name === name) ||
    allCollections.collections.find((c) => c.$id === name) ||
    allCollections.collections.find((c) => String(c.name || "").toLowerCase() === normalizedName) ||
    allCollections.collections.find((c) => String(c.$id || "").toLowerCase() === normalizedName) ||
    allCollections.collections.find((c) => String(c.name || "").toLowerCase().includes(normalizedName)) ||
    allCollections.collections.find((c) => String(c.$id || "").toLowerCase().includes(normalizedName));
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
  // 優先使用 URL 參數（使用者輸入），其次使用環境變數（支援新舊兩種變數名）
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

    const res = await databases.listDocuments(
      databaseId,
      collectionId,
      [
        sdk.Query.limit(500),
        sdk.Query.orderAsc('nextdate')
      ]
    );
    return NextResponse.json(res.documents);
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

    // 驗證必填欄位（site 和 nextdate 為可選）
    const { name, site, price, nextdate, note, account, currency, category, purpose, usageFrequency, friendliness, alternative, retentionRecommendation } = body;
    const continueValue = body.continue;
    const archived = body.archived;
    if (!name || price == null) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 強制 price 為數字
    const payload = {
      name,
      price: Number(price),
    };

    // 只有在提供值時才添加可選欄位
    if (nextdate) payload.nextdate = nextdate;
    if (site) payload.site = site;
    if (note) payload.note = note;
    if (account) payload.account = account;
    if (currency) payload.currency = currency || "TWD";
    if (category) payload.category = category;
    if (purpose) payload.purpose = purpose;
    if (usageFrequency) payload.usageFrequency = usageFrequency;
    if (friendliness) payload.friendliness = friendliness;
    if (alternative) payload.alternative = alternative;
    if (retentionRecommendation) payload.retentionRecommendation = retentionRecommendation;
    if (archived !== undefined) payload.archived = !!archived;
    if (continueValue !== undefined) payload.continue = continueValue;

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
