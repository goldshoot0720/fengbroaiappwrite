"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { API_ENDPOINTS } from "@/lib/constants";
import { fetchApi } from "@/hooks/useApi";
import { bumpRefreshKey, useRefreshKeyListener } from "@/hooks/useRefreshKey";
import { readEndpointCache, writeEndpointCache } from "@/lib/requestCache";

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

  const setRefreshKeyValue = () => bumpRefreshKey("commondocument_refresh_key");

  // 載入鋒兄文件資料（使用快取）
  const loadCommonDocument = useCallback(async (forceRefresh = false) => {
    const storedRefreshKey = getRefreshKey();
    
    if (!forceRefresh && cachedCommonDocument && (!storedRefreshKey || cacheTimestamp >= parseInt(storedRefreshKey))) {
      setCommonDocument(cachedCommonDocument);
      setLoading(false);
      return;
    }

    // 重新整理後先畫出上次存下的結果，再讓下面的請求在背景更新。
    const persisted = forceRefresh ? null : readEndpointCache<CommonDocumentData[]>(API_ENDPOINTS.COMMONDOCUMENT);
    if (persisted && persisted.length) {
      setCommonDocument(persisted);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const cacheParam = (forceRefresh || storedRefreshKey) ? `?t=${storedRefreshKey || Date.now()}` : '';
      const data = await fetchApi<CommonDocumentData[]>(API_ENDPOINTS.COMMONDOCUMENT + cacheParam);
      // Ensure data is an array
      const commondocumentList = Array.isArray(data) ? data : [];
      
      cachedCommonDocument = commondocumentList;
      cacheTimestamp = Date.now();
      writeEndpointCache(API_ENDPOINTS.COMMONDOCUMENT, commondocumentList);
      
      setCommonDocument(commondocumentList);
    } catch (err) {
      const message = err instanceof Error ? err.message : "載入鋒兄文件失敗";
      setError(message);
      console.error("載入鋒兄文件失敗:", err);
      // 已經用上次的快取上畫時，暫時的讀取失敗不要把畫面清空。
      if (!persisted) setCommonDocument([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始載入
  useEffect(() => {
    loadCommonDocument();
  }, [loadCommonDocument]);

  useRefreshKeyListener("commondocument_refresh_key", () => {
    loadCommonDocument(true);
  });

  const stats = useMemo(
    () => ({ total: Array.isArray(commondocument) ? commondocument.length : 0 }),
    [commondocument]
  );

  return {
    commondocument,
    loading,
    error,
    stats,
    loadCommonDocument,
    refresh: () => setRefreshKeyValue(),
  };
}
