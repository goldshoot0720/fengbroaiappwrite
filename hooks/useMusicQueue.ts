"use client";

import { useState, useCallback, useEffect } from 'react';

export interface QueueItem {
  id: string;
  name: string;
  language?: string;
  file: string;
  cover?: string;
}

// 全域播放佇列狀態
let globalQueue: QueueItem[] = [];
let globalCurrentIndex: number = -1;
let globalListeners: Set<() => void> = new Set();

const notifyListeners = () => {
  globalListeners.forEach(listener => listener());
};

// 設置播放結束監聽器
const setupEndedListener = () => {
  if (typeof window === 'undefined') return;
  if ((window as any).__musicQueueEndedSetup) return;
  (window as any).__musicQueueEndedSetup = true;

  document.addEventListener('ended', (e) => {
    const target = e.target as HTMLMediaElement;
    if (target.tagName === 'AUDIO') {
      // 當音樂播放結束時，播放下一首
      playNextInQueue();
    }
  }, true);
};

// 播放佇列中的下一首
const playNextInQueue = () => {
  if (globalQueue.length === 0) return;
  
  globalCurrentIndex++;
  if (globalCurrentIndex >= globalQueue.length) {
    // 佇列播放完畢，重置
    globalCurrentIndex = -1;
    globalQueue = [];
  }
  notifyListeners();
};

export function useMusicQueue() {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const listener = () => forceUpdate({});
    globalListeners.add(listener);
    setupEndedListener();
    
    return () => {
      globalListeners.delete(listener);
    };
  }, []);

  const addToQueue = useCallback((item: QueueItem) => {
    // 檢查是否已在佇列中
    if (globalQueue.some(q => q.id === item.id)) {
      return false;
    }
    const wasEmpty = globalQueue.length === 0;
    globalQueue.push(item);
    
    // 如果佇列原本是空的，自動開始播放第一首
    if (wasEmpty) {
      globalCurrentIndex = 0;
    }
    notifyListeners();
    return true;
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    const index = globalQueue.findIndex(q => q.id === id);
    if (index > -1) {
      globalQueue.splice(index, 1);
      // 調整 currentIndex
      if (index <= globalCurrentIndex) {
        globalCurrentIndex--;
      }
      notifyListeners();
    }
  }, []);

  const clearQueue = useCallback(() => {
    globalQueue = [];
    globalCurrentIndex = -1;
    notifyListeners();
  }, []);

  const moveInQueue = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex < 0 || fromIndex >= globalQueue.length) return;
    if (toIndex < 0 || toIndex >= globalQueue.length) return;
    
    const [item] = globalQueue.splice(fromIndex, 1);
    globalQueue.splice(toIndex, 0, item);
    notifyListeners();
  }, []);

  const playNow = useCallback((item: QueueItem) => {
    // 將歌曲插入到當前播放位置的下一個
    const insertIndex = globalCurrentIndex + 1;
    globalQueue.splice(insertIndex, 0, item);
    globalCurrentIndex = insertIndex;
    notifyListeners();
  }, []);

  const skipToNext = useCallback(() => {
    playNextInQueue();
  }, []);

  return {
    queue: globalQueue,
    currentIndex: globalCurrentIndex,
    currentItem: globalCurrentIndex >= 0 ? globalQueue[globalCurrentIndex] : null,
    addToQueue,
    removeFromQueue,
    clearQueue,
    moveInQueue,
    playNow,
    skipToNext,
    isInQueue: (id: string) => globalQueue.some(q => q.id === id),
    queueLength: globalQueue.length,
  };
}
