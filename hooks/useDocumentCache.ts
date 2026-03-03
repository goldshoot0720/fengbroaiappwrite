"use client";

import { useState, useCallback } from "react";

interface DocumentItem {
  $id: string;
  name: string;
  file: string;
  note?: string;
  ref?: string;
  category?: string;
  hash?: string;
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
  totalDocuments: number;
  cachedDocuments: number;
  downloadingDocuments: number;
}

const MAX_CACHE_SIZE = 500 * 1024 * 1024; // 500MB 限制
const DB_NAME = "DocumentCache";
const DB_VERSION = 1;
const STORE_NAME = "documents";

export function useDocumentCache() {
  const [cacheStatus, setCacheStatus] = useState<CacheStatus>({});
  const [cacheStats, setCacheStats] = useState<CacheStats>({
    totalSize: 0,
    totalDocuments: 0,
    cachedDocuments: 0,
    downloadingDocuments: 0
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

  // 檢查文件是否已快取
  const checkDocumentCache = async (documentId: string): Promise<boolean> => {
    try {
      const db = await initDB();
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve) => {
        const getRequest = store.get(documentId);
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
          const documents = getAllRequest.result;
          const totalSize = documents.reduce((sum, doc) => sum + (doc.size || 0), 0);

          resolve({
            totalSize,
            totalDocuments: documents.length,
            cachedDocuments: documents.length,
            downloadingDocuments: Object.values(cacheStatus).filter(s => s.downloading).length
          });
        };
        getAllRequest.onerror = () => resolve({
          totalSize: 0,
          totalDocuments: 0,
          cachedDocuments: 0,
          downloadingDocuments: 0
        });
      });
    } catch {
      return {
        totalSize: 0,
        totalDocuments: 0,
        cachedDocuments: 0,
        downloadingDocuments: 0
      };
    }
  };

  // 檢測文件 MIME 類型
  const detectDocumentMimeType = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'txt': 'text/plain',
      'md': 'text/markdown',
      'json': 'application/json',
      'xml': 'application/xml',
      'html': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'ts': 'application/typescript',
      'zip': 'application/zip',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml'
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  };

  // 下載並快取文件
  const downloadAndCacheDocument = async (
    document: DocumentItem,
    onProgress?: (progress: number) => void
  ): Promise<void> => {
    setCacheStatus(prev => ({
      ...prev,
      [document.$id]: {
        ...prev[document.$id],
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

      // 使用 document.file 作為文件 URL
      const documentUrl = document.file;

      const response = await fetch(documentUrl, {
        mode: 'cors',
        headers: {
          'Accept': '*/*'
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
            [document.$id]: {
              ...prev[document.$id],
              progress
            }
          }));

          onProgress?.(progress);
        }
      }

      // 檢測 MIME 類型
      const mimeType = detectDocumentMimeType(document.file);
      const blob = new Blob(chunks as BlobPart[], { type: mimeType });
      const actualSize = blob.size;
      await saveDocumentToCache(document.$id, blob, document, actualSize);

      setCacheStatus(prev => ({
        ...prev,
        [document.$id]: {
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
      console.error('下載文件失敗:', error);
      setCacheStatus(prev => ({
        ...prev,
        [document.$id]: {
          cached: false,
          downloading: false,
          progress: 0,
          error: error instanceof Error ? error.message : "下載失敗"
        }
      }));
    }
  };

  // 保存文件到快取
  const saveDocumentToCache = async (
    documentId: string,
    blob: Blob,
    documentInfo: DocumentItem,
    size: number
  ): Promise<void> => {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    const documentData = {
      id: documentId,
      blob: blob,
      info: documentInfo,
      size: size,
      cachedAt: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
      const putRequest = store.put(documentData);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(new Error("存儲失敗"));
    });
  };

  // 從快取載入文件
  const loadDocumentFromCache = async (documentId: string): Promise<string | null> => {
    try {
      const db = await initDB();
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve) => {
        const getRequest = store.get(documentId);

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
          const documents = getAllRequest.result.sort((a, b) =>
            new Date(a.cachedAt).getTime() - new Date(b.cachedAt).getTime()
          );

          // 刪除最舊的文件直到大小符合限制
          let currentSize = documents.reduce((sum, doc) => sum + (doc.size || 0), 0);
          let deleteCount = 0;

          while (currentSize > MAX_CACHE_SIZE * 0.8 && deleteCount < documents.length) {
            const documentToDelete = documents[deleteCount];
            store.delete(documentToDelete.id);
            currentSize -= documentToDelete.size || 0;
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

  // 刪除特定文件快取
  const deleteDocumentCache = async (documentId: string): Promise<void> => {
    try {
      const db = await initDB();
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const deleteRequest = store.delete(documentId);
        deleteRequest.onsuccess = () => {
          setCacheStatus(prev => ({
            ...prev,
            [documentId]: {
              ...prev[documentId],
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
    checkDocumentCache,
    downloadAndCacheDocument,
    loadDocumentFromCache,
    deleteDocumentCache,
    clearAllCache,
    updateCacheStats,
    formatFileSize,
    maxCacheSize: MAX_CACHE_SIZE
  };
}
