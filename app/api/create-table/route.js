import { NextResponse } from "next/server";

const sdk = require('node-appwrite');

export const dynamic = 'force-dynamic';

// Table schemas definition
const TABLE_SCHEMAS = {
  commonaccount: {
    name: "commonaccount",
    attributes: [
      { key: 'name', type: 'string', size: 100, required: true },
      ...Array.from({ length: 37 }, (_, i) => ({
        key: `site${(i + 1).toString().padStart(2, '0')}`,
        type: 'string',
        size: 100,
        required: false
      })),
      ...Array.from({ length: 37 }, (_, i) => ({
        key: `note${(i + 1).toString().padStart(2, '0')}`,
        type: 'string',
        size: 100,
        required: false
      }))
    ]
  },
  bank: {
    name: "bank",
    attributes: [
      { key: 'name', type: 'string', size: 100, required: true },
      { key: 'deposit', type: 'integer', required: false },
      { key: 'site', type: 'url', required: false },
      { key: 'address', type: 'string', size: 100, required: false },
      { key: 'withdrawals', type: 'integer', required: false },
      { key: 'transfer', type: 'integer', required: false },
      { key: 'activity', type: 'url', required: false },
      { key: 'card', type: 'string', size: 100, required: false },
      { key: 'account', type: 'string', size: 100, required: false }
    ]
  },
  article: {
    name: "article",
    attributes: [
      { key: 'title', type: 'string', size: 100, required: false },
      { key: 'content', type: 'string', size: 1000, required: false },
      { key: 'category', type: 'string', size: 100, required: false },
      { key: 'ref', type: 'string', size: 100, required: false },
      { key: 'newDate', type: 'datetime', required: false },
      { key: 'url1', type: 'url', required: false },
      { key: 'url2', type: 'url', required: false },
      { key: 'url3', type: 'url', required: false },
      { key: 'file1', type: 'string', size: 150, required: false },
      { key: 'file1name', type: 'string', size: 100, required: false },
      { key: 'file1type', type: 'string', size: 20, required: false },
      { key: 'file2', type: 'string', size: 150, required: false },
      { key: 'file2name', type: 'string', size: 100, required: false },
      { key: 'file2type', type: 'string', size: 20, required: false },
      { key: 'file3', type: 'string', size: 150, required: false },
      { key: 'file3name', type: 'string', size: 100, required: false },
      { key: 'file3type', type: 'string', size: 20, required: false }
    ]
  },
  food: {
    name: "food",
    attributes: [
      { key: 'name', type: 'string', size: 100, required: true },
      { key: 'amount', type: 'integer', required: false },
      { key: 'price', type: 'integer', required: false },
      { key: 'shop', type: 'string', size: 100, required: false },
      { key: 'todate', type: 'datetime', required: false },
      { key: 'photo', type: 'url', required: false },
      { key: 'photohash', type: 'string', size: 256, required: false }
    ]
  },
  subscription: {
    name: "subscription",
    attributes: [
      { key: 'name', type: 'string', size: 100, required: true },
      { key: 'site', type: 'url', required: false },
      { key: 'price', type: 'integer', required: false },
      { key: 'nextdate', type: 'datetime', required: false },
      { key: 'note', type: 'string', size: 100, required: false },
      { key: 'account', type: 'string', size: 100, required: false },
      { key: 'currency', type: 'string', size: 100, required: false },
      { key: 'continue', type: 'boolean', required: false, default: true }
    ]
  },
  image: {
    name: "image",
    attributes: [
      { key: 'name', type: 'string', size: 100, required: true },
      { key: 'file', type: 'string', size: 150, required: false },
      { key: 'note', type: 'string', size: 100, required: false },
      { key: 'ref', type: 'string', size: 100, required: false },
      { key: 'category', type: 'string', size: 100, required: false },
      { key: 'hash', type: 'string', size: 300, required: false },
      { key: 'cover', type: 'boolean', required: false, default: false }
    ]
  },
  video: {
    name: "video",
    attributes: [
      { key: 'name', type: 'string', size: 100, required: true },
      { key: 'file', type: 'string', size: 150, required: false },
      { key: 'note', type: 'string', size: 100, required: false },
      { key: 'ref', type: 'string', size: 100, required: false },
      { key: 'category', type: 'string', size: 100, required: false },
      { key: 'hash', type: 'string', size: 300, required: false },
      { key: 'cover', type: 'string', size: 150, required: false }
    ]
  },
  music: {
    name: "music",
    attributes: [
      { key: 'name', type: 'string', size: 100, required: true },
      { key: 'file', type: 'string', size: 150, required: false },
      { key: 'lyrics', type: 'string', size: 3337, required: false },
      { key: 'note', type: 'string', size: 100, required: false },
      { key: 'ref', type: 'string', size: 100, required: false },
      { key: 'category', type: 'string', size: 100, required: false },
      { key: 'hash', type: 'string', size: 300, required: false },
      { key: 'language', type: 'string', size: 100, required: false },
      { key: 'cover', type: 'string', size: 150, required: false }
    ]
  },
  podcast: {
    name: "podcast",
    attributes: [
      { key: 'name', type: 'string', size: 100, required: true },
      { key: 'file', type: 'string', size: 150, required: false },
      { key: 'note', type: 'string', size: 100, required: false },
      { key: 'ref', type: 'string', size: 100, required: false },
      { key: 'category', type: 'string', size: 100, required: false },
      { key: 'hash', type: 'string', size: 300, required: false },
      { key: 'cover', type: 'string', size: 150, required: false }
    ]
  },
  commondocument: {
    name: "commondocument",
    attributes: [
      { key: 'name', type: 'string', size: 100, required: true },
      { key: 'file', type: 'string', size: 150, required: false },
      { key: 'filetype', type: 'string', size: 20, required: false },
      { key: 'note', type: 'string', size: 100, required: false },
      { key: 'ref', type: 'string', size: 100, required: false },
      { key: 'category', type: 'string', size: 100, required: false },
      { key: 'hash', type: 'string', size: 300, required: false },
      { key: 'cover', type: 'string', size: 150, required: false }
    ]
  },
  routine: {
    name: "routine",
    attributes: [
      { key: 'name', type: 'string', size: 100, required: true },
      { key: 'note', type: 'string', size: 100, required: false },
      { key: 'lastdate1', type: 'datetime', required: false },
      { key: 'lastdate2', type: 'datetime', required: false },
      { key: 'lastdate3', type: 'datetime', required: false },
      { key: 'link', type: 'url', required: false },
      { key: 'photo', type: 'url', required: false }
    ]
  }
};

