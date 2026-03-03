"use client";

import { useState, useEffect, useCallback } from "react";

interface VideoItem {
  id: string;
  title: string;
  description: string;
  filename: string;
  url?: string;
  duration?: string;
  thumbnail?: string;
  cover?: string;
}

interface CacheStatus {
  [key: string]: {
    cached: boolean;
    downloading: boolean;
    progress: number;
    error?: string;
    size?: number;
    cachedAt?: string;
  };
}

interface CacheStats {
  totalSize: number;
  totalVideos: number;
  cachedVideos: number;
  downloadingVideos: number;
}

const MAX_CACHE_SIZE = 500 * 1024 * 1024; // 500MB 限制
const DB_NAME = "VideoCache";
const DB_VERSION = 1;
const STORE_NAME = "videos";

export function useVideoCache() {
  const [cacheStatus, setCacheStatus] = useState<CacheStatus>({});
  const [cacheStats, setCacheStats] = useState<CacheStats>({
    totalSize: 0,
    totalVideos: 0,
    cachedVideos: 0,
    downloadingVideos: 0
  });

  // 初始化數據庫
  const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => reject(new Error("無法打開數據庫"));
      
      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("cachedAt", "cachedAt", { unique: false });
          store.createIndex("size", "size", { unique: false });
        }
      };
    });
  };

  // 檢查影片是否已快取
  const checkVideoCache = async (videoId: string): Promise<boolean> => {
    try {
      const db = await initDB();
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      
      return new Promise((resolve) => {
        const getRequest = store.get(videoId);
        getRequest.onsuccess = () => resolve(!!getRequest.result);
        getRequest.onerror = () => resolve(false);
      });
    } catch {
      return false;
    }
  };

  // 獲取快取統計
  const getCacheStats = async (): Promise<CacheStats> => {
    try {
      const db = await initDB();
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      
      return new Promise((resolve) => {
        const getAllRequest = store.getAll();
        getAllRequest.onsuccess = () => {
          const videos = getAllRequest.result;
          const totalSize = videos.reduce((sum, video) => sum + (video.size || 0), 0);
          
          resolve({
            totalSize,
            totalVideos: videos.length,
            cachedVideos: videos.length,
            downloadingVideos: Object.values(cacheStatus).filter(s => s.downloading).length
          });
        };
        getAllRequest.onerror = () => resolve({
          totalSize: 0,
          totalVideos: 0,
          cachedVideos: 0,
          downloadingVideos: 0
        });
      });
    } catch {
      return {
        totalSize: 0,
        totalVideos: 0,
        cachedVideos: 0,
        downloadingVideos: 0
      };
    }
  };

  // 下載並快取影片
  const downloadAndCacheVideo = async (
    video: VideoItem,
    onProgress?: (progress: number) => void
  ): Promise<void> => {
    setCacheStatus(prev => ({
      ...prev,
      [video.id]: {
        ...prev[video.id],
        downloading: true,
        progress: 0,
        error: undefined
      }
    }));

    try {
      // 檢查快取大小限制
      const stats = await getCacheStats();
      if (stats.totalSize > MAX_CACHE_SIZE) {
        await cleanOldCache();
      }

      const videoUrl = video.url || `/videos/${video.filename}`;
      
      const response = await fetch(videoUrl, {
        mode: 'cors',
        headers: {
          'Accept': 'video/*'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      let loaded = 0;

      const reader = response.body?.getReader();
      const chunks: Uint8Array[] = [];

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          chunks.push(value);
          loaded += value.length;
          
          const progress = total > 0 ? (loaded / total) * 100 : 0;
          
          setCacheStatus(prev => ({
            ...prev,
            [video.id]: {
              ...prev[video.id],
              progress
            }
          }));
          
          onProgress?.(progress);
        }
      }

      const blob = new Blob(chunks as BlobPart[], { type: 'video/mp4' });
      const actualSize = blob.size; // Use actual blob size
      await saveVideoToCache(video.id, blob, video, actualSize);

      setCacheStatus(prev => ({
        ...prev,
        [video.id]: {
          cached: true,
          downloading: false,
          progress: 100,
          size: actualSize,
          cachedAt: new Date().toISOString()
        }
      }));

      // 更新統計
      updateCacheStats();

    } catch (error) {
      console.error('下載影片失敗:', error);
      setCacheStatus(prev => ({
        ...prev,
        [video.id]: {
          cached: false,
          downloading: false,
          progress: 0,
          error: error instanceof Error ? error.message : "下載失敗"
        }
      }));
    }
  };

  // 保存影片到快取
  const saveVideoToCache = async (
    videoId: string, 
    blob: Blob, 
    videoInfo: VideoItem,
    size: number
  ): Promise<void> => {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    
    const videoData = {
      id: videoId,
      blob: blob,
      info: videoInfo,
      size: size,
      cachedAt: new Date().toISOString()
    };
    
    return new Promise((resolve, reject) => {
      const putRequest = store.put(videoData);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(new Error("存儲失敗"));
    });
  };

  // 從快取載入影片
  const loadVideoFromCache = async (videoId: string): Promise<string | null> => {
    try {
      const db = await initDB();
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      
      return new Promise((resolve) => {
        const getRequest = store.get(videoId);
        
        getRequest.onsuccess = () => {
          if (getRequest.result) {
            const blob = getRequest.result.blob;
            const url = URL.createObjectURL(blob);
            resolve(url);
          } else {
            resolve(null);
          }
        };
        
        getRequest.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  };

  // 清理舊快取
  const cleanOldCache = async (): Promise<void> => {
    try {
      const db = await initDB();
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index("cachedAt");
      
      // 獲取所有快取，按時間排序
      const getAllRequest = index.getAll();
      
      return new Promise((resolve) => {
        getAllRequest.onsuccess = () => {
          const videos = getAllRequest.result.sort((a, b) => 
            new Date(a.cachedAt).getTime() - new Date(b.cachedAt).getTime()
          );
          
          // 刪除最舊的影片直到大小符合限制
          let currentSize = videos.reduce((sum, video) => sum + (video.size || 0), 0);
          let deleteCount = 0;
          
          while (currentSize > MAX_CACHE_SIZE * 0.8 && deleteCount < videos.length) {
            const videoToDelete = videos[deleteCount];
            store.delete(videoToDelete.id);
            currentSize -= videoToDelete.size || 0;
            deleteCount++;
          }
          
          resolve();
        };
        
        getAllRequest.onerror = () => resolve();
      });
    } catch (error) {
      console.error('清理快取失敗:', error);
    }
  };

  // 刪除特定影片快取
  const deleteVideoCache = async (videoId: string): Promise<void> => {
    try {
      const db = await initDB();
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      
      return new Promise((resolve, reject) => {
        const deleteRequest = store.delete(videoId);
        deleteRequest.onsuccess = () => {
          setCacheStatus(prev => ({
            ...prev,
            [videoId]: {
              ...prev[videoId],
              cached: false
            }
          }));
          updateCacheStats();
          resolve();
        };
        deleteRequest.onerror = () => reject(new Error("刪除失敗"));
      });
    } catch (error) {
      throw new Error("刪除快取失敗");
    }
  };

  // 清空所有快取
  const clearAllCache = async (): Promise<void> => {
    try {
      const db = await initDB();
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      
      return new Promise((resolve, reject) => {
        const clearRequest = store.clear();
        clearRequest.onsuccess = () => {
          setCacheStatus({});
          updateCacheStats();
          resolve();
        };
        clearRequest.onerror = () => reject(new Error("清空失敗"));
      });
    } catch (error) {
      throw new Error("清空快取失敗");
    }
  };

  // 更新快取統計
  const updateCacheStats = useCallback(async () => {
    const stats = await getCacheStats();
    setCacheStats(stats);
  }, []);

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return {
    cacheStatus,
    cacheStats,
    checkVideoCache,
    downloadAndCacheVideo,
    loadVideoFromCache,
    deleteVideoCache,
    clearAllCache,
    updateCacheStats,
    formatFileSize,
    maxCacheSize: MAX_CACHE_SIZE
  };
}