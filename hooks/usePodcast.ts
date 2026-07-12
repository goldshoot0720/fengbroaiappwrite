"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { API_ENDPOINTS } from "@/lib/constants";
import { fetchApi } from "@/hooks/useApi";
import { bumpRefreshKey, useRefreshKeyListener } from "@/hooks/useRefreshKey";

export interface PodcastData {
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
let cachedPodcast: PodcastData[] | null = null;
let cacheTimestamp: number = 0;

export function usePodcast(enabled = true) {
  const [podcast, setPodcast] = useState<PodcastData[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const getRefreshKey = () => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('podcast_refresh_key') || '';
  };

  const setRefreshKeyValue = () => bumpRefreshKey("podcast_refresh_key");

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
    if (!enabled) {
      setPodcast([]);
      setError(null);
      setLoading(false);
      return;
    }
    loadPodcast();
  }, [enabled, loadPodcast]);

  useRefreshKeyListener(
    "podcast_refresh_key",
    () => {
      loadPodcast(true);
    },
    enabled
  );

  const stats = useMemo(
    () => ({ total: Array.isArray(podcast) ? podcast.length : 0 }),
    [podcast]
  );

  return {
    podcast,
    loading,
    error,
    stats,
    loadPodcast,
    refresh: () => setRefreshKeyValue(),
  };
}
