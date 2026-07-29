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
/** Preferred MP4 height ladder: 1080p first, then 720p. */
export type Mp4Quality = "1080p" | "720p";

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

/**
 * Single yt-dlp -f string: prefer 1080 → 720 → progressive 18.
 * (Internal `/` fallbacks; do not explode into many full runs.)
 */
function getPrimaryFormatSelector(
  format: OutputFormat,
  mp4Quality: Mp4Quality,
  platform: MediaPlatform
): string {
  if (format === "MP3") {
    if (platform === "youtube") {
      return "bestaudio/best[ext=mp4]/18/best";
    }
    return "bestaudio/best";
  }
  if (mp4Quality === "720p") {
    return [
      "bestvideo*[height<=720]+bestaudio/best[height<=720]",
      "best[height<=720][ext=mp4]/18/best",
    ].join("/");
  }
  // Prefer true 1080, then 720, then progressive 360 (format 18).
  return [
    "bestvideo*[height<=1080]+bestaudio/best[height<=1080]",
    "bestvideo*[height<=720]+bestaudio/best[height<=720]",
    "best[height<=720][ext=mp4]/18/best",
  ].join("/");
}

/** HLS ids from web_safari: 96=1080p, 95=720p, 94=480p, 93=360p. */
function getHlsFormatSelector(
  format: OutputFormat,
  mp4Quality: Mp4Quality
): string {
  if (format === "MP3") return "bestaudio/best/18";
  if (mp4Quality === "720p") return "95/94/93/18/best";
  return "96/95/94/93/18/best";
}

type DownloadAttempt = {
  label: string;
  formatSelector: string;
  /** youtube:player_client=… value */
  playerClients: string;
  useCookies: boolean;
  /** When true, this attempt needs EJS signature solving (web clients). */
  needsEjs: boolean;
};

/**
 * Ordered download plans (few full yt-dlp runs).
 *
 * Why you often saw only 360p: default web/android under SABR only list
 * progressive format 18. High-quality clients:
 *   - tv_embedded / mediaconnect → DASH up to 1080p (verified)
 *   - web_safari → HLS 96/95/…
 * Last resort: android progressive 18.
 */
function getDownloadAttempts(
  format: OutputFormat,
  mp4Quality: Mp4Quality,
  platform: MediaPlatform,
  hasCookies: boolean
): DownloadAttempt[] {
  const primary = getPrimaryFormatSelector(format, mp4Quality, platform);
  const hls = getHlsFormatSelector(format, mp4Quality);
  const progressive =
    format === "MP3" ? "18/bestaudio/best" : "18/best[ext=mp4]/best";

  if (platform !== "youtube") {
    return [
      {
        label: primary,
        formatSelector: primary,
        playerClients: "",
        useCookies: hasCookies,
        needsEjs: false,
      },
    ];
  }

  const attempts: DownloadAttempt[] = [];

  // Prefer clients that still expose 720/1080 (not just format 18).
  for (const client of ["tv_embedded", "mediaconnect"] as const) {
    attempts.push({
      label: `${hasCookies ? "cookies+" : ""}${client} · 1080/720 DASH`,
      formatSelector: primary,
      playerClients: client,
      useCookies: hasCookies,
      needsEjs: true,
    });
  }

  attempts.push({
    label: `${hasCookies ? "cookies+" : ""}web_safari · HLS`,
    formatSelector: hls,
    playerClients: "web_safari",
    useCookies: hasCookies,
    needsEjs: true,
  });

  attempts.push({
    label: `${hasCookies ? "cookies+" : ""}web · fallback`,
    formatSelector: primary,
    playerClients: "web,tv,mweb",
    useCookies: hasCookies,
    needsEjs: true,
  });

  // Last resort: 360p progressive (reliable on datacenter IPs)
  attempts.push({
    label: `android · progressive 360p`,
    formatSelector: progressive,
    playerClients: "android,ios,tv",
    useCookies: false,
    needsEjs: false,
  });

  return attempts;
}

