import { NextResponse } from "next/server";

const sdk = require('node-appwrite');

export const dynamic = 'force-dynamic';

function createAppwrite(searchParams) {
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
  const match = fileUrl.match(/\/files\/([^\/]+)\/view/);
  return match ? match[1] : null;
}

// GET /api/music/[id] - Get music by ID
export async function GET(request, { params }) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const { id } = await params;
    
    // Get collection ID by name
    const allCollections = await databases.listCollections(databaseId);
    const musicCollection = allCollections.collections.find(col => col.name === 'music');
    
    if (!musicCollection) {
      return NextResponse.json({ error: "Music collection not found" }, { status: 404 });
    }
    
    const collectionId = musicCollection.$id;
    const document = await databases.getDocument(databaseId, collectionId, id);
    
    return NextResponse.json(document);
  } catch (err) {
    console.error("GET /api/music/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT /api/music/[id] - Update music
export async function PUT(request, { params }) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, storage, databaseId, bucketId } = createAppwrite(searchParams);
    const { id } = await params;
    const body = await request.json();
    
    // Get collection ID by name
    const allCollections = await databases.listCollections(databaseId);
    const musicCollection = allCollections.collections.find(col => col.name === 'music');
    
    if (!musicCollection) {
      return NextResponse.json({ error: "Music collection not found" }, { status: 404 });
    }
    
    const collectionId = musicCollection.$id;
    
    // Get current document to compare old and new values
    const currentDoc = await databases.getDocument(databaseId, collectionId, id);
    
    const document = await databases.updateDocument(
      databaseId,
      collectionId,
      id,
      {
        name: body.name,
        file: body.file || '',
        lyrics: body.lyrics || '',
        note: body.note || '',
        ref: body.ref || '',
        category: body.category || '',
        hash: body.hash || '',
        language: body.language || '',
        cover: body.cover || ''
      }
    );
    
    // Handle file deletion if file was removed or changed
    if (currentDoc.file && bucketId) {
      const oldFileId = extractFileIdFromUrl(currentDoc.file);
      const newFileId = extractFileIdFromUrl(body.file);
      
      if (oldFileId && oldFileId !== newFileId) {
        try {
          // Count how many documents reference the old file
          const allDocs = await databases.listDocuments(databaseId, collectionId);
          const fileRefCount = allDocs.documents.filter(d => d.$id !== id && d.file === currentDoc.file).length;
          
          // Only delete from storage if no other documents reference it
          if (fileRefCount === 0) {
            await storage.deleteFile(bucketId, oldFileId);
            console.log(`Deleted old music file: ${oldFileId}`);
          } else {
            console.log(`Skipped deleting old music file ${oldFileId} - referenced by ${fileRefCount} other documents`);
          }
        } catch (fileErr) {
          console.warn(`Failed to delete old music file ${oldFileId}:`, fileErr.message);
        }
      }
    }
    
    // Handle cover deletion if cover was removed or changed
    if (currentDoc.cover && bucketId) {
      const oldCoverId = extractFileIdFromUrl(currentDoc.cover);
      const newCoverId = extractFileIdFromUrl(body.cover);
      
      if (oldCoverId && oldCoverId !== newCoverId) {
        try {
          // Count how many documents reference the old cover
          const allDocs = await databases.listDocuments(databaseId, collectionId);
          const coverRefCount = allDocs.documents.filter(d => d.$id !== id && d.cover === currentDoc.cover).length;
          
          // Only delete from storage if no other documents reference it
          if (coverRefCount === 0) {
            await storage.deleteFile(bucketId, oldCoverId);
            console.log(`Deleted old cover image: ${oldCoverId}`);
          } else {
            console.log(`Skipped deleting old cover image ${oldCoverId} - referenced by ${coverRefCount} other documents`);
          }
        } catch (coverErr) {
          console.warn(`Failed to delete old cover image ${oldCoverId}:`, coverErr.message);
        }
      }
    }
    
    return NextResponse.json(document);
  } catch (err) {
    console.error("PUT /api/music/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/music/[id] - Delete music
export async function DELETE(request, { params }) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, storage, databaseId, bucketId } = createAppwrite(searchParams);
    const { id } = await params;
    
    // Get collection ID by name
    const allCollections = await databases.listCollections(databaseId);
    const musicCollection = allCollections.collections.find(col => col.name === 'music');
    
    if (!musicCollection) {
      return NextResponse.json({ error: "Music collection not found" }, { status: 404 });
    }
    
    const collectionId = musicCollection.$id;
    
    // Get document to retrieve file URLs
    const doc = await databases.getDocument(databaseId, collectionId, id);
    
    // Check if music file is referenced by other documents
    if (doc.file && bucketId) {
      const fileId = extractFileIdFromUrl(doc.file);
      if (fileId) {
        try {
          // Count how many documents reference this file
          const allDocs = await databases.listDocuments(databaseId, collectionId);
          const fileRefCount = allDocs.documents.filter(d => d.$id !== id && d.file === doc.file).length;
          
          // Only delete from storage if no other documents reference it
          if (fileRefCount === 0) {
            await storage.deleteFile(bucketId, fileId);
            console.log(`Deleted music file: ${fileId}`);
          } else {
            console.log(`Skipped deleting music file ${fileId} - referenced by ${fileRefCount} other documents`);
          }
        } catch (fileErr) {
          console.warn(`Failed to delete music file ${fileId}:`, fileErr.message);
        }
      }
    }
    
    // Check if cover image is referenced by other documents
    if (doc.cover && bucketId) {
      const coverId = extractFileIdFromUrl(doc.cover);
      if (coverId) {
        try {
          // Count how many documents reference this cover
          const allDocs = await databases.listDocuments(databaseId, collectionId);
          const coverRefCount = allDocs.documents.filter(d => d.$id !== id && d.cover === doc.cover).length;
          
          // Only delete from storage if no other documents reference it
          if (coverRefCount === 0) {
            await storage.deleteFile(bucketId, coverId);
            console.log(`Deleted cover image: ${coverId}`);
          } else {
            console.log(`Skipped deleting cover image ${coverId} - referenced by ${coverRefCount} other documents`);
          }
        } catch (coverErr) {
          console.warn(`Failed to delete cover image ${coverId}:`, coverErr.message);
        }
      }
    }
    
    // Delete the document
    await databases.deleteDocument(databaseId, collectionId, id);
    
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/music/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
