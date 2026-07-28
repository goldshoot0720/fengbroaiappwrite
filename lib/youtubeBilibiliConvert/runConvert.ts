/**
 * Run yt-dlp for YouTube / Bilibili → MP3 or MP4.
 * Adapted from huang1988pioneer/YoutubeBilibiliMP4MP3Converter.
 */

import { spawn } from "child_process";
import { readdir, stat } from "fs/promises";
import { join, dirname } from "path";
import type { ConvertTools } from "./resolveTools";
import { detectPlatform, type MediaPlatform } from "./url";

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

function isServerless(): boolean {
  return Boolean(
    process.env.VERCEL ||
      process.env.VERCEL_ENV ||
      process.env.AWS_LAMBDA_FUNCTION_NAME
  );
}

/** Stay under Vercel Hobby maxDuration (300s) with room for zip/response. */
export function defaultTimeoutMsPerUrl(): number {
  if (isServerless()) return 250_000;
  return 10 * 60 * 1000;
}

function getMp4FormatSelector(mp4Quality: Mp4Quality): string {
  const maxHeight = (() => {
    if (isServerless()) {
      // 4K/1080p often OOM or time out on Hobby; cap for cloud.
      return mp4Quality === "4K" ? 1080 : 720;
    }
    return mp4Quality === "4K" ? 2160 : 1080;
  })();

  if (isServerless()) {
    // Prefer single progressive file, then merge, then best.
    return [
      `best[height<=${maxHeight}][ext=mp4]/best[height<=${maxHeight}]`,
      `bestvideo*[height<=${maxHeight}]+bestaudio/best[height<=${maxHeight}]`,
      "best",
    ].join("/");
  }
  return `bestvideo*[height<=${maxHeight}]+bestaudio/best[height<=${maxHeight}]/best`;
}

