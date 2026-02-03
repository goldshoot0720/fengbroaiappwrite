import { NextResponse } from "next/server";

const sdk = require('node-appwrite');

export const dynamic = 'force-dynamic';

// Import table schemas from create-table
const TABLE_SCHEMAS = {
  article: [
    { key: 'title', type: 'string', size: 100 },
    { key: 'content', type: 'string', size: 1000 },
    { key: 'newDate', type: 'datetime' },
    { key: 'url1', type: 'url' },
    { key: 'url2', type: 'url' },
    { key: 'url3', type: 'url' },
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
  // Add other schemas as needed
};

function createAppwrite(searchParams) {
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

// POST /api/update-schema - Analyze and update table schema
export async function POST(request) {
  try {
    const { tableName } = await request.json();
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);

    const expectedSchema = TABLE_SCHEMAS[tableName];
    if (!expectedSchema) {
      return NextResponse.json(
        { success: false, error: `Unknown table: ${tableName}` },
        { status: 400 }
      );
    }

    // Get all collections with this name
    const allCollections = await databases.listCollections(databaseId);
    const existingCollections = allCollections.collections.filter(col => col.name === tableName);

    if (existingCollections.length === 0) {
      return NextResponse.json({
        success: false,
        action: 'create',
        message: `Table ${tableName} does not exist. Please create it first.`
      });
    }

    // Use the most recently updated collection
    const collection = existingCollections.reduce((latest, col) => 
      col.$updatedAt > latest.$updatedAt ? col : latest
    );

    const actualAttributes = (collection.attributes || []).filter(attr => 
      attr.status === 'available' || !attr.status
    );

    // Analyze differences
    const analysis = analyzeSchema(expectedSchema, actualAttributes);

    if (analysis.canAutoUpdate) {
      // Try to auto-update
      const updateResult = await autoUpdateSchema(
        databases, 
        databaseId, 
        collection.$id, 
        analysis.changes
      );
      
      return NextResponse.json({
        success: true,
        action: 'updated',
        changes: analysis.changes,
        message: `Successfully updated ${tableName} schema`
      });
    } else {
      // Cannot auto-update, return analysis for manual action
      return NextResponse.json({
        success: false,
        action: 'manual',
        analysis,
        message: `Cannot automatically update ${tableName}. Manual rebuild required.`,
        details: analysis.issues
      });
    }

  } catch (err) {
    console.error("POST /api/update-schema error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

// Analyze schema differences
function analyzeSchema(expected, actual) {
  const actualMap = {};
  actual.forEach(attr => {
    actualMap[attr.key] = attr;
  });

  const changes = {
    toAdd: [],      // New attributes to add
    toUpdate: [],   // Attributes that can be updated
    toRemove: [],   // Extra attributes (not in expected)
    conflicts: []   // Attributes with incompatible changes
  };

  // Check expected attributes
  expected.forEach(exp => {
    const act = actualMap[exp.key];
    
    if (!act) {
      // Attribute missing - can add
      changes.toAdd.push({
        key: exp.key,
        type: exp.type,
        size: exp.size,
        action: 'create'
      });
    } else {
      // Attribute exists - check for differences
      if (exp.type !== act.type) {
        // Type mismatch - cannot auto-update
        changes.conflicts.push({
          key: exp.key,
          issue: 'type_mismatch',
          expected: exp.type,
          actual: act.type,
          message: `Cannot change type from ${act.type} to ${exp.type}`
        });
      } else if (exp.size && act.size && exp.size !== act.size) {
        if (exp.size > act.size) {
          // Can increase size
          changes.toUpdate.push({
            key: exp.key,
            type: exp.type,
            oldSize: act.size,
            newSize: exp.size,
            action: 'update_size'
          });
        } else {
          // Cannot decrease size (data loss risk)
          changes.conflicts.push({
            key: exp.key,
            issue: 'size_decrease',
            expected: exp.size,
            actual: act.size,
            message: `Cannot decrease size from ${act.size} to ${exp.size} (data loss risk)`
          });
        }
      }
    }
  });

  // Check for extra attributes
  actual.forEach(act => {
    const exp = expected.find(e => e.key === act.key);
    if (!exp) {
      changes.toRemove.push({
        key: act.key,
        type: act.type,
        message: `Extra attribute not in expected schema`
      });
    }
  });

  const canAutoUpdate = changes.conflicts.length === 0 && changes.toRemove.length === 0;
  const hasChanges = changes.toAdd.length > 0 || changes.toUpdate.length > 0;

  return {
    canAutoUpdate,
    hasChanges,
    changes,
    issues: changes.conflicts.concat(changes.toRemove.map(r => ({
      key: r.key,
      issue: 'extra_attribute',
      message: r.message
    })))
  };
}

// Auto-update schema
async function autoUpdateSchema(databases, databaseId, collectionId, changes) {
  const results = [];

  // Add missing attributes
  for (const change of changes.toAdd) {
    try {
      switch (change.type) {
        case 'string':
          await databases.createStringAttribute(databaseId, collectionId, change.key, change.size, false);
          break;
        case 'integer':
          await databases.createIntegerAttribute(databaseId, collectionId, change.key, false);
          break;
        case 'url':
          await databases.createUrlAttribute(databaseId, collectionId, change.key, false);
          break;
        case 'datetime':
          await databases.createDatetimeAttribute(databaseId, collectionId, change.key, false);
          break;
        case 'boolean':
          await databases.createBooleanAttribute(databaseId, collectionId, change.key, false);
          break;
      }
      results.push({ key: change.key, success: true, action: 'created' });
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (err) {
      results.push({ key: change.key, success: false, error: err.message });
    }
  }

  // Update attribute sizes (if Appwrite supports it)
  for (const change of changes.toUpdate) {
    try {
      // Note: Appwrite may not support updating attribute size directly
      // This might require deleting and recreating the attribute
      await databases.updateStringAttribute(databaseId, collectionId, change.key, change.newSize, false);
      results.push({ key: change.key, success: true, action: 'updated' });
    } catch (err) {
      results.push({ 
        key: change.key, 
        success: false, 
        error: err.message,
        note: 'Size update may require manual rebuild'
      });
    }
  }

  return results;
}
