/**
 * Speech-to-text (Whisper via Transformers.js) → SRT / WebVTT.
 * Adapted from huang1988pioneer/VideoMerge (subtitle.js).
 * Client-only: dynamic-import @huggingface/transformers in the browser.
 */

import { chunksToSrt, chunksToVtt, type SubChunk } from "./subtitle";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AsrPipeline = any;

let transcriber: AsrPipeline | null = null;
let loadedModelId: string | null = null;
let loadPromise: Promise<AsrPipeline> | null = null;

const SAMPLE_RATE = 16000;
const PREFERRED_MODEL_KEY = "fengbro.videomerge.whisper.model";

type LoadCandidate = {
  model: string;
  options: Record<string, unknown>;
  label: string;
};

/** Prefer models/dtypes that work with current onnxruntime-web. */
const LOAD_CANDIDATES: LoadCandidate[] = [
  {
    model: "Xenova/whisper-tiny",
    options: { dtype: "fp32", device: "wasm" },
    label: "whisper-tiny fp32",
  },
  {
    model: "Xenova/whisper-tiny",
    options: { device: "wasm" },
    label: "whisper-tiny default",
  },
  {
    model: "Xenova/whisper-base",
    options: { dtype: "fp32", device: "wasm" },
    label: "whisper-base fp32（中文較準）",
  },
  {
    model: "onnx-community/whisper-tiny",
    options: { dtype: "fp32", device: "wasm" },
    label: "onnx-community/whisper-tiny fp32",
  },
];

const SLICE_SEC = 15;
const SLICE_OVERLAP_SEC = 0.5;
const SLICE_TIMEOUT_MS = 90_000;
const MAX_ASR_SEC = 10 * 60;

function getPreferredModelId(): string | null {
  try {
    return (
      sessionStorage.getItem(PREFERRED_MODEL_KEY) ||
      localStorage.getItem(PREFERRED_MODEL_KEY)
    );
  } catch {
    return null;
  }
}

function setPreferredModelId(modelId: string) {
  try {
    sessionStorage.setItem(PREFERRED_MODEL_KEY, modelId);
    localStorage.setItem(PREFERRED_MODEL_KEY, modelId);
  } catch {
    /* private mode */
  }
}

function buildCandidateOrder(opts: { preferBetterChinese?: boolean } = {}) {
  const preferBase = Boolean(opts.preferBetterChinese);
  const preferred = getPreferredModelId();
  let order = [...LOAD_CANDIDATES];

  if (preferBase) {
    order = [
      ...order.filter((c) => c.model.includes("base")),
      ...order.filter((c) => !c.model.includes("base")),
    ];
  }

  if (preferred) {
    order = [
      ...order.filter((c) => c.model === preferred),
      ...order.filter((c) => c.model !== preferred),
    ];
  }
  return order;
}

