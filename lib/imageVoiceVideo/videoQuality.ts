/**
 * Central video export quality targets.
 *
 * Floor requirements (user-facing):
 *   - Video bitrate ≥ 1 Mbps (1024 Kbps)
 *   - Frame rate ≥ 24 fps
 *
 * Targets are set above the floor for clearer 1080p canvas exports.
 */

/** Minimum acceptable video bitrate (bits/sec) — 1 Mbps = 1024 Kbps */
export const MIN_VIDEO_BITRATE_BPS = 1_024_000;

/** Target video bitrate for MediaRecorder / FFmpeg (bits/sec) — 2.5 Mbps */
export const VIDEO_BITRATE_BPS = 2_500_000;

/** Audio bitrate (bits/sec) */
export const AUDIO_BITRATE_BPS = 128_000;

/** Export frame rate (must be ≥ 24) */
export const VIDEO_FPS = 30;

/** Worker paint interval (ms) for ≥ VIDEO_FPS redraws per second */
export const FRAME_INTERVAL_MS = Math.floor(1000 / VIDEO_FPS); // 33ms @ 30fps

/** FFmpeg bitrate strings (libx264 / aac) */
export const FFMPEG_VIDEO_BITRATE = '2500k'; // ≥ 1024k
export const FFMPEG_VIDEO_MAXRATE = '2500k';
export const FFMPEG_VIDEO_BUFSIZE = '5000k'; // ~2× bitrate
export const FFMPEG_AUDIO_BITRATE = '128k';
export const FFMPEG_FPS = String(VIDEO_FPS);

/** MediaRecorder options shared by the client recorder */
export function mediaRecorderBitrateOptions(): {
  videoBitsPerSecond: number;
  audioBitsPerSecond: number;
} {
  return {
    videoBitsPerSecond: Math.max(VIDEO_BITRATE_BPS, MIN_VIDEO_BITRATE_BPS),
    audioBitsPerSecond: AUDIO_BITRATE_BPS,
  };
}
