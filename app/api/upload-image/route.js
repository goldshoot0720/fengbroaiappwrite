import { NextResponse } from "next/server";

const sdk = require('node-appwrite');

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

function getAppwriteConfig(headers) {
  const endpoint = headers.get('x-appwrite-endpoint') || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '';
  const projectId = headers.get('x-appwrite-project') || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '';
  const apiKey = headers.get('x-appwrite-key') || process.env.APPWRITE_API_KEY || process.env.NEXT_PUBLIC_APPWRITE_API_KEY || '';
  const bucketId = headers.get('x-appwrite-bucket') || process.env.APPWRITE_BUCKET_ID || process.env.NEXT_PUBLIC_APPWRITE_BUCKET_ID || '';

  return { endpoint, projectId, apiKey, bucketId };
}

// POST /api/upload-image - Upload image to Appwrite Storage via node-appwrite SDK
export async function POST(request) {
  try {
    const config = getAppwriteConfig(request.headers);
    const { endpoint, projectId, apiKey, bucketId } = config;

    if (!endpoint || !projectId || !apiKey || !bucketId) {
      const missing = [];
      if (!endpoint) missing.push('endpoint');
      if (!projectId) missing.push('projectId');
      if (!apiKey) missing.push('apiKey');
      if (!bucketId) missing.push('bucketId');
      console.error('[upload-image] Missing config:', missing);
      return NextResponse.json(
        { error: `Appwrite 設定缺少: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // 檔案大小檢查 (50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: '檔案大小不能超過 50MB' }, { status: 400 });
    }

    // 檔案類型檢查
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: '只支援 JPG, PNG, GIF, WEBP 格式' }, { status: 400 });
    }

    // 讀取檔案 buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 使用 node-appwrite SDK 上傳（與 upload-music 相同的方式）
    const client = new sdk.Client()
      .setEndpoint(endpoint)
      .setProject(projectId)
      .setKey(apiKey);

    const storage = new sdk.Storage(client);
    const fileObject = new File([buffer], file.name, { type: file.type });
    const uploadedFile = await storage.createFile(
      bucketId,
      sdk.ID.unique(),
      fileObject
    );

    const fileUrl = `${endpoint}/storage/buckets/${bucketId}/files/${uploadedFile.$id}/view?project=${projectId}`;

    return NextResponse.json({
      success: true,
      fileId: uploadedFile.$id,
      url: fileUrl,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    });

  } catch (err) {
    console.error('[upload-image] Unexpected error:', err);
    return NextResponse.json({ error: err.message || '上傳失敗' }, { status: 500 });
  }
}
