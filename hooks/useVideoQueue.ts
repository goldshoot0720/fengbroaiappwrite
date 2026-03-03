"use client";

import { useState, useCallback, useEffect } from 'react';

export interface VideoQueueItem {
  id: string;
  name: string;
  category?: string;
  file: string;
  cover?: string;
}

// 全域播放佇列狀態
let globalVideoQueue: VideoQueueItem[] = [];
let globalVideoCurrentIndex: number = -1;
let globalVideoListeners: Set<() => void> = new Set();

const notifyVideoListeners = () => {
  globalVideoListeners.forEach(listener => listener());
};

// 設置播放結束監聽器
const setupVideoEndedListener = () => {
  if (typeof window === 'undefined') return;
  if ((window as any).__videoQueueEndedSetup) return;
  (window as any).__videoQueueEndedSetup = true;

  document.addEventListener('ended', (e) => {
    const target = e.target as HTMLMediaElement;
    // 檢查是否為視頻佇列面板中的視頻元素
    if (target.tagName === 'VIDEO' && target.closest('.video-queue-panel')) {
      playNextInVideoQueue();
    }
  }, true);
};

// 播放佇列中的下一個影片
const playNextInVideoQueue = () => {
  if (globalVideoQueue.length === 0) return;
  
  globalVideoCurrentIndex++;
  if (globalVideoCurrentIndex >= globalVideoQueue.length) {
    // 佇列播放完畢，重置
    globalVideoCurrentIndex = -1;
    globalVideoQueue = [];
  }
  notifyVideoListeners();
};

export function useVideoQueue() {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const listener = () => forceUpdate({});
    globalVideoListeners.add(listener);
    setupVideoEndedListener();
    
    return () => {
      globalVideoListeners.delete(listener);
    };
  }, []);

  const addToQueue = useCallback((item: VideoQueueItem) => {
    // 檢查是否已在佇列中
    if (globalVideoQueue.some(q => q.id === item.id)) {
      return false;
    }
    const wasEmpty = globalVideoQueue.length === 0;
    globalVideoQueue.push(item);
    
    // 如果佇列原本是空的，自動開始播放第一個
    if (wasEmpty) {
      globalVideoCurrentIndex = 0;
    }
    notifyVideoListeners();
    return true;
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    const index = globalVideoQueue.findIndex(q => q.id === id);
    if (index > -1) {
      globalVideoQueue.splice(index, 1);
      // 調整 currentIndex
      if (index <= globalVideoCurrentIndex) {
        globalVideoCurrentIndex--;
      }
      notifyVideoListeners();
    }
  }, []);

  const clearQueue = useCallback(() => {
    globalVideoQueue = [];
    globalVideoCurrentIndex = -1;
    notifyVideoListeners();
  }, []);

  const moveInQueue = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex < 0 || fromIndex >= globalVideoQueue.length) return;
    if (toIndex < 0 || toIndex >= globalVideoQueue.length) return;
    
    const [item] = globalVideoQueue.splice(fromIndex, 1);
    globalVideoQueue.splice(toIndex, 0, item);
    notifyVideoListeners();
  }, []);

  const playNow = useCallback((item: VideoQueueItem) => {
    // 將影片插入到當前播放位置的下一個
    const insertIndex = globalVideoCurrentIndex + 1;
    globalVideoQueue.splice(insertIndex, 0, item);
    globalVideoCurrentIndex = insertIndex;
    notifyVideoListeners();
  }, []);

  const skipToNext = useCallback(() => {
    playNextInVideoQueue();
  }, []);

  return {
    queue: globalVideoQueue,
    currentIndex: globalVideoCurrentIndex,
    currentItem: globalVideoCurrentIndex >= 0 ? globalVideoQueue[globalVideoCurrentIndex] : null,
    addToQueue,
    removeFromQueue,
    clearQueue,
    moveInQueue,
    playNow,
    skipToNext,
    isInQueue: (id: string) => globalVideoQueue.some(q => q.id === id),
    queueLength: globalVideoQueue.length,
  };
}
