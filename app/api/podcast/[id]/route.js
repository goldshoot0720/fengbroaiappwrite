import { NextResponse } from "next/server";
import { createAppwrite, getCollectionId } from "../../_lib/appwriteClient";


export const dynamic = 'force-dynamic';

// Extract file ID from Appwrite storage URL
function extractFileIdFromUrl(fileUrl) {
  if (!fileUrl) return null;
  const match = fileUrl.match(/\/files\/([^\/]+)\/view/);
  return match ? match[1] : null;
}

// GET /api/podcast/[id] - Get podcast by ID
export async function GET(request, { params }) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const { id } = await params;
    
    // Get collection ID by name
    const collectionId = await getCollectionId(databases, databaseId, "podcast", { required: false });
    if (!collectionId) {
      return NextResponse.json({ error: "Table podcast 不存在，請至「鋒兄設定」中初始化。" }, { status: 404 });
    }
    const document = await databases.getDocument(databaseId, collectionId, id);
    
    return NextResponse.json(document);
  } catch (err) {
    console.error("GET /api/podcast/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT /api/podcast/[id] - Update podcast
export async function PUT(request, { params }) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const { id } = await params;
    const body = await request.json();
    
    // Get collection ID by name
    const collectionId = await getCollectionId(databases, databaseId, "podcast", { required: false });
    if (!collectionId) {
      return NextResponse.json({ error: "Table podcast 不存在，請至「鋒兄設定」中初始化。" }, { status: 404 });
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
    console.error("PUT /api/podcast/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/podcast/[id] - Delete podcast
export async function DELETE(request, { params }) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, storage, databaseId, bucketId } = createAppwrite(searchParams);
    const { id } = await params;
    
    // Get collection ID by name
    const collectionId = await getCollectionId(databases, databaseId, "podcast", { required: false });
    if (!collectionId) {
      return NextResponse.json({ error: "Table podcast 不存在，請至「鋒兄設定」中初始化。" }, { status: 404 });
    }
    
    // Get document to retrieve file URLs
    const doc = await databases.getDocument(databaseId, collectionId, id);
    
    // Delete podcast file from storage if exists
    if (doc.file && bucketId) {
      const fileId = extractFileIdFromUrl(doc.file);
      if (fileId) {
        try {
          await storage.deleteFile(bucketId, fileId);
          console.log(`Deleted podcast file: ${fileId}`);
        } catch (fileErr) {
          console.warn(`Failed to delete podcast file ${fileId}:`, fileErr.message);
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
    await databases.deleteDocument(databaseId, collectionId, id);
    
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/podcast/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
