"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Download,
  ExternalLink,
  Film,
  FileText,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import { Button } from "@/components/ui/button";
import { getExportFilename } from "@/lib/utils";
import {
  LOOP_LIMITS,
  buildMergeSubtitles,
  clearClips,
  clearStoredAudio,
  clearStoredPreview,
  extractFrames,
  formatBytes,
  formatDuration,
  getMediaDuration,
  loadAudio,
  loadClips,
  loadPreview,
  mergeVideos,
  saveAudio,
  saveClips,
  savePreview,
  transcribeAudioToSubtitles,
  type LoopMode,
  type VideoClip,
} from "@/lib/videoMerge";

const SOURCE_URL = "https://github.com/huang1988pioneer/VideoMerge";
const DEMO_URL = "https://video-merge-one.vercel.app";
const LOOP_STORE_KEY = "fengbro.tools.videomerge.loop";
const SCRIPT_STORE_KEY = "fengbro.tools.videomerge.script";
const ASR_STORE_KEY = "fengbro.tools.videomerge.asr";

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
  const [scriptText, setScriptText] = useState("");
  const [scriptPreview, setScriptPreview] = useState<{
    cueCount: number;
    source: string;
    mode: string;
    srt: string;
  } | null>(null);
  const [lastSrt, setLastSrt] = useState<string | null>(null);
  const [subsEmbedded, setSubsEmbedded] = useState<boolean | null>(null);
  const [autoSubs, setAutoSubs] = useState(false);
  const [asrLanguage, setAsrLanguage] = useState<"chinese" | "english" | "auto">(
    "chinese"
  );
  const [asrBusy, setAsrBusy] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const scriptFileRef = useRef<HTMLInputElement>(null);
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

  const estimateOutDuration = useMemo(() => {
    if (baseDuration <= 0) return 0;
    if (loopMode === "once") return baseDuration;
    if (loopMode === "count") return baseDuration * Math.max(1, loopCount);
    return targetSeconds > 0 ? targetSeconds : baseDuration;
  }, [baseDuration, loopCount, loopMode, targetSeconds]);

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
        const script = localStorage.getItem(SCRIPT_STORE_KEY);
        if (script) setScriptText(script);
        const asrRaw = localStorage.getItem(ASR_STORE_KEY);
        if (asrRaw) {
          try {
            const asr = JSON.parse(asrRaw) as {
              autoSubs?: boolean;
              language?: "chinese" | "english" | "auto";
            };
            if (typeof asr.autoSubs === "boolean") setAutoSubs(asr.autoSubs);
            if (
              asr.language === "chinese" ||
              asr.language === "english" ||
              asr.language === "auto"
            ) {
              setAsrLanguage(asr.language);
            }
          } catch {
            /* ignore */
          }
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

  // Persist script
  useEffect(() => {
    if (!hydrated) return;
    try {
      if (scriptText.trim()) localStorage.setItem(SCRIPT_STORE_KEY, scriptText);
      else localStorage.removeItem(SCRIPT_STORE_KEY);
    } catch {
      /* ignore */
    }
  }, [hydrated, scriptText]);

  // Persist ASR options
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        ASR_STORE_KEY,
        JSON.stringify({ autoSubs, language: asrLanguage })
      );
    } catch {
      /* ignore */
    }
  }, [asrLanguage, autoSubs, hydrated]);

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
    setScriptText("");
    setScriptPreview(null);
    setLastSrt(null);
    setSubsEmbedded(null);
    setProgress(0);
    setLogLines([]);
    setResultBlob(null);
    setResultUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (audioInputRef.current) audioInputRef.current.value = "";
    if (scriptFileRef.current) scriptFileRef.current.value = "";
    void clearClips();
    void clearStoredAudio();
    void clearStoredPreview();
    setAutoSubs(false);
    setAsrLanguage("chinese");
    try {
      localStorage.removeItem(LOOP_STORE_KEY);
      localStorage.removeItem(SCRIPT_STORE_KEY);
      localStorage.removeItem(ASR_STORE_KEY);
    } catch {
      /* ignore */
    }
    setStatus("已清除全部");
  }, []);

  const resolveFinalDuration = useCallback(() => {
    if (estimateOutDuration > 0) return estimateOutDuration;
    return baseDuration;
  }, [baseDuration, estimateOutDuration]);

  const buildScriptPreview = useCallback(async () => {
    const text = scriptText.trim();
    if (!text) {
      setScriptPreview(null);
      setStatus("請先貼上語音稿或上傳 SRT / VTT / TXT");
      return;
    }
    const videoDur = resolveFinalDuration();
    if (videoDur <= 0.5) {
      setStatus("請先加入影片，才能依時長切句");
      return;
    }
    try {
      let audioDur: number | null = null;
      if (audioFile && !noAudio) {
        try {
          audioDur = await getMediaDuration(audioFile);
        } catch {
          audioDur = null;
        }
      }
      const built = buildMergeSubtitles({
        scriptText: text,
        videoDur,
        audioDur,
        hasCustomAudio: Boolean(audioFile) && !noAudio,
      });
      setScriptPreview({
        cueCount: built.cueCount,
        source: built.source,
        mode: built.mode,
        srt: built.srt,
      });
      setLastSrt(built.srt);
      setStatus(
        `語音稿就緒：${built.cueCount} 句（${
          built.source === "timed" ? "已含時間軸" : "依時長自動切句"
        } · 輸出約 ${formatDuration(videoDur)}）`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "無法產生字幕";
      setScriptPreview(null);
      setStatus(message);
    }
  }, [audioFile, noAudio, resolveFinalDuration, scriptText]);

  const downloadSrt = useCallback(() => {
    const srt = lastSrt || scriptPreview?.srt;
    if (!srt?.trim()) {
      setStatus("尚無字幕可下載，請先預覽語音稿、執行辨識或完成合併");
      return;
    }
    downloadBlob(
      new Blob([srt], { type: "text/plain;charset=utf-8" }),
      getExportFilename("video-merge", "srt")
    );
  }, [lastSrt, scriptPreview?.srt]);

  const runWhisperPreview = useCallback(async () => {
    if (asrBusy || merging) return;
    if (!audioFile || noAudio) {
      setStatus("請先選擇自訂音軌（MP3 等），再執行 Whisper 辨識");
      return;
    }
    setAsrBusy(true);
    setShowLog(true);
    setProgress(0);
    try {
      const result = await transcribeAudioToSubtitles(audioFile, {
        language: asrLanguage === "auto" ? null : asrLanguage,
        onStatus: (s) => setStatus(s),
        onProgress: (r) => setProgress(Math.round(r * 100)),
        onLog: appendLog,
      });
      setLastSrt(result.srt);
      setScriptPreview({
        cueCount: result.chunks.length,
        source: "whisper",
        mode: "asr",
        srt: result.srt,
      });
      // Also fill textarea so user can edit before merge
      if (!scriptText.trim()) {
        setScriptText(result.srt);
      }
      setStatus(
        `Whisper 就緒：${result.chunks.length} 句（model=${result.modelId || "?"}）`
      );
      setProgress(100);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Whisper 辨識失敗";
      setStatus(message);
      appendLog(message);
    } finally {
      setAsrBusy(false);
    }
  }, [appendLog, asrBusy, asrLanguage, audioFile, merging, noAudio, scriptText]);

  const onScriptFile = useCallback(async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      setScriptText(text);
      setStatus(`已載入講稿：${file.name}`);
    } catch {
      setStatus("無法讀取講稿檔案");
    }
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
    if (merging || asrBusy) return;
    const ready = clipsRef.current.filter((c) => c.status === "ready");
    if (!ready.length) {
      setStatus("請先加入可讀取的影片");
      return;
    }

    setMerging(true);
    setProgress(0);
    setLogLines([]);
    setShowLog(true);
    setSubsEmbedded(null);
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

      let outDur = baseDurationSec;
      if (loop.mode === "count") {
        outDur = baseDurationSec * Math.max(1, Math.floor(Number(loop.count) || 1));
      } else if (loop.mode === "duration") {
        outDur = Math.max(0.1, Number(loop.targetSeconds) || baseDurationSec);
      }

      let subtitleSrt: string | null = null;
      const wantAsr =
        autoSubs && Boolean(audioFile) && !noAudio && !scriptText.trim();
      const wantScript = Boolean(scriptText.trim());

      if (wantAsr && audioFile) {
        appendLog("依音軌 Whisper 自動辨識字幕…");
        const result = await transcribeAudioToSubtitles(audioFile, {
          language: asrLanguage === "auto" ? null : asrLanguage,
          onStatus: (s) => setStatus(s),
          onProgress: (r) => setProgress(Math.round(r * 40)),
          onLog: appendLog,
        });
        subtitleSrt = result.srt;
        setLastSrt(result.srt);
        setScriptPreview({
          cueCount: result.chunks.length,
          source: "whisper",
          mode: "asr",
          srt: result.srt,
        });
        appendLog(
          `Whisper 字幕：${result.chunks.length} 句 · model=${result.modelId || "?"}`
        );
      } else if (wantScript) {
        let audioDur: number | null = null;
        if (audioFile && !noAudio) {
          try {
            audioDur = await getMediaDuration(audioFile);
          } catch {
            audioDur = null;
          }
        }
        const built = buildMergeSubtitles({
          scriptText,
          videoDur: outDur,
          audioDur,
          hasCustomAudio: Boolean(audioFile) && !noAudio,
        });
        subtitleSrt = built.srt || null;
        setLastSrt(built.srt);
        setScriptPreview({
          cueCount: built.cueCount,
          source: built.source,
          mode: built.mode,
          srt: built.srt,
        });
        appendLog(
          `語音稿字幕：${built.cueCount} 句 · source=${built.source} · mode=${built.mode}`
        );
      } else if (autoSubs && !audioFile) {
        appendLog("已勾選自動辨識但未選音軌，略過字幕");
      }

      const asrProgressBase = wantAsr ? 40 : 0;
      const asrProgressScale = wantAsr ? 60 : 100;
      const { blob, subtitlesEmbedded } = await mergeVideos(files, {
        noAudio,
        audioFile: noAudio ? null : audioFile,
        subtitleSrt,
        clipDurations,
        loop,
        onLog: appendLog,
        onProgress: (r) =>
          setProgress(Math.round(asrProgressBase + r * asrProgressScale)),
        onStatus: (s) => setStatus(s),
      });

      setSubsEmbedded(subtitleSrt ? subtitlesEmbedded : null);

      const url = URL.createObjectURL(blob);
      setResultUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setResultBlob(blob);
      void savePreview(blob, {
        filename: getExportFilename("video-merge", "mp4"),
      });
      const subNote = !subtitleSrt
        ? ""
        : subtitlesEmbedded
          ? " · 已嵌入軟字幕"
          : " · 字幕嵌入失敗（可下載 SRT）";
      setStatus(`合併完成（${formatBytes(blob.size)}）${subNote}`);
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
    asrBusy,
    asrLanguage,
    audioFile,
    autoSubs,
    loopCount,
    loopHours,
    loopMins,
    loopMode,
    loopSecs,
    merging,
    noAudio,
    scriptText,
  ]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const canMerge =
    readyClips.length > 0 &&
    !merging &&
    !asrBusy &&
    !clips.some((c) => c.status === "loading");

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
                多段影片首尾幀預覽、排序、自訂音軌、語音稿／Whisper 字幕後合併為 MP4。本機
                FFmpeg.wasm + Transformers.js 處理，不上傳伺服器。
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
          <div className="flex flex-wrap items-center gap-3 border-t border-[var(--line-soft)] pt-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoSubs}
                disabled={merging || asrBusy || noAudio || !audioFile}
                onChange={(e) => {
                  const on = e.target.checked;
                  setAutoSubs(on);
                  if (on && scriptText.trim()) {
                    setStatus("已有語音稿時優先用講稿；清除講稿後合併才會跑 Whisper");
                  }
                }}
                className="h-4 w-4 rounded border-[var(--line-soft)]"
              />
              <span>依音軌 Whisper 自動辨識字幕</span>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
              語言
              <select
                value={asrLanguage}
                disabled={merging || asrBusy || !autoSubs}
                onChange={(e) =>
                  setAsrLanguage(e.target.value as "chinese" | "english" | "auto")
                }
                className="h-8 rounded-lg border border-[var(--line-soft)] bg-background px-2 text-sm text-foreground"
              >
                <option value="chinese">中文</option>
                <option value="english">English</option>
                <option value="auto">自動</option>
              </select>
            </label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={merging || asrBusy || noAudio || !audioFile}
              onClick={() => void runWhisperPreview()}
              className="gap-1"
            >
              {asrBusy ? <Loader2 size={14} className="animate-spin" /> : null}
              {asrBusy ? "辨識中…" : "先辨識預覽"}
            </Button>
          </div>
          <p className="text-[11px] leading-relaxed text-[var(--muted-foreground)]">
            首次需下載 Whisper 模型（約數十 MB，之後快取）。有現成講稿時建議直接貼語音稿，較快也較準。
            勾選自動辨識且<strong>未填講稿</strong>時，合併會先跑 ASR 再合成。
          </p>
        </div>

        {/* Script / subtitles */}
        <div className="space-y-3 rounded-2xl border border-[var(--line-soft)] bg-[color:var(--panel-soft)] p-4">
          <div className="flex items-start gap-2">
            <FileText className="mt-0.5 shrink-0 text-violet-600 dark:text-violet-300" size={16} />
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-semibold">語音稿字幕</h4>
              <p className="text-xs text-[var(--muted-foreground)]">
                貼上／上傳講稿，依輸出時長自動切句；亦支援 SRT、VTT 或{" "}
                <code className="rounded bg-black/5 px-1 dark:bg-white/10">[00:01-00:03] 文字</code>
                。合併時 soft-mux 進 MP4（mov_text）；瀏覽器預覽未必顯示字幕，請用下載的 SRT 或支援軟字幕的播放器。
              </p>
            </div>
          </div>
          <textarea
            value={scriptText}
            disabled={merging || asrBusy}
            onChange={(e) => {
              setScriptText(e.target.value);
              setScriptPreview(null);
            }}
            rows={6}
            placeholder={"例如：\n歡迎來到鋒兄工具。\n今天示範影片合併與語音稿字幕。\n\n或直接貼上完整 SRT / VTT。"}
            className="w-full resize-y rounded-xl border border-[var(--line-soft)] bg-background px-3 py-2 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={scriptFileRef}
              type="file"
              accept=".txt,.srt,.vtt,text/plain,application/x-subrip"
              className="hidden"
              onChange={(e) => {
                void onScriptFile(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={merging || asrBusy}
              onClick={() => scriptFileRef.current?.click()}
            >
              上傳講稿 / SRT
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={merging || asrBusy || !scriptText.trim() || readyClips.length === 0}
              onClick={() => void buildScriptPreview()}
            >
              預覽切句
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={merging || asrBusy || !scriptText.trim()}
              onClick={() => {
                setScriptText("");
                setScriptPreview(null);
                setLastSrt(null);
                setStatus("已清除語音稿");
              }}
            >
              清除講稿
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={!lastSrt && !scriptPreview?.srt}
              onClick={downloadSrt}
              className="gap-1"
            >
              <Download size={14} />
              下載 SRT
            </Button>
          </div>
          {scriptPreview ? (
            <div className="rounded-xl border border-violet-200/70 bg-violet-50/60 p-3 text-xs dark:border-violet-900/50 dark:bg-violet-950/30">
              <p className="font-medium text-violet-900 dark:text-violet-100">
                {scriptPreview.cueCount} 句字幕 ·{" "}
                {scriptPreview.source === "whisper"
                  ? "Whisper 自動辨識"
                  : scriptPreview.source === "timed"
                    ? "時間軸格式"
                    : "純文字自動切句"}{" "}
                · 輸出時長約 {formatDuration(estimateOutDuration || baseDuration)}
              </p>
              <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-violet-900/90 dark:text-violet-100/90">
                {scriptPreview.srt.split("\n").slice(0, 24).join("\n")}
                {scriptPreview.srt.split("\n").length > 24 ? "\n…" : ""}
              </pre>
            </div>
          ) : scriptText.trim() ? (
            <p className="text-[11px] text-[var(--muted-foreground)]">
              已輸入講稿，合併時會自動切句並嘗試嵌入；也可先按「預覽切句」檢查。
            </p>
          ) : null}
        </div>

        {/* Merge CTA */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={() => void runMerge()}
            disabled={!canMerge}
            className="gap-1.5"
          >
            {merging || asrBusy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Film size={16} />
            )}
            {merging
              ? "合併中…"
              : asrBusy
                ? "辨識中…"
                : `合併為 MP4（${readyClips.length} 段）`}
          </Button>
          <p className="text-sm text-[var(--muted-foreground)]">{status}</p>
        </div>

        {(merging || asrBusy || progress > 0) && (
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
              {lastSrt ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={downloadSrt}
                >
                  <Download size={14} />
                  下載 SRT
                </Button>
              ) : null}
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
              {subsEmbedded === true
                ? " · 含軟字幕 (mov_text)"
                : subsEmbedded === false
                  ? " · 字幕未嵌入（請下載 SRT）"
                  : ""}
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
        。首次合併需下載 FFmpeg 核心；Whisper 首次另需下載模型（皆可快取）。長影片或很多片段時瀏覽器內轉檔／辨識會較慢。
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
