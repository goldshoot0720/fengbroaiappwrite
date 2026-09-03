"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppwriteSetup } from "@/hooks/useAppwriteSetup";
import { useRefreshKeyListener } from "@/hooks/useRefreshKey";
import { readSessionCache, writeSessionCache } from "@/lib/sessionDataCache";

export interface MediaStats {
  totalImages: number;
  totalVideos: number;
  totalMusic: number;
  totalDocuments: number;
  totalPodcasts: number;
  storageImagesCount: number;
  storageVideosCount: number;
  storageMusicCount: number;
  imagesSize: number;
  videosSize: number;
  musicSize: number;
  documentsSize: number;
  otherSize: number;
  totalSize: number;
  totalFiles: number;
  storageLimit: number;
  usagePercentage: number;
}

type AppwriteConfig = {
  endpoint: string;
  projectId: string;
  databaseId: string;
  bucketId: string;
  apiKey: string;
};

type StorageCategoryStats = {
  count: number;
  size: number;
};

type MediaRecordKey = "images" | "videos" | "music" | "documents" | "podcasts";
type MediaRecordCounts = Partial<Record<MediaRecordKey, number>>;

type StorageStatsResponse = {
  error?: string;
  stats?: {
    totalFiles?: number;
    totalSize?: number;
    storageLimit?: number;
    usagePercentage?: number;
    images?: StorageCategoryStats;
    videos?: StorageCategoryStats;
    music?: StorageCategoryStats;
    documents?: StorageCategoryStats;
    other?: StorageCategoryStats;
    records?: MediaRecordCounts;
  };
};

const DEFAULT_STORAGE_LIMIT = Math.floor(1.8 * 1024 * 1024 * 1024);
const MEDIA_STATS_CACHE_NAME = "media-stats";
const MEDIA_STATS_TTL_MS = 60_000;

const EMPTY_MEDIA_STATS: MediaStats = {
  totalImages: 0,
  totalVideos: 0,
  totalMusic: 0,
  totalDocuments: 0,
  totalPodcasts: 0,
  storageImagesCount: 0,
  storageVideosCount: 0,
  storageMusicCount: 0,
  imagesSize: 0,
  videosSize: 0,
  musicSize: 0,
  documentsSize: 0,
  otherSize: 0,
  totalSize: 0,
  totalFiles: 0,
  storageLimit: DEFAULT_STORAGE_LIMIT,
  usagePercentage: 0,
};

function toFiniteNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function buildStorageStatsUrl(config: AppwriteConfig) {
  const params = new URLSearchParams();
  const configEntries: Array<[string, string]> = [
    ["_endpoint", config.endpoint],
    ["_project", config.projectId],
    ["_database", config.databaseId],
    ["_key", config.apiKey],
    ["_bucket", config.bucketId],
  ];

  for (const [key, value] of configEntries) {
    if (value) params.set(key, value);
  }

  const query = params.toString();
  return query ? `/api/storage-stats?${query}` : "/api/storage-stats";
}

function getRecordCount(
  records: MediaRecordCounts | undefined,
  key: MediaRecordKey,
  fallback = 0
) {
  const value = records?.[key];
  return toFiniteNumber(value, fallback);
}

export function useMediaStats(enabled = true) {
  const { checked: configChecked, hasStorageConfig, config } = useAppwriteSetup();
  const mediaEnabled = enabled && configChecked && hasStorageConfig;
  const setupRequired = enabled && configChecked && !hasStorageConfig;
  const [stats, setStats] = useState<MediaStats>(EMPTY_MEDIA_STATS);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const loadStats = useCallback(async () => {
    const requestId = ++requestSequence.current;

    if (!enabled || !configChecked || !hasStorageConfig) {
      if (requestId === requestSequence.current) {
        setLoading(false);
        setError(null);
      }
      return;
    }

    const cached = readSessionCache<MediaStats>(MEDIA_STATS_CACHE_NAME, MEDIA_STATS_TTL_MS);
    if (cached) {
      setStats(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch(buildStorageStatsUrl(config), { cache: "default" });
      const data = (await response.json().catch(() => ({}))) as StorageStatsResponse;
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }
      if (requestId !== requestSequence.current) return;

      if (!data.stats) {
        throw new Error(data.error || "獲取儲存統計失敗");
      }

      const storage = data.stats;
      const records = storage.records;
      const images = storage.images;
      const videos = storage.videos;
      const music = storage.music;
      const documents = storage.documents;
      const other = storage.other;

      const nextStats: MediaStats = {
        totalImages: getRecordCount(records, "images", toFiniteNumber(images?.count)),
        totalVideos: getRecordCount(records, "videos", toFiniteNumber(videos?.count)),
        totalMusic: getRecordCount(records, "music", toFiniteNumber(music?.count)),
        // Keep the existing dashboard meaning: documents are storage files.
        totalDocuments: toFiniteNumber(documents?.count),
        totalPodcasts: getRecordCount(records, "podcasts"),
        storageImagesCount: toFiniteNumber(images?.count),
        storageVideosCount: toFiniteNumber(videos?.count),
        storageMusicCount: toFiniteNumber(music?.count),
        imagesSize: toFiniteNumber(images?.size),
        videosSize: toFiniteNumber(videos?.size),
        musicSize: toFiniteNumber(music?.size),
        documentsSize: toFiniteNumber(documents?.size),
        otherSize: toFiniteNumber(other?.size),
        totalSize: toFiniteNumber(storage.totalSize),
        totalFiles: toFiniteNumber(storage.totalFiles),
        storageLimit: toFiniteNumber(storage.storageLimit, DEFAULT_STORAGE_LIMIT),
        usagePercentage: toFiniteNumber(storage.usagePercentage),
      };
      setStats(nextStats);
      writeSessionCache(MEDIA_STATS_CACHE_NAME, nextStats);
    } catch (err) {
      if (requestId !== requestSequence.current) return;

      const message = err instanceof Error ? err.message : "獲取儲存統計失敗";
      const normalizedMessage = message.toLowerCase();
      if (normalizedMessage.includes("bandwidth") || normalizedMessage.includes("exceeded")) {
        setError(
          "Appwrite 組織頻寬已超出限制，請升級方案或調整預算上限。\n(Bandwidth limit for your organization has exceeded. Please upgrade to a higher plan or update your budget cap.)"
        );
      } else {
        setError(message);
      }
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [config, configChecked, enabled, hasStorageConfig]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useRefreshKeyListener("images_refresh_key", loadStats, mediaEnabled);
  useRefreshKeyListener("videos_refresh_key", loadStats, mediaEnabled);
  useRefreshKeyListener("music_refresh_key", loadStats, mediaEnabled);
  useRefreshKeyListener("podcast_refresh_key", loadStats, mediaEnabled);
  useRefreshKeyListener("commondocument_refresh_key", loadStats, mediaEnabled);

  return {
    stats,
    loading: enabled && (loading || !configChecked),
    error,
    setupRequired,
    refresh: loadStats,
  };
}
