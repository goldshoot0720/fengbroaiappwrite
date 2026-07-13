"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Clapperboard,
  Download,
  ExternalLink,
  ImagePlus,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import { Button } from "@/components/ui/button";
import { useCache } from "@/hooks/imageVoiceVideo/useCache";
import { useCanvasRenderer } from "@/hooks/imageVoiceVideo/useCanvasRenderer";
import { useVideoRecorder } from "@/hooks/imageVoiceVideo/useVideoRecorder";
import { LANG_OPTIONS } from "@/lib/imageVoiceVideo/languages";
import { parseScriptLines, safeFilename, type Track } from "@/lib/imageVoiceVideo/scriptParser";
import {
  orientationLabel,
  resolveCanvasSize,
  type OrientationMode,
} from "@/lib/imageVoiceVideo/videoSize";
import {
  deleteFromAppwriteStorage,
  uploadToAppwriteStorage,
} from "@/lib/appwriteStorage";
import { hasRequiredAppwriteConfig } from "@/lib/utils";

const ORIENT_STORAGE_KEY = "fengbro.tools.ivv.orientation";

const ORIENT_OPTIONS: { value: OrientationMode; label: string; hint: string }[] = [
  { value: "auto", label: "自動", hint: "依圖片" },
  { value: "portrait", label: "直式", hint: "9:16" },
  { value: "landscape", label: "橫式", hint: "16:9" },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ImageVoiceVideoTool() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [script, setScript] = useState("");
  const [scriptLang, setScriptLang] = useState("zh-TW");
  const [tracks, setTracks] = useState<Track[]>([
    { language: "zh-TW", label: "繁中", gender: "female" },
  ]);
  const [rate, setRate] = useState(0);
  const [volume, setVolume] = useState(100);
  const [format, setFormat] = useState<"mp4" | "webm">("mp4");
  const [orientationMode, setOrientationMode] = useState<OrientationMode>("auto");
  const [filename, setFilename] = useState("");
  const [status, setStatus] = useState("就緒 — 上傳圖片並輸入語音稿");
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultExt, setResultExt] = useState("mp4");
  const [storageUrl, setStorageUrl] = useState<string | null>(null);
  const [storageFileId, setStorageFileId] = useState<string | null>(null);
  const [storageError, setStorageError] = useState("");
  const [dragging, setDragging] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resultUrlRef = useRef<string | null>(null);
  const storageFileIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageCache = useCache();
  const { drawFrame } = useCanvasRenderer();
  const { record } = useVideoRecorder(setStatus);

  const canvasSize = useMemo(
    () => resolveCanvasSize(orientationMode, imageEl),
    [orientationMode, imageEl],
  );

  const scriptLines = useMemo(() => parseScriptLines(script), [script]);
  const firstLine = scriptLines[0]?.text ?? "";
  const lineCount = scriptLines.length;
  const trackCount = tracks.length;
  const orientText = orientationLabel(orientationMode, canvasSize.orientation);
  const downloadName = `${safeFilename(filename.trim() || firstLine || "影片")}.${resultExt}`;

  // Restore cache + orientation preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ORIENT_STORAGE_KEY) as OrientationMode | null;
      if (saved === "auto" || saved === "portrait" || saved === "landscape") {
        setOrientationMode(saved);
      }
    } catch {
      /* ignore */
    }

    setScript(imageCache.loadScript() || "");
    imageCache.loadImage("last").then((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      setImageUrl(url);
      const img = new Image();
      img.src = url;
      img.onload = () => setImageEl(img);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply canvas resolution + redraw when size / content changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (canvas.width !== canvasSize.width || canvas.height !== canvasSize.height) {
      canvas.width = canvasSize.width;
      canvas.height = canvasSize.height;
    }

    const lines = parseScriptLines(script);
    const subs = lines.map((l, i) => ({
      text: l.text,
      startAt: i,
      endAt: i + 1,
      language: scriptLang,
    }));
    drawFrame(canvas, imageEl, subs, 0, true);
  }, [imageEl, script, scriptLang, drawFrame, canvasSize]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    };
  }, []);

  const handleImage = useCallback(
    (blob: Blob, url: string) => {
      setImageUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      const img = new Image();
      img.src = url;
      img.onload = () => setImageEl(img);
      void imageCache.saveImage("last", blob);
    },
    [imageCache],
  );

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const url = URL.createObjectURL(file);
      handleImage(file, url);
    },
    [handleImage],
  );

  const handleScript = useCallback(
    (text: string) => {
      setScript(text);
      imageCache.saveScript(text);
    },
    [imageCache],
  );

  const handleOrientation = useCallback((mode: OrientationMode) => {
    setOrientationMode(mode);
    try {
      localStorage.setItem(ORIENT_STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, []);

  const isTrackSelected = (lang: string) => tracks.some((t) => t.language === lang);

  const toggleTrack = (lang: string, label: string) => {
    if (isTrackSelected(lang)) {
      if (tracks.length <= 1) return;
      setTracks(tracks.filter((t) => t.language !== lang));
    } else {
      setTracks([...tracks, { language: lang, label, gender: "female" }]);
    }
  };

  const setTrackGender = (lang: string, gender: "female" | "male") => {
    setTracks(tracks.map((t) => (t.language === lang ? { ...t, gender } : t)));
  };

  const clearResult = useCallback(async () => {
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = null;
    }
    setResultUrl(null);
    setStorageUrl(null);
    setStorageError("");

    const prevId = storageFileIdRef.current;
    storageFileIdRef.current = null;
    setStorageFileId(null);

    if (prevId && hasRequiredAppwriteConfig({ requireBucket: true })) {
      try {
        await deleteFromAppwriteStorage(prevId);
      } catch {
        /* best-effort cleanup */
      }
    }
    setStatus("就緒 — 可繼續生成");
  }, []);

  const uploadTempToAppwrite = useCallback(
    async (blob: Blob, ext: string, baseName: string) => {
      if (!hasRequiredAppwriteConfig({ requireBucket: true })) {
        setStorageError("尚未設定 Appwrite Storage，僅提供本機下載。請到「鋒兄設定」配置後再上傳暫存檔。");
        return;
      }

      setUploading(true);
      setStorageError("");
      setStatus("正在上傳暫存影片到 Appwrite Storage…");

      // Best-effort delete previous temp file
      const prevId = storageFileIdRef.current;
      if (prevId) {
        try {
          await deleteFromAppwriteStorage(prevId);
        } catch {
          /* ignore */
        }
        storageFileIdRef.current = null;
        setStorageFileId(null);
      }

      try {
        const mime = ext === "mp4" ? "video/mp4" : "video/webm";
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        const fileName = `ivv-temp-${safeFilename(baseName)}-${stamp}.${ext}`;
        const file = new File([blob], fileName, { type: mime });
        const uploaded = await uploadToAppwriteStorage(file);
        storageFileIdRef.current = uploaded.fileId;
        setStorageFileId(uploaded.fileId);
        setStorageUrl(uploaded.url);
        setStatus(`完成！暫存檔已上傳 Appwrite Storage（${formatBytes(blob.size)}）`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setStorageError(msg);
        setStatus(`影片已生成，但上傳 Appwrite 失敗：${msg}`);
      } finally {
        setUploading(false);
      }
    },
    [],
  );

  const handleGenerate = useCallback(async () => {
    if (recording || uploading) return;

    if (scriptLines.length === 0) {
      setStatus("請輸入語音稿");
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (canvas.width !== canvasSize.width || canvas.height !== canvasSize.height) {
      canvas.width = canvasSize.width;
      canvas.height = canvasSize.height;
    }

    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = null;
    }
    setResultUrl(null);
    setStorageUrl(null);
    setStorageError("");
    setRecording(true);
    setStatus("準備生成…");

    try {
      const result = await record({
        scriptLines,
        tracks,
        image: imageEl,
        canvas,
        format,
        rate,
        volume,
        scriptLanguage: scriptLang,
      });
      const url = URL.createObjectURL(result.blob);
      resultUrlRef.current = url;
      setResultUrl(url);
      setResultExt(result.ext);
      setStatus(
        `錄製完成！${canvasSize.label} · ${result.duration.toFixed(1)} 秒 — 正在上傳暫存…`,
      );

      const baseName = filename.trim() || firstLine || "影片";
      await uploadTempToAppwrite(result.blob, result.ext, baseName);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus(`錯誤：${msg}`);
      console.error(err);
    } finally {
      setRecording(false);
    }
  }, [
    recording,
    uploading,
    scriptLines,
    tracks,
    imageEl,
    format,
    rate,
    volume,
    scriptLang,
    record,
    canvasSize,
    filename,
    firstLine,
    uploadTempToAppwrite,
  ]);

  const busy = recording || uploading;

  return (
    <div className="space-y-4">
      <DataCard className="space-y-4 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
            <Clapperboard size={20} />
          </div>
          <div>
            <h3 className="text-lg font-semibold">圖片 + 語音 = 影片</h3>
            <p className="text-sm text-muted-foreground">
              上傳封面圖與語音稿，產生多語字幕影片；暫存檔會上傳到 Appwrite Storage 供下載。
            </p>
          </div>
        </div>
      </DataCard>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,380px)]">
        {/* Left: inputs */}
        <div className="space-y-4">
          {/* Image */}
          <DataCard className="space-y-3 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">1. 封面圖片</p>
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                可選
              </span>
            </div>
            <div
              className={`relative flex min-h-[160px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition ${
                dragging
                  ? "border-violet-400 bg-violet-50 dark:bg-violet-950/30"
                  : "border-slate-200 bg-slate-50/80 hover:border-violet-300 dark:border-slate-700 dark:bg-slate-900/40"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files[0];
                if (file) handleFile(file);
              }}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="預覽" className="max-h-56 w-full object-contain" />
              ) : (
                <div className="flex flex-col items-center gap-2 p-6 text-center text-muted-foreground">
                  <ImagePlus className="h-8 w-8 opacity-60" />
                  <p className="text-sm font-medium">拖放或點擊上傳封面</p>
                  <p className="text-xs">支援直式 · 橫式 · 正方形</p>
                </div>
              )}
              {imageUrl && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition hover:opacity-100">
                  <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-800">
                    點擊更換
                  </span>
                </div>
              )}
            </div>
          </DataCard>

          {/* Script */}
          <DataCard className="space-y-3 p-5">
            <p className="text-sm font-semibold">2. 語音稿</p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-muted-foreground" htmlFor="ivv-script-lang">
                稿件語言
              </label>
              <select
                id="ivv-script-lang"
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                value={scriptLang}
                onChange={(e) => setScriptLang(e.target.value)}
              >
                {LANG_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              id="ivv-script"
              className="min-h-[140px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-violet-400 dark:border-slate-700 dark:bg-slate-900"
              value={script}
              onChange={(e) => handleScript(e.target.value)}
              placeholder={"每行為一個字幕段落\n\n男：男生台詞\n女：女生台詞\n旁白文字"}
              spellCheck={false}
            />
            <p className="text-xs text-muted-foreground">
              每行一段字幕。「男：」開頭使用男聲，「女：」或無前綴使用軌道預設性別。
            </p>
          </DataCard>

          {/* Tracks */}
          <DataCard className="space-y-3 p-5">
            <p className="text-sm font-semibold">3. 語音語言（可多選）</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {LANG_OPTIONS.map(({ value, short, flag }) => {
                const track = tracks.find((t) => t.language === value);
                const sel = !!track;
                return (
                  <div
                    key={value}
                    className={`rounded-xl border p-2 transition ${
                      sel
                        ? "border-violet-400 bg-violet-50 dark:border-violet-600 dark:bg-violet-950/40"
                        : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                    }`}
                  >
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-1 text-sm font-medium"
                      onClick={() => toggleTrack(value, short)}
                    >
                      <span>
                        {flag} {short}
                      </span>
                      {sel && <span className="text-violet-600">✓</span>}
                    </button>
                    {sel && track && (
                      <div className="mt-2 flex gap-1">
                        <button
                          type="button"
                          className={`flex-1 rounded-md px-1 py-0.5 text-xs ${
                            track.gender === "female"
                              ? "bg-violet-600 text-white"
                              : "bg-slate-100 dark:bg-slate-800"
                          }`}
                          onClick={() => setTrackGender(value, "female")}
                        >
                          ♀ 女
                        </button>
                        <button
                          type="button"
                          className={`flex-1 rounded-md px-1 py-0.5 text-xs ${
                            track.gender === "male"
                              ? "bg-violet-600 text-white"
                              : "bg-slate-100 dark:bg-slate-800"
                          }`}
                          onClick={() => setTrackGender(value, "male")}
                        >
                          ♂ 男
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </DataCard>

          {/* Audio / output settings */}
          <DataCard className="space-y-4 p-5">
            <p className="text-sm font-semibold">4. 音訊與輸出</p>

            <div className="space-y-1">
              <label className="flex items-center justify-between text-sm" htmlFor="ivv-rate">
                <span>語速</span>
                <span className="tabular-nums text-muted-foreground">
                  {rate > 0 ? `+${rate}` : rate}
                </span>
              </label>
              <input
                id="ivv-rate"
                type="range"
                min={-5}
                max={5}
                step={1}
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                className="w-full accent-violet-600"
              />
            </div>

            <div className="space-y-1">
              <label className="flex items-center justify-between text-sm" htmlFor="ivv-volume">
                <span>音量</span>
                <span className="tabular-nums text-muted-foreground">{volume}%</span>
              </label>
              <input
                id="ivv-volume"
                type="range"
                min={0}
                max={150}
                step={5}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-full accent-violet-600"
              />
            </div>

            <div className="space-y-2">
              <span className="text-sm">畫面方向</span>
              <div className="flex flex-wrap gap-2">
                {ORIENT_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                      orientationMode === o.value
                        ? "border-violet-500 bg-violet-600 text-white"
                        : "border-slate-200 bg-white hover:border-violet-300 dark:border-slate-700 dark:bg-slate-900"
                    }`}
                    onClick={() => handleOrientation(o.value)}
                    title={o.hint}
                  >
                    {o.label}
                    <span className="ml-1 text-xs opacity-70">{o.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-sm">格式</span>
              <div className="flex gap-2">
                {(["mp4", "webm"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`rounded-lg border px-4 py-1.5 text-sm font-medium uppercase transition ${
                      format === f
                        ? "border-violet-500 bg-violet-600 text-white"
                        : "border-slate-200 bg-white hover:border-violet-300 dark:border-slate-700 dark:bg-slate-900"
                    }`}
                    onClick={() => setFormat(f)}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm" htmlFor="ivv-filename">
                輸出檔名
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="ivv-filename"
                  type="text"
                  placeholder="預設使用第一行文字"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400 dark:border-slate-700 dark:bg-slate-900"
                />
                <span className="text-xs text-muted-foreground">.{format}</span>
              </div>
            </div>
          </DataCard>
        </div>

        {/* Right: preview + actions */}
        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <DataCard className="space-y-3 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">即時預覽</p>
              <span className="text-xs text-muted-foreground">
                {canvasSize.width}×{canvasSize.height}
              </span>
            </div>
            <div className="flex justify-center rounded-2xl bg-slate-950 p-3">
              <canvas
                ref={canvasRef}
                width={canvasSize.width}
                height={canvasSize.height}
                className="max-h-[420px] w-auto max-w-full rounded-lg"
                style={{
                  aspectRatio: `${canvasSize.width} / ${canvasSize.height}`,
                }}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">
                {canvasSize.label} · {orientText}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">
                {lineCount} 段 · {trackCount} 語
              </span>
            </div>
          </DataCard>

          <DataCard className="space-y-3 p-5">
            <div
              className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${
                busy
                  ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
                  : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50"
              }`}
            >
              {busy && <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />}
              <span className="leading-relaxed">{status}</span>
            </div>

            <Button
              id="ivv-generate-btn"
              className="w-full gap-2"
              onClick={handleGenerate}
              disabled={busy}
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {recording ? "生成中…" : "上傳中…"}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  生成影片並上傳暫存
                </>
              )}
            </Button>
          </DataCard>

          {resultUrl && (
            <DataCard className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">影片已生成</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => void clearResult()}
                  title="清除"
                  type="button"
                >
                  <Trash2 size={16} />
                </Button>
              </div>

              <video
                id="ivv-result-video"
                src={resultUrl}
                controls
                className="w-full rounded-xl bg-black"
                playsInline
                preload="metadata"
              />

              <div className="flex flex-col gap-2">
                <a
                  id="ivv-download-local"
                  href={resultUrl}
                  download={downloadName}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-700"
                >
                  <Download size={16} />
                  本機下載 {downloadName}
                </a>

                {storageUrl ? (
                  <a
                    id="ivv-download-storage"
                    href={storageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={downloadName}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-300 bg-violet-50 px-4 py-2.5 text-sm font-medium text-violet-800 hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-200"
                  >
                    <ExternalLink size={16} />
                    從 Appwrite Storage 下載
                  </a>
                ) : uploading ? (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    正在上傳暫存檔…
                  </p>
                ) : null}

                {storageFileId && (
                  <p className="break-all text-xs text-muted-foreground">
                    暫存 fileId：{storageFileId}
                  </p>
                )}

                {storageError && (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                    {storageError}
                  </p>
                )}
              </div>
            </DataCard>
          )}
        </div>
      </div>
    </div>
  );
}
