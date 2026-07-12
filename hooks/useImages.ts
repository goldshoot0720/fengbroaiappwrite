"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { API_ENDPOINTS } from "@/lib/constants";
import { fetchApi } from "@/hooks/useApi";
import { bumpRefreshKey, useRefreshKeyListener } from "@/hooks/useRefreshKey";

export interface ImageData {
  $id: string;
  name: string;
  file: string;
  filetype: string;
  note: string;
  ref: string;
  category: string;
  hash: string;
  cover: boolean;
  size?: number | null;
  $createdAt: string;
  $updatedAt: string;
}

// 全域快取
let cachedImages: ImageData[] | null = null;
let cacheTimestamp: number = 0;

export function useImages(enabled = true) {
  const [images, setImages] = useState<ImageData[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const getRefreshKey = () => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('images_refresh_key') || '';
  };

  const setRefreshKeyValue = () => bumpRefreshKey("images_refresh_key");

  // 載入圖片資料（使用快取）
  const loadImages = useCallback(async (forceRefresh = false) => {
    const storedRefreshKey = getRefreshKey();
    
    if (!forceRefresh && cachedImages && (!storedRefreshKey || cacheTimestamp >= parseInt(storedRefreshKey))) {
      setImages(cachedImages);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const cacheParam = (forceRefresh || storedRefreshKey) ? `?t=${storedRefreshKey || Date.now()}` : '';
      const data = await fetchApi<ImageData[]>(API_ENDPOINTS.IMAGE + cacheParam);
      // Ensure data is an array
      const imageList = Array.isArray(data) ? data : [];
      
      cachedImages = imageList;
      cacheTimestamp = Date.now();
      
      setImages(imageList);
    } catch (err) {
      const message = err instanceof Error ? err.message : "載入圖片失敗";
      setError(message);
      console.error("載入圖片失敗:", err);
      setImages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始載入
  useEffect(() => {
    if (!enabled) {
      setImages([]);
      setError(null);
      setLoading(false);
      return;
    }
    loadImages();
  }, [enabled, loadImages]);

  useRefreshKeyListener(
    "images_refresh_key",
    () => {
      loadImages(true);
    },
    enabled
  );

  const stats = useMemo(
    () => ({ total: Array.isArray(images) ? images.length : 0 }),
    [images]
  );

  return {
    images,
    loading,
    error,
    stats,
    loadImages,
    refresh: () => setRefreshKeyValue(),
  };
}
