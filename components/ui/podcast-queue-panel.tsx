"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ListMusic,
  Mic2,
  Pause,
  Play,
  SkipForward,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { usePodcastQueue } from "@/hooks/usePodcastQueue";
import { setupSinglePlayback } from "@/components/ui/plyr-player";

function formatTime(time: number) {
  if (!Number.isFinite(time)) {
    return "0:00";
  }

  const mins = Math.floor(time / 60);
  const secs = Math.floor(time % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function PodcastQueuePanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastPlayedIdRef = useRef<string | null>(null);
  const {
    queue,
    currentIndex,
    currentItem,
    removeFromQueue,
    clearQueue,
    moveInQueue,
    skipToNext,
    queueLength,
  } = usePodcastQueue();

  useEffect(() => {
    setupSinglePlayback();
  }, []);

  useEffect(() => {
    const activeMedia = currentItem?.mediaType === "video" ? videoRef.current : audioRef.current;
    const inactiveMedia = currentItem?.mediaType === "video" ? audioRef.current : videoRef.current;

    if (!currentItem || !activeMedia) {
      if (!currentItem) {
        lastPlayedIdRef.current = null;
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
      }
      return;
    }

    if (lastPlayedIdRef.current === currentItem.id) {
      return;
    }

    lastPlayedIdRef.current = currentItem.id;
    inactiveMedia?.pause();
    if (inactiveMedia) {
      inactiveMedia.removeAttribute("src");
      inactiveMedia.load();
    }

    activeMedia.pause();
    activeMedia.currentTime = 0;
    activeMedia.src = currentItem.file;
    activeMedia.load();

    const handleCanPlay = () => {
      activeMedia
        .play()
        .then(() => setIsExpanded(true))
        .catch((error) => console.error("Podcast playback failed:", error));
      activeMedia.removeEventListener("canplay", handleCanPlay);
    };

    activeMedia.addEventListener("canplay", handleCanPlay);

    return () => {
      activeMedia.removeEventListener("canplay", handleCanPlay);
    };
  }, [currentItem]);

  const activeMediaRef = currentItem?.mediaType === "video" ? videoRef : audioRef;

  const togglePlayPause = () => {
    const media = activeMediaRef.current;
    if (!media) {
      return;
    }

    if (isPlaying) {
      media.pause();
      return;
    }

    media.play().catch((error) => console.error("Podcast resume failed:", error));
  };

  const handleSeek = (value: number) => {
    const media = activeMediaRef.current;
    if (!media) {
      return;
    }

    media.currentTime = value;
    setCurrentTime(value);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    skipToNext();
  };

  if (queueLength === 0) {
    return (
      <>
        <audio
          ref={audioRef}
          className="hidden"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={(event) => setCurrentTime((event.target as HTMLAudioElement).currentTime)}
          onDurationChange={(event) => setDuration((event.target as HTMLAudioElement).duration)}
          onEnded={handleEnded}
        />
        <video
          ref={videoRef}
          className="hidden"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={(event) => setCurrentTime((event.target as HTMLVideoElement).currentTime)}
          onDurationChange={(event) => setDuration((event.target as HTMLVideoElement).duration)}
          onEnded={handleEnded}
        />
      </>
    );
  }

  return (
    <div className="podcast-queue-panel fixed right-4 top-20 z-50">
      <audio
        ref={audioRef}
        preload="auto"
        className="hidden"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={(event) => setCurrentTime((event.target as HTMLAudioElement).currentTime)}
        onDurationChange={(event) => setDuration((event.target as HTMLAudioElement).duration)}
        onEnded={handleEnded}
      />
      <video
        ref={videoRef}
        preload="auto"
        className="hidden"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={(event) => setCurrentTime((event.target as HTMLVideoElement).currentTime)}
        onDurationChange={(event) => setDuration((event.target as HTMLVideoElement).duration)}
        onEnded={handleEnded}
      />

      {!isExpanded && currentItem ? (
        <div className="flex flex-col gap-2">
          <div className="w-96 rounded-2xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-amber-500 to-orange-500">
                {currentItem.cover ? (
                  <img
                    src={currentItem.cover}
                    alt={currentItem.name}
                    className="h-full w-full object-cover"
                  />
                ) : currentItem.mediaType === "video" ? (
                  <Video className="h-6 w-6 text-white" />
                ) : (
                  <Mic2 className="h-6 w-6 text-white" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                  {currentItem.name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {currentItem.category || (currentItem.mediaType === "video" ? "影片播客" : "音訊播客")}
                </div>
              </div>

              <button
                type="button"
                onClick={togglePlayPause}
                className="rounded-full bg-amber-500 p-2 text-white transition-colors hover:bg-amber-600"
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </button>

              {currentIndex < queue.length - 1 ? (
                <button
                  type="button"
                  onClick={skipToNext}
                  className="rounded-full bg-gray-100 p-2 text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                >
                  <SkipForward className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            <div className="mt-2 flex items-center gap-2">
              <span className="w-10 text-xs text-gray-500">{formatTime(currentTime)}</span>
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={(event) => handleSeek(parseFloat(event.target.value))}
                className="h-1 flex-1 cursor-pointer appearance-none rounded-lg bg-gray-200 accent-amber-500 dark:bg-gray-700"
              />
              <span className="w-10 text-right text-xs text-gray-500">{formatTime(duration)}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="self-end rounded-full bg-amber-500 px-4 py-3 text-white shadow-lg transition-all hover:bg-amber-600"
          >
            <span className="flex items-center gap-2">
              <ListMusic className="h-5 w-5" />
              <span className="font-medium">播客佇列</span>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-sm">{queueLength}</span>
            </span>
          </button>
        </div>
      ) : null}

      {isExpanded ? (
        <div className="w-96 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between bg-amber-500 p-4 text-white">
            <div className="flex items-center gap-2">
              <ListMusic className="h-5 w-5" />
              <span className="font-bold">播客佇列</span>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-sm">{queueLength}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={clearQueue}
                className="rounded-lg p-1.5 transition-colors hover:bg-white/20"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="rounded-lg p-1.5 transition-colors hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {currentItem ? (
            <div className="border-b border-gray-200 bg-amber-50 p-3 dark:border-gray-700 dark:bg-amber-950/20">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-md">
                  {currentItem.cover ? (
                    <img
                      src={currentItem.cover}
                      alt={currentItem.name}
                      className="h-full w-full object-cover"
                    />
                  ) : currentItem.mediaType === "video" ? (
                    <Video className="h-7 w-7 text-white" />
                  ) : (
                    <Mic2 className="h-7 w-7 text-white" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
                    {currentItem.name}
                  </div>
                  <div className="text-xs text-amber-700 dark:text-amber-300">
                    {currentItem.category || (currentItem.mediaType === "video" ? "影片播客" : "音訊播客")}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[10px] text-gray-500">{formatTime(currentTime)}</span>
                    <input
                      type="range"
                      min="0"
                      max={duration || 100}
                      value={currentTime}
                      onChange={(event) => handleSeek(parseFloat(event.target.value))}
                      className="h-1 flex-1 cursor-pointer appearance-none rounded-lg bg-gray-300 accent-amber-500 dark:bg-gray-600"
                    />
                    <span className="text-[10px] text-gray-500">{formatTime(duration)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={togglePlayPause}
                    className="rounded-full bg-amber-500 p-2 text-white transition-colors hover:bg-amber-600"
                  >
                    {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                  </button>
                  {currentIndex < queue.length - 1 ? (
                    <button
                      type="button"
                      onClick={skipToNext}
                      className="rounded-full bg-gray-200 p-1.5 text-gray-600 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                    >
                      <SkipForward className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          <div className="max-h-72 overflow-y-auto">
            {queue.map((item, index) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 border-b border-gray-100 p-3 last:border-b-0 dark:border-gray-700 ${
                  index === currentIndex
                    ? "bg-amber-50 dark:bg-amber-950/20"
                    : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                }`}
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                  {index === currentIndex ? (
                    <div className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                  ) : (
                    <span className="text-xs text-gray-400">{index + 1}</span>
                  )}
                </div>

                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-amber-500 to-orange-500">
                  {item.cover ? (
                    <img src={item.cover} alt={item.name} className="h-full w-full object-cover" />
                  ) : item.mediaType === "video" ? (
                    <Video className="h-5 w-5 text-white" />
                  ) : (
                    <Mic2 className="h-5 w-5 text-white" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                    {item.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {item.category || (item.mediaType === "video" ? "影片播客" : "音訊播客")}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {index > 0 ? (
                    <button
                      type="button"
                      onClick={() => moveInQueue(index, index - 1)}
                      className="rounded p-1 transition-colors hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      <ChevronUp className="h-4 w-4 text-gray-500" />
                    </button>
                  ) : null}
                  {index < queue.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => moveInQueue(index, index + 1)}
                      className="rounded p-1 transition-colors hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => removeFromQueue(item.id)}
                    className="rounded p-1 transition-colors hover:bg-red-100 dark:hover:bg-red-900/30"
                  >
                    <X className="h-4 w-4 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
