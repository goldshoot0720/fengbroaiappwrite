"use client";

import { useState, useEffect, useRef } from "react";
import { Video, X, ListVideo, Trash2, Play, Pause, ChevronUp, ChevronDown, SkipForward } from "lucide-react";
import { useVideoQueue, VideoQueueItem } from "@/hooks/useVideoQueue";
import { setupSinglePlayback } from "@/components/ui/plyr-player";

interface VideoQueuePanelProps {
  onPlayFromQueue?: (item: VideoQueueItem) => void;
}

export function VideoQueuePanel({ onPlayFromQueue }: VideoQueuePanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastPlayedKeyRef = useRef<string | null>(null);
  const {
    queue,
    currentIndex,
    currentItem,
    removeFromQueue,
    clearQueue,
    moveInQueue,
    skipToNext,
    queueLength,
  } = useVideoQueue();

  useEffect(() => {
    setupSinglePlayback();
  }, []);

  useEffect(() => {
    if (currentItem && currentItem.file && videoRef.current) {
      const playbackKey = currentItem.playbackKey || currentItem.id;
      const video = videoRef.current;
      const shouldReload = lastPlayedKeyRef.current !== playbackKey || !video.currentSrc;

      if (!shouldReload) {
        return;
      }

      lastPlayedKeyRef.current = playbackKey;
      video.pause();
      video.currentTime = 0;
      video.src = currentItem.file;
      video.load();

      const handleCanPlay = () => {
        const resumeTime =
          typeof currentItem.startTime === "number" && Number.isFinite(currentItem.startTime)
            ? currentItem.startTime
            : currentTime;
        if (resumeTime > 0) {
          video.currentTime = resumeTime;
        }
        if (typeof currentItem.volume === "number") {
          video.volume = currentItem.volume;
        }
        if (typeof currentItem.playbackRate === "number") {
          video.playbackRate = currentItem.playbackRate;
        }
        if (typeof currentItem.loop === "boolean") {
          video.loop = currentItem.loop;
        }
        if (typeof currentItem.muted === "boolean") {
          video.muted = currentItem.muted;
        }
        video
          .play()
          .then(() => {
            setIsExpanded(!(typeof currentItem.startTime === "number" && Number.isFinite(currentItem.startTime)));
          })
          .catch((err) => {
            console.error("影片播放失敗:", err.name, err.message);
          });
        video.removeEventListener("canplay", handleCanPlay);
      };
      video.addEventListener("canplay", handleCanPlay);
    }
  }, [currentItem, currentTime]);

  const togglePlayPause = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(console.error);
    }
  };

  const formatTime = (time: number) => {
    if (!isFinite(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const newTime = parseFloat(e.target.value);
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  if (queueLength === 0) {
    return null;
  }

  const shell =
    "rounded-xl border border-neutral-200/90 bg-white/95 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-[#141414]/95";
  const iconBtn =
    "inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400";
  const primaryPlay =
    "inline-flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 text-white transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100";

  return (
    <div className="video-queue-panel fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-3 z-[var(--z-dock)] md:bottom-auto md:right-3 md:top-20 xl:right-4">
      <video
        ref={videoRef}
        preload="auto"
        className="hidden"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={(e) => setCurrentTime((e.target as HTMLVideoElement).currentTime)}
        onDurationChange={(e) => setDuration((e.target as HTMLVideoElement).duration)}
        onEnded={() => {
          setIsPlaying(false);
          skipToNext();
        }}
        onError={(e) => console.error("影片加載錯誤:", e)}
      />

      {!isExpanded && (
        <div className="flex flex-col gap-2">
          {currentItem && (
            <div className={`w-[min(calc(100vw-1.5rem),24rem)] p-3 md:w-80 xl:w-96 ${shell}`}>
              <div className="flex items-center gap-3">
                <div className="h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-neutral-900">
                  {currentItem.cover ? (
                    <img src={currentItem.cover} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Video className="h-5 w-5 text-white/70" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-neutral-900 dark:text-white">
                    {currentItem.name}
                  </div>
                  {currentItem.category && (
                    <div className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                      {currentItem.category}
                    </div>
                  )}
                </div>

                <button type="button" onClick={togglePlayPause} className={primaryPlay} aria-label={isPlaying ? "暫停" : "播放"}>
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
                </button>

                {currentIndex < queue.length - 1 && (
                  <button
                    type="button"
                    onClick={skipToNext}
                    className={`${iconBtn} bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-white/10 dark:text-neutral-200 dark:hover:bg-white/15`}
                    title="下一則"
                    aria-label="下一則"
                  >
                    <SkipForward className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="mt-2.5 flex items-center gap-2">
                <span className="w-10 text-[11px] tabular-nums text-neutral-500">{formatTime(currentTime)}</span>
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleSeek}
                  className="h-1 flex-1 cursor-pointer appearance-none rounded-lg bg-neutral-200 accent-neutral-900 dark:bg-white/15 dark:accent-white"
                  aria-label="播放進度"
                />
                <span className="w-10 text-right text-[11px] tabular-nums text-neutral-500">{formatTime(duration)}</span>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="inline-flex items-center gap-2 self-end rounded-full bg-neutral-900 px-4 py-2.5 text-white shadow-lg transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
          >
            <ListVideo className="h-4 w-4" />
            <span className="text-sm font-medium">播放佇列</span>
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold tabular-nums dark:bg-black/10">
              {queueLength}
            </span>
          </button>
        </div>
      )}

      {isExpanded && (
        <div className={`w-[min(calc(100vw-1.5rem),24rem)] overflow-hidden md:w-80 xl:w-96 ${shell}`}>
          <div className="flex items-center justify-between border-b border-neutral-200/80 px-3 py-3 dark:border-white/10">
            <div className="flex min-w-0 items-center gap-2">
              <ListVideo className="h-4 w-4 shrink-0 text-neutral-700 dark:text-white" />
              <span className="truncate text-sm font-semibold text-neutral-900 dark:text-white">接下來播放</span>
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium tabular-nums text-neutral-700 dark:bg-white/10 dark:text-neutral-200">
                {queueLength}
              </span>
            </div>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={clearQueue}
                className={`${iconBtn} text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-white/10`}
                title="清空佇列"
                aria-label="清空佇列"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className={`${iconBtn} text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-white/10`}
                title="收合"
                aria-label="收合佇列"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {currentItem && (
            <div className="border-b border-neutral-200/80 p-3 dark:border-white/10">
              <button
                type="button"
                className="relative mb-3 aspect-video w-full cursor-pointer overflow-hidden rounded-lg bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
                onClick={togglePlayPause}
                aria-label={isPlaying ? "暫停" : "播放"}
              >
                {currentItem.cover ? (
                  <img src={currentItem.cover} alt="" className="h-full w-full object-contain" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-neutral-900">
                    <Video className="h-12 w-12 text-white/40" />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white">
                    {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 fill-current" />}
                  </div>
                </div>
                {isPlaying && (
                  <div className="absolute bottom-2 left-2 flex items-end gap-0.5" aria-hidden>
                    <div className="h-2 w-1 animate-pulse rounded bg-white" style={{ animationDelay: "0ms" }} />
                    <div className="h-3 w-1 animate-pulse rounded bg-white" style={{ animationDelay: "150ms" }} />
                    <div className="h-1.5 w-1 animate-pulse rounded bg-white" style={{ animationDelay: "300ms" }} />
                  </div>
                )}
              </button>

              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-neutral-900 dark:text-white">
                    {currentItem.name}
                  </div>
                  {currentItem.category && (
                    <div className="truncate text-xs text-neutral-500 dark:text-neutral-400">{currentItem.category}</div>
                  )}
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-[10px] tabular-nums text-neutral-500">{formatTime(currentTime)}</span>
                    <input
                      type="range"
                      min="0"
                      max={duration || 100}
                      value={currentTime}
                      onChange={handleSeek}
                      className="h-1 flex-1 cursor-pointer appearance-none rounded-lg bg-neutral-200 accent-neutral-900 dark:bg-white/15 dark:accent-white"
                      aria-label="播放進度"
                    />
                    <span className="text-[10px] tabular-nums text-neutral-500">{formatTime(duration)}</span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={togglePlayPause} className={primaryPlay} aria-label={isPlaying ? "暫停" : "播放"}>
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
                  </button>
                  {currentIndex < queue.length - 1 && (
                    <button
                      type="button"
                      onClick={skipToNext}
                      className={`${iconBtn} bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-white/10 dark:text-neutral-200 dark:hover:bg-white/15`}
                      title="下一則"
                      aria-label="下一則"
                    >
                      <SkipForward className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="max-h-60 overflow-y-auto">
            {queue.map((item, index) => (
              <div
                key={item.id}
                className={`flex items-center gap-2.5 border-b border-neutral-100 px-3 py-2.5 last:border-b-0 dark:border-white/5 ${
                  index === currentIndex
                    ? "bg-neutral-100/90 dark:bg-white/10"
                    : "hover:bg-neutral-50 dark:hover:bg-white/5"
                }`}
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                  {index === currentIndex ? (
                    <div className="h-2 w-2 animate-pulse rounded-full bg-neutral-900 dark:bg-white" />
                  ) : (
                    <span className="text-xs tabular-nums text-neutral-400">{index + 1}</span>
                  )}
                </div>

                <div className="h-10 w-16 shrink-0 overflow-hidden rounded-md bg-neutral-900">
                  {item.cover ? (
                    <img src={item.cover} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Video className="h-4 w-4 text-white/60" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-neutral-900 dark:text-white">{item.name}</div>
                  {item.category && (
                    <div className="truncate text-xs text-neutral-500 dark:text-neutral-400">{item.category}</div>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-0.5">
                  {index > 0 && (
                    <button
                      type="button"
                      onClick={() => moveInQueue(index, index - 1)}
                      className="rounded p-1 text-neutral-500 transition-colors hover:bg-neutral-200/80 dark:hover:bg-white/10"
                      title="上移"
                      aria-label="上移"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                  )}
                  {index < queue.length - 1 && (
                    <button
                      type="button"
                      onClick={() => moveInQueue(index, index + 1)}
                      className="rounded p-1 text-neutral-500 transition-colors hover:bg-neutral-200/80 dark:hover:bg-white/10"
                      title="下移"
                      aria-label="下移"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeFromQueue(item.id)}
                    className="rounded p-1 text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950/40"
                    title="移除"
                    aria-label="移除"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {currentIndex >= 0 && currentIndex < queue.length - 1 && (
            <div className="border-t border-neutral-200/80 p-3 dark:border-white/10">
              <button
                type="button"
                onClick={skipToNext}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-100 py-2 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
              >
                <SkipForward className="h-4 w-4" />
                跳到下一則
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
