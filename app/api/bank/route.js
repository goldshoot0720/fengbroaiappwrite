import { NextResponse } from "next/server";
import { listAllDocuments } from "../_lib/listAllDocuments";
import { createAppwrite, getCollectionId } from "../_lib/appwriteClient";

const sdk = require('node-appwrite');

export const dynamic = 'force-dynamic';

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
    const documents = await listAllDocuments(databases, databaseId, collectionId, sdk);
    return NextResponse.json(documents);
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
