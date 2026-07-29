export const runtime = "nodejs";
// Vercel Hobby max is 300s; Pro allows higher.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { basename, join } from "path";
import {
  convertUrls,
  defaultTimeoutMsPerUrl,
  resolveConvertTools,
  validateAndNormalizeUrls,
  type Mp4Quality,
  type OutputFormat,
} from "@/lib/youtubeBilibiliConvert";

const MAX_URLS = 7;
/** Cap cookies body size (~512KB) to avoid abuse. */
const MAX_COOKIES_CHARS = 512_000;

function normalizeFormat(v: unknown): OutputFormat {
  return String(v || "").toUpperCase() === "MP4" ? "MP4" : "MP3";
}

function normalizeQuality(v: unknown): Mp4Quality {
  const s = String(v || "").trim();
  // Legacy "4K" maps to 1080p (highest supported ladder).
  if (s === "720p") return "720p";
  return "1080p";
}

function asciiFallback(name: string): string {
  return name.replace(/[^\x20-\x7E]+/g, "_").replace(/"/g, "") || "download";
}

function contentDisposition(filename: string): string {
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${asciiFallback(filename)}"; filename*=UTF-8''${encoded}`;
}

function looksLikeNetscapeCookies(text: string): boolean {
  const t = text.trim();
  if (t.length < 20) return false;
  // Netscape cookie file, or header-ish lines with youtube domains
  if (t.includes("# Netscape") || t.includes("# HTTP Cookie File")) return true;
  if (/youtube\.com|google\.com/i.test(t) && /\t/.test(t)) return true;
  // Cookie header style: name=value; name2=value2
  if (/^\s*[\w.-]+=/.test(t) && t.includes("=")) return true;
  return false;
}

/**
 * Resolve cookies file for this request:
 * 1. POST body cookies text (or base64)
 * 2. YT_DLP_COOKIES env (raw Netscape text or base64)
 * 3. YT_DLP_COOKIES_PATH env (existing file on disk)
 */
async function resolveCookiesFile(
  tempDir: string,
  bodyCookies: unknown
): Promise<{ path: string | null; source: string | null; note?: string }> {
  const rawBody =
    typeof bodyCookies === "string" ? bodyCookies.trim() : "";
  const envText = process.env.YT_DLP_COOKIES?.trim() || "";
  const envPath = process.env.YT_DLP_COOKIES_PATH?.trim() || "";

  let text = rawBody || envText;
  if (!text) {
    if (envPath) return { path: envPath, source: "YT_DLP_COOKIES_PATH" };
    return { path: null, source: null };
  }

  if (text.length > MAX_COOKIES_CHARS) {
    return {
      path: null,
      source: null,
      note: `cookies 過長（>${MAX_COOKIES_CHARS} 字元）`,
    };
  }

  // Allow base64-wrapped env (Vercel env UI friendly)
  if (!looksLikeNetscapeCookies(text) && /^[A-Za-z0-9+/=\s]+$/.test(text)) {
    try {
      const decoded = Buffer.from(text.replace(/\s+/g, ""), "base64").toString(
        "utf8"
      );
      if (looksLikeNetscapeCookies(decoded)) text = decoded;
    } catch {
      /* keep original */
    }
  }

  if (!looksLikeNetscapeCookies(text)) {
    return {
      path: null,
      source: null,
      note: "cookies 格式不像 Netscape cookies.txt（需含 youtube.com 等欄位）",
    };
  }

  // yt-dlp expects Netscape format; if user pasted "a=b; c=d" header style,
  // write as-is — yt-dlp may still fail; prefer real cookies.txt.
  const dest = join(tempDir, "cookies.txt");
  await writeFile(dest, text.endsWith("\n") ? text : `${text}\n`, "utf8");
  return {
    path: dest,
    source: rawBody ? "request" : "YT_DLP_COOKIES",
  };
}

function botBlockedError(logs: string[]): boolean {
  return logs.some(
    (l) =>
      /sign in to confirm/i.test(l) ||
      /not a bot/i.test(l) ||
      /confirm you.re not a bot/i.test(l)
  );
}

/** GET – probe whether yt-dlp + ffmpeg are available (may auto-download yt-dlp). */
export async function GET() {
  const tools = await resolveConvertTools({ allowDownload: true });
  return NextResponse.json({
    available: tools.available,
    ytDlp: tools.ytDlp,
    ffmpeg: tools.ffmpeg,
    ffprobe: tools.ffprobe,
    ytDlpSource: tools.ytDlpSource ?? null,
    hasEnvCookies: Boolean(
      process.env.YT_DLP_COOKIES?.trim() ||
        process.env.YT_DLP_COOKIES_PATH?.trim()
    ),
    installHint: tools.installHint,
    source:
      "https://github.com/huang1988pioneer/YoutubeBilibiliMP4MP3Converter",
  });
}

type StreamEvent =
  | { type: "log"; line: string }
  | { type: "status"; message: string }
  | {
      type: "file_start";
      filename: string;
      mime: string;
      size: number;
      success: number;
      total: number;
    }
  | { type: "file_chunk"; data: string }
  | { type: "file_end" }
  | {
      type: "error";
      error: string;
      needCookies?: boolean;
      success?: number;
      total?: number;
    }
  | { type: "done"; success: number; total: number };

async function packOutputFiles(
  mediaFiles: string[],
  extraFiles: string[],
  format: OutputFormat
): Promise<{ buf: Buffer; name: string; mime: string }> {
  const packFiles = [...mediaFiles, ...extraFiles];
  if (packFiles.length === 1) {
    const filePath = packFiles[0];
    const data = await readFile(filePath);
    const name = basename(filePath);
    const ext = name.split(".").pop()?.toLowerCase() || "bin";
    const mime =
      ext === "mp3"
        ? "audio/mpeg"
        : ext === "mp4"
          ? "video/mp4"
          : "application/octet-stream";
    return { buf: data, name, mime };
  }

  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const used = new Set<string>();
  for (const filePath of packFiles) {
    let name = basename(filePath);
    let n = 1;
    const base = name;
    while (used.has(name.toLowerCase())) {
      const dot = base.lastIndexOf(".");
      name =
        dot >= 0
          ? `${base.slice(0, dot)}-${n}${base.slice(dot)}`
          : `${base}-${n}`;
      n += 1;
    }
    used.add(name.toLowerCase());
    zip.file(name, await readFile(filePath));
  }
  const zipBuf = await zip.generateAsync({ type: "nodebuffer" });
  const zipName = `youtube-bilibili-${format.toLowerCase()}-${Date.now()}.zip`;
  return {
    buf: zipBuf,
    name: zipName,
    mime: "application/zip",
  };
}

/**
 * POST – convert YouTube / Bilibili URLs to MP3 or MP4.
 * Body: {
 *   urls: string[],
 *   format?: "MP3"|"MP4",
 *   mp4Quality?: "1080p"|"720p",
 *   cookies?: string,
 *   stream?: boolean  // NDJSON live logs + file chunks
 * }
 */
export async function POST(req: NextRequest) {
  const tools = await resolveConvertTools({ allowDownload: true });
  if (!tools.available) {
    return NextResponse.json(
      {
        error: "伺服器找不到 yt-dlp 或 ffmpeg，無法轉換。",
        installHint: tools.installHint,
        ytDlp: tools.ytDlp,
        ffmpeg: tools.ffmpeg,
        ytDlpSource: tools.ytDlpSource ?? null,
      },
      { status: 501 }
    );
  }

  let body: {
    urls?: unknown;
    format?: unknown;
    mp4Quality?: unknown;
    cookies?: unknown;
    stream?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "無效的 JSON body" }, { status: 400 });
  }

  const rawUrls = Array.isArray(body.urls)
    ? body.urls.map((u) => String(u ?? ""))
    : [];
  const { urls, errors } = validateAndNormalizeUrls(rawUrls);

  if (urls.length === 0) {
    return NextResponse.json(
      {
        error: "請至少輸入一個有效的 YouTube 或 Bilibili 網址",
        validationErrors: errors,
      },
      { status: 400 }
    );
  }

  if (urls.length > MAX_URLS) {
    return NextResponse.json(
      { error: `一次最多 ${MAX_URLS} 個網址` },
      { status: 400 }
    );
  }

  const format = normalizeFormat(body.format);
  const mp4Quality = normalizeQuality(body.mp4Quality);
  const wantStream = body.stream === true;

  const tempDir = await mkdtemp(join(tmpdir(), "ytbili-"));

  // ——— Live NDJSON stream (logs as they happen) ———
  if (wantStream) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (ev: StreamEvent) => {
          try {
            controller.enqueue(encoder.encode(`${JSON.stringify(ev)}\n`));
          } catch {
            /* client disconnected */
          }
        };

        try {
          const cookieInfo = await resolveCookiesFile(tempDir, body.cookies);
          if (cookieInfo.note && !cookieInfo.path) {
            send({ type: "error", error: cookieInfo.note });
            return;
          }
          if (cookieInfo.source) {
            send({ type: "log", line: `cookies 來源: ${cookieInfo.source}` });
          }
          send({
            type: "status",
            message: `開始轉換 ${urls.length} 個 → ${format}${
              format === "MP4" ? ` ${mp4Quality}` : ""
            }`,
          });

          const batch = await convertUrls({
            tools,
            urls,
            outputDir: tempDir,
            format,
            mp4Quality,
            timeoutMsPerUrl: defaultTimeoutMsPerUrl(),
            cookiesPath: cookieInfo.path,
            onLogLine: (line) => {
              send({ type: "log", line });
              // Lightweight status from download progress lines
              if (/\[download\]/i.test(line) || /\[嘗試/i.test(line)) {
                send({
                  type: "status",
                  message: line.replace(/\s+/g, " ").slice(0, 120),
                });
              }
            },
          });

          const success = batch.results.filter((r) => r.ok).length;
          const mediaFiles = batch.allFiles.filter((f) =>
            /\.(mp3|mp4|m4a|webm|mkv|opus)$/i.test(f)
          );
          const extraFiles = batch.allFiles.filter(
            (f) => !mediaFiles.includes(f) && /\.(srt|vtt)$/i.test(f)
          );

          if (mediaFiles.length === 0) {
            const bot = botBlockedError(batch.logs);
            send({
              type: "error",
              error: bot
                ? "YouTube 要求登入驗證（判定為機器人）。請貼上 cookies.txt 後重試，或改本機桌面版。"
                : success === 0
                  ? "轉換失敗，請查看日誌（區域限制、會員、或平台防護）"
                  : "找不到輸出媒體檔",
              needCookies: bot,
              success,
              total: urls.length,
            });
            return;
          }

          send({ type: "status", message: "打包輸出檔…" });
          const packed = await packOutputFiles(
            mediaFiles,
            extraFiles,
            format
          );
          send({
            type: "file_start",
            filename: packed.name,
            mime: packed.mime,
            size: packed.buf.length,
            success,
            total: urls.length,
          });
          const CHUNK = 256 * 1024;
          for (let i = 0; i < packed.buf.length; i += CHUNK) {
            send({
              type: "file_chunk",
              data: packed.buf.subarray(i, i + CHUNK).toString("base64"),
            });
          }
          send({ type: "file_end" });
          send({ type: "done", success, total: urls.length });
        } catch (err) {
          console.error("[youtube-bilibili-convert stream]", err);
          send({
            type: "error",
            error: err instanceof Error ? err.message : "轉換時發生錯誤",
          });
        } finally {
          try {
            controller.close();
          } catch {
            /* ignore */
          }
          try {
            await rm(tempDir, { recursive: true, force: true });
          } catch {
            /* ignore */
          }
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  }

  // ——— Legacy buffered response (file bytes + logs in header) ———
  try {
    const cookieInfo = await resolveCookiesFile(tempDir, body.cookies);
    if (cookieInfo.note && !cookieInfo.path) {
      return NextResponse.json(
        { error: cookieInfo.note, logs: [cookieInfo.note] },
        { status: 400 }
      );
    }

    const batch = await convertUrls({
      tools,
      urls,
      outputDir: tempDir,
      format,
      mp4Quality,
      timeoutMsPerUrl: defaultTimeoutMsPerUrl(),
      cookiesPath: cookieInfo.path,
    });

    if (cookieInfo.source) {
      batch.logs.unshift(`cookies 來源: ${cookieInfo.source}`);
    }

    const success = batch.results.filter((r) => r.ok).length;
    const mediaFiles = batch.allFiles.filter((f) =>
      /\.(mp3|mp4|m4a|webm|mkv|opus)$/i.test(f)
    );
    const extraFiles = batch.allFiles.filter(
      (f) => !mediaFiles.includes(f) && /\.(srt|vtt)$/i.test(f)
    );

    if (mediaFiles.length === 0) {
      const bot = botBlockedError(batch.logs);
      return NextResponse.json(
        {
          error: bot
            ? "YouTube 要求登入驗證（判定為機器人）。請貼上 cookies.txt 後重試，或改本機桌面版。"
            : success === 0
              ? "轉換失敗，請查看日誌（區域限制、會員、或平台防護）"
              : "找不到輸出媒體檔",
          needCookies: bot,
          logs: batch.logs.slice(-200),
          results: batch.results.map((r) => ({
            url: r.url,
            ok: r.ok,
            exitCode: r.exitCode,
          })),
        },
        { status: 422 }
      );
    }

    const packed = await packOutputFiles(mediaFiles, extraFiles, format);
    return new NextResponse(new Uint8Array(packed.buf), {
      status: 200,
      headers: {
        "Content-Type": packed.mime,
        "Content-Disposition": contentDisposition(packed.name),
        "X-Convert-Success": String(success),
        "X-Convert-Total": String(urls.length),
        "X-Convert-Logs": Buffer.from(
          batch.logs.slice(-80).join("\n"),
          "utf8"
        ).toString("base64url"),
      },
    });
  } catch (err) {
    console.error("[youtube-bilibili-convert]", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "轉換時發生錯誤",
      },
      { status: 500 }
    );
  } finally {
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}
