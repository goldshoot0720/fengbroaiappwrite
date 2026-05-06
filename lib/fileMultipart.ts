import { assertClientStorageQuota, uploadToAppwriteStorage } from "@/lib/appwriteStorage";
import { getAppwriteDownloadUrl, getProxiedMediaUrl } from "@/lib/utils";

export const MULTIPART_UPLOAD_THRESHOLD = 50 * 1024 * 1024;
export const MULTIPART_FILE_PART_SIZE = 25 * 1024 * 1024;
export const MULTIPART_FILE_SUFFIX = "+part";
const MANIFEST_TYPE = "fengbro-file-manifest";

export interface FilePartManifestEntry {
  index: number;
  name: string;
  fileId: string;
  url: string;
  size: number;
}

export interface FilePartManifest {
  version: 1;
  type: typeof MANIFEST_TYPE;
  originalName: string;
  originalType: string;
  originalExtension: string;
  originalSize: number;
  partSize: number;
  parts: FilePartManifestEntry[];
}

export interface MultipartFileResult {
  url: string;
  fileId: string;
  filetype: string;
  manifest: FilePartManifest;
}

export interface MultipartBlobSource {
  file?: string | null;
  filetype?: string | null;
  name?: string | null;
}

function isFilePartManifest(value: unknown): value is FilePartManifest {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<FilePartManifest>;
  return candidate.type === MANIFEST_TYPE && Array.isArray(candidate.parts);
}

function sanitizeBaseName(fileName: string): string {
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "") || "file";
  return nameWithoutExt.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function getFileExtensionFromName(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() || "bin";
}

function getFileExtension(file: File): string {
  return getFileExtensionFromName(file.name);
}

function buildPartFileName(file: File, partIndex: number, totalParts: number): string {
  const baseName = sanitizeBaseName(file.name);
  const ext = getFileExtension(file);
  const partLabel = String(partIndex + 1).padStart(String(totalParts).length, "0");
  return `${baseName}.PART${partLabel}.${ext}`;
}

function buildManifestFileName(file: File): string {
  const baseName = sanitizeBaseName(file.name);
  return `${baseName}.manifest.json`;
}

export function isMultipartFiletype(filetype?: string | null): boolean {
  return typeof filetype === "string" && filetype.endsWith(MULTIPART_FILE_SUFFIX);
}

export function getOriginalMultipartFiletype(filetype?: string | null): string {
  if (!filetype) return "bin";
  return filetype.replace(/\+part$/, "") || "bin";
}

export function buildMultipartFiletype(filetype?: string | null): string {
  return `${getOriginalMultipartFiletype(filetype)}${MULTIPART_FILE_SUFFIX}`;
}

export function getMultipartDownloadFilename(
  source: MultipartBlobSource,
  manifest?: FilePartManifest
): string {
  const fallbackName = source.name?.trim() || manifest?.originalName || "download";
  if (/\.[a-z0-9]+$/i.test(fallbackName)) {
    return fallbackName;
  }

  const ext = manifest?.originalExtension || getOriginalMultipartFiletype(source.filetype);
  return `${fallbackName}.${ext || "bin"}`;
}

