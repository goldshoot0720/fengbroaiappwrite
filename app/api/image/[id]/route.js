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

// GET /api/image/[id] - Get image by ID
export async function GET(request, { params }) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const { id } = await params;
    
    // Get collection ID by name
    const collectionId = await getCollectionId(databases, databaseId, "image", { required: false });
    if (!collectionId) {
      return NextResponse.json({ error: "Table image 不存在，請至「鋒兄設定」中初始化。" }, { status: 404 });
    }
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
    const { databases, storage, databaseId, bucketId } = createAppwrite(searchParams);
    const { id } = await params;
    const body = await request.json();
    
    // Get collection ID by name
    const collectionId = await getCollectionId(databases, databaseId, "image", { required: false });
    if (!collectionId) {
      return NextResponse.json({ error: "Table image 不存在，請至「鋒兄設定」中初始化。" }, { status: 404 });
    }
    const existingDoc = await databases.getDocument(databaseId, collectionId, id);
    
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
        cover: !!body.cover
      }
    );

    if (bucketId && body.file && existingDoc.file && body.file !== existingDoc.file) {
      const oldFileId = extractFileIdFromUrl(existingDoc.file);
      const newFileId = extractFileIdFromUrl(body.file);
      if (oldFileId && oldFileId !== newFileId) {
        try {
          await storage.deleteFile(bucketId, oldFileId);
        } catch (storageErr) {
          console.warn(`Failed to delete replaced image file ${oldFileId}:`, storageErr.message);
        }
      }
    }
    
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
    const collectionId = await getCollectionId(databases, databaseId, "image", { required: false });
    if (!collectionId) {
      return NextResponse.json({ error: "Table image 不存在，請至「鋒兄設定」中初始化。" }, { status: 404 });
    }
    
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
