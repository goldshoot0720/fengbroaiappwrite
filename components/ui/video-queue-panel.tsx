"use client";

import { useState, useEffect, useRef } from 'react';
import { Video, X, ListVideo, Trash2, Play, Pause, ChevronUp, ChevronDown, SkipForward } from 'lucide-react';
import { useVideoQueue, VideoQueueItem } from '@/hooks/useVideoQueue';
import { Button } from '@/components/ui/button';

interface VideoQueuePanelProps {
  onPlayFromQueue?: (item: VideoQueueItem) => void;
}

export function VideoQueuePanel({ onPlayFromQueue }: VideoQueuePanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
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
    queueLength 
  } = useVideoQueue();

  // 當 currentItem 變化時自動播放（唯一的播放觸發點）
  useEffect(() => {
    if (currentItem && currentItem.file && videoRef.current) {
      // 只有當影片變化時才播放（避免重複播放）
      if (lastPlayedIdRef.current !== currentItem.id) {
        console.log('播放影片:', currentItem.name, currentItem.file);
        lastPlayedIdRef.current = currentItem.id;
        
        const video = videoRef.current;
        // 先暫停並重置，避免衝突
        video.pause();
        video.currentTime = 0;
        video.src = currentItem.file;
        
        // 等待 src 載入後再播放
        video.load();
        
        // 使用 canplay 事件確保影片已載入
        const handleCanPlay = () => {
          video.play().then(() => {
            console.log('影片播放成功:', currentItem.name);
            setIsExpanded(true);
          }).catch((err) => {
            console.error('影片播放失敗:', err.name, err.message);
          });
          video.removeEventListener('canplay', handleCanPlay);
        };
        video.addEventListener('canplay', handleCanPlay);
      }
    }
  }, [currentItem]);

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

  // 如果佇列為空，不顯示任何內容
  if (queueLength === 0) {
    return null;
  }

  return (
    <div className="fixed top-20 right-4 z-50 video-queue-panel">
      {/* 單一視頻元素 - 放在最外層，不跟隨 isExpanded 重新挂載 */}
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

      {/* 收合的按鈕（帶 mini 播放器） */}
      {!isExpanded && (
        <div className="flex flex-col gap-2">
          {/* 如果有正在播放的影片，顯示 mini 播放器 */}
          {currentItem && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-3 w-96">
              <div className="flex items-center gap-3">
                {/* 封面 */}
                <div className="w-20 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-600">
                  {currentItem.cover ? (
                    <img src={currentItem.cover} alt={currentItem.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Video className="w-6 h-6 text-white" />
                    </div>
                  )}
                </div>
                
                {/* 資訊 */}
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

                {/* 播放/暫停 */}
                <button
                  onClick={togglePlayPause}
                  className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>

                {/* 下一個 */}
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
              
              {/* 進度條 */}
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
          
          {/* 佇列按鈕 */}
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

      {/* 展開的面板 */}
      {isExpanded && (
        <div className="w-96 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* 標題列 */}
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

          {/* 當前播放的影片 - 使用 Canvas 顯示影片畫面 */}
          {currentItem && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700">
              {/* 影片預覽區 - 使用封面圖代替即時播放 */}
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
                {/* 播放狀態指示 */}
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
                {/* 播放中動畫 */}
                {isPlaying && (
                  <div className="absolute bottom-2 left-2 flex items-center gap-1">
                    <div className="w-1 h-3 bg-white rounded animate-pulse" style={{ animationDelay: '0ms' }} />
                    <div className="w-1 h-4 bg-white rounded animate-pulse" style={{ animationDelay: '150ms' }} />
                    <div className="w-1 h-2 bg-white rounded animate-pulse" style={{ animationDelay: '300ms' }} />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                {/* 資訊和控制 */}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-gray-900 dark:text-gray-100 truncate">
                    {currentItem.name}
                  </div>
                  {currentItem.category && (
                    <div className="text-xs text-blue-600 dark:text-blue-400">
                      {currentItem.category}
                    </div>
                  )}
                  
                  {/* 進度條 */}
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

                {/* 播放控制 */}
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

          {/* 佇列列表 */}
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
                {/* 序號/播放中指示 */}
                <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                  {index === currentIndex ? (
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                  ) : (
                    <span className="text-xs text-gray-400">{index + 1}</span>
                  )}
                </div>

                {/* 封面 */}
                <div className="w-16 h-10 flex-shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-600">
                  {item.cover ? (
                    <img src={item.cover} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Video className="w-5 h-5 text-white" />
                    </div>
                  )}
                </div>

                {/* 資訊 */}
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

                {/* 操作按鈕 */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* 上移 */}
                  {index > 0 && (
                    <button
                      onClick={() => moveInQueue(index, index - 1)}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                      title="上移"
                    >
                      <ChevronUp className="w-4 h-4 text-gray-500" />
                    </button>
                  )}
                  {/* 下移 */}
                  {index < queue.length - 1 && (
                    <button
                      onClick={() => moveInQueue(index, index + 1)}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                      title="下移"
                    >
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    </button>
                  )}
                  {/* 移除 */}
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

          {/* 底部操作 */}
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
