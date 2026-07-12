import { NextResponse } from "next/server";
import { listAllDocuments } from "../../_lib/listAllDocuments";
import { createAppwrite, getCollectionId } from "../../_lib/appwriteClient";

const sdk = require('node-appwrite');

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const collectionId = await getCollectionId(databases, databaseId, 'commonaccount');
    const documents = await listAllDocuments(databases, databaseId, collectionId, sdk);
    return NextResponse.json(documents);
  } catch (err) {
    console.error("GET /api/common-account/site error:", err);
    return NextResponse.json(
      { error: err.message }, 
      { status: err.code || 500 }
    );
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { searchParams } = new URL(req.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const collectionId = await getCollectionId(databases, databaseId, 'commonaccount');

    const res = await databases.createDocument(
      databaseId,
      collectionId,
      sdk.ID.unique(),
      body
    );
    return NextResponse.json(res);
  } catch (err) {
    console.error("POST /api/common-account/site error:", err);
    return NextResponse.json(
      { error: err.message }, 
      { status: err.code || 500 }
    );
  }
}
