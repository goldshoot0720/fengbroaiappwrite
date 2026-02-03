import { NextResponse } from "next/server";

const sdk = require('node-appwrite');

export const dynamic = 'force-dynamic';

// Configure body size limit for file uploads (50MB)
export const bodyParser = {
  sizeLimit: '50mb'
};

function createAppwrite(config) {
  const endpoint = config?.endpoint || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId = config?.projectId || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const apiKey = config?.apiKey || process.env.NEXT_PUBLIC_APPWRITE_API_KEY;
  const bucketId = config?.bucketId || process.env.NEXT_PUBLIC_APPWRITE_BUCKET_ID;

  if (!endpoint || !projectId || !apiKey || !bucketId) {
    throw new Error("Appwrite configuration is missing");
  }

  const client = new sdk.Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

  const storage = new sdk.Storage(client);

  return { storage, bucketId, endpoint, projectId };
}

// POST /api/upload-podcast - Upload audio or video files to Appwrite Storage
export async function POST(request) {
  try {
    const appwriteConfig = {
      endpoint: request.headers.get('x-appwrite-endpoint'),
      projectId: request.headers.get('x-appwrite-project'),
      apiKey: request.headers.get('x-appwrite-key'),
      bucketId: request.headers.get('x-appwrite-bucket'),
    };

    const { storage, bucketId, endpoint, projectId } = createAppwrite(appwriteConfig);
    
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // 檢查檔案大小 (50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: '檔案大小不能超過 50MB' }, { status: 400 });
    }

    // 檢查檔案類型
    const validTypes = [
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/flac', 'audio/m4a', 'audio/x-m4a', 'audio/mp4',
      'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'
    ];
    
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: '只支援音訊 (MP3, WAV, OGG, AAC, FLAC, M4A) 或影片 (MP4, WebM, MOV) 格式' }, { status: 400 });
    }

    // 讀取檔案內容
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 上傳到 Appwrite Storage
    const fileObject = new File([buffer], file.name, { type: file.type });
    const uploadedFile = await storage.createFile(
      bucketId,
      sdk.ID.unique(),
      fileObject
    );

    // 獲取檔案 URL
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
    console.error("POST /api/upload-podcast error:", err);
    return NextResponse.json({ error: err.message || '上傳失敗' }, { status: 500 });
  }
}
