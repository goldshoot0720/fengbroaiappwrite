import { NextResponse } from "next/server";
import { TABLE_SCHEMAS } from "../create-table/route";
import { createAppwrite, listCollectionsNamed, listEveryCollection, listTablesNamed } from "../_lib/appwriteClient";
import { attributeHealth, buildCollectionStatsRow, normalizeCollection, pickNamedCollection } from "../../../lib/collectionStats";
import { ADDITIVE_SETUP_TABLES } from "../../../lib/managementRecords";

const sdk = require("node-appwrite");


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

async function explainLookup(databases, databaseId) {
  const lookup = {};
  try {
    const first = await databases.listCollections(
      databaseId,
      [sdk.Query.limit(100)],
      undefined,
      true,
    );
    const rows = first?.collections || first?.tables || [];
    lookup.collectionsTotal = first?.total;
    lookup.collectionsPage = rows.length;
    lookup.collectionNames = rows.map((col) => col?.name);
  } catch (err) {
    lookup.collectionsError = err?.message || String(err);
  }
  try {
    const tablesDB = new sdk.TablesDB(databases.client);
    const response = await tablesDB.listTables({
      databaseId,
      queries: [sdk.Query.limit(100)],
      total: true,
    });
    const tables = response?.tables || [];
    lookup.tablesTotal = response?.total;
    lookup.tableNames = tables.map((table) => table?.name);
  } catch (err) {
    lookup.tablesError = err?.message || String(err);
  }
  return lookup;
}

async function freshCollection(databases, databaseId, collection) {
  if (!collection?.$id) return collection;
  try {
    const fresh = normalizeCollection(await databases.getCollection(databaseId, collection.$id));
    if (!fresh) return collection;
    return normalizeCollection({
      ...collection,
      ...fresh,
      name: collection.name || fresh.name,
      attributes: fresh.attributes || collection.attributes,
    });
  } catch (err) {
    console.error(`[${collection.name}] getCollection failed:`, err?.message || err);
    return collection;
  }
}

// GET /api/database-stats
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);

    // Page through every collection. The default page is 25, so a rebuilt
    // sitevisit past that page never replaced the row the settings list showed.
    let allCollections = await listEveryCollection(databases, databaseId);
    const tableNames = Object.keys(TABLE_SCHEMAS);
    const missingNames = tableNames.filter((name) => !pickNamedCollection(allCollections, name));
    if (missingNames.length > 0) {
      const named = await listCollectionsNamed(databases, databaseId, missingNames);
      if (named.length > 0) allCollections = allCollections.concat(named);
    }
    const stillMissing = tableNames.filter((name) => !pickNamedCollection(allCollections, name));
    if (stillMissing.length > 0) {
      const tables = await listTablesNamed(databases, databaseId, stillMissing);
      if (tables.length > 0) allCollections = allCollections.concat(tables);
    }

    // Get each collection's column count and document count dynamically
    const collectionsWithCounts = await Promise.all(
      tableNames.map(async (name) => {
        const listed = pickNamedCollection(allCollections, name);
        const collection = await freshCollection(databases, databaseId, listed);
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
            readError: err?.message || String(err),
            schemaMismatch: !compareSchema(expectedSchema, actualSchema, name),
          });
        }
      })
    );

    // 動態計算總欄位數
    const totalColumns = collectionsWithCounts.reduce((sum, col) => sum + col.columnCount, 0);

    const body = {
      totalColumns,
      totalCollections: tableNames.length,
      collections: collectionsWithCounts,
      databaseId
    };
    if (searchParams.get("debug") === "1") {
      body.lookup = await explainLookup(databases, databaseId);
    }
    return NextResponse.json(body);
  } catch (err) {
    console.error("GET /api/database-stats error:", err);
    return NextResponse.json(
      { error: err.message }, 
      { status: 500 }
    );
  }
}
