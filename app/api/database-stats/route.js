import { NextResponse } from "next/server";
import { TABLE_SCHEMAS } from "../create-table/route";

const sdk = require('node-appwrite');

export const dynamic = 'force-dynamic';

function createAppwrite(searchParams) {
  // 優先使用 URL 參數（使用者輸入），其次使用環境變數（支援新舊兩種變數名）
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

const normalizeExpectedType = (type) => (type === "url" ? "string" : type);

// Keep database-stats aligned with the latest create-table schema.
const TABLE_DEFINITIONS = Object.fromEntries(
  Object.entries(TABLE_SCHEMAS).map(([tableName, schema]) => [
    tableName,
    schema.attributes.map((attr) => ({
      key: attr.key,
      type: normalizeExpectedType(attr.type),
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
  
  if (expected.length !== actual.length) {
    console.log(`[compareSchema:${tableName}] ❌ Length mismatch:`);
    console.log(`  Expected: ${expected.length} attributes`);
    console.log(`  Actual: ${actual.length} attributes`);
    console.log(`  Expected keys: ${expected.map(a => a.key).join(', ')}`);
    console.log(`  Actual keys: ${actual.map(a => a.key).join(', ')}`);
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
      console.log(`[compareSchema:${tableName}] ❌ Missing attribute: ${key}`);
      hasError = true;
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
    
    // List all collections in the database
    const allCollections = await databases.listCollections(databaseId);
    
    // Create a map of collection name -> collection object
    // If multiple collections have the same name, use the most recently updated one
    const collectionMap = {};
    allCollections.collections.forEach(col => {
      if (!collectionMap[col.name] || col.$updatedAt > collectionMap[col.name].$updatedAt) {
        collectionMap[col.name] = col;
      }
    });
    
    // Define expected tables
    const tableNames = ["article", "bank", "commonaccount", "food", "image", "music", "podcast", "commondocument", "routine", "subscription", "video", "landtophistory"];
    
    // Get each collection's column count and document count dynamically
    const collectionsWithCounts = await Promise.all(
      tableNames.map(async (name) => {
        const collection = collectionMap[name];
        
        if (!collection) {
          // Collection doesn't exist - use fallback from TABLE_DEFINITIONS
          const fallbackColumns = TABLE_DEFINITIONS[name];
          return {
            name,
            columnCount: fallbackColumns ? fallbackColumns.length : 0,
            documentCount: 0,
            error: true,
            schemaMismatch: false
          };
        }
        
        try {
          // 動態計算：從 collection.attributes 取得實際欄位數
          const columnCount = collection.attributes ? collection.attributes.length : 0;
          
          // Check schema mismatch
          const expectedSchema = TABLE_DEFINITIONS[name];
          // Filter out attributes that are not yet available (still processing)
          // AND filter out system attributes (starting with $)
          const actualSchema = (collection.attributes || []).filter(attr => 
            (attr.status === 'available' || !attr.status) && !attr.key.startsWith('$')
          );
          
          console.log(`\n[${name}] Checking schema...`);
          console.log(`[${name}] Collection ID: ${collection.$id}`);
          console.log(`[${name}] Total attributes: ${collection.attributes?.length || 0} (${actualSchema.length} available)`);
          
          // Log first attribute for debugging
          if (actualSchema.length > 0) {
            console.log(`[${name}] Sample attribute:`, JSON.stringify(actualSchema[0], null, 2));
          }
          
          const schemaMismatch = !compareSchema(expectedSchema, actualSchema, name);
          
          console.log(`[${name}] Final result: schemaMismatch = ${schemaMismatch}\n`);
          
          // Get document count
          const docs = await databases.listDocuments(databaseId, collection.$id);
          
          return {
            name,
            collectionId: collection.$id,
            columnCount,
            documentCount: docs.total,
            schemaMismatch
          };
        } catch (err) {
          // 如果查詢失敗，使用 collection.attributes.length 作為 fallback
          const columnCount = collection.attributes ? collection.attributes.length : 0;
          const expectedSchema = TABLE_DEFINITIONS[name];
          const actualSchema = collection.attributes || [];
          const schemaMismatch = !compareSchema(expectedSchema, actualSchema, name);
          
          return {
            name,
            collectionId: collection.$id,
            columnCount,
            documentCount: 0,
            error: true,
            schemaMismatch
          };
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
