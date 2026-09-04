"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  ChevronRight,
  FileText,
  Hash,
  Paperclip,
  Pencil,
  Star,
  Trash2,
} from "lucide-react";
import { Article } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Notion renders a note as a page: a sidebar of pages grouped under their
 * section, then one page filling the reading column with its properties
 * stacked under the title. That split is what makes a long note readable, and
 * it is the one thing a card grid can never do — so this skin browses, and
 * hands anything that needs the file pickers back to the card view.
 */

function toBlocks(content: string): { kind: "todo" | "done" | "bullet" | "heading" | "text"; text: string }[] {
  return content
    .split("\n")
    .map((raw) => {
      const line = raw.trimEnd();
      const trimmed = line.trim();
      if (/^\[[ x]\]/i.test(trimmed)) {
        const done = /^\[x\]/i.test(trimmed);
        return { kind: done ? ("done" as const) : ("todo" as const), text: trimmed.slice(3).trim() };
      }
      if (/^#{1,3}\s/.test(trimmed)) {
        return { kind: "heading" as const, text: trimmed.replace(/^#{1,3}\s/, "") };
      }
      if (/^[-*•]\s/.test(trimmed)) {
        return { kind: "bullet" as const, text: trimmed.slice(2).trim() };
      }
      return { kind: "text" as const, text: line };
    });
}

function attachmentsOf(article: Article) {
  return [
    { url: article.file1, name: article.file1name, type: article.file1type },
    { url: article.file2, name: article.file2name, type: article.file2type },
    { url: article.file3, name: article.file3name, type: article.file3type },
  ].filter((entry) => entry.url);
}

function linksOf(article: Article) {
  return [article.url1, article.url2, article.url3].filter(Boolean) as string[];
}

interface NotionWorkspaceProps {
  articles: Article[];
  pinnedIds: Set<string>;
  onTogglePin: (id: string) => void;
  onEdit: (article: Article) => void;
  onDelete: (id: string, title: string) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  formatDisplayDate: (value: string) => string;
}

export function NotionWorkspace({
  articles,
  pinnedIds,
  onTogglePin,
  onEdit,
  onDelete,
  selectedIds,
  onToggleSelect,
  formatDisplayDate,
}: NotionWorkspaceProps) {
  const [openId, setOpenId] = useState<string | null>(articles[0]?.$id ?? null);

  // When the filter above changes the list out from under us, fall back to the
  // first page rather than showing an empty reading column.
  useEffect(() => {
    if (articles.length === 0) {
      setOpenId(null);
      return;
    }
    if (!articles.some((article) => article.$id === openId)) {
      setOpenId(articles[0].$id);
    }
  }, [articles, openId]);

  const groups = useMemo(() => {
    const map = new Map<string, Article[]>();
    for (const article of articles) {
      const key = article.category?.trim() || "未分類";
      const bucket = map.get(key);
      if (bucket) bucket.push(article);
      else map.set(key, [article]);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "zh-Hant"));
  }, [articles]);

  const open = articles.find((article) => article.$id === openId) ?? null;

  return (
    <div className="flex min-h-[560px] flex-col overflow-hidden rounded-xl border border-[#e9e9e7] bg-white lg:flex-row dark:border-white/10 dark:bg-[#191919]">
      {/* Sidebar */}
      <aside className="shrink-0 border-b border-[#e9e9e7] bg-[#f7f7f5] lg:w-[264px] lg:border-b-0 lg:border-r dark:border-white/10 dark:bg-[#202020]">
        <div className="flex items-center gap-2 px-3 py-3">
          <span className="flex size-5 items-center justify-center rounded bg-[#37352f] text-[11px] font-bold text-white dark:bg-white dark:text-[#191919]">
            鋒
          </span>
          <span className="truncate text-sm font-medium text-[#37352f] dark:text-[#e9e9e7]">
            鋒兄筆記
          </span>
          <span className="ml-auto text-xs text-[#9b9a97]">{articles.length}</span>
        </div>

        <nav className="max-h-[320px] overflow-y-auto px-1.5 pb-3 lg:max-h-[calc(100vh-18rem)]">
          {groups.map(([category, entries]) => (
            <section key={category} className="mb-2">
              <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#9b9a97]">
                {category}
              </p>
              {entries.map((article) => {
                const active = article.$id === openId;
                return (
                  <button
                    key={article.$id}
                    type="button"
                    onClick={() => setOpenId(article.$id)}
                    className={cn(
                      "group flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-sm transition-colors",
                      active
                        ? "bg-[#e8e8e6] text-[#37352f] dark:bg-white/10 dark:text-[#e9e9e7]"
                        : "text-[#5f5e5b] hover:bg-[#efefee] dark:text-[#b3b3b1] dark:hover:bg-white/5"
                    )}
                  >
                    <ChevronRight
                      className={cn(
                        "size-3 shrink-0 text-[#9b9a97] transition-transform",
                        active && "rotate-90"
                      )}
                    />
                    <FileText className="size-3.5 shrink-0 text-[#9b9a97]" />
                    <span className="min-w-0 flex-1 truncate">{article.title || "無標題"}</span>
                    {pinnedIds.has(article.$id) && (
                      <Star className="size-3 shrink-0 fill-[#d9730d] text-[#d9730d]" />
                    )}
                  </button>
                );
              })}
            </section>
          ))}
        </nav>
      </aside>

      {/* Page */}
      <div className="min-w-0 flex-1">
        {!open ? (
          <div className="flex h-full min-h-[320px] items-center justify-center px-6 text-sm text-[#9b9a97]">
            左側選一篇筆記開始閱讀
          </div>
        ) : (
          <article className="mx-auto max-w-3xl px-6 py-8 sm:px-12 sm:py-12">
            {/* Breadcrumb + page actions */}
            <div className="mb-8 flex items-center gap-1 text-xs text-[#9b9a97]">
              <span>鋒兄筆記</span>
              <ChevronRight className="size-3" />
              <span>{open.category?.trim() || "未分類"}</span>
              <ChevronRight className="size-3" />
              <span className="truncate text-[#37352f] dark:text-[#e9e9e7]">{open.title || "無標題"}</span>

              <div className="ml-auto flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => onTogglePin(open.$id)}
                  title={pinnedIds.has(open.$id) ? "取消釘選" : "釘選"}
                  className="rounded p-1.5 text-[#5f5e5b] transition-colors hover:bg-[#efefee] dark:text-[#b3b3b1] dark:hover:bg-white/10"
                >
                  <Star
                    className={cn(
                      "size-3.5",
                      pinnedIds.has(open.$id) && "fill-[#d9730d] text-[#d9730d]"
                    )}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(open)}
                  title="編輯（切換到卡片版型）"
                  className="rounded p-1.5 text-[#5f5e5b] transition-colors hover:bg-[#efefee] dark:text-[#b3b3b1] dark:hover:bg-white/10"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(open.$id, open.title)}
                  title="刪除"
                  className="rounded p-1.5 text-[#5f5e5b] transition-colors hover:bg-[#efefee] hover:text-red-600 dark:text-[#b3b3b1] dark:hover:bg-white/10"
                >
                  <Trash2 className="size-3.5" />
                </button>
                <label
                  className="ml-1 flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-1 text-[11px] text-[#5f5e5b] transition-colors hover:bg-[#efefee] dark:text-[#b3b3b1] dark:hover:bg-white/10"
                  title="加入批次選取"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(open.$id)}
                    onChange={() => onToggleSelect(open.$id)}
                    className="size-3.5 rounded border-[#d3d1cb]"
                  />
                  選取
                </label>
              </div>
            </div>

            <h1 className="mb-6 text-[2.05rem] font-bold leading-tight tracking-tight text-[#37352f] dark:text-[#e9e9e7]">
              {open.title || "無標題"}
            </h1>

            {/* Property table */}
            <dl className="mb-8 space-y-1.5 text-sm">
              <div className="flex items-start gap-2">
                <dt className="flex w-28 shrink-0 items-center gap-1.5 py-1 text-[#9b9a97]">
                  <Calendar className="size-3.5" />
                  日期
                </dt>
                <dd className="py-1 text-[#37352f] dark:text-[#e9e9e7]">
                  {formatDisplayDate(open.newDate)}
                </dd>
              </div>
              <div className="flex items-start gap-2">
                <dt className="flex w-28 shrink-0 items-center gap-1.5 py-1 text-[#9b9a97]">
                  <Hash className="size-3.5" />
                  分類
                </dt>
                <dd className="py-1">
                  <span className="rounded bg-[#f1f0ef] px-1.5 py-0.5 text-[13px] text-[#37352f] dark:bg-white/10 dark:text-[#e9e9e7]">
                    {open.category?.trim() || "未分類"}
                  </span>
                </dd>
              </div>
              {attachmentsOf(open).length > 0 && (
                <div className="flex items-start gap-2">
                  <dt className="flex w-28 shrink-0 items-center gap-1.5 py-1 text-[#9b9a97]">
                    <Paperclip className="size-3.5" />
                    附件
                  </dt>
                  <dd className="flex flex-wrap gap-1.5 py-1">
                    {attachmentsOf(open).map((entry, index) => (
                      <a
                        key={`${entry.url}-${index}`}
                        href={entry.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded bg-[#f1f0ef] px-1.5 py-0.5 text-[13px] text-[#37352f] underline-offset-2 hover:underline dark:bg-white/10 dark:text-[#e9e9e7]"
                      >
                        {entry.name || `附件 ${index + 1}`}
                      </a>
                    ))}
                  </dd>
                </div>
              )}
              {linksOf(open).length > 0 && (
                <div className="flex items-start gap-2">
                  <dt className="flex w-28 shrink-0 items-center gap-1.5 py-1 text-[#9b9a97]">
                    <ChevronRight className="size-3.5" />
                    連結
                  </dt>
                  <dd className="flex min-w-0 flex-col gap-0.5 py-1">
                    {linksOf(open).map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-[13px] text-[#37352f] underline decoration-[#d3d1cb] underline-offset-2 hover:decoration-[#37352f] dark:text-[#e9e9e7]"
                      >
                        {url}
                      </a>
                    ))}
                  </dd>
                </div>
              )}
            </dl>

            <hr className="mb-6 border-[#e9e9e7] dark:border-white/10" />

            {/* Blocks */}
            <div className="space-y-1">
              {toBlocks(open.content || "").map((block, index) => {
                if (block.kind === "heading") {
                  return (
                    <h2
                      key={index}
                      className="pb-1 pt-5 text-xl font-semibold text-[#37352f] dark:text-[#e9e9e7]"
                    >
                      {block.text}
                    </h2>
                  );
                }
                if (block.kind === "todo" || block.kind === "done") {
                  return (
                    <div key={index} className="flex items-start gap-2 py-0.5">
                      <span
                        className={cn(
                          "mt-[3px] flex size-4 shrink-0 items-center justify-center rounded-sm border text-[10px]",
                          block.kind === "done"
                            ? "border-[#2383e2] bg-[#2383e2] text-white"
                            : "border-[#d3d1cb] dark:border-white/25"
                        )}
                      >
                        {block.kind === "done" ? "✓" : ""}
                      </span>
                      <span
                        className={cn(
                          "text-[15px] leading-6 text-[#37352f] dark:text-[#e9e9e7]",
                          block.kind === "done" && "text-[#9b9a97] line-through dark:text-[#7d7d7a]"
                        )}
                      >
                        {block.text}
                      </span>
                    </div>
                  );
                }
                if (block.kind === "bullet") {
                  return (
                    <div key={index} className="flex items-start gap-2 py-0.5">
                      <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-[#37352f] dark:bg-[#e9e9e7]" />
                      <span className="text-[15px] leading-6 text-[#37352f] dark:text-[#e9e9e7]">
                        {block.text}
                      </span>
                    </div>
                  );
                }
                if (!block.text.trim()) return <div key={index} className="h-3" />;
                return (
                  <p
                    key={index}
                    className="whitespace-pre-wrap py-0.5 text-[15px] leading-[1.75] text-[#37352f] dark:text-[#e9e9e7]"
                  >
                    {block.text}
                  </p>
                );
              })}
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
