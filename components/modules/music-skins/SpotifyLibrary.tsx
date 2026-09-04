"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Clock3,
  Disc3,
  ListMusic,
  ListPlus,
  Music2,
  Pencil,
  Play,
  Trash2,
} from "lucide-react";
import { MusicData } from "@/hooks/useMusic";
import { useMusicQueue } from "@/hooks/useMusicQueue";
import { getProxiedMediaUrl, cn } from "@/lib/utils";

const GREEN = "#1DB954";

/** Deterministic hero tint per playlist, the way Spotify colours each header. */
const HERO_TINTS = [
  "#5038a0",
  "#1e3264",
  "#8d67ab",
  "#e8115b",
  "#148a08",
  "#b02897",
  "#7358ff",
  "#af2896",
];

function tintFor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return HERO_TINTS[hash % HERO_TINTS.length];
}

function formatSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "—";
  const mb = bytes / (1024 * 1024);
  return mb >= 100 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`;
}

function formatAdded(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

interface SpotifyLibraryProps {
  tracks: MusicData[];
  /** Whole library, so playlist counts survive a search. */
  allTracks: MusicData[];
  onEdit: (music: MusicData) => void;
  onDelete: (music: MusicData) => void;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

/**
 * The library as Spotify draws it: playlists down the left, a tinted hero for
 * whatever is open, and a numbered track table whose row number turns into a
 * play triangle under the cursor. Everything routes into the module's existing
 * playback queue — this skin plays, it does not reimplement a player.
 */
export function SpotifyLibrary({
  tracks,
  allTracks,
  onEdit,
  onDelete,
  selectionMode = false,
  selectedIds,
  onToggleSelect,
}: SpotifyLibraryProps) {
  const { addToQueue, isInQueue, playNow } = useMusicQueue();
  const [playlist, setPlaylist] = useState<string | null>(null);

  const playlists = useMemo(() => {
    const counts = new Map<string, number>();
    for (const track of allTracks) {
      const key = track.category?.trim() || "未分類";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [allTracks]);

  // A playlist that disappears behind a filter should not leave a dead header.
  useEffect(() => {
    if (playlist && !playlists.some(([name]) => name === playlist)) setPlaylist(null);
  }, [playlist, playlists]);

  const visible = useMemo(
    () =>
      playlist
        ? tracks.filter((track) => (track.category?.trim() || "未分類") === playlist)
        : tracks,
    [tracks, playlist]
  );

  const title = playlist ?? "全部歌曲";
  const tint = tintFor(title);
  const heroCover = visible.find((track) => track.cover)?.cover;
  const totalSize = visible.reduce((sum, track) => sum + (track.fileSize ?? 0), 0);

  const toQueueItem = (track: MusicData) => ({
    id: track.$id,
    name: track.name,
    language: track.language,
    file: getProxiedMediaUrl(track.file),
    fileSize: track.fileSize,
    cover: track.cover || undefined,
    lyrics: track.computedLyrics || track.lyrics || "",
  });

  const playAll = () => {
    const playable = visible.filter((track) => track.file);
    if (playable.length === 0) return;
    playNow(toQueueItem(playable[0]));
    for (const track of playable.slice(1)) addToQueue(toQueueItem(track));
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-xl bg-black text-neutral-200 lg:flex-row">
      {/* Library sidebar */}
      <aside className="shrink-0 border-b border-white/10 bg-black p-2 lg:w-[240px] lg:border-b-0">
        <div className="flex items-center gap-2 px-3 py-3 text-sm font-bold text-neutral-300">
          <ListMusic className="size-5" />
          你的音樂庫
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1 lg:max-h-[420px] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden">
          <button
            type="button"
            onClick={() => setPlaylist(null)}
            className={cn(
              "flex shrink-0 items-center gap-3 rounded-md p-2 text-left transition-colors",
              playlist === null ? "bg-white/10" : "hover:bg-white/5"
            )}
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded bg-[linear-gradient(135deg,#450af5,#c4efd9)]">
              <Music2 className="size-5 text-white" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-white">全部歌曲</span>
              <span className="block text-xs text-neutral-400">{allTracks.length} 首</span>
            </span>
          </button>

          {playlists.map(([name, count]) => {
            const active = playlist === name;
            const sample = allTracks.find(
              (track) => (track.category?.trim() || "未分類") === name && track.cover
            );
            return (
              <button
                key={name}
                type="button"
                onClick={() => setPlaylist(active ? null : name)}
                className={cn(
                  "flex shrink-0 items-center gap-3 rounded-md p-2 text-left transition-colors",
                  active ? "bg-white/10" : "hover:bg-white/5"
                )}
              >
                <span
                  className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded"
                  style={{ backgroundColor: tintFor(name) }}
                >
                  {sample?.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getProxiedMediaUrl(sample.cover)}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <Disc3 className="size-5 text-white/80" />
                  )}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block max-w-[9rem] truncate text-sm font-semibold",
                      active ? "text-[#1DB954]" : "text-white"
                    )}
                  >
                    {name}
                  </span>
                  <span className="block text-xs text-neutral-400">播放清單 · {count} 首</span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Playlist pane */}
      <div className="min-w-0 flex-1 bg-[#121212]">
        <header
          className="flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:gap-6 sm:p-7"
          style={{ background: `linear-gradient(180deg, ${tint} 0%, #121212 92%)` }}
        >
          <div
            className="flex size-32 shrink-0 items-center justify-center overflow-hidden rounded shadow-[0_8px_28px_rgba(0,0,0,0.45)] sm:size-44"
            style={{ backgroundColor: tint }}
          >
            {heroCover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={getProxiedMediaUrl(heroCover)} alt="" className="h-full w-full object-cover" />
            ) : (
              <Music2 className="size-12 text-white/80" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/90">播放清單</p>
            <h2 className="mt-1 break-words text-3xl font-black leading-tight text-white sm:text-5xl">
              {title}
            </h2>
            <p className="mt-3 text-sm text-white/70">
              鋒兄音樂
              <span className="mx-1.5">·</span>
              {visible.length} 首歌曲
              {totalSize > 0 && (
                <>
                  <span className="mx-1.5">·</span>
                  {formatSize(totalSize)}
                </>
              )}
            </p>
          </div>
        </header>

        <div className="flex items-center gap-5 px-5 py-4 sm:px-7">
          <button
            type="button"
            onClick={playAll}
            disabled={!visible.some((track) => track.file)}
            className="flex size-14 items-center justify-center rounded-full text-black shadow-lg transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: GREEN }}
            title="播放全部"
            aria-label="播放全部"
          >
            <Play className="size-6 translate-x-[1px] fill-current" />
          </button>
          <span className="text-sm text-neutral-400">依序加入播放佇列</span>
        </div>

        {/* Track table */}
        <div className="px-2 pb-6 sm:px-5">
          <div className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 border-b border-white/10 px-3 pb-2 text-[11px] uppercase tracking-wider text-neutral-400 sm:grid-cols-[2rem_1fr_9rem_7rem_auto]">
            <span className="text-right">#</span>
            <span>標題</span>
            <span className="hidden sm:block">語言 / 分類</span>
            <span className="hidden sm:block">加入日期</span>
            <span className="flex justify-end pr-1">
              <Clock3 className="size-3.5" />
            </span>
          </div>

          {visible.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-neutral-500">這個播放清單還沒有歌曲</p>
          ) : (
            visible.map((track, index) => {
              const selected = selectedIds?.has(track.$id) ?? false;
              const queued = isInQueue(track.$id);
              return (
                <div
                  key={track.$id}
                  className={cn(
                    "group grid grid-cols-[2rem_1fr_auto] items-center gap-3 rounded px-3 py-2 transition-colors sm:grid-cols-[2rem_1fr_9rem_7rem_auto]",
                    selected ? "bg-white/15" : "hover:bg-white/10"
                  )}
                >
                  <span className="relative flex h-6 items-center justify-end text-sm tabular-nums text-neutral-400">
                    {selectionMode ? (
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => onToggleSelect?.(track.$id)}
                        className="size-4 accent-[#1DB954]"
                        aria-label={`選取 ${track.name}`}
                      />
                    ) : (
                      <>
                        <span className="group-hover:invisible">{index + 1}</span>
                        {track.file && (
                          <button
                            type="button"
                            onClick={() => playNow(toQueueItem(track))}
                            className="absolute inset-0 hidden items-center justify-end text-white group-hover:flex"
                            title="播放"
                            aria-label={`播放 ${track.name}`}
                          >
                            <Play className="size-3.5 fill-current" />
                          </button>
                        )}
                      </>
                    )}
                  </span>

                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded"
                      style={{ backgroundColor: tintFor(track.name || "?") }}
                    >
                      {track.cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={getProxiedMediaUrl(track.cover)}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <Music2 className="size-4 text-white/70" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-white">
                        {track.name || "未命名"}
                      </span>
                      <span className="block truncate text-xs text-neutral-400">
                        {track.note?.trim() || track.language || "—"}
                      </span>
                    </span>
                  </span>

                  <span className="hidden min-w-0 truncate text-sm text-neutral-400 sm:block">
                    {[track.language, track.category].filter(Boolean).join(" · ") || "—"}
                  </span>
                  <span className="hidden text-sm text-neutral-400 sm:block">
                    {formatAdded(track.$createdAt)}
                  </span>

                  <span className="flex items-center justify-end gap-1">
                    <span className="mr-1 hidden text-xs tabular-nums text-neutral-400 sm:inline">
                      {formatSize(track.fileSize)}
                    </span>
                    {track.file && (
                      <button
                        type="button"
                        onClick={() => addToQueue(toQueueItem(track))}
                        disabled={queued}
                        title={queued ? "已在佇列中" : "加入佇列"}
                        className={cn(
                          "rounded-full p-1.5 transition-colors",
                          queued
                            ? "text-[#1DB954]"
                            : "text-neutral-400 opacity-0 hover:text-white group-hover:opacity-100 focus-visible:opacity-100"
                        )}
                      >
                        <ListPlus className="size-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onEdit(track)}
                      title="編輯"
                      className="rounded-full p-1.5 text-neutral-400 opacity-0 transition-colors hover:text-white group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(track)}
                      title="刪除"
                      className="rounded-full p-1.5 text-neutral-400 opacity-0 transition-colors hover:text-red-400 group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
