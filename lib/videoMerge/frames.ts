/**
 * Extract first / last video frames as JPEG data URLs (HTML5 video + canvas).
 * Adapted from huang1988pioneer/VideoMerge.
 */

function loadVideo(file: File | Blob): Promise<{
  video: HTMLVideoElement;
  url: string;
  cleanup: () => void;
}> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.crossOrigin = "anonymous";

    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
    };

    video.addEventListener(
      "loadedmetadata",
      () => {
        resolve({ video, url, cleanup });
      },
      { once: true }
    );

    video.addEventListener(
      "error",
      () => {
        URL.revokeObjectURL(url);
        cleanup();
        const name = file instanceof File ? file.name : "blob";
        reject(new Error(`無法讀取影片：${name}`));
      },
      { once: true }
    );

    video.src = url;
  });
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      requestAnimationFrame(() => resolve());
    };

    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener(
      "error",
      () => {
        video.removeEventListener("seeked", onSeeked);
        reject(new Error("影片定位失敗"));
      },
      { once: true }
    );

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const target = Math.max(0, Math.min(time, Math.max(duration - 0.05, 0)));
    try {
      video.currentTime = target;
    } catch (err) {
      video.removeEventListener("seeked", onSeeked);
      reject(err);
    }
  });
}

function captureFrame(video: HTMLVideoElement): string {
  const width = video.videoWidth || 640;
  const height = video.videoHeight || 360;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("瀏覽器不支援 Canvas");
  ctx.drawImage(video, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.88);
}

export type ExtractedFrames = {
  firstFrame: string;
  lastFrame: string;
  duration: number;
  width: number;
  height: number;
};

export async function extractFrames(file: File | Blob): Promise<ExtractedFrames> {
  const { video, url, cleanup } = await loadVideo(file);

  try {
    if (video.readyState < 2) {
      await new Promise<void>((resolve) => {
        video.addEventListener("loadeddata", () => resolve(), { once: true });
        video.load();
      });
    }

    const duration = Number.isFinite(video.duration) ? video.duration : 0;

    await seekTo(video, 0.01);
    const firstFrame = captureFrame(video);

    const lastTime = duration > 0.15 ? duration - 0.08 : Math.max(duration - 0.01, 0);
    await seekTo(video, lastTime);
    const lastFrame = captureFrame(video);

    return {
      firstFrame,
      lastFrame,
      duration,
      width: video.videoWidth || 0,
      height: video.videoHeight || 0,
    };
  } finally {
    URL.revokeObjectURL(url);
    cleanup();
  }
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
