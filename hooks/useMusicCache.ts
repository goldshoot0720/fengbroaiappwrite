"use client";

import { useState, useEffect, useCallback } from "react";

interface MusicItem {
  $id: string;
  name: string;
  file: string;
  lyrics?: string;
  note?: string;
  ref?: string;
  category?: string;
  hash?: string;
  language?: string;
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
  totalMusic: number;
  cachedMusic: number;
  downloadingMusic: number;
}

const MAX_CACHE_SIZE = 500 * 1024 * 1024; // 500MB 限制
const DB_NAME = "MusicCache";
const DB_VERSION = 1;
const STORE_NAME = "music";

export function useMusicCache() {
  const [cacheStatus, setCacheStatus] = useState<CacheStatus>({});
  const [cacheStats, setCacheStats] = useState<CacheStats>({
    totalSize: 0,
    totalMusic: 0,
    cachedMusic: 0,
    downloadingMusic: 0
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

  // 檢查音樂是否已快取
  const checkMusicCache = async (musicId: string): Promise<boolean> => {
    try {
      const db = await initDB();
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve) => {
        const getRequest = store.get(musicId);
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
          const musicList = getAllRequest.result;
          const totalSize = musicList.reduce((sum, music) => sum + (music.size || 0), 0);

          resolve({
            totalSize,
            totalMusic: musicList.length,
            cachedMusic: musicList.length,
            downloadingMusic: Object.values(cacheStatus).filter(s => s.downloading).length
          });
        };
        getAllRequest.onerror = () => resolve({
          totalSize: 0,
          totalMusic: 0,
          cachedMusic: 0,
          downloadingMusic: 0
        });
      });
    } catch {
      return {
        totalSize: 0,
        totalMusic: 0,
        cachedMusic: 0,
        downloadingMusic: 0
      };
    }
  };

  // 檢測音頻 MIME 類型
  const detectAudioMimeType = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      'mp3': 'audio/mpeg',
      'm4a': 'audio/mp4',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
      'flac': 'audio/flac',
      'aac': 'audio/aac',
      'weba': 'audio/webm'
    };
    return mimeTypes[ext || ''] || 'audio/mpeg';
  };

  // 下載並快取音樂
  const downloadAndCacheMusic = async (
    music: MusicItem,
    onProgress?: (progress: number) => void
  ): Promise<void> => {
    setCacheStatus(prev => ({
      ...prev,
      [music.$id]: {
        ...prev[music.$id],
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

      // 使用 music.file 作為音頻 URL
      const musicUrl = music.file;

      const response = await fetch(musicUrl, {
        mode: 'cors',
        headers: {
          'Accept': 'audio/*'
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
            [music.$id]: {
              ...prev[music.$id],
              progress
            }
          }));

          onProgress?.(progress);
        }
      }

      // 檢測 MIME 類型
      const mimeType = detectAudioMimeType(music.file);
      const blob = new Blob(chunks as BlobPart[], { type: mimeType });
      const actualSize = blob.size;
      await saveMusicToCache(music.$id, blob, music, actualSize);

      setCacheStatus(prev => ({
        ...prev,
        [music.$id]: {
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
      console.error('下載音樂失敗:', error);
      setCacheStatus(prev => ({
        ...prev,
        [music.$id]: {
          cached: false,
          downloading: false,
          progress: 0,
          error: error instanceof Error ? error.message : "下載失敗"
        }
      }));
    }
  };

  // 保存音樂到快取
  const saveMusicToCache = async (
    musicId: string,
    blob: Blob,
    musicInfo: MusicItem,
    size: number
  ): Promise<void> => {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    const musicData = {
      id: musicId,
      blob: blob,
      info: musicInfo,
      size: size,
      cachedAt: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
      const putRequest = store.put(musicData);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(new Error("存儲失敗"));
    });
  };

  // 從快取載入音樂
  const loadMusicFromCache = async (musicId: string): Promise<string | null> => {
    try {
      const db = await initDB();
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve) => {
        const getRequest = store.get(musicId);

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
          const musicList = getAllRequest.result.sort((a, b) =>
            new Date(a.cachedAt).getTime() - new Date(b.cachedAt).getTime()
          );

          // 刪除最舊的音樂直到大小符合限制
          let currentSize = musicList.reduce((sum, music) => sum + (music.size || 0), 0);
          let deleteCount = 0;

          while (currentSize > MAX_CACHE_SIZE * 0.8 && deleteCount < musicList.length) {
            const musicToDelete = musicList[deleteCount];
            store.delete(musicToDelete.id);
            currentSize -= musicToDelete.size || 0;
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

  // 刪除特定音樂快取
  const deleteMusicCache = async (musicId: string): Promise<void> => {
    try {
      const db = await initDB();
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const deleteRequest = store.delete(musicId);
        deleteRequest.onsuccess = () => {
          setCacheStatus(prev => ({
            ...prev,
            [musicId]: {
              ...prev[musicId],
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
    checkMusicCache,
    downloadAndCacheMusic,
    loadMusicFromCache,
    deleteMusicCache,
    clearAllCache,
    updateCacheStats,
    formatFileSize,
    maxCacheSize: MAX_CACHE_SIZE
  };
}
