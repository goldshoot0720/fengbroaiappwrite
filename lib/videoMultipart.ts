import { assertClientStorageQuota, uploadToAppwriteStorage } from "@/lib/appwriteStorage";
import { getAppwriteDownloadUrl, getProxiedMediaUrl } from "@/lib/utils";

// Keep each uploaded part comfortably below common Appwrite Cloud/bucket limits.
export const MAX_VIDEO_PART_SIZE = 20 * 1024 * 1024;
export const MULTIPART_VIDEO_SUFFIX = "+part";
const MANIFEST_TYPE = "fengbro-video-manifest";

export interface VideoPartManifestEntry {
  index: number;
  name: string;
  fileId: string;
  url: string;
  size: number;
}

export interface VideoPartManifest {
  version: 1;
  type: typeof MANIFEST_TYPE;
  originalName: string;
  originalType: string;
  originalExtension: string;
  originalSize: number;
  partSize: number;
  parts: VideoPartManifestEntry[];
}

export interface MultipartUploadResult {
  url: string;
  fileId: string;
  filetype: string;
  manifest: VideoPartManifest;
}

export interface VideoBlobSource {
  file?: string | null;
  filetype?: string | null;
  name?: string | null;
}

export interface MultipartVideoStream {
  cleanup: () => void;
  ready: Promise<void>;
  url: string;
}

function isVideoPartManifest(value: unknown): value is VideoPartManifest {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<VideoPartManifest>;
  return candidate.type === MANIFEST_TYPE && Array.isArray(candidate.parts);
}

export function isMultipartVideoFiletype(filetype?: string | null): boolean {
  return typeof filetype === "string" && filetype.endsWith(MULTIPART_VIDEO_SUFFIX);
}

export function getOriginalVideoFiletype(filetype?: string | null): string {
  if (!filetype) return "mp4";
  return filetype.replace(/\+part$/, "") || "mp4";
}

export function buildMultipartVideoFiletype(filetype?: string | null): string {
  return `${getOriginalVideoFiletype(filetype)}${MULTIPART_VIDEO_SUFFIX}`;
}

export function getVideoExtensionFromFile(file: File): string {
  return file.name.split(".").pop()?.toLowerCase() || "mp4";
}

export function getVideoDownloadFilename(source: VideoBlobSource, manifest?: VideoPartManifest): string {
  const fallbackName = source.name?.trim() || manifest?.originalName || "video";
  const hasExtension = /\.[a-z0-9]+$/i.test(fallbackName);
  if (hasExtension) return fallbackName;

  const ext = manifest?.originalExtension || getOriginalVideoFiletype(source.filetype);
  return `${fallbackName}.${ext || "mp4"}`;
}

function sanitizeBaseName(fileName: string): string {
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "") || "video";
  return nameWithoutExt.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function buildPartFileName(file: File, partIndex: number, totalParts: number): string {
  const baseName = sanitizeBaseName(file.name);
  const ext = getVideoExtensionFromFile(file);
  const partLabel = String(partIndex + 1).padStart(String(totalParts).length, "0");
  return `${baseName}.PART${partLabel}.${ext}`;
}

function buildManifestFileName(file: File): string {
  const baseName = sanitizeBaseName(file.name);
  return `${baseName}.manifest.json`;
}

export async function uploadVideoInParts(
  file: File,
  onProgress?: (progress: number) => void
): Promise<MultipartUploadResult> {
  await assertClientStorageQuota(file.size);

  const totalParts = Math.ceil(file.size / MAX_VIDEO_PART_SIZE);
  const parts: VideoPartManifestEntry[] = [];
  let uploadedBytes = 0;

  for (let index = 0; index < totalParts; index += 1) {
    const start = index * MAX_VIDEO_PART_SIZE;
    const end = Math.min(start + MAX_VIDEO_PART_SIZE, file.size);
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

  const manifest: VideoPartManifest = {
    version: 1,
    type: MANIFEST_TYPE,
    originalName: file.name,
    originalType: file.type || "video/mp4",
    originalExtension: getVideoExtensionFromFile(file),
    originalSize: file.size,
    partSize: MAX_VIDEO_PART_SIZE,
    parts,
  };

  const manifestBlob = new Blob([JSON.stringify(manifest)], { type: "application/json" });
  const manifestFile = new File([manifestBlob], buildManifestFileName(file), { type: "application/json" });
  const manifestUpload = await uploadToAppwriteStorage(manifestFile, (progress) => {
    onProgress?.(95 + Math.round(progress * 0.05));
  });

  // Verify that the uploaded manifest can be downloaded and parsed before
  // we save its URL into the video record. This prevents broken multipart
  // entries from being persisted.
  await fetchVideoPartManifestWithRetry(manifestUpload.url);

  onProgress?.(100);

  return {
    url: manifestUpload.url,
    fileId: manifestUpload.fileId,
    filetype: buildMultipartVideoFiletype(getVideoExtensionFromFile(file)),
    manifest,
  };
}

async function fetchVideoPartManifestWithRetry(manifestUrl: string): Promise<VideoPartManifest> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      return await fetchVideoPartManifest(manifestUrl);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => window.setTimeout(resolve, attempt * 500));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Manifest verification failed after upload");
}

