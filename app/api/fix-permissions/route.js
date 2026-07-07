import { NextResponse } from 'next/server';
const sdk = require('node-appwrite');

/**
 * POST /api/fix-permissions
 * Fix permissions for Appwrite Storage files uploaded without public access
 * 
 * Request body: { fileIds: string[] } or { fileId: string }
 */
export async function POST(request) {
  try {
    const appwriteConfig = {
      endpoint: request.headers.get('x-appwrite-endpoint'),
      projectId: request.headers.get('x-appwrite-project'),
      apiKey: request.headers.get('x-appwrite-key'),
      bucketId: request.headers.get('x-appwrite-bucket'),
    };

    if (!appwriteConfig.endpoint || !appwriteConfig.projectId || !appwriteConfig.apiKey || !appwriteConfig.bucketId) {
      return NextResponse.json({ error: 'Missing Appwrite configuration' }, { status: 400 });
    }

    const client = new sdk.Client()
      .setEndpoint(appwriteConfig.endpoint)
      .setProject(appwriteConfig.projectId)
      .setKey(appwriteConfig.apiKey);

    const storage = new sdk.Storage(client);

    const body = await request.json();
    const fileIds = body.fileIds || (body.fileId ? [body.fileId] : []);

    if (fileIds.length === 0) {
      return NextResponse.json({ error: 'No file IDs provided' }, { status: 400 });
    }

    const results = [];
    const errors = [];

    for (const fileId of fileIds) {
      try {
        // Update file to add public read permission
        await storage.updateFile(
          appwriteConfig.bucketId,
          fileId,
          undefined, // name (optional)
          [sdk.Permission.read(sdk.Role.any())] // Add public read permission
        );
        
        results.push({ fileId, status: 'success' });
      } catch (error) {
        errors.push({ 
          fileId, 
          status: 'error', 
          message: error.message || 'Unknown error' 
        });
      }
    }

    return NextResponse.json({
      success: true,
      fixed: results.length,
      failed: errors.length,
      results,
      errors
    });

  } catch (error) {
    console.error('POST /api/fix-permissions error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to fix permissions' 
    }, { status: 500 });
  }
}