// Export schemas for other uses
export { TABLE_SCHEMAS };

// GET /api/create-table - SSE endpoint for progress streaming
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const tableName = searchParams.get('table');

  if (!tableName || !TABLE_SCHEMAS[tableName]) {
    return NextResponse.json({ error: 'Invalid table name' }, { status: 400 });
  }

  const schema = TABLE_SCHEMAS[tableName];
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // 從 URL 參數讀取 Appwrite 配置
        const endpoint = searchParams.get('_endpoint') || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
        const projectId = searchParams.get('_project') || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
        const databaseId = searchParams.get('_database') || process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
        const apiKey = searchParams.get('_key') || process.env.NEXT_PUBLIC_APPWRITE_API_KEY;

        if (!endpoint || !projectId || !databaseId || !apiKey) {
          send({ type: 'error', message: 'Missing Appwrite configuration' });
          controller.close();
          return;
        }

        const client = new sdk.Client()
          .setEndpoint(endpoint)
          .setProject(projectId)
          .setKey(apiKey);

        const databases = new sdk.Databases(client);

        // Check if collection exists and delete if rebuild is requested
        try {
          // List all collections to find any with matching name
          const allCollections = await databases.listCollections(databaseId);
          const existingCollections = allCollections.collections.filter(col => col.name === tableName);
          
          if (existingCollections.length > 0) {
            // Delete all existing collections with this name
            send({ type: 'progress', step: 'cleanup', message: `Found ${existingCollections.length} existing ${tableName} collection(s), deleting...` });
            
            for (const col of existingCollections) {
              try {
                await databases.deleteCollection(databaseId, col.$id);
                send({ type: 'progress', step: 'cleanup', message: `Deleted collection ${col.$id}` });
              } catch (delErr) {
                console.error(`Failed to delete collection ${col.$id}:`, delErr);
              }
            }
            
            // Wait a bit for Appwrite to process deletions
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (err) {
          send({ type: 'error', message: `Failed to check existing collections: ${err.message}` });
          controller.close();
          return;
        }

        // Send start message
        send({ type: 'start', tableName, totalColumns: schema.attributes.length });

        // Create collection
        send({ type: 'progress', step: 'collection', message: `Creating ${tableName} collection...` });
        const collection = await databases.createCollection(
          databaseId,
          sdk.ID.unique(),
          tableName,
          [
            sdk.Permission.read(sdk.Role.any()),
            sdk.Permission.create(sdk.Role.any()),
            sdk.Permission.update(sdk.Role.any()),
            sdk.Permission.delete(sdk.Role.any()),
          ]
        );

        const collectionId = collection.$id;
        send({ type: 'progress', step: 'collection', message: `Collection created (ID: ${collectionId})`, collectionId });

        // Create attributes
        const total = schema.attributes.length;
        for (let i = 0; i < total; i++) {
          const attr = schema.attributes[i];
          try {
            switch (attr.type) {
              case 'string':
                await databases.createStringAttribute(databaseId, collectionId, attr.key, attr.size, attr.required);
                break;
              case 'integer':
                await databases.createIntegerAttribute(databaseId, collectionId, attr.key, attr.required);
                break;
              case 'url':
                await databases.createUrlAttribute(databaseId, collectionId, attr.key, attr.required);
                break;
            case 'datetime':
                await databases.createDatetimeAttribute(databaseId, collectionId, attr.key, attr.required);
                break;
            case 'boolean':
                await databases.createBooleanAttribute(databaseId, collectionId, attr.key, attr.required, attr.default);
                break;
            }
            send({ 
              type: 'progress', 
              step: 'attribute', 
              current: i + 1, 
              total, 
              percent: Math.round(((i + 1) / total) * 100),
              attribute: attr.key,
              message: `Creating ${attr.key} (${i + 1}/${total})`
            });
            await new Promise(resolve => setTimeout(resolve, 150));
          } catch (err) {
            if (err.code !== 409) {
              send({ type: 'warning', attribute: attr.key, message: err.message });
            }
          }
        }

        // Complete
        send({ 
          type: 'complete', 
          success: true, 
          message: `${tableName} table created with ${total} columns`,
          collectionId 
        });
        controller.close();

      } catch (err) {
        send({ type: 'error', message: err.message });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// POST /api/create-table - Non-streaming endpoint (kept for backward compatibility)
export async function POST(request) {
  try {
    const { tableName } = await request.json();

    const schema = TABLE_SCHEMAS[tableName];
    if (!schema) {
      return NextResponse.json(
        { success: false, error: `Unknown table: ${tableName}` },
        { status: 400 }
      );
    }

    // 從 URL 參數讀取 Appwrite 配置
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('_endpoint') || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
    const projectId = searchParams.get('_project') || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
    const databaseId = searchParams.get('_database') || process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
    const apiKey = searchParams.get('_key') || process.env.NEXT_PUBLIC_APPWRITE_API_KEY;

    if (!endpoint || !projectId || !databaseId || !apiKey) {
      return NextResponse.json(
        { success: false, error: "Missing Appwrite configuration" },
        { status: 500 }
      );
    }

    const client = new sdk.Client()
      .setEndpoint(endpoint)
      .setProject(projectId)
      .setKey(apiKey);

    const databases = new sdk.Databases(client);

    // Delete all existing collections with this name
    try {
      const allCollections = await databases.listCollections(databaseId);
      const existingCollections = allCollections.collections.filter(col => col.name === tableName);
      
      for (const col of existingCollections) {
        try {
          await databases.deleteCollection(databaseId, col.$id);
          console.log(`Deleted existing collection ${col.$id} (${tableName})`);
        } catch (delErr) {
          console.error(`Failed to delete collection ${col.$id}:`, delErr);
        }
      }
      
      if (existingCollections.length > 0) {
        // Wait for deletions to complete
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (err) {
      console.error('Error checking/deleting existing collections:', err);
    }

    const collection = await databases.createCollection(
      databaseId,
      sdk.ID.unique(),
      tableName,
      [
        sdk.Permission.read(sdk.Role.any()),
        sdk.Permission.create(sdk.Role.any()),
        sdk.Permission.update(sdk.Role.any()),
        sdk.Permission.delete(sdk.Role.any()),
      ]
    );

    const collectionId = collection.$id;

    for (const attr of schema.attributes) {
      try {
        switch (attr.type) {
          case 'string':
            await databases.createStringAttribute(databaseId, collectionId, attr.key, attr.size, attr.required);
            break;
          case 'integer':
            await databases.createIntegerAttribute(databaseId, collectionId, attr.key, attr.required);
            break;
          case 'url':
            await databases.createUrlAttribute(databaseId, collectionId, attr.key, attr.required);
            break;
          case 'datetime':
            await databases.createDatetimeAttribute(databaseId, collectionId, attr.key, attr.required);
            break;
          case 'boolean':
            await databases.createBooleanAttribute(databaseId, collectionId, attr.key, attr.required, attr.default);
            break;
        }
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (err) {
        if (err.code !== 409) {
          console.error(`Failed to create ${attr.key}:`, err.message);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `${tableName} table created with ${schema.attributes.length} columns`,
      collectionId
    });

  } catch (err) {
    console.error("POST /api/create-table error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