export async function fetchVideoPartManifest(manifestUrl: string): Promise<VideoPartManifest> {
  const response = await fetch(getProxiedMediaUrl(getAppwriteDownloadUrl(manifestUrl)), {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Manifest 讀取失敗: HTTP ${response.status}`);
  }

  const rawText = await response.text();
  let manifest: unknown;

  try {
    manifest = JSON.parse(rawText);
  } catch {
    const preview = rawText.slice(0, 120).replace(/\s+/g, " ");
    throw new Error(`影片 manifest JSON 損壞或不是 JSON，請重新上傳影片: ${preview || "<empty>"}`);
  }

  if (!isVideoPartManifest(manifest)) {
    throw new Error("影片 manifest 格式不正確，請重新上傳影片");
  }

  return manifest;
}

function waitForSourceBufferUpdate(sourceBuffer: SourceBuffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const handleUpdateEnd = () => {
      sourceBuffer.removeEventListener("updateend", handleUpdateEnd);
      sourceBuffer.removeEventListener("error", handleError);
      resolve();
    };

    const handleError = () => {
      sourceBuffer.removeEventListener("updateend", handleUpdateEnd);
      sourceBuffer.removeEventListener("error", handleError);
      reject(new Error("影片串流寫入失敗"));
    };

    sourceBuffer.addEventListener("updateend", handleUpdateEnd, { once: true });
    sourceBuffer.addEventListener("error", handleError, { once: true });
  });
}

export async function createMultipartVideoStream(manifestUrl: string): Promise<MultipartVideoStream | null> {
  if (typeof window === "undefined" || typeof MediaSource === "undefined") {
    return null;
  }

  const manifest = await fetchVideoPartManifest(manifestUrl);
  const mimeType = manifest.originalType || "video/mp4";

  if (!MediaSource.isTypeSupported(mimeType)) {
    return null;
  }

  const mediaSource = new MediaSource();
  const objectUrl = URL.createObjectURL(mediaSource);
  const abortController = new AbortController();

  const ready = new Promise<void>((resolve, reject) => {
    let resolved = false;

    const resolveReady = () => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };

    const handleSourceOpen = async () => {
      mediaSource.removeEventListener("sourceopen", handleSourceOpen);

      try {
        const sourceBuffer = mediaSource.addSourceBuffer(mimeType);

        for (const [index, part] of manifest.parts.entries()) {
          const response = await fetch(
            getProxiedMediaUrl(getAppwriteDownloadUrl(part.url)),
            { signal: abortController.signal }
          );

          if (!response.ok) {
            throw new Error(`影片分段串流失敗: HTTP ${response.status}`);
          }

          const chunk = await response.arrayBuffer();
          sourceBuffer.appendBuffer(chunk);
          await waitForSourceBufferUpdate(sourceBuffer);

          if (index === 0) {
            resolveReady();
          }
        }

        if (mediaSource.readyState === "open") {
          mediaSource.endOfStream();
        }

        resolveReady();
      } catch (error) {
        if (abortController.signal.aborted) {
          reject(new Error("影片串流已取消"));
          return;
        }

        if (mediaSource.readyState === "open") {
          try {
            mediaSource.endOfStream("network");
          } catch {}
        }

        reject(error instanceof Error ? error : new Error("影片串流初始化失敗"));
      }
    };

    mediaSource.addEventListener("sourceopen", handleSourceOpen, { once: true });
  });

  return {
    url: objectUrl,
    ready,
    cleanup: () => {
      abortController.abort();
      URL.revokeObjectURL(objectUrl);
    },
  };
}

export async function resolveVideoBlob(
  source: VideoBlobSource,
  onProgress?: (progress: number) => void
): Promise<{ blob: Blob; fileName: string; filetype: string }> {
  const fileUrl = source.file || "";
  const filetype = getOriginalVideoFiletype(source.filetype);

  if (!fileUrl) {
    throw new Error("找不到影片檔案");
  }

  if (!isMultipartVideoFiletype(source.filetype)) {
    const response = await fetch(getProxiedMediaUrl(fileUrl), {
      headers: {
        Accept: "video/*",
      },
    });
    if (!response.ok) {
      throw new Error(`影片下載失敗: HTTP ${response.status}`);
    }
    const blob = await response.blob();
    onProgress?.(100);
    return {
      blob,
      fileName: getVideoDownloadFilename(source),
      filetype,
    };
  }

  const manifest = await fetchVideoPartManifest(fileUrl);
  const partBlobs: Blob[] = [];
  let loadedBytes = 0;
  const totalBytes = manifest.originalSize || manifest.parts.reduce((sum, part) => sum + (part.size || 0), 0);

  for (const part of manifest.parts) {
    const response = await fetch(getProxiedMediaUrl(part.url));
    if (!response.ok) {
      throw new Error(`影片分段下載失敗: HTTP ${response.status}`);
    }
    const blob = await response.blob();
    partBlobs.push(blob);
    loadedBytes += blob.size;
    if (totalBytes > 0) {
      onProgress?.(Math.min(100, Math.round((loadedBytes / totalBytes) * 100)));
    }
  }

  return {
    blob: new Blob(partBlobs, { type: manifest.originalType || "video/mp4" }),
    fileName: getVideoDownloadFilename(source, manifest),
    filetype: manifest.originalExtension || filetype,
  };
}
