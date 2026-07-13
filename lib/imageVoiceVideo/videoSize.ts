/** Output orientation & canvas resolution helpers */

export type Orientation = 'portrait' | 'landscape';
/** User preference: auto follows the source image */
export type OrientationMode = 'auto' | Orientation;

export interface CanvasSize {
  width: number;
  height: number;
  orientation: Orientation;
  /** e.g. "9:16" or "16:9" or "1:1" */
  label: string;
}

/** Standard export resolutions when user forces orientation */
export const PORTRAIT_SIZE = { width: 1080, height: 1920 } as const;
export const LANDSCAPE_SIZE = { width: 1920, height: 1080 } as const;

/** Longest side for auto-sized canvas (keeps full image, no crop) */
const AUTO_MAX_LONG = 1920;

export function detectOrientation(
  image: { naturalWidth: number; naturalHeight: number } | null | undefined,
): Orientation {
  if (!image?.naturalWidth || !image.naturalHeight) return 'portrait';
  return image.naturalWidth >= image.naturalHeight ? 'landscape' : 'portrait';
}

export function resolveOrientation(
  mode: OrientationMode,
  image?: { naturalWidth: number; naturalHeight: number } | null,
): Orientation {
  if (mode === 'auto') return detectOrientation(image);
  return mode;
}

function even(n: number): number {
  const v = Math.max(2, Math.round(n));
  return v % 2 === 0 ? v : v + 1;
}

/** Compact aspect label for UI (e.g. 16:9, 4:3, 1:1) */
function aspectLabel(w: number, h: number): string {
  const g = (a: number, b: number): number => (b === 0 ? a : g(b, a % b));
  const d = g(w, h) || 1;
  let rw = Math.round(w / d);
  let rh = Math.round(h / d);
  // Cap huge ratios for display (e.g. 1920:1080 → already simplified)
  if (rw > 50 || rh > 50) {
    if (w >= h) {
      rw = Math.round((w / h) * 9);
      rh = 9;
    } else {
      rh = Math.round((h / w) * 9);
      rw = 9;
    }
  }
  return `${rw}:${rh}`;
}

/**
 * Size canvas for export / preview.
 * - auto: match source image aspect (scale longest side to 1920) → full image, no crop
 * - portrait / landscape: fixed 9:16 or 16:9 (image letterboxed via contain-fit)
 */
export function resolveCanvasSize(
  mode: OrientationMode,
  image?: { naturalWidth: number; naturalHeight: number } | null,
): CanvasSize {
  const orientation = resolveOrientation(mode, image);

  if (mode === 'auto' && image?.naturalWidth && image.naturalHeight) {
    const iw = image.naturalWidth;
    const ih = image.naturalHeight;
    const long = Math.max(iw, ih);
    const scale = AUTO_MAX_LONG / long;
    const width = even(iw * scale);
    const height = even(ih * scale);
    return {
      width,
      height,
      orientation,
      label: aspectLabel(width, height),
    };
  }

  if (orientation === 'landscape') {
    return {
      width: LANDSCAPE_SIZE.width,
      height: LANDSCAPE_SIZE.height,
      orientation,
      label: '16:9',
    };
  }
  return {
    width: PORTRAIT_SIZE.width,
    height: PORTRAIT_SIZE.height,
    orientation,
    label: '9:16',
  };
}

export function orientationLabel(mode: OrientationMode, resolved: Orientation): string {
  if (mode === 'auto') {
    return resolved === 'landscape' ? '自動 · 橫式' : '自動 · 直式';
  }
  return mode === 'landscape' ? '橫式' : '直式';
}
