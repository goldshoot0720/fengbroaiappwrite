import { NextResponse } from "next/server";

const sdk = require('node-appwrite');

export const dynamic = 'force-dynamic';

async function getCollectionId(databases, databaseId, name) {
  try {
    const allCollections = await databases.listCollections(databaseId);
    const col = allCollections.collections.find(c => c.name === name);
    if (!col) {
      const error = new Error(`Collection ${name} not found`);
      error.code = 404;
      throw error;
    }
    return col.$id;
  } catch (err) {
    // Preserve 404 status if already set
    if (!err.code) err.code = 404;
    throw err;
  }
}

function createAppwrite(searchParams) {
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

// GET /api/routine
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const collectionId = await getCollectionId(databases, databaseId, 'routine');

    const res = await databases.listDocuments(
      databaseId,
      collectionId,
      [
        sdk.Query.limit(100),
      ]
    );
    return NextResponse.json(res.documents);
  } catch (err) {
    console.error("GET /api/routine error:", err);
    // Check for bandwidth errors first
    const errMsg = err.message || '';
    if (errMsg.includes('Bandwidth') || errMsg.includes('bandwidth') || errMsg.includes('exceeded')) {
      return NextResponse.json({ error: errMsg }, { status: 500 });
    }
    // Check for collection not found errors
    if (errMsg.includes('not found') || errMsg.includes('Collection') || err.code === 404) {
      return NextResponse.json(
        { error: "Table routine 不存在，請至「鋒兄設定」中初始化。" },
        { status: 404 }
      );
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/routine
export async function POST(request) {
  try {
    const body = await request.json();
    const { name, note, lastdate1, lastdate2, lastdate3, link, photo } = body;

    if (!name) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const collectionId = await getCollectionId(databases, databaseId, 'routine');

    const payload = {
      name,
    };

    // Add optional text fields (empty string is ok)
    if (note !== undefined) payload.note = note || "";
    
    // Add optional URL fields (only if not empty)
    if (link && link.trim()) payload.link = link;
    if (photo && photo.trim()) payload.photo = photo;

    // Only add datetime fields if they have values
    if (lastdate1) payload.lastdate1 = lastdate1;
    if (lastdate2) payload.lastdate2 = lastdate2;
    if (lastdate3) payload.lastdate3 = lastdate3;

    console.log('Creating routine with payload:', JSON.stringify(payload, null, 2));

    const res = await databases.createDocument(
      databaseId,
      collectionId,
      sdk.ID.unique(),
      payload
    );

    return NextResponse.json(res);
  } catch (err) {
    console.error("POST /api/routine error:", err);
    console.error("Error details:", JSON.stringify(err, null, 2));
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
