"use client";

import { useCallback, useEffect, useState } from "react";

export interface PodcastQueueItem {
  id: string;
  name: string;
  category?: string;
  file: string;
  cover?: string;
  mediaType: "audio" | "video";
}

let globalPodcastQueue: PodcastQueueItem[] = [];
let globalPodcastCurrentIndex = -1;
const globalPodcastListeners = new Set<() => void>();

const notifyPodcastListeners = () => {
  globalPodcastListeners.forEach((listener) => listener());
};

export function usePodcastQueue() {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const listener = () => forceUpdate({});
    globalPodcastListeners.add(listener);

    return () => {
      globalPodcastListeners.delete(listener);
    };
  }, []);

  const addToQueue = useCallback((item: PodcastQueueItem) => {
    if (globalPodcastQueue.some((queuedItem) => queuedItem.id === item.id)) {
      return false;
    }

    const wasEmpty = globalPodcastQueue.length === 0;
    globalPodcastQueue.push(item);

    if (wasEmpty) {
      globalPodcastCurrentIndex = 0;
    }

    notifyPodcastListeners();
    return true;
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    const index = globalPodcastQueue.findIndex((queuedItem) => queuedItem.id === id);
    if (index === -1) {
      return;
    }

    globalPodcastQueue.splice(index, 1);

    if (globalPodcastQueue.length === 0) {
      globalPodcastCurrentIndex = -1;
    } else if (index < globalPodcastCurrentIndex) {
      globalPodcastCurrentIndex -= 1;
    } else if (index === globalPodcastCurrentIndex) {
      globalPodcastCurrentIndex = Math.min(index, globalPodcastQueue.length - 1);
    }

    notifyPodcastListeners();
  }, []);

  const clearQueue = useCallback(() => {
    globalPodcastQueue = [];
    globalPodcastCurrentIndex = -1;
    notifyPodcastListeners();
  }, []);

  const moveInQueue = useCallback((fromIndex: number, toIndex: number) => {
    if (
      fromIndex < 0 ||
      fromIndex >= globalPodcastQueue.length ||
      toIndex < 0 ||
      toIndex >= globalPodcastQueue.length ||
      fromIndex === toIndex
    ) {
      return;
    }

    const [item] = globalPodcastQueue.splice(fromIndex, 1);
    globalPodcastQueue.splice(toIndex, 0, item);

    if (globalPodcastCurrentIndex === fromIndex) {
      globalPodcastCurrentIndex = toIndex;
    } else if (fromIndex < globalPodcastCurrentIndex && toIndex >= globalPodcastCurrentIndex) {
      globalPodcastCurrentIndex -= 1;
    } else if (fromIndex > globalPodcastCurrentIndex && toIndex <= globalPodcastCurrentIndex) {
      globalPodcastCurrentIndex += 1;
    }

    notifyPodcastListeners();
  }, []);

  const playNow = useCallback((item: PodcastQueueItem) => {
    const existingIndex = globalPodcastQueue.findIndex((queuedItem) => queuedItem.id === item.id);

    if (existingIndex !== -1) {
      globalPodcastQueue[existingIndex] = item;
      globalPodcastCurrentIndex = existingIndex;
      notifyPodcastListeners();
      return;
    }

    const insertIndex = Math.max(globalPodcastCurrentIndex + 1, 0);
    globalPodcastQueue.splice(insertIndex, 0, item);
    globalPodcastCurrentIndex = insertIndex;
    notifyPodcastListeners();
  }, []);

  const skipToNext = useCallback(() => {
    if (globalPodcastQueue.length === 0) {
      return;
    }

    globalPodcastCurrentIndex += 1;

    if (globalPodcastCurrentIndex >= globalPodcastQueue.length) {
      globalPodcastQueue = [];
      globalPodcastCurrentIndex = -1;
    }

    notifyPodcastListeners();
  }, []);

  return {
    queue: globalPodcastQueue,
    currentIndex: globalPodcastCurrentIndex,
    currentItem:
      globalPodcastCurrentIndex >= 0 ? globalPodcastQueue[globalPodcastCurrentIndex] : null,
    addToQueue,
    removeFromQueue,
    clearQueue,
    moveInQueue,
    playNow,
    skipToNext,
    isInQueue: (id: string) => globalPodcastQueue.some((queuedItem) => queuedItem.id === id),
    queueLength: globalPodcastQueue.length,
  };
}
