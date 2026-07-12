import { NextResponse } from "next/server";
import { listAllDocuments } from "../_lib/listAllDocuments";
import { createAppwrite, getCollectionId } from "../_lib/appwriteClient";

const sdk = require('node-appwrite');

export const dynamic = 'force-dynamic';

// GET /api/commondocument - List all documents
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);

    const collectionId = await getCollectionId(databases, databaseId, "commondocument", {
      required: false,
    });
    if (!collectionId) {
      return NextResponse.json({ error: "Table commondocument 不存在，請至「鋒兄設定」中初始化。" }, { status: 404 });
    }

    const documents = await listAllDocuments(databases, databaseId, collectionId, sdk, [
      sdk.Query.orderDesc('$createdAt'),
    ]);
    return NextResponse.json(documents);
  } catch (err) {
    console.error("GET /api/commondocument error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/commondocument - Create new document
export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const body = await request.json();

    const collectionId = await getCollectionId(databases, databaseId, "commondocument", {
      required: false,
    });
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

    const document = await databases.createDocument(
      databaseId,
      collectionId,
      sdk.ID.unique(),
      data
    );
    
    return NextResponse.json(document);
  } catch (err) {
    console.error("POST /api/commondocument error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
