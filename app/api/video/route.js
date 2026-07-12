import { NextResponse } from "next/server";
import { listAllDocuments } from "../_lib/listAllDocuments";
import { getAppwriteErrorMessage, getAppwriteErrorStatus } from "../_lib/appwriteConfig";
import { createAppwrite, getCollectionId } from "../_lib/appwriteClient";

const sdk = require('node-appwrite');

export const dynamic = 'force-dynamic';

function parseFileSize(value) {
  const fileSize = Number(value);
  return Number.isFinite(fileSize) && fileSize >= 0 ? Math.round(fileSize) : undefined;
}

function isMissingFileSizeAttribute(err) {
  const message = err?.message || "";
  return message.includes("fileSize") && (message.includes("Unknown attribute") || message.includes("Invalid document structure"));
}

// GET /api/video - List all videos
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    
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
    
    const documents = await listAllDocuments(databases, databaseId, collectionId, sdk, [
      sdk.Query.orderDesc('$createdAt'),
    ]);
    return NextResponse.json(documents);
  } catch (err) {
    console.error("GET /api/video error:", err);
    return NextResponse.json({ error: getAppwriteErrorMessage(err) }, { status: getAppwriteErrorStatus(err) });
  }
}

// POST /api/video - Create new video
export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: "影片名稱為必填欄位" }, { status: 400 });
    }

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

    // Build data object dynamically, only including fields that have values
    // This avoids errors if the collection doesn't have all attributes
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
    const fileSize = parseFileSize(body.fileSize);
    if (fileSize !== undefined) data.fileSize = fileSize;

    let document;
    try {
      document = await databases.createDocument(
        databaseId,
        collectionId,
        sdk.ID.unique(),
        data
      );
    } catch (createErr) {
      if (!isMissingFileSizeAttribute(createErr) || data.fileSize === undefined) throw createErr;
      const { fileSize: _fileSize, ...fallbackData } = data;
      document = await databases.createDocument(
        databaseId,
        collectionId,
        sdk.ID.unique(),
        fallbackData
      );
    }

    return NextResponse.json(document);
  } catch (err) {
    console.error("POST /api/video error:", err);
    return NextResponse.json({ error: getAppwriteErrorMessage(err) }, { status: getAppwriteErrorStatus(err) });
  }
}
