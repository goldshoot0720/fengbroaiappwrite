/**
 * Run yt-dlp for YouTube / Bilibili → MP3 or MP4.
 * Adapted from huang1988pioneer/YoutubeBilibiliMP4MP3Converter.
 */

import { spawn } from "child_process";
import { readdir, stat } from "fs/promises";
import { join, dirname } from "path";
import type { ConvertTools } from "./resolveTools";
import { detectPlatform } from "./url";

export type OutputFormat = "MP3" | "MP4";
export type Mp4Quality = "1080p" | "4K";

export type ConvertOneResult = {
  url: string;
  ok: boolean;
  exitCode: number;
  logs: string[];
  files: string[];
};

export type ConvertBatchResult = {
  results: ConvertOneResult[];
  allFiles: string[];
  logs: string[];
};

function getMp4FormatSelector(mp4Quality: Mp4Quality): string {
  const maxHeight = mp4Quality === "4K" ? 2160 : 1080;
  return `bestvideo*[height<=${maxHeight}]+bestaudio/best[height<=${maxHeight}]/best`;
}

function buildArgs(opts: {
  url: string;
  outputDir: string;
  format: OutputFormat;
  mp4Quality: Mp4Quality;
  ffmpegPath: string;
}): string[] {
  const { url, outputDir, format, mp4Quality, ffmpegPath } = opts;
  const args: string[] = [];

  if (format === "MP4") {
    args.push("--format", getMp4FormatSelector(mp4Quality));
    args.push("--merge-output-format", "mp4");
  } else {
    args.push("--extract-audio", "--audio-format", "mp3", "--audio-quality", "0");
    args.push("--embed-thumbnail");
  }

  args.push("--encoding", "utf-8");
  args.push("--ffmpeg-location", dirname(ffmpegPath) || ffmpegPath);
  args.push(
    "--write-subs",
    "--write-auto-subs",
    "--sub-langs",
    "zh.*,zh-Hans,zh-Hant,zh-CN,zh-TW,zh",
    "--convert-subs",
    "srt"
  );
  args.push("--add-metadata");
  args.push("--paths", outputDir);
  args.push("--output", "%(title).180B [%(id)s].%(ext)s");
  args.push("--no-overwrites");

  if (detectPlatform(url) === "bilibili") {
    args.push(
      "--add-headers",
      "User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    );
    args.push("--add-headers", "Referer:https://www.bilibili.com/");
    args.push(
      "--add-headers",
      "Accept-Language:zh-CN,zh-TW;q=0.9,zh;q=0.8,en;q=0.7"
    );
  }

  args.push(url);
  return args;
}

function runProcess(
  file: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
  onLog: (line: string) => void
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, {
      env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new Error(`yt-dlp 逾時（${Math.round(timeoutMs / 1000)} 秒）`));
    }, timeoutMs);

    const feed = (buf: Buffer) => {
      const text = buf.toString("utf8");
      for (const line of text.split(/\r?\n/)) {
        if (line.trim()) onLog(line);
      }
    };

    child.stdout?.on("data", feed);
    child.stderr?.on("data", feed);

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(code ?? 1);
    });
  });
}

async function listNewMediaFiles(
  dir: string,
  before: Set<string>
): Promise<string[]> {
  const names = await readdir(dir);
  const out: string[] = [];
  for (const name of names) {
    const full = join(dir, name);
    if (before.has(full)) continue;
    try {
      const st = await stat(full);
      if (!st.isFile() || st.size === 0) continue;
      if (/\.(part|ytdl|temp)$/i.test(name)) continue;
      if (/\.(mp3|mp4|m4a|webm|mkv|opus|srt|vtt|jpg|png|webp)$/i.test(name)) {
        out.push(full);
      }
    } catch {
      /* ignore */
    }
  }
  return out;
}

