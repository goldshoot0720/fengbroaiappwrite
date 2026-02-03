import { NextResponse } from "next/server";

const sdk = require('node-appwrite');

export const dynamic = 'force-dynamic';

function createAppwrite(searchParams) {
  // 從 URL 參數讀取配置（優a先），否則使用 .env（支援新舊兩種變數名）
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

// GET /api/image - List all images
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    
    // Get collection ID by name
    const allCollections = await databases.listCollections(databaseId);
    const imageCollection = allCollections.collections.find(col => col.name === 'image');
    
    if (!imageCollection) {
      return NextResponse.json({ error: "Table image 不存在，請至「鋒兄設定」中初始化。" }, { status: 404 });
    }
    
    const collectionId = imageCollection.$id;
    const response = await databases.listDocuments(databaseId, collectionId);
    
    return NextResponse.json(response.documents);
  } catch (err) {
    console.error("GET /api/image error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/image - Create new image
export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const body = await request.json();
    
    // Get collection ID by name
    const allCollections = await databases.listCollections(databaseId);
    const imageCollection = allCollections.collections.find(col => col.name === 'image');
    
    if (!imageCollection) {
      return NextResponse.json({ error: "Table image 不存在，請至「鋒兄設定」中初始化。" }, { status: 404 });
    }
    
    const collectionId = imageCollection.$id;
    
    const document = await databases.createDocument(
      databaseId,
      collectionId,
      sdk.ID.unique(),
      {
        name: body.name,
        file: body.file || '',
        note: body.note || '',
        ref: body.ref || '',
        category: body.category || '',
        hash: body.hash || '',
        cover: !!body.cover
      }
    );
    
    return NextResponse.json(document);
  } catch (err) {
    console.error("POST /api/image error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
