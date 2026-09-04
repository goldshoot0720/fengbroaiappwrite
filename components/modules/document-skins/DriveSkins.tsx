"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  Cloud,
  Download,
  Eye,
  FileText,
  Folder,
  FolderOpen,
  HardDrive,
  Home,
  Pencil,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import { CommonDocumentData } from "@/hooks/useCommonDocument";
import { cn } from "@/lib/utils";

/**
 * Three cloud drives over one collection.
 *
 * All three agree on the same model — folders on top, files under them, a
 * table of metadata — and disagree on everything else: Drive is white with a
 * blue rail of filter chips, MEGA is dark with a red spine and a storage
 * readout, Dropbox is white with a blue action strip and the quietest table of
 * the three. Categories stand in for folders, since that is what they are.
 */

const UNFILED = "未分類";

export interface DriveHandlers {
  onPreview: (doc: CommonDocumentData) => void;
  onEdit: (doc: CommonDocumentData) => void;
  onDelete: (doc: CommonDocumentData) => void;
  onEditContent: (doc: CommonDocumentData) => void;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

export interface DriveBrowserProps extends DriveHandlers {
  documents: CommonDocumentData[];
  /** Whole collection, so folder counts survive a search. */
  allDocuments: CommonDocumentData[];
}

function folderOf(doc: CommonDocumentData): string {
  return doc.category?.trim() || UNFILED;
}

function extensionOf(doc: CommonDocumentData): string {
  const fromType = doc.filetype?.trim().replace(/^\./, "");
  if (fromType) return fromType.toLowerCase();
  const match = /\.([a-z0-9]+)$/i.exec(doc.name || doc.file || "");
  return match ? match[1].toLowerCase() : "file";
}

/** Extension colours borrowed from the file-type chips every drive uses. */
function extensionTint(extension: string): string {
  if (["pdf"].includes(extension)) return "#ea4335";
  if (["doc", "docx", "odt", "rtf"].includes(extension)) return "#4285f4";
  if (["xls", "xlsx", "csv", "ods"].includes(extension)) return "#0f9d58";
  if (["ppt", "pptx", "odp"].includes(extension)) return "#f4b400";
  if (["zip", "rar", "7z", "gz", "tar"].includes(extension)) return "#8e6ec8";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(extension)) return "#e8710a";
  if (["md", "txt", "json", "log"].includes(extension)) return "#5f6368";
  return "#5f6368";
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return sameYear
    ? `${month} 月 ${day} 日`
    : `${date.getFullYear()} 年 ${month} 月 ${day} 日`;
}

/** Shared folder/file split for whichever drive is on screen. */
function useDriveTree(
  documents: CommonDocumentData[],
  allDocuments: CommonDocumentData[]
) {
  const [folder, setFolder] = useState<string | null>(null);

  const folders = useMemo(() => {
    const counts = new Map<string, number>();
    for (const doc of allDocuments) {
      const key = folderOf(doc);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0], "zh-Hant"));
  }, [allDocuments]);

  useEffect(() => {
    if (folder && !folders.some(([name]) => name === folder)) setFolder(null);
  }, [folder, folders]);

  const files = useMemo(
    () => (folder ? documents.filter((doc) => folderOf(doc) === folder) : documents),
    [documents, folder]
  );

  return { folder, setFolder, folders, files };
}

function ExtensionBadge({ extension, size = 28 }: { extension: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded font-bold uppercase text-white"
      style={{
        backgroundColor: extensionTint(extension),
        width: size,
        height: size,
        fontSize: extension.length > 3 ? size * 0.26 : size * 0.32,
      }}
      aria-hidden
    >
      {extension.slice(0, 4)}
    </span>
  );
}

interface RowActionsProps extends DriveHandlers {
  doc: CommonDocumentData;
  tone: "light" | "dark";
}

function RowActions({ doc, tone, onPreview, onEdit, onDelete, onEditContent }: RowActionsProps) {
  const base =
    "rounded-full p-1.5 opacity-0 transition-colors group-hover:opacity-100 focus-visible:opacity-100";
  const idle = tone === "dark" ? "text-neutral-400 hover:text-white" : "text-neutral-500 hover:text-neutral-900";

  return (
    <span className="flex items-center justify-end gap-0.5">
      <button type="button" onClick={() => onPreview(doc)} title="預覽" className={cn(base, idle)}>
        <Eye className="size-4" />
      </button>
      <button type="button" onClick={() => onEditContent(doc)} title="編輯內容" className={cn(base, idle)}>
        <FileText className="size-4" />
      </button>
      <button type="button" onClick={() => onEdit(doc)} title="編輯" className={cn(base, idle)}>
        <Pencil className="size-4" />
      </button>
      {doc.file && (
        <a
          href={doc.file}
          target="_blank"
          rel="noreferrer"
          title="下載"
          className={cn(base, idle, "inline-flex")}
        >
          <Download className="size-4" />
        </a>
      )}
      <button
        type="button"
        onClick={() => onDelete(doc)}
        title="刪除"
        className={cn(base, tone === "dark" ? "text-neutral-400 hover:text-red-400" : "text-neutral-500 hover:text-red-600")}
      >
        <Trash2 className="size-4" />
      </button>
    </span>
  );
}

