import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Configure Next.js body size limit (must be set via route segment config)
// Note: For form data, Next.js reads it natively so we don't need extra config.

function getAppwriteConfig(headers) {
  const endpoint = headers.get('x-appwrite-endpoint') || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '';
  const projectId = headers.get('x-appwrite-project') || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '';
  const apiKey = headers.get('x-appwrite-key') || process.env.APPWRITE_API_KEY || process.env.NEXT_PUBLIC_APPWRITE_API_KEY || '';
  const bucketId = headers.get('x-appwrite-bucket') || process.env.APPWRITE_BUCKET_ID || process.env.NEXT_PUBLIC_APPWRITE_BUCKET_ID || '';

  return { endpoint, projectId, apiKey, bucketId };
}

// POST /api/upload-image - Upload image to Appwrite Storage via REST API
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

    // 生成唯一 file ID (Appwrite 格式: 唯一字元串)
    const fileId = generateUniqueId();

    // 讀取檔案 buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 建立 multipart/form-data 發送到 Appwrite REST API
    const uploadFormData = new FormData();
    const blob = new Blob([buffer], { type: file.type });
    uploadFormData.append('fileId', fileId);
    uploadFormData.append('file', blob, file.name);

    // 設定 Appwrite REST API URL
    const baseEndpoint = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
    const uploadUrl = `${baseEndpoint}/storage/buckets/${bucketId}/files`;

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'X-Appwrite-Project': projectId,
        'X-Appwrite-Key': apiKey,
      },
      body: uploadFormData,
    });

    if (!uploadResponse.ok) {
      let errMsg = '上傳失敗';
      try {
        const errData = await uploadResponse.json();
        errMsg = errData.message || errData.error || errMsg;
      } catch { }
      console.error('[upload-image] Appwrite upload error:', uploadResponse.status, errMsg);
      return NextResponse.json({ error: errMsg }, { status: uploadResponse.status });
    }

    const uploadedFile = await uploadResponse.json();
    const fileUrl = `${baseEndpoint}/storage/buckets/${bucketId}/files/${uploadedFile.$id}/view?project=${projectId}`;

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

// 生成 Appwrite 相容的唯一 ID (20個字元英數字)
function generateUniqueId() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 20; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
