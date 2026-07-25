/** Client-side PNG ↔ JPG conversion helpers (canvas-based). */

export type ImageConvertTarget = "png" | "jpg";

export type ImageConvertInputKind = "png" | "jpg" | "other";

const PNG_MIME = "image/png";
const JPG_MIME = "image/jpeg";

export function detectImageConvertKind(file: File): ImageConvertInputKind {
  const type = (file.type || "").toLowerCase();
  const name = file.name.toLowerCase();

  if (type === PNG_MIME || name.endsWith(".png")) return "png";
  if (
    type === JPG_MIME ||
    type === "image/jpg" ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".jpe")
  ) {
    return "jpg";
  }
  return "other";
}

export function isConvertibleImageFile(file: File): boolean {
  return detectImageConvertKind(file) !== "other";
}

export function targetMime(target: ImageConvertTarget): string {
  return target === "png" ? PNG_MIME : JPG_MIME;
}

export function targetExtension(target: ImageConvertTarget): string {
  return target === "png" ? "png" : "jpg";
}

/** Strip known image extensions and append the target one. */
export function renameWithTargetExtension(filename: string, target: ImageConvertTarget): string {
  const base = filename.replace(/\.(png|jpe?g|jpe)$/i, "") || "image";
  return `${base}.${targetExtension(target)}`;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("無法讀取圖片"));
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
  /** JPEG quality 0–1 (default 0.92). Ignored for PNG. */
  quality?: number;
  /** Background fill when flattening transparency for JPG (default white). */
  background?: string;
};

/**
 * Convert a File/Blob image to PNG or JPG via canvas.
 * Alpha is preserved for PNG; for JPG a solid background is painted first.
 */
export async function convertImageFile(
  file: Blob,
  options: ConvertImageOptions
): Promise<Blob> {
  const { target, quality = 0.92, background = "#ffffff" } = options;
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
    return await canvasToBlob(canvas, mime, q);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function clampQuality(q: number): number {
  if (!Number.isFinite(q)) return 0.92;
  return Math.min(1, Math.max(0.1, q));
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
