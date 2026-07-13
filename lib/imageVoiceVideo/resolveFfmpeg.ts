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
 * Resolve FFmpeg binary (priority order):
 * 1. Platform binary from optional `@ffmpeg-installer/<platform>` packages
 *    (path-only — do not import `@ffmpeg-installer/ffmpeg`; its dynamic
 *    require() breaks Turbopack: "Can't resolve <dynamic>")
 * 2. Project-local `.vendor/ffmpeg/`
 * 3. System PATH
 */
export async function resolveFfmpeg(): Promise<string | null> {
  // turbopackIgnore keeps NFT from tracing the whole repo via cwd
  const cwd = /* turbopackIgnore: true */ process.cwd();
  const binary = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const platform = `${process.platform}-${process.arch}`;

  const candidates = [
    // optionalDependencies: @ffmpeg-installer/win32-x64, linux-x64, etc.
    join(cwd, 'node_modules', '@ffmpeg-installer', platform, binary),
    join(cwd, '.vendor', 'ffmpeg', binary),
    // allow .exe under vendor on non-Windows if someone dropped a Windows build
    ...(process.platform !== 'win32'
      ? [join(cwd, '.vendor', 'ffmpeg', 'ffmpeg.exe')]
      : []),
  ];

  for (const p of candidates) {
    if (await fileExists(p)) {
      console.log(`[FFmpeg] using: ${p}`);
      return p;
    }
  }

  const fromPath = await which('ffmpeg');
  if (fromPath) {
    console.log(`[FFmpeg] using PATH: ${fromPath}`);
  }
  return fromPath;
}
