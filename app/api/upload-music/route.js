import { NextResponse } from "next/server";

const sdk = require('node-appwrite');

export const dynamic = 'force-dynamic';

// Configure body size limit for file uploads (50MB)
export const bodyParser = {
  sizeLimit: '50mb'
};

function createAppwrite(config) {
  // Use config from request headers (user input) or fallback to env (支援新舊兩種變數名)
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

// POST /api/upload-music - Upload audio and document files to Appwrite Storage
export async function POST(request) {
  try {
    // Get Appwrite config from headers (user input from localStorage)
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
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/flac', 'audio/m4a',
      'application/pdf', 'text/plain', 'text/markdown', 'text/x-markdown',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
      'application/zip', 'application/x-zip-compressed', // zip
      'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska' // video formats
    ];
    
    // 檢查副檔名 (用於 MIME type 不明確的情況，如 .md 檔案)
    const fileName = file.name.toLowerCase();
    const validExtensions = ['.mp3', '.wav', '.ogg', '.aac', '.flac', '.m4a', '.pdf', '.txt', '.md', '.docx', '.xlsx', '.pptx', '.zip', '.rar', '.7z', '.mp4', '.webm', '.mov', '.avi', '.mkv'];
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
    
    if (!validTypes.includes(file.type) && !hasValidExtension) {
      return NextResponse.json({ error: '只支援 MP3, WAV, OGG, AAC, FLAC, M4A, PDF, TXT, MD, DOCX, XLSX, PPTX, ZIP, MP4, WEBM, MOV, AVI, MKV 格式' }, { status: 400 });
    }

    // 讀取檔案內容
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 上傳到 Appwrite Storage
    // In node-appwrite v21, create File object with buffer
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
    console.error("POST /api/upload-music error:", err);
    return NextResponse.json({ error: err.message || '上傳失敗' }, { status: 500 });
  }
}
