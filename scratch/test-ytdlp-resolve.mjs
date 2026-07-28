/**
 * Quick smoke: resolve yt-dlp / ffmpeg / ffprobe (may download yt-dlp).
 * Run: node scratch/test-ytdlp-resolve.mjs
 */
import { access, chmod, mkdir, rename, stat, unlink } from "fs/promises";
import { constants, createWriteStream } from "fs";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

async function fileExists(p) {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function which(cmd) {
  try {
    const bin = process.platform === "win32" ? "where" : "which";
    const { stdout } = await execFileAsync(bin, [cmd]);
    return stdout.trim().split(/\r?\n/)[0] || null;
  } catch {
    return null;
  }
}

function ytdlpReleaseAsset() {
  if (process.platform === "win32") {
    return { asset: "yt-dlp.exe", fileName: "yt-dlp.exe" };
  }
  if (process.platform === "darwin") {
    return { asset: "yt-dlp_macos", fileName: "yt-dlp" };
  }
  if (process.arch === "arm64") {
    return { asset: "yt-dlp_linux_aarch64", fileName: "yt-dlp" };
  }
  return { asset: "yt-dlp_linux", fileName: "yt-dlp" };
}

async function downloadYtDlp(dest) {
  const { asset } = ytdlpReleaseAsset();
  const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`;
  await mkdir(dirname(dest), { recursive: true });
  console.log("Downloading", url);
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const partial = `${dest}.partial`;
  await pipeline(Readable.fromWeb(res.body), createWriteStream(partial));
  const st = await stat(partial);
  console.log("Downloaded", st.size, "bytes");
  try {
    await unlink(dest);
  } catch {
    /* ignore */
  }
  await rename(partial, dest);
  if (process.platform !== "win32") await chmod(dest, 0o755);
  return dest;
}

const dest = join(tmpdir(), "fengbro-tools", "yt-dlp", ytdlpReleaseAsset().fileName);
let yt = (await fileExists(dest)) ? dest : null;
if (!yt) yt = await which("yt-dlp");
if (!yt) yt = await downloadYtDlp(dest);

const platform = `${process.platform}-${process.arch}`;
const cwd = process.cwd();
const ffmpeg =
  (await fileExists(
    join(cwd, "node_modules", "@ffmpeg-installer", platform, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg")
  ))
    ? join(cwd, "node_modules", "@ffmpeg-installer", platform, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg")
    : await which("ffmpeg");

const ffprobeBin = process.platform === "win32" ? "ffprobe.exe" : "ffprobe";
const ffprobeInstaller = join(cwd, "node_modules", "@ffprobe-installer", platform, ffprobeBin);
const ffprobe = (await fileExists(ffprobeInstaller))
  ? ffprobeInstaller
  : await which("ffprobe");

console.log({
  available: Boolean(yt && ffmpeg),
  ytDlp: yt,
  ffmpeg,
  ffprobe,
});

if (yt) {
  try {
    const { stdout } = await execFileAsync(yt, ["--version"], { timeout: 30000 });
    console.log("yt-dlp --version:", stdout.trim());
  } catch (e) {
    console.error("yt-dlp --version failed:", e.message);
  }
}
