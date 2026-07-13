import { execFile } from 'child_process';
import { access } from 'fs/promises';
import { constants } from 'fs';
import { join } from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/** Cross-platform locate a command on PATH */
export async function which(cmd: string): Promise<string | null> {
  try {
    const isWin = process.platform === 'win32';
    const bin = isWin ? 'where' : 'which';
    const { stdout } = await execFileAsync(bin, [cmd]);
    const path = stdout.trim().split(/\r?\n/)[0];
    return path || null;
  } catch {
    return null;
  }
}

/**
 * Resolve FFmpeg binary:
 * 1. Project-local `.vendor/ffmpeg/` (auto-installed by server.py)
 * 2. System PATH
 */
export async function resolveFfmpeg(): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffmpeg = require('@ffmpeg-installer/ffmpeg');
    if (ffmpeg.path) {
      console.log(`[FFmpeg] using @ffmpeg-installer: ${ffmpeg.path}`);
      return ffmpeg.path;
    }
  } catch {
    /* ignore */
  }

  // Static relative path under cwd — turbopackIgnore keeps NFT from tracing the whole repo
  const cwd = /* turbopackIgnore: true */ process.cwd();
  const candidates =
    process.platform === 'win32'
      ? [join(cwd, '.vendor', 'ffmpeg', 'ffmpeg.exe')]
      : [
          join(cwd, '.vendor', 'ffmpeg', 'ffmpeg'),
          join(cwd, '.vendor', 'ffmpeg', 'ffmpeg.exe'),
        ];

  for (const p of candidates) {
    if (await fileExists(p)) {
      console.log(`[FFmpeg] using vendor: ${p}`);
      return p;
    }
  }

  const fromPath = await which('ffmpeg');
  if (fromPath) {
    console.log(`[FFmpeg] using PATH: ${fromPath}`);
  }
  return fromPath;
}
