"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Download,
  ImageIcon,
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
  convertImageFile,
  detectImageConvertKind,
  formatBytes,
  isConvertibleImageFile,
  renameWithTargetExtension,
  type ImageConvertTarget,
} from "@/lib/imageFormatConvert";

type ItemStatus = "queued" | "converting" | "done" | "error";

type ConvertItem = {
  id: string;
  file: File;
  kind: "png" | "jpg";
  previewUrl: string;
  status: ItemStatus;
  error?: string;
  resultBlob?: Blob;
  resultName?: string;
  resultUrl?: string;
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
  // Delay revoke so the browser can start the download
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default function ImageFormatConvertTool() {
  const [items, setItems] = useState<ConvertItem[]>([]);
  const [target, setTarget] = useState<ImageConvertTarget>("jpg");
  const [quality, setQuality] = useState(92);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState("就緒 — 上傳一連串 PNG / JPG 後開始轉換");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      for (const item of itemsRef.current) {
        URL.revokeObjectURL(item.previewUrl);
        if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
      }
    };
  }, []);

  const stats = useMemo(() => {
    const done = items.filter((i) => i.status === "done").length;
    const failed = items.filter((i) => i.status === "error").length;
    const totalIn = items.reduce((s, i) => s + i.file.size, 0);
    const totalOut = items.reduce((s, i) => s + (i.resultBlob?.size ?? 0), 0);
    return { done, failed, totalIn, totalOut, count: items.length };
  }, [items]);

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    const accepted: ConvertItem[] = [];
    let skipped = 0;

    for (const file of files) {
      if (!isConvertibleImageFile(file)) {
        skipped += 1;
        continue;
      }
      const kind = detectImageConvertKind(file);
      if (kind === "other") {
        skipped += 1;
        continue;
      }
      accepted.push({
        id: newId(),
        file,
        kind,
        previewUrl: URL.createObjectURL(file),
        status: "queued",
      });
    }

    if (accepted.length === 0) {
      setStatus(
        skipped > 0
          ? `已略過 ${skipped} 個非 PNG/JPG 檔案`
          : "沒有可轉換的檔案"
      );
      return;
    }

    setItems((prev) => [...prev, ...accepted]);
    setStatus(
      skipped > 0
        ? `已加入 ${accepted.length} 張，略過 ${skipped} 個非 PNG/JPG`
        : `已加入 ${accepted.length} 張圖片`
    );
  }, []);

  const clearAll = useCallback(() => {
    setItems((prev) => {
      for (const item of prev) {
        URL.revokeObjectURL(item.previewUrl);
        if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
      }
      return [];
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
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
  }, []);

  const convertAll = useCallback(async () => {
    if (busy || items.length === 0) return;
    setBusy(true);
    setStatus("開始轉換…");

    // Reset previous results for re-convert with new target/quality
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
        };
      })
    );

    // Read fresh list after reset: use items snapshot + target
    const snapshot = items.map((i) => ({ id: i.id, file: i.file }));
    let doneCount = 0;
    let failCount = 0;

    for (let index = 0; index < snapshot.length; index += 1) {
      const { id, file } = snapshot[index];
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: "converting" as const } : item
        )
      );
      setStatus(`轉換中 ${index + 1} / ${snapshot.length}…`);

      try {
        const blob = await convertImageFile(file, {
          target,
          quality: quality / 100,
        });
        const resultName = renameWithTargetExtension(file.name, target);
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
        ? `完成：成功 ${doneCount} 張 → ${target.toUpperCase()}`
        : `完成：成功 ${doneCount}、失敗 ${failCount}`
    );
  }, [busy, items, quality, target]);

  const downloadOne = useCallback((item: ConvertItem) => {
    if (!item.resultBlob || !item.resultName) return;
    downloadBlob(item.resultBlob, item.resultName);
  }, []);

  const downloadAllZip = useCallback(async () => {
    const ready = items.filter((i) => i.status === "done" && i.resultBlob && i.resultName);
    if (ready.length === 0) {
      setStatus("尚無已轉換檔案可下載");
      return;
    }

    setStatus("打包 ZIP 中…");
    try {
      const JSZip = await loadJSZip();
      const zip = new JSZip();
      const usedNames = new Map<string, number>();

      for (const item of ready) {
        let name = item.resultName!;
        const count = usedNames.get(name) ?? 0;
        if (count > 0) {
          const dot = name.lastIndexOf(".");
          const base = dot >= 0 ? name.slice(0, dot) : name;
          const ext = dot >= 0 ? name.slice(dot) : "";
          name = `${base}-${count + 1}${ext}`;
        }
        usedNames.set(item.resultName!, count + 1);
        zip.file(name, item.resultBlob!);
      }

      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(blob, getExportFilename(`png-jpg-${target}`, "zip"));
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
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
            <ImageIcon size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold">PNG / JPG 批次轉換</h3>
            <p className="text-sm text-muted-foreground">
              上傳一連串 PNG 或 JPG，一次轉成 JPG 或 PNG。純瀏覽器處理，不上傳伺服器。
            </p>
          </div>
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
              ? "flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sky-400 bg-sky-50/80 px-4 py-8 text-center transition-impeccable dark:bg-sky-950/30"
              : "flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--line-soft)] bg-[color:var(--panel-soft)] px-4 py-8 text-center transition-impeccable hover:border-sky-300 hover:bg-sky-50/40 dark:hover:bg-sky-950/20"
          }
        >
          <Upload className="text-[var(--muted-foreground)]" size={28} />
          <p className="text-sm font-medium">拖放 PNG / JPG 到這裡，或點擊選擇</p>
          <p className="text-xs text-[var(--muted-foreground)]">支援一次多檔；可重複加入</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,.png,.jpg,.jpeg"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
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
                  { value: "jpg" as const, label: "轉成 JPG" },
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
                透明背景會以白色填滿
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="flex items-center justify-between text-xs font-medium text-[var(--muted-foreground)]">
              <span>JPG 品質</span>
              <span className="tabular-nums">{quality}%</span>
            </label>
            <input
              type="range"
              min={10}
              max={100}
              step={1}
              value={quality}
              disabled={busy || target !== "jpg"}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="w-full accent-[var(--accent)] disabled:opacity-40"
            />
            <p className="text-[11px] text-[var(--muted-foreground)]">
              僅 JPG 輸出時生效；數值愈高檔案愈大
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => void convertAll()}
            disabled={busy || items.length === 0}
            className="gap-1.5"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            {busy ? "轉換中…" : `全部轉換（${items.length}）`}
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
            disabled={busy || items.length === 0}
            className="gap-1.5"
          >
            <Trash2 size={16} />
            清空
          </Button>
        </div>

        <p className="text-sm text-[var(--muted-foreground)]">{status}</p>

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

      {items.length > 0 ? (
        <DataCard className="overflow-hidden p-0">
          <div className="border-b border-[var(--line-soft)] px-4 py-3 sm:px-5">
            <h4 className="text-sm font-semibold">檔案清單</h4>
          </div>
          <ul className="divide-y divide-[var(--line-soft)]">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-5"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.resultUrl || item.previewUrl}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-[var(--line-soft)]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.file.name}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {item.kind.toUpperCase()} · {formatBytes(item.file.size)}
                      {item.resultBlob && item.resultName
                        ? ` → ${item.resultName} · ${formatBytes(item.resultBlob.size)}`
                        : ""}
                    </p>
                    {item.error ? (
                      <p className="text-xs text-red-600 dark:text-red-400">{item.error}</p>
                    ) : null}
                  </div>
                </div>

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
              </li>
            ))}
          </ul>
        </DataCard>
      ) : null}
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
