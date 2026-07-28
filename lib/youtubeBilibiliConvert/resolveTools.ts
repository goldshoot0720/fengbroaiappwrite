/**
 * Locate yt-dlp / ffmpeg / ffprobe for YouTube-Bilibili conversion.
 *
 * On Vercel (and other bare Linux hosts) system packages are usually missing.
 * ffmpeg comes from optional `@ffmpeg-installer/*` packages; yt-dlp is
 * auto-downloaded once into the process tmp dir (standalone GitHub release).
 */

import { access, chmod, mkdir, rename, stat, unlink } from "fs/promises";
import { constants, createWriteStream } from "fs";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { which, resolveFfmpeg } from "@/lib/imageVoiceVideo/resolveFfmpeg";

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function isExecutable(p: string): Promise<boolean> {
  try {
    await access(p, constants.F_OK | constants.X_OK);
    return true;
  } catch {
    // Windows often lacks X_OK semantics; F_OK is enough there.
    if (process.platform === "win32") return fileExists(p);
    return false;
  }
}

export type ConvertTools = {
  ytDlp: string | null;
  ffmpeg: string | null;
  ffprobe: string | null;
  available: boolean;
  installHint: string[];
  /** How yt-dlp was resolved (for logs / UI). */
  ytDlpSource?: "env" | "vendor" | "path" | "auto-download" | null;
};

function isVercel(): boolean {
  return Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
}

function installHints(missing: { ytDlp: boolean; ffmpeg: boolean }): string[] {
  const lines: string[] = [];
  if (isVercel()) {
    lines.push(
      "目前部署在 Vercel Serverless：系統無法 apt/brew 安裝套件。",
      "伺服器會嘗試自動下載 yt-dlp 獨立執行檔到暫存目錄；ffmpeg 使用 npm 套件。"
    );
    if (missing.ytDlp) {
      lines.push(
        "yt-dlp 自動下載失敗時，請設定環境變數 YT_DLP_PATH，或改用可安裝系統套件的主機／Docker。"
      );
    }
    if (missing.ffmpeg) {
      lines.push(
        "ffmpeg 未找到：請確認 optionalDependencies 中的 @ffmpeg-installer/* 有安裝。"
      );
    }
    lines.push(
      "備註：雲端 IP 常被 YouTube / Bilibili 限制，若仍失敗請改本機桌面版或自架主機。"
    );
    return lines;
  }
  if (process.platform === "win32") {
    return [
      "Windows：以系統管理員開啟終端機後執行：",
      "  winget install yt-dlp.yt-dlp Gyan.FFmpeg",
      "安裝完成後重新啟動本服務／開發伺服器。",
      "亦可設定 YT_DLP_PATH，或把 yt-dlp.exe 放到 .vendor/yt-dlp/。",
    ];
  }
  if (process.platform === "darwin") {
    return [
      "macOS：",
      "  brew install yt-dlp ffmpeg",
      "亦可設定 YT_DLP_PATH，或把 yt-dlp 放到 .vendor/yt-dlp/。",
    ];
  }
  return [
    "Linux：請用套件管理器安裝 yt-dlp 與 ffmpeg，並確認 PATH 可執行。",
    "  例：sudo apt install ffmpeg && pipx install yt-dlp",
    "Docker／自架：映像需包含 yt-dlp 與 ffmpeg。",
    "亦可設定 YT_DLP_PATH，或把 yt-dlp 放到 .vendor/yt-dlp/。",
  ];
}

/** Standalone yt-dlp asset names on GitHub Releases. */
function ytdlpReleaseAsset(): { asset: string; fileName: string } {
  if (process.platform === "win32") {
    return { asset: "yt-dlp.exe", fileName: "yt-dlp.exe" };
  }
  if (process.platform === "darwin") {
    return { asset: "yt-dlp_macos", fileName: "yt-dlp" };
  }
  // Vercel / most Linux serverless = x64; arm64 uses aarch64 build.
  if (process.arch === "arm64") {
    return { asset: "yt-dlp_linux_aarch64", fileName: "yt-dlp" };
  }
  return { asset: "yt-dlp_linux", fileName: "yt-dlp" };
}

function vendorCandidates(): string[] {
  const cwd = /* turbopackIgnore: true */ process.cwd();
  const names =
    process.platform === "win32" ? ["yt-dlp.exe", "yt-dlp"] : ["yt-dlp"];
  const out: string[] = [];
  for (const name of names) {
    out.push(join(cwd, ".vendor", "yt-dlp", name));
    out.push(join(cwd, ".vendor", name));
  }
  return out;
}

function cacheYtDlpPath(): string {
  const { fileName } = ytdlpReleaseAsset();
  return join(tmpdir(), "fengbro-tools", "yt-dlp", fileName);
}

let downloadPromise: Promise<string | null> | null = null;

