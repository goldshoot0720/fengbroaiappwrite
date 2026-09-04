"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ListPlus,
  Mic,
  Pause,
  Pencil,
  Play,
  Podcast as PodcastIcon,
  Share2,
  Trash2,
} from "lucide-react";
import { PodcastData } from "@/hooks/usePodcast";
import { usePodcastQueue } from "@/hooks/usePodcastQueue";
import { getProxiedMediaUrl, cn } from "@/lib/utils";

const GREEN = "#1DB954";

const SHOW_TINTS = [
  "#1e3264",
  "#503750",
  "#8d67ab",
  "#b95d06",
  "#0d73ec",
  "#7d4b32",
  "#477d95",
  "#a56752",
];

function tintFor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return SHOW_TINTS[hash % SHOW_TINTS.length];
}

function formatEpisodeDate(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

function isVideoFile(fileUrlOrName: string): boolean {
  return /\.(mp4|webm|ogv|mov|m4v)(\?|$)/i.test(fileUrlOrName);
}

interface SpotifyPodcastShowProps {
  episodes: PodcastData[];
  /** Whole library, so show counts survive a search. */
  allEpisodes: PodcastData[];
  onEdit: (podcast: PodcastData) => void;
  onDelete: (podcast: PodcastData) => void;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

/**
 * Spotify draws a podcast differently from an album: the episode is a wide
 * row with its own artwork, a description that is allowed two lines, and a
 * round play button on the left rather than a track number. Categories become
 * shows, which is the closest honest mapping this data has.
 */
export function SpotifyPodcastShow({
  episodes,
  allEpisodes,
  onEdit,
  onDelete,
  selectionMode = false,
  selectedIds,
  onToggleSelect,
}: SpotifyPodcastShowProps) {
  const { playNow, addToQueue, isInQueue, currentItem } = usePodcastQueue();
  const [show, setShow] = useState<string | null>(null);

  const shows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const episode of allEpisodes) {
      const key = episode.category?.trim() || "未分類";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [allEpisodes]);

  useEffect(() => {
    if (show && !shows.some(([name]) => name === show)) setShow(null);
  }, [show, shows]);

  const visible = useMemo(
    () =>
      show
        ? episodes.filter((episode) => (episode.category?.trim() || "未分類") === show)
        : episodes,
    [episodes, show]
  );

  const title = show ?? "全部單集";
  const tint = tintFor(title);
  const heroCover = visible.find((episode) => episode.cover)?.cover;

  const toQueueItem = (episode: PodcastData) => ({
    id: episode.$id,
    name: episode.name,
    category: episode.category,
    file: getProxiedMediaUrl(episode.file),
    cover: episode.cover,
    mediaType: isVideoFile(episode.file) ? ("video" as const) : ("audio" as const),
  });

  const playAll = () => {
    const playable = visible.filter((episode) => episode.file);
    if (playable.length === 0) return;
    playNow(toQueueItem(playable[0]));
    for (const episode of playable.slice(1)) addToQueue(toQueueItem(episode));
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-xl bg-black text-neutral-200 lg:flex-row">
      {/* Show rail */}
      <aside className="shrink-0 border-b border-white/10 bg-black p-2 lg:w-[240px] lg:border-b-0">
        <div className="flex items-center gap-2 px-3 py-3 text-sm font-bold text-neutral-300">
          <Mic className="size-5" />
          你的 Podcast
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1 lg:max-h-[420px] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden">
          <button
            type="button"
            onClick={() => setShow(null)}
            className={cn(
              "flex shrink-0 items-center gap-3 rounded-md p-2 text-left transition-colors",
              show === null ? "bg-white/10" : "hover:bg-white/5"
            )}
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded bg-[linear-gradient(135deg,#1db954,#0d5c2c)]">
              <PodcastIcon className="size-5 text-white" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-white">全部單集</span>
              <span className="block text-xs text-neutral-400">{allEpisodes.length} 集</span>
            </span>
          </button>

          {shows.map(([name, count]) => {
            const active = show === name;
            const sample = allEpisodes.find(
              (episode) => (episode.category?.trim() || "未分類") === name && episode.cover
            );
            return (
              <button
                key={name}
                type="button"
                onClick={() => setShow(active ? null : name)}
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
                    <Mic className="size-5 text-white/80" />
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
                  <span className="block text-xs text-neutral-400">Podcast · {count} 集</span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Show pane */}
      <div className="min-w-0 flex-1 bg-[#121212]">
        <header
          className="flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:gap-6 sm:p-7"
          style={{ background: `linear-gradient(180deg, ${tint} 0%, #121212 92%)` }}
        >
          <div
            className="flex size-32 shrink-0 items-center justify-center overflow-hidden rounded-lg shadow-[0_8px_28px_rgba(0,0,0,0.45)] sm:size-44"
            style={{ backgroundColor: tint }}
          >
            {heroCover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={getProxiedMediaUrl(heroCover)} alt="" className="h-full w-full object-cover" />
            ) : (
              <Mic className="size-12 text-white/80" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/90">Podcast</p>
            <h2 className="mt-1 break-words text-3xl font-black leading-tight text-white sm:text-5xl">
              {title}
            </h2>
            <p className="mt-3 text-sm text-white/70">
              鋒兄播客
              <span className="mx-1.5">·</span>
              {visible.length} 集
            </p>
          </div>
        </header>

        <div className="flex items-center gap-4 px-5 py-4 sm:px-7">
          <button
            type="button"
            onClick={playAll}
            disabled={!visible.some((episode) => episode.file)}
            className="flex size-14 items-center justify-center rounded-full text-black shadow-lg transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: GREEN }}
            title="播放全部"
            aria-label="播放全部"
          >
            <Play className="size-6 translate-x-[1px] fill-current" />
          </button>
          <Share2 className="size-5 text-neutral-400" />
          <span className="text-sm text-neutral-400">依序加入播放佇列</span>
        </div>

        <section className="px-3 pb-6 sm:px-6">
          <h3 className="mb-1 px-1 text-lg font-bold text-white">所有單集</h3>

          {visible.length === 0 ? (
            <p className="px-1 py-10 text-center text-sm text-neutral-500">這個節目還沒有單集</p>
          ) : (
            visible.map((episode) => {
              const selected = selectedIds?.has(episode.$id) ?? false;
              const playing = currentItem?.id === episode.$id;
              const queued = isInQueue(episode.$id);
              return (
                <article
                  key={episode.$id}
                  className={cn(
                    "group flex gap-4 rounded-lg border-b border-white/5 p-3 transition-colors last:border-b-0",
                    selected ? "bg-white/15" : "hover:bg-white/5"
                  )}
                >
                  {selectionMode && (
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => onToggleSelect?.(episode.$id)}
                      className="mt-1 size-4 shrink-0 accent-[#1DB954]"
                      aria-label={`選取 ${episode.name}`}
                    />
                  )}

                  <span
                    className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded sm:size-20"
                    style={{ backgroundColor: tintFor(episode.name || "?") }}
                  >
                    {episode.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={getProxiedMediaUrl(episode.cover)}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <Mic className="size-6 text-white/70" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <h4
                      className={cn(
                        "truncate text-[15px] font-semibold",
                        playing ? "text-[#1DB954]" : "text-white"
                      )}
                    >
                      {episode.name || "未命名"}
                    </h4>
                    <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-neutral-400">
                      {episode.note?.trim() || "尚無單集說明"}
                    </p>

                    <div className="mt-2.5 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => episode.file && playNow(toQueueItem(episode))}
                        disabled={!episode.file}
                        title={playing ? "播放中" : "播放"}
                        aria-label={`播放 ${episode.name}`}
                        className="flex size-8 items-center justify-center rounded-full border border-white/20 text-white transition-colors hover:border-white hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        {playing ? (
                          <Pause className="size-3.5 fill-current" />
                        ) : (
                          <Play className="size-3.5 translate-x-[1px] fill-current" />
                        )}
                      </button>

                      <span className="text-xs text-neutral-400">
                        {formatEpisodeDate(episode.$createdAt)}
                        {episode.filetype && (
                          <>
                            <span className="mx-1.5">·</span>
                            <span className="uppercase">{episode.filetype}</span>
                          </>
                        )}
                      </span>

                      <span className="ml-auto flex items-center gap-0.5">
                        {episode.file && (
                          <button
                            type="button"
                            onClick={() => addToQueue(toQueueItem(episode))}
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
                          onClick={() => onEdit(episode)}
                          title="編輯"
                          className="rounded-full p-1.5 text-neutral-400 opacity-0 transition-colors hover:text-white group-hover:opacity-100 focus-visible:opacity-100"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(episode)}
                          title="刪除"
                          className="rounded-full p-1.5 text-neutral-400 opacity-0 transition-colors hover:text-red-400 group-hover:opacity-100 focus-visible:opacity-100"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </span>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}
