"use client";

import { useState, useEffect, useCallback } from "react";
import { API_ENDPOINTS } from "@/lib/constants";
import { fetchApi } from "@/hooks/useApi";

export interface PodcastData {
  $id: string;
  name: string;
  file: string;
  note: string;
  ref: string;
  category: string;
  hash: string;
  cover: string;
  $createdAt: string;
  $updatedAt: string;
}

// 全域快取
let cachedPodcast: PodcastData[] | null = null;
let cacheTimestamp: number = 0;

export function usePodcast() {
  const [podcast, setPodcast] = useState<PodcastData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getRefreshKey = () => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('podcast_refresh_key') || '';
  };

  const setRefreshKeyValue = () => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('podcast_refresh_key', Date.now().toString());
  };

  // 載入播客資料（使用快取）
  const loadPodcast = useCallback(async (forceRefresh = false) => {
    const storedRefreshKey = getRefreshKey();
    
    if (!forceRefresh && cachedPodcast && (!storedRefreshKey || cacheTimestamp >= parseInt(storedRefreshKey))) {
      setPodcast(cachedPodcast);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const cacheParam = (forceRefresh || storedRefreshKey) ? `?t=${storedRefreshKey || Date.now()}` : '';
      const data = await fetchApi<PodcastData[]>(API_ENDPOINTS.PODCAST + cacheParam);
      // Ensure data is an array
      const podcastList = Array.isArray(data) ? data : [];
      
      cachedPodcast = podcastList;
      cacheTimestamp = Date.now();
      
      setPodcast(podcastList);
    } catch (err) {
      const message = err instanceof Error ? err.message : "載入播客失敗";
      setError(message);
      console.error("載入播客失敗:", err);
      setPodcast([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始載入
  useEffect(() => {
    loadPodcast();
  }, [loadPodcast]);

  // 監聽 refresh key 變化（當其他頁面清除快取時重新載入）
  useEffect(() => {
    const checkRefreshKey = () => {
      const storedRefreshKey = getRefreshKey();
      if (storedRefreshKey && parseInt(storedRefreshKey) > cacheTimestamp) {
        console.log('[usePodcast] 偵測到快取已清除，重新載入資料');
        loadPodcast(true);
      }
    };

    const interval = setInterval(checkRefreshKey, 500);
    return () => clearInterval(interval);
  }, [loadPodcast]);

  // 計算統計資料
  const stats = {
    total: Array.isArray(podcast) ? podcast.length : 0,
  };

  return {
    podcast,
    loading,
    error,
    stats,
    loadPodcast,
    refresh: () => setRefreshKeyValue(),
  };
}
