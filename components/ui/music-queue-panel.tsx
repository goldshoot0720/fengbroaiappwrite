"use client";

import { useState, useEffect, useRef } from 'react';
import { Music, X, ListMusic, Trash2, Play, Pause, ChevronUp, ChevronDown, SkipForward } from 'lucide-react';
import { useMusicQueue, QueueItem } from '@/hooks/useMusicQueue';
import { useMusicCache } from '@/hooks/useMusicCache';
import { Button } from '@/components/ui/button';

interface MusicQueuePanelProps {
  onPlayFromQueue?: (item: QueueItem) => void;
}

export function MusicQueuePanel({ onPlayFromQueue }: MusicQueuePanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
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
  } = useMusicQueue();

  // 音樂快取
  const { loadMusicFromCache } = useMusicCache();

  // 當 currentItem 變化時自動播放（唯一的播放觸發點）
  useEffect(() => {
    const loadAndPlayMusic = async () => {
      if (currentItem && currentItem.file && audioRef.current) {
        // 只有當歌曲變化時才播放（避免重複播放）
        if (lastPlayedIdRef.current !== currentItem.id) {
          console.log('播放:', currentItem.name);
          lastPlayedIdRef.current = currentItem.id;

          // 先暫停並重置，避免衝突
          audioRef.current.pause();
          audioRef.current.currentTime = 0;

          // 檢查是否有快取的音樂
          const cachedUrl = await loadMusicFromCache(currentItem.id);
          audioRef.current.src = cachedUrl || currentItem.file;

          if (cachedUrl) {
            console.log('從快取播放:', currentItem.name);
          } else {
            console.log('從伺服器串流播放:', currentItem.name);
          }

          // 等待 src 載入後再播放
          audioRef.current.load();
          const playPromise = audioRef.current.play();
          if (playPromise !== undefined) {
            playPromise.then(() => {
              console.log('播放成功:', currentItem.name);
            }).catch((err) => {
              console.error('播放失敗:', err.name, err.message);
            });
          }
          setIsExpanded(true);
        }
      }
    };

    loadAndPlayMusic();
  }, [currentItem, loadMusicFromCache]);

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(console.error);
    }
  };

  const formatTime = (time: number) => {
    if (!isFinite(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const newTime = parseFloat(e.target.value);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // 如果佇列為空，只顯示隱藏的 audio 元素（以便等待新增歌曲）
  if (queueLength === 0) {
    return (
      <audio 
        ref={audioRef} 
        className="hidden"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={(e) => setCurrentTime((e.target as HTMLAudioElement).currentTime)}
        onDurationChange={(e) => setDuration((e.target as HTMLAudioElement).duration)}
        onEnded={() => setIsPlaying(false)}
      />
    );
  }

  return (
    <div className="fixed top-20 right-4 z-50">
      {/* 音頻元素 */}
      <audio 
        ref={audioRef} 
        preload="auto"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={(e) => setCurrentTime((e.target as HTMLAudioElement).currentTime)}
        onDurationChange={(e) => setDuration((e.target as HTMLAudioElement).duration)}
        onEnded={() => setIsPlaying(false)}
        onError={(e) => console.error('音頻加載錯誤:', e)}
      />

      {/* 收合的按鈕（帶 mini 播放器） */}
      {!isExpanded && (
        <div className="flex flex-col gap-2">
          {/* 如果有正在播放的歌曲，顯示 mini 播放器 */}
          {currentItem && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-3 w-96">
              <div className="flex items-center gap-3">
                {/* 封面 */}
                <div className="w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-purple-600 to-pink-600">
                  {currentItem.cover ? (
                    <img src={currentItem.cover} alt={currentItem.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music className="w-6 h-6 text-white" />
                    </div>
                  )}
                </div>
                
                {/* 資訊 */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                    {currentItem.name}
                  </div>
                  {currentItem.language && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {currentItem.language}
                    </div>
                  )}
                </div>

                {/* 播放/暫停 */}
                <button
                  onClick={togglePlayPause}
                  className="p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-full transition-colors"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>

                {/* 下一首 */}
                {currentIndex < queue.length - 1 && (
                  <button
                    onClick={skipToNext}
                    className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 rounded-full transition-colors"
                    title="下一首"
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
                  className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
                <span className="text-xs text-gray-500 w-10 text-right">{formatTime(duration)}</span>
              </div>
            </div>
          )}
          
          {/* 佇列按鈕 */}
          <button
            onClick={() => setIsExpanded(true)}
            className="flex items-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-lg transition-all self-end"
          >
            <ListMusic className="w-5 h-5" />
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
          <div className="flex items-center justify-between p-4 bg-purple-600 text-white">
            <div className="flex items-center gap-2">
              <ListMusic className="w-5 h-5" />
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

          {/* 當前播放的歌曲 - Mini Player */}
          {currentItem && (
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                {/* 封面 */}
                <div className="w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-purple-600 to-pink-600 shadow-md">
                  {currentItem.cover ? (
                    <img src={currentItem.cover} alt={currentItem.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music className="w-7 h-7 text-white" />
                    </div>
                  )}
                </div>
                
                {/* 資訊和控制 */}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-gray-900 dark:text-gray-100 truncate">
                    {currentItem.name}
                  </div>
                  {currentItem.language && (
                    <div className="text-xs text-purple-600 dark:text-purple-400">
                      {currentItem.language}
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
                      className="flex-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-600"
                    />
                    <span className="text-[10px] text-gray-500">{formatTime(duration)}</span>
                  </div>
                </div>

                {/* 播放控制 */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={togglePlayPause}
                    className="p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-full transition-colors"
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </button>
                  {currentIndex < queue.length - 1 && (
                    <button
                      onClick={skipToNext}
                      className="p-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 rounded-full transition-colors"
                      title="下一首"
                    >
                      <SkipForward className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 佇列列表 */}
          <div className="max-h-80 overflow-y-auto">
            {queue.map((item, index) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 p-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0 ${
                  index === currentIndex 
                    ? 'bg-purple-50 dark:bg-purple-900/20' 
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                {/* 序號/播放中指示 */}
                <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                  {index === currentIndex ? (
                    <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse" />
                  ) : (
                    <span className="text-xs text-gray-400">{index + 1}</span>
                  )}
                </div>

                {/* 封面 */}
                <div className="w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-purple-600 to-pink-600">
                  {item.cover ? (
                    <img src={item.cover} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music className="w-5 h-5 text-white" />
                    </div>
                  )}
                </div>

                {/* 資訊 */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                    {item.name}
                  </div>
                  {item.language && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {item.language}
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
                className="w-full flex items-center justify-center gap-2 py-2 bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-900/50 text-purple-600 dark:text-purple-400 rounded-lg transition-colors"
              >
                <SkipForward className="w-4 h-4" />
                <span className="text-sm font-medium">跳到下一首</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
