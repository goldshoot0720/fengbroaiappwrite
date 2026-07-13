export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdtemp, writeFile, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { resolveFfmpeg } from '@/lib/imageVoiceVideo/resolveFfmpeg';
import {
  FFMPEG_AUDIO_BITRATE,
  FFMPEG_FPS,
  FFMPEG_VIDEO_BITRATE,
  FFMPEG_VIDEO_BUFSIZE,
  FFMPEG_VIDEO_MAXRATE,
} from '@/lib/imageVoiceVideo/videoQuality';

const execFileAsync = promisify(execFile);

/** GET /api/image-voice-video/convert – probe whether FFmpeg is available */
export async function GET() {
  const ffmpegPath = await resolveFfmpeg();
  return NextResponse.json({ available: !!ffmpegPath, path: ffmpegPath ?? null });
}

export async function POST(req: NextRequest) {
  const ffmpegPath = await resolveFfmpeg();
  if (!ffmpegPath) {
    return NextResponse.json(
      { error: 'FFmpeg not found. Install FFmpeg or place it at .vendor/ffmpeg/' },
      { status: 501 },
    );
  }

  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length === 0) {
    return NextResponse.json({ error: 'No data received' }, { status: 400 });
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'ivv-'));
  const inPath = join(tempDir, 'input.webm');
  const outPath = join(tempDir, 'output.mp4');

  try {
    await writeFile(inPath, buf);
    console.log(`[Convert] WebM ${buf.length.toLocaleString()} bytes → MP4 via ${ffmpegPath}`);

    // veryfast + genpts: fix MediaRecorder WebM with missing/zero duration timestamps
    // Quality floor: ≥1024 Kbps video, ≥24 fps (targets from videoQuality.ts)
    await execFileAsync(
      ffmpegPath,
      [
        '-y',
        '-fflags', '+genpts',
        '-i', inPath,
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-b:v', FFMPEG_VIDEO_BITRATE,
        '-maxrate', FFMPEG_VIDEO_MAXRATE,
        '-bufsize', FFMPEG_VIDEO_BUFSIZE,
        '-r', FFMPEG_FPS,
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', FFMPEG_AUDIO_BITRATE,
        '-ar', '44100',
        '-movflags', '+faststart',
        '-avoid_negative_ts', 'make_zero',
        outPath,
      ],
      { timeout: 55_000 },
    );

    const mp4 = await readFile(outPath);
    console.log(`[Convert] OK ${mp4.length.toLocaleString()} bytes`);
    const body = new Uint8Array(mp4);

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(body.byteLength),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Convert] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
