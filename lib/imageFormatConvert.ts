/**
 * Client-side image → PNG / JPEG conversion helpers (canvas-based).
 * Feature set inspired by huang1988pioneer/PNGJPEGConverter.
 */

export type ImageConvertTarget = "png" | "jpg";

export type ImageConvertInputKind =
  | "png"
  | "jpg"
  | "webp"
  | "gif"
  | "bmp"
  | "avif"
  | "tiff"
  | "heic"
  | "other";

const PNG_MIME = "image/png";
const JPG_MIME = "image/jpeg";

/** Browser-decodable extensions we accept into the queue. */
const EXT_TO_KIND: Record<string, ImageConvertInputKind> = {
  png: "png",
  jpg: "jpg",
  jpeg: "jpg",
  jpe: "jpg",
  jfif: "jpg",
  webp: "webp",
  gif: "gif",
  bmp: "bmp",
  dib: "bmp",
  avif: "avif",
  tif: "tiff",
  tiff: "tiff",
  heic: "heic",
  heif: "heic",
};

const MIME_TO_KIND: Record<string, ImageConvertInputKind> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/pjpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "image/x-ms-bmp": "bmp",
  "image/x-windows-bmp": "bmp",
  "image/avif": "avif",
  "image/tiff": "tiff",
  "image/heic": "heic",
  "image/heif": "heic",
};

/** Accept attribute for file inputs */
export const IMAGE_CONVERT_ACCEPT =
  "image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif,image/tiff,image/heic,image/heif,.png,.jpg,.jpeg,.jpe,.jfif,.webp,.gif,.bmp,.avif,.tif,.tiff,.heic,.heif";

export function getFileExtension(filename: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(filename || "");
  return (m?.[1] || "").toLowerCase();
}

export function detectImageConvertKind(file: File | Blob & { name?: string }): ImageConvertInputKind {
  const type = (file.type || "").toLowerCase();
  if (type && MIME_TO_KIND[type]) return MIME_TO_KIND[type];

  const name = ("name" in file && file.name ? file.name : "").toLowerCase();
  const ext = getFileExtension(name);
  if (ext && EXT_TO_KIND[ext]) return EXT_TO_KIND[ext];

  // Generic image/* without known subtype — try convert anyway
  if (type.startsWith("image/") && type !== "image/svg+xml") return "other";
  return "other";
}

/**
 * Whether we should attempt conversion.
 * HEIC/TIFF often fail in browsers — still allow add so user sees a clear error.
 */
export function isConvertibleImageFile(file: File): boolean {
  const kind = detectImageConvertKind(file);
  if (kind !== "other") return true;
  const type = (file.type || "").toLowerCase();
  if (type.startsWith("image/") && type !== "image/svg+xml") return true;
  // No type: rely on extension
  const ext = getFileExtension(file.name);
  return Boolean(ext && EXT_TO_KIND[ext]);
}

export function kindLabel(kind: ImageConvertInputKind): string {
  switch (kind) {
    case "jpg":
      return "JPG";
    case "png":
      return "PNG";
    case "webp":
      return "WebP";
    case "gif":
      return "GIF";
    case "bmp":
      return "BMP";
    case "avif":
      return "AVIF";
    case "tiff":
      return "TIFF";
    case "heic":
      return "HEIC";
    default:
      return "IMG";
  }
}

export function targetMime(target: ImageConvertTarget): string {
  return target === "png" ? PNG_MIME : JPG_MIME;
}

export function targetExtension(target: ImageConvertTarget): string {
  return target === "png" ? "png" : "jpg";
}

export function targetDisplayName(target: ImageConvertTarget): string {
  return target === "png" ? "PNG" : "JPEG";
}

/** Strip known image extensions and append the target one. */
export function renameWithTargetExtension(filename: string, target: ImageConvertTarget): string {
  const base =
    filename
      .replace(/\.(png|jpe?g|jpe|jfif|webp|gif|bmp|avif|tiff?|heic|heif)$/i, "")
      .trim() || "image";
  return `${sanitizeFileName(base)}.${targetExtension(target)}`;
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim() || "image";
}

/**
 * Allocate a unique output name among used names (流水號，避免覆蓋).
 * Matches PNGJPEGConverter GetOutputPath numbering: name, name-1, name-2, …
 */
export function uniqueOutputName(desired: string, used: Set<string>): string {
  if (!used.has(desired.toLowerCase())) {
    used.add(desired.toLowerCase());
    return desired;
  }
  const dot = desired.lastIndexOf(".");
  const base = dot >= 0 ? desired.slice(0, dot) : desired;
  const ext = dot >= 0 ? desired.slice(dot) : "";
  let index = 1;
  while (true) {
    const candidate = `${base}-${index}${ext}`;
    if (!used.has(candidate.toLowerCase())) {
      used.add(candidate.toLowerCase());
      return candidate;
    }
    index += 1;
  }
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(
        new Error(
          "無法解碼圖片。瀏覽器可能不支援此格式（如 HEIC / 部分 TIFF）。請改用 PNG、JPEG、WebP、GIF、BMP。"
        )
      );
    img.src = src;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("轉換失敗：無法產生檔案"));
          return;
        }
        resolve(blob);
      },
      type,
      quality
    );
  });
}

export type ConvertImageOptions = {
  target: ImageConvertTarget;
  /** JPEG quality 0–1 (default 1.0 / 100%). Ignored for PNG. */
  quality?: number;
  /** Background fill when flattening transparency for JPG (default white). */
  background?: string;
};

