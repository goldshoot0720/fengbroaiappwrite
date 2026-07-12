import { NextResponse } from "next/server";
import { listAllDocuments } from "../_lib/listAllDocuments";
import { getAppwriteErrorMessage, getAppwriteErrorStatus } from "../_lib/appwriteConfig";
import { createAppwrite, getCollectionId } from "../_lib/appwriteClient";

const sdk = require('node-appwrite');

export const dynamic = 'force-dynamic';

// GET /api/music - List all music
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    
    // Get collection ID by name
    let collectionId;
    try {
      collectionId = await getCollectionId(databases, databaseId, "music");
    } catch (collectionErr) {
      const errMsg = collectionErr.message || '';
      if (errMsg.includes('Bandwidth') || errMsg.includes('bandwidth') || errMsg.includes('exceeded')) {
        return NextResponse.json({ error: errMsg }, { status: 500 });
      }
      console.error("Collection not found:", collectionErr.message);
      return NextResponse.json(
        { error: "Table music 不存在，請至「鋒兄設定」中初始化。" },
        { status: 404 }
      );
    }
    
    const documents = await listAllDocuments(databases, databaseId, collectionId, sdk, [
      sdk.Query.orderDesc('$createdAt'),
    ]);
    return NextResponse.json(documents);
  } catch (err) {
    console.error("GET /api/music error:", err);
    return NextResponse.json({ error: getAppwriteErrorMessage(err) }, { status: getAppwriteErrorStatus(err) });
  }
}

// POST /api/music - Create new music
export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const body = await request.json();
    
    // Get collection ID by name
    let collectionId;
    try {
      collectionId = await getCollectionId(databases, databaseId, "music");
    } catch (collectionErr) {
      const errMsg = collectionErr.message || '';
      if (errMsg.includes('Bandwidth') || errMsg.includes('bandwidth') || errMsg.includes('exceeded')) {
        return NextResponse.json({ error: errMsg }, { status: 500 });
      }
      console.error("Collection not found:", collectionErr.message);
      return NextResponse.json(
        { error: "Table music 不存在，請至「鋒兄設定」中初始化。" },
        { status: 404 }
      );
    }
    
    // Truncate fields to schema limits to prevent Appwrite validation errors
    const data = {
      name: (body.name || '').substring(0, 100),
      file: (body.file || '').substring(0, 500),
      filetype: (body.filetype || '').substring(0, 20),
      lyrics: (body.lyrics || '').substring(0, 3337),
      note: (body.note || '').substring(0, 500),
      ref: (body.ref || '').substring(0, 300),
      category: (body.category || '').substring(0, 100),
      hash: (body.hash || '').substring(0, 300),
      language: (body.language || '').substring(0, 100),
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
    console.error("POST /api/music error:", err);
    return NextResponse.json({ error: getAppwriteErrorMessage(err) }, { status: getAppwriteErrorStatus(err) });
  }
}
