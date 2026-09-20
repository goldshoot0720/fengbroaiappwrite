"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { API_ENDPOINTS } from "@/lib/constants";
import { fetchApi } from "@/hooks/useApi";
import { bumpRefreshKey, useRefreshKeyListener } from "@/hooks/useRefreshKey";
import { readEndpointCache, writeEndpointCache } from "@/lib/requestCache";

export interface MusicData {
  $id: string;
  name: string;
  file: string;
  filetype: string;
  lyrics: string;
  note: string;
  ref: string;
  category: string;
  hash: string;
  language: string;
  cover: string;
  fileSize?: number | null;
  $createdAt: string;
  $updatedAt: string;
  computedLyrics?: string; // Lyrics with fallback logic
}

// 全域快取
let cachedMusic: MusicData[] | null = null;
let cacheTimestamp: number = 0;

export function useMusic(enabled = true) {
  const [music, setMusic] = useState<MusicData[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const getRefreshKey = () => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('music_refresh_key') || '';
  };

  const setRefreshKeyValue = () => bumpRefreshKey("music_refresh_key");

  // 載入音樂資料（使用快取）
  const loadMusic = useCallback(async (forceRefresh = false) => {
    const storedRefreshKey = getRefreshKey();
    
    if (!forceRefresh && cachedMusic && (!storedRefreshKey || cacheTimestamp >= parseInt(storedRefreshKey))) {
      setMusic(cachedMusic);
      setLoading(false);
      return;
    }

    // 重新整理後先畫出上次存下的結果，再讓下面的請求在背景更新。
    const persisted = forceRefresh ? null : readEndpointCache<MusicData[]>(API_ENDPOINTS.MUSIC);
    if (persisted && persisted.length) {
      setMusic(persisted);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const cacheParam = (forceRefresh || storedRefreshKey) ? `?t=${storedRefreshKey || Date.now()}` : '';
      const data = await fetchApi<MusicData[]>(API_ENDPOINTS.MUSIC + cacheParam);
      // Ensure data is an array
      const musicList = Array.isArray(data) ? data : [];
      
      cachedMusic = musicList;
      cacheTimestamp = Date.now();
      writeEndpointCache(API_ENDPOINTS.MUSIC, musicList);
      
      setMusic(musicList);
    } catch (err) {
      const message = err instanceof Error ? err.message : "載入音樂失敗";
      setError(message);
      console.error("載入音樂失敗:", err);
      // 已經用上次的快取上畫時，暫時的讀取失敗不要把畫面清空。
      if (!persisted) setMusic([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始載入
  useEffect(() => {
    if (!enabled) {
      setMusic([]);
      setError(null);
      setLoading(false);
      return;
    }
    loadMusic();
  }, [enabled, loadMusic]);

  useRefreshKeyListener(
    "music_refresh_key",
    () => {
      loadMusic(true);
    },
    enabled
  );

  const stats = useMemo(
    () => ({ total: Array.isArray(music) ? music.length : 0 }),
    [music]
  );

  return {
    music,
    loading,
    error,
    stats,
    loadMusic,
    refresh: () => setRefreshKeyValue(),
  };
}
