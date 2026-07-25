"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Download,
  ExternalLink,
  Film,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import { Button } from "@/components/ui/button";
import { getExportFilename } from "@/lib/utils";
import {
  LOOP_LIMITS,
  clearClips,
  clearStoredAudio,
  clearStoredPreview,
  extractFrames,
  formatBytes,
  formatDuration,
  loadAudio,
  loadClips,
  loadPreview,
  mergeVideos,
  saveAudio,
  saveClips,
  savePreview,
  type LoopMode,
  type VideoClip,
} from "@/lib/videoMerge";

const SOURCE_URL = "https://github.com/huang1988pioneer/VideoMerge";
const DEMO_URL = "https://video-merge-one.vercel.app";
const LOOP_STORE_KEY = "fengbro.tools.videomerge.loop";

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function isVideoFile(file: File): boolean {
  if (file.type.startsWith("video/")) return true;
  return /\.(mp4|webm|mov|m4v|mkv|avi|ogv)$/i.test(file.name);
}

function isAudioFile(file: File): boolean {
  if (file.type.startsWith("audio/")) return true;
  return /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(file.name);
}

export default function VideoMergeTool() {
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [noAudio, setNoAudio] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [loopMode, setLoopMode] = useState<LoopMode>("once");
  const [loopCount, setLoopCount] = useState(2);
  const [loopHours, setLoopHours] = useState(0);
  const [loopMins, setLoopMins] = useState(1);
  const [loopSecs, setLoopSecs] = useState(0);
  const [merging, setMerging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("就緒 — 加入多段影片後合併");
  const [logLines, setLogLines] = useState<string[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [dragging, setDragging] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const clipsRef = useRef(clips);
  const resultUrlRef = useRef<string | null>(null);
  clipsRef.current = clips;
  resultUrlRef.current = resultUrl;

  const readyClips = useMemo(
    () => clips.filter((c) => c.status === "ready"),
    [clips]
  );

  const baseDuration = useMemo(
    () => readyClips.reduce((sum, c) => sum + (c.duration || 0), 0),
    [readyClips]
  );

  const targetSeconds = loopHours * 3600 + loopMins * 60 + loopSecs;

  const estimateLabel = useMemo(() => {
    if (baseDuration <= 0) return "加入影片後可預估輸出時長";
    if (loopMode === "once") return `輸出約 ${formatDuration(baseDuration)}`;
    if (loopMode === "count") {
      const n = Math.max(1, loopCount);
      return `基底 ${formatDuration(baseDuration)} × ${n} ≈ ${formatDuration(baseDuration * n)}`;
    }
    if (targetSeconds <= 0) return "請設定目標時長";
    const loops = Math.ceil(targetSeconds / baseDuration);
    return `基底 ${formatDuration(baseDuration)} → 約循環 ${loops} 次，裁切至 ${formatDuration(targetSeconds)}`;
  }, [baseDuration, loopCount, loopMode, targetSeconds]);

  const appendLog = useCallback((msg: string) => {
    setLogLines((prev) => {
      const next = [...prev, msg];
      return next.length > 200 ? next.slice(-200) : next;
    });
  }, []);

  const persistClips = useCallback((next: VideoClip[]) => {
    void saveClips(next).catch((err) =>
      console.warn("[VideoMerge] saveClips", err)
    );
  }, []);

  // Restore from IndexedDB / localStorage
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const raw = localStorage.getItem(LOOP_STORE_KEY);
        if (raw) {
          const data = JSON.parse(raw) as {
            mode?: LoopMode;
            count?: number;
            hours?: number;
            mins?: number;
            secs?: number;
          };
          if (data.mode === "once" || data.mode === "count" || data.mode === "duration") {
            setLoopMode(data.mode);
          }
          if (Number.isFinite(data.count)) setLoopCount(Math.max(1, Math.floor(data.count!)));
          if (Number.isFinite(data.hours)) setLoopHours(Math.max(0, Math.floor(data.hours!)));
          if (Number.isFinite(data.mins)) setLoopMins(Math.max(0, Math.floor(data.mins!)));
          if (Number.isFinite(data.secs)) setLoopSecs(Math.max(0, Math.floor(data.secs!)));
        }
      } catch {
        /* ignore */
      }

      try {
        const stored = await loadClips();
        if (cancelled) return;
        if (stored.length) {
          setClips(stored);
          setStatus(`已還原 ${stored.length} 段影片`);
          // Re-extract frames if missing
          for (const clip of stored) {
            if (clip.status === "loading" || !clip.firstFrame || !clip.lastFrame) {
              void enrichClip(clip.id, clip.file);
            }
          }
        }
      } catch (err) {
        console.warn("[VideoMerge] loadClips", err);
      }

      try {
        const audio = await loadAudio();
        if (!cancelled && audio) setAudioFile(audio);
      } catch {
        /* ignore */
      }

      try {
        const preview = await loadPreview();
        if (!cancelled && preview?.blob) {
          const url = URL.createObjectURL(preview.blob);
          setResultBlob(preview.blob);
          setResultUrl(url);
        }
      } catch {
        /* ignore */
      }

      if (!cancelled) setHydrated(true);
    })();

    return () => {
      cancelled = true;
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    };
    // enrichClip defined below — intentional once-on-mount restore
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist loop options
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        LOOP_STORE_KEY,
        JSON.stringify({
          mode: loopMode,
          count: loopCount,
          hours: loopHours,
          mins: loopMins,
          secs: loopSecs,
        })
      );
    } catch {
      /* ignore */
    }
  }, [hydrated, loopCount, loopHours, loopMins, loopMode, loopSecs]);

  const enrichClip = useCallback(
    async (id: string, file: File) => {
      try {
        const meta = await extractFrames(file);
        setClips((prev) => {
          const next = prev.map((c) =>
            c.id === id
              ? {
                  ...c,
                  firstFrame: meta.firstFrame,
                  lastFrame: meta.lastFrame,
                  duration: meta.duration,
                  width: meta.width,
                  height: meta.height,
                  status: "ready" as const,
                  error: null,
                }
              : c
          );
          persistClips(next);
          return next;
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "讀取失敗";
        setClips((prev) => {
          const next = prev.map((c) =>
            c.id === id
              ? { ...c, status: "error" as const, error: message }
              : c
          );
          persistClips(next);
          return next;
        });
      }
    },
    [persistClips]
  );

  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter(isVideoFile);
      if (!files.length) {
        setStatus("請選擇影片檔（MP4 / WebM / MOV 等）");
        return;
      }

      const added: VideoClip[] = files.map((file) => ({
        id: newId(),
        file,
        name: file.name,
        size: file.size,
        firstFrame: null,
        lastFrame: null,
        duration: null,
        width: null,
        height: null,
        status: "loading" as const,
        error: null,
      }));

      setClips((prev) => {
        const next = [...prev, ...added];
        persistClips(next);
        return next;
      });
      setStatus(`已加入 ${added.length} 段，正在擷取首尾幀…`);

      for (const clip of added) {
        void enrichClip(clip.id, clip.file);
      }
    },
    [enrichClip, persistClips]
  );

  const moveClip = useCallback(
    (id: string, dir: -1 | 1) => {
      setClips((prev) => {
        const idx = prev.findIndex((c) => c.id === id);
        if (idx < 0) return prev;
        const j = idx + dir;
        if (j < 0 || j >= prev.length) return prev;
        const next = [...prev];
        [next[idx], next[j]] = [next[j], next[idx]];
        persistClips(next);
        return next;
      });
    },
    [persistClips]
  );

  const removeClip = useCallback(
    (id: string) => {
      setClips((prev) => {
        const next = prev.filter((c) => c.id !== id);
        persistClips(next);
        return next;
      });
    },
    [persistClips]
  );

  const clearAll = useCallback(() => {
    setClips([]);
    setAudioFile(null);
    setNoAudio(false);
    setLoopMode("once");
    setLoopCount(2);
    setLoopHours(0);
    setLoopMins(1);
    setLoopSecs(0);
    setProgress(0);
    setLogLines([]);
    setResultBlob(null);
    setResultUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (audioInputRef.current) audioInputRef.current.value = "";
    void clearClips();
    void clearStoredAudio();
    void clearStoredPreview();
    try {
      localStorage.removeItem(LOOP_STORE_KEY);
    } catch {
      /* ignore */
    }
    setStatus("已清除全部");
  }, []);

  const pickAudio = useCallback(
    (file: File | null) => {
      if (!file) {
        setAudioFile(null);
        void clearStoredAudio();
        return;
      }
      if (!isAudioFile(file)) {
        setStatus("請選擇音訊檔（建議 MP3）");
        return;
      }
      setAudioFile(file);
      if (noAudio) setNoAudio(false);
      void saveAudio(file).catch(() => {});
      setStatus(`已選音軌：${file.name}`);
    },
    [noAudio]
  );

  const clearResult = useCallback(() => {
    setResultBlob(null);
    setResultUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    void clearStoredPreview();
    setStatus("已清除預覽");
  }, []);

  const runMerge = useCallback(async () => {
    if (merging) return;
    const ready = clipsRef.current.filter((c) => c.status === "ready");
    if (!ready.length) {
      setStatus("請先加入可讀取的影片");
      return;
    }

    setMerging(true);
    setProgress(0);
    setLogLines([]);
    setShowLog(true);
    setStatus("開始合併…");

    try {
      const files = ready.map((c) => c.file);
      const clipDurations = ready.map((c) => c.duration || 0);
      const baseDurationSec = clipDurations.reduce((a, b) => a + b, 0);

      let loop: {
        mode: LoopMode;
        count?: number;
        targetSeconds?: number;
        baseDurationSec: number;
      } = { mode: "once", baseDurationSec };

      if (loopMode === "count") {
        loop = {
          mode: "count",
          count: Math.max(1, Math.floor(loopCount)),
          baseDurationSec,
        };
      } else if (loopMode === "duration") {
        const t = loopHours * 3600 + loopMins * 60 + loopSecs;
        if (t <= 0) throw new Error("目標時長必須大於 0");
        loop = { mode: "duration", targetSeconds: t, baseDurationSec };
      }

      const { blob } = await mergeVideos(files, {
        noAudio,
        audioFile: noAudio ? null : audioFile,
        clipDurations,
        loop,
        onLog: appendLog,
        onProgress: (r) => setProgress(Math.round(r * 100)),
        onStatus: (s) => setStatus(s),
      });

      const url = URL.createObjectURL(blob);
      setResultUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setResultBlob(blob);
      void savePreview(blob, {
        filename: getExportFilename("video-merge", "mp4"),
      });
      setStatus(`合併完成（${formatBytes(blob.size)}）`);
      setProgress(100);
    } catch (err) {
      const message = err instanceof Error ? err.message : "合併失敗";
      setStatus(message);
      appendLog(message);
    } finally {
      setMerging(false);
    }
  }, [
    appendLog,
    audioFile,
    loopCount,
    loopHours,
    loopMins,
    loopMode,
    loopSecs,
    merging,
    noAudio,
  ]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const canMerge = readyClips.length > 0 && !merging && !clips.some((c) => c.status === "loading");

  return (
    <div className="space-y-4 sm:space-y-6">
      <DataCard className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
              <Film size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold">影片合併 VideoMerge</h3>
              <p className="text-sm text-muted-foreground">
                多段影片首尾幀預覽、排序後合併為 MP4。本機 FFmpeg.wasm 處理，不上傳伺服器。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={SOURCE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1 rounded-full border border-[var(--line-soft)] px-2.5 text-[11px] font-medium text-[var(--muted-foreground)] transition-impeccable hover:bg-[color:var(--panel-soft)]"
            >
              <ExternalLink size={12} />
              原始專案
            </a>
            <a
              href={DEMO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1 rounded-full border border-[var(--line-soft)] px-2.5 text-[11px] font-medium text-[var(--muted-foreground)] transition-impeccable hover:bg-[color:var(--panel-soft)]"
            >
              <ExternalLink size={12} />
              線上 Demo
            </a>
          </div>
        </div>

        {/* Drop zone */}
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onClick={() => fileInputRef.current?.click()}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            setDragging(false);
          }}
          onDrop={onDrop}
          className={
            dragging
              ? "flex min-h-[130px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-violet-400 bg-violet-50/80 px-4 py-8 text-center dark:bg-violet-950/30"
              : "flex min-h-[130px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--line-soft)] bg-[color:var(--panel-soft)] px-4 py-8 text-center transition-impeccable hover:border-violet-300 hover:bg-violet-50/40 dark:hover:bg-violet-950/20"
          }
        >
          <Upload className="text-[var(--muted-foreground)]" size={28} />
          <p className="text-sm font-medium">拖曳影片到這裡，或點擊選擇</p>
          <p className="text-xs text-[var(--muted-foreground)]">
            支援多檔；清單會保留到按「清除全部」（重整也不會消失）
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {/* Options row */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={merging}
            onClick={() => fileInputRef.current?.click()}
          >
            再加入影片
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={merging || clips.length === 0}
            onClick={clearAll}
            className="gap-1.5 text-red-600 dark:text-red-400"
          >
            <Trash2 size={14} />
            清除全部
          </Button>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={noAudio}
              disabled={merging}
              onChange={(e) => setNoAudio(e.target.checked)}
              className="size-4 accent-[var(--accent)]"
            />
            不要聲音
          </label>
        </div>

        {/* Loop */}
        <div className="space-y-3 rounded-2xl border border-[var(--line-soft)] bg-[color:var(--panel-soft)] p-4">
          <div>
            <h4 className="text-sm font-semibold">延長 / 循環</h4>
            <p className="text-xs text-[var(--muted-foreground)]">{estimateLabel}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { value: "once" as const, label: "播一次" },
                { value: "count" as const, label: "重複次數" },
                { value: "duration" as const, label: "目標時長" },
              ] as const
            ).map((opt) => (
              <Button
                key={opt.value}
                type="button"
                size="sm"
                variant={loopMode === opt.value ? "default" : "outline"}
                disabled={merging}
                onClick={() => setLoopMode(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
          {loopMode === "count" ? (
            <label className="flex max-w-xs flex-col gap-1 text-xs">
              <span className="text-[var(--muted-foreground)]">重複幾次（整段序列）</span>
              <input
                type="number"
                min={1}
                max={LOOP_LIMITS.maxCount}
                value={loopCount}
                disabled={merging}
                onChange={(e) =>
                  setLoopCount(
                    Math.min(
                      LOOP_LIMITS.maxCount,
                      Math.max(1, Math.floor(Number(e.target.value) || 1))
                    )
                  )
                }
                className="h-9 rounded-lg border border-[var(--line-soft)] bg-background px-3 text-sm"
              />
            </label>
          ) : null}
          {loopMode === "duration" ? (
            <div className="flex flex-wrap gap-3">
              {(
                [
                  { label: "時", value: loopHours, set: setLoopHours, max: 2 },
                  { label: "分", value: loopMins, set: setLoopMins, max: 59 },
                  { label: "秒", value: loopSecs, set: setLoopSecs, max: 59 },
                ] as const
              ).map((f) => (
                <label key={f.label} className="flex w-20 flex-col gap-1 text-xs">
                  <span className="text-[var(--muted-foreground)]">{f.label}</span>
                  <input
                    type="number"
                    min={0}
                    max={f.max}
                    value={f.value}
                    disabled={merging}
                    onChange={(e) =>
                      f.set(Math.min(f.max, Math.max(0, Math.floor(Number(e.target.value) || 0))))
                    }
                    className="h-9 rounded-lg border border-[var(--line-soft)] bg-background px-3 text-sm"
                  />
                </label>
              ))}
              <p className="w-full text-[11px] text-[var(--muted-foreground)]">
                上限 {LOOP_LIMITS.maxDurationSec / 3600} 小時
              </p>
            </div>
          ) : null}
        </div>

        {/* Custom audio */}
        <div className="space-y-2 rounded-2xl border border-[var(--line-soft)] bg-[color:var(--panel-soft)] p-4">
          <h4 className="text-sm font-semibold">自訂音軌</h4>
          <p className="text-xs text-[var(--muted-foreground)]">
            可選 MP3 取代原聲音（短則循環、長則裁切）。勾選「不要聲音」時會忽略。
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.aac"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                pickAudio(f);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={merging || noAudio}
              onClick={() => audioInputRef.current?.click()}
            >
              選擇音訊
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={merging || !audioFile}
              onClick={() => {
                pickAudio(null);
                setStatus("已清除自訂音軌");
              }}
            >
              清除音軌
            </Button>
            <span className="truncate text-xs text-[var(--muted-foreground)]">
              {audioFile
                ? `${audioFile.name} · ${formatBytes(audioFile.size)}`
                : noAudio
                  ? "「不要聲音」已開啟"
                  : "未選擇音訊"}
            </span>
          </div>
        </div>

        {/* Merge CTA */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={() => void runMerge()}
            disabled={!canMerge}
            className="gap-1.5"
          >
            {merging ? <Loader2 size={16} className="animate-spin" /> : <Film size={16} />}
            {merging ? "合併中…" : `合併為 MP4（${readyClips.length} 段）`}
          </Button>
          <p className="text-sm text-[var(--muted-foreground)]">{status}</p>
        </div>

        {(merging || progress > 0) && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-[var(--muted-foreground)]">
              <span>進度</span>
              <span className="tabular-nums">{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--line-soft)]">
              <div
                className="h-full rounded-full bg-[linear-gradient(135deg,var(--accent-strong),var(--accent))] transition-[width] duration-300"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
            {logLines.length > 0 ? (
              <div className="space-y-1">
                <button
                  type="button"
                  className="text-[11px] text-[var(--muted-foreground)] underline-offset-2 hover:underline"
                  onClick={() => setShowLog((v) => !v)}
                >
                  {showLog ? "隱藏日誌" : "顯示日誌"}
                </button>
                {showLog ? (
                  <pre className="max-h-40 overflow-auto rounded-xl bg-black/80 p-3 text-[10px] leading-relaxed text-emerald-200">
                    {logLines.join("\n")}
                  </pre>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </DataCard>

      {/* Clip list */}
      <DataCard className="overflow-hidden p-0">
        <div className="border-b border-[var(--line-soft)] px-4 py-3 sm:px-5">
          <h4 className="text-sm font-semibold">片段與首尾幀</h4>
          <p className="text-xs text-[var(--muted-foreground)]">
            {clips.length === 0
              ? "尚未加入影片"
              : `${clips.length} 段 · 就緒 ${readyClips.length} · 總長約 ${formatDuration(baseDuration)}`}
          </p>
        </div>

        {clips.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[var(--muted-foreground)] sm:px-5">
            加入影片後，這裡會顯示每段的<strong>首幀</strong>與<strong>尾幀</strong>預覽。
          </div>
        ) : (
          <ul className="divide-y divide-[var(--line-soft)]">
            {clips.map((clip, index) => (
              <li
                key={clip.id}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-5"
              >
                <div className="flex min-w-0 flex-1 gap-3">
                  <div className="flex shrink-0 gap-1.5">
                    <FrameThumb src={clip.firstFrame} label="首" loading={clip.status === "loading"} />
                    <FrameThumb src={clip.lastFrame} label="尾" loading={clip.status === "loading"} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {index + 1}. {clip.name}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {clip.status === "loading"
                        ? "讀取中…"
                        : clip.status === "error"
                          ? clip.error || "錯誤"
                          : `${formatDuration(clip.duration ?? 0)} · ${clip.width ?? "?"}×${clip.height ?? "?"} · ${formatBytes(clip.size)}`}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1 self-end sm:self-center">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    disabled={merging || index === 0}
                    onClick={() => moveClip(clip.id, -1)}
                    aria-label="上移"
                  >
                    <ArrowUp size={14} />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    disabled={merging || index === clips.length - 1}
                    onClick={() => moveClip(clip.id, 1)}
                    aria-label="下移"
                  >
                    <ArrowDown size={14} />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-[var(--muted-foreground)]"
                    disabled={merging}
                    onClick={() => removeClip(clip.id)}
                    aria-label={`移除 ${clip.name}`}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DataCard>

      {/* Result */}
      {resultUrl ? (
        <DataCard className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold">合併結果</h4>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  if (resultBlob) {
                    downloadBlob(
                      resultBlob,
                      getExportFilename("video-merge", "mp4")
                    );
                  }
                }}
              >
                <Download size={14} />
                下載 MP4
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={clearResult}>
                清除預覽
              </Button>
            </div>
          </div>
          <video
            src={resultUrl}
            controls
            playsInline
            className="max-h-[420px] w-full rounded-xl bg-black"
          />
          {resultBlob ? (
            <p className="text-xs text-[var(--muted-foreground)]">
              {formatBytes(resultBlob.size)} · 1280×720 · 30fps · H.264
            </p>
          ) : null}
        </DataCard>
      ) : null}

      <p className="px-1 text-[11px] leading-relaxed text-[var(--muted-foreground)]">
        功能參考{" "}
        <a
          href={SOURCE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          huang1988pioneer/VideoMerge
        </a>
        。首次合併需下載 FFmpeg 核心（約數十 MB），之後可走快取。長影片或很多片段時瀏覽器內轉檔會較慢。進階字幕時間軸 / Whisper 辨識請使用原始{" "}
        <a href={DEMO_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          Demo
        </a>
        。
      </p>
    </div>
  );
}

function FrameThumb({
  src,
  label,
  loading,
}: {
  src: string | null;
  label: string;
  loading?: boolean;
}) {
  return (
    <div className="relative h-14 w-[4.5rem] overflow-hidden rounded-lg bg-[color:var(--panel-soft)] ring-1 ring-[var(--line-soft)]">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] text-[var(--muted-foreground)]">
          {loading ? <Loader2 size={14} className="animate-spin" /> : "—"}
        </div>
      )}
      <span className="absolute bottom-0.5 left-0.5 rounded bg-black/65 px-1 text-[9px] font-medium text-white">
        {label}
      </span>
    </div>
  );
}
