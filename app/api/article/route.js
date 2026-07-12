import { NextResponse } from "next/server";
import { createAppwrite, getCollectionId } from "../_lib/appwriteClient";

const sdk = require('node-appwrite');

export const dynamic = 'force-dynamic';

async function listAllArticleDocuments(databases, databaseId, collectionId) {
  const pageSize = 100;
  const documents = [];
  let cursorAfter = null;

  while (true) {
    const queries = [
      sdk.Query.limit(pageSize),
      sdk.Query.orderDesc('$createdAt')
    ];

    if (cursorAfter) {
      queries.push(sdk.Query.cursorAfter(cursorAfter));
    }

    const res = await databases.listDocuments(databaseId, collectionId, queries);
    documents.push(...res.documents);

    if (!res.documents.length || res.documents.length < pageSize) {
      break;
    }

    cursorAfter = res.documents[res.documents.length - 1].$id;
  }

  return documents;
}

// 獲取所有文章
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    
    // 嘗試取得 collection ID
    let collectionId;
    try {
      collectionId = await getCollectionId(databases, databaseId, "article");
    } catch (collectionErr) {
      const errMsg = collectionErr.message || '';
      if (errMsg.includes('Bandwidth') || errMsg.includes('bandwidth') || errMsg.includes('exceeded')) {
        return NextResponse.json({ error: errMsg }, { status: 500 });
      }
      console.error("Collection not found:", collectionErr.message);
      return NextResponse.json(
        { error: "Table article 不存在，請至「鋒兄設定」中初始化。" },
        { status: 404 }
      );
    }
    
    const documents = await listAllArticleDocuments(databases, databaseId, collectionId);
    return NextResponse.json(documents);
  } catch (err) {
    console.error("GET /article error:", err);
    const message = err instanceof Error ? err.message : "Failed to fetch articles";
    // 如果是 collection not found，返回 404
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 新增文章
export async function POST(req) {
  try {
    const { searchParams } = new URL(req.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const collectionId = await getCollectionId(databases, databaseId, "article");
    
    const body = await req.json();

    const res = await databases.createDocument(
      databaseId,
      collectionId,
      sdk.ID.unique(),
      body
    );
    return NextResponse.json(res);
  } catch (err) {
    console.error("POST /article error:", err);
    const message = err instanceof Error ? err.message : "Failed to create article";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
