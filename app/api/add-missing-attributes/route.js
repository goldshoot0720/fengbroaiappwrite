import { NextResponse } from "next/server";
import { TABLE_SCHEMAS } from "../create-table/route";
import { createAppwrite } from "../_lib/appwriteClient";

export const dynamic = "force-dynamic";

/**
 * Add attributes a table is missing — and nothing else.
 *
 * /api/create-table deletes the collection and rebuilds it, so it can never be
 * used to pick up a new field on a table that already holds records.
 * /api/update-schema only reports (it returns before its update branch). This
 * route fills that gap with the narrowest possible operation: for each expected
 * attribute absent from the collection, create it. It never deletes, never
 * resizes, and never touches a document.
 */
export async function POST(request) {
  try {
    const { tableName } = await request.json();
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);

    const schema = TABLE_SCHEMAS[tableName];
    if (!schema) {
      return NextResponse.json({ error: `Unknown table: ${tableName}` }, { status: 400 });
    }

    const allCollections = await databases.listCollections(databaseId);
    const matching = allCollections.collections.filter((col) => col.name === tableName);
    if (matching.length === 0) {
      return NextResponse.json(
        { error: `Table ${tableName} 不存在，請先在「鋒兄設定」建立。` },
        { status: 404 }
      );
    }

    // Same pick as update-schema: the most recently touched one wins when a
    // rebuild has left duplicates behind.
    const collection = matching.reduce((latest, col) =>
      col.$updatedAt > latest.$updatedAt ? col : latest
    );

    const present = new Set(
      (collection.attributes || [])
        .filter((attr) => attr.status === "available" || !attr.status)
        .map((attr) => attr.key)
    );

    const added = [];
    const failed = [];

    for (const attr of schema.attributes) {
      if (present.has(attr.key)) continue;
      try {
        if (attr.type === "string") {
          await databases.createStringAttribute(
            databaseId,
            collection.$id,
            attr.key,
            attr.size,
            false
          );
        } else if (attr.type === "integer") {
          await databases.createIntegerAttribute(databaseId, collection.$id, attr.key, false);
        } else if (attr.type === "float") {
          await databases.createFloatAttribute(databaseId, collection.$id, attr.key, false);
        } else if (attr.type === "boolean") {
          await databases.createBooleanAttribute(databaseId, collection.$id, attr.key, false);
        } else if (attr.type === "datetime") {
          await databases.createDatetimeAttribute(databaseId, collection.$id, attr.key, false);
        } else if (attr.type === "url") {
          await databases.createUrlAttribute(databaseId, collection.$id, attr.key, false);
        } else if (attr.type === "email") {
          await databases.createEmailAttribute(databaseId, collection.$id, attr.key, false);
        } else {
          failed.push({ key: attr.key, error: `不支援的欄位型別：${attr.type}` });
          continue;
        }
        added.push(attr.key);
      } catch (err) {
        // 409 means another request already created it; treat that as success.
        if (err?.code === 409) {
          added.push(attr.key);
          continue;
        }
        failed.push({ key: attr.key, error: err?.message || "建立失敗" });
      }
    }

    return NextResponse.json({
      success: failed.length === 0,
      tableName,
      added,
      failed,
      message: added.length
        ? `已補上 ${added.length} 個欄位：${added.join("、")}。Appwrite 需要幾秒才會就緒。`
        : "沒有缺少的欄位，不需要變更。",
    });
  } catch (err) {
    console.error("POST /api/add-missing-attributes error:", err);
    return NextResponse.json({ error: err?.message || "操作失敗" }, { status: 500 });
  }
}