function resolveNodeRuntimeSpec(): string {
  // Vercel/Lambda: process.execPath is the node binary yt-dlp can spawn.
  const p = process.execPath?.trim();
  if (p) return `node:${p}`;
  return "node";
}

function buildArgs(opts: {
  url: string;
  outputDir: string;
  format: OutputFormat;
  ffmpegPath: string;
  platform: MediaPlatform;
  /** Absolute path to a Netscape cookies.txt for yt-dlp --cookies */
  cookiesPath?: string | null;
  attempt: DownloadAttempt;
}): string[] {
  const {
    url,
    outputDir,
    format,
    ffmpegPath,
    platform,
    cookiesPath,
    attempt,
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

  args.push("--format", attempt.formatSelector);

  if (format === "MP4") {
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

  // Prefer explicit path from convertOneUrl; do not re-read env when null
  // (android fallback intentionally clears cookies).
  const cookiesFile = cookiesPath?.trim() || "";

  if (platform === "youtube") {
    // EJS: standalone yt-dlp binary needs remote challenge scripts + a JS runtime.
    // Without this on Vercel, web clients only see storyboards ("Only images").
    // https://github.com/yt-dlp/yt-dlp/wiki/EJS
    args.push("--remote-components", "ejs:github");
    args.push("--js-runtimes", resolveNodeRuntimeSpec());

    if (attempt.playerClients) {
      args.push(
        "--extractor-args",
        `youtube:player_client=${attempt.playerClients}`
      );
    }
    args.push(
      "--user-agent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    );
    args.push("--referer", "https://www.youtube.com/");
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

  if (attempt.useCookies && cookiesFile) {
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
  // Avoid false positives from "may yield HTTP Error 403" PO-token warnings.
  if (
    /HTTP Error 403:\s*Forbidden/i.test(line) ||
    (/^ERROR:.*\b403\b/i.test(line) && /forbidden|unable to download/i.test(line))
  ) {
    out.push(
      "HTTP 403：可能是 DASH/SABR 串流被擋、地區限制或 IP。會自動降畫質／改 android client；若仍失敗請更新 yt-dlp 或改本機桌面版。"
    );
  }
  if (
    /Signature solving failed/i.test(line) ||
    /n challenge solving failed/i.test(line) ||
    /Only images are available/i.test(line)
  ) {
    out.push(
      "YouTube JS challenge 失敗（缺 EJS / Node runtime）。雲端會啟用 --remote-components ejs:github 與 Node，並改試 android progressive。"
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
      lower.includes("no video formats") ||
      lower.includes("requested format is not available"))
  ) {
    out.push(
      "無法解析 YouTube 格式：可能是 JS challenge 未解或 client 被擋。會自動改試其他 client／畫質。"
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

function logsIndicateDownloadBlock(logs: string[]): boolean {
  return logs.some(
    (l) =>
      /HTTP Error 403:\s*Forbidden/i.test(l) ||
      /HTTP Error 429/i.test(l) ||
      /unable to download video data/i.test(l) ||
      /fragment.*not found/i.test(l) ||
      /requested format is not available/i.test(l) ||
      /only images are available/i.test(l)
  );
}

function logsIndicateJsChallengeFail(logs: string[]): boolean {
  return logs.some(
    (l) =>
      /Signature solving failed/i.test(l) ||
      /n challenge solving failed/i.test(l) ||
      /Only images are available/i.test(l) ||
      /challenge solver script/i.test(l)
  );
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

  const resolvedCookies =
    cookiesPath?.trim() || process.env.YT_DLP_COOKIES_PATH?.trim() || "";
  const hasCookies = Boolean(resolvedCookies);
  const attempts = getDownloadAttempts(
    format,
    mp4Quality,
    platform,
    hasCookies
  );

  if (format === "MP4") {
    onLog(
      `畫質策略: 目標 ${
        mp4Quality === "720p" ? "720p" : "1080p"
      }（client: tv_embedded → mediaconnect → web_safari HLS → web → android 360p）`
    );
  }
  if (platform === "youtube") {
    onLog(
      `YouTube JS: --remote-components ejs:github + ${resolveNodeRuntimeSpec()}`
    );
  }
  if (isServerless() && format === "MP4") {
    onLog("雲端環境：長影片／高畫質可能逾時；EJS 失敗時改 android progressive");
  }

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PYTHONIOENCODING: "utf-8",
    PYTHONUTF8: "1",
  };

  // yt-dlp looks up ffmpeg/ffprobe via PATH or --ffmpeg-location (dir).
  // Also put Node's directory on PATH so child "node" resolves if needed.
  const pathSep = process.platform === "win32" ? ";" : ":";
  const extraDirs = new Set<string>();
  extraDirs.add(dirname(tools.ffmpeg));
  if (tools.ffprobe) extraDirs.add(dirname(tools.ffprobe));
  if (process.execPath) extraDirs.add(dirname(process.execPath));
  env.PATH = `${[...extraDirs].join(pathSep)}${pathSep}${env.PATH || ""}`;

  let exitCode = 1;
  let files: string[] = [];
  // Cap concurrent wall-time per attempt; keep room for android fallback.
  const maxPlan = Math.min(attempts.length, isServerless() ? 4 : 6);
  const perAttemptMs = Math.max(
    40_000,
    Math.floor(timeoutMs / Math.max(1, maxPlan))
  );

  let skipNeedsEjs = false;

  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    if (skipNeedsEjs && attempt.needsEjs) {
      onLog(`[跳過] ${attempt.label}（JS challenge 已失敗，改非 EJS client）`);
      continue;
    }

    const attemptLogsStart = logs.length;
    onLog(`[嘗試 ${i + 1}/${attempts.length}] ${attempt.label}`);

    const args = buildArgs({
      url,
      outputDir,
      format,
      ffmpegPath: tools.ffmpeg,
      platform,
      // Only attach cookies when this attempt wants them (android ignores / can worsen).
      cookiesPath: attempt.useCookies ? resolvedCookies : null,
      attempt,
    });

    onLog(
      `$ yt-dlp ${args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(" ")}`
    );

    try {
      exitCode = await runProcess(
        tools.ytDlp,
        args,
        env,
        perAttemptMs,
        onLog,
        idleTimeoutMs
      );
    } catch (err) {
      onLog(err instanceof Error ? err.message : String(err));
      exitCode = 1;
    }

    files = await listNewMediaFiles(outputDir, beforeNames);
    const hasMedia = files.some((f) =>
      /\.(mp3|mp4|m4a|webm|mkv|opus)$/i.test(f)
    );
    if (exitCode === 0 && hasMedia) {
      return { url, ok: true, exitCode, logs, files };
    }

    const attemptSlice = logs.slice(attemptLogsStart);
    if (logsIndicateJsChallengeFail(attemptSlice)) {
      skipNeedsEjs = true;
      onLog(
        "偵測到 JS challenge / 僅有 storyboard → 後續改試 android progressive"
      );
    }

    const moreLeft = attempts.slice(i + 1).some((a) => !(skipNeedsEjs && a.needsEjs));
    if (!moreLeft) break;

    if (
      logsIndicateDownloadBlock(attemptSlice) ||
      logsIndicateJsChallengeFail(attemptSlice) ||
      exitCode !== 0 ||
      !hasMedia
    ) {
      onLog(`[嘗試 ${i + 1}] 失敗（exit ${exitCode}），改下一組…`);
      continue;
    }
    break;
  }

  const hasMedia = files.some((f) =>
    /\.(mp3|mp4|m4a|webm|mkv|opus)$/i.test(f)
  );

  if (!hasMedia && exitCode !== 0 && platform === "youtube" && isServerless()) {
    onLog(
      "提示：Vercel 等雲端 IP 經常無法完成 YouTube 下載。若 android progressive 仍失敗，請用本機桌面版或自架 + 更新 yt-dlp。"
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
