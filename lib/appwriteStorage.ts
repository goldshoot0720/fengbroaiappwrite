import { Client, Storage } from 'appwrite';
import { getAppwriteConfig } from './utils';

export const STORAGE_UPLOAD_LIMIT_BYTES = Math.floor(1.8 * 1024 * 1024 * 1024);

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function getStorageQuotaMessage(currentSize: number, incomingSize: number): string {
  return `File Storage 已達 ${formatFileSize(currentSize)}，上傳後將達 ${formatFileSize(currentSize + incomingSize)}，超過 1.8GB 上限，已停止上傳。請先手動刪除 Appwrite Storage 檔案，直到容量低於 1.8GB 以下再重新上傳。`;
}

export async function assertClientStorageQuota(incomingSize: number): Promise<void> {
  const config = getAppwriteConfig();
  const params = new URLSearchParams();

  if (config.endpoint) params.set('_endpoint', config.endpoint);
  if (config.projectId) params.set('_project', config.projectId);
  if (config.databaseId) params.set('_database', config.databaseId);
  if (config.apiKey) params.set('_key', config.apiKey);
  if (config.bucketId) params.set('_bucket', config.bucketId);

  const response = await fetch(`/api/storage-stats?${params.toString()}`, { cache: 'no-store' });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || '無法確認 File Storage 容量，為避免超過 1.8GB，已停止上傳。請先確認 Appwrite 設定與容量。');
  }

  const currentSize = Number(data?.stats?.totalSize || 0);
  if (currentSize >= STORAGE_UPLOAD_LIMIT_BYTES || currentSize + incomingSize > STORAGE_UPLOAD_LIMIT_BYTES) {
    throw new Error(getStorageQuotaMessage(currentSize, incomingSize));
  }
}

function getUploadErrorMessage(error: any, file: File): string {
  const rawMessage =
    typeof error?.message === 'string'
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Upload to Appwrite Storage failed';

  const normalizedMessage = rawMessage.toLowerCase();

  if (
    normalizedMessage.includes('above the limit allowed for your plan') ||
    normalizedMessage.includes('file size not allowed') ||
    normalizedMessage.includes('maximum allowed size')
  ) {
    return `檔案「${file.name}」大小為 ${formatFileSize(file.size)}，已超過目前 Appwrite 方案的單檔上傳限制。請改傳較小的檔案，或到 Appwrite Console 升級方案後再試。`;
  }

  return rawMessage;
}

function uploadThroughServerApi(
  file: File,
  onProgress?: (progress: number) => void
): Promise<{ url: string; fileId: string }> {
  const config = getAppwriteConfig();
  const formData = new FormData();
  formData.append('file', file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload-music');

    if (config.endpoint) xhr.setRequestHeader('x-appwrite-endpoint', config.endpoint);
    if (config.projectId) xhr.setRequestHeader('x-appwrite-project', config.projectId);
    if (config.apiKey) xhr.setRequestHeader('x-appwrite-key', config.apiKey);
    if (config.bucketId) xhr.setRequestHeader('x-appwrite-bucket', config.bucketId);

    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) return;
      onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };

    xhr.onload = () => {
      let payload: any = null;
      try {
        payload = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        payload = null;
      }

      if (xhr.status >= 200 && xhr.status < 300 && payload?.url && payload?.fileId) {
        onProgress?.(100);
        resolve({ url: payload.url, fileId: payload.fileId });
        return;
      }

      reject(new Error(payload?.error || `上傳失敗（HTTP ${xhr.status}）`));
    };

    xhr.onerror = () => {
      reject(new Error('上傳連線失敗，請確認網路與 Appwrite 設定。'));
    };

    xhr.onabort = () => {
      reject(new Error('上傳已取消。'));
    };

    xhr.send(formData);
  });
}

/**
 * Create Appwrite client for direct storage uploads
 */
export function createAppwriteClient() {
  const config = getAppwriteConfig();
  
  if (!config.endpoint || !config.projectId) {
    throw new Error('Appwrite configuration is missing. Please configure in Settings.');
  }

  const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId);

  return client;
}

/**
 * Upload file directly to Appwrite Storage (client-side)
 * This bypasses Next.js API routes and avoids 4MB body size limit
 * 
 * @param file - File to upload
 * @param onProgress - Optional progress callback (0-100)
 * @returns Object with url and fileId
 */
export async function uploadToAppwriteStorage(
  file: File,
  onProgress?: (progress: number) => void
): Promise<{ url: string; fileId: string }> {
  const config = getAppwriteConfig();
  
  if (!config.bucketId) {
    throw new Error('Bucket ID is missing. Please configure in Settings.');
  }

  await assertClientStorageQuota(file.size);

  try {
    // Browser direct upload can be blocked by Appwrite CORS settings.
    // Route through our same-origin API so uploads work even before CORS is configured.
    return await uploadThroughServerApi(file, onProgress);
  } catch (error: any) {
    console.error('[uploadToAppwriteStorage] Error:', error);
    throw new Error(getUploadErrorMessage(error, file));
  }
}

/**
 * Delete file from Appwrite Storage
 * 
 * @param fileId - File ID to delete
 */
export async function deleteFromAppwriteStorage(fileId: string): Promise<void> {
  const config = getAppwriteConfig();
  
  if (!config.bucketId) {
    throw new Error('Bucket ID is missing. Please configure in Settings.');
  }

  const client = createAppwriteClient();
  const storage = new Storage(client);

  try {
    await storage.deleteFile(config.bucketId, fileId);
  } catch (error: any) {
    console.error('[deleteFromAppwriteStorage] Error:', error);
    throw new Error(error.message || 'Delete from Appwrite Storage failed');
  }
}

/**
 * Get file preview URL from Appwrite Storage
 * 
 * @param fileId - File ID
 * @returns Preview URL
 */
export function getAppwriteFileUrl(fileId: string): string {
  const config = getAppwriteConfig();
  
  if (!config.endpoint || !config.bucketId || !config.projectId) {
    return '';
  }

  return `${config.endpoint}/storage/buckets/${config.bucketId}/files/${fileId}/view?project=${config.projectId}`;
}