/* ───────────────────────────── Google Drive ───────────────────────────── */

export function GoogleDriveBrowser({ documents, allDocuments, ...handlers }: DriveBrowserProps) {
  const { folder, setFolder, folders, files } = useDriveTree(documents, allDocuments);
  const { selectionMode, selectedIds, onToggleSelect } = handlers;

  return (
    <div className="overflow-hidden rounded-xl border border-[#dadce0] bg-white dark:border-white/10 dark:bg-[#1f1f1f]">
      <div className="flex flex-wrap items-center gap-2 px-4 pt-4 sm:px-6">
        <button
          type="button"
          onClick={() => setFolder(null)}
          className="flex items-center gap-1.5 text-[22px] font-normal text-[#202124] dark:text-[#e8eaed]"
        >
          我的雲端硬碟
        </button>
        {folder && (
          <>
            <ChevronRight className="size-4 text-[#5f6368]" />
            <span className="text-[22px] font-normal text-[#202124] dark:text-[#e8eaed]">{folder}</span>
          </>
        )}
      </div>

      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto px-4 py-3 sm:px-6">
        {["類型", "修改日期", "來源"].map((chip) => (
          <span
            key={chip}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-[#dadce0] px-3 text-[13px] text-[#444746] dark:border-white/15 dark:text-[#c4c7c5]"
          >
            {chip}
            <ChevronRight className="size-3 rotate-90" />
          </span>
        ))}
        <span className="ml-auto shrink-0 text-[13px] text-[#5f6368]">{files.length} 個項目</span>
      </div>

      {!folder && folders.length > 0 && (
        <section className="px-4 pb-4 sm:px-6">
          <h3 className="mb-2 text-[13px] font-medium text-[#202124] dark:text-[#e8eaed]">資料夾</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {folders.map(([name, count]) => (
              <button
                key={name}
                type="button"
                onDoubleClick={() => setFolder(name)}
                onClick={() => setFolder(name)}
                className="flex items-center gap-3 rounded-lg bg-[#f0f4f9] px-3 py-2.5 text-left transition-colors hover:bg-[#e3e9f2] dark:bg-white/5 dark:hover:bg-white/10"
              >
                <Folder className="size-5 shrink-0 fill-[#5f6368] text-[#5f6368] dark:fill-[#c4c7c5] dark:text-[#c4c7c5]" />
                <span className="min-w-0 flex-1 truncate text-[14px] text-[#202124] dark:text-[#e8eaed]">
                  {name}
                </span>
                <span className="text-[12px] text-[#5f6368]">{count}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="px-4 pb-5 sm:px-6">
        <h3 className="mb-1 text-[13px] font-medium text-[#202124] dark:text-[#e8eaed]">檔案</h3>
        <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-[#dadce0] py-2 text-[12px] text-[#5f6368] sm:grid-cols-[1fr_8rem_9rem_auto] dark:border-white/10">
          <span className="pl-1">名稱</span>
          <span className="hidden sm:block">擁有者</span>
          <span className="hidden sm:block">上次修改</span>
          <span className="pr-1 text-right">動作</span>
        </div>
        {files.length === 0 ? (
          <p className="py-10 text-center text-sm text-[#5f6368]">這個資料夾是空的</p>
        ) : (
          files.map((doc) => {
            const selected = selectedIds?.has(doc.$id) ?? false;
            return (
              <div
                key={doc.$id}
                className={cn(
                  "group grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg py-2 transition-colors sm:grid-cols-[1fr_8rem_9rem_auto]",
                  selected ? "bg-[#c2e7ff]/70 dark:bg-[#004a77]/50" : "hover:bg-[#f0f4f9] dark:hover:bg-white/5"
                )}
                onDoubleClick={() => handlers.onPreview(doc)}
              >
                <span className="flex min-w-0 items-center gap-3 pl-1">
                  {selectionMode && (
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => onToggleSelect?.(doc.$id)}
                      className="size-4 shrink-0 accent-[#1a73e8]"
                      aria-label={`選取 ${doc.name}`}
                    />
                  )}
                  <ExtensionBadge extension={extensionOf(doc)} />
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] text-[#202124] dark:text-[#e8eaed]">
                      {doc.name || "未命名"}
                    </span>
                    {doc.note && (
                      <span className="block truncate text-[12px] text-[#5f6368]">{doc.note}</span>
                    )}
                  </span>
                </span>
                <span className="hidden items-center gap-1.5 text-[13px] text-[#5f6368] sm:flex">
                  <span className="flex size-6 items-center justify-center rounded-full bg-[#1a73e8] text-[11px] font-medium text-white">
                    鋒
                  </span>
                  我
                </span>
                <span className="hidden text-[13px] text-[#5f6368] sm:block">
                  {formatDate(doc.$updatedAt || doc.$createdAt)}
                </span>
                <RowActions doc={doc} tone="light" {...handlers} />
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}

/* ─────────────────────────────── MEGA ─────────────────────────────────── */

export function MegaBrowser({ documents, allDocuments, ...handlers }: DriveBrowserProps) {
  const { folder, setFolder, folders, files } = useDriveTree(documents, allDocuments);
  const { selectionMode, selectedIds, onToggleSelect } = handlers;
  const share = allDocuments.length === 0 ? 0 : Math.min(100, Math.round((files.length / allDocuments.length) * 100));

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[#2b2b2b] bg-[#121212] text-neutral-200 lg:flex-row">
      <aside className="shrink-0 border-b border-white/10 p-3 lg:w-[236px] lg:border-b-0 lg:border-r">
        <div className="mb-3 flex items-center gap-2 px-1">
          <span className="flex size-6 items-center justify-center rounded-full bg-[#D9272E] text-[11px] font-black text-white">
            M
          </span>
          <span className="text-sm font-bold tracking-wide text-white">MEGA</span>
        </div>

        <button
          type="button"
          onClick={() => setFolder(null)}
          className={cn(
            "mb-1 flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm transition-colors",
            folder === null ? "bg-[#D9272E]/15 text-[#ff5a5f]" : "text-neutral-300 hover:bg-white/5"
          )}
        >
          <Cloud className="size-4" />
          雲端硬碟
          <span className="ml-auto text-xs text-neutral-500">{allDocuments.length}</span>
        </button>

        <div className="no-scrollbar flex gap-1 overflow-x-auto lg:max-h-[300px] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden">
          {folders.map(([name, count]) => {
            const active = folder === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => setFolder(active ? null : name)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors lg:pl-6",
                  active ? "bg-[#D9272E]/15 text-[#ff5a5f]" : "text-neutral-400 hover:bg-white/5"
                )}
              >
                {active ? <FolderOpen className="size-4 shrink-0" /> : <Folder className="size-4 shrink-0" />}
                <span className="max-w-[9rem] truncate">{name}</span>
                <span className="ml-auto hidden text-xs text-neutral-500 lg:inline">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-lg border border-white/10 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-neutral-500">
            <HardDrive className="size-3.5" />
            目前檢視
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[#D9272E]" style={{ width: `${share}%` }} />
          </div>
          <p className="mt-2 text-[11px] text-neutral-400">
            {files.length} / {allDocuments.length} 個檔案
          </p>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3 text-sm text-neutral-400">
          <Home className="size-4" />
          <span>雲端硬碟</span>
          {folder && (
            <>
              <ChevronRight className="size-3.5" />
              <span className="text-white">{folder}</span>
            </>
          )}
          <span className="ml-auto text-xs">{files.length} 個項目</span>
        </div>

        <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-white/10 px-4 py-2 text-[11px] uppercase tracking-wider text-neutral-500 sm:grid-cols-[1fr_6rem_9rem_auto]">
          <span>名稱</span>
          <span className="hidden sm:block">類型</span>
          <span className="hidden sm:block">最後修改</span>
          <span className="text-right">動作</span>
        </div>

        {files.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-neutral-500">這個資料夾是空的</p>
        ) : (
          <div className="px-2 pb-4">
            {files.map((doc) => {
              const selected = selectedIds?.has(doc.$id) ?? false;
              return (
                <div
                  key={doc.$id}
                  className={cn(
                    "group grid grid-cols-[1fr_auto] items-center gap-3 rounded px-2 py-2 transition-colors sm:grid-cols-[1fr_6rem_9rem_auto]",
                    selected ? "bg-[#D9272E]/20" : "hover:bg-white/5"
                  )}
                  onDoubleClick={() => handlers.onPreview(doc)}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    {selectionMode && (
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => onToggleSelect?.(doc.$id)}
                        className="size-4 shrink-0 accent-[#D9272E]"
                        aria-label={`選取 ${doc.name}`}
                      />
                    )}
                    <ExtensionBadge extension={extensionOf(doc)} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-white">{doc.name || "未命名"}</span>
                      {doc.note && (
                        <span className="block truncate text-xs text-neutral-500">{doc.note}</span>
                      )}
                    </span>
                  </span>
                  <span className="hidden text-sm uppercase text-neutral-400 sm:block">
                    {extensionOf(doc)}
                  </span>
                  <span className="hidden text-sm text-neutral-400 sm:block">
                    {formatDate(doc.$updatedAt || doc.$createdAt)}
                  </span>
                  <RowActions doc={doc} tone="dark" {...handlers} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────── Dropbox ───────────────────────────────── */

export function DropboxBrowser({ documents, allDocuments, ...handlers }: DriveBrowserProps) {
  const { folder, setFolder, folders, files } = useDriveTree(documents, allDocuments);
  const { selectionMode, selectedIds, onToggleSelect } = handlers;

  return (
    <div className="overflow-hidden rounded-xl border border-[#e7e7e7] bg-white dark:border-white/10 dark:bg-[#1e1919]">
      <div className="flex flex-wrap items-center gap-3 border-b border-[#e7e7e7] px-4 py-4 sm:px-6 dark:border-white/10">
        <span className="flex size-7 items-center justify-center rounded bg-[#0061FF] text-white">
          <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
            <path d="M6 2 0 6l6 4-6 4 6 4 6-4-6-4 6-4-6-4Zm12 0-6 4 6 4 6-4-6-4Zm0 8-6 4 6 4 6-4-6-4ZM6 19l6-4 6 4-6 4-6-4Z" />
          </svg>
        </span>
        <h2 className="text-lg font-semibold text-[#1e1919] dark:text-[#f7f5f2]">
          {folder ?? "所有檔案"}
        </h2>
        {folder && (
          <button
            type="button"
            onClick={() => setFolder(null)}
            className="text-[13px] text-[#0061FF] underline-offset-2 hover:underline"
          >
            返回所有檔案
          </button>
        )}
        <span className="ml-auto text-[13px] text-[#6f6a68] dark:text-neutral-400">
          {files.length} 個項目
        </span>
      </div>

      {!folder && folders.length > 0 && (
        <div className="flex flex-wrap gap-2 border-b border-[#e7e7e7] px-4 py-3 sm:px-6 dark:border-white/10">
          {folders.map(([name, count]) => (
            <button
              key={name}
              type="button"
              onClick={() => setFolder(name)}
              className="inline-flex items-center gap-2 rounded-md border border-[#e7e7e7] px-3 py-1.5 text-[13px] text-[#1e1919] transition-colors hover:border-[#0061FF] hover:text-[#0061FF] dark:border-white/15 dark:text-[#f7f5f2]"
            >
              <Folder className="size-4 fill-[#0061FF] text-[#0061FF]" />
              {name}
              <span className="text-[#6f6a68]">{count}</span>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-[#e7e7e7] px-4 py-2 text-[13px] font-medium text-[#6f6a68] sm:grid-cols-[1fr_9rem_7rem_auto] sm:px-6 dark:border-white/10">
        <span className="pl-7">名稱</span>
        <span className="hidden sm:block">修改時間</span>
        <span className="hidden sm:block">成員</span>
        <span className="text-right">動作</span>
      </div>

      {files.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-[#6f6a68]">這裡還沒有檔案</p>
      ) : (
        <div className="px-2 pb-3 sm:px-4">
          {files.map((doc) => {
            const selected = selectedIds?.has(doc.$id) ?? false;
            return (
              <div
                key={doc.$id}
                className={cn(
                  "group grid grid-cols-[1fr_auto] items-center gap-3 border-b border-[#f2f0ee] px-2 py-2.5 transition-colors last:border-b-0 sm:grid-cols-[1fr_9rem_7rem_auto] dark:border-white/5",
                  selected ? "bg-[#0061FF]/10" : "hover:bg-[#f7f5f2] dark:hover:bg-white/5"
                )}
                onDoubleClick={() => handlers.onPreview(doc)}
              >
                <span className="flex min-w-0 items-center gap-3">
                  {selectionMode ? (
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => onToggleSelect?.(doc.$id)}
                      className="size-4 shrink-0 accent-[#0061FF]"
                      aria-label={`選取 ${doc.name}`}
                    />
                  ) : (
                    <Star className="size-4 shrink-0 text-[#c9c5c2] opacity-0 transition-opacity group-hover:opacity-100" />
                  )}
                  <ExtensionBadge extension={extensionOf(doc)} size={24} />
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium text-[#1e1919] dark:text-[#f7f5f2]">
                      {doc.name || "未命名"}
                    </span>
                    {doc.note && (
                      <span className="block truncate text-[12px] text-[#6f6a68]">{doc.note}</span>
                    )}
                  </span>
                </span>
                <span className="hidden text-[13px] text-[#6f6a68] sm:block">
                  {formatDate(doc.$updatedAt || doc.$createdAt)}
                </span>
                <span className="hidden items-center gap-1.5 text-[13px] text-[#6f6a68] sm:flex">
                  <Users className="size-3.5" />
                  只有你
                </span>
                <RowActions doc={doc} tone="light" {...handlers} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