export async function ensureTranscriber(
  onStatus?: (msg: string) => void,
  onProgress?: (ratio: number) => void,
  opts: { preferBetterChinese?: boolean } = {}
): Promise<AsrPipeline> {
  if (transcriber && loadedModelId) {
    onStatus?.(`使用記憶體中的模型（${loadedModelId}，無需重新下載）`);
    onProgress?.(1);
    return transcriber;
  }
  if (loadPromise) return loadPromise;

  const order = buildCandidateOrder(opts);
  const preferred = getPreferredModelId();

  loadPromise = (async () => {
    onStatus?.(
      preferred
        ? "載入語音辨識模型（優先讀取瀏覽器快取，通常很快）…"
        : "載入語音辨識模型（僅首次需下載，之後會快取）…"
    );
    const { pipeline, env } = await import("@huggingface/transformers");

    env.allowLocalModels = false;
    env.useBrowserCache = true;

    let sawNetworkProgress = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const progress_callback = (p: any) => {
      if (p?.status === "progress" && typeof p.progress === "number") {
        if (p.progress < 100 && p.progress > 0) sawNetworkProgress = true;
        onProgress?.(Math.min(0.95, p.progress / 100));
        const name = p.file ? String(p.file).split("/").pop() : "";
        onStatus?.(
          sawNetworkProgress
            ? `下載模型：${name} ${Math.round(p.progress)}%（僅首次）`
            : `讀取模型：${name} ${Math.round(p.progress)}%`
        );
      } else if (p?.status === "done" && p.file) {
        const name = String(p.file).split("/").pop();
        onStatus?.(
          sawNetworkProgress ? `已下載並快取：${name}` : `已從快取載入：${name}`
        );
      }
    };

    const errors: string[] = [];
    for (const candidate of order) {
      try {
        onStatus?.(`載入：${candidate.label}…`);
        const t0 = performance.now();
        const asr = await pipeline("automatic-speech-recognition", candidate.model, {
          ...candidate.options,
          progress_callback,
        });
        const ms = Math.round(performance.now() - t0);
        transcriber = asr;
        loadedModelId = candidate.model;
        setPreferredModelId(candidate.model);
        onProgress?.(1);
        onStatus?.(
          sawNetworkProgress || ms > 8000
            ? `模型就緒（${candidate.label}，${(ms / 1000).toFixed(1)}s，已寫入快取，下次會更快）`
            : `模型就緒（${candidate.label}，${(ms / 1000).toFixed(1)}s，多半來自快取）`
        );
        return asr;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${candidate.label}: ${msg}`);
        onStatus?.(`載入失敗（${candidate.label}），改試下一組…`);
      }
    }

    throw new Error(
      [
        "無法載入 Whisper 模型。",
        "請確認網路可連到 Hugging Face。",
        "若曾清除網站資料，需重新下載一次。",
        errors.join(" | "),
      ].join(" ")
    );
  })();

  try {
    return await loadPromise;
  } catch (err) {
    loadPromise = null;
    throw err instanceof Error
      ? err
      : new Error(`無法載入 Whisper 模型。${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function decodeAudioForWhisper(
  file: File | Blob,
  onLog?: (msg: string) => void
): Promise<Float32Array> {
  if (!file) throw new Error("找不到音訊檔");

  try {
    const ab = await file.arrayBuffer();
    if (!ab.byteLength) throw new Error("音訊檔是空的");

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) throw new Error("瀏覽器不支援 AudioContext");

    const ctx = new AudioCtx();
    let audioBuffer: AudioBuffer;
    try {
      audioBuffer = await ctx.decodeAudioData(ab.slice(0));
    } finally {
      try {
        await ctx.close();
      } catch {
        /* ignore */
      }
    }

    const { numberOfChannels, length, sampleRate } = audioBuffer;
    onLog?.(
      `音訊解碼：${(length / sampleRate).toFixed(1)}s · ${sampleRate}Hz · ${numberOfChannels}ch`
    );

    const mono = new Float32Array(length);
    for (let c = 0; c < numberOfChannels; c++) {
      const ch = audioBuffer.getChannelData(c);
      for (let i = 0; i < length; i++) mono[i] += ch[i] / numberOfChannels;
    }

    let sumSq = 0;
    const step = Math.max(1, Math.floor(mono.length / 20000));
    let n = 0;
    for (let i = 0; i < mono.length; i += step) {
      sumSq += mono[i] * mono[i];
      n += 1;
    }
    const rms = Math.sqrt(sumSq / Math.max(1, n));
    onLog?.(`音量 RMS≈${rms.toFixed(5)}`);
    if (rms < 1e-4) {
      throw new Error("音訊幾乎無聲（或解碼失敗）。請確認 MP3 含人聲且音量正常。");
    }

    if (sampleRate === SAMPLE_RATE) return mono;

    const newLength = Math.max(1, Math.round((length * SAMPLE_RATE) / sampleRate));
    const out = new Float32Array(newLength);
    const ratio = length / newLength;
    for (let i = 0; i < newLength; i++) {
      const src = i * ratio;
      const i0 = Math.floor(src);
      const i1 = Math.min(i0 + 1, length - 1);
      const t = src - i0;
      out[i] = mono[i0] * (1 - t) + mono[i1] * t;
    }
    onLog?.(`已重採樣至 ${SAMPLE_RATE} Hz（${out.length} samples）`);
    return out;
  } catch (err) {
    onLog?.(
      `Web Audio 解碼失敗，改試 transformers.read_audio：${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  const url = URL.createObjectURL(file);
  try {
    const { read_audio } = await import("@huggingface/transformers");
    const audio = await read_audio(url, SAMPLE_RATE);
    if (!(audio instanceof Float32Array) || !audio.length) {
      throw new Error("read_audio 回傳空資料");
    }
    onLog?.(`read_audio 成功：${audio.length} samples @ ${SAMPLE_RATE}Hz`);
    return audio;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function normalizeLanguage(language: string | null | undefined): string | null {
  if (!language || language === "auto") return null;
  const map: Record<string, string> = {
    chinese: "chinese",
    zh: "chinese",
    "zh-tw": "chinese",
    "zh-cn": "chinese",
    中文: "chinese",
    english: "english",
    en: "english",
  };
  const key = String(language).toLowerCase();
  return map[key] || language;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseAsrResult(result: any, audioDurationSec: number): SubChunk[] {
  const chunks: SubChunk[] = [];

  const pushChunk = (text: unknown, start: unknown, end: unknown) => {
    const t = String(text || "")
      .replace(/\[.*?\]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!t) return;
    if (
      /^(\.|…|\.\.\.|♪|\[Music\]|\[音樂\]|thank you\.?|thanks for watching\.?)$/i.test(t)
    ) {
      return;
    }
    let s = Number(start);
    let e = Number(end);
    if (!Number.isFinite(s) || s < 0) s = 0;
    if (!Number.isFinite(e) || e <= s) e = s + 1.5;
    chunks.push({ timestamp: [s, e], text: t });
  };

  const list = Array.isArray(result) ? result : [result];
  for (const item of list) {
    if (!item) continue;
    if (Array.isArray(item.chunks) && item.chunks.length) {
      for (const c of item.chunks) {
        const ts = c.timestamp;
        const start = Array.isArray(ts) ? ts[0] : 0;
        const end = Array.isArray(ts) ? ts[1] : start + 1.5;
        pushChunk(c.text, start, end);
      }
    } else if (item.text) {
      pushChunk(item.text, 0, Math.max(audioDurationSec || 2, 2));
    }
  }

  for (let i = 0; i < chunks.length; i++) {
    let [s, e] = chunks[i].timestamp;
    if (!Number.isFinite(e) || e <= s) {
      const next = chunks[i + 1]?.timestamp?.[0];
      e = Number.isFinite(next) && next > s ? next : s + 2;
      chunks[i].timestamp = [s, e];
    }
  }

  return chunks;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      reject(
        new Error(
          `${label} 逾時（>${Math.round(ms / 1000)} 秒）。瀏覽器內辨識較慢，請換較短 MP3 或稍後再試。`
        )
      );
    }, ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setTimeout(resolve, 0));
    });
  });
}

async function transcribeInSlices(
  asr: AsrPipeline,
  waveform: Float32Array,
  baseKwargs: Record<string, unknown>,
  hooks: {
    onStatus?: (msg: string) => void;
    onProgress?: (ratio: number) => void;
    onLog?: (msg: string) => void;
  }
): Promise<SubChunk[]> {
  const { onStatus, onProgress, onLog } = hooks;
  const totalSec = waveform.length / SAMPLE_RATE;
  const stepSec = SLICE_SEC - SLICE_OVERLAP_SEC;
  const numSlices = Math.max(1, Math.ceil(totalSec / stepSec));
  const all: SubChunk[] = [];
  const t0 = Date.now();

  const heartbeat = setInterval(() => {
    const elapsed = Math.round((Date.now() - t0) / 1000);
    onStatus?.(`辨識進行中…已 ${elapsed} 秒（瀏覽器內轉寫偏慢，請勿關閉分頁）`);
  }, 2000);

  try {
    for (let i = 0; i < numSlices; i++) {
      const startSec = i * stepSec;
      const endSec = Math.min(totalSec, startSec + SLICE_SEC);
      const startSample = Math.floor(startSec * SAMPLE_RATE);
      const endSample = Math.min(waveform.length, Math.floor(endSec * SAMPLE_RATE));
      if (endSample <= startSample) continue;

      const slice = waveform.subarray(startSample, endSample);
      const sliceDur = (endSample - startSample) / SAMPLE_RATE;
      const elapsed = Math.round((Date.now() - t0) / 1000);

      onStatus?.(
        `辨識 ${i + 1}/${numSlices}（${startSec.toFixed(0)}–${endSec.toFixed(0)}s / 共 ${totalSec.toFixed(0)}s）· 已 ${elapsed}s`
      );
      onProgress?.(0.1 + (0.85 * i) / numSlices);
      onLog?.(
        `ASR 片段 ${i + 1}/${numSlices}: ${startSec.toFixed(1)}–${endSec.toFixed(1)}s (${sliceDur.toFixed(1)}s, ${slice.length} samples)`
      );

      await yieldToUi();

      const kwargs: Record<string, unknown> = {
        ...baseKwargs,
        return_timestamps: true,
        max_new_tokens: 128,
      };
      delete kwargs.chunk_length_s;
      delete kwargs.stride_length_s;

      let result: unknown;
      try {
        result = await withTimeout(
          asr(slice, kwargs),
          SLICE_TIMEOUT_MS,
          `第 ${i + 1}/${numSlices} 段`
        );
      } catch (err) {
        onLog?.(
          `片段 ${i + 1} 失敗：${err instanceof Error ? err.message : String(err)}`
        );
        continue;
      }

      const part = parseAsrResult(result, sliceDur);
      for (const c of part) {
        const [s, e] = c.timestamp;
        if (i > 0 && s < SLICE_OVERLAP_SEC * 0.8) continue;
        all.push({
          timestamp: [s + startSec, e + startSec],
          text: c.text,
        });
      }

      onLog?.(
        `片段 ${i + 1} 完成：+${part.length} 句 · 累計 ${all.length} · 「${part
          .map((p) => p.text)
          .join(" ")
          .slice(0, 60)}」`
      );
      onProgress?.(0.1 + (0.85 * (i + 1)) / numSlices);
      await yieldToUi();
    }
  } finally {
    clearInterval(heartbeat);
  }

  all.sort((a, b) => a.timestamp[0] - b.timestamp[0]);
  return all;
}

export type TranscribeOptions = {
  language?: string | null;
  onStatus?: (msg: string) => void;
  onProgress?: (ratio: number) => void;
  onLog?: (msg: string) => void;
};

export type TranscribeResult = {
  chunks: SubChunk[];
  text: string;
  srt: string;
  vtt: string;
  modelId: string | null;
};

/**
 * Transcribe an audio File (e.g. MP3) into timed subtitle chunks + SRT/VTT.
 */
export async function transcribeAudioToSubtitles(
  file: File | Blob,
  opts: TranscribeOptions = {}
): Promise<TranscribeResult> {
  const { language = "chinese", onStatus, onProgress, onLog } = opts;
  if (!file) throw new Error("請先選擇 MP3 / 音訊檔");

  const lang = normalizeLanguage(language);

  const asr = await ensureTranscriber(onStatus, onProgress, {
    preferBetterChinese: false,
  });

  onStatus?.("解碼音訊…");
  const fileName =
    file instanceof File ? file.name : "audio";
  onLog?.(
    `ASR 檔案：${fileName}（${file.size} bytes） language=${lang || "auto"}`
  );

  let waveform = await decodeAudioForWhisper(file, onLog);
  let audioDurationSec = waveform.length / SAMPLE_RATE;
  onLog?.(
    `波形長度 ${audioDurationSec.toFixed(2)}s · model=${loadedModelId || "?"}`
  );

  if (audioDurationSec > MAX_ASR_SEC) {
    onLog?.(
      `音訊 ${audioDurationSec.toFixed(0)}s 超過上限 ${MAX_ASR_SEC}s，只辨識前 ${MAX_ASR_SEC / 60} 分鐘`
    );
    onStatus?.(`音訊較長，僅辨識前 ${MAX_ASR_SEC / 60} 分鐘…`);
    waveform = waveform.subarray(0, Math.floor(MAX_ASR_SEC * SAMPLE_RATE));
    audioDurationSec = waveform.length / SAMPLE_RATE;
  }

  const baseKwargs: Record<string, unknown> = {
    return_timestamps: true,
    max_new_tokens: 128,
  };
  if (lang) {
    baseKwargs.language = lang;
    baseKwargs.task = "transcribe";
  }

  onStatus?.("開始分段辨識（每段約 15 秒音訊）…");
  onProgress?.(0.1);

  const chunks = await transcribeInSlices(asr, waveform, baseKwargs, {
    onStatus,
    onProgress,
    onLog,
  });

  const fullText = chunks
    .map((c) => c.text)
    .join(" ")
    .trim();
  onLog?.(
    `解析後 ${chunks.length} 句，文字：${fullText.slice(0, 120)}${
      fullText.length > 120 ? "…" : ""
    }`
  );

  if (!chunks.length) {
    throw new Error(
      "未能從音訊辨識出文字。請確認：① MP3 含清楚人聲 ② 語言選對 ③ 音量足夠。純音樂通常無法產生字幕。若各段都逾時，請換較短 MP3 再試。"
    );
  }

  const srt = chunksToSrt(chunks);
  const vtt = chunksToVtt(chunks);
  if (!srt.trim() || !vtt.includes("-->")) {
    throw new Error("字幕檔產生失敗（內容為空）");
  }

  onStatus?.(`字幕就緒（${chunks.length} 句）`);
  onProgress?.(1);
  return {
    chunks,
    text: fullText || chunks.map((c) => c.text).join(" "),
    srt,
    vtt,
    modelId: loadedModelId,
  };
}

export function getLoadedWhisperModelId(): string | null {
  return loadedModelId;
}
