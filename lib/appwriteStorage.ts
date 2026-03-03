import { Client, Storage, ID, Permission, Role } from 'appwrite';
import { getAppwriteConfig } from './utils';

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

  const client = createAppwriteClient();
  const storage = new Storage(client);

  try {
    // Generate unique file ID
    const fileId = ID.unique();

    // Upload file with progress tracking and public read permissions
    const response = await storage.createFile(
      config.bucketId,
      fileId,
      file,
      [Permission.read(Role.any())], // Public read access
      onProgress ? (progress) => {
        // Appwrite progress callback receives upload progress
        const percentage = Math.min(100, Math.round(progress.progress || 0));
        onProgress(percentage);
      } : undefined
    );

    // Construct file URL with project parameter for public access
    const fileUrl = `${config.endpoint}/storage/buckets/${config.bucketId}/files/${response.$id}/view?project=${config.projectId}`;

    return {
      url: fileUrl,
      fileId: response.$id
    };
  } catch (error: any) {
    console.error('[uploadToAppwriteStorage] Error:', error);
    throw new Error(error.message || 'Upload to Appwrite Storage failed');
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
