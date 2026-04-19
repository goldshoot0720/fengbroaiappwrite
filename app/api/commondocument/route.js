import { NextResponse } from "next/server";
import { listAllDocuments } from "../_lib/listAllDocuments";

const sdk = require('node-appwrite');

export const dynamic = 'force-dynamic';

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

// GET /api/commondocument - List all documents
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    
    // Get collection ID by name
    const allCollections = await databases.listCollections(databaseId);
    const docCollection = allCollections.collections.find(col => col.name === 'commondocument');
    
    if (!docCollection) {
      return NextResponse.json({ error: "Table commondocument 不存在，請至「鋒兄設定」中初始化。" }, { status: 404 });
    }
    
    const collectionId = docCollection.$id;
    const documents = await listAllDocuments(databases, databaseId, collectionId, sdk, [
      sdk.Query.orderDesc('$createdAt'),
    ]);
    return NextResponse.json(documents);
  } catch (err) {
    console.error("GET /api/commondocument error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/commondocument - Create new document
export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const body = await request.json();
    
    // Get collection ID by name
    const allCollections = await databases.listCollections(databaseId);
    const docCollection = allCollections.collections.find(col => col.name === 'commondocument');
    
    if (!docCollection) {
      return NextResponse.json({ error: "Table commondocument 不存在，請至「鋒兄設定」中初始化。" }, { status: 404 });
    }
    
    const collectionId = docCollection.$id;
    
    // Truncate fields to schema limits to prevent Appwrite validation errors
    const data = {
      name: (body.name || '').substring(0, 100),
      file: (body.file || '').substring(0, 500),
      filetype: (body.filetype || '').substring(0, 20),
      note: (body.note || '').substring(0, 500),
      ref: (body.ref || '').substring(0, 300),
      category: (body.category || '').substring(0, 100),
      hash: (body.hash || '').substring(0, 300),
      cover: (body.cover || '').substring(0, 500),
    };

    const document = await databases.createDocument(
      databaseId,
      collectionId,
      sdk.ID.unique(),
      data
    );
    
    return NextResponse.json(document);
  } catch (err) {
    console.error("POST /api/commondocument error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
