/** Client-side face gender detection for 圖片+語音=影片 auto voice */

import type { Gender } from './scriptParser';

export type GenderDetectReason =
  | 'single-face'
  | 'no-face'
  | 'multi-face'
  | 'no-image'
  | 'error';

export interface GenderDetectResult {
  /** Gender to apply: single-face uses model; otherwise default male */
  gender: Gender;
  faceCount: number;
  confidence: number;
  reason: GenderDetectReason;
  message: string;
}

const MODEL_URL = '/models/face-api';
const DEFAULT_GENDER: Gender = 'male';

let modelsReady: Promise<void> | null = null;

function genderLabel(g: Gender): string {
  return g === 'male' ? '男聲' : '女聲';
}

async function ensureModels(): Promise<typeof import('@vladmandic/face-api')> {
  const faceapi = await import('@vladmandic/face-api');
  if (!modelsReady) {
    modelsReady = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL),
    ]).then(() => undefined);
  }
  await modelsReady;
  return faceapi;
}

/**
 * Detect speaker gender from cover image.
 * - Exactly one face → use predicted gender (with confidence)
 * - Zero / multiple faces / error / no image → default male
 */
export async function detectImageGender(
  image: HTMLImageElement | null | undefined,
): Promise<GenderDetectResult> {
  if (!image || !image.complete || image.naturalWidth < 8) {
    return {
      gender: DEFAULT_GENDER,
      faceCount: 0,
      confidence: 0,
      reason: 'no-image',
      message: `無封面圖，使用預設${genderLabel(DEFAULT_GENDER)}`,
    };
  }

  try {
    const faceapi = await ensureModels();
    const options = new faceapi.TinyFaceDetectorOptions({
      inputSize: 416,
      scoreThreshold: 0.4,
    });

    const detections = await faceapi
      .detectAllFaces(image, options)
      .withAgeAndGender();

    const faceCount = detections.length;

    if (faceCount === 0) {
      return {
        gender: DEFAULT_GENDER,
        faceCount: 0,
        confidence: 0,
        reason: 'no-face',
        message: `圖片未偵測到人臉，使用預設${genderLabel(DEFAULT_GENDER)}`,
      };
    }

    if (faceCount > 1) {
      return {
        gender: DEFAULT_GENDER,
        faceCount,
        confidence: 0,
        reason: 'multi-face',
        message: `圖片有 ${faceCount} 張人臉，使用預設${genderLabel(DEFAULT_GENDER)}`,
      };
    }

    const det = detections[0];
    const raw = String(det.gender || '').toLowerCase();
    const gender: Gender = raw === 'female' ? 'female' : 'male';
    const confidence = Number(det.genderProbability) || 0;

    return {
      gender,
      faceCount: 1,
      confidence,
      reason: 'single-face',
      message: `偵測到單一人物 → 自動使用${genderLabel(gender)}（信心 ${(confidence * 100).toFixed(0)}%）`,
    };
  } catch (err) {
    console.warn('[ivv] gender detect failed:', err);
    return {
      gender: DEFAULT_GENDER,
      faceCount: 0,
      confidence: 0,
      reason: 'error',
      message: `人臉偵測失敗，使用預設${genderLabel(DEFAULT_GENDER)}`,
    };
  }
}

export const DEFAULT_TRACK_GENDER: Gender = DEFAULT_GENDER;
