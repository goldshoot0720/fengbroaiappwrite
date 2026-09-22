import { NextResponse } from "next/server";
import { createAppwrite, getCollectionId } from "../../_lib/appwriteClient";


export const dynamic = 'force-dynamic';

// Extract file ID from Appwrite storage URL
function extractFileIdFromUrl(photoUrl) {
  if (!photoUrl) return null;
  // URL format: .../storage/buckets/{bucketId}/files/{fileId}/view?...
  const match = photoUrl.match(/\/files\/([^\/]+)\/view/);
  return match ? match[1] : null;
}

// PUT /api/food/[id]
export async function PUT(req, context) {
  try {
    const { searchParams } = new URL(req.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const collectionId = await getCollectionId(databases, databaseId, "food");
    
    const { params } = context;
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const body = await req.json();
    const { name, amount, todate, photo, price, shop, photohash } = body;

    // Validate and format date
    let formattedDate = '';
    if (todate) {
      try {
        // Try to parse and format the date
        const dateObj = new Date(todate);
        if (isNaN(dateObj.getTime())) {
          throw new Error(`Invalid date: ${todate}`);
        }
        // Format as YYYY-MM-DD for date field or ISO string for datetime
        formattedDate = todate.includes('T') ? dateObj.toISOString() : todate;
      } catch (dateErr) {
        console.error('[PUT /api/food/[id]] Date parsing error:', dateErr);
        return NextResponse.json({ error: `Invalid date format: ${todate}` }, { status: 400 });
      }
    }

    // Build document data, only include defined values
    const docData = {
      name: name || '',
      amount: amount ? parseInt(amount, 10) : 0,
      todate: formattedDate || null,
      price: price ? parseInt(price, 10) : 0,
    };
    
    // Only add optional fields if they have values
    // Use null for empty photo URLs (Appwrite requires valid URL or null)
    if (photo !== undefined) docData.photo = photo && photo.trim() ? photo : null;
    if (shop !== undefined) docData.shop = shop || '';
    if (photohash !== undefined) docData.photohash = photohash || '';

    const response = await databases.updateDocument(
      databaseId,
      collectionId,
      id,
      docData
    );

    return NextResponse.json(response);
  } catch (err) {
    console.error("PUT /api/food/[id] error:", err);
    console.error("Error details:", {
      message: err.message,
      code: err.code,
      type: err.type,
      response: err.response,
      stack: err.stack
    });
    
    // Return detailed error message
    const errorMessage = err.message || 'Update failed';
    return NextResponse.json({ 
      error: errorMessage,
      details: {
        code: err.code,
        type: err.type
      }
    }, { status: 500 });
  }
}

// DELETE /api/food/[id]
export async function DELETE(req, context) {
  try {
    const { searchParams } = new URL(req.url);
    const { databases, storage, databaseId, bucketId } = createAppwrite(searchParams);
    const collectionId = await getCollectionId(databases, databaseId, "food");
    
    const { params } = context;
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    // First, get the document to retrieve photo URL
    const doc = await databases.getDocument(databaseId, collectionId, id);
    
    // 檔案清理與刪除文件同時進行，不再一個等一個（清理失敗不影響刪除）。
    const cleanups = [];
    // If there's a photo, try to delete it from storage
    if (doc.photo && bucketId) {
      cleanups.push((async () => {
        const fileId = extractFileIdFromUrl(doc.photo);
        if (fileId) {
          try {
            await storage.deleteFile(bucketId, fileId);
            console.log(`Deleted image file: ${fileId}`);
          } catch (imgErr) {
            // Log but don't fail if image deletion fails (might be external URL)
            console.warn(`Failed to delete image file ${fileId}:`, imgErr.message);
          }
        }
      })());
    }

    await Promise.all([
      databases.deleteDocument(databaseId, collectionId, id),
      ...cleanups,
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/food/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