async function downloadYtDlpBinary(dest: string): Promise<string | null> {
  const { asset } = ytdlpReleaseAsset();
  // Pin to a known-good release tag when LATEST fails; prefer latest first.
  const urls = [
    `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`,
    `https://github.com/yt-dlp/yt-dlp/releases/download/2026.07.04/${asset}`,
  ];

  await mkdir(dirname(dest), { recursive: true });

  for (const url of urls) {
    try {
      console.log(`[yt-dlp] downloading: ${url}`);
      const res = await fetch(url, {
        redirect: "follow",
        headers: { "User-Agent": "fengbroaiappwrite/yt-dlp-bootstrap" },
      });
      if (!res.ok || !res.body) {
        console.warn(`[yt-dlp] download HTTP ${res.status} for ${url}`);
        continue;
      }

      const partial = `${dest}.partial`;
      // Node 18+ fetch body is a Web ReadableStream
      const nodeStream = Readable.fromWeb(
        res.body as import("stream/web").ReadableStream
      );
      await pipeline(nodeStream, createWriteStream(partial));

      // Basic sanity: standalone builds are multi-MB
      const st = await stat(partial);
      if (st.size < 1_000_000) {
        console.warn(`[yt-dlp] download too small (${st.size} bytes), skip`);
        try {
          await unlink(partial);
        } catch {
          /* ignore */
        }
        continue;
      }

      // Atomic-ish replace
      try {
        await unlink(dest);
      } catch {
        /* ignore */
      }
      await rename(partial, dest);

      if (process.platform !== "win32") {
        await chmod(dest, 0o755);
      }

      console.log(`[yt-dlp] cached at: ${dest} (${st.size} bytes)`);
      return dest;
    } catch (err) {
      console.warn(
        `[yt-dlp] download failed:`,
        err instanceof Error ? err.message : err
      );
    }
  }
  return null;
}

/**
 * Ensure a yt-dlp binary exists (download once per warm instance if needed).
 */
async function ensureYtDlpDownloaded(): Promise<string | null> {
  const dest = cacheYtDlpPath();
  if (await isExecutable(dest)) {
    console.log(`[yt-dlp] using cache: ${dest}`);
    return dest;
  }
  if (!downloadPromise) {
    downloadPromise = downloadYtDlpBinary(dest).finally(() => {
      // Keep resolved path; allow retry only if failed
    });
  }
  const path = await downloadPromise;
  if (!path) {
    downloadPromise = null; // allow retry on next call
  }
  return path;
}

export async function resolveYtDlp(opts?: {
  /** When true (default), auto-download standalone binary if missing. */
  allowDownload?: boolean;
}): Promise<{ path: string | null; source: ConvertTools["ytDlpSource"] }> {
  const allowDownload = opts?.allowDownload !== false;

  const envPath = process.env.YT_DLP_PATH?.trim();
  if (envPath && (await fileExists(envPath))) {
    console.log(`[yt-dlp] using env YT_DLP_PATH: ${envPath}`);
    return { path: envPath, source: "env" };
  }

  for (const p of vendorCandidates()) {
    if (await fileExists(p)) {
      if (process.platform !== "win32") {
        try {
          await chmod(p, 0o755);
        } catch {
          /* ignore */
        }
      }
      console.log(`[yt-dlp] using vendor: ${p}`);
      return { path: p, source: "vendor" };
    }
  }

  const fromPath = await which("yt-dlp");
  if (fromPath) {
    console.log(`[yt-dlp] using PATH: ${fromPath}`);
    return { path: fromPath, source: "path" };
  }

  if (allowDownload) {
    const downloaded = await ensureYtDlpDownloaded();
    if (downloaded) {
      return { path: downloaded, source: "auto-download" };
    }
  }

  return { path: null, source: null };
}

export async function resolveFfprobe(
  ffmpegPath: string | null
): Promise<string | null> {
  if (ffmpegPath) {
    const dir = dirname(ffmpegPath);
    const name = process.platform === "win32" ? "ffprobe.exe" : "ffprobe";
    const sibling = join(dir, name);
    if (await fileExists(sibling)) return sibling;
  }

  // optionalDependencies: @ffprobe-installer/<platform> (path-only, no dynamic require)
  const cwd = /* turbopackIgnore: true */ process.cwd();
  const platform = `${process.platform}-${process.arch}`;
  const binary = process.platform === "win32" ? "ffprobe.exe" : "ffprobe";
  const installerPath = join(
    cwd,
    "node_modules",
    "@ffprobe-installer",
    platform,
    binary
  );
  if (await fileExists(installerPath)) {
    console.log(`[ffprobe] using: ${installerPath}`);
    return installerPath;
  }

  const vendor = join(cwd, ".vendor", "ffmpeg", binary);
  if (await fileExists(vendor)) return vendor;

  return which("ffprobe");
}

export async function resolveConvertTools(opts?: {
  allowDownload?: boolean;
}): Promise<ConvertTools> {
  const [yt, ffmpeg] = await Promise.all([
    resolveYtDlp({ allowDownload: opts?.allowDownload }),
    resolveFfmpeg(),
  ]);
  const ffprobe = await resolveFfprobe(ffmpeg);
  const available = Boolean(yt.path && ffmpeg);
  return {
    ytDlp: yt.path,
    ffmpeg,
    ffprobe,
    available,
    ytDlpSource: yt.source,
    installHint: available
      ? []
      : installHints({ ytDlp: !yt.path, ffmpeg: !ffmpeg }),
  };
}
