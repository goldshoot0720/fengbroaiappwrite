"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  FolderOpen,
  ImageIcon,
  Link2,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import { Button } from "@/components/ui/button";
import { getExportFilename } from "@/lib/utils";
import { loadJSZip } from "@/lib/loadJSZip";
import {
  IMAGE_CONVERT_ACCEPT,
  convertImageFile,
  detectImageConvertKind,
  fetchImageAsFile,
  formatBytes,
  isConvertibleImageFile,
  kindLabel,
  renameWithTargetExtension,
  targetDisplayName,
  uniqueOutputName,
  type ImageConvertInputKind,
  type ImageConvertTarget,
} from "@/lib/imageFormatConvert";

const SOURCE_URL = "https://github.com/huang1988pioneer/PNGJPEGConverter";

type ItemStatus = "queued" | "converting" | "done" | "error";

type ConvertItem = {
  id: string;
  file: File;
  kind: ImageConvertInputKind;
  sourceLabel: string;
  previewUrl: string;
  status: ItemStatus;
  error?: string;
  resultBlob?: Blob;
  resultName?: string;
  resultUrl?: string;
  width?: number;
  height?: number;
};

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default function ImageFormatConvertTool() {
  const [items, setItems] = useState<ConvertItem[]>([]);
  const [target, setTarget] = useState<ImageConvertTarget>("jpg");
  /** Match desktop app default: 100% */
  const [quality, setQuality] = useState(100);
  const [busy, setBusy] = useState(false);
  const [urlBusy, setUrlBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [status, setStatus] = useState(
    "就緒 — 上傳圖片、選擇資料夾或貼上網址後開始轉換"
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Enable folder multi-select (non-standard attribute)
  useEffect(() => {
    const el = folderInputRef.current;
    if (!el) return;
    el.setAttribute("webkitdirectory", "");
    el.setAttribute("directory", "");
  }, []);

  useEffect(() => {
    return () => {
      for (const item of itemsRef.current) {
        URL.revokeObjectURL(item.previewUrl);
        if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
      }
    };
  }, []);

  const selected = useMemo(() => {
    if (!items.length) return null;
    if (selectedId) {
      const found = items.find((i) => i.id === selectedId);
      if (found) return found;
    }
    return items[0];
  }, [items, selectedId]);

  const stats = useMemo(() => {
    const done = items.filter((i) => i.status === "done").length;
    const failed = items.filter((i) => i.status === "error").length;
    const totalIn = items.reduce((s, i) => s + i.file.size, 0);
    const totalOut = items.reduce((s, i) => s + (i.resultBlob?.size ?? 0), 0);
    return { done, failed, totalIn, totalOut, count: items.length };
  }, [items]);

  const addFiles = useCallback(
    (fileList: FileList | File[], sourceHint = "本機") => {
      const files = Array.from(fileList);
      const accepted: ConvertItem[] = [];
      let skipped = 0;
      const existingKeys = new Set(
        itemsRef.current.map((i) => `${i.file.name}::${i.file.size}::${i.file.lastModified}`)
      );

      for (const file of files) {
        if (!isConvertibleImageFile(file)) {
          skipped += 1;
          continue;
        }
        const key = `${file.name}::${file.size}::${file.lastModified}`;
        if (existingKeys.has(key)) {
          skipped += 1;
          continue;
        }
        existingKeys.add(key);
        const kind = detectImageConvertKind(file);
        accepted.push({
          id: newId(),
          file,
          kind,
          sourceLabel: sourceHint,
          previewUrl: URL.createObjectURL(file),
          status: "queued",
        });
      }

      if (accepted.length === 0) {
        setStatus(
          skipped > 0
            ? `沒有新增（略過 ${skipped} 個不支援、重複或非圖片檔）`
            : "沒有可轉換的檔案"
        );
        return;
      }

      setItems((prev) => {
        const next = [...prev, ...accepted];
        if (!selectedId) setSelectedId(accepted[0].id);
        return next;
      });
      setStatus(
        skipped > 0
          ? `已新增 ${accepted.length} 張，略過 ${skipped} 個`
          : `已新增 ${accepted.length} 張圖片`
      );
    },
    [selectedId]
  );

  const addUrl = useCallback(async () => {
    const url = imageUrl.trim();
    if (!url) {
      setStatus("請先輸入圖片網址");
      return;
    }
    if (itemsRef.current.some((i) => i.sourceLabel === `網址：${url}` || i.file.name === url)) {
      setStatus("這個網址已在清單中");
      return;
    }

    setUrlBusy(true);
    setStatus("正在下載圖片…");
    try {
      const file = await fetchImageAsFile(url, itemsRef.current.length + 1);
      const kind = detectImageConvertKind(file);
      const item: ConvertItem = {
        id: newId(),
        file,
        kind,
        sourceLabel: `網址：${file.name}`,
        previewUrl: URL.createObjectURL(file),
        status: "queued",
      };
      setItems((prev) => [...prev, item]);
      setSelectedId(item.id);
      setImageUrl("");
      setStatus(`已加入網址圖片：${file.name} · ${formatBytes(file.size)}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "無法加入網址圖片");
    } finally {
      setUrlBusy(false);
    }
  }, [imageUrl]);

  const clearAll = useCallback(() => {
    setItems((prev) => {
      for (const item of prev) {
        URL.revokeObjectURL(item.previewUrl);
        if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
      }
      return [];
    });
    setSelectedId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (folderInputRef.current) folderInputRef.current.value = "";
    setStatus("已清空佇列");
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const next: ConvertItem[] = [];
      for (const item of prev) {
        if (item.id === id) {
          URL.revokeObjectURL(item.previewUrl);
          if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
          continue;
        }
        next.push(item);
      }
      return next;
    });
    setSelectedId((cur) => (cur === id ? null : cur));
  }, []);

  const convertAll = useCallback(async () => {
    if (busy || items.length === 0) return;
    setBusy(true);
    setStatus("開始轉換…");

    setItems((prev) =>
      prev.map((item) => {
        if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
        return {
          ...item,
          status: "queued" as const,
          error: undefined,
          resultBlob: undefined,
          resultName: undefined,
          resultUrl: undefined,
          width: undefined,
          height: undefined,
        };
      })
    );

    const snapshot = items.map((i) => ({ id: i.id, file: i.file }));
    const usedNames = new Set<string>();
    let doneCount = 0;
    let failCount = 0;

    for (let index = 0; index < snapshot.length; index += 1) {
      const { id, file } = snapshot[index];
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: "converting" as const } : item
        )
      );
      setStatus(`正在轉換 ${index + 1} / ${snapshot.length}…`);

      try {
        const { blob, width, height } = await convertImageFile(file, {
          target,
          quality: quality / 100,
        });
        const desired = renameWithTargetExtension(file.name, target);
        const resultName = uniqueOutputName(desired, usedNames);
        const resultUrl = URL.createObjectURL(blob);
        doneCount += 1;
        setItems((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: "done" as const,
                  resultBlob: blob,
                  resultName,
                  resultUrl,
                  width,
                  height,
                  error: undefined,
                }
              : item
          )
        );
      } catch (err) {
        failCount += 1;
        const message = err instanceof Error ? err.message : "轉換失敗";
        setItems((prev) =>
          prev.map((item) =>
            item.id === id
              ? { ...item, status: "error" as const, error: message }
              : item
          )
        );
      }
    }

    setBusy(false);
    setStatus(
      failCount === 0
        ? `完成：已轉換 ${doneCount} 個檔案 → ${targetDisplayName(target)}`
        : `完成：成功 ${doneCount} 個，失敗 ${failCount} 個`
    );
  }, [busy, items, quality, target]);

  const downloadOne = useCallback((item: ConvertItem) => {
    if (!item.resultBlob || !item.resultName) return;
    downloadBlob(item.resultBlob, item.resultName);
  }, []);

  const downloadAllZip = useCallback(async () => {
    const ready = items.filter(
      (i) => i.status === "done" && i.resultBlob && i.resultName
    );
    if (ready.length === 0) {
      setStatus("尚無已轉換檔案可下載");
      return;
    }

    setStatus("打包 ZIP 中…");
    try {
      const JSZip = await loadJSZip();
      const zip = new JSZip();
      const usedNames = new Set<string>();

      for (const item of ready) {
        const name = uniqueOutputName(item.resultName!, usedNames);
        zip.file(name, item.resultBlob!);
      }

      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(blob, getExportFilename(`png-jpeg-${target}`, "zip"));
      setStatus(`已下載 ZIP（${ready.length} 張）`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "ZIP 打包失敗");
    }
  }, [items, target]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files?.length) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <DataCard className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
              <ImageIcon size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold">PNG / JPEG 批次轉換</h3>
              <p className="text-sm text-muted-foreground">
                批次選取圖片或貼上網址，轉成 JPEG 或 PNG。本機 Canvas 處理，不上傳伺服器。
              </p>
            </div>
          </div>
          <a
            href={SOURCE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 shrink-0 items-center gap-1 self-start rounded-full border border-[var(--line-soft)] px-2.5 text-[11px] font-medium text-[var(--muted-foreground)] transition-impeccable hover:bg-[color:var(--panel-soft)]"
          >
            <ExternalLink size={12} />
            參考專案
          </a>
        </div>

        {/* Drop zone */}
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onClick={() => fileInputRef.current?.click()}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            setDragging(false);
          }}
          onDrop={onDrop}
          className={
            dragging
              ? "flex min-h-[130px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sky-400 bg-sky-50/80 px-4 py-8 text-center dark:bg-sky-950/30"
              : "flex min-h-[130px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--line-soft)] bg-[color:var(--panel-soft)] px-4 py-8 text-center transition-impeccable hover:border-sky-300 hover:bg-sky-50/40 dark:hover:bg-sky-950/20"
          }
        >
          <Upload className="text-[var(--muted-foreground)]" size={28} />
          <p className="text-sm font-medium">拖放圖片到這裡，或點擊多選檔案</p>
          <p className="text-xs text-[var(--muted-foreground)]">
            支援 PNG、JPEG、WebP、GIF、BMP、AVIF 等（瀏覽器可解碼者）
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept={IMAGE_CONVERT_ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {/* File / folder actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy || urlBusy}
            onClick={() => fileInputRef.current?.click()}
            className="gap-1.5"
          >
            <Upload size={14} />
            選擇檔案
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy || urlBusy}
            onClick={() => folderInputRef.current?.click()}
            className="gap-1.5"
          >
            <FolderOpen size={14} />
            選擇資料夾
          </Button>
          <input
            ref={folderInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files, "資料夾");
              e.target.value = "";
            }}
          />
          <span className="text-[11px] text-[var(--muted-foreground)]">
            資料夾會掃入瀏覽器可讀取的圖片（含子路徑時依瀏覽器行為）
          </span>
        </div>

        {/* URL input */}
        <div className="space-y-2 rounded-2xl border border-[var(--line-soft)] bg-[color:var(--panel-soft)] p-4">
          <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)]">
            <Link2 size={12} />
            圖片網址
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="url"
              value={imageUrl}
              disabled={busy || urlBusy}
              placeholder="https://… 直接圖片連結"
              onChange={(e) => setImageUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addUrl();
                }
              }}
              className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--line-soft)] bg-background px-3 text-sm"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || urlBusy || !imageUrl.trim()}
              onClick={() => void addUrl()}
              className="gap-1.5 sm:h-9"
            >
              {urlBusy ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Link2 size={14} />
              )}
              加入網址
            </Button>
          </div>
          <p className="text-[11px] text-[var(--muted-foreground)]">
            需為圖片直接連結；經伺服器 proxy 下載後在本機轉換。部分站台可能擋抓取。
          </p>
        </div>

        {/* Options */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-medium text-[var(--muted-foreground)]">
              輸出格式
            </label>
            <div className="flex gap-2">
              {(
                [
                  { value: "jpg" as const, label: "轉成 JPEG" },
                  { value: "png" as const, label: "轉成 PNG" },
                ] as const
              ).map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  size="sm"
                  variant={target === opt.value ? "default" : "outline"}
                  disabled={busy}
                  onClick={() => setTarget(opt.value)}
                  className="flex-1"
                >
                  {opt.label}
                </Button>
              ))}
            </div>
            {target === "jpg" ? (
              <p className="text-[11px] text-[var(--muted-foreground)]">
                透明區域以白底合成後輸出，避免黑底
              </p>
            ) : (
              <p className="text-[11px] text-[var(--muted-foreground)]">
                PNG 保留透明度
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="flex items-center justify-between text-xs font-medium text-[var(--muted-foreground)]">
              <span>{target === "jpg" ? "JPEG 品質" : "PNG 輸出"}</span>
              <span className="tabular-nums">
                {target === "jpg" ? `${quality}%` : "PNG"}
              </span>
            </label>
            <input
              type="range"
              min={1}
              max={100}
              step={1}
              value={quality}
              disabled={busy || target !== "jpg"}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="w-full accent-[var(--accent)] disabled:opacity-40"
            />
            <p className="text-[11px] text-[var(--muted-foreground)]">
              僅 JPEG 生效；預設 100%（與桌面版一致）
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => void convertAll()}
            disabled={busy || urlBusy || items.length === 0}
            className="gap-1.5"
          >
            {busy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
            {busy
              ? "轉換中…"
              : `全部轉換成 ${targetDisplayName(target)}（${items.length}）`}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void downloadAllZip()}
            disabled={busy || stats.done === 0}
            className="gap-1.5"
          >
            <Download size={16} />
            下載 ZIP
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={clearAll}
            disabled={busy || urlBusy || items.length === 0}
            className="gap-1.5"
          >
            <Trash2 size={16} />
            清空
          </Button>
        </div>

        <p className="whitespace-pre-wrap text-sm text-[var(--muted-foreground)]">
          {status}
        </p>

        {stats.count > 0 ? (
          <div className="flex flex-wrap gap-3 text-xs text-[var(--muted-foreground)]">
            <span>佇列 {stats.count}</span>
            <span>成功 {stats.done}</span>
            <span>失敗 {stats.failed}</span>
            <span>
              原始 {formatBytes(stats.totalIn)}
              {stats.done > 0 ? ` → 輸出 ${formatBytes(stats.totalOut)}` : ""}
            </span>
          </div>
        ) : null}
      </DataCard>

      {/* Preview + list */}
      {items.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,280px)_1fr]">
          <DataCard className="space-y-3 p-4 sm:p-5">
            <h4 className="text-sm font-semibold">來源預覽</h4>
            {selected ? (
              <>
                <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-[color:var(--panel-soft)] ring-1 ring-[var(--line-soft)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selected.resultUrl || selected.previewUrl}
                    alt=""
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <p className="truncate text-xs font-medium">{selected.file.name}</p>
                <p className="text-[11px] text-[var(--muted-foreground)]">
                  {kindLabel(selected.kind)} · {formatBytes(selected.file.size)}
                  {selected.width && selected.height
                    ? ` · ${selected.width} × ${selected.height} px`
                    : ""}
                </p>
                <p className="text-[11px] text-[var(--muted-foreground)]">
                  {selected.sourceLabel}
                </p>
              </>
            ) : (
              <p className="text-sm text-[var(--muted-foreground)]">等待選取圖片</p>
            )}
          </DataCard>

          <DataCard className="overflow-hidden p-0">
            <div className="border-b border-[var(--line-soft)] px-4 py-3 sm:px-5">
              <h4 className="text-sm font-semibold">轉換清單</h4>
              <p className="text-xs text-[var(--muted-foreground)]">
                已加入 {items.length} 張 · 點列可預覽 · 同名輸出自動流水號
              </p>
            </div>
            <ul className="divide-y divide-[var(--line-soft)]">
              {items.map((item) => {
                const isActive = selected?.id === item.id;
                return (
                  <li
                    key={item.id}
                    className={
                      isActive
                        ? "bg-sky-50/60 dark:bg-sky-950/20"
                        : undefined
                    }
                  >
                    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        onClick={() => setSelectedId(item.id)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.resultUrl || item.previewUrl}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-[var(--line-soft)]"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {item.file.name}
                          </p>
                          <p className="text-xs text-[var(--muted-foreground)]">
                            {kindLabel(item.kind)} · {formatBytes(item.file.size)}
                            {item.resultBlob && item.resultName
                              ? ` → ${item.resultName} · ${formatBytes(item.resultBlob.size)}`
                              : ""}
                          </p>
                          {item.error ? (
                            <p className="text-xs text-red-600 dark:text-red-400">
                              {item.error}
                            </p>
                          ) : null}
                        </div>
                      </button>

                      <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                        <StatusBadge status={item.status} />
                        {item.status === "done" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1 px-2.5"
                            onClick={() => downloadOne(item)}
                          >
                            <Download size={14} />
                            下載
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          className="h-8 w-8 p-0 text-[var(--muted-foreground)]"
                          onClick={() => removeItem(item.id)}
                          aria-label={`移除 ${item.file.name}`}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </DataCard>
        </div>
      ) : null}

      <p className="px-1 text-[11px] leading-relaxed text-[var(--muted-foreground)]">
        功能參考{" "}
        <a
          href={SOURCE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          huang1988pioneer/PNGJPEGConverter
        </a>
        （Avalonia 桌面版）。網頁版以 Canvas 解碼，HEIC / 部分 TIFF
        可能無法在瀏覽器開啟；桌面版可透過 ImageMagick 支援更多格式。
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: ItemStatus }) {
  if (status === "queued") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--panel-soft)] px-2 py-0.5 text-[11px] text-[var(--muted-foreground)]">
        待命
      </span>
    );
  }
  if (status === "converting") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
        <Loader2 size={12} className="animate-spin" />
        轉換中
      </span>
    );
  }
  if (status === "done") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
        <CheckCircle2 size={12} />
        完成
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] text-red-700 dark:bg-red-950/40 dark:text-red-300">
      <XCircle size={12} />
      失敗
    </span>
  );
}
