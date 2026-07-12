import { NextResponse } from "next/server";
import { assertStorageQuotaAvailable } from "../_lib/storageQuota";
import { createAppwrite } from "../_lib/appwriteClient";

const sdk = require('node-appwrite');

export const dynamic = 'force-dynamic';

// Configure body size limit for file uploads (50MB)
export const bodyParser = {
  sizeLimit: '50mb'
};

// POST /api/upload-video - Upload video to Appwrite Storage
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
    await assertStorageQuotaAvailable(storage, bucketId, file.size);

    const validTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: '只支援 MP4, WebM, OGG, MOV 格式' }, { status: 400 });
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
    console.error("POST /api/upload-video error:", err);
    return NextResponse.json({ error: err.message || '上傳失敗' }, { status: err.status || 500 });
  }
}
