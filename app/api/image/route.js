import { NextResponse } from "next/server";
import { listAllDocuments } from "../_lib/listAllDocuments";
import { getAppwriteErrorMessage, getAppwriteErrorStatus } from "../_lib/appwriteConfig";

const sdk = require('node-appwrite');

export const dynamic = 'force-dynamic';

function createAppwrite(searchParams) {
  // 從 URL 參數讀取配置（優a先），否則使用 .env（支援新舊兩種變數名）
  const endpoint = searchParams?.get('_endpoint') || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId = searchParams?.get('_project') || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const databaseId = searchParams?.get('_database') || process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
  const apiKey = searchParams?.get('_key') || process.env.NEXT_PUBLIC_APPWRITE_API_KEY;
  const bucketId = searchParams?.get('_bucket') || process.env.NEXT_PUBLIC_APPWRITE_BUCKET_ID;

  if (!endpoint || !projectId || !databaseId || !apiKey) {
    throw new Error("Appwrite configuration is missing");
  }

  const client = new sdk.Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

  const databases = new sdk.Databases(client);
  const storage = new sdk.Storage(client);

  return { databases, storage, databaseId, bucketId };
}

function extractFileIdFromUrl(fileUrl) {
  if (!fileUrl) return null;
  const match = fileUrl.match(/\/files\/([^\/]+)\/(?:view|download|preview)/);
  return match ? match[1] : null;
}

async function enrichImagesWithSize(documents, storage, bucketId) {
  if (!bucketId) {
    return documents.map((doc) => ({ ...doc, size: doc.size ?? null }));
  }

  return Promise.all(
    documents.map(async (doc) => {
      if (typeof doc.size === 'number') return doc;
      const fileId = extractFileIdFromUrl(doc.file);
      if (!fileId) return { ...doc, size: null };

      try {
        const file = await storage.getFile(bucketId, fileId);
        return { ...doc, size: file.sizeOriginal ?? file.size ?? null };
      } catch (error) {
        console.warn(`Failed to read image file size ${fileId}:`, error.message);
        return { ...doc, size: null };
      }
    })
  );
}

// GET /api/image - List all images
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, storage, databaseId, bucketId } = createAppwrite(searchParams);
    
    // Get collection ID by name
    const allCollections = await databases.listCollections(databaseId);
    const imageCollection = allCollections.collections.find(col => col.name === 'image');
    
    if (!imageCollection) {
      return NextResponse.json({ error: "Table image 不存在，請至「鋒兄設定」中初始化。" }, { status: 404 });
    }
    
    const collectionId = imageCollection.$id;
    const documents = await listAllDocuments(databases, databaseId, collectionId, sdk, [
      sdk.Query.orderDesc('$createdAt'),
    ]);
    
    return NextResponse.json(await enrichImagesWithSize(documents, storage, bucketId));
  } catch (err) {
    console.error("GET /api/image error:", err);
    return NextResponse.json({ error: getAppwriteErrorMessage(err) }, { status: getAppwriteErrorStatus(err) });
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
        filetype: body.filetype || '',
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
    return NextResponse.json({ error: getAppwriteErrorMessage(err) }, { status: getAppwriteErrorStatus(err) });
  }
}
