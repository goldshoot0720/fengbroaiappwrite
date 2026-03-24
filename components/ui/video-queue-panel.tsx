"use client";

import { useState, useEffect, useRef } from 'react';
import { Video, X, ListVideo, Trash2, Play, Pause, ChevronUp, ChevronDown, SkipForward } from 'lucide-react';
import { useVideoQueue, VideoQueueItem } from '@/hooks/useVideoQueue';
import { setupSinglePlayback } from '@/components/ui/plyr-player';

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
    queueLength 
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
        const resumeTime = typeof currentItem.startTime === 'number' && Number.isFinite(currentItem.startTime)
          ? currentItem.startTime
          : currentTime;
        if (resumeTime > 0) {
          video.currentTime = resumeTime;
        }
        if (typeof currentItem.volume === 'number') {
          video.volume = currentItem.volume;
        }
        if (typeof currentItem.playbackRate === 'number') {
          video.playbackRate = currentItem.playbackRate;
        }
        if (typeof currentItem.loop === 'boolean') {
          video.loop = currentItem.loop;
        }
        if (typeof currentItem.muted === 'boolean') {
          video.muted = currentItem.muted;
        }
        video.play().then(() => {
          setIsExpanded(!(typeof currentItem.startTime === 'number' && Number.isFinite(currentItem.startTime)));
        }).catch((err) => {
          console.error('影片播放失敗:', err.name, err.message);
        });
        video.removeEventListener('canplay', handleCanPlay);
      };
      video.addEventListener('canplay', handleCanPlay);
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
    if (!isFinite(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  return (
    <div className="video-queue-panel fixed bottom-20 right-3 z-50 md:right-4 md:top-20 md:bottom-auto">
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
        onError={(e) => console.error('影片加載錯誤:', e)}
      />

      {!isExpanded && (
        <div className="flex flex-col gap-2">
          {currentItem && (
            <div className="w-[min(calc(100vw-1.5rem),24rem)] rounded-2xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800 md:w-96">
              <div className="flex items-center gap-3">
                <div className="w-20 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-600">
                  {currentItem.cover ? (
                    <img src={currentItem.cover} alt={currentItem.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Video className="w-6 h-6 text-white" />
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                    {currentItem.name}
                  </div>
                  {currentItem.category && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {currentItem.category}
                    </div>
                  )}
                </div>

                <button
                  onClick={togglePlayPause}
                  className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>

                {currentIndex < queue.length - 1 && (
                  <button
                    onClick={skipToNext}
                    className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 rounded-full transition-colors"
                    title="下一個"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-gray-500 w-10">{formatTime(currentTime)}</span>
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleSeek}
                  className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <span className="text-xs text-gray-500 w-10 text-right">{formatTime(duration)}</span>
              </div>
            </div>
          )}
          
          <button
            onClick={() => setIsExpanded(true)}
            className="flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-all self-end"
          >
            <ListVideo className="w-5 h-5" />
            <span className="font-medium">播放佇列</span>
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-sm">
              {queueLength}
            </span>
          </button>
        </div>
      )}

      {isExpanded && (
        <div className="w-[min(calc(100vw-1.5rem),24rem)] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800 md:w-96">
          <div className="flex items-center justify-between p-4 bg-blue-600 text-white">
            <div className="flex items-center gap-2">
              <ListVideo className="w-5 h-5" />
              <span className="font-bold">接下來播放</span>
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-sm">
                {queueLength}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={clearQueue}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                title="清空佇列"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                title="收合"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {currentItem && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700">
              <div 
                className="relative aspect-video rounded-lg overflow-hidden bg-black mb-3 cursor-pointer"
                onClick={togglePlayPause}
              >
                {currentItem.cover ? (
                  <img src={currentItem.cover} alt={currentItem.name} className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-600">
                    <Video className="w-16 h-16 text-white/50" />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center">
                  {isPlaying ? (
                    <div className="w-16 h-16 bg-black/30 rounded-full flex items-center justify-center">
                      <Pause className="w-8 h-8 text-white" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors">
                      <Play className="w-8 h-8 text-white fill-current" />
                    </div>
                  )}
                </div>
                {isPlaying && (
                  <div className="absolute bottom-2 left-2 flex items-center gap-1">
                    <div className="w-1 h-3 bg-white rounded animate-pulse" style={{ animationDelay: '0ms' }} />
                    <div className="w-1 h-4 bg-white rounded animate-pulse" style={{ animationDelay: '150ms' }} />
                    <div className="w-1 h-2 bg-white rounded animate-pulse" style={{ animationDelay: '300ms' }} />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-gray-900 dark:text-gray-100 truncate">
                    {currentItem.name}
                  </div>
                  {currentItem.category && (
                    <div className="text-xs text-blue-600 dark:text-blue-400">
                      {currentItem.category}
                    </div>
                  )}
                  
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[10px] text-gray-500">{formatTime(currentTime)}</span>
                    <input
                      type="range"
                      min="0"
                      max={duration || 100}
                      value={currentTime}
                      onChange={handleSeek}
                      className="flex-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <span className="text-[10px] text-gray-500">{formatTime(duration)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={togglePlayPause}
                    className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors"
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </button>
                  {currentIndex < queue.length - 1 && (
                    <button
                      onClick={skipToNext}
                      className="p-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 rounded-full transition-colors"
                      title="下一個"
                    >
                      <SkipForward className="w-4 h-4" />
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
                className={`flex items-center gap-3 p-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0 ${
                  index === currentIndex 
                    ? 'bg-blue-50 dark:bg-blue-900/20' 
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                  {index === currentIndex ? (
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                  ) : (
                    <span className="text-xs text-gray-400">{index + 1}</span>
                  )}
                </div>

                <div className="w-16 h-10 flex-shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-600">
                  {item.cover ? (
                    <img src={item.cover} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Video className="w-5 h-5 text-white" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                    {item.name}
                  </div>
                  {item.category && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {item.category}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {index > 0 && (
                    <button
                      onClick={() => moveInQueue(index, index - 1)}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                      title="上移"
                    >
                      <ChevronUp className="w-4 h-4 text-gray-500" />
                    </button>
                  )}
                  {index < queue.length - 1 && (
                    <button
                      onClick={() => moveInQueue(index, index + 1)}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                      title="下移"
                    >
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    </button>
                  )}
                  <button
                    onClick={() => removeFromQueue(item.id)}
                    className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                    title="移除"
                  >
                    <X className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {currentIndex >= 0 && currentIndex < queue.length - 1 && (
            <div className="p-3 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={skipToNext}
                className="w-full flex items-center justify-center gap-2 py-2 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-lg transition-colors"
              >
                <SkipForward className="w-4 h-4" />
                <span className="text-sm font-medium">跳到下一個</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