function buildArgs(opts: {
  url: string;
  outputDir: string;
  format: OutputFormat;
  mp4Quality: Mp4Quality;
  ffmpegPath: string;
  platform: MediaPlatform;
  /** Absolute path to a Netscape cookies.txt for yt-dlp --cookies */
  cookiesPath?: string | null;
}): string[] {
  const {
    url,
    outputDir,
    format,
    mp4Quality,
    ffmpegPath,
    platform,
    cookiesPath,
  } = opts;
  const args: string[] = [];

  // Fail faster / cleaner logs when the platform hangs or rate-limits.
  args.push("--no-playlist");
  args.push("--newline");
  args.push("--no-colors");
  args.push("--socket-timeout", "30");
  args.push("--retries", "3");
  args.push("--fragment-retries", "3");
  args.push("--concurrent-fragments", isServerless() ? "1" : "4");

  if (format === "MP4") {
    args.push("--format", getMp4FormatSelector(mp4Quality));
    args.push("--merge-output-format", "mp4");
  } else {
    args.push("--extract-audio", "--audio-format", "mp3", "--audio-quality", "0");
    // Thumbnail embed needs ffmpeg write; fine locally, skip on serverless to save time.
    if (!isServerless()) {
      args.push("--embed-thumbnail");
    }
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

  if (platform === "youtube") {
    // Datacenter IPs often fail on default web client. Prefer clients that
    // work without browser cookies when possible; fall through order.
    // See yt-dlp wiki: android / ios / tv / mweb players.
    args.push(
      "--extractor-args",
      "youtube:player_client=android,ios,tv,mweb,web"
    );
    args.push(
      "--user-agent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    );
  }

  if (platform === "bilibili") {
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

  // Cookies: request-scoped path wins, else env file path.
  const cookiesFile =
    cookiesPath?.trim() || process.env.YT_DLP_COOKIES_PATH?.trim() || "";
  if (cookiesFile) {
    args.push("--cookies", cookiesFile);
  }
  const proxy = process.env.YT_DLP_PROXY?.trim();
  if (proxy) {
    args.push("--proxy", proxy);
  }

  args.push(url);
  return args;
}

function annotateLog(line: string, platform: MediaPlatform): string[] {
  const out: string[] = [line];
  const lower = line.toLowerCase();

  if (
    line.includes("Sign in to confirm") ||
    line.includes("not a bot") ||
    lower.includes("confirm you're not a bot") ||
    lower.includes("confirm you’re not a bot")
  ) {
    out.push(
      "YouTube 判定為機器人／資料中心 IP。請在工具裡貼上 Netscape cookies.txt，或設定環境變數 YT_DLP_COOKIES / YT_DLP_COOKIES_PATH / YT_DLP_PROXY。匯出說明：https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies"
    );
  }
  if (
    line.includes("HTTP Error 429") ||
    lower.includes("too many requests") ||
    lower.includes("rate-limit")
  ) {
    out.push("平台限流（429）：請稍後再試或使用住宅代理（YT_DLP_PROXY）。");
  }
  if (line.includes("HTTP Error 403") || lower.includes("forbidden")) {
    out.push(
      "HTTP 403：可能是地區限制、版權、或 IP 被擋。本機或 cookies/proxy 較容易成功。"
    );
  }
  if (line.includes("HTTP Error 412") || line.includes("Precondition Failed")) {
    out.push(
      "Bilibili 回傳 412：可能是網站防護、地區/會員限制。請確認瀏覽器可播放後再試，或於本機桌面版搭配 cookies。"
    );
  }
  if (
    platform === "youtube" &&
    (lower.includes("unable to extract") ||
      lower.includes("failed to extract") ||
      lower.includes("no video formats"))
  ) {
    out.push(
      "無法解析 YouTube 格式：請更新 yt-dlp，或在自架環境使用 cookies。"
    );
  }
  return out;
}

function runProcess(
  file: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
  onLog: (line: string) => void,
  idleTimeoutMs: number
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, {
      env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let settled = false;
    let lastActivity = Date.now();

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(hardTimer);
      clearInterval(idleTimer);
      fn();
    };

    const hardTimer = setTimeout(() => {
      finish(() => {
        child.kill("SIGKILL");
        reject(
          new Error(
            `yt-dlp 逾時（${Math.round(timeoutMs / 1000)} 秒）。雲端函式有上限；長影片請用本機／Docker。`
          )
        );
      });
    }, timeoutMs);

    // If yt-dlp prints nothing for a while after start, YouTube is usually stuck/blocked.
    const idleTimer = setInterval(() => {
      if (settled) return;
      const idle = Date.now() - lastActivity;
      if (idle >= idleTimeoutMs) {
        finish(() => {
          child.kill("SIGKILL");
          reject(
            new Error(
              `yt-dlp 超過 ${Math.round(idleTimeoutMs / 1000)} 秒無輸出（可能卡在 YouTube 解析或 IP 被擋）。` +
                (isServerless()
                  ? " Vercel 資料中心 IP 常被 YouTube 封鎖，建議本機桌面版或自架 + cookies/proxy。"
                  : "")
            )
          );
        });
      }
    }, 5_000);

    const feed = (buf: Buffer) => {
      lastActivity = Date.now();
      const text = buf.toString("utf8");
      for (const line of text.split(/\r?\n/)) {
        if (line.trim()) onLog(line);
      }
    };

    child.stdout?.on("data", feed);
    child.stderr?.on("data", feed);

    child.on("error", (err) => {
      finish(() => reject(err));
    });

    child.on("close", (code) => {
      finish(() => resolve(code ?? 1));
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
  cookiesPath?: string | null;
}): Promise<ConvertOneResult> {
  const { tools, url, outputDir, format, mp4Quality, cookiesPath } = opts;
  const timeoutMs = opts.timeoutMs ?? defaultTimeoutMsPerUrl();
  const idleTimeoutMs = isServerless() ? 90_000 : 180_000;
  const platform = detectPlatform(url);
  const logs: string[] = [];
  const onLog = (line: string) => {
    for (const l of annotateLog(line, platform)) {
      logs.push(l);
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
    platform,
    cookiesPath,
  });

  if (isServerless() && format === "MP4" && mp4Quality !== "1080p") {
    onLog(
      `雲端環境已自動限制畫質（請求 ${mp4Quality} → 實際上限約 720p～1080p）以避免逾時/OOM`
    );
  } else if (isServerless() && format === "MP4") {
    onLog("雲端環境 MP4 建議使用較短影片；畫質已偏向 720p progressive 以降低失敗率");
  }

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
    exitCode = await runProcess(
      tools.ytDlp,
      args,
      env,
      timeoutMs,
      onLog,
      idleTimeoutMs
    );
  } catch (err) {
    onLog(err instanceof Error ? err.message : String(err));
    return { url, ok: false, exitCode: 1, logs, files: [] };
  }

  const files = await listNewMediaFiles(outputDir, beforeNames);
  const hasMedia = files.some((f) => /\.(mp3|mp4|m4a|webm|mkv|opus)$/i.test(f));

  if (!hasMedia && exitCode !== 0 && platform === "youtube" && isServerless()) {
    onLog(
      "提示：Vercel 等雲端 IP 經常無法完成 YouTube 下載。工具鏈已就緒不代表平台允許；請改本機或自架。"
    );
  }

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
  cookiesPath?: string | null;
}): Promise<ConvertBatchResult> {
  const results: ConvertOneResult[] = [];
  const allFiles: string[] = [];
  const logs: string[] = [];
  const timeoutMsPerUrl = opts.timeoutMsPerUrl ?? defaultTimeoutMsPerUrl();

  logs.push(
    `yt-dlp: ${opts.tools.ytDlp || "找不到"}${
      opts.tools.ytDlpSource ? ` (${opts.tools.ytDlpSource})` : ""
    }`
  );
  logs.push(`ffmpeg: ${opts.tools.ffmpeg || "找不到"}`);
  logs.push(`ffprobe: ${opts.tools.ffprobe || "找不到"}`);
  logs.push(`輸出格式: ${opts.format}`);
  if (opts.format === "MP4") logs.push(`MP4 畫質: ${opts.mp4Quality}`);
  logs.push(
    `cookies: ${
      opts.cookiesPath
        ? "已提供（本次請求）"
        : process.env.YT_DLP_COOKIES_PATH
          ? "YT_DLP_COOKIES_PATH"
          : process.env.YT_DLP_COOKIES
            ? "YT_DLP_COOKIES 環境變數"
            : "未提供（YouTube 雲端常需要）"
    }`
  );
  if (isServerless()) {
    logs.push(
      `執行環境: serverless（每支約 ${Math.round(timeoutMsPerUrl / 1000)}s 上限；YouTube 常擋資料中心 IP）`
    );
  }
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
      timeoutMs: timeoutMsPerUrl,
      cookiesPath: opts.cookiesPath,
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
