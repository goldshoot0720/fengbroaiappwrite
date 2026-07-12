import { NextResponse } from "next/server";
import { listAllDocuments } from "../_lib/listAllDocuments";
import { createAppwrite, getCollectionId } from "../_lib/appwriteClient";

const sdk = require('node-appwrite');

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    
    // 嘗試取得 collection ID
    let collectionId;
    try {
      collectionId = await getCollectionId(databases, databaseId, "commonaccount");
    } catch (collectionErr) {
      const errMsg = collectionErr.message || '';
      if (errMsg.includes('Bandwidth') || errMsg.includes('bandwidth') || errMsg.includes('exceeded')) {
        return NextResponse.json({ error: errMsg }, { status: 500 });
      }
      console.error("Collection not found:", collectionErr.message);
      return NextResponse.json(
        { error: "Table commonaccount 不存在，請至「鋒兄設定」中初始化。" },
        { status: 404 }
      );
    }
    
    const documents = await listAllDocuments(databases, databaseId, collectionId, sdk);
    return NextResponse.json(documents);
  } catch (err) {
    console.error("GET /api/common-account error:", err);
    const message = err instanceof Error ? err.message : "Fetch failed";
    return NextResponse.json(
      { error: message }, 
      { status: err.code || 500 }
    );
  }
}

export async function POST(req) {
  try {
    const { searchParams } = new URL(req.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const collectionId = await getCollectionId(databases, databaseId, "commonaccount");
    
    const body = await req.json();

    const res = await databases.createDocument(
      databaseId,
      collectionId,
      sdk.ID.unique(),
      body
    );
    return NextResponse.json(res);
  } catch (err) {
    console.error("POST /api/common-account error:", err);
    return NextResponse.json(
      { error: err.message }, 
      { status: err.code || 500 }
    );
  }
}
