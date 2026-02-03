"use client";

import { useState, useEffect, useCallback } from "react";
import { API_ENDPOINTS } from "@/lib/constants";
import { fetchApi } from "@/hooks/useApi";

export interface MusicData {
  $id: string;
  name: string;
  file: string;
  lyrics: string;
  note: string;
  ref: string;
  category: string;
  hash: string;
  language: string;
  cover: string;
  $createdAt: string;
  $updatedAt: string;
  computedLyrics?: string; // Lyrics with fallback logic
}

// 全域快取
let cachedMusic: MusicData[] | null = null;
let cacheTimestamp: number = 0;

export function useMusic() {
  const [music, setMusic] = useState<MusicData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getRefreshKey = () => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('music_refresh_key') || '';
  };

  const setRefreshKeyValue = () => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('music_refresh_key', Date.now().toString());
  };

  // 載入音樂資料（使用快取）
  const loadMusic = useCallback(async (forceRefresh = false) => {
    const storedRefreshKey = getRefreshKey();
    
    if (!forceRefresh && cachedMusic && (!storedRefreshKey || cacheTimestamp >= parseInt(storedRefreshKey))) {
      setMusic(cachedMusic);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const cacheParam = (forceRefresh || storedRefreshKey) ? `?t=${storedRefreshKey || Date.now()}` : '';
      const data = await fetchApi<MusicData[]>(API_ENDPOINTS.MUSIC + cacheParam);
      // Ensure data is an array
      const musicList = Array.isArray(data) ? data : [];
      
      cachedMusic = musicList;
      cacheTimestamp = Date.now();
      
      setMusic(musicList);
    } catch (err) {
      const message = err instanceof Error ? err.message : "載入音樂失敗";
      setError(message);
      console.error("載入音樂失敗:", err);
      setMusic([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始載入
  useEffect(() => {
    loadMusic();
  }, [loadMusic]);

  // 監聽 refresh key 變化（當其他頁面清除快取時重新載入）
  useEffect(() => {
    const checkRefreshKey = () => {
      const storedRefreshKey = getRefreshKey();
      if (storedRefreshKey && parseInt(storedRefreshKey) > cacheTimestamp) {
        console.log('[useMusic] 偵測到快取已清除，重新載入資料');
        loadMusic(true);
      }
    };

    const interval = setInterval(checkRefreshKey, 500);
    return () => clearInterval(interval);
  }, [loadMusic]);

  // 計算統計資料
  const stats = {
    total: Array.isArray(music) ? music.length : 0,
  };

  return {
    music,
    loading,
    error,
    stats,
    loadMusic,
    refresh: () => setRefreshKeyValue(),
  };
}
