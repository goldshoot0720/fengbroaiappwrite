import { NextResponse } from "next/server";
import { listAllDocuments } from "../_lib/listAllDocuments";
import { createAppwrite, getCollectionId } from "../_lib/appwriteClient";

const sdk = require('node-appwrite');

export const dynamic = 'force-dynamic';

// GET /api/food
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    
    // 嘗試取得 collection ID
    let collectionId;
    try {
      collectionId = await getCollectionId(databases, databaseId, "food");
    } catch (collectionErr) {
      const errMsg = collectionErr.message || '';
      if (errMsg.includes('Bandwidth') || errMsg.includes('bandwidth') || errMsg.includes('exceeded')) {
        return NextResponse.json({ error: errMsg }, { status: 500 });
      }
      console.error("Collection not found:", collectionErr.message);
      return NextResponse.json(
        { error: "Table food 不存在，請至「鋒兄設定」中初始化。" },
        { status: 404 }
      );
    }
    
    const documents = await listAllDocuments(databases, databaseId, collectionId, sdk, [
      sdk.Query.orderAsc('todate'),
    ]);
    return NextResponse.json(documents);
  } catch (err) {
    console.error("GET /api/food error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/food
export async function POST(req) {
  try {
    const { searchParams } = new URL(req.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const collectionId = await getCollectionId(databases, databaseId, "food");
    
    const body = await req.json();
    const { name, amount, todate, photo, price, shop, photohash } = body;
    let formattedDate = '';
    if (todate) {
      const dateObj = new Date(todate);
      if (Number.isNaN(dateObj.getTime())) {
        return NextResponse.json({ error: `Invalid date format: ${todate}` }, { status: 400 });
      }
      formattedDate = todate.includes('T') ? dateObj.toISOString() : todate;
    }

    // Build document data, only include defined values
    const docData = {
      name: name || '',
      amount: amount ? parseInt(amount, 10) : 0,
      price: price ? parseInt(price, 10) : 0,
    };
    if (formattedDate) docData.todate = formattedDate;
    
    // Only add optional fields if they have values
    // Use null for empty photo URLs (Appwrite requires valid URL or null)
    if (photo && photo.trim()) docData.photo = photo;
    if (shop) docData.shop = shop;
    if (photohash) docData.photohash = photohash;

    const response = await databases.createDocument(
      databaseId,
      collectionId,
      sdk.ID.unique(),
      docData
    );

    return NextResponse.json(response);
  } catch (err) {
    console.error("POST /api/food error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
