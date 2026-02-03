import { NextResponse } from "next/server";

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

// Table definitions with expected schema
const TABLE_DEFINITIONS = {
  article: [
    { key: 'title', type: 'string', size: 100 },
    { key: 'content', type: 'string', size: 1000 },
    { key: 'category', type: 'string', size: 100 },
    { key: 'ref', type: 'string', size: 100 },
    { key: 'newDate', type: 'datetime' },
    { key: 'url1', type: 'string', size: 2000 },  // Appwrite stores URL as string
    { key: 'url2', type: 'string', size: 2000 },
    { key: 'url3', type: 'string', size: 2000 },
    { key: 'file1', type: 'string', size: 150 },
    { key: 'file1name', type: 'string', size: 100 },
    { key: 'file1type', type: 'string', size: 20 },
    { key: 'file2', type: 'string', size: 150 },
    { key: 'file2name', type: 'string', size: 100 },
    { key: 'file2type', type: 'string', size: 20 },
    { key: 'file3', type: 'string', size: 150 },
    { key: 'file3name', type: 'string', size: 100 },
    { key: 'file3type', type: 'string', size: 20 }
  ],
  bank: [
    { key: 'name', type: 'string', size: 100 },
    { key: 'deposit', type: 'integer' },
    { key: 'site', type: 'string', size: 2000 }, // Appwrite stores URL as string
    { key: 'address', type: 'string', size: 100 },
    { key: 'withdrawals', type: 'integer' },
    { key: 'transfer', type: 'integer' },
    { key: 'activity', type: 'string', size: 2000 }, // Appwrite stores URL as string
    { key: 'card', type: 'string', size: 100 },
    { key: 'account', type: 'string', size: 100 }
  ],
  // Add simplified schema for other tables (just keys for now)
  commonaccount: [...Array.from({length: 37}, (_, i) => ({ key: `site${(i + 1).toString().padStart(2, '0')}`, type: 'string', size: 100 })), ...Array.from({length: 37}, (_, i) => ({ key: `note${(i + 1).toString().padStart(2, '0')}`, type: 'string', size: 100 })), { key: 'name', type: 'string', size: 100 }],
  food: [
    { key: 'name', type: 'string', size: 100 },
    { key: 'amount', type: 'integer' },
    { key: 'price', type: 'integer' },
    { key: 'shop', type: 'string', size: 100 },
    { key: 'todate', type: 'datetime' },
    { key: 'photo', type: 'string' },
    { key: 'photohash', type: 'string', size: 256 }
  ],
  subscription: [
    { key: 'name', type: 'string', size: 100 },
    { key: 'site', type: 'string' },
    { key: 'price', type: 'integer' },
    { key: 'nextdate', type: 'datetime' },
    { key: 'note', type: 'string', size: 100 },
    { key: 'account', type: 'string', size: 100 },
    { key: 'currency', type: 'string', size: 100 },
    { key: 'continue', type: 'boolean' }
  ],
  image: [
    { key: 'name', type: 'string', size: 100 },
    { key: 'file', type: 'string', size: 150 },
    { key: 'note', type: 'string', size: 100 },
    { key: 'ref', type: 'string', size: 100 },
    { key: 'category', type: 'string', size: 100 },
    { key: 'hash', type: 'string', size: 300 },
    { key: 'cover', type: 'boolean' }
  ],
  video: [
    { key: 'name', type: 'string', size: 100 },
    { key: 'file', type: 'string', size: 150 },
    { key: 'note', type: 'string', size: 100 },
    { key: 'ref', type: 'string', size: 100 },
    { key: 'category', type: 'string', size: 100 },
    { key: 'hash', type: 'string', size: 300 },
    { key: 'cover', type: 'string', size: 150 }
  ],
  music: [
    { key: 'name', type: 'string', size: 100 },
    { key: 'file', type: 'string', size: 150 },
    { key: 'lyrics', type: 'string', size: 3337 },
    { key: 'note', type: 'string', size: 100 },
    { key: 'ref', type: 'string', size: 100 },
    { key: 'category', type: 'string', size: 100 },
    { key: 'hash', type: 'string', size: 300 },
    { key: 'language', type: 'string', size: 100 },
    { key: 'cover', type: 'string', size: 150 }
  ],
  podcast: [
    { key: 'name', type: 'string', size: 100 },
    { key: 'file', type: 'string', size: 150 },
    { key: 'note', type: 'string', size: 100 },
    { key: 'ref', type: 'string', size: 100 },
    { key: 'category', type: 'string', size: 100 },
    { key: 'hash', type: 'string', size: 300 },
    { key: 'cover', type: 'string', size: 150 }
  ],
  commondocument: [
    { key: 'name', type: 'string', size: 100 },
    { key: 'file', type: 'string', size: 150 },
    { key: 'filetype', type: 'string', size: 20 },
    { key: 'note', type: 'string', size: 100 },
    { key: 'ref', type: 'string', size: 100 },
    { key: 'category', type: 'string', size: 100 },
    { key: 'hash', type: 'string', size: 300 },
    { key: 'cover', type: 'string', size: 150 }
  ],
  routine: [
    { key: 'name', type: 'string', size: 100 },
    { key: 'note', type: 'string', size: 100 },
    { key: 'lastdate1', type: 'datetime' },
    { key: 'lastdate2', type: 'datetime' },
    { key: 'lastdate3', type: 'datetime' },
    { key: 'link', type: 'string', size: 2000 },
    { key: 'photo', type: 'string', size: 2000 }
  ]
};

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
    const tableNames = ["article", "bank", "commonaccount", "food", "image", "music", "podcast", "commondocument", "routine", "subscription", "video"];
    
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
