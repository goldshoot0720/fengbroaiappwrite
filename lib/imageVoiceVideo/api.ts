// ─── API helpers (routes under /api/image-voice-video/*) ─────────────────────

const API_BASE = '/api/image-voice-video';

function abortableTimeout(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

async function readError(res: Response): Promise<string> {
  const err = await res.json().catch(() => ({ error: res.statusText }));
  return (err as { error?: string }).error ?? res.statusText;
}

export async function fetchTTS(
  text: string,
  language: string,
  gender: 'female' | 'male',
  rate: number,
  volume: number,
): Promise<ArrayBuffer> {
  const { signal, clear } = abortableTimeout(35_000);
  try {
    const res = await fetch(`${API_BASE}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language, gender, rate, volume }),
      signal,
    });
    if (!res.ok) {
      throw new Error(await readError(res));
    }
    return res.arrayBuffer();
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      throw new Error('語音生成逾時（遠端 Edge TTS 可能無法連線），請稍後再試');
    }
    throw e;
  } finally {
    clear();
  }
}

export interface TtsBatchItem {
  text: string;
  language: string;
  gender: 'female' | 'male';
}

/** Batch TTS: one server request, one WS per voice — much more reliable on Vercel */
export async function fetchTTSBatch(
  items: TtsBatchItem[],
  rate: number,
  volume: number,
  onProgress?: (done: number, total: number) => void,
): Promise<ArrayBuffer[]> {
  if (items.length === 0) return [];

  // Chunk to stay under serverless time budget (each chunk reuses WS per voice)
  const CHUNK = 12;
  const all: ArrayBuffer[] = [];

  for (let offset = 0; offset < items.length; offset += CHUNK) {
    const slice = items.slice(offset, offset + CHUNK);
    // Allow ~22s per line + connect overhead, capped
    const timeoutMs = Math.min(55_000, 15_000 + slice.length * 8_000);
    const { signal, clear } = abortableTimeout(timeoutMs);
    try {
      const res = await fetch(`${API_BASE}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: slice, rate, volume }),
        signal,
      });
      if (!res.ok) {
        throw new Error(await readError(res));
      }
      const data = (await res.json()) as { audios?: string[] };
      if (!Array.isArray(data.audios) || data.audios.length !== slice.length) {
        throw new Error('語音批次回應格式錯誤');
      }
      for (const b64 of data.audios) {
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        all.push(bytes.buffer);
      }
      onProgress?.(all.length, items.length);
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        throw new Error('語音生成逾時（遠端 Edge TTS 可能無法連線），請稍後再試或減少句數');
      }
      throw e;
    } finally {
      clear();
    }
  }

  return all;
}

export async function fetchTranslate(
  lines: string[],
  language: string,
  sourceLanguage = 'auto',
): Promise<string[]> {
  const { signal, clear } = abortableTimeout(45_000);
  try {
    const res = await fetch(`${API_BASE}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines, language, source_language: sourceLanguage }),
      signal,
    });
    if (!res.ok) {
      throw new Error(await readError(res));
    }
    const data = await res.json();
    return data.lines as string[];
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      throw new Error('翻譯逾時，請稍後再試');
    }
    throw e;
  } finally {
    clear();
  }
}

// Cache FFmpeg availability to avoid repeated probes per session
let ffmpegAvailable: boolean | null = null;

async function checkFfmpegAvailable(): Promise<boolean> {
  if (ffmpegAvailable !== null) return ffmpegAvailable;
  const { signal, clear } = abortableTimeout(8_000);
  try {
    const res = await fetch(`${API_BASE}/convert`, { method: 'GET', signal });
    if (!res.ok) {
      ffmpegAvailable = false;
      return false;
    }
    const data = await res.json();
    ffmpegAvailable = !!data.available;
  } catch {
    ffmpegAvailable = false;
  } finally {
    clear();
  }
  return ffmpegAvailable;
}

// Vercel serverless body limit ≈ 4.5 MB. Skip upload if blob is larger.
const VERCEL_BODY_LIMIT = 4 * 1024 * 1024; // 4 MB

export async function fetchConvert(webmBlob: Blob): Promise<Blob | null> {
  // 1. Pre-check: is FFmpeg available on the server? (fast, no body)
  const hasFfmpeg = await checkFfmpegAvailable();
  if (!hasFfmpeg) {
    console.warn('[convert] FFmpeg not available on server — keeping WebM');
    return null;
  }

  // 2. Size guard: don't upload blobs larger than Vercel's body limit
  if (webmBlob.size > VERCEL_BODY_LIMIT) {
    console.warn(
      `[convert] Blob too large (${(webmBlob.size / 1024 / 1024).toFixed(1)} MB), skipping server conversion`,
    );
    return null;
  }

  // 3. Upload — remote convert can take longer than local; allow up to 90s
  const { signal, clear } = abortableTimeout(90_000);

  try {
    const res = await fetch(`${API_BASE}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'video/webm' },
      body: webmBlob,
      signal,
    });
    if (res.status === 501) return null; // FFmpeg not installed
    if (!res.ok) {
      throw new Error(await readError(res));
    }
    return res.blob();
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      console.warn('[convert] Request timed out after 90s, skipping conversion');
      return null;
    }
    // Conversion is optional — never fail the whole video pipeline
    console.warn('[convert] failed, keeping WebM:', e);
    return null;
  } finally {
    clear();
  }
}
