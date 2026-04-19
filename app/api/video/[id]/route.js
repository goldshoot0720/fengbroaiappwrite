import { NextResponse } from "next/server";
import { listAllDocuments } from "../../_lib/listAllDocuments";

const sdk = require('node-appwrite');

export const dynamic = 'force-dynamic';
const MULTIPART_VIDEO_SUFFIX = '+part';

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

async function getCollectionId(databases, databaseId, name) {
  const allCollections = await databases.listCollections(databaseId);
  const col = allCollections.collections.find(c => c.name === name);
  if (!col) throw new Error(`Collection ${name} not found`);
  return col.$id;
}

// Extract file ID from Appwrite storage URL
function extractFileIdFromUrl(fileUrl) {
  if (!fileUrl) return null;
  // URL format: .../storage/buckets/{bucketId}/files/{fileId}/view?...
  const match = fileUrl.match(/\/files\/([^\/]+)\/view/);
  return match ? match[1] : null;
}

function isMultipartVideoFiletype(filetype) {
  return typeof filetype === 'string' && filetype.endsWith(MULTIPART_VIDEO_SUFFIX);
}

async function fetchVideoManifest(fileUrl, apiKey) {
  const response = await fetch(fileUrl, {
    headers: apiKey ? { 'x-appwrite-key': apiKey } : {},
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch multipart manifest: HTTP ${response.status}`);
  }

  return await response.json();
}

async function deleteVideoAssetBundle(storage, bucketId, fileUrl, filetype, apiKey) {
  const deletedFileIds = new Set();

  if (isMultipartVideoFiletype(filetype)) {
    try {
      const manifest = await fetchVideoManifest(fileUrl, apiKey);
      for (const part of manifest?.parts || []) {
        const partFileId = part?.fileId || extractFileIdFromUrl(part?.url);
        if (partFileId && !deletedFileIds.has(partFileId)) {
          await storage.deleteFile(bucketId, partFileId);
          deletedFileIds.add(partFileId);
        }
      }
    } catch (manifestErr) {
      console.warn(`Failed to delete multipart video parts for ${fileUrl}:`, manifestErr.message);
    }
  }

  const mainFileId = extractFileIdFromUrl(fileUrl);
  if (mainFileId && !deletedFileIds.has(mainFileId)) {
    await storage.deleteFile(bucketId, mainFileId);
  }
}

// GET /api/video/[id] - Get video by ID
export async function GET(request, { params }) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const { id } = await params;
    
    // Get collection ID by name
    let collectionId;
    try {
      collectionId = await getCollectionId(databases, databaseId, "video");
    } catch (collectionErr) {
      const errMsg = collectionErr.message || '';
      if (errMsg.includes('Bandwidth') || errMsg.includes('bandwidth') || errMsg.includes('exceeded')) {
        return NextResponse.json({ error: errMsg }, { status: 500 });
      }
      console.error("Collection not found:", collectionErr.message);
      return NextResponse.json(
        { error: "Table video 不存在，請至「鋒兄設定」中初始化。" },
        { status: 404 }
      );
    }
    
    const document = await databases.getDocument(databaseId, collectionId, id);
    
    return NextResponse.json(document);
  } catch (err) {
    console.error("GET /api/video/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT /api/video/[id] - Update video
export async function PUT(request, { params }) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, storage, databaseId, bucketId } = createAppwrite(searchParams);
    const { id } = await params;
    const body = await request.json();

    // Get collection ID by name
    let collectionId;
    try {
      collectionId = await getCollectionId(databases, databaseId, "video");
    } catch (collectionErr) {
      const errMsg = collectionErr.message || '';
      if (errMsg.includes('Bandwidth') || errMsg.includes('bandwidth') || errMsg.includes('exceeded')) {
        return NextResponse.json({ error: errMsg }, { status: 500 });
      }
      console.error("Collection not found:", collectionErr.message);
      return NextResponse.json(
        { error: "Table video 不存在，請至「鋒兄設定」中初始化。" },
        { status: 404 }
      );
    }

    // Get current document to compare old and new values
    const currentDoc = await databases.getDocument(databaseId, collectionId, id);

    // Build data object dynamically, only including fields that have values
    const data = {
      name: (body.name || '').substring(0, 100),
    };
    
    // Only add optional fields if they have values
    if (body.file !== undefined && body.file !== null) data.file = String(body.file).substring(0, 500);
    if (body.filetype !== undefined && body.filetype !== null) data.filetype = String(body.filetype).substring(0, 20);
    if (body.note !== undefined && body.note !== null) data.note = String(body.note).substring(0, 500);
    if (body.ref !== undefined && body.ref !== null) data.ref = String(body.ref).substring(0, 300);
    if (body.category !== undefined && body.category !== null) data.category = String(body.category).substring(0, 100);
    if (body.hash !== undefined && body.hash !== null) data.hash = String(body.hash).substring(0, 300);
    if (body.cover !== undefined && body.cover !== null) data.cover = String(body.cover).substring(0, 500);

    const document = await databases.updateDocument(
      databaseId,
      collectionId,
      id,
      data
    );

    // Handle file deletion if file was removed or changed
    if (currentDoc.file && bucketId) {
      const oldFileId = extractFileIdFromUrl(currentDoc.file);
      const newFileId = extractFileIdFromUrl(body.file);
      
      if (oldFileId && oldFileId !== newFileId) {
        try {
          // Count how many documents reference the old file
          const allDocs = await listAllDocuments(databases, databaseId, collectionId, sdk);
          const fileRefCount = allDocs.filter(d => d.$id !== id && d.file === currentDoc.file).length;
          
          // Only delete from storage if no other documents reference it
          if (fileRefCount === 0) {
            await deleteVideoAssetBundle(storage, bucketId, currentDoc.file, currentDoc.filetype, searchParams?.get('_key') || process.env.NEXT_PUBLIC_APPWRITE_API_KEY);
            console.log(`Deleted old video file bundle: ${oldFileId}`);
          } else {
            console.log(`Skipped deleting old video file ${oldFileId} - referenced by ${fileRefCount} other documents`);
          }
        } catch (fileErr) {
          console.warn(`Failed to delete old video file ${oldFileId}:`, fileErr.message);
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
          const allDocs = await listAllDocuments(databases, databaseId, collectionId, sdk);
          const coverRefCount = allDocs.filter(d => d.$id !== id && d.cover === currentDoc.cover).length;
          
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
    console.error("PUT /api/video/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/video/[id] - Delete video
export async function DELETE(request, { params }) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, storage, databaseId, bucketId } = createAppwrite(searchParams);
    const { id } = await params;
    
    // Get collection ID by name
    let collectionId;
    try {
      collectionId = await getCollectionId(databases, databaseId, "video");
    } catch (collectionErr) {
      const errMsg = collectionErr.message || '';
      if (errMsg.includes('Bandwidth') || errMsg.includes('bandwidth') || errMsg.includes('exceeded')) {
        return NextResponse.json({ error: errMsg }, { status: 500 });
      }
      console.error("Collection not found:", collectionErr.message);
      return NextResponse.json(
        { error: "Table video 不存在，請至「鋒兄設定」中初始化。" },
        { status: 404 }
      );
    }
    
    // First, get the document to retrieve file URLs
    const doc = await databases.getDocument(databaseId, collectionId, id);
    
    // Check if video file is referenced by other documents
    if (doc.file && bucketId) {
      const fileId = extractFileIdFromUrl(doc.file);
      if (fileId) {
        try {
          // Count how many documents reference this file
          const allDocs = await listAllDocuments(databases, databaseId, collectionId, sdk);
          const fileRefCount = allDocs.filter(d => d.$id !== id && d.file === doc.file).length;
          
          // Only delete from storage if no other documents reference it
          if (fileRefCount === 0) {
            await deleteVideoAssetBundle(storage, bucketId, doc.file, doc.filetype, searchParams?.get('_key') || process.env.NEXT_PUBLIC_APPWRITE_API_KEY);
            console.log(`Deleted video file bundle: ${fileId}`);
          } else {
            console.log(`Skipped deleting video file ${fileId} - referenced by ${fileRefCount} other documents`);
          }
        } catch (fileErr) {
          console.warn(`Failed to delete video file ${fileId}:`, fileErr.message);
        }
      }
    }
    
    // Check if cover image is referenced by other documents
    if (doc.cover && bucketId) {
      const coverId = extractFileIdFromUrl(doc.cover);
      if (coverId) {
        try {
          // Count how many documents reference this cover
          const allDocs = await listAllDocuments(databases, databaseId, collectionId, sdk);
          const coverRefCount = allDocs.filter(d => d.$id !== id && d.cover === doc.cover).length;
          
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
    console.error("DELETE /api/video/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
