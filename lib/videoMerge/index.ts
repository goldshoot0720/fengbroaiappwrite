export {
  extractFrames,
  formatBytes,
  formatDuration,
  type ExtractedFrames,
} from "./frames";

export {
  clearClips,
  clearStoredAudio,
  clearStoredPreview,
  loadAudio,
  loadClips,
  loadPreview,
  saveAudio,
  saveClips,
  savePreview,
  type VideoClip,
  type VideoClipStatus,
} from "./clipStore";

export {
  ensureFFmpeg,
  LOOP_LIMITS,
  mergeVideos,
  type LoopMode,
  type LoopOptions,
  type MergeHooks,
} from "./merge";

export {
  buildMergeSubtitles,
  chunksToSrt,
  chunksToVtt,
  getMediaDuration,
  parseTimedScript,
  scriptToSubtitles,
  splitScriptIntoLines,
  type ScriptToSubtitlesResult,
  type SubChunk,
} from "./subtitle";

// Whisper / @huggingface/transformers must not be re-exported from this barrel:
// Next Client SSR would pull transformers.node.mjs and fail on onnx WASM assets.
// Import from `@/lib/videoMerge/whisper` only via dynamic import() at call sites.
