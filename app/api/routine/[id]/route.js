import { NextResponse } from "next/server";

const sdk = require('node-appwrite');

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

async function getCollectionId(databases, databaseId, name) {
  const allCollections = await databases.listCollections(databaseId);
  const col = allCollections.collections.find(c => c.name === name);
  if (!col) throw new Error(`Collection ${name} not found`);
  return col.$id;
}

// PUT /api/routine/[id]
export async function PUT(req, context) {
  try {
    const { params } = context;
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const body = await req.json();
    const { name, note, lastdate1, lastdate2, lastdate3, link, photo } = body;

    const { searchParams } = new URL(req.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const collectionId = await getCollectionId(databases, databaseId, 'routine');

    const payload = {};
    if (name !== undefined) payload.name = name;
    if (note !== undefined) payload.note = note || "";
    
    // Only include datetime fields if they have values
    if (lastdate1 !== undefined && lastdate1) payload.lastdate1 = lastdate1;
    if (lastdate2 !== undefined && lastdate2) payload.lastdate2 = lastdate2;
    if (lastdate3 !== undefined && lastdate3) payload.lastdate3 = lastdate3;
    
    // Only include URL fields if not empty
    if (link !== undefined && link && link.trim()) payload.link = link;
    if (photo !== undefined && photo && photo.trim()) payload.photo = photo;

    console.log('Updating routine with payload:', JSON.stringify(payload, null, 2));

    const response = await databases.updateDocument(
      databaseId,
      collectionId,
      id,
      payload
    );

    return NextResponse.json(response);
  } catch (err) {
    console.error("PUT /api/routine/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/routine/[id]
export async function DELETE(req, context) {
  try {
    const { params } = context;
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const { databases, storage, databaseId, bucketId } = createAppwrite(searchParams);
    const collectionId = await getCollectionId(databases, databaseId, 'routine');

    // First, get the document to check if it has a photo
    const document = await databases.getDocument(databaseId, collectionId, id);
    
    // If there's a photo URL, try to extract the file ID and delete it from storage
    if (document.photo) {
      try {
        // Extract file ID from Appwrite storage URL
        // Appwrite storage URLs typically have the format: https://cloud.appwrite.io/v1/storage/buckets/{bucketId}/files/{fileId}/view
        const urlParts = document.photo.split('/');
        const fileIdIndex = urlParts.indexOf('files') + 1;
        if (fileIdIndex > 0 && fileIdIndex < urlParts.length) {
          const fileId = urlParts[fileIdIndex];
          if (fileId && bucketId) {
            await storage.deleteFile(bucketId, fileId);
            console.log(`Deleted file ${fileId} from bucket ${bucketId}`);
          }
        }
      } catch (storageErr) {
        console.error("Failed to delete photo from storage:", storageErr.message);
        // Continue with document deletion even if photo deletion fails
      }
    }

    await databases.deleteDocument(databaseId, collectionId, id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/routine/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
