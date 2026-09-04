"use client";

import { useMemo, useState } from "react";
import { Bookmark, Grid3x3, Image as ImageIcon, Layers, Tag } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { FullPageLoading } from "@/components/ui/loading-spinner";
import { ImageData } from "@/hooks";
import { getProxiedMediaUrl } from "@/lib/utils";
import { cn } from "@/lib/utils";

/** Bytes across the whole set, rendered the way a profile renders a follower count. */
function formatCompactSize(bytes: number): string {
  if (bytes <= 0) return "0";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

type ProfileTab = "posts" | "saved" | "tagged";

interface InstagramGalleryProps {
  images: ImageData[];
  /** The full library, so the header counts do not shrink when a filter is on. */
  allImages: ImageData[];
  loading: boolean;
  onSelectImage: (image: ImageData) => void;
  categoryFilter: string | null;
  onCategoryChange: (category: string | null) => void;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

/**
 * The gallery as a profile page.
 *
 * Instagram's grid earns its density by giving up per-item chrome: every cell
 * is a bare square, actions live in the post you open, and the only thing the
 * grid itself says is what the picture looks like. Everything this module
 * needs beyond that — category, size, edit, delete — stays reachable through
 * the existing preview modal, so nothing is lost by stripping the cards.
 */
export function InstagramGallery({
  images,
  allImages,
  loading,
  onSelectImage,
  categoryFilter,
  onCategoryChange,
  selectionMode = false,
  selectedIds,
  onToggleSelect,
}: InstagramGalleryProps) {
  const [tab, setTab] = useState<ProfileTab>("posts");

  const categories = useMemo(
    () =>
      Array.from(new Set(allImages.map((image) => image.category).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "zh-Hant")
      ),
    [allImages]
  );

  const totalSize = useMemo(
    () => allImages.reduce((sum, image) => sum + (image.size ?? 0), 0),
    [allImages]
  );

  // The tabs are real filters, not decoration: 珍藏 keeps the cover picks,
  // 已標註 keeps anything carrying a note.
  const visible = useMemo(() => {
    if (tab === "saved") return images.filter((image) => image.cover);
    if (tab === "tagged") return images.filter((image) => image.note?.trim());
    return images;
  }, [images, tab]);

  if (loading) return <FullPageLoading text="載入圖片中..." />;

  const tabs: { key: ProfileTab; label: string; icon: React.ReactNode }[] = [
    { key: "posts", label: "貼文", icon: <Grid3x3 className="h-3.5 w-3.5" /> },
    { key: "saved", label: "珍藏", icon: <Bookmark className="h-3.5 w-3.5" /> },
    { key: "tagged", label: "已標註", icon: <Tag className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-white/10 dark:bg-black">
      {/* Profile header */}
      <header className="flex flex-col gap-5 px-4 pb-6 pt-6 sm:flex-row sm:items-center sm:gap-10 sm:px-10 sm:pt-8">
        <div className="shrink-0 self-center rounded-full bg-[linear-gradient(45deg,#f09433,#e6683c_25%,#dc2743_50%,#cc2366_75%,#bc1888)] p-[3px] sm:self-auto">
          <div className="rounded-full bg-white p-[3px] dark:bg-black">
            <div className="flex size-20 items-center justify-center overflow-hidden rounded-full bg-neutral-100 sm:size-32 dark:bg-neutral-900">
              {allImages[0]?.file ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={getProxiedMediaUrl(allImages[0].file)}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <ImageIcon className="size-8 text-neutral-400" />
              )}
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h2 className="text-xl font-normal text-neutral-900 dark:text-neutral-50">fengbro.gallery</h2>
            <span className="rounded-md bg-[#0095f6] px-3 py-1 text-[13px] font-semibold text-white">
              私人相簿
            </span>
          </div>

          <dl className="mt-4 flex items-center gap-7 text-[15px] text-neutral-900 dark:text-neutral-100">
            <div className="flex gap-1.5">
              <dt className="font-semibold tabular-nums">{allImages.length}</dt>
              <dd className="text-neutral-500 dark:text-neutral-400">貼文</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="font-semibold tabular-nums">{categories.length}</dt>
              <dd className="text-neutral-500 dark:text-neutral-400">分類</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="font-semibold tabular-nums">{formatCompactSize(totalSize)}</dt>
              <dd className="text-neutral-500 dark:text-neutral-400">佔用</dd>
            </div>
          </dl>

          <p className="mt-4 text-sm font-semibold text-neutral-900 dark:text-neutral-100">鋒兄圖片</p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            存在 Appwrite Storage 的家庭相簿 · 點一張看大圖與明細
          </p>
        </div>
      </header>

      {/* Category rail, drawn as stories */}
      {categories.length > 0 && (
        <div className="no-scrollbar flex gap-5 overflow-x-auto border-b border-neutral-200 px-4 pb-6 sm:px-10 dark:border-white/10">
          {categories.map((category) => {
            const active = categoryFilter === category;
            const sample = allImages.find((image) => image.category === category && image.file);
            return (
              <button
                key={category}
                type="button"
                onClick={() => onCategoryChange(active ? null : category)}
                className="flex w-[72px] shrink-0 flex-col items-center gap-1.5 focus-visible:outline-none"
                aria-pressed={active}
              >
                <span
                  className={cn(
                    "rounded-full p-[2.5px] transition-transform",
                    active
                      ? "bg-[linear-gradient(45deg,#f09433,#e6683c_25%,#dc2743_50%,#cc2366_75%,#bc1888)] scale-105"
                      : "bg-neutral-300 dark:bg-neutral-700"
                  )}
                >
                  <span className="block rounded-full bg-white p-[2px] dark:bg-black">
                    <span className="flex size-14 items-center justify-center overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-900">
                      {sample?.file ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={getProxiedMediaUrl(sample.file)}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <ImageIcon className="size-5 text-neutral-400" />
                      )}
                    </span>
                  </span>
                </span>
                <span
                  className={cn(
                    "w-full truncate text-center text-[11px]",
                    active
                      ? "font-semibold text-neutral-900 dark:text-neutral-100"
                      : "text-neutral-600 dark:text-neutral-400"
                  )}
                >
                  {category}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Profile tabs */}
      <div className="flex items-center justify-center gap-10 border-t border-neutral-200 dark:border-white/10">
        {tabs.map((entry) => {
          const active = tab === entry.key;
          return (
            <button
              key={entry.key}
              type="button"
              onClick={() => setTab(entry.key)}
              aria-pressed={active}
              className={cn(
                "-mt-px flex items-center gap-1.5 border-t px-2 py-3.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors",
                active
                  ? "border-neutral-900 text-neutral-900 dark:border-neutral-100 dark:text-neutral-100"
                  : "border-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
              )}
            >
              {entry.icon}
              {entry.label}
            </button>
          );
        })}
      </div>

      {/* The grid */}
      {visible.length === 0 ? (
        <div className="px-4 py-10">
          <EmptyState
            icon={<ImageIcon className="text-neutral-400" size={32} />}
            title={tab === "posts" ? "沒有找到圖片" : "這個分頁還沒有內容"}
            description={
              tab === "saved"
                ? "把圖片設為封面後就會出現在珍藏"
                : tab === "tagged"
                  ? "填寫備註的圖片會出現在已標註"
                  : undefined
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-[3px] p-[3px] sm:gap-1 sm:p-1">
          {visible.map((image) => {
            const selected = selectedIds?.has(image.$id) ?? false;
            return (
              <button
                key={image.$id}
                type="button"
                onClick={() => {
                  if (selectionMode) onToggleSelect?.(image.$id);
                  else onSelectImage(image);
                }}
                className="group relative aspect-square overflow-hidden bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0095f6] dark:bg-neutral-900"
                aria-label={image.name}
              >
                {image.file ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={getProxiedMediaUrl(image.file)}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center">
                    <ImageIcon className="size-6 text-neutral-400" />
                  </span>
                )}

                {image.cover && (
                  <Layers className="absolute right-2 top-2 size-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />
                )}

                {selectionMode && (
                  <span
                    className={cn(
                      "absolute left-2 top-2 flex size-5 items-center justify-center rounded-full border-2 text-[10px] font-bold",
                      selected
                        ? "border-[#0095f6] bg-[#0095f6] text-white"
                        : "border-white/90 bg-black/20"
                    )}
                  >
                    {selected ? "✓" : ""}
                  </span>
                )}

                {/* Hover card: Instagram puts counts here; this library has a
                    name and a category, so those go in the same slot. */}
                <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/45 px-2 text-center opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                  <span className="line-clamp-2 text-[13px] font-semibold text-white">{image.name}</span>
                  {image.category && (
                    <span className="text-[11px] text-white/80">#{image.category}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
