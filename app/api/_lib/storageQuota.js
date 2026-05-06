const sdk = require('node-appwrite');

export const STORAGE_UPLOAD_LIMIT_BYTES = Math.floor(1.8 * 1024 * 1024 * 1024);

export function formatStorageSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function buildStorageQuotaError(currentSize, incomingSize = 0) {
  const projectedSize = currentSize + incomingSize;
  return `File Storage 已達 ${formatStorageSize(currentSize)}，上傳後將達 ${formatStorageSize(projectedSize)}，超過 1.8GB 上限，已停止上傳。請先手動刪除 Appwrite Storage 檔案，直到容量低於 1.8GB 以下再重新上傳。`;
}

export async function getBucketStorageSize(storage, bucketId) {
  let totalSize = 0;
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await storage.listFiles(bucketId, [
      sdk.Query.limit(limit),
      sdk.Query.offset(offset),
    ]);

    response.files.forEach((file) => {
      totalSize += file.sizeOriginal || 0;
    });

    if (response.files.length < limit) break;
    offset += limit;
  }

  return totalSize;
}

export async function assertStorageQuotaAvailable(storage, bucketId, incomingSize) {
  const currentSize = await getBucketStorageSize(storage, bucketId);

  if (currentSize >= STORAGE_UPLOAD_LIMIT_BYTES || currentSize + incomingSize > STORAGE_UPLOAD_LIMIT_BYTES) {
    const error = new Error(buildStorageQuotaError(currentSize, incomingSize));
    error.status = 413;
    throw error;
  }

  return currentSize;
}
