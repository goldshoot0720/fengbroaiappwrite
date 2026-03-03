"use client";

import { useState, useEffect, useCallback } from "react";
import { API_ENDPOINTS } from "@/lib/constants";
import { fetchApi } from "@/hooks/useApi";

export interface CommonDocumentData {
  $id: string;
  name: string;
  file: string;
  filetype: string;
  note: string;
  ref: string;
  category: string;
  hash: string;
  cover: string;
  $createdAt: string;
  $updatedAt: string;
}

// 全域快取
let cachedCommonDocument: CommonDocumentData[] | null = null;
let cacheTimestamp: number = 0;

export function useCommonDocument() {
  const [commondocument, setCommonDocument] = useState<CommonDocumentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getRefreshKey = () => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('commondocument_refresh_key') || '';
  };

  const setRefreshKeyValue = () => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('commondocument_refresh_key', Date.now().toString());
  };

  // 載入鋒兄文件資料（使用快取）
  const loadCommonDocument = useCallback(async (forceRefresh = false) => {
    const storedRefreshKey = getRefreshKey();
    
    if (!forceRefresh && cachedCommonDocument && (!storedRefreshKey || cacheTimestamp >= parseInt(storedRefreshKey))) {
      setCommonDocument(cachedCommonDocument);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const cacheParam = (forceRefresh || storedRefreshKey) ? `?t=${storedRefreshKey || Date.now()}` : '';
      const data = await fetchApi<CommonDocumentData[]>(API_ENDPOINTS.COMMONDOCUMENT + cacheParam);
      // Ensure data is an array
      const commondocumentList = Array.isArray(data) ? data : [];
      
      cachedCommonDocument = commondocumentList;
      cacheTimestamp = Date.now();
      
      setCommonDocument(commondocumentList);
    } catch (err) {
      const message = err instanceof Error ? err.message : "載入鋒兄文件失敗";
      setError(message);
      console.error("載入鋒兄文件失敗:", err);
      setCommonDocument([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始載入
  useEffect(() => {
    loadCommonDocument();
  }, [loadCommonDocument]);

  // 監聽 refresh key 變化（當其他頁面清除快取時重新載入）
  useEffect(() => {
    const checkRefreshKey = () => {
      const storedRefreshKey = getRefreshKey();
      if (storedRefreshKey && parseInt(storedRefreshKey) > cacheTimestamp) {
        console.log('[useCommonCommonDocument] 偵測到快取已清除，重新載入資料');
        loadCommonDocument(true);
      }
    };

    const interval = setInterval(checkRefreshKey, 500);
    return () => clearInterval(interval);
  }, [loadCommonDocument]);

  // 計算統計資料
  const stats = {
    total: Array.isArray(commondocument) ? commondocument.length : 0,
  };

  return {
    commondocument,
    loading,
    error,
    stats,
    loadCommonDocument,
    refresh: () => setRefreshKeyValue(),
  };
}
