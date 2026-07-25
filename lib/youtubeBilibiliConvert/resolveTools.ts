/**
 * Locate yt-dlp / ffmpeg / ffprobe for YouTube-Bilibili conversion.
 */

import { access } from "fs/promises";
import { constants } from "fs";
import { join, dirname } from "path";
import { which } from "@/lib/imageVoiceVideo/resolveFfmpeg";
import { resolveFfmpeg } from "@/lib/imageVoiceVideo/resolveFfmpeg";

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export type ConvertTools = {
  ytDlp: string | null;
  ffmpeg: string | null;
  ffprobe: string | null;
  available: boolean;
  installHint: string[];
};

function installHints(): string[] {
  if (process.platform === "win32") {
    return [
      "Windows：以系統管理員開啟終端機後執行：",
      "  winget install yt-dlp.yt-dlp Gyan.FFmpeg",
      "安裝完成後重新啟動本服務／開發伺服器。",
    ];
  }
  if (process.platform === "darwin") {
    return [
      "macOS：",
      "  brew install yt-dlp ffmpeg",
    ];
  }
  return [
    "Linux：請用套件管理器安裝 yt-dlp 與 ffmpeg，並確認 PATH 可執行。",
    "  例：sudo apt install ffmpeg && pipx install yt-dlp",
  ];
}

export async function resolveYtDlp(): Promise<string | null> {
  const cwd = /* turbopackIgnore: true */ process.cwd();
  const names =
    process.platform === "win32" ? ["yt-dlp.exe", "yt-dlp"] : ["yt-dlp"];

  const candidates: string[] = [];
  for (const name of names) {
    candidates.push(join(cwd, ".vendor", "yt-dlp", name));
    candidates.push(join(cwd, ".vendor", name));
  }

  for (const p of candidates) {
    if (await fileExists(p)) {
      console.log(`[yt-dlp] using: ${p}`);
      return p;
    }
  }

  // Windows `where yt-dlp` finds yt-dlp.exe via PATHEXT
  const fromPath = await which("yt-dlp");
  if (fromPath) {
    console.log(`[yt-dlp] using PATH: ${fromPath}`);
    return fromPath;
  }
  return null;
}

export async function resolveFfprobe(ffmpegPath: string | null): Promise<string | null> {
  if (ffmpegPath) {
    const dir = dirname(ffmpegPath);
    const name = process.platform === "win32" ? "ffprobe.exe" : "ffprobe";
    const sibling = join(dir, name);
    if (await fileExists(sibling)) return sibling;
  }

  const fromPath = await which("ffprobe");
  return fromPath;
}

export async function resolveConvertTools(): Promise<ConvertTools> {
  const [ytDlp, ffmpeg] = await Promise.all([resolveYtDlp(), resolveFfmpeg()]);
  const ffprobe = await resolveFfprobe(ffmpeg);
  const available = Boolean(ytDlp && ffmpeg);
  return {
    ytDlp,
    ffmpeg,
    ffprobe,
    available,
    installHint: available ? [] : installHints(),
  };
}
