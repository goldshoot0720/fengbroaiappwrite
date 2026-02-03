import { NextResponse } from "next/server";

const sdk = require('node-appwrite');

export const dynamic = 'force-dynamic';

function createAppwrite(searchParams) {
  // 從 URL 參數讀取配置（優先），否則使用 .env
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

// Extract file ID from Appwrite storage URL
function extractFileIdFromUrl(fileUrl) {
  if (!fileUrl) return null;
  // URL format: .../storage/buckets/{bucketId}/files/{fileId}/view?...
  const match = fileUrl.match(/\/files\/([^\/]+)\/view/);
  return match ? match[1] : null;
}

// GET /api/commondocument/[id] - Get document by ID
export async function GET(request, { params }) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const { id } = await params;
    
    // Get collection ID by name
    const allCollections = await databases.listCollections(databaseId);
    const docCollection = allCollections.collections.find(col => col.name === 'commondocument');
    
    if (!docCollection) {
      return NextResponse.json({ error: "Document collection not found" }, { status: 404 });
    }
    
    const collectionId = docCollection.$id;
    // 使用正確的 Appwrite SDK 方法: getDocument (fixed)
    const document = await databases.getDocument(databaseId, collectionId, id);
    
    return NextResponse.json(document);
  } catch (err) {
    console.error("GET /api/commondocument/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT /api/commondocument/[id] - Update document
export async function PUT(request, { params }) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const { id } = await params;
    const body = await request.json();
    
    // Get collection ID by name
    const allCollections = await databases.listCollections(databaseId);
    const docCollection = allCollections.collections.find(col => col.name === 'commondocument');
    
    if (!docCollection) {
      return NextResponse.json({ error: "Document collection not found" }, { status: 404 });
    }
    
    const collectionId = docCollection.$id;
    
    // 使用正確的 Appwrite SDK 方法: updateDocument (fixed)
    const document = await databases.updateDocument(
      databaseId,
      collectionId,
      id,
      {
        name: body.name,
        file: body.file || '',
        filetype: body.filetype || '',
        note: body.note || '',
        ref: body.ref || '',
        category: body.category || '',
        hash: body.hash || '',
        cover: body.cover || ''
      }
    );
    
    return NextResponse.json(document);
  } catch (err) {
    console.error("PUT /api/commondocument/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/commondocument/[id] - Delete document
export async function DELETE(request, { params }) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, storage, databaseId, bucketId } = createAppwrite(searchParams);
    const { id } = await params;
    
    // Get collection ID by name
    const allCollections = await databases.listCollections(databaseId);
    const docCollection = allCollections.collections.find(col => col.name === 'commondocument');
    
    if (!docCollection) {
      return NextResponse.json({ error: "Document collection not found" }, { status: 404 });
    }
    
    const collectionId = docCollection.$id;
    
    // First, get the document to retrieve file URLs
    const doc = await databases.getDocument(databaseId, collectionId, id);
    
    // Delete document file from storage if exists
    if (doc.file && bucketId) {
      const fileId = extractFileIdFromUrl(doc.file);
      if (fileId) {
        try {
          await storage.deleteFile(bucketId, fileId);
          console.log(`Deleted document file: ${fileId}`);
        } catch (fileErr) {
          console.warn(`Failed to delete document file ${fileId}:`, fileErr.message);
        }
      }
    }
    
    // Delete cover image from storage if exists
    if (doc.cover && bucketId) {
      const coverId = extractFileIdFromUrl(doc.cover);
      if (coverId) {
        try {
          await storage.deleteFile(bucketId, coverId);
          console.log(`Deleted cover image: ${coverId}`);
        } catch (coverErr) {
          console.warn(`Failed to delete cover image ${coverId}:`, coverErr.message);
        }
      }
    }
    
    // Delete the document
    // 使用正確的 Appwrite SDK 方法: deleteDocument (fixed)
    await databases.deleteDocument(databaseId, collectionId, id);
    
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/commondocument/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
