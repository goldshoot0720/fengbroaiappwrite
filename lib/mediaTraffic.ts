"use client";

import { useEffect, useState } from "react";

export type MediaTrafficCategory = "image" | "video" | "music" | "document" | "podcast";
export type MediaTrafficAction = "playback" | "browse" | "download" | "upload";

export interface MediaTrafficLedger {
  month: string;
  total: number;
  categories: Record<MediaTrafficCategory, number>;
  actions: Record<MediaTrafficAction, number>;
}

const STORAGE_KEY = "fengbro:media-traffic:v1";
const LOADED_FILES_KEY = "fengbro:media-traffic-loaded-files:v1";
const EVENT_NAME = "fengbro:media-traffic-updated";

function currentMonth() {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
}

const emptyLedger = (month = currentMonth()): MediaTrafficLedger => ({
  month,
  total: 0,
  categories: { image: 0, video: 0, music: 0, document: 0, podcast: 0 },
  actions: { playback: 0, browse: 0, download: 0, upload: 0 },
});

function normaliseLedger(value: unknown): MediaTrafficLedger {
  const base = emptyLedger();
  if (!value || typeof value !== "object") return base;
  const candidate = value as Partial<MediaTrafficLedger>;
  if (candidate.month !== base.month) return base;
  return {
    ...base,
    total: Number.isFinite(candidate.total) ? Math.max(0, Number(candidate.total)) : 0,
    categories: { ...base.categories, ...candidate.categories },
    actions: { ...base.actions, ...candidate.actions },
  };
}

export function readMediaTraffic(): MediaTrafficLedger {
  if (typeof window === "undefined") return emptyLedger();
  try {
    return normaliseLedger(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null"));
  } catch {
    return emptyLedger();
  }
}

export function recordMediaTraffic(category: MediaTrafficCategory, action: MediaTrafficAction, bytes: number) {
  if (typeof window === "undefined" || !Number.isFinite(bytes) || bytes <= 0) return;
  const ledger = readMediaTraffic();
  const amount = Math.round(bytes);
  ledger.total += amount;
  ledger.categories[category] += amount;
  ledger.actions[action] += amount;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ledger));
  window.dispatchEvent(new Event(EVENT_NAME));
}

export async function recordRemoteMediaTraffic(category: MediaTrafficCategory, action: MediaTrafficAction, url: string, knownSize?: number | null) {
  if (typeof window === "undefined" || !url) return;
  const loadedFiles = readLoadedFiles();
  if (loadedFiles.has(url)) return;
  if (knownSize && knownSize > 0) {
    recordMediaTraffic(category, action, knownSize);
    rememberLoadedFile(url, loadedFiles);
    return;
  }
  try {
    const response = await fetch(url, { method: "HEAD" });
    const size = Number(response.headers.get("content-length"));
    if (response.ok && Number.isFinite(size) && size > 0) {
      recordMediaTraffic(category, action, size);
      rememberLoadedFile(url, loadedFiles);
      return;
    }

    // Some media servers (including Appwrite views behind a proxy) reject HEAD
    // requests or omit Content-Length. A one-byte range response carries the
    // complete file size in Content-Range without downloading the media again.
    const rangeResponse = await fetch(url, { headers: { Range: "bytes=0-0" } });
    const contentRange = rangeResponse.headers.get("content-range");
    const totalSize = Number(contentRange?.match(/\/(\d+)$/)?.[1]);
    if (rangeResponse.ok && Number.isFinite(totalSize) && totalSize > 0) {
      recordMediaTraffic(category, action, totalSize);
      rememberLoadedFile(url, loadedFiles);
    }
  } catch {
    // A failed size lookup must never affect the media action itself.
  }
}

function readLoadedFiles() {
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(LOADED_FILES_KEY) || "[]");
    return new Set<string>(Array.isArray(stored) ? stored : []);
  } catch {
    return new Set<string>();
  }
}

function rememberLoadedFile(url: string, loadedFiles: Set<string>) {
  loadedFiles.add(url);
  window.sessionStorage.setItem(LOADED_FILES_KEY, JSON.stringify([...loadedFiles]));
}

export function categoryFromFile(file: File): MediaTrafficCategory | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "music";
  return file.size > 0 ? "document" : null;
}

export function useMediaTraffic() {
  const [ledger, setLedger] = useState<MediaTrafficLedger>(() => readMediaTraffic());
  useEffect(() => {
    const refresh = () => setLedger(readMediaTraffic());
    window.addEventListener(EVENT_NAME, refresh);
    window.addEventListener("storage", refresh);
    refresh();
    return () => {
      window.removeEventListener(EVENT_NAME, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return ledger;
}
