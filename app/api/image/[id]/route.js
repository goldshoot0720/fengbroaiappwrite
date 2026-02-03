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

// GET /api/image/[id] - Get image by ID
export async function GET(request, { params }) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const { id } = await params;
    
    // Get collection ID by name
    const allCollections = await databases.listCollections(databaseId);
    const imageCollection = allCollections.collections.find(col => col.name === 'image');
    
    if (!imageCollection) {
      return NextResponse.json({ error: "Image collection not found" }, { status: 404 });
    }
    
    const collectionId = imageCollection.$id;
    const document = await databases.getDocument(databaseId, collectionId, id);
    
    return NextResponse.json(document);
  } catch (err) {
    console.error("GET /api/image/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT /api/image/[id] - Update image
export async function PUT(request, { params }) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const { id } = await params;
    const body = await request.json();
    
    // Get collection ID by name
    const allCollections = await databases.listCollections(databaseId);
    const imageCollection = allCollections.collections.find(col => col.name === 'image');
    
    if (!imageCollection) {
      return NextResponse.json({ error: "Image collection not found" }, { status: 404 });
    }
    
    const collectionId = imageCollection.$id;
    
    const document = await databases.updateDocument(
      databaseId,
      collectionId,
      id,
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
    console.error("PUT /api/image/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/image/[id] - Delete image
export async function DELETE(request, { params }) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, storage, databaseId, bucketId } = createAppwrite(searchParams);
    const { id } = await params;
    
    // Get collection ID by name
    const allCollections = await databases.listCollections(databaseId);
    const imageCollection = allCollections.collections.find(col => col.name === 'image');
    
    if (!imageCollection) {
      return NextResponse.json({ error: "Image collection not found" }, { status: 404 });
    }
    
    const collectionId = imageCollection.$id;
    
    // First, get the document to retrieve file URL
    const doc = await databases.getDocument(databaseId, collectionId, id);
    
    // If there's a file, try to delete it from storage
    if (doc.file && bucketId) {
      const fileId = extractFileIdFromUrl(doc.file);
      if (fileId) {
        try {
          await storage.deleteFile(bucketId, fileId);
          console.log(`Deleted image file: ${fileId}`);
        } catch (imgErr) {
          // Log but don't fail if image deletion fails (might be external URL)
          console.warn(`Failed to delete image file ${fileId}:`, imgErr.message);
        }
      }
    }
    
    // Delete the document
    await databases.deleteDocument(databaseId, collectionId, id);
    
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/image/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