/**
 * Convert a File/Blob image to PNG or JPG via canvas.
 * Alpha is preserved for PNG; for JPG a solid white background is painted first
 * (same as PNGJPEGConverter / Magick Alpha.Remove + white bg).
 */
export async function convertImageFile(
  file: Blob,
  options: ConvertImageOptions
): Promise<{ blob: Blob; width: number; height: number }> {
  const { target, quality = 1, background = "#ffffff" } = options;
  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await loadImageElement(objectUrl);
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (!width || !height) {
      throw new Error("圖片尺寸無效");
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("瀏覽器不支援 Canvas");
    }

    if (target === "jpg") {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
    }

    ctx.drawImage(img, 0, 0, width, height);

    const mime = targetMime(target);
    const q = target === "jpg" ? clampQuality(quality) : undefined;
    const blob = await canvasToBlob(canvas, mime, q);
    return { blob, width, height };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Probe width/height without converting. */
export async function probeImageSize(
  file: Blob
): Promise<{ width: number; height: number }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImageElement(objectUrl);
    return {
      width: img.naturalWidth || img.width || 0,
      height: img.naturalHeight || img.height || 0,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function clampQuality(q: number): number {
  if (!Number.isFinite(q)) return 1;
  // Match desktop app: 1%–100%
  return Math.min(1, Math.max(0.01, q));
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Guess filename from a URL path (strip @ modifiers like bilibili CDN).
 */
export function displayNameFromUrl(url: string, index: number): string {
  try {
    const u = new URL(url);
    let fileName = decodeURIComponent(u.pathname.split("/").pop() || "");
    const at = fileName.indexOf("@");
    if (at > 0) fileName = fileName.slice(0, at);
    if (!fileName || fileName === "/" || !/\./.test(fileName)) {
      return `url-image-${index}.img`;
    }
    return fileName;
  } catch {
    return `url-image-${index}.img`;
  }
}

/**
 * Download remote image via same-origin media-proxy (avoids CORS).
 * Returns a File ready for the convert queue.
 */
export async function fetchImageAsFile(
  imageUrl: string,
  index = 1
): Promise<File> {
  const trimmed = imageUrl.trim();
  if (!trimmed) throw new Error("請輸入圖片網址");

  let absolute: URL;
  try {
    absolute = new URL(trimmed);
  } catch {
    throw new Error("請輸入有效的 http/https 圖片網址");
  }
  if (absolute.protocol !== "http:" && absolute.protocol !== "https:") {
    throw new Error("僅支援 http/https 圖片網址");
  }

  const candidates = getImageUriCandidates(absolute);
  const errors: string[] = [];

  for (const candidate of candidates) {
    try {
      return await fetchImageCandidate(candidate, index);
    } catch (err) {
      errors.push(
        `${candidate.href}：${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  throw new Error(
    errors.length
      ? `無法加入網址圖片：\n${errors.join("\n")}`
      : "無法下載圖片"
  );
}

function getImageUriCandidates(uri: URL): URL[] {
  const list: URL[] = [];
  const absolutePath = uri.origin + uri.pathname;
  const extensions = [".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif", ".avif"];

  for (const extension of extensions) {
    const index = absolutePath.toLowerCase().indexOf(extension);
    if (index < 0) continue;
    const endIndex = index + extension.length;
    if (endIndex < absolutePath.length && absolutePath[endIndex] === "@") {
      try {
        list.push(new URL(absolutePath.slice(0, endIndex)));
      } catch {
        /* ignore */
      }
    }
  }

  list.push(uri);
  // Dedupe
  const seen = new Set<string>();
  return list.filter((u) => {
    const k = u.href.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function fetchImageCandidate(uri: URL, index: number): Promise<File> {
  const proxyUrl = `/api/media-proxy?url=${encodeURIComponent(uri.href)}`;
  const response = await fetch(proxyUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`下載失敗（HTTP ${response.status}）`);
  }

  const contentType = (response.headers.get("content-type") || "").split(";")[0].trim();
  if (
    contentType &&
    !contentType.startsWith("image/") &&
    !contentType.includes("octet-stream")
  ) {
    throw new Error(
      `網址沒有直接回傳圖片（Content-Type: ${contentType}）。請貼圖片直接連結。`
    );
  }

  const blob = await response.blob();
  if (!blob.size) throw new Error("下載內容是空的");

  // Prefer content-type; fall back to blob type; then extension from URL
  let mime = contentType.startsWith("image/")
    ? contentType
    : blob.type.startsWith("image/")
      ? blob.type
      : "";
  let name = displayNameFromUrl(uri.href, index);
  if (!getFileExtension(name) && mime) {
    const ext =
      mime === "image/jpeg"
        ? "jpg"
        : mime === "image/png"
          ? "png"
          : mime.replace("image/", "").split("+")[0] || "img";
    name = `${name}.${ext}`;
  }
  if (!mime) {
    const kind = detectImageConvertKind(new File([blob], name));
    mime =
      kind === "jpg"
        ? JPG_MIME
        : kind === "png"
          ? PNG_MIME
          : blob.type || "application/octet-stream";
  }

  const file = new File([blob], name, { type: mime });
  // Quick decode probe so we fail early on HTML error pages
  await probeImageSize(file);
  return file;
}
