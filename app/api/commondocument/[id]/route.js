import { NextResponse } from "next/server";
import { createAppwrite, getCollectionId } from "../../_lib/appwriteClient";


export const dynamic = 'force-dynamic';

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
    const collectionId = await getCollectionId(databases, databaseId, "commondocument", { required: false });
    if (!collectionId) {
      return NextResponse.json({ error: "Table commondocument 不存在，請至「鋒兄設定」中初始化。" }, { status: 404 });
    }
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
    const collectionId = await getCollectionId(databases, databaseId, "commondocument", { required: false });
    if (!collectionId) {
      return NextResponse.json({ error: "Table commondocument 不存在，請至「鋒兄設定」中初始化。" }, { status: 404 });
    }
    
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

    const document = await databases.updateDocument(
      databaseId,
      collectionId,
      id,
      data
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
    const collectionId = await getCollectionId(databases, databaseId, "commondocument", { required: false });
    if (!collectionId) {
      return NextResponse.json({ error: "Table commondocument 不存在，請至「鋒兄設定」中初始化。" }, { status: 404 });
    }
    
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