export async function convertOneUrl(opts: {
  tools: ConvertTools;
  url: string;
  outputDir: string;
  format: OutputFormat;
  mp4Quality: Mp4Quality;
  timeoutMs?: number;
}): Promise<ConvertOneResult> {
  const { tools, url, outputDir, format, mp4Quality } = opts;
  const timeoutMs = opts.timeoutMs ?? 10 * 60 * 1000;
  const logs: string[] = [];
  const onLog = (line: string) => {
    logs.push(line);
    if (line.includes("HTTP Error 412") || line.includes("Precondition Failed")) {
      logs.push(
        "Bilibili 回傳 412：可能是網站防護、地區/會員限制。請確認瀏覽器可播放後再試，或於本機桌面版搭配 cookies。"
      );
    }
  };

  if (!tools.ytDlp || !tools.ffmpeg) {
    return {
      url,
      ok: false,
      exitCode: 127,
      logs: ["找不到 yt-dlp 或 ffmpeg", ...tools.installHint],
      files: [],
    };
  }

  const beforeNames = new Set(
    (await readdir(outputDir)).map((n) => join(outputDir, n))
  );

  const args = buildArgs({
    url,
    outputDir,
    format,
    mp4Quality,
    ffmpegPath: tools.ffmpeg,
  });

  onLog(
    `$ yt-dlp ${args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(" ")}`
  );

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PYTHONIOENCODING: "utf-8",
    PYTHONUTF8: "1",
  };

  // yt-dlp looks up ffmpeg/ffprobe via PATH or --ffmpeg-location (dir).
  const pathSep = process.platform === "win32" ? ";" : ":";
  const extraDirs = new Set<string>();
  extraDirs.add(dirname(tools.ffmpeg));
  if (tools.ffprobe) extraDirs.add(dirname(tools.ffprobe));
  env.PATH = `${[...extraDirs].join(pathSep)}${pathSep}${env.PATH || ""}`;

  let exitCode = 1;
  try {
    exitCode = await runProcess(tools.ytDlp, args, env, timeoutMs, onLog);
  } catch (err) {
    onLog(err instanceof Error ? err.message : String(err));
    return { url, ok: false, exitCode: 1, logs, files: [] };
  }

  const files = await listNewMediaFiles(outputDir, beforeNames);
  const hasMedia = files.some((f) => /\.(mp3|mp4|m4a|webm|mkv|opus)$/i.test(f));
  return {
    url,
    ok: exitCode === 0 && hasMedia,
    exitCode,
    logs,
    files,
  };
}

export async function convertUrls(opts: {
  tools: ConvertTools;
  urls: string[];
  outputDir: string;
  format: OutputFormat;
  mp4Quality: Mp4Quality;
  timeoutMsPerUrl?: number;
}): Promise<ConvertBatchResult> {
  const results: ConvertOneResult[] = [];
  const allFiles: string[] = [];
  const logs: string[] = [];

  logs.push(
    `yt-dlp: ${opts.tools.ytDlp || "找不到"}${
      opts.tools.ytDlpSource ? ` (${opts.tools.ytDlpSource})` : ""
    }`
  );
  logs.push(`ffmpeg: ${opts.tools.ffmpeg || "找不到"}`);
  logs.push(`ffprobe: ${opts.tools.ffprobe || "找不到"}`);
  logs.push(`輸出格式: ${opts.format}`);
  if (opts.format === "MP4") logs.push(`MP4 畫質: ${opts.mp4Quality}`);
  logs.push(`準備轉換 ${opts.urls.length} 個項目`);

  for (let i = 0; i < opts.urls.length; i++) {
    const url = opts.urls[i];
    logs.push("");
    logs.push(`[${i + 1}/${opts.urls.length}] ${url}`);
    const one = await convertOneUrl({
      tools: opts.tools,
      url,
      outputDir: opts.outputDir,
      format: opts.format,
      mp4Quality: opts.mp4Quality,
      timeoutMs: opts.timeoutMsPerUrl,
    });
    results.push(one);
    logs.push(...one.logs);
    if (!one.ok) {
      logs.push(`[${i + 1}/${opts.urls.length}] 轉換失敗，結束碼 ${one.exitCode}`);
    } else {
      logs.push(
        `[${i + 1}/${opts.urls.length}] 完成：${one.files
          .map((f) => f.split(/[/\\]/).pop())
          .join(", ")}`
      );
    }
    allFiles.push(...one.files);
  }

  return { results, allFiles, logs };
}