export async function uploadFileInParts(
  file: File,
  onProgress?: (progress: number) => void
): Promise<MultipartFileResult> {
  await assertClientStorageQuota(file.size);

  const totalParts = Math.ceil(file.size / MULTIPART_FILE_PART_SIZE);
  const parts: FilePartManifestEntry[] = [];
  let uploadedBytes = 0;

  for (let index = 0; index < totalParts; index += 1) {
    const start = index * MULTIPART_FILE_PART_SIZE;
    const end = Math.min(start + MULTIPART_FILE_PART_SIZE, file.size);
    const chunkBlob = file.slice(start, end, file.type || "application/octet-stream");
    const chunkFile = new File(
      [chunkBlob],
      buildPartFileName(file, index, totalParts),
      { type: file.type || "application/octet-stream" }
    );

    const uploadResult = await uploadToAppwriteStorage(chunkFile, (partProgress) => {
      const currentUploadedBytes = uploadedBytes + (chunkBlob.size * partProgress) / 100;
      const overall = Math.round((currentUploadedBytes / file.size) * 95);
      onProgress?.(Math.min(overall, 95));
    });

    uploadedBytes += chunkBlob.size;
    parts.push({
      index,
      name: chunkFile.name,
      fileId: uploadResult.fileId,
      url: uploadResult.url,
      size: chunkBlob.size,
    });
  }

  const manifest: FilePartManifest = {
    version: 1,
    type: MANIFEST_TYPE,
    originalName: file.name,
    originalType: file.type || "application/octet-stream",
    originalExtension: getFileExtension(file),
    originalSize: file.size,
    partSize: MULTIPART_FILE_PART_SIZE,
    parts,
  };

  const manifestBlob = new Blob([JSON.stringify(manifest)], { type: "application/json" });
  const manifestFile = new File([manifestBlob], buildManifestFileName(file), { type: "application/json" });
  const manifestUpload = await uploadToAppwriteStorage(manifestFile, (progress) => {
    onProgress?.(95 + Math.round(progress * 0.05));
  });

  await fetchFilePartManifest(manifestUpload.url);
  onProgress?.(100);

  return {
    url: manifestUpload.url,
    fileId: manifestUpload.fileId,
    filetype: buildMultipartFiletype(getFileExtension(file)),
    manifest,
  };
}

export async function fetchFilePartManifest(manifestUrl: string): Promise<FilePartManifest> {
  const response = await fetch(getProxiedMediaUrl(getAppwriteDownloadUrl(manifestUrl)), {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`無法讀取分段檔案資訊: HTTP ${response.status}`);
  }

  const rawText = await response.text();
  let manifest: unknown;

  try {
    manifest = JSON.parse(rawText);
  } catch {
    throw new Error("分段檔案資訊格式錯誤，無法合併下載");
  }

  if (!isFilePartManifest(manifest)) {
    throw new Error("分段檔案資訊不完整，無法合併下載");
  }

  return manifest;
}

export async function resolveMultipartFileBlob(
  source: MultipartBlobSource,
  onProgress?: (progress: number) => void
): Promise<{ blob: Blob; fileName: string; filetype: string }> {
  const fileUrl = source.file || "";
  const filetype = getOriginalMultipartFiletype(source.filetype);

  if (!fileUrl) {
    throw new Error("找不到檔案下載網址");
  }

  if (!isMultipartFiletype(source.filetype)) {
    const response = await fetch(getProxiedMediaUrl(getAppwriteDownloadUrl(fileUrl)));
    if (!response.ok) {
      throw new Error(`下載檔案失敗: HTTP ${response.status}`);
    }
    const blob = await response.blob();
    onProgress?.(100);
    return {
      blob,
      fileName: getMultipartDownloadFilename(source),
      filetype,
    };
  }

  const manifest = await fetchFilePartManifest(fileUrl);
  const partBlobs: Blob[] = [];
  let loadedBytes = 0;
  const totalBytes =
    manifest.originalSize || manifest.parts.reduce((sum, part) => sum + (part.size || 0), 0);

  for (const part of manifest.parts) {
    const response = await fetch(getProxiedMediaUrl(getAppwriteDownloadUrl(part.url)));
    if (!response.ok) {
      throw new Error(`下載分段檔案失敗: HTTP ${response.status}`);
    }

    const blob = await response.blob();
    partBlobs.push(blob);
    loadedBytes += blob.size;

    if (totalBytes > 0) {
      onProgress?.(Math.min(100, Math.round((loadedBytes / totalBytes) * 100)));
    }
  }

  return {
    blob: new Blob(partBlobs, { type: manifest.originalType || "application/octet-stream" }),
    fileName: getMultipartDownloadFilename(source, manifest),
    filetype: manifest.originalExtension || filetype,
  };
}
