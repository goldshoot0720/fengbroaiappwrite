import { NextResponse } from "next/server";
import { TABLE_SCHEMAS } from "../create-table/route";
import { createAppwrite, listEveryCollection } from "../_lib/appwriteClient";
import { attributeHealth, buildCollectionStatsRow, pickNamedCollection } from "../../../lib/collectionStats";
import { ADDITIVE_SETUP_TABLES } from "../../../lib/managementRecords";


export const dynamic = 'force-dynamic';

// Appwrite 回報的型別：url 是 string，float 是 double。
const normalizeExpectedType = (type) => {
  if (type === "url") return "string";
  if (type === "float") return "double";
  return type;
};

// Keep database-stats aligned with the latest create-table schema.
const TABLE_DEFINITIONS = Object.fromEntries(
  Object.entries(TABLE_SCHEMAS).map(([tableName, schema]) => [
    tableName,
    schema.attributes.map((attr) => ({
      key: attr.key,
      type: normalizeExpectedType(attr.type),
      required: attr.required === true,
      ...(attr.size !== undefined ? { size: attr.size } : {}),
    })),
  ])
);

function compareSchema(expected, actual, tableName = 'unknown') {
  console.log(`\n========== [compareSchema:${tableName}] START ==========`);
  
  if (!actual || actual.length === 0) {
    console.log(`[compareSchema:${tableName}] ❌ No actual attributes`);
    console.log(`========== [compareSchema:${tableName}] END ==========\n`);
    return false;
  }
  
  // Create maps for easier comparison
  const expectedMap = {};
  expected.forEach(attr => {
    expectedMap[attr.key] = attr;
  });
  
  const actualMap = {};
  actual.forEach(attr => {
    actualMap[attr.key] = attr;
  });
  
  // Check if all expected keys exist and match
  let hasError = false;
  for (const key in expectedMap) {
    const exp = expectedMap[key];
    const act = actualMap[key];
    
    if (!act) {
      if (exp.required || tableName === "trialpurchase" || tableName === "reinstall" || ADDITIVE_SETUP_TABLES.includes(tableName)) {
        console.log(`[compareSchema:${tableName}] ❌ Missing required attribute: ${key}`);
        hasError = true;
      } else {
        console.log(`[compareSchema:${tableName}] ℹ️ Legacy table omits optional attribute: ${key}`);
      }
      continue;
    }
    
    if (exp.type && act.type !== exp.type) {
      console.log(`[compareSchema:${tableName}] ❌ Type mismatch for '${key}':`);
      console.log(`  Expected: ${exp.type}`);
      console.log(`  Actual: ${act.type}`);
      hasError = true;
      continue;
    }
    
    // Only check size for types that have size (string)
    if (exp.size !== undefined && act.size !== undefined && act.size !== exp.size) {
      console.log(`[compareSchema:${tableName}] ❌ Size mismatch for '${key}':`);
      console.log(`  Expected: ${exp.size}`);
      console.log(`  Actual: ${act.size}`);
      hasError = true;
      continue;
    }
    
    console.log(`[compareSchema:${tableName}] ✅ '${key}' matches (${act.type}${act.size ? `(${act.size})` : ''})`);
  }
  
  if (hasError) {
    console.log(`[compareSchema:${tableName}] ❌ Schema has mismatches`);
    console.log(`========== [compareSchema:${tableName}] END ==========\n`);
    return false;
  }
  
  console.log(`[compareSchema:${tableName}] ✅ All attributes match!`);
  console.log(`========== [compareSchema:${tableName}] END ==========\n`);
  return true;
}

// GET /api/database-stats
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);

    // Page through every collection. The default page is 25, so a rebuilt
    // sitevisit past that page never replaced the row the settings list showed.
    const allCollections = await listEveryCollection(databases, databaseId);

    // Keep the settings inventory in lock-step with the schemas that can be created.
    const tableNames = Object.keys(TABLE_SCHEMAS);
    
    // Get each collection's column count and document count dynamically
    const collectionsWithCounts = await Promise.all(
      tableNames.map(async (name) => {
        const collection = pickNamedCollection(allCollections, name);
        const fallbackColumns = TABLE_DEFINITIONS[name];

        if (!collection) {
          return buildCollectionStatsRow({
            name,
            collection: null,
            fallbackColumnCount: fallbackColumns ? fallbackColumns.length : 0,
          });
        }

        const health = attributeHealth(collection);
        // Columns still processing make listDocuments throw. That used to set
        // error and paint the red 建立 button on a table that already has an id.
        if (health.pending || health.failed) {
          return buildCollectionStatsRow({ name, collection });
        }

        try {
          const expectedSchema = TABLE_DEFINITIONS[name];
          const actualSchema = (collection.attributes || []).filter(attr =>
            (attr.status === 'available' || !attr.status) && !attr.key.startsWith('$')
          );

          console.log(`\n[${name}] Checking schema...`);
          console.log(`[${name}] Collection ID: ${collection.$id}`);
          console.log(`[${name}] Total attributes: ${collection.attributes?.length || 0} (${actualSchema.length} available)`);

          if (actualSchema.length > 0) {
            console.log(`[${name}] Sample attribute:`, JSON.stringify(actualSchema[0], null, 2));
          }

          const schemaMismatch = !compareSchema(expectedSchema, actualSchema, name);
          console.log(`[${name}] Final result: schemaMismatch = ${schemaMismatch}\n`);

          const docs = await databases.listDocuments(databaseId, collection.$id);

          return buildCollectionStatsRow({
            name,
            collection,
            documentCount: docs.total,
            schemaMismatch,
          });
        } catch (err) {
          console.error(`[${name}] listDocuments failed:`, err?.message || err);
          const expectedSchema = TABLE_DEFINITIONS[name];
          const actualSchema = (collection.attributes || []).filter(attr =>
            (attr.status === 'available' || !attr.status) && !String(attr.key || '').startsWith('$')
          );
          return buildCollectionStatsRow({
            name,
            collection,
            documentsError: true,
            schemaMismatch: !compareSchema(expectedSchema, actualSchema, name),
          });
        }
      })
    );

    // 動態計算總欄位數
    const totalColumns = collectionsWithCounts.reduce((sum, col) => sum + col.columnCount, 0);

    return NextResponse.json({
      totalColumns,
      totalCollections: tableNames.length,
      collections: collectionsWithCounts,
      databaseId
    });
  } catch (err) {
    console.error("GET /api/database-stats error:", err);
    return NextResponse.json(
      { error: err.message }, 
      { status: 500 }
    );
  }
}
