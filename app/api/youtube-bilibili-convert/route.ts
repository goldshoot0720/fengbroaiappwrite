export const runtime = "nodejs";
export const maxDuration = 600;
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { basename, join } from "path";
import {
  convertUrls,
  resolveConvertTools,
  validateAndNormalizeUrls,
  type Mp4Quality,
  type OutputFormat,
} from "@/lib/youtubeBilibiliConvert";

const MAX_URLS = 7;

function normalizeFormat(v: unknown): OutputFormat {
  return String(v || "").toUpperCase() === "MP4" ? "MP4" : "MP3";
}

function normalizeQuality(v: unknown): Mp4Quality {
  return String(v || "") === "4K" ? "4K" : "1080p";
}

function asciiFallback(name: string): string {
  return name.replace(/[^\x20-\x7E]+/g, "_").replace(/"/g, "") || "download";
}

function contentDisposition(filename: string): string {
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${asciiFallback(filename)}"; filename*=UTF-8''${encoded}`;
}

/** GET – probe whether yt-dlp + ffmpeg are available */
export async function GET() {
  const tools = await resolveConvertTools();
  return NextResponse.json({
    available: tools.available,
    ytDlp: tools.ytDlp,
    ffmpeg: tools.ffmpeg,
    ffprobe: tools.ffprobe,
    installHint: tools.installHint,
    source:
      "https://github.com/huang1988pioneer/YoutubeBilibiliMP4MP3Converter",
  });
}

/**
 * POST – convert YouTube / Bilibili URLs to MP3 or MP4.
 * Body: { urls: string[], format?: "MP3"|"MP4", mp4Quality?: "1080p"|"4K" }
 * Returns a single media file, or a zip when multiple files are produced.
 */
export async function POST(req: NextRequest) {
  const tools = await resolveConvertTools();
  if (!tools.available) {
    return NextResponse.json(
      {
        error: "伺服器找不到 yt-dlp 或 ffmpeg，無法轉換。",
        installHint: tools.installHint,
        ytDlp: tools.ytDlp,
        ffmpeg: tools.ffmpeg,
      },
      { status: 501 }
    );
  }

  let body: {
    urls?: unknown;
    format?: unknown;
    mp4Quality?: unknown;
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

  const tempDir = await mkdtemp(join(tmpdir(), "ytbili-"));
  try {
    const batch = await convertUrls({
      tools,
      urls,
      outputDir: tempDir,
      format,
      mp4Quality,
      timeoutMsPerUrl: 8 * 60 * 1000,
    });

    const success = batch.results.filter((r) => r.ok).length;
    const mediaFiles = batch.allFiles.filter((f) =>
      /\.(mp3|mp4|m4a|webm|mkv|opus)$/i.test(f)
    );
    const extraFiles = batch.allFiles.filter(
      (f) => !mediaFiles.includes(f) && /\.(srt|vtt)$/i.test(f)
    );

    if (mediaFiles.length === 0) {
      return NextResponse.json(
        {
          error:
            success === 0
              ? "轉換失敗，請查看日誌（區域限制、會員、或平台防護）"
              : "找不到輸出媒體檔",
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

    // Package: if only one media and no extras → raw file; else zip
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

      return new NextResponse(new Uint8Array(data), {
        status: 200,
        headers: {
          "Content-Type": mime,
          "Content-Disposition": contentDisposition(name),
          "X-Convert-Success": String(success),
          "X-Convert-Total": String(urls.length),
          "X-Convert-Logs": Buffer.from(
            batch.logs.slice(-80).join("\n"),
            "utf8"
          ).toString("base64url"),
        },
      });
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

    return new NextResponse(new Uint8Array(zipBuf), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": contentDisposition(zipName),
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
