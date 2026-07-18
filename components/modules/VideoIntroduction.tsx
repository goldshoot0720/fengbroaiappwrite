"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { Play, Download, CheckCircle, AlertCircle, Loader, Trash2, HardDrive, Plus, Edit, X, Upload, Search, ListPlus, FolderUp, Monitor, Tv, ChevronDown, ChevronUp, AlertTriangle, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import SimpleVideoPlayer from "@/components/ui/simple-video-player";
import { useVideoCache } from "@/hooks/useVideoCache";
import { useVideos, VideoData } from "@/hooks/useVideos";
import { DataCard } from "@/components/ui/data-card";
import { SimpleStatCard, StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FullPageLoading, LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { VideoItem } from "@/types";
import { API_ENDPOINTS } from "@/lib/constants";
import { formatFileSize as formatStoredFileSize, formatLocalDate } from "@/lib/formatters";
import { getAppwriteHeaders, getMultipartVideoPlaybackUrl, getMultipartVideoDownloadUrl, getProxiedMediaUrl, getProxiedMediaDownloadUrl, getExportFilename } from "@/lib/utils";
import { uploadToAppwriteStorage } from "@/lib/appwriteStorage";
import { MAX_VIDEO_PART_SIZE, getOriginalVideoFiletype, getVideoDownloadFilename, isMultipartVideoFiletype, resolveVideoBlob, uploadVideoInParts } from "@/lib/videoMultipart";
import { useVideoQueue, VideoQueueItem } from "@/hooks/useVideoQueue";
import { loadJSZip } from "@/lib/loadJSZip";
import { FriendlyAiCrudShell } from "@/components/ui/friendly-ai-crud-shell";

const PlyrPlayer = dynamic(
  () => import("@/components/ui/plyr-player").then((m) => m.PlyrPlayer),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[120px] items-center justify-center">
        <LoadingSpinner />
      </div>
    ),
  }
);

// Helper function to add Appwrite config to URL
function addAppwriteConfigToUrl(url: string): string {
  if (typeof window === 'undefined') return url;

  const endpoint = localStorage.getItem('NEXT_PUBLIC_APPWRITE_ENDPOINT');
  const projectId = localStorage.getItem('NEXT_PUBLIC_APPWRITE_PROJECT_ID');
  const databaseId = localStorage.getItem('APPWRITE_DATABASE_ID');
  const apiKey = localStorage.getItem('APPWRITE_API_KEY');
  const bucketId = localStorage.getItem('APPWRITE_BUCKET_ID');

  if (!endpoint && !projectId && !databaseId) {
    return url;
  }

  const separator = url.includes('?') ? '&' : '?';
  const params = new URLSearchParams();

  if (endpoint) params.set('_endpoint', endpoint);
  if (projectId) params.set('_project', projectId);
  if (databaseId) params.set('_database', databaseId);
  if (apiKey) params.set('_key', apiKey);
  if (bucketId) params.set('_bucket', bucketId);

  const paramString = params.toString();
  return paramString ? `${url}${separator}${paramString}` : url;
}

function getVideoDuplicateKey(video: Pick<VideoData, "hash" | "file">): string | null {
  const hash = video.hash?.trim();
  if (hash) return `hash:${hash}`;

  const file = video.file?.trim();
  if (file) return `file:${file}`;

  return null;
}

function getVideoFileSize(video: Pick<VideoData, "fileSize">): number {
  return typeof video.fileSize === "number" && Number.isFinite(video.fileSize) ? video.fileSize : 0;
}

function formatVideoFileSize(video: Pick<VideoData, "fileSize">): string {
  const size = getVideoFileSize(video);
  return size > 0 ? formatStoredFileSize(size) : "--";
}

type VideoUploadProgressStatus = 'pending' | 'uploading' | 'success' | 'error';

type VideoUploadProgressItem = {
  key: string;
  name: string;
  size: number;
  progress: number;
  status: VideoUploadProgressStatus;
  message?: string;
};

function getSelectedVideoUploadKey(file: File, hash: string): string {
  return `${hash || file.name}-${file.size}-${file.lastModified}`;
}

function createUploadProgressItem(file: File, hash: string, name?: string): VideoUploadProgressItem {
  return {
    key: getSelectedVideoUploadKey(file, hash),
    name: name || file.name,
    size: file.size,
    progress: 0,
    status: 'pending',
  };
}

function formatVideoUploadSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size >= 10 || unitIndex === 0 ? Math.round(size) : size.toFixed(1)} ${units[unitIndex]}`;
}

function VideoUploadProgressList({ items }: { items: VideoUploadProgressItem[] }) {
  if (items.length === 0) return null;

  const statusLabel: Record<VideoUploadProgressStatus, string> = {
    pending: '等待上傳',
    uploading: '上傳中',
    success: '完成',
    error: '失敗',
  };

  const getBarClassName = (status: VideoUploadProgressStatus) => {
    if (status === 'success') return 'bg-emerald-500';
    if (status === 'error') return 'bg-red-500';
    return 'bg-blue-600';
  };

  return (
    <div className="space-y-2 rounded-xl border border-blue-100 bg-blue-50/60 p-3 dark:border-blue-900/50 dark:bg-blue-950/20">
      <div className="flex items-center justify-between text-xs font-semibold text-blue-700 dark:text-blue-300">
        <span>影片上傳進度</span>
        <span>{items.filter((item) => item.status === 'success').length}/{items.length}</span>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.key} className="rounded-lg bg-white/80 p-2 shadow-sm dark:bg-gray-900/40">
            <div className="mb-1 flex items-start justify-between gap-3 text-xs">
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-800 dark:text-gray-100">{item.name}</p>
                <p className="text-gray-500 dark:text-gray-400">{formatVideoUploadSize(item.size)}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold text-gray-700 dark:text-gray-200">{Math.round(item.progress)}%</p>
                <p className={item.status === 'error' ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}>
                  {item.message || statusLabel[item.status]}
                </p>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${getBarClassName(item.status)}`}
                style={{ width: `${Math.min(100, Math.max(0, item.progress))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function useResolvedVideoSource(video: VideoData) {
  const [resolvedSrc, setResolvedSrc] = useState("");
  const [loadingSource, setLoadingSource] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    let objectUrl = "";
    const resolveSource = async () => {
      if (!video.file) {
        setResolvedSrc("");
        setLoadingSource(false);
        setSourceError(null);
        return;
      }

      if (!isMultipartVideoFiletype(video.filetype)) {
        setResolvedSrc(getProxiedMediaUrl(video.file));
        setLoadingSource(false);
        setSourceError(null);
        return;
      }

      setLoadingSource(true);
      setSourceError(null);

      try {
        if (isMultipartVideoFiletype(video.filetype)) {
          if (isActive) {
            setResolvedSrc(getMultipartVideoPlaybackUrl(video.file));
            setLoadingSource(false);
          }
          return;
        }

        const { blob } = await resolveVideoBlob({
          file: video.file,
          filetype: video.filetype,
          name: video.name,
        });

        objectUrl = URL.createObjectURL(blob);
        if (isActive) {
          setResolvedSrc(objectUrl);
        }
      } catch (error) {
        if (isActive) {
          setResolvedSrc("");
          setSourceError(error instanceof Error ? error.message : "影片來源解析失敗");
        }
      } finally {
        if (isActive) {
          setLoadingSource(false);
        }
      }
    };

    void resolveSource();

    return () => {
      isActive = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [video.$id, video.file, video.filetype, video.name]);

  return { resolvedSrc, loadingSource, sourceError };
}

async function downloadVideoToBrowser(video: VideoData): Promise<void> {
  if (!video.file) {
    throw new Error("此影片沒有可下載的檔案");
  }

  const fileName = getVideoDownloadFilename({
    file: video.file,
    filetype: video.filetype,
    name: video.name,
  });
  const link = document.createElement("a");
  link.href = isMultipartVideoFiletype(video.filetype)
    ? getMultipartVideoDownloadUrl(video.file, fileName)
    : getProxiedMediaDownloadUrl(video.file, fileName);
  link.download = fileName;
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}



export default function VideoIntroduction() {
  const { videos, loading, error, stats, loadVideos } = useVideos();
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingVideo, setEditingVideo] = useState<VideoData | null>(null);
  const [isInlineCreating, setIsInlineCreating] = useState(false);
  const [currentVideo, setCurrentVideo] = useState<string | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [workbenchMode, setWorkbenchMode] = useState<"all" | "withFile" | "missingCover" | "multipart" | "duplicates">("all");
  const [sortMode, setSortMode] = useState<"createdDesc" | "fileSizeDesc">("createdDesc");
  const [viewMode, setViewMode] = useState<'youtube' | 'bilibili' | 'netflix'>('netflix');
  const [viewModeHydrated, setViewModeHydrated] = useState(false);
  const [importPreview, setImportPreview] = useState<{ data: VideoFormData[]; errors: string[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [exportingZip, setExportingZip] = useState(false);
  const [exportZipProgress, setExportZipProgress] = useState({ current: 0, total: 0, status: '', success: 0, failed: 0 });
  const [exportZipDebugMessages, setExportZipDebugMessages] = useState<string[]>([]);
  const [importingZip, setImportingZip] = useState(false);
  const [importZipProgress, setImportZipProgress] = useState({ current: 0, total: 0, status: '', success: 0, failed: 0 });
  const [importZipDebugMessages, setImportZipDebugMessages] = useState<string[]>([]);
  const importZipInputRef = useRef<HTMLInputElement>(null);

  // Inline editing state
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineEditForm, setInlineEditForm] = useState({
    name: '',
    category: '',
    note: '',
    ref: '',
    cover: '',
    file: '',
    filetype: '',
    hash: '',
  });
  const [inlineVideoFile, setInlineVideoFile] = useState<File | null>(null);
  const [inlineVideoPreviewName, setInlineVideoPreviewName] = useState('');
  const [inlineVideoUploading, setInlineVideoUploading] = useState(false);
  const [inlineVideoUploadProgress, setInlineVideoUploadProgress] = useState(0);
  const [inlineVideoDuplicateWarning, setInlineVideoDuplicateWarning] = useState('');
  const [inlineCoverFile, setInlineCoverFile] = useState<File | null>(null);
  const [inlineCoverPreview, setInlineCoverPreview] = useState<string>('');
  const [inlineCoverUploading, setInlineCoverUploading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const { addToQueue, isInQueue, handoffPlayback } = useVideoQueue();

  // 接下來播放 - 加入佇列
  const handleAddToQueue = useCallback((video: VideoData) => {
    if (!video.file) {
      alert('此影片尚未上傳影片檔案');
      return;
    }
    const queueItem: VideoQueueItem = {
      id: video.$id,
      name: video.name,
      category: video.category || '',
      file: isMultipartVideoFiletype(video.filetype)
        ? getMultipartVideoPlaybackUrl(video.file)
        : getProxiedMediaUrl(video.file),
      cover: typeof video.cover === 'string' ? video.cover : '',
    };
    const added = addToQueue(queueItem);
    if (!added) {
      alert('此影片已在播放佇列中');
    }
  }, [addToQueue]);

  const handlePersistVideoPlayback = useCallback((video: VideoData, playback: {
    src: string;
    currentTime: number;
    volume: number;
    playbackRate: number;
    loop: boolean;
    muted: boolean;
  }) => {
    handoffPlayback({
      id: video.$id,
      name: video.name,
      category: video.category || '',
      file: playback.src,
      cover: typeof video.cover === 'string' ? video.cover : '',
      startTime: playback.currentTime,
      volume: playback.volume,
      playbackRate: playback.playbackRate,
      loop: playback.loop,
      muted: playback.muted,
      playbackKey: `${video.$id}:${Date.now()}`,
    });
  }, [handoffPlayback]);

  // CSV 匹出/匯入
  const CSV_HEADERS = ['name', 'category', 'note', 'ref'];
  const EXPECTED_COLUMN_COUNT = CSV_HEADERS.length;

  interface VideoFormData {
    name: string;
    category: string;
    note: string;
    ref: string;
  }

  const exportToCSV = () => {
    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`;
      return str;
    };
    const rows = [CSV_HEADERS.join(',')];
    videos.forEach(item => {
      rows.push([
        escapeCSV(item.name),
        escapeCSV(item.category || ''),
        escapeCSV(item.note || ''),
        escapeCSV(item.ref || '')
      ].join(','));
    });
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = getExportFilename('video');
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const parseCSV = (text: string): { data: VideoFormData[]; errors: string[] } => {
    const errors: string[] = [];
    const data: VideoFormData[] = [];
    const cleanText = text.replace(/^\uFEFF/, '');
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < cleanText.length; i++) {
      const char = cleanText[i];
      const nextChar = cleanText[i + 1];
      if (inQuotes) {
        if (char === '"') {
          if (nextChar === '"') { currentField += '"'; i++; }
          else { inQuotes = false; }
        } else { currentField += char; }
      } else {
        if (char === '"') { inQuotes = true; }
        else if (char === ',') { currentRow.push(currentField); currentField = ''; }
        else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
          currentRow.push(currentField); currentField = '';
          if (currentRow.length > 0 && currentRow.some(f => f.trim())) { rows.push(currentRow); }
          currentRow = [];
          if (char === '\r') i++;
        } else if (char !== '\r') { currentField += char; }
      }
    }
    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField);
      if (currentRow.some(f => f.trim())) { rows.push(currentRow); }
    }

    if (rows.length < 2) { errors.push('CSV 檔案至少需要表頭和一行資料'); return { data, errors }; }
    const headerValues = rows[0];
    if (headerValues.length !== EXPECTED_COLUMN_COUNT) {
      errors.push(`表頭欄位數量錯誤: 預期 ${EXPECTED_COLUMN_COUNT} 欄，實際 ${headerValues.length} 欄`);
      return { data, errors };
    }
    for (let i = 0; i < CSV_HEADERS.length; i++) {
      if (headerValues[i]?.trim() !== CSV_HEADERS[i]) {
        errors.push(`表頭第 ${i + 1} 欄錯誤: 預期 "${CSV_HEADERS[i]}"，實際 "${headerValues[i]?.trim()}"`);
      }
    }
    if (errors.length > 0) return { data, errors };

    for (let i = 1; i < rows.length; i++) {
      const values = rows[i];
      if (values.length !== EXPECTED_COLUMN_COUNT) { errors.push(`第 ${i + 1} 行: 欄位數量錯誤`); continue; }
      if (!values[0]?.trim()) { errors.push(`第 ${i + 1} 行: name 欄位不能為空`); continue; }
      data.push({ name: values[0].trim(), category: values[1]?.trim() || '', note: values[2]?.trim() || '', ref: values[3]?.trim() || '' });
    }
    return { data, errors };
  };

  const handleCsvFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) { alert('請選擇 CSV 檔案'); return; }
    const reader = new FileReader();
    reader.onload = (event) => { setImportPreview(parseCSV(event.target?.result as string)); };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const executeImport = async () => {
    if (!importPreview || importPreview.data.length === 0) return;

    setImporting(true);
    setImportProgress({ current: 0, total: importPreview.data.length });

    let successCount = 0, failCount = 0;
    for (let i = 0; i < importPreview.data.length; i++) {
      const formData = importPreview.data[i];
      setImportProgress({ current: i + 1, total: importPreview.data.length });
      try {
        const existing = videos.find(v => v.name === formData.name);
        const apiUrl = existing
          ? addAppwriteConfigToUrl(`${API_ENDPOINTS.VIDEO}/${existing.$id}`)
          : addAppwriteConfigToUrl(API_ENDPOINTS.VIDEO);
        const method = existing ? 'PUT' : 'POST';
        const submitData = {
          name: formData.name, category: formData.category, note: formData.note, ref: formData.ref,
          ...(existing && { file: existing.file, cover: existing.cover, hash: existing.hash }),
          ...(!existing && { file: '', cover: '', hash: `csv_import_${Date.now()}_${Math.random().toString(36).substring(7)}` })
        };
        const response = await fetch(apiUrl, { method, headers: { 'Content-Type': 'application/json', ...getAppwriteHeaders() }, body: JSON.stringify(submitData) });
        if (response.ok) { successCount++; } else { failCount++; }
      } catch { failCount++; }
    }

    // 匯入完成後統一重新載入一次
    await loadVideos(true);

    setImporting(false);
    setImportProgress({ current: 0, total: 0 });
    setImportPreview(null);
    alert(`匯入完成！\n成功: ${successCount} 筆\n失敗: ${failCount} 筆`);
  };

  const appendExportZipDebug = (message: string) => {
    console.log(`[Video export] ${message}`);
    setExportZipDebugMessages((prev) => [...prev.slice(-79), message]);
  };

  const appendImportZipDebug = (message: string) => {
    console.log(`[Video import] ${message}`);
    setImportZipDebugMessages((prev) => [...prev.slice(-79), message]);
  };

  // ZIP 匯出（含影片、封面圖、CSV 元資料）
  const handleExportZip = async () => {
    if (videos.length === 0) { alert('沒有影片可以匯出'); return; }
    if (exportingZip) return;

    const confirm = window.confirm(`準備匯出 ${videos.length} 部影片至 ZIP 檔案（含封面圖和元資料），是否繼續？`);
    if (!confirm) return;

    setExportingZip(true);
    setExportZipDebugMessages([]);
    setExportZipProgress({ current: 0, total: videos.length, status: '準備中...', success: 0, failed: 0 });
    appendExportZipDebug(`開始匯出，共 ${videos.length} 部影片。`);

    try {
      const zip = new (await loadJSZip())();
      zip.folder('videos');
      zip.folder('covers');

      const csvRows: string[][] = [];
      const csvHeaders = ['name', 'file', 'cover', 'filetype', 'category', 'note', 'ref', 'hash'];
      csvRows.push(csvHeaders);

      for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        const seq = String(i + 1).padStart(3, '0');
        const sanitizedName = video.name.replace(/[<>:"\/\\|?*]/g, '_');
        const baseName = `${seq}_${sanitizedName}`;

        setExportZipProgress((prev) => ({ ...prev, current: i + 1, total: videos.length, status: `正在處理: ${video.name}` }));
        appendExportZipDebug(`[${i + 1}/${videos.length}] 開始處理 ${video.name}`);

        // Detect video file extension
        let fileExtension = getOriginalVideoFiletype(video.filetype);

        // Download and add video file
        let videoPath = '';
        if (video.file) {
          try {
            const { blob, filetype } = await resolveVideoBlob({
              file: video.file,
              filetype: video.filetype,
              name: video.name,
            });
            fileExtension = filetype || fileExtension;
            videoPath = `videos/${baseName}.${fileExtension}`;
            zip.file(videoPath, blob);
            setExportZipProgress((prev) => ({ ...prev, success: prev.success + 1 }));
            appendExportZipDebug(`[${i + 1}/${videos.length}] 影片成功 ${video.name} -> ${videoPath}`);
          } catch (err) {
            console.error(`下載影片 ${video.name} 時出錯:`, err);
            setExportZipProgress((prev) => ({ ...prev, failed: prev.failed + 1 }));
            appendExportZipDebug(`[${i + 1}/${videos.length}] 影片失敗 ${video.name}: ${err instanceof Error ? err.message : '未知錯誤'}`);
          }
        } else {
          setExportZipProgress((prev) => ({ ...prev, failed: prev.failed + 1 }));
          appendExportZipDebug(`[${i + 1}/${videos.length}] 跳過影片檔 ${video.name}，沒有檔案網址。`);
        }

        // Download and add cover image
        let coverPath = '';
        if (video.cover) {
          try {
            const coverProxyUrl = getProxiedMediaUrl(video.cover);
            const coverResponse = await fetch(coverProxyUrl);
            if (coverResponse.ok) {
              const coverBlob = await coverResponse.blob();
              let imgExt = 'png';
              const contentType = coverResponse.headers.get('content-type') || '';
              if (contentType.includes('jpeg') || contentType.includes('jpg')) imgExt = 'jpg';
              else if (contentType.includes('webp')) imgExt = 'webp';
              else if (contentType.includes('gif')) imgExt = 'gif';
              coverPath = `covers/${baseName}.${imgExt}`;
              zip.file(coverPath, coverBlob);
              appendExportZipDebug(`[${i + 1}/${videos.length}] 封面成功 ${video.name} -> ${coverPath}`);
            } else {
              setExportZipProgress((prev) => ({ ...prev, failed: prev.failed + 1 }));
              appendExportZipDebug(`[${i + 1}/${videos.length}] 封面失敗 ${video.name}，HTTP ${coverResponse.status}`);
            }
          } catch (err) {
            console.error(`下載封面 ${video.name} 時出錯:`, err);
            setExportZipProgress((prev) => ({ ...prev, failed: prev.failed + 1 }));
            appendExportZipDebug(`[${i + 1}/${videos.length}] 封面例外 ${video.name}: ${err instanceof Error ? err.message : '未知錯誤'}`);
          }
        } else {
          appendExportZipDebug(`[${i + 1}/${videos.length}] ${video.name} 沒有封面可匯出。`);
        }

        // Build CSV row
        const escapeCsv = (val: string) => {
          if (!val) return '';
          if (val.includes(',') || val.includes('"') || val.includes('\n')) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        };
        csvRows.push([
          escapeCsv(video.name || ''),
          escapeCsv(videoPath),
          escapeCsv(coverPath),
          escapeCsv(video.filetype || ''),
          escapeCsv(video.category || ''),
          escapeCsv(video.note || ''),
          escapeCsv(video.ref || ''),
          escapeCsv(video.hash || ''),
        ]);
      }

      // Generate CSV and add to ZIP
      const csvContent = csvRows.map(row => row.join(',')).join('\n');
      zip.file('video.csv', csvContent);

      setExportZipProgress((prev) => ({ ...prev, current: videos.length, total: videos.length, status: '正在壓縮...' }));
      appendExportZipDebug('所有影片處理完成，開始壓縮 ZIP。');

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = getExportFilename('video', 'zip');
      link.click();
      URL.revokeObjectURL(link.href);

      setExportZipProgress((prev) => ({ ...prev, current: videos.length, total: videos.length, status: '完成！' }));
      appendExportZipDebug('ZIP 產生完成，已開始下載。');
      window.setTimeout(() => {
        setExportingZip(false);
        setExportZipProgress({ current: 0, total: 0, status: '', success: 0, failed: 0 });
        setExportZipDebugMessages([]);
      }, 2200);
    } catch (error) {
      console.error('ZIP export error:', error);
      appendExportZipDebug(`匯出失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
      setExportZipProgress((prev) => ({ ...prev, status: '匯出失敗，請查看 debug 訊息。' }));
      alert('匯出失敗，請再試一次');
      window.setTimeout(() => {
        setExportingZip(false);
        setExportZipProgress({ current: 0, total: 0, status: '', success: 0, failed: 0 });
        setExportZipDebugMessages([]);
      }, 4000);
    }
  };

  // ZIP 匯入（支援新格式含 CSV 和舊格式純影片檔）
  const handleImportZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (importZipInputRef.current) {
      importZipInputRef.current.value = '';
    }

    if (!file.name.toLowerCase().endsWith('.zip')) {
      alert('請選擇 ZIP 檔案');
      return;
    }

    setImportingZip(true);
    setImportZipProgress({ current: 0, total: 0, status: '讀取 ZIP 檔案...', success: 0, failed: 0 });

    try {
      const zip = await (await loadJSZip()).loadAsync(file);

      // Check if this is a new-format ZIP with video.csv
      const csvFile = zip.files['video.csv'];
      if (csvFile) {
        // New format: parse CSV and restore full data
        const csvText = await csvFile.async('string');
        const lines = csvText.split('\n').filter(line => line.trim());
        if (lines.length < 2) { alert('CSV 檔案沒有資料'); setImportingZip(false); return; }

        // Parse CSV header and rows
        const parseCsvLine = (line: string): string[] => {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;
          for (let c = 0; c < line.length; c++) {
            const ch = line[c];
            if (inQuotes) {
              if (ch === '"' && line[c + 1] === '"') { current += '"'; c++; }
              else if (ch === '"') { inQuotes = false; }
              else { current += ch; }
            } else {
              if (ch === '"') { inQuotes = true; }
              else if (ch === ',') { result.push(current); current = ''; }
              else { current += ch; }
            }
          }
          result.push(current);
          return result;
        };

        const headers = parseCsvLine(lines[0]);
        const dataRows = lines.slice(1).map(line => {
          const values = parseCsvLine(line);
          const obj: Record<string, string> = {};
          headers.forEach((h, idx) => { obj[h] = values[idx] || ''; });
          return obj;
        });

        const total = dataRows.length;
        setImportZipProgress({ current: 0, total, status: `找到 ${total} 筆影片記錄`, success: 0, failed: 0 });
        let successCount = 0, failedCount = 0;

        for (let i = 0; i < dataRows.length; i++) {
          const row = dataRows[i];
          setImportZipProgress({ current: i + 1, total, status: `正在處理: ${row.name || '未知'}`, success: successCount, failed: failedCount });

          try {
            // Upload video file from ZIP
            let remoteFileUrl = '';
            let remoteFiletype = row.filetype || '';
            if (row.file && zip.files[row.file]) {
              const videoBlob = await zip.files[row.file].async('blob');
              const fileName = row.file.split('/').pop() || 'video.mp4';
              const videoFileObj = new File([videoBlob], fileName, { type: 'application/octet-stream' });
              const uploadResult: { url: string; fileId: string; filetype?: string } = videoFileObj.size > MAX_VIDEO_PART_SIZE
                ? await uploadVideoInParts(videoFileObj)
                : await uploadToAppwriteStorage(videoFileObj);
              remoteFileUrl = uploadResult.url;
              remoteFiletype = uploadResult.filetype || remoteFiletype;
            }

            // Upload cover image from ZIP
            let remoteCoverUrl = '';
            if (row.cover && zip.files[row.cover]) {
              const coverBlob = await zip.files[row.cover].async('blob');
              const coverName = row.cover.split('/').pop() || 'cover.png';
              const coverFileObj = new File([coverBlob], coverName, { type: 'application/octet-stream' });
              const coverUpload = await uploadToAppwriteStorage(coverFileObj);
              remoteCoverUrl = coverUpload.url;
            }

            // Check if record already exists (same name)
            const existing = videos.find(v => v.name === row.name);
            const apiUrl = existing
              ? addAppwriteConfigToUrl(`${API_ENDPOINTS.VIDEO}/${existing.$id}`)
              : addAppwriteConfigToUrl(API_ENDPOINTS.VIDEO);
            const method = existing ? 'PUT' : 'POST';

            const submitData: Record<string, string> = {
              name: row.name || '',
              file: remoteFileUrl || (existing ? existing.file : ''),
              cover: remoteCoverUrl || (existing ? (typeof existing.cover === 'string' ? existing.cover : '') : ''),
              filetype: remoteFiletype || row.filetype || '',
              category: row.category || '',
              note: row.note || '',
              ref: row.ref || '',
              hash: row.hash || (existing ? existing.hash : `zip_import_${Date.now()}_${Math.random().toString(36).substring(7)}`),
            };

            const response = await fetch(apiUrl, {
              method,
              headers: { 'Content-Type': 'application/json', ...getAppwriteHeaders() },
              body: JSON.stringify(submitData),
            });

            if (response.ok) successCount++; else failedCount++;
          } catch (err) { console.error(`處理 ${row.name} 時出錯:`, err); failedCount++; }
          setImportZipProgress({ current: i + 1, total, status: `正在處理: ${row.name || '未知'}`, success: successCount, failed: failedCount });
        }

        setImportZipProgress({ current: total, total, status: '完成', success: successCount, failed: failedCount });
        alert(`匯入完成！\n成功: ${successCount} 部\n失敗: ${failedCount} 部`);
        if (successCount > 0) loadVideos(true);

      } else {
        // Old format: import video files only (backward compatible)
        const videoFiles: { name: string; file: any }[] = [];
        const validExtensions = ['mp4', 'webm', 'ogg', 'mov'];

        zip.forEach((relativePath, zipEntry) => {
          if (!zipEntry.dir) {
            const ext = relativePath.split('.').pop()?.toLowerCase() || '';
            if (validExtensions.includes(ext)) {
              videoFiles.push({ name: relativePath, file: zipEntry });
            }
          }
        });

        if (videoFiles.length === 0) {
          alert('ZIP 檔案中沒有找到影片檔案 (MP4, WebM, OGG, MOV)');
          setImportingZip(false);
          return;
        }

        const confirmImport = window.confirm(`找到 ${videoFiles.length} 部影片，是否開始匯入？`);
        if (!confirmImport) {
          setImportingZip(false);
          return;
        }

        let successCount = 0;
        let failedCount = 0;

        for (let i = 0; i < videoFiles.length; i++) {
          const videoFile = videoFiles[i];
          const fileName = videoFile.name.split('/').pop() || videoFile.name;

          setImportZipProgress({
            current: i + 1,
            total: videoFiles.length,
            status: `正在處理: ${fileName}`,
            success: successCount,
            failed: failedCount
          });

          try {
            const arrayBuffer = await videoFile.file.async('arraybuffer');
            const ext = fileName.split('.').pop()?.toLowerCase() || 'mp4';
            const mimeType = ext === 'webm' ? 'video/webm' :
              ext === 'ogg' ? 'video/ogg' :
                ext === 'mov' ? 'video/quicktime' : 'video/mp4';
            const blob = new Blob([arrayBuffer], { type: mimeType });
            const videoFileObj = new File([blob], fileName, { type: mimeType });

            const uploadResult: { url: string; fileId: string; filetype?: string } = videoFileObj.size > MAX_VIDEO_PART_SIZE
              ? await uploadVideoInParts(videoFileObj, (progress) => {
                setImportZipProgress(prev => ({ ...prev, status: `分段上傳中: ${fileName} (${progress}%)` }));
              })
              : await uploadToAppwriteStorage(videoFileObj, (progress) => {
                setImportZipProgress(prev => ({ ...prev, status: `上傳中: ${fileName} (${progress}%)` }));
              });

            const createUrl = addAppwriteConfigToUrl(API_ENDPOINTS.VIDEO);
            const createResponse = await fetch(createUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: fileName,
                file: uploadResult.url,
                filetype: uploadResult.filetype || ext,
                note: '',
                ref: '',
                category: '',
                hash: '',
                cover: ''
              }),
            });

            if (!createResponse.ok) throw new Error(`HTTP ${createResponse.status}`);
            successCount++;
          } catch (error) {
            console.error(`[ZIP Import] Failed: ${fileName}`, error);
            failedCount++;
          }
        }

        setImportZipProgress({
          current: videoFiles.length,
          total: videoFiles.length,
          status: '完成',
          success: successCount,
          failed: failedCount
        });

        alert(`匯入完成！\n成功: ${successCount} 部\n失敗: ${failedCount} 部`);
        if (successCount > 0) loadVideos(true);
      }
    } catch (error) {
      console.error('ZIP import error:', error);
      alert('匯入失敗，請確認 ZIP 檔案格式正確');
    } finally {
      setImportingZip(false);
      setImportZipProgress({ current: 0, total: 0, status: '', success: 0, failed: 0 });
    }
  };

  // 搜尋過濾
  const handleImportZipWithDebug = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (importZipInputRef.current) {
      importZipInputRef.current.value = '';
    }

    if (!file.name.toLowerCase().endsWith('.zip')) {
      alert('隢??ZIP 瑼?');
      return;
    }

    const resetImportUi = () => {
      setImportingZip(false);
      setImportZipProgress({ current: 0, total: 0, status: '', success: 0, failed: 0 });
      setImportZipDebugMessages([]);
    };

    setImportingZip(true);
    setImportZipDebugMessages([]);
    setImportZipProgress({ current: 0, total: 0, status: '讀取 ZIP 中...', success: 0, failed: 0 });
    appendImportZipDebug(`開始匯入 ZIP：${file.name}`);

    try {
      const zip = await (await loadJSZip()).loadAsync(file);
      appendImportZipDebug('ZIP 讀取完成。');

      const csvFile = zip.files['video.csv'];
      if (csvFile) {
        appendImportZipDebug('偵測到 video.csv，使用完整備份匯入模式。');
        const csvText = await csvFile.async('string');
        const lines = csvText.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
          appendImportZipDebug('video.csv 沒有可用資料列。');
          alert('CSV 瑼?瘝?鞈?');
          resetImportUi();
          return;
        }

        const parseCsvLine = (line: string): string[] => {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;
          for (let c = 0; c < line.length; c++) {
            const ch = line[c];
            if (inQuotes) {
              if (ch === '"' && line[c + 1] === '"') {
                current += '"';
                c++;
              } else if (ch === '"') {
                inQuotes = false;
              } else {
                current += ch;
              }
            } else if (ch === '"') {
              inQuotes = true;
            } else if (ch === ',') {
              result.push(current);
              current = '';
            } else {
              current += ch;
            }
          }
          result.push(current);
          return result;
        };

        const headers = parseCsvLine(lines[0]);
        const dataRows = lines.slice(1).map((line) => {
          const values = parseCsvLine(line);
          const row: Record<string, string> = {};
          headers.forEach((header, idx) => {
            row[header] = values[idx] || '';
          });
          return row;
        });

        let successCount = 0;
        let failedCount = 0;
        const total = dataRows.length;
        setImportZipProgress({ current: 0, total, status: `準備匯入 ${total} 部影片`, success: 0, failed: 0 });
        appendImportZipDebug(`CSV 解析完成，共 ${total} 筆。`);

        for (let i = 0; i < dataRows.length; i++) {
          const row = dataRows[i];
          const rowName = row.name || '未命名影片';
          setImportZipProgress({ current: i + 1, total, status: `處理中: ${rowName}`, success: successCount, failed: failedCount });
          appendImportZipDebug(`[${i + 1}/${total}] 開始處理 ${rowName}`);

          try {
            let remoteFileUrl = '';
            let remoteFiletype = row.filetype || '';
            if (row.file && zip.files[row.file]) {
              const videoBlob = await zip.files[row.file].async('blob');
              const fileName = row.file.split('/').pop() || 'video.mp4';
              const videoFileObj = new File([videoBlob], fileName, { type: 'application/octet-stream' });
              const uploadResult: { url: string; fileId: string; filetype?: string } = videoFileObj.size > MAX_VIDEO_PART_SIZE
                ? await uploadVideoInParts(videoFileObj)
                : await uploadToAppwriteStorage(videoFileObj);
              remoteFileUrl = uploadResult.url;
              remoteFiletype = uploadResult.filetype || remoteFiletype;
              appendImportZipDebug(`[${i + 1}/${total}] 影片上傳成功 ${fileName}`);
            }

            let remoteCoverUrl = '';
            if (row.cover && zip.files[row.cover]) {
              const coverBlob = await zip.files[row.cover].async('blob');
              const coverName = row.cover.split('/').pop() || 'cover.png';
              const coverFileObj = new File([coverBlob], coverName, { type: 'application/octet-stream' });
              const coverUpload = await uploadToAppwriteStorage(coverFileObj);
              remoteCoverUrl = coverUpload.url;
              appendImportZipDebug(`[${i + 1}/${total}] 封面上傳成功 ${coverName}`);
            }

            const existing = videos.find((video) => video.name === row.name);
            const apiUrl = existing
              ? addAppwriteConfigToUrl(`${API_ENDPOINTS.VIDEO}/${existing.$id}`)
              : addAppwriteConfigToUrl(API_ENDPOINTS.VIDEO);
            const method = existing ? 'PUT' : 'POST';

            const submitData: Record<string, string> = {
              name: row.name || '',
              file: remoteFileUrl || (existing ? existing.file : ''),
              cover: remoteCoverUrl || (existing ? (typeof existing.cover === 'string' ? existing.cover : '') : ''),
              filetype: remoteFiletype || row.filetype || '',
              category: row.category || '',
              note: row.note || '',
              ref: row.ref || '',
              hash: row.hash || (existing ? existing.hash : `zip_import_${Date.now()}_${Math.random().toString(36).substring(7)}`),
            };

            const response = await fetch(apiUrl, {
              method,
              headers: { 'Content-Type': 'application/json', ...getAppwriteHeaders() },
              body: JSON.stringify(submitData),
            });

            if (response.ok) {
              successCount++;
              appendImportZipDebug(`[${i + 1}/${total}] ${existing ? '更新' : '新增'}成功 ${rowName}`);
            } else {
              failedCount++;
              appendImportZipDebug(`[${i + 1}/${total}] ${existing ? '更新' : '新增'}失敗 ${rowName}，HTTP ${response.status}`);
            }
          } catch (error) {
            console.error(`[Video import] Failed: ${rowName}`, error);
            failedCount++;
            appendImportZipDebug(`[${i + 1}/${total}] 處理失敗 ${rowName}: ${error instanceof Error ? error.message : '未知錯誤'}`);
          }
        }

        setImportZipProgress({ current: total, total, status: '匯入完成', success: successCount, failed: failedCount });
        appendImportZipDebug(`匯入完成，成功 ${successCount} 筆，失敗 ${failedCount} 筆。`);
        setTimeout(() => {
          resetImportUi();
          if (successCount > 0) {
            loadVideos(true);
          }
        }, 2000);
        return;
      }

      appendImportZipDebug('未偵測到 video.csv，改用舊格式影片匯入模式。');
      const videoFiles: { name: string; file: any }[] = [];
      const validExtensions = ['mp4', 'webm', 'ogg', 'mov'];
      zip.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir) {
          const ext = relativePath.split('.').pop()?.toLowerCase() || '';
          if (validExtensions.includes(ext)) {
            videoFiles.push({ name: relativePath, file: zipEntry });
          }
        }
      });

      if (videoFiles.length === 0) {
        appendImportZipDebug('ZIP 中沒有可匯入的影片檔案。');
        alert('ZIP 瑼?銝剜???啣蔣??獢?(MP4, WebM, OGG, MOV)');
        resetImportUi();
        return;
      }

      let successCount = 0;
      let failedCount = 0;
      setImportZipProgress({ current: 0, total: videoFiles.length, status: `找到 ${videoFiles.length} 部影片`, success: 0, failed: 0 });
      appendImportZipDebug(`找到 ${videoFiles.length} 部影片檔案。`);

      for (let i = 0; i < videoFiles.length; i++) {
        const videoFile = videoFiles[i];
        const fileName = videoFile.name.split('/').pop() || videoFile.name;
        setImportZipProgress({ current: i + 1, total: videoFiles.length, status: `處理中: ${fileName}`, success: successCount, failed: failedCount });
        appendImportZipDebug(`[${i + 1}/${videoFiles.length}] 開始匯入 ${fileName}`);

        try {
          const arrayBuffer = await videoFile.file.async('arraybuffer');
          const ext = fileName.split('.').pop()?.toLowerCase() || 'mp4';
          const mimeType = ext === 'webm' ? 'video/webm' : ext === 'ogg' ? 'video/ogg' : ext === 'mov' ? 'video/quicktime' : 'video/mp4';
          const blob = new Blob([arrayBuffer], { type: mimeType });
          const videoFileObj = new File([blob], fileName, { type: mimeType });

          const uploadResult: { url: string; fileId: string; filetype?: string } = videoFileObj.size > MAX_VIDEO_PART_SIZE
            ? await uploadVideoInParts(videoFileObj, (progress) => {
              setImportZipProgress((prev) => ({ ...prev, status: `分段上傳 ${fileName} (${progress}%)` }));
            })
            : await uploadToAppwriteStorage(videoFileObj, (progress) => {
              setImportZipProgress((prev) => ({ ...prev, status: `上傳中 ${fileName} (${progress}%)` }));
            });

          const createUrl = addAppwriteConfigToUrl(API_ENDPOINTS.VIDEO);
          const createResponse = await fetch(createUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: fileName,
              file: uploadResult.url,
              filetype: uploadResult.filetype || ext,
              note: '',
              ref: '',
              category: '',
              hash: '',
              cover: '',
            }),
          });

          if (!createResponse.ok) {
            throw new Error(`HTTP ${createResponse.status}`);
          }

          successCount++;
          appendImportZipDebug(`[${i + 1}/${videoFiles.length}] 新增成功 ${fileName}`);
        } catch (error) {
          console.error(`[Video import] Failed: ${fileName}`, error);
          failedCount++;
          appendImportZipDebug(`[${i + 1}/${videoFiles.length}] 匯入失敗 ${fileName}: ${error instanceof Error ? error.message : '未知錯誤'}`);
        }
      }

      setImportZipProgress({ current: videoFiles.length, total: videoFiles.length, status: '匯入完成', success: successCount, failed: failedCount });
      appendImportZipDebug(`舊格式匯入完成，成功 ${successCount} 筆，失敗 ${failedCount} 筆。`);
      setTimeout(() => {
        resetImportUi();
        if (successCount > 0) {
          loadVideos(true);
        }
      }, 2000);
    } catch (error) {
      console.error('ZIP import error:', error);
      appendImportZipDebug(`匯入流程失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
      alert('?臬憭望?嚗?蝣箄? ZIP 瑼??澆?甇?Ⅱ');
      setTimeout(() => {
        resetImportUi();
      }, 2000);
    }
  };

  const videosWithFile = useMemo(() => videos.filter((video) => Boolean(video.file)), [videos]);
  const videosMissingCover = useMemo(() => videos.filter((video) => !video.cover), [videos]);
  const multipartVideos = useMemo(() => videos.filter((video) => isMultipartVideoFiletype(video.filetype)), [videos]);
  const duplicateVideoGroups = useMemo(() => {
    const groups = new Map<string, VideoData[]>();

    videos.forEach((video) => {
      const key = getVideoDuplicateKey(video);
      if (!key) return;

      const current = groups.get(key) || [];
      current.push(video);
      groups.set(key, current);
    });

    return Array.from(groups.values())
      .filter((group) => group.length > 1)
      .map((group) =>
        [...group].sort(
          (a, b) => new Date(a.$createdAt).getTime() - new Date(b.$createdAt).getTime()
        )
      )
      .sort((a, b) => b.length - a.length);
  }, [videos]);
  const duplicateVideoIds = useMemo(
    () => new Set(duplicateVideoGroups.flatMap((group) => group.map((video) => video.$id))),
    [duplicateVideoGroups]
  );
  const duplicateVideosToDelete = useMemo(
    () => duplicateVideoGroups.flatMap((group) => group.slice(1)),
    [duplicateVideoGroups]
  );

  const filteredVideos = useMemo(() => {
    const modeFiltered = videos.filter((video) => {
      if (workbenchMode === "withFile") return Boolean(video.file);
      if (workbenchMode === "missingCover") return !video.cover;
      if (workbenchMode === "multipart") return isMultipartVideoFiletype(video.filetype);
      if (workbenchMode === "duplicates") return duplicateVideoIds.has(video.$id);
      return true;
    });

    const query = searchQuery.trim().toLowerCase();
    const searched = query
      ? modeFiltered.filter(video =>
        video.name?.toLowerCase().includes(query) ||
        video.note?.toLowerCase().includes(query)
      )
      : modeFiltered;

    return [...searched].sort((a, b) => {
      if (sortMode === "fileSizeDesc") {
        return getVideoFileSize(b) - getVideoFileSize(a);
      }

      return new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime();
    });
  }, [videos, searchQuery, workbenchMode, duplicateVideoIds, sortMode]);

  // Bulk delete state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteInput, setBulkDeleteInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [deleteTotal, setDeleteTotal] = useState(0);

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (!selectionMode) {
      setSelectionMode(true);
      setSelectedIds(new Set(filteredVideos.map(v => v.$id).filter(Boolean)));
    } else if (filteredVideos.length > 0 && filteredVideos.every(v => selectedIds.has(v.$id))) {
      setSelectedIds(new Set());
      setSelectionMode(false);
    } else {
      setSelectedIds(new Set(filteredVideos.map(v => v.$id).filter(Boolean)));
    }
  };

  const deleteVideosByIds = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;

    setDeleteTotal(ids.length);
    setDeleteProgress(0);
    setIsDeleting(true);
    let failedCount = 0;

    for (const id of ids) {
      try {
        const url = addAppwriteConfigToUrl(`${API_ENDPOINTS.VIDEO}/${id}`);
        const response = await fetch(url, { method: 'DELETE' });
        if (!response.ok) {
          throw new Error(`Delete failed: ${response.status}`);
        }
      } catch (err) {
        failedCount += 1;
        console.error("Delete failed:", err);
      } finally {
        setDeleteProgress(prev => prev + 1);
      }
    }

    setIsDeleting(false);
    setSelectedIds(new Set());
    setSelectionMode(false);
    setBulkDeleteOpen(false);
    setBulkDeleteInput("");
    await loadVideos(true);

    if (failedCount > 0) {
      alert(`批次刪除已完成，但有 ${failedCount} 部影片刪除失敗，請稍後再試。`);
    }
  }, [loadVideos]);

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds).filter(id => !!id);
    await deleteVideosByIds(ids);
  };

  const handleCleanupDuplicateVideos = async () => {
    const ids = duplicateVideosToDelete.map((video) => video.$id).filter(Boolean);

    if (ids.length === 0) {
      alert('目前沒有可清理的重複影片。');
      return;
    }

    const confirmed = window.confirm(
      `找到 ${duplicateVideoGroups.length} 組重複影片，將保留每組最早建立的 1 部，刪除其餘 ${ids.length} 部。確定要清理嗎？`
    );

    if (!confirmed) return;

    setWorkbenchMode("duplicates");
    setSelectionMode(true);
    setSelectedIds(new Set(ids));
    setBulkDeleteOpen(true);
    await deleteVideosByIds(ids);
  };

  const {
    cacheStatus,
    cacheStats,
    loadVideoFromCache,
    downloadAndCacheVideo,
    deleteVideoCache,
    clearAllCache,
    updateCacheStats,
    formatFileSize,
    maxCacheSize,
  } = useVideoCache();

  useEffect(() => {
    updateCacheStats();
  }, [updateCacheStats]);

  useEffect(() => {
    const savedViewMode = localStorage.getItem('video-view-mode');
    if (savedViewMode === 'youtube' || savedViewMode === 'bilibili') {
      setViewMode(savedViewMode);
    }
    setViewModeHydrated(true);
  }, []);

  // 記住 viewMode 偏好
  useEffect(() => {
    if (!viewModeHydrated) return;
    localStorage.setItem('video-view-mode', viewMode);
  }, [viewMode, viewModeHydrated]);

  const handleAdd = () => {
    setEditingVideo(null);
    setShowFormModal(false);
    setIsInlineCreating(true);
  };

  const handleEdit = (video: VideoData) => {
    setEditingVideo(video);
    setShowFormModal(true);
  };

  const handleDelete = async (video: VideoData) => {
    const confirmText = `DELETE ${video.name}`;
    const userInput = prompt(`確定要刪除影片「${video.name}」嗎？\n\n請輸入以下文字以確認刪除：\n${confirmText}`);

    if (userInput !== confirmText) {
      if (userInput !== null) {
        alert('輸入不正確，刪除已取消');
      }
      return;
    }

    try {
      const url = addAppwriteConfigToUrl(`${API_ENDPOINTS.VIDEO}/${video.$id}`);
      const response = await fetch(url, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('刪除失敗');
      loadVideos(true);
    } catch (error) {
      alert(error instanceof Error ? error.message : '刪除失敗');
    }
  };

  const handleFormSuccess = () => {
    setShowFormModal(false);
    setEditingVideo(null);
    setIsInlineCreating(false);
    loadVideos(true);
  };

  // 開始行內編輯
  const handleInlineEdit = (video: VideoData) => {
    setInlineEditForm({
      name: video.name || '',
      category: video.category || '',
      note: video.note || '',
      ref: video.ref || '',
      cover: typeof video.cover === 'string' ? video.cover : '',
      file: video.file || '',
      filetype: video.filetype || '',
      hash: video.hash || '',
    });
    setInlineVideoFile(null);
    setInlineVideoPreviewName('');
    setInlineVideoUploading(false);
    setInlineVideoUploadProgress(0);
    setInlineVideoDuplicateWarning('');
    setInlineCoverFile(null);
    setInlineCoverPreview('');
    setInlineEditingId(video.$id);
  };

  const calculateInlineVideoHash = async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      return `fallback_${file.name}_${file.size}_${file.lastModified}`;
    }
  };

  const handleInlineVideoSelect = async (file: File | null, currentVideo: VideoData) => {
    if (!file) return;
    const validTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
    if (!validTypes.includes(file.type)) {
      alert('只支援 MP4, WebM, OGG, MOV 格式的影片');
      return;
    }

    setInlineVideoUploadProgress(0);
    setInlineVideoDuplicateWarning('');
    setInlineVideoFile(file);
    setInlineVideoPreviewName(file.name);

    const hash = await calculateInlineVideoHash(file);
    const filetype = file.name.split('.').pop()?.toLowerCase() || '';
    const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
    const duplicateVideo = videos.find((item) => item.hash === hash && item.$id !== currentVideo.$id);

    setInlineEditForm((prev) => ({
      ...prev,
      name: prev.name || fileNameWithoutExt,
      filetype,
      hash,
    }));

    if (duplicateVideo) {
      setInlineVideoDuplicateWarning(`警告：此影片與「${duplicateVideo.name}」相同，請勿重複上傳！`);
    }
  };

  // 儲存行內編輯
  const handleInlineSave = async (videoId: string) => {
    if (!inlineEditingId) return;
    try {
      let coverUrl = inlineEditForm.cover;
      let fileUrl = inlineEditForm.file;
      let filetype = inlineEditForm.filetype;
      let hash = inlineEditForm.hash;
      let fileSize = videos.find((item) => item.$id === videoId)?.fileSize;

      if (inlineVideoDuplicateWarning) {
        alert('此影片與既有影片重複，無法重新上傳！請選擇其他影片。');
        return;
      }

      if (inlineVideoFile) {
        setInlineVideoUploading(true);
        try {
          const uploadResult: { url: string; fileId: string; filetype?: string } = inlineVideoFile.size > MAX_VIDEO_PART_SIZE
            ? await uploadVideoInParts(inlineVideoFile, setInlineVideoUploadProgress)
            : await uploadToAppwriteStorage(inlineVideoFile, setInlineVideoUploadProgress);
          fileUrl = uploadResult.url;
          filetype = uploadResult.filetype || filetype;
          hash = hash || uploadResult.fileId;
          fileSize = inlineVideoFile.size;
        } catch (uploadError) {
          console.error('影片上傳失敗:', uploadError);
          alert('影片上傳失敗，請稍後再試');
          setInlineVideoUploading(false);
          return;
        }
        setInlineVideoUploading(false);
      }

      // 如果有選擇封面檔案，先上傳
      if (inlineCoverFile) {
        setInlineCoverUploading(true);
        try {
          const result = await uploadToAppwriteStorage(inlineCoverFile);
          coverUrl = result.url;
        } catch (uploadError) {
          console.error('封面圖上傳失敗:', uploadError);
          alert('封面圖上傳失敗，請稍後再試');
          setInlineCoverUploading(false);
          return;
        }
        setInlineCoverUploading(false);
      }

      const url = addAppwriteConfigToUrl(`${API_ENDPOINTS.VIDEO}/${videoId}`);
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: inlineEditForm.name,
          file: fileUrl,
          filetype,
          category: inlineEditForm.category,
          note: inlineEditForm.note,
          ref: inlineEditForm.ref,
          hash,
          cover: coverUrl,
          fileSize,
        }),
      });
      if (!response.ok) throw new Error('更新失敗');
      loadVideos(true);
      setInlineEditingId(null);
      setInlineEditForm({ name: '', category: '', note: '', ref: '', cover: '', file: '', filetype: '', hash: '' });
      setInlineVideoFile(null);
      setInlineVideoPreviewName('');
      setInlineVideoUploading(false);
      setInlineVideoUploadProgress(0);
      setInlineVideoDuplicateWarning('');
      setInlineCoverFile(null);
      setInlineCoverPreview('');
    } catch (error) {
      console.error('Inline edit failed:', error);
      alert(error instanceof Error ? error.message : '更新失敗，請稍後再試');
    }
  };

  // 取消行內編輯
  const cancelInlineEdit = () => {
    setInlineEditingId(null);
    setInlineEditForm({ name: '', category: '', note: '', ref: '', cover: '', file: '', filetype: '', hash: '' });
    setInlineVideoFile(null);
    setInlineVideoPreviewName('');
    setInlineVideoUploading(false);
    setInlineVideoUploadProgress(0);
    setInlineVideoDuplicateWarning('');
    setInlineCoverFile(null);
    setInlineCoverPreview('');
  };

  const playVideo = useCallback(async (video: VideoData) => {
    setCurrentVideo(video.$id);
    setShowPlayer(true);
    const cachedUrl = await loadVideoFromCache(video.$id);

    if (videoRef.current) {
      videoRef.current.src = cachedUrl || video.file || '';
      videoRef.current.load();
    }
  }, [loadVideoFromCache]);

  const handleDownload = useCallback(async (video: VideoData) => {
    const videoItem: VideoItem = {
      id: video.$id,
      title: video.name,
      description: video.note || '',
      filename: video.name,
      url: video.file,
      filetype: video.filetype,
      cover: typeof video.cover === 'string' ? video.cover : '',
    };
    await downloadAndCacheVideo(videoItem);
  }, [downloadAndCacheVideo]);

  const handleDirectDownload = useCallback(async (video: VideoData) => {
    try {
      await downloadVideoToBrowser(video);
    } catch (error) {
      alert(error instanceof Error ? error.message : '下載失敗');
    }
  }, []);

  const handleDeleteCache = useCallback(async (videoId: string) => {
    if (confirm('確定要刪除此影片的快取嗎？')) {
      await deleteVideoCache(videoId);
    }
  }, [deleteVideoCache]);

  const handleClearAll = useCallback(async () => {
    if (confirm('確定要清空所有影片快取嗎？此操作無法復原。')) {
      await clearAllCache();
    }
  }, [clearAllCache]);

  const currentVideoData = videos.find(v => v.$id === currentVideo);

  if (loading) {
    return <FullPageLoading text="載入影片資料中..." />;
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <FriendlyAiCrudShell
        title="鋒兄影片"
        description="影片收藏、快取、上傳狀態與版型切換整合成一個工作台，先看出哪些可播、哪些該補封面。"
        searchPlaceholder="搜尋影片名稱、備註..."
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        recentSearchKey="video-management"
        workspaceCountText={`共 ${videos.length} 部影片`}
        workspaceDescription="整理影片名稱、來源、封面與檔案狀態，優先處理缺少封面、缺少影片檔與多段影片資料。"
        activeMode={workbenchMode}
        onModeChange={(mode) => setWorkbenchMode(mode as typeof workbenchMode)}
        modeItems={[
          { key: "all", label: "全部影片", count: videos.length },
          { key: "withFile", label: "可播放", count: videosWithFile.length },
          { key: "missingCover", label: "缺封面", count: videosMissingCover.length },
          { key: "multipart", label: "分段影片", count: multipartVideos.length },
          { key: "duplicates", label: "重複影片", count: duplicateVideoIds.size },
        ]}
        suggestions={[
          duplicateVideoGroups.length > 0
            ? { title: "重複影片提醒", body: `目前有 ${duplicateVideoGroups.length} 組重複影片，可切到重複篩選檢查後再一鍵清理。`, tone: "amber" }
            : { title: "重複狀態", body: "目前沒有偵測到重複影片，匯入結果看起來是乾淨的。", tone: "green" },
          videosMissingCover.length > 0
            ? { title: "先補封面", body: `有 ${videosMissingCover.length} 部影片缺封面，列表辨識與分享都會比較弱。`, tone: "amber" }
            : { title: "封面完整", body: "封面狀態不錯，接下來適合補分類與章節。", tone: "green" },
          videosWithFile.length < videos.length
            ? { title: "媒體待補", body: `有 ${videos.length - videosWithFile.length} 筆只有資料沒有影片檔，建議先和可播放內容分開。`, tone: "red" }
            : { title: "播放狀態", body: "目前大多可直接播放，接下來可以整理摘要與重點片段。", tone: "blue" },
          multipartVideos.length > 0
            ? { title: "分段管理", body: `有 ${multipartVideos.length} 部影片使用分段格式，建議優先檢查封面與快取策略。`, tone: "neutral" }
            : { title: "檔案結構", body: "目前沒有分段影片，匯入與快取管理會單純很多。", tone: "neutral" },
        ]}
        toolbar={
          <>
            <Button
              onClick={() => loadVideos(true)}
              disabled={loading || exportingZip || importingZip}
              variant="outline"
              className="gap-2 rounded-xl h-10 px-4"
              title="重新整理"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              <span className="hidden sm:inline">重新整理</span>
            </Button>
            <Button
              onClick={handleExportZip}
              disabled={loading || exportingZip || importingZip || videos.length === 0}
              className="gap-2 bg-purple-500 hover:bg-purple-600 rounded-xl disabled:opacity-50"
              title="匯出所有影片為 ZIP"
            >
              <Download size={16} className={exportingZip ? "animate-bounce" : ""} />
              <span className="hidden sm:inline">{exportingZip ? "匯出中..." : "匯出 ZIP"}</span>
            </Button>
            <Button
              onClick={() => importZipInputRef.current?.click()}
              disabled={loading || exportingZip || importingZip}
              className="gap-2 bg-orange-500 hover:bg-orange-600 rounded-xl disabled:opacity-50"
              title="從 ZIP 匯入影片"
            >
              <FolderUp size={16} className={importingZip ? "animate-bounce" : ""} />
              <span className="hidden sm:inline">{importingZip ? "匯入中..." : "匯入 ZIP"}</span>
            </Button>
            <input
              ref={importZipInputRef}
              type="file"
              accept=".zip"
              onChange={handleImportZipWithDebug}
              className="hidden"
            />
            {duplicateVideoGroups.length > 0 && (
              <Button
                onClick={() => setWorkbenchMode("duplicates")}
                variant="outline"
                className="rounded-xl h-10 px-4 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/30"
              >
                重複影片 ({duplicateVideoIds.size})
              </Button>
            )}
            {duplicateVideosToDelete.length > 0 && (
              <Button
                onClick={handleCleanupDuplicateVideos}
                className="rounded-xl h-10 px-4 bg-red-600 hover:bg-red-700 text-white"
                title="一鍵清理重複影片"
              >
                清理重複 ({duplicateVideosToDelete.length})
              </Button>
            )}
            <Button
              onClick={() => {
                setSelectionMode((prev) => {
                  const next = !prev;
                  if (!next) {
                    setSelectedIds(new Set());
                  }
                  return next;
                });
              }}
              variant="outline"
              className="rounded-xl h-10 px-4"
            >
              {selectionMode ? "結束多選" : "多選"}
            </Button>
            <Button onClick={handleSelectAll} variant="outline" className="rounded-xl h-10 px-4">
              {selectionMode && filteredVideos.length > 0 && filteredVideos.every((video) => selectedIds.has(video.$id)) ? "取消全選" : "全選"}
            </Button>
            {selectedIds.size > 0 && (
              <Button onClick={() => setBulkDeleteOpen(true)} className="rounded-xl h-10 px-4 bg-red-600 hover:bg-red-700 text-white">
                <Trash2 size={18} />
                刪除選取 ({selectedIds.size})
              </Button>
            )}
            <Select value={sortMode} onValueChange={(value: "createdDesc" | "fileSizeDesc") => setSortMode(value)}>
              <SelectTrigger className="h-10 w-full rounded-xl bg-white sm:w-[170px] dark:bg-gray-900">
                <SelectValue placeholder="排序" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdDesc">最新建立</SelectItem>
                <SelectItem value="fileSizeDesc">檔案大小 大到小</SelectItem>
              </SelectContent>
            </Select>
            <div
              className="flex w-full items-center gap-0.5 rounded-full bg-neutral-100 p-1 sm:w-auto dark:bg-neutral-800/80"
              role="group"
              aria-label="列表版型"
            >
              <button
                type="button"
                onClick={() => setViewMode("netflix")}
                className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 ${
                  viewMode === "netflix"
                    ? "bg-[#E50914] text-white shadow-sm"
                    : "text-neutral-600 hover:bg-neutral-200/80 dark:text-neutral-300 dark:hover:bg-neutral-700"
                }`}
                title="Netflix 列表"
                aria-pressed={viewMode === "netflix"}
              >
                <Monitor className="h-4 w-4" />
                <span className="hidden sm:inline">Netflix</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("youtube")}
                className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 ${
                  viewMode === "youtube"
                    ? "bg-[#ff0000] text-white shadow-sm"
                    : "text-neutral-600 hover:bg-neutral-200/80 dark:text-neutral-300 dark:hover:bg-neutral-700"
                }`}
                title="YouTube 列表"
                aria-pressed={viewMode === "youtube"}
              >
                <Tv className="h-4 w-4" />
                <span className="hidden sm:inline">YouTube</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("bilibili")}
                className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a1d6] ${
                  viewMode === "bilibili"
                    ? "bg-[#00a1d6] text-white shadow-sm"
                    : "text-neutral-600 hover:bg-neutral-200/80 dark:text-neutral-300 dark:hover:bg-neutral-700"
                }`}
                title="Bilibili 列表"
                aria-pressed={viewMode === "bilibili"}
              >
                <Play className="h-4 w-4 fill-current" />
                <span className="hidden sm:inline">Bilibili</span>
              </button>
            </div>
            <Button onClick={handleAdd} className="gap-2 rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100">
              <Plus size={16} />
              新增影片
            </Button>
          </>
        }
      />

      {/* 統計卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <StatCard title="影片總數" value={stats.total} icon={Play} />
        <StatCard title="已快取" value={cacheStats.cachedVideos} icon={CheckCircle} />
        <StatCard title="快取大小" value={formatFileSize(cacheStats.totalSize)} icon={HardDrive} />
      </div>

      {/* 影片播放器 — 三皮對應列表模式 */}
      {showPlayer && currentVideo && currentVideoData && (
        viewMode === "bilibili" ? (
          <BilibiliPlayerModal
            video={currentVideoData}
            videoRef={videoRef}
            onPersistPlayback={handlePersistVideoPlayback}
            onClose={() => setShowPlayer(false)}
          />
        ) : viewMode === "netflix" ? (
          <NetflixPlayerModal
            video={currentVideoData}
            videoRef={videoRef}
            onPersistPlayback={handlePersistVideoPlayback}
            onClose={() => setShowPlayer(false)}
          />
        ) : (
          <VideoPlayerModal
            video={currentVideoData}
            videoRef={videoRef}
            onPersistPlayback={handlePersistVideoPlayback}
            onClose={() => setShowPlayer(false)}
          />
        )
      )}

      {/* 影片列表 */}
      {videos.length === 0 && !isInlineCreating ? (
        <EmptyState
          icon={<Play className="w-12 h-12" />}
          title="尚無影片"
          description="點擊上方「新增影片」按鈕新增第一個影片"
        />
      ) : filteredVideos.length === 0 && !isInlineCreating ? (
        <EmptyState
          icon={<Search className="w-12 h-12" />}
          title="無搜尋結果"
          description={`找不到「${searchQuery}」相關的影片`}
        />
      ) : viewMode === 'netflix' ? (
        <div className="mt-4 min-h-[50vh] space-y-8 overflow-hidden rounded-xl bg-[#141414] px-4 pb-10 pt-6 text-white sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {filteredVideos[0] && (
            <div
              className="group relative mb-6 aspect-[21/9] min-h-[200px] cursor-pointer overflow-hidden rounded-xl bg-black shadow-lg ring-1 ring-white/10"
              onClick={() => playVideo(filteredVideos[0])}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  playVideo(filteredVideos[0]);
                }
              }}
              aria-label={`播放 ${filteredVideos[0].name}`}
            >
              <img
                src={getProxiedMediaUrl(filteredVideos[0].cover) || "/placeholder-video.jpg"}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-55 transition-opacity duration-300 group-hover:opacity-70"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#141414] via-[#141414]/70 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-transparent" />
              <div className="absolute bottom-[12%] left-[4%] z-10 max-w-2xl pr-6">
                <p className="mb-2 text-xs font-medium tracking-wide text-white/70">精選</p>
                <h2 className="mb-3 line-clamp-2 text-2xl font-black text-balance text-white drop-shadow-lg sm:text-4xl md:text-5xl">
                  {filteredVideos[0].name}
                </h2>
                <p className="mb-5 line-clamp-2 text-sm text-neutral-300 sm:line-clamp-3 sm:text-base">
                  {filteredVideos[0].note || "點擊播放 · 家中影片庫"}
                </p>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <button
                    type="button"
                    className="inline-flex h-10 items-center gap-2 rounded bg-white px-5 text-sm font-bold text-black transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:h-11 sm:px-7"
                  >
                    <Play size={18} fill="currentColor" /> 播放
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-10 items-center gap-2 rounded bg-white/15 px-5 text-sm font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:h-11 sm:px-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddToQueue(filteredVideos[0]);
                    }}
                  >
                    {isInQueue(filteredVideos[0].$id) ? <CheckCircle size={18} /> : <Plus size={18} />} 佇列
                  </button>
                </div>
              </div>
            </div>
          )}

          {Array.from(new Set(filteredVideos.map((v) => v.category || "未分類"))).map((category) => (
            <section key={category} className="relative z-10 space-y-3">
              <h3 className="px-1 text-lg font-bold text-neutral-100 sm:text-xl">{category}</h3>
              <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto scroll-smooth pb-4 sm:gap-4">
                {isInlineCreating && category === "未分類" && (
                  <div className="w-[260px] flex-none sm:w-[300px]">
                    <InlineCreateVideoCard
                      existingVideos={videos}
                      compact
                      onCancel={() => setIsInlineCreating(false)}
                      onSuccess={() => {
                        setIsInlineCreating(false);
                        loadVideos(true);
                      }}
                    />
                  </div>
                )}
                {filteredVideos
                  .filter((v) => (v.category || "未分類") === category)
                  .map((video) => (
                    <div
                      key={video.$id}
                      className="group relative aspect-video w-[240px] flex-none snap-start overflow-hidden rounded-md border border-white/10 bg-neutral-800 shadow-md transition-transform duration-200 motion-safe:hover:z-20 motion-safe:hover:scale-[1.04] sm:w-[280px]"
                    >
                      <button
                        type="button"
                        className="absolute inset-0 z-0"
                        onClick={() => playVideo(video)}
                        aria-label={`播放 ${video.name}`}
                      />
                      <img
                        src={getProxiedMediaUrl(video.cover) || "/placeholder-video.jpg"}
                        alt=""
                        className="h-full w-full object-cover transition-opacity duration-200 group-hover:opacity-55 group-focus-within:opacity-55"
                      />
                      <div className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
                        <h4 className="mb-0.5 line-clamp-1 text-sm font-bold text-white">{video.name}</h4>
                        <p className="mb-2 line-clamp-1 text-xs text-neutral-300">{video.note || "無描述"}</p>
                        <div className="pointer-events-auto flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              className="rounded-full bg-white p-1.5 text-black transition-colors hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                              onClick={() => playVideo(video)}
                              aria-label="播放"
                            >
                              <Play size={14} fill="currentColor" />
                            </button>
                            <button
                              type="button"
                              className="rounded-full border border-white/40 p-1.5 text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                              onClick={() => handleAddToQueue(video)}
                              aria-label={isInQueue(video.$id) ? "已在佇列" : "加入佇列"}
                            >
                              {isInQueue(video.$id) ? <CheckCircle size={14} /> : <Plus size={14} />}
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              className="rounded-full border border-white/30 p-1.5 text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                              onClick={() => handleEdit(video)}
                              title="編輯"
                              aria-label="編輯"
                            >
                              <Edit size={12} />
                            </button>
                            <button
                              type="button"
                              className="rounded-full border border-white/30 p-1.5 text-red-300 transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                              onClick={() => handleDelete(video)}
                              title="刪除"
                              aria-label="刪除"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                      {cacheStatus[video.$id]?.cached && (
                        <div className="absolute right-2 top-2 rounded-full bg-emerald-500/90 p-1 text-white shadow-md">
                          <CheckCircle size={12} />
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div
          className={
            viewMode === "bilibili"
              ? "mt-4 rounded-xl border border-neutral-200/80 bg-[#f4f4f4] p-3 dark:border-[#2c2c2e] dark:bg-[#17181a] sm:p-4"
              : "mt-4 rounded-xl border border-neutral-200/60 bg-[#f8f8f8] p-3 dark:border-white/10 dark:bg-[#0f0f0f] sm:p-4"
          }
        >
          <div className="mb-3 flex items-center justify-between gap-2 px-0.5">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              {viewMode === "bilibili" ? "Bilibili 瀏覽" : "YouTube 瀏覽"}
              <span className="mx-1.5 text-neutral-300 dark:text-neutral-600">·</span>
              {filteredVideos.length} 部
            </p>
            <p className="hidden text-[11px] text-neutral-400 sm:block">
              懸停或聚焦卡片顯示佇列 / 快取 / 編輯
            </p>
          </div>
          <div
            className={
              viewMode === "bilibili"
                ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 lg:gap-3.5"
                : "grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
            }
          >
            {isInlineCreating && (
              <div className="relative">
                <InlineCreateVideoCard
                  existingVideos={videos}
                  compact={viewMode === "bilibili"}
                  onCancel={() => setIsInlineCreating(false)}
                  onSuccess={() => {
                    setIsInlineCreating(false);
                    loadVideos(true);
                  }}
                />
              </div>
            )}
            {filteredVideos.map((video) => (
              <div key={video.$id} className="relative">
                {selectionMode && (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(video.$id)}
                    onChange={() => handleToggleSelect(video.$id)}
                    className="absolute left-2 top-2 z-10 h-4 w-4 cursor-pointer rounded border-neutral-300 text-red-600"
                    aria-label={`選取 ${video.name}`}
                  />
                )}
                {viewMode === "bilibili" ? (
                  <BilibiliVideoCard
                    video={video}
                    cacheStatus={cacheStatus[video.$id]}
                    onPlay={() => playVideo(video)}
                    onEdit={() => handleEdit(video)}
                    onDelete={() => handleDelete(video)}
                    onDownload={() => handleDownload(video)}
                    onDirectDownload={() => handleDirectDownload(video)}
                    onDeleteCache={() => handleDeleteCache(video.$id)}
                    onAddToQueue={() => handleAddToQueue(video)}
                    isInQueue={isInQueue(video.$id)}
                    isEditing={inlineEditingId === video.$id}
                    inlineEditForm={inlineEditForm}
                    setInlineEditForm={setInlineEditForm}
                    onInlineEdit={handleInlineEdit}
                    onInlineSave={handleInlineSave}
                    onInlineCancel={cancelInlineEdit}
                    inlineVideoFile={inlineVideoFile}
                    inlineVideoPreviewName={inlineVideoPreviewName}
                    inlineVideoUploading={inlineVideoUploading}
                    inlineVideoUploadProgress={inlineVideoUploadProgress}
                    inlineVideoDuplicateWarning={inlineVideoDuplicateWarning}
                    onInlineVideoSelect={handleInlineVideoSelect}
                    inlineCoverFile={inlineCoverFile}
                    setInlineCoverFile={setInlineCoverFile}
                    inlineCoverPreview={inlineCoverPreview}
                    setInlineCoverPreview={setInlineCoverPreview}
                    inlineCoverUploading={inlineCoverUploading}
                  />
                ) : (
                  <VideoManagementCard
                    video={video}
                    cacheStatus={cacheStatus[video.$id]}
                    onPlay={() => playVideo(video)}
                    onEdit={() => handleEdit(video)}
                    onDelete={() => handleDelete(video)}
                    onDownload={() => handleDownload(video)}
                    onDirectDownload={() => handleDirectDownload(video)}
                    onDeleteCache={() => handleDeleteCache(video.$id)}
                    onAddToQueue={() => handleAddToQueue(video)}
                    isInQueue={isInQueue(video.$id)}
                    isEditing={inlineEditingId === video.$id}
                    inlineEditForm={inlineEditForm}
                    setInlineEditForm={setInlineEditForm}
                    onInlineEdit={handleInlineEdit}
                    onInlineSave={handleInlineSave}
                    onInlineCancel={cancelInlineEdit}
                    inlineVideoFile={inlineVideoFile}
                    inlineVideoPreviewName={inlineVideoPreviewName}
                    inlineVideoUploading={inlineVideoUploading}
                    inlineVideoUploadProgress={inlineVideoUploadProgress}
                    inlineVideoDuplicateWarning={inlineVideoDuplicateWarning}
                    onInlineVideoSelect={handleInlineVideoSelect}
                    inlineCoverFile={inlineCoverFile}
                    setInlineCoverFile={setInlineCoverFile}
                    inlineCoverPreview={inlineCoverPreview}
                    setInlineCoverPreview={setInlineCoverPreview}
                    inlineCoverUploading={inlineCoverUploading}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 快取管理 */}
      <CacheManager
        cacheStats={cacheStats}
        maxCacheSize={maxCacheSize}
        formatFileSize={formatFileSize}
        onClearAll={handleClearAll}
        videoCount={videos.length}
      />

      {/* 表單模態框 */}
      {showFormModal && (
        <VideoFormModal
          video={editingVideo}
          existingVideos={videos}
          onClose={() => {
            setShowFormModal(false);
            setEditingVideo(null);
          }}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* ZIP 匯出進度模態框 */}
      {exportingZip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-2xl w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">匯出影片中...</h3>
            <div className="space-y-3">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {exportZipProgress.status}
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>進度</span>
                  <span>{exportZipProgress.current} / {exportZipProgress.total}</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className="bg-purple-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${exportZipProgress.total > 0 ? (exportZipProgress.current / exportZipProgress.total) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">
                  成功處理：{exportZipProgress.success}
                </div>
                <div className="rounded-xl bg-rose-50 px-3 py-2 text-rose-700 dark:bg-rose-950/30 dark:text-rose-200">
                  失敗或略過：{exportZipProgress.failed}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm font-semibold text-gray-800 dark:text-gray-100">
                  <span>匯出 Debug 訊息</span>
                  <span className="text-xs font-normal text-gray-500 dark:text-gray-400">{exportZipDebugMessages.length} 筆</span>
                </div>
                <div className="max-h-64 overflow-y-auto rounded-xl bg-gray-900 px-3 py-2 text-xs leading-5 text-green-200">
                  {exportZipDebugMessages.length > 0 ? (
                    exportZipDebugMessages.map((message, index) => (
                      <div key={`${index}-${message}`} className="border-b border-white/5 py-1 last:border-b-0">
                        {message}
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-400">等待匯出程序開始...</div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm font-semibold text-gray-800 dark:text-gray-100">
                  <span>匯入 Debug 訊息</span>
                  <span className="text-xs font-normal text-gray-500 dark:text-gray-400">{importZipDebugMessages.length} 筆</span>
                </div>
                <div className="max-h-64 overflow-y-auto rounded-xl bg-gray-900 px-3 py-2 text-xs leading-5 text-green-200">
                  {importZipDebugMessages.length > 0 ? (
                    importZipDebugMessages.map((message, index) => (
                      <div key={`${index}-${message}`} className="border-b border-white/5 py-1 last:border-b-0">
                        {message}
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-400">等待匯入訊息...</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ZIP 匯入進度模態框 */}
      {importingZip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-2xl w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">匯入影片中...</h3>
            <div className="space-y-3">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {importZipProgress.status}
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>進度</span>
                  <span>{importZipProgress.current} / {importZipProgress.total}</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className="bg-orange-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${importZipProgress.total > 0 ? (importZipProgress.current / importZipProgress.total) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 text-xs text-center">
                <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-2">
                  <div className="font-bold text-green-600 dark:text-green-400">{importZipProgress.success}</div>
                  <div className="text-green-600/70 dark:text-green-400/70">成功</div>
                </div>
                <div className="bg-red-100 dark:bg-red-900/30 rounded-lg p-2">
                  <div className="font-bold text-red-600 dark:text-red-400">{importZipProgress.failed}</div>
                  <div className="text-red-600/70 dark:text-red-400/70">失敗</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSV 匯入預覽模態框 */}
      {importPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">匯入預覽</h3>
              <button onClick={() => setImportPreview(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1">
              {importPreview.errors.length > 0 ? (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <h4 className="font-semibold text-red-700 dark:text-red-400 mb-2">錯誤</h4>
                  <ul className="list-disc list-inside text-sm text-red-600 dark:text-red-300 space-y-1">
                    {importPreview.errors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              ) : (
                <>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
                    <p className="text-sm text-yellow-700 dark:text-yellow-400">
                      ⚠️ <strong>注意：</strong>匯入不包含影片檔案和封面圖，這些需要另行上傳。
                    </p>
                  </div>
                  <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">將匯入 {importPreview.data.length} 筆資料:</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100 dark:bg-gray-700">
                          <th className="px-3 py-2 text-left">名稱</th>
                          <th className="px-3 py-2 text-left">分類</th>
                          <th className="px-3 py-2 text-left">備註</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.data.slice(0, 12).map((item, i) => (
                          <tr key={i} className="border-b border-gray-200 dark:border-gray-700">
                            <td className="px-3 py-2 font-medium">{item.name}</td>
                            <td className="px-3 py-2">{item.category || '-'}</td>
                            <td className="px-3 py-2 max-w-[200px] truncate">{item.note || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {importPreview.data.length > 12 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">...還有 {importPreview.data.length - 12} 筆</p>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="flex flex-col gap-3 border-t border-gray-200 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] dark:border-gray-700 sm:flex-row sm:justify-end">
              {importing ? (
                <div className="flex items-center gap-3">
                  <div className="w-48 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-300"
                      style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    匯入中 {importProgress.current}/{importProgress.total}
                  </span>
                </div>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setImportPreview(null)}>取消</Button>
                  <Button
                    onClick={executeImport}
                    disabled={importPreview.errors.length > 0 || importPreview.data.length === 0}
                    className="bg-blue-500 hover:bg-blue-600"
                  >
                    確認匯入 ({importPreview.data.length} 筆)
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 批次刪除確認 Modal */}
      {bulkDeleteOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3 mb-3">
                <AlertTriangle className="text-red-500" size={24} />
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">確認批次刪除</h3>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">即將刪除 <span className="font-bold text-red-600">{selectedIds.size}</span> 部影片，此操作無法復原</p>
            </div>
            {isDeleting ? (
              <div className="p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600 shrink-0" />
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    正在刪除中... ({deleteProgress} / {deleteTotal} 筆)
                  </p>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                  <div
                    className="bg-red-500 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${deleteTotal > 0 ? (deleteProgress / deleteTotal) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">請輸入以下文字確認：</p>
                <code className="block bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg text-sm font-mono text-red-600">DELETE video</code>
                <input
                  type="text"
                  value={bulkDeleteInput}
                  onChange={(e) => setBulkDeleteInput(e.target.value)}
                  placeholder="輸入 DELETE video"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                />
              </div>
            )}
            <div className="flex flex-col gap-3 border-t border-gray-100 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] dark:border-gray-800 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => { setBulkDeleteOpen(false); setBulkDeleteInput(""); }} disabled={isDeleting}>取消</Button>
              <Button
                onClick={handleBulkDelete}
                disabled={bulkDeleteInput !== "DELETE video" || isDeleting}
                className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
              >
                {isDeleting ? '刪除中...' : `確認刪除 (${selectedIds.size} 筆)`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 影片播放佇列面板 */}
    </div>
  );
}

// 播放器共用：上一部 / 下一部
function pickAdjacentVideo(
  list: VideoData[],
  currentId: string,
  direction: "prev" | "next"
): VideoData | null {
  if (list.length <= 1) return null;
  const currentIndex = list.findIndex((v) => v.$id === currentId);
  if (currentIndex < 0) return list[0] ?? null;
  const delta = direction === "next" ? 1 : -1;
  const nextIndex = (currentIndex + delta + list.length) % list.length;
  return list[nextIndex] ?? null;
}

function buildRecommendedVideos(
  allVideosWithFile: VideoData[],
  currentId: string,
  playedIds: Set<string>
): VideoData[] {
  const currentIndex = allVideosWithFile.findIndex((v) => v.$id === currentId);
  if (currentIndex < 0) return allVideosWithFile.slice(0, 12);
  const unplayed: VideoData[] = [];
  const played: VideoData[] = [];
  for (let i = 1; i < allVideosWithFile.length; i++) {
    const nextIndex = (currentIndex + i) % allVideosWithFile.length;
    const item = allVideosWithFile[nextIndex];
    if (playedIds.has(item.$id)) played.push(item);
    else unplayed.push(item);
  }
  return [...unplayed, ...played].slice(0, 12);
}

type VideoPersistPlayback = {
  src: string;
  currentTime: number;
  volume: number;
  playbackRate: number;
  loop: boolean;
  muted: boolean;
};

function useVideoPlayerSession(
  video: VideoData,
  options?: { onEndedRepeatQuery?: string }
) {
  const { videos } = useVideos();
  const [autoPlay, setAutoPlay] = useState(true);
  const [repeatMode, setRepeatMode] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [currentVideo, setCurrentVideo] = useState<VideoData>(video);
  const [playedIds, setPlayedIds] = useState<Set<string>>(() => new Set([video.$id]));
  const { resolvedSrc, loadingSource, sourceError } = useResolvedVideoSource(currentVideo);

  const allVideosWithFile = useMemo(() => videos.filter((v) => v.file), [videos]);
  const hasPlaylist = allVideosWithFile.length > 1;
  const recommendedVideos = useMemo(
    () => buildRecommendedVideos(allVideosWithFile, currentVideo.$id, playedIds),
    [allVideosWithFile, currentVideo.$id, playedIds]
  );

  const goToVideo = useCallback((next: VideoData) => {
    setPlayedIds((prev) => new Set([...prev, next.$id]));
    setCurrentVideo(next);
    setShowDescription(false);
  }, []);

  const goAdjacent = useCallback(
    (direction: "prev" | "next") => {
      const next = pickAdjacentVideo(allVideosWithFile, currentVideo.$id, direction);
      if (next) goToVideo(next);
    },
    [allVideosWithFile, currentVideo.$id, goToVideo]
  );

  const handleVideoEnded = useCallback(() => {
    if (repeatMode) {
      const selector = options?.onEndedRepeatQuery || ".plyr video";
      const player = document.querySelector(selector) as HTMLVideoElement | null;
      if (player) {
        player.currentTime = 0;
        void player.play().catch(() => {});
      }
      return;
    }
    if (!autoPlay) return;
    const currentIndex = allVideosWithFile.findIndex((v) => v.$id === currentVideo.$id);
    let nextVideo: VideoData | null = null;
    for (let i = 1; i < allVideosWithFile.length; i++) {
      const nextIndex = (currentIndex + i) % allVideosWithFile.length;
      const candidate = allVideosWithFile[nextIndex];
      if (!playedIds.has(candidate.$id)) {
        nextVideo = candidate;
        break;
      }
    }
    if (!nextVideo && allVideosWithFile.length > 1) {
      const nextIndex = (currentIndex + 1) % allVideosWithFile.length;
      nextVideo = allVideosWithFile[nextIndex];
      setPlayedIds(new Set([nextVideo.$id]));
    } else if (nextVideo) {
      setPlayedIds((prev) => new Set([...prev, nextVideo!.$id]));
    }
    if (nextVideo) {
      setCurrentVideo(nextVideo);
      setShowDescription(false);
    }
  }, [repeatMode, autoPlay, allVideosWithFile, currentVideo.$id, playedIds, options?.onEndedRepeatQuery]);

  return {
    autoPlay,
    setAutoPlay,
    repeatMode,
    setRepeatMode,
    showDescription,
    setShowDescription,
    currentVideo,
    resolvedSrc,
    loadingSource,
    sourceError,
    allVideosWithFile,
    hasPlaylist,
    recommendedVideos,
    goToVideo,
    goAdjacent,
    handleVideoEnded,
  };
}

// Netflix 皮播放器 — 沉浸全黑、橫列 up-next
function NetflixPlayerModal({
  video,
  onClose,
  onPersistPlayback,
}: {
  video: VideoData;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onClose: () => void;
  onPersistPlayback: (video: VideoData, playback: VideoPersistPlayback) => void;
}) {
  const {
    autoPlay,
    setAutoPlay,
    repeatMode,
    setRepeatMode,
    showDescription,
    setShowDescription,
    currentVideo,
    resolvedSrc,
    loadingSource,
    sourceError,
    hasPlaylist,
    recommendedVideos,
    goToVideo,
    goAdjacent,
    handleVideoEnded,
  } = useVideoPlayerSession(video);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goAdjacent("prev");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goAdjacent("next");
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, goAdjacent]);

  const overlayNavBtn =
    "absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity duration-200 hover:bg-black/85 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white group-hover:opacity-100 group-focus-within:opacity-100";

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[#141414] text-white motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
      role="dialog"
      aria-modal="true"
      aria-label={`播放：${currentVideo.name}`}
    >
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#141414]/95 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-[1600px] items-center justify-between gap-3 px-4 sm:h-14 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="shrink-0 text-xl font-black tracking-tight text-[#E50914]" aria-hidden>
              F
            </span>
            <div className="min-w-0">
              <span className="block truncate text-sm font-semibold sm:text-base">鋒兄影片</span>
              <span className="hidden text-[11px] text-white/50 sm:block">Netflix 模式</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="關閉播放器"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-5 p-4 sm:p-6 lg:p-8">
        <div className="group relative aspect-video overflow-hidden rounded-md bg-black shadow-2xl ring-1 ring-white/10 [&_.plyr]:!h-full [&_.plyr]:!w-full">
          {hasPlaylist && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goAdjacent("prev");
                }}
                className={`${overlayNavBtn} left-3`}
                title="上一則"
                aria-label="上一則影片"
              >
                <ChevronLeft className="h-7 w-7" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goAdjacent("next");
                }}
                className={`${overlayNavBtn} right-3`}
                title="下一則"
                aria-label="下一則影片"
              >
                <ChevronRight className="h-7 w-7" />
              </button>
            </>
          )}
          {loadingSource ? (
            <div className="flex h-full w-full items-center justify-center text-sm text-white/70">影片載入中…</div>
          ) : sourceError ? (
            <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-red-400">{sourceError}</div>
          ) : (
            <PlyrPlayer
              key={currentVideo.$id}
              type="video"
              src={resolvedSrc}
              poster={currentVideo.cover}
              autoplay
              onEnded={handleVideoEnded}
              persistOnUnmount
              onPersistPlayback={(playback) => onPersistPlayback(currentVideo, playback)}
              className="h-full w-full"
            />
          )}
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <h1 className="line-clamp-2 text-2xl font-black leading-tight text-balance sm:text-3xl">
              {currentVideo.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-white/60">
              <span>{formatLocalDate(currentVideo.$createdAt)}</span>
              {currentVideo.category && (
                <span className="rounded border border-white/20 px-2 py-0.5 text-xs text-white/80">
                  {currentVideo.category}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {hasPlaylist && (
                <>
                  <button
                    type="button"
                    onClick={() => goAdjacent("prev")}
                    className="inline-flex h-10 items-center gap-1.5 rounded bg-white px-3.5 text-sm font-bold text-black transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    上一則
                  </button>
                  <button
                    type="button"
                    onClick={() => goAdjacent("next")}
                    className="inline-flex h-10 items-center gap-1.5 rounded bg-white/15 px-3.5 text-sm font-bold text-white transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    下一則
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setAutoPlay((v) => !v)}
                disabled={repeatMode}
                aria-pressed={autoPlay && !repeatMode}
                className={`inline-flex h-10 items-center rounded px-3.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-45 ${
                  autoPlay && !repeatMode
                    ? "bg-[#E50914] text-white hover:bg-[#f6121d]"
                    : "bg-white/10 text-white/80 hover:bg-white/15"
                }`}
              >
                自動播放 {autoPlay && !repeatMode ? "開" : "關"}
              </button>
              <button
                type="button"
                onClick={() => setRepeatMode((v) => !v)}
                aria-pressed={repeatMode}
                className={`inline-flex h-10 items-center rounded px-3.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                  repeatMode ? "bg-white text-black" : "bg-white/10 text-white/80 hover:bg-white/15"
                }`}
              >
                重複 {repeatMode ? "開" : "關"}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowDescription((v) => !v)}
              className="w-full rounded-md bg-white/5 p-3 text-left transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-expanded={showDescription}
            >
              <div className="flex items-center justify-between gap-2 text-sm font-medium">
                <span>簡介</span>
                <span className="text-xs text-white/50">{showDescription ? "顯示較少" : "展開"}</span>
              </div>
              {showDescription ? (
                <div className="mt-2 space-y-2">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-white/75">
                    {currentVideo.note || "暫無詳細描述。"}
                  </p>
                  {currentVideo.ref && (
                    <a
                      href={currentVideo.ref}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="block break-all text-sm text-[#54b9c5] hover:underline"
                    >
                      {currentVideo.ref}
                    </a>
                  )}
                </div>
              ) : (
                <p className="mt-1 line-clamp-1 text-sm text-white/55">
                  {currentVideo.note || "暫無詳細描述。"}
                </p>
              )}
            </button>
          </div>
        </div>

        {recommendedVideos.length > 0 && (
          <section className="space-y-3 border-t border-white/10 pt-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold">接下來播放</h2>
              <span className="text-xs text-white/45">{recommendedVideos.length} 則</span>
            </div>
            <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto pb-2">
              {recommendedVideos.map((rec) => (
                <button
                  key={rec.$id}
                  type="button"
                  onClick={() => goToVideo(rec)}
                  className="group/card w-[160px] shrink-0 snap-start text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:w-[200px]"
                >
                  <div className="relative aspect-video overflow-hidden rounded bg-neutral-800 ring-1 ring-white/10 transition-transform duration-200 motion-safe:group-hover/card:scale-[1.03]">
                    {rec.cover ? (
                      <img src={rec.cover} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Play className="h-6 w-6 text-white/20" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover/card:bg-black/35 group-hover/card:opacity-100">
                      <Play className="h-8 w-8 fill-current text-white" />
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-white/90 group-hover/card:text-white">
                    {rec.name}
                  </p>
                  <p className="mt-0.5 text-xs text-white/45">{formatLocalDate(rec.$createdAt)}</p>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

// YouTube 皮播放器 — 極簡控制（上一則 / 下一則 / 自動播放 + 關閉）
function VideoPlayerModal({
  video,
  onClose,
  onPersistPlayback,
}: {
  video: VideoData;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onClose: () => void;
  onPersistPlayback: (video: VideoData, playback: VideoPersistPlayback) => void;
}) {
  const { videos } = useVideos();
  const [autoPlay, setAutoPlay] = useState(true);
  const [repeatMode, setRepeatMode] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [currentVideo, setCurrentVideo] = useState<VideoData>(video);
  const [playedIds, setPlayedIds] = useState<Set<string>>(() => new Set([video.$id]));
  const { resolvedSrc, loadingSource, sourceError } = useResolvedVideoSource(currentVideo);

  const allVideosWithFile = useMemo(() => videos.filter((v) => v.file), [videos]);
  const hasPlaylist = allVideosWithFile.length > 1;

  const recommendedVideos = useMemo(
    () => buildRecommendedVideos(allVideosWithFile, currentVideo.$id, playedIds),
    [allVideosWithFile, currentVideo.$id, playedIds]
  );

  const goToVideo = useCallback((next: VideoData) => {
    setPlayedIds((prev) => new Set([...prev, next.$id]));
    setCurrentVideo(next);
    setShowDescription(false);
  }, []);

  const goAdjacent = useCallback(
    (direction: "prev" | "next") => {
      const next = pickAdjacentVideo(allVideosWithFile, currentVideo.$id, direction);
      if (next) goToVideo(next);
    },
    [allVideosWithFile, currentVideo.$id, goToVideo]
  );

  const handleVideoEnded = useCallback(() => {
    if (repeatMode) {
      const player = document.querySelector(".plyr video") as HTMLVideoElement | null;
      if (player) {
        player.currentTime = 0;
        void player.play().catch(() => {});
      }
      return;
    }
    if (!autoPlay) return;

    const currentIndex = allVideosWithFile.findIndex((v) => v.$id === currentVideo.$id);
    let nextVideo: VideoData | null = null;
    for (let i = 1; i < allVideosWithFile.length; i++) {
      const nextIndex = (currentIndex + i) % allVideosWithFile.length;
      const candidate = allVideosWithFile[nextIndex];
      if (!playedIds.has(candidate.$id)) {
        nextVideo = candidate;
        break;
      }
    }

    if (!nextVideo && allVideosWithFile.length > 1) {
      const nextIndex = (currentIndex + 1) % allVideosWithFile.length;
      nextVideo = allVideosWithFile[nextIndex];
      setPlayedIds(new Set([nextVideo.$id]));
    } else if (nextVideo) {
      setPlayedIds((prev) => new Set([...prev, nextVideo!.$id]));
    }

    if (nextVideo) {
      setCurrentVideo(nextVideo);
      setShowDescription(false);
    }
  }, [repeatMode, autoPlay, allVideosWithFile, currentVideo.$id, playedIds]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goAdjacent("prev");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goAdjacent("next");
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, goAdjacent]);

  const overlayNavBtn =
    "absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity duration-200 hover:bg-black/80 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 group-hover:opacity-100 group-focus-within:opacity-100";

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[#f1f1f1] motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200 dark:bg-[#0f0f0f]"
      role="dialog"
      aria-modal="true"
      aria-label={`播放：${currentVideo.name}`}
    >
      {/* 頂欄：Logo + 關閉（無假搜尋） */}
      <header className="sticky top-0 z-20 border-b border-black/8 bg-white/95 backdrop-blur-md dark:border-white/10 dark:bg-[#0f0f0f]/95">
        <div className="mx-auto flex h-12 max-w-[1700px] items-center justify-between gap-3 px-4 sm:h-14 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-6 w-8 shrink-0 items-center justify-center rounded-[4px] bg-[#ff0000]" aria-hidden>
              <Play className="h-3.5 w-3.5 fill-current text-white" />
            </div>
            <div className="min-w-0">
              <span className="block truncate text-sm font-semibold tracking-tight text-neutral-900 dark:text-white sm:text-base">
                鋒兄影片
              </span>
              <span className="hidden text-[11px] text-neutral-500 dark:text-neutral-400 sm:block">YouTube 模式</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-neutral-800 transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:text-white dark:hover:bg-white/10"
            aria-label="關閉播放器"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1700px] p-4 sm:p-5 lg:p-6 xl:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:gap-6">
          {/* 主欄 */}
          <div className="min-w-0 flex-1 space-y-3 lg:max-w-[calc(100%-402px)]">
            <div className="group relative aspect-video overflow-hidden rounded-xl bg-black shadow-sm ring-1 ring-black/10 dark:ring-white/10 [&_.plyr]:!h-full [&_.plyr]:!w-full [&_.plyr]:rounded-xl">
              {hasPlaylist && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      goAdjacent("prev");
                    }}
                    className={`${overlayNavBtn} left-3`}
                    title="上一則"
                    aria-label="上一則影片"
                  >
                    <ChevronLeft className="h-7 w-7" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      goAdjacent("next");
                    }}
                    className={`${overlayNavBtn} right-3`}
                    title="下一則"
                    aria-label="下一則影片"
                  >
                    <ChevronRight className="h-7 w-7" />
                  </button>
                </>
              )}
              {loadingSource ? (
                <div className="flex h-full w-full items-center justify-center text-sm text-white/80">影片載入中…</div>
              ) : sourceError ? (
                <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-red-400">{sourceError}</div>
              ) : (
                <PlyrPlayer
                  key={currentVideo.$id}
                  type="video"
                  src={resolvedSrc}
                  poster={currentVideo.cover}
                  autoplay
                  onEnded={handleVideoEnded}
                  persistOnUnmount
                  onPersistPlayback={(playback) => onPersistPlayback(currentVideo, playback)}
                  className="h-full w-full"
                />
              )}
            </div>

            <h1 className="line-clamp-2 text-lg font-bold leading-snug text-balance text-neutral-900 dark:text-white sm:text-xl">
              {currentVideo.name}
            </h1>

            {/* 極簡控制列 */}
            <div className="flex flex-wrap items-center gap-2">
              {hasPlaylist && (
                <>
                  <button
                    type="button"
                    onClick={() => goAdjacent("prev")}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full bg-neutral-200/90 px-3.5 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    上一則
                  </button>
                  <button
                    type="button"
                    onClick={() => goAdjacent("next")}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full bg-neutral-200/90 px-3.5 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                  >
                    下一則
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setAutoPlay((v) => !v)}
                disabled={repeatMode}
                title={repeatMode ? "重複模式下自動播放已停用" : "自動播放下一則"}
                aria-pressed={autoPlay && !repeatMode}
                className={`inline-flex h-10 items-center rounded-full px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:cursor-not-allowed disabled:opacity-45 ${
                  autoPlay && !repeatMode
                    ? "bg-[#ff0000] text-white hover:bg-[#e60000]"
                    : "bg-neutral-200/90 text-neutral-700 hover:bg-neutral-300 dark:bg-white/10 dark:text-neutral-300 dark:hover:bg-white/15"
                }`}
              >
                自動播放 {autoPlay && !repeatMode ? "開" : "關"}
              </button>
              <button
                type="button"
                onClick={() => setRepeatMode((v) => !v)}
                title="重複播放同一則"
                aria-pressed={repeatMode}
                className={`inline-flex h-10 items-center rounded-full px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 ${
                  repeatMode
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                    : "bg-neutral-200/90 text-neutral-700 hover:bg-neutral-300 dark:bg-white/10 dark:text-neutral-300 dark:hover:bg-white/15"
                }`}
              >
                重複 {repeatMode ? "開" : "關"}
              </button>
            </div>

            {/* 折疊 meta / 簡介 */}
            <button
              type="button"
              onClick={() => setShowDescription((v) => !v)}
              className="w-full rounded-xl bg-neutral-200/70 p-3 text-left transition-colors hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:bg-white/5 dark:hover:bg-white/10"
              aria-expanded={showDescription}
            >
              <div className="flex items-center gap-2 text-sm font-medium text-neutral-900 dark:text-white">
                <span>{formatLocalDate(currentVideo.$createdAt)}</span>
                {currentVideo.category && (
                  <span className="text-neutral-600 dark:text-neutral-300">#{currentVideo.category}</span>
                )}
                <span className="ml-auto text-xs font-normal text-neutral-500 dark:text-neutral-400">
                  {showDescription ? "顯示較少" : "簡介"}
                </span>
              </div>
              {showDescription ? (
                <div className="mt-2 space-y-2">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
                    {currentVideo.note || "暫無詳細描述。"}
                  </p>
                  {currentVideo.ref && (
                    <a
                      href={currentVideo.ref}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="block break-all text-sm text-[#065fd4] hover:underline dark:text-[#3ea6ff]"
                    >
                      {currentVideo.ref}
                    </a>
                  )}
                </div>
              ) : (
                <p className="mt-1 line-clamp-1 text-sm text-neutral-600 dark:text-neutral-400">
                  {currentVideo.note || "暫無詳細描述。"}
                </p>
              )}
            </button>
          </div>

          {/* 側欄：接下來播放 */}
          <aside className="w-full shrink-0 space-y-2.5 lg:w-[380px]">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">接下來播放</h2>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {recommendedVideos.length} 則
              </span>
            </div>
            <div className="space-y-1">
              {recommendedVideos.length === 0 ? (
                <p className="rounded-lg bg-neutral-200/50 px-3 py-6 text-center text-sm text-neutral-500 dark:bg-white/5 dark:text-neutral-400">
                  沒有其他可播放影片
                </p>
              ) : (
                recommendedVideos.map((recVideo) => (
                  <RecommendedVideoCard
                    key={recVideo.$id}
                    video={recVideo}
                    active={recVideo.$id === currentVideo.$id}
                    onClick={() => goToVideo(recVideo)}
                  />
                ))
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

// YouTube 側欄推薦卡
function RecommendedVideoCard({
  video,
  onClick,
  active = false,
}: {
  video: VideoData;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group/rec flex w-full gap-2 rounded-lg p-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 ${
        active
          ? "bg-neutral-200/80 dark:bg-white/10"
          : "hover:bg-neutral-200/60 dark:hover:bg-white/5"
      }`}
    >
      <div className="relative aspect-video w-[148px] shrink-0 overflow-hidden rounded-lg bg-neutral-200 dark:bg-[#272727] sm:w-[168px]">
        {video.cover ? (
          <img
            src={video.cover}
            alt=""
            className="h-full w-full object-cover transition-transform duration-200 motion-safe:group-hover/rec:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#383838] to-[#181818]">
            <Play className="h-5 w-5 text-white/20" />
          </div>
        )}
        {video.category && (
          <span className="absolute bottom-1 left-1 rounded bg-black/80 px-1 py-0.5 text-[9px] font-medium text-white">
            {video.category}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <h3 className="line-clamp-2 text-sm font-medium leading-5 text-neutral-900 dark:text-white">
          {video.name}
        </h3>
        <div className="mt-1 flex flex-col text-xs text-neutral-600 dark:text-neutral-400">
          <span>鋒兄影片</span>
          <span>{formatLocalDate(video.$createdAt)}</span>
        </div>
      </div>
    </button>
  );
}

// 影片管理卡片屬性
interface VideoManagementCardProps {
  video: VideoData;
  cacheStatus?: { cached: boolean; downloading: boolean; progress: number; error?: string };
  onPlay: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onDirectDownload: () => void;
  onDeleteCache: () => void;
  onAddToQueue?: () => void;
  isInQueue?: boolean;
  // Inline editing props
  isEditing: boolean;
  inlineEditForm: { name: string; category: string; note: string; ref: string; cover: string; file: string; filetype: string; hash: string };
  setInlineEditForm: (form: { name: string; category: string; note: string; ref: string; cover: string; file: string; filetype: string; hash: string }) => void;
  onInlineEdit: (video: VideoData) => void;
  onInlineSave: (videoId: string) => void;
  onInlineCancel: () => void;
  inlineVideoFile: File | null;
  inlineVideoPreviewName: string;
  inlineVideoUploading: boolean;
  inlineVideoUploadProgress: number;
  inlineVideoDuplicateWarning: string;
  onInlineVideoSelect: (file: File | null, video: VideoData) => void;
  // Inline cover upload props
  inlineCoverFile: File | null;
  setInlineCoverFile: (file: File | null) => void;
  inlineCoverPreview: string;
  setInlineCoverPreview: (preview: string) => void;
  inlineCoverUploading: boolean;
}

function InlineCreateVideoCard({
  existingVideos,
  compact,
  onCancel,
  onSuccess,
}: {
  existingVideos: VideoData[];
  compact: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    file: '',
    filetype: '',
    note: '',
    ref: '',
    category: '',
    hash: '',
    cover: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Array<{
    file: File;
    hash: string;
    filetype: string;
    defaultName: string;
    duplicateVideoName?: string;
    duplicateVideoId?: string;
  }>>([]);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadProgressItems, setUploadProgressItems] = useState<VideoUploadProgressItem[]>([]);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [fileHash, setFileHash] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const [selectedCoverFile, setSelectedCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState('');
  const [coverPreviewLoading, setCoverPreviewLoading] = useState(false);
  const [coverUploadProgress, setCoverUploadProgress] = useState(0);
  const [coverUploadStatus, setCoverUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [useCategorySelect, setUseCategorySelect] = useState(true);

  const existingCategories = Array.from(new Set(existingVideos.map((v) => v.category).filter(Boolean)));

  const updateUploadProgressItem = (key: string, patch: Partial<VideoUploadProgressItem>) => {
    setUploadProgressItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  };

  const calculateFileHash = async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      return `fallback_${file.name}_${file.size}_${file.lastModified}`;
    }
  };

  const createCoverFileFromVideo = (file: File): Promise<File | null> => new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.src = objectUrl;
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'metadata';

    let timeoutId: number;

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.src = '';
    };

    const fail = () => {
      window.clearTimeout(timeoutId);
      cleanup();
      resolve(null);
    };

    timeoutId = window.setTimeout(fail, 8000);

    const handleSeeked = () => {
      window.clearTimeout(timeoutId);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return fail();
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (!blob) return fail();
          const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '') || 'video';
          const thumbnailName = `${nameWithoutExt}-thumbnail.jpg`;
          cleanup();
          resolve(new File([blob], thumbnailName, { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.9);
      } catch {
        fail();
      }
    };

    const handleLoaded = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 1;
      const captureTime = duration > 1 ? 1 : Math.max(0, duration / 2 || 0);
      try {
        video.currentTime = captureTime;
      } catch {
        fail();
      }
    };

    video.addEventListener('loadedmetadata', handleLoaded, { once: true });
    video.addEventListener('seeked', handleSeeked, { once: true });
    video.addEventListener('error', fail, { once: true });

    video.load();
  });

  const applyAutoCoverForSingle = async (file: File) => {
    setCoverPreviewLoading(true);
    const coverFile = await createCoverFileFromVideo(file);
    setCoverPreviewLoading(false);
    if (!coverFile) return;
    setSelectedCoverFile(coverFile);
    setCoverPreviewUrl(URL.createObjectURL(coverFile));
  };

  const handleFileSelect = async (files: File[]) => {
    if (files.length === 0) return;
    const validTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
    const invalidTypeFile = files.find((file) => !validTypes.includes(file.type));
    if (invalidTypeFile) {
      alert(`檔案「${invalidTypeFile.name}」格式不支援，只支援 MP4, WebM, OGG, MOV`);
      return;
    }

    setPreviewLoading(true);
    setUploadStatus('idle');
    setUploadProgress(0);
    setDuplicateWarning('');

    const preparedFiles = await Promise.all(files.map(async (file) => {
      const hash = await calculateFileHash(file);
      const filetype = file.name.split('.').pop()?.toLowerCase() || '';
      const defaultName = file.name.replace(/\.[^/.]+$/, '');
      const duplicateVideo = existingVideos.find((vid) => vid.hash === hash);

      return {
        file,
        hash,
        filetype,
        defaultName,
        duplicateVideoName: duplicateVideo?.name,
        duplicateVideoId: duplicateVideo?.$id,
      };
    }));

    const firstFile = preparedFiles[0];
    const objectUrl = URL.createObjectURL(firstFile.file);
    const duplicateCount = preparedFiles.filter((item) => item.duplicateVideoName).length;

    setSelectedFiles(preparedFiles);
    setUploadProgressItems(preparedFiles.map((item) => createUploadProgressItem(item.file, item.hash, item.defaultName)));
    setSelectedFile(firstFile.file);
    setPreviewUrl(objectUrl);
    setFileHash(firstFile.hash);

    if (preparedFiles.length === 1) {
      setFormData((prev) => ({
        ...prev,
        name: prev.name || firstFile.defaultName,
        hash: firstFile.hash,
        filetype: firstFile.filetype,
      }));

      if (!formData.cover && !selectedCoverFile) {
        await applyAutoCoverForSingle(firstFile.file);
      }

      if (firstFile.duplicateVideoName) {
        setDuplicateWarning(`提醒：此影片與「${firstFile.duplicateVideoName}」相同，可在儲存時選擇用新檔取代。`);
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        name: '',
        hash: '',
        filetype: '',
      }));
      setSelectedCoverFile(null);
      setCoverPreviewUrl('');

      if (duplicateCount > 0) {
        setDuplicateWarning(`提醒：${duplicateCount} 部影片與既有影片重複，儲存時可選擇用新檔取代。`);
      }
    }

    setTimeout(() => setPreviewLoading(false), 300);
  };

  const handleCoverFileSelect = (file: File | null) => {
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('只支援 JPG, PNG, GIF, WEBP 格式的圖片');
      return;
    }
    setCoverPreviewLoading(true);
    setCoverUploadStatus('idle');
    setCoverUploadProgress(0);
    setSelectedCoverFile(file);
    setCoverPreviewUrl(URL.createObjectURL(file));
    setTimeout(() => setCoverPreviewLoading(false), 300);
  };

  const uploadVideoFile = async (file: File, progressKey?: string): Promise<{ url: string; fileId: string; filetype?: string }> => {
    setUploadStatus('uploading');
    setUploadProgress(0);
    if (progressKey) updateUploadProgressItem(progressKey, { status: 'uploading', progress: 0, message: '上傳中' });
    try {
      const result = file.size > MAX_VIDEO_PART_SIZE
        ? await uploadVideoInParts(file, (progress) => {
          setUploadProgress(progress);
          if (progressKey) updateUploadProgressItem(progressKey, { progress });
        })
        : await uploadToAppwriteStorage(file, (progress) => {
          setUploadProgress(progress);
          if (progressKey) updateUploadProgressItem(progressKey, { progress });
        });
      setUploadStatus('success');
      if (progressKey) updateUploadProgressItem(progressKey, { status: 'success', progress: 100, message: '完成' });
      return result;
    } catch (error) {
      setUploadStatus('error');
      if (progressKey) updateUploadProgressItem(progressKey, {
        status: 'error',
        message: error instanceof Error ? error.message : '失敗',
      });
      throw error;
    }
  };

  const uploadCoverFile = async (file: File): Promise<{ url: string; fileId: string }> => {
    setCoverUploadStatus('uploading');
    setCoverUploadProgress(0);
    try {
      const result = await uploadToAppwriteStorage(file, setCoverUploadProgress);
      setCoverUploadStatus('success');
      return result;
    } catch (error) {
      setCoverUploadStatus('error');
      throw error;
    }
  };

  const handleSave = async () => {
    if (!selectedFiles.length && !formData.name.trim()) {
      alert('請輸入影片名稱');
      return;
    }
    const duplicateItems = selectedFiles.filter((item) => item.duplicateVideoId);
    if (selectedFiles.length <= 1 && duplicateItems.length > 0) {
      const confirmed = window.confirm(`此影片與「${duplicateItems[0].duplicateVideoName}」重複，是否用新檔取代舊影片？`);
      if (!confirmed) return;
    }

    setSubmitting(true);
    try {
      if (selectedFiles.length > 1) {
        const duplicateCount = duplicateItems.length;
        let replaceDuplicates = false;
        if (duplicateCount > 0) {
          replaceDuplicates = window.confirm(`有 ${duplicateCount} 部影片與既有影片重複，是否用新檔取代舊影片？取消將略過重複項目。`);
        }
        const uploadableFiles = replaceDuplicates
          ? selectedFiles
          : selectedFiles.filter((item) => !item.duplicateVideoId);
        let successCount = 0;
        let skippedCount = selectedFiles.length - uploadableFiles.length;
        let failedCount = 0;
        const hasSharedCover = Boolean(formData.cover) || Boolean(selectedCoverFile);
        let sharedCoverUrl = formData.cover;

        if (selectedCoverFile) {
          const { url } = await uploadCoverFile(selectedCoverFile);
          sharedCoverUrl = url;
        }

        for (const item of uploadableFiles) {
          const progressKey = getSelectedVideoUploadKey(item.file, item.hash);
          try {
            const { url, fileId, filetype } = await uploadVideoFile(item.file, progressKey);
            let coverUrl = sharedCoverUrl || '';
            if (!hasSharedCover) {
              const autoCoverFile = await createCoverFileFromVideo(item.file);
              if (autoCoverFile) {
                const { url: autoCoverUrl } = await uploadCoverFile(autoCoverFile);
                coverUrl = autoCoverUrl;
              }
            }
            const payload = {
              ...formData,
              name: item.defaultName,
              file: url,
              filetype: filetype || item.filetype,
              hash: item.hash || fileId,
              cover: coverUrl,
              fileSize: item.file.size,
            };

            const apiUrl = item.duplicateVideoId
              ? addAppwriteConfigToUrl(`${API_ENDPOINTS.VIDEO}/${item.duplicateVideoId}`)
              : addAppwriteConfigToUrl(API_ENDPOINTS.VIDEO);
            const method = item.duplicateVideoId ? 'PUT' : 'POST';
            const response = await fetch(apiUrl, {
              method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });

            if (response.ok) successCount++;
            else failedCount++;
          } catch (error) {
            updateUploadProgressItem(progressKey, {
              status: 'error',
              message: error instanceof Error ? error.message : '失敗',
            });
            failedCount++;
          }
        }

        if (successCount === 0 && skippedCount > 0 && failedCount === 0) {
          throw new Error('選取的影片都與既有影片重複，沒有新增任何資料。');
        }

        if (successCount === 0 && failedCount > 0) {
          throw new Error('批次上傳失敗，沒有新增任何影片。');
        }

        alert(`批次上傳完成\n成功：${successCount} 部\n跳過重複：${skippedCount} 部\n失敗：${failedCount} 部`);
      } else {
        const finalFormData = { ...formData };

        if (selectedFile) {
          const progressKey = getSelectedVideoUploadKey(selectedFile, fileHash);
          const { url, fileId, filetype } = await uploadVideoFile(selectedFile, progressKey);
          finalFormData.file = url;
          finalFormData.filetype = filetype || finalFormData.filetype;
          finalFormData.hash = fileHash || fileId;
          (finalFormData as typeof finalFormData & { fileSize?: number }).fileSize = selectedFile.size;
        } else if (!finalFormData.hash) {
          finalFormData.hash = `no_file_${Date.now()}`;
        }

        if (selectedCoverFile) {
          const { url } = await uploadCoverFile(selectedCoverFile);
          finalFormData.cover = url;
        }

        const singleDuplicateId = duplicateItems[0]?.duplicateVideoId;
        const apiUrl = singleDuplicateId
          ? addAppwriteConfigToUrl(`${API_ENDPOINTS.VIDEO}/${singleDuplicateId}`)
          : addAppwriteConfigToUrl(API_ENDPOINTS.VIDEO);
        const method = singleDuplicateId ? 'PUT' : 'POST';
        const response = await fetch(apiUrl, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(finalFormData),
        });

        if (!response.ok) throw new Error('新增失敗');
      }
      onSuccess();
    } catch (error) {
      alert(error instanceof Error ? error.message : '操作失敗');
      setSubmitting(false);
    }
  };

  return (
    <div className={`bg-white dark:bg-[#1f1f1f] rounded-xl overflow-hidden shadow-sm border-2 border-blue-500 dark:border-blue-400 p-4 space-y-3 animate-in zoom-in-95 duration-300 ${compact ? '' : ''}`}>
      <div className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-1">新增中</div>
      <Input placeholder={selectedFiles.length > 1 ? "多部上傳時會自動使用各自檔名" : "影片名稱"} value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="h-9 rounded-lg text-sm" disabled={submitting || selectedFiles.length > 1} />
      <Input placeholder="分類" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className={`h-9 rounded-lg text-sm ${useCategorySelect && existingCategories.length > 0 ? 'hidden' : ''}`} />
      {useCategorySelect && existingCategories.length > 0 ? (
        <Select
          value={formData.category}
          onValueChange={(value) => {
            if (value === '__custom__') {
              setUseCategorySelect(false);
              setFormData({ ...formData, category: '' });
            } else {
              setFormData({ ...formData, category: value });
            }
          }}
        >
          <SelectTrigger className="h-9 rounded-lg text-sm">
            <SelectValue placeholder="選擇分類" />
          </SelectTrigger>
          <SelectContent>
            {existingCategories.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
            <SelectItem value="__custom__">自行輸入...</SelectItem>
          </SelectContent>
        </Select>
      ) : null}
      {!useCategorySelect && existingCategories.length > 0 && (
        <Button type="button" variant="outline" size="sm" onClick={() => setUseCategorySelect(true)} className="w-full rounded-lg text-xs">
          從現有分類中選擇
        </Button>
      )}
      <Input placeholder="參考" value={formData.ref} onChange={(e) => setFormData({ ...formData, ref: e.target.value })} className="h-9 rounded-lg text-sm" />
      <Textarea placeholder="備註" value={formData.note} onChange={(e) => setFormData({ ...formData, note: e.target.value })} className={`rounded-lg text-sm resize-none ${compact ? 'h-16' : 'h-20'}`} />
      <Input placeholder="影片 URL（選填）" value={formData.file} onChange={(e) => setFormData({ ...formData, file: e.target.value })} className="h-9 rounded-lg text-sm" disabled={submitting} />
      <label className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg cursor-pointer transition-colors">
        <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
          {previewLoading ? '載入中...' : selectedFiles.length > 1 ? `已選擇 ${selectedFiles.length} 部影片` : selectedFile ? selectedFile.name : '上傳影片'}
        </span>
        <input type="file" accept="video/mp4,video/webm,video/ogg,video/quicktime" multiple onChange={(e) => handleFileSelect(Array.from(e.target.files || []))} disabled={submitting || previewLoading} className="hidden" />
      </label>
      {selectedFiles.length > 1 && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          將建立 {selectedFiles.length} 筆影片資料；分類、備註與參考會共用，封面會自動使用各自第 1 秒截圖。
        </p>
      )}
      <VideoUploadProgressList items={uploadProgressItems} />
      {previewUrl && (
        <video src={previewUrl} controls className="max-h-40 w-full rounded-lg border border-gray-200 dark:border-gray-700" />
      )}
      {duplicateWarning && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm font-medium text-red-600 dark:text-red-400">{duplicateWarning}</p>
        </div>
      )}
      {(coverPreviewUrl || formData.cover) && (
        <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
          <img src={coverPreviewUrl || formData.cover} alt="封面預覽" className="w-full h-full object-cover" />
          <button onClick={() => { setSelectedCoverFile(null); setCoverPreviewUrl(''); setFormData({ ...formData, cover: '' }); }} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
      <Input placeholder="封面圖 URL" value={formData.cover} onChange={(e) => setFormData({ ...formData, cover: e.target.value })} className="h-9 rounded-lg text-sm" />
      <label className="flex items-center justify-center gap-2 px-3 py-2 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg cursor-pointer transition-colors">
        <Upload className="w-4 h-4 text-purple-600 dark:text-purple-400" />
        <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
          {coverPreviewLoading ? '載入中...' : selectedCoverFile ? selectedCoverFile.name : '上傳封面圖'}
        </span>
        <input type="file" accept="image/jpeg,image/jpg,image/png,image/gif,image/webp" onChange={(e) => handleCoverFileSelect(e.target.files?.[0] || null)} disabled={submitting || coverPreviewLoading} className="hidden" />
      </label>
      {uploadStatus === 'uploading' && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400"><span>影片上傳中...</span><span>{uploadProgress}%</span></div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2"><div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} /></div>
        </div>
      )}
      {coverUploadStatus === 'uploading' && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400"><span>封面上傳中...</span><span>{coverUploadProgress}%</span></div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2"><div className="bg-purple-600 h-2 rounded-full transition-all duration-300" style={{ width: `${coverUploadProgress}%` }} /></div>
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <Button onClick={handleSave} disabled={submitting} className="flex-1 gap-1 bg-green-500 hover:bg-green-600 rounded-lg text-xs py-1.5 disabled:opacity-50">
          {submitting ? '新增中...' : '新增'}
        </Button>
        <Button onClick={onCancel} variant="outline" disabled={submitting} className="flex-1 gap-1 rounded-lg text-xs py-1.5">
          取消
        </Button>
      </div>
    </div>
  );
}

// 影片管理卡片 (YouTube 2024 首頁風格)
function VideoManagementCard({ video, cacheStatus, onPlay, onEdit, onDelete, onDownload, onDirectDownload, onDeleteCache, onAddToQueue, isInQueue, isEditing, inlineEditForm, setInlineEditForm, onInlineEdit, onInlineSave, onInlineCancel, inlineVideoFile, inlineVideoPreviewName, inlineVideoUploading, inlineVideoUploadProgress, inlineVideoDuplicateWarning, onInlineVideoSelect, inlineCoverFile, setInlineCoverFile, inlineCoverPreview, setInlineCoverPreview, inlineCoverUploading }: VideoManagementCardProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [showHoverActions, setShowHoverActions] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inlineCoverInputRef = useRef<HTMLInputElement>(null);

  // 處理行內編輯封面上傳
  const handleInlineCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) { alert('只支援 JPG, PNG, GIF, WEBP 格式的圖片'); return; }
    if (file.size > 10 * 1024 * 1024) { alert('封面圖大小不能超過 10MB'); return; }
    setInlineCoverFile(file);
    setInlineCoverPreview(URL.createObjectURL(file));
  };

  useEffect(() => {
    if (!video.cover && video.file) {
      const videoElement = document.createElement('video');
      videoElement.src = video.file;
      videoElement.crossOrigin = 'anonymous';
      videoElement.currentTime = 1;
      videoElement.addEventListener('seeked', () => {
        const canvas = canvasRef.current || document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
          setThumbnailUrl(canvas.toDataURL('image/jpeg', 0.8));
        }
      });
      videoElement.load();
    }
  }, [video.cover, video.file]);

  // 行內編輯模式 - 全卡片取代
  if (isEditing) {
    return (
      <div className="flex flex-col gap-2.5 animate-in zoom-in-95 duration-300">
        <div className="bg-white dark:bg-[#1f1f1f] rounded-xl overflow-hidden shadow-sm border-2 border-blue-500 dark:border-blue-400 p-4 space-y-3">
          <div className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-1">編輯中</div>
          <Input placeholder="影片名稱" value={inlineEditForm.name} onChange={(e) => setInlineEditForm({ ...inlineEditForm, name: e.target.value })} className="h-9 rounded-lg text-sm" />
          <label className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg cursor-pointer transition-colors">
            <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{inlineVideoUploading ? '上傳中...' : inlineVideoFile ? inlineVideoPreviewName : '重新上傳影片'}</span>
            <input type="file" accept="video/mp4,video/webm,video/ogg,video/quicktime" onChange={(e) => onInlineVideoSelect(e.target.files?.[0] || null, video)} disabled={inlineVideoUploading || inlineCoverUploading} className="hidden" />
          </label>
          {inlineVideoPreviewName && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
              已選擇影片: {inlineVideoPreviewName}
            </div>
          )}
          {inlineVideoDuplicateWarning && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm font-medium text-red-600 dark:text-red-400">{inlineVideoDuplicateWarning}</p>
            </div>
          )}
          {inlineVideoUploading && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                <span>上傳影片至 Appwrite...</span>
                <span>{inlineVideoUploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${inlineVideoUploadProgress}%` }} />
              </div>
            </div>
          )}
          <Input placeholder="分類" value={inlineEditForm.category} onChange={(e) => setInlineEditForm({ ...inlineEditForm, category: e.target.value })} className="h-9 rounded-lg text-sm" />
          <Input placeholder="參考" value={inlineEditForm.ref} onChange={(e) => setInlineEditForm({ ...inlineEditForm, ref: e.target.value })} className="h-9 rounded-lg text-sm" />
          <Textarea placeholder="備註" value={inlineEditForm.note} onChange={(e) => setInlineEditForm({ ...inlineEditForm, note: e.target.value })} className="rounded-lg text-sm h-20 resize-none" />
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">封面圖</label>
            {(inlineCoverPreview || inlineEditForm.cover) && (
              <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                <img src={inlineCoverPreview || inlineEditForm.cover} alt="封面預覽" className="w-full h-full object-cover" />
                <button onClick={(e) => { e.stopPropagation(); setInlineCoverFile(null); setInlineCoverPreview(''); setInlineEditForm({ ...inlineEditForm, cover: '' }); if (inlineCoverInputRef.current) inlineCoverInputRef.current.value = ''; }} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"><X className="w-3 h-3" /></button>
              </div>
            )}
            <Input placeholder="封面圖 URL" value={inlineEditForm.cover} onChange={(e) => setInlineEditForm({ ...inlineEditForm, cover: e.target.value })} className="h-9 rounded-lg text-sm" />
            <label className="flex items-center justify-center gap-2 px-3 py-2 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg cursor-pointer transition-colors">
              <Upload className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span className="text-sm font-medium text-purple-600 dark:text-purple-400">{inlineCoverUploading ? '上傳中...' : inlineCoverFile ? inlineCoverFile.name : '上傳封面圖'}</span>
              <input ref={inlineCoverInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/gif,image/webp" onChange={handleInlineCoverSelect} disabled={inlineCoverUploading} className="hidden" />
            </label>
          </div>
          <div className="flex gap-2 pt-1">
            <Button onClick={(e) => { e.stopPropagation(); onInlineSave(video.$id); }} disabled={inlineCoverUploading || inlineVideoUploading || !!inlineVideoDuplicateWarning} className="flex-1 gap-1 bg-green-500 hover:bg-green-600 rounded-lg text-xs py-1.5 disabled:opacity-50">{inlineCoverUploading || inlineVideoUploading ? '上傳中...' : '儲存'}</Button>
            <Button onClick={(e) => { e.stopPropagation(); onInlineCancel(); }} variant="outline" disabled={inlineCoverUploading || inlineVideoUploading} className="flex-1 gap-1 rounded-lg text-xs py-1.5 disabled:opacity-50">取消</Button>
          </div>
        </div>
      </div>
    );
  }

  const actionBtn =
    "inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/75 text-white transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";

  return (
    <article className="group flex flex-col gap-2.5">
      <canvas ref={canvasRef} style={{ display: "none" }} />

      <div
        className={`relative aspect-video overflow-hidden rounded-xl bg-neutral-200 dark:bg-[#272727] ${video.file ? "cursor-pointer" : ""}`}
        onClick={video.file ? onPlay : undefined}
        onMouseEnter={() => setShowHoverActions(true)}
        onMouseLeave={() => setShowHoverActions(false)}
      >
        {(video.cover || thumbnailUrl) && (
          <img
            src={video.cover || thumbnailUrl || ""}
            alt=""
            className="h-full w-full object-cover"
          />
        )}
        {!video.cover && !thumbnailUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#383838] to-[#181818]">
            <Play className="h-10 w-10 text-white/15" />
          </div>
        )}

        {!video.file && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="space-y-1 text-center">
              <Upload className="mx-auto h-6 w-6 text-white/60" />
              <p className="text-xs font-medium text-white/85">尚未上傳</p>
            </div>
          </div>
        )}

        {video.file && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity duration-200 group-hover:bg-black/15 group-hover:opacity-100 group-focus-within:bg-black/15 group-focus-within:opacity-100">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white">
              <Play className="h-5 w-5 fill-current" />
            </div>
          </div>
        )}

        {video.file && (
          <div className="absolute left-2 top-2">
            <CacheStatusIcon status={cacheStatus} />
          </div>
        )}

        {video.category && (
          <span className="absolute bottom-2 left-2 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {video.category}
          </span>
        )}

        {/* 真實管理操作：hover / focus 顯示 */}
        <div
          className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          {video.file && onAddToQueue && (
            <button
              type="button"
              onClick={onAddToQueue}
              className={`${actionBtn} ${isInQueue ? "!bg-emerald-600 hover:!bg-emerald-500" : ""}`}
              title={isInQueue ? "已在佇列" : "加入佇列"}
              aria-label={isInQueue ? "已在佇列" : "加入佇列"}
            >
              <ListPlus className="h-3.5 w-3.5" />
            </button>
          )}
          {video.file && (
            <button type="button" onClick={onDirectDownload} className={actionBtn} title="下載" aria-label="下載">
              <Download className="h-3.5 w-3.5" />
            </button>
          )}
          {video.file &&
            (cacheStatus?.cached ? (
              <button type="button" onClick={onDeleteCache} className={`${actionBtn} !bg-orange-600/90`} title="刪除快取" aria-label="刪除快取">
                <HardDrive className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onDownload}
                disabled={cacheStatus?.downloading}
                className={`${actionBtn} disabled:opacity-50`}
                title={cacheStatus?.downloading ? "快取中" : "快取"}
                aria-label="快取到本地"
              >
                <HardDrive className="h-3.5 w-3.5" />
              </button>
            ))}
          <button type="button" onClick={() => onInlineEdit(video)} className={actionBtn} title="編輯" aria-label="編輯">
            <Edit className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onDelete} className={`${actionBtn} hover:!bg-red-600`} title="刪除" aria-label="刪除">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {video.file && showHoverActions && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ff0000]" aria-hidden />
        )}
      </div>

      <div className="flex gap-3">
        <div
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white dark:bg-white dark:text-neutral-900"
          aria-hidden
        >
          FX
        </div>
        <div className="min-w-0 flex-1">
          <h3
            className={`line-clamp-2 text-sm font-medium leading-5 text-neutral-900 dark:text-white ${
              video.file ? "cursor-pointer hover:text-neutral-600 dark:hover:text-neutral-300" : ""
            }`}
            onClick={video.file ? onPlay : undefined}
          >
            {video.name}
          </h3>
          <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">鋒兄影片</p>
          <div className="flex flex-wrap items-center gap-x-1 text-xs text-neutral-600 dark:text-neutral-400">
            <span>{formatLocalDate(video.$createdAt)}</span>
            <span aria-hidden>•</span>
            <span>{formatVideoFileSize(video)}</span>
            {!video.file && (
              <>
                <span aria-hidden>•</span>
                <span className="text-orange-600 dark:text-orange-400">尚未上傳</span>
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

// Bilibili 風格影片卡片
function BilibiliVideoCard({ video, cacheStatus, onPlay, onEdit, onDelete, onDownload, onDirectDownload, onDeleteCache, onAddToQueue, isInQueue, isEditing, inlineEditForm, setInlineEditForm, onInlineEdit, onInlineSave, onInlineCancel, inlineVideoFile, inlineVideoPreviewName, inlineVideoUploading, inlineVideoUploadProgress, inlineVideoDuplicateWarning, onInlineVideoSelect, inlineCoverFile, setInlineCoverFile, inlineCoverPreview, setInlineCoverPreview, inlineCoverUploading }: VideoManagementCardProps) {
  const [showActions, setShowActions] = useState(false);
  const inlineCoverInputRef = useRef<HTMLInputElement>(null);

  const handleInlineCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) { alert('只支援 JPG, PNG, GIF, WEBP 格式的圖片'); return; }
    if (file.size > 10 * 1024 * 1024) { alert('封面圖大小不能超過 10MB'); return; }
    setInlineCoverFile(file);
    setInlineCoverPreview(URL.createObjectURL(file));
  };

  if (isEditing) {
    return (
      <div className="bg-white dark:bg-[#1d1d1d] rounded-lg overflow-hidden shadow-sm border dark:border-white/5 p-3 space-y-2">
        <Input placeholder="影片名稱" value={inlineEditForm.name} onChange={(e) => setInlineEditForm({ ...inlineEditForm, name: e.target.value })} className="h-8 rounded-lg text-sm" />
        <label className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg cursor-pointer transition-colors">
          <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{inlineVideoUploading ? '上傳中...' : inlineVideoFile ? inlineVideoPreviewName : '重新上傳影片'}</span>
          <input type="file" accept="video/mp4,video/webm,video/ogg,video/quicktime" onChange={(e) => onInlineVideoSelect(e.target.files?.[0] || null, video)} disabled={inlineVideoUploading || inlineCoverUploading} className="hidden" />
        </label>
        {inlineVideoPreviewName && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
            已選擇影片: {inlineVideoPreviewName}
          </div>
        )}
        {inlineVideoDuplicateWarning && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm font-medium text-red-600 dark:text-red-400">{inlineVideoDuplicateWarning}</p>
          </div>
        )}
        {inlineVideoUploading && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
              <span>上傳影片至 Appwrite...</span>
              <span>{inlineVideoUploadProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${inlineVideoUploadProgress}%` }} />
            </div>
          </div>
        )}
        <Input placeholder="分類" value={inlineEditForm.category} onChange={(e) => setInlineEditForm({ ...inlineEditForm, category: e.target.value })} className="h-8 rounded-lg text-sm" />
        <Input placeholder="參考" value={inlineEditForm.ref} onChange={(e) => setInlineEditForm({ ...inlineEditForm, ref: e.target.value })} className="h-8 rounded-lg text-sm" />
        <Textarea placeholder="備註" value={inlineEditForm.note} onChange={(e) => setInlineEditForm({ ...inlineEditForm, note: e.target.value })} className="rounded-lg text-sm h-16 resize-none" />
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">封面圖</label>
          {(inlineCoverPreview || inlineEditForm.cover) && (
            <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
              <img src={inlineCoverPreview || inlineEditForm.cover} alt="封面預覽" className="w-full h-full object-cover" />
              <button onClick={() => { setInlineCoverFile(null); setInlineCoverPreview(''); setInlineEditForm({ ...inlineEditForm, cover: '' }); }} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"><X className="w-3 h-3" /></button>
            </div>
          )}
          <Input placeholder="封面圖 URL" value={inlineEditForm.cover} onChange={(e) => setInlineEditForm({ ...inlineEditForm, cover: e.target.value })} className="h-8 rounded-lg text-sm" />
          <label className="flex items-center justify-center gap-2 px-3 py-2 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg cursor-pointer transition-colors">
            <Upload className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span className="text-sm font-medium text-purple-600 dark:text-purple-400">{inlineCoverUploading ? '上傳中...' : inlineCoverFile ? inlineCoverFile.name : '上傳封面圖'}</span>
            <input ref={inlineCoverInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/gif,image/webp" onChange={handleInlineCoverSelect} disabled={inlineCoverUploading} className="hidden" />
          </label>
        </div>
        <div className="flex gap-2 pt-1">
          <Button onClick={() => onInlineSave(video.$id)} disabled={inlineCoverUploading || inlineVideoUploading || !!inlineVideoDuplicateWarning} className="flex-1 gap-1 bg-green-500 hover:bg-green-600 rounded-lg text-xs py-1.5">{inlineCoverUploading || inlineVideoUploading ? '上傳中...' : '儲存'}</Button>
          <Button onClick={onInlineCancel} variant="outline" disabled={inlineCoverUploading || inlineVideoUploading} className="flex-1 gap-1 rounded-lg text-xs py-1.5">取消</Button>
        </div>
      </div>
    );
  }

  const actionBtn =
    "inline-flex h-7 w-7 items-center justify-center rounded bg-black/70 text-white transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a1d6]";

  return (
    <article
      className="group relative overflow-hidden rounded-lg border border-neutral-200/90 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md dark:border-[#2c2c2e] dark:bg-[#1d1d1d]"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div
        className={`relative aspect-[16/10] overflow-hidden bg-neutral-100 dark:bg-[#2b2b2b] ${video.file ? "cursor-pointer" : ""}`}
        onClick={video.file ? onPlay : undefined}
      >
        {video.cover ? (
          <img
            src={video.cover}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-600 to-neutral-900">
            <Play className="h-8 w-8 text-white/15" />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/75 to-transparent" />

        {video.category && (
          <span className="absolute bottom-2 left-2 rounded bg-[#00a1d6] px-1.5 py-0.5 text-[10px] font-bold text-white">
            {video.category}
          </span>
        )}
        <span className="absolute bottom-2 right-2 text-[10px] font-medium text-white/90">
          {formatLocalDate(video.$createdAt)}
        </span>

        {video.file && (
          <div className="absolute left-2 top-2">
            <CacheStatusIcon status={cacheStatus} />
          </div>
        )}

        {!video.file && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="space-y-1 text-center">
              <Upload className="mx-auto h-5 w-5 text-white/60" />
              <p className="text-xs font-medium text-white/80">尚未上傳</p>
            </div>
          </div>
        )}

        {video.file && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-150 group-hover:bg-black/20 group-hover:opacity-100 group-focus-within:bg-black/20 group-focus-within:opacity-100">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/25 text-white backdrop-blur-sm">
              <Play className="h-5 w-5 fill-current" />
            </div>
          </div>
        )}

        <div
          className={`absolute right-2 top-2 flex items-center gap-1 transition-opacity duration-150 ${
            showActions ? "opacity-100" : "opacity-0 group-focus-within:opacity-100"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {video.file && onAddToQueue && (
            <button
              type="button"
              onClick={onAddToQueue}
              className={`${actionBtn} ${isInQueue ? "!bg-emerald-500" : ""}`}
              title={isInQueue ? "已在佇列" : "加入佇列"}
              aria-label={isInQueue ? "已在佇列" : "加入佇列"}
            >
              <ListPlus className="h-3.5 w-3.5" />
            </button>
          )}
          {video.file && (
            <button type="button" onClick={onDirectDownload} className={actionBtn} title="下載" aria-label="下載">
              <Download className="h-3.5 w-3.5" />
            </button>
          )}
          {video.file &&
            (cacheStatus?.cached ? (
              <button type="button" onClick={onDeleteCache} className={`${actionBtn} !bg-orange-500`} title="刪除快取" aria-label="刪除快取">
                <HardDrive className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onDownload}
                disabled={cacheStatus?.downloading}
                className={`${actionBtn} disabled:opacity-50`}
                title="快取"
                aria-label="快取到本地"
              >
                <HardDrive className="h-3.5 w-3.5" />
              </button>
            ))}
          <button type="button" onClick={() => onInlineEdit(video)} className={actionBtn} title="編輯" aria-label="編輯">
            <Edit className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onDelete} className={`${actionBtn} hover:!bg-red-600`} title="刪除" aria-label="刪除">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-1 p-2.5">
        <h3
          className={`line-clamp-2 text-sm font-bold leading-snug text-neutral-900 transition-colors dark:text-white ${
            video.file ? "cursor-pointer group-hover:text-[#00a1d6]" : ""
          }`}
          onClick={video.file ? onPlay : undefined}
        >
          {video.name}
        </h3>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#00a1d6] text-[8px] font-bold text-white">
            F
          </span>
          <span>鋒兄影片</span>
          <span aria-hidden>•</span>
          <span>{formatVideoFileSize(video)}</span>
        </div>
      </div>
    </article>
  );
}

// Bilibili 皮播放器 — 極簡控制、更緊密度
function BilibiliPlayerModal({
  video,
  onClose,
  onPersistPlayback,
}: {
  video: VideoData;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onClose: () => void;
  onPersistPlayback: (video: VideoData, playback: VideoPersistPlayback) => void;
}) {
  const { videos } = useVideos();
  const [autoPlay, setAutoPlay] = useState(true);
  const [repeatMode, setRepeatMode] = useState(false);
  const [currentVideo, setCurrentVideo] = useState<VideoData>(video);
  const [playedIds, setPlayedIds] = useState<Set<string>>(() => new Set([video.$id]));
  const [showDescription, setShowDescription] = useState(false);
  const { resolvedSrc, loadingSource, sourceError } = useResolvedVideoSource(currentVideo);

  const allVideosWithFile = useMemo(() => videos.filter((v) => v.file), [videos]);
  const hasPlaylist = allVideosWithFile.length > 1;

  const recommendedVideos = useMemo(
    () => buildRecommendedVideos(allVideosWithFile, currentVideo.$id, playedIds),
    [allVideosWithFile, currentVideo.$id, playedIds]
  );

  const goToVideo = useCallback((next: VideoData) => {
    setPlayedIds((prev) => new Set([...prev, next.$id]));
    setCurrentVideo(next);
    setShowDescription(false);
  }, []);

  const goAdjacent = useCallback(
    (direction: "prev" | "next") => {
      const next = pickAdjacentVideo(allVideosWithFile, currentVideo.$id, direction);
      if (next) goToVideo(next);
    },
    [allVideosWithFile, currentVideo.$id, goToVideo]
  );

  const handleVideoEnded = useCallback(() => {
    if (repeatMode) {
      const player = document.querySelector(".plyr video") as HTMLVideoElement | null;
      if (player) {
        player.currentTime = 0;
        void player.play().catch(() => {});
      }
      return;
    }
    if (!autoPlay) return;
    const currentIndex = allVideosWithFile.findIndex((v) => v.$id === currentVideo.$id);
    let nextVideo: VideoData | null = null;
    for (let i = 1; i < allVideosWithFile.length; i++) {
      const nextIndex = (currentIndex + i) % allVideosWithFile.length;
      const candidate = allVideosWithFile[nextIndex];
      if (!playedIds.has(candidate.$id)) {
        nextVideo = candidate;
        break;
      }
    }
    if (!nextVideo && allVideosWithFile.length > 1) {
      const nextIndex = (currentIndex + 1) % allVideosWithFile.length;
      nextVideo = allVideosWithFile[nextIndex];
      setPlayedIds(new Set([nextVideo.$id]));
    } else if (nextVideo) {
      setPlayedIds((prev) => new Set([...prev, nextVideo!.$id]));
    }
    if (nextVideo) {
      setCurrentVideo(nextVideo);
      setShowDescription(false);
    }
  }, [repeatMode, autoPlay, allVideosWithFile, currentVideo.$id, playedIds]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goAdjacent("prev");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goAdjacent("next");
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, goAdjacent]);

  const overlayNavBtn =
    "absolute top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity duration-200 hover:bg-black/80 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a1d6] group-hover:opacity-100 group-focus-within:opacity-100";

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[#f4f4f4] motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200 dark:bg-[#17181a]"
      role="dialog"
      aria-modal="true"
      aria-label={`播放：${currentVideo.name}`}
    >
      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 backdrop-blur-md dark:border-[#2c2c2e] dark:bg-[#1f2022]/95">
        <div className="mx-auto flex h-11 max-w-[1400px] items-center justify-between gap-3 px-4 sm:h-12 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#00a1d6]" aria-hidden>
              <Play className="h-3.5 w-3.5 fill-current text-white" />
            </div>
            <span className="truncate text-sm font-bold text-neutral-900 dark:text-white sm:text-base">鋒兄影片</span>
            <span className="hidden text-xs font-medium text-[#00a1d6] sm:inline">Bilibili 模式</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-neutral-800 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a1d6] dark:text-white dark:hover:bg-[#2c2c2e]"
            aria-label="關閉播放器"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] p-3 sm:p-4 lg:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:gap-5">
          <div className="min-w-0 flex-1 space-y-2.5 lg:max-w-[calc(100%-340px)]">
            <div className="group relative aspect-video overflow-hidden rounded-lg bg-black shadow-md ring-1 ring-black/10 dark:ring-white/5 [&_.plyr]:!h-full [&_.plyr]:!w-full [&_.plyr]:rounded-lg">
              {hasPlaylist && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      goAdjacent("prev");
                    }}
                    className={`${overlayNavBtn} left-3`}
                    title="上一則"
                    aria-label="上一則影片"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      goAdjacent("next");
                    }}
                    className={`${overlayNavBtn} right-3`}
                    title="下一則"
                    aria-label="下一則影片"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                </>
              )}
              {loadingSource ? (
                <div className="flex h-full w-full items-center justify-center text-sm text-white/80">影片載入中…</div>
              ) : sourceError ? (
                <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-red-400">{sourceError}</div>
              ) : (
                <PlyrPlayer
                  key={currentVideo.$id}
                  type="video"
                  src={resolvedSrc}
                  poster={currentVideo.cover}
                  autoplay
                  onEnded={handleVideoEnded}
                  persistOnUnmount
                  onPersistPlayback={(playback) => onPersistPlayback(currentVideo, playback)}
                  className="h-full w-full"
                />
              )}
            </div>

            <h1 className="line-clamp-2 text-base font-bold leading-snug text-balance text-neutral-900 dark:text-white md:text-lg">
              {currentVideo.name}
            </h1>

            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
              <span>{formatLocalDate(currentVideo.$createdAt)}</span>
              {currentVideo.category && (
                <span className="rounded bg-[#00a1d6]/12 px-2 py-0.5 text-[11px] font-medium text-[#00a1d6]">
                  {currentVideo.category}
                </span>
              )}
            </div>

            {/* 極簡控制列 */}
            <div className="flex flex-wrap items-center gap-1.5 border-y border-neutral-200 py-2.5 dark:border-[#2c2c2e]">
              {hasPlaylist && (
                <>
                  <button
                    type="button"
                    onClick={() => goAdjacent("prev")}
                    className="inline-flex h-9 items-center gap-1 rounded px-2.5 text-xs font-medium text-neutral-800 transition-colors hover:bg-neutral-200/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a1d6] dark:text-neutral-200 dark:hover:bg-[#2c2c2e]"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    上一則
                  </button>
                  <button
                    type="button"
                    onClick={() => goAdjacent("next")}
                    className="inline-flex h-9 items-center gap-1 rounded px-2.5 text-xs font-medium text-neutral-800 transition-colors hover:bg-neutral-200/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a1d6] dark:text-neutral-200 dark:hover:bg-[#2c2c2e]"
                  >
                    下一則
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setAutoPlay((v) => !v)}
                disabled={repeatMode}
                title={repeatMode ? "重複模式下自動播放已停用" : "自動播放下一則"}
                aria-pressed={autoPlay && !repeatMode}
                className={`inline-flex h-9 items-center rounded px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a1d6] disabled:cursor-not-allowed disabled:opacity-45 ${
                  autoPlay && !repeatMode
                    ? "bg-[#00a1d6] text-white hover:bg-[#0091c2]"
                    : "bg-neutral-200 text-neutral-700 hover:bg-neutral-300 dark:bg-[#2c2c2e] dark:text-neutral-300 dark:hover:bg-[#3c3c3e]"
                }`}
              >
                自動播放 {autoPlay && !repeatMode ? "開" : "關"}
              </button>
              <button
                type="button"
                onClick={() => setRepeatMode((v) => !v)}
                title="重複播放同一則"
                aria-pressed={repeatMode}
                className={`inline-flex h-9 items-center rounded px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a1d6] ${
                  repeatMode
                    ? "bg-[#00a1d6] text-white"
                    : "bg-neutral-200 text-neutral-700 hover:bg-neutral-300 dark:bg-[#2c2c2e] dark:text-neutral-300 dark:hover:bg-[#3c3c3e]"
                }`}
              >
                重複 {repeatMode ? "開" : "關"}
              </button>
            </div>

            {/* 折疊簡介 */}
            <div className="rounded-lg border border-neutral-200 bg-white dark:border-[#2c2c2e] dark:bg-[#1f2022]">
              <button
                type="button"
                onClick={() => setShowDescription((v) => !v)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#00a1d6] dark:text-neutral-300 dark:hover:bg-[#252628]"
                aria-expanded={showDescription}
              >
                <span>影片簡介</span>
                {showDescription ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
              </button>
              {showDescription && (
                <div className="space-y-2 border-t border-neutral-100 px-3 py-2.5 dark:border-[#2c2c2e]">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-neutral-600 dark:text-neutral-400">
                    {currentVideo.note || "暫無詳細描述。"}
                  </p>
                  {currentVideo.ref && (
                    <a
                      href={currentVideo.ref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block break-all text-sm text-[#00a1d6] hover:underline"
                    >
                      {currentVideo.ref}
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 側欄：播放列表 */}
          <aside className="w-full shrink-0 space-y-2 lg:w-[320px]">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-neutral-900 dark:text-white">播放列表</h2>
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400">{recommendedVideos.length} 則</span>
            </div>
            <div className="space-y-1">
              {recommendedVideos.length === 0 ? (
                <p className="rounded-md border border-neutral-200 bg-white px-3 py-6 text-center text-xs text-neutral-500 dark:border-[#2c2c2e] dark:bg-[#1f2022] dark:text-neutral-400">
                  沒有其他可播放影片
                </p>
              ) : (
                recommendedVideos.map((recVideo) => (
                  <button
                    key={recVideo.$id}
                    type="button"
                    onClick={() => goToVideo(recVideo)}
                    className={`group/rec flex w-full gap-2 rounded-md p-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a1d6] ${
                      recVideo.$id === currentVideo.$id
                        ? "bg-white shadow-sm ring-1 ring-[#00a1d6]/30 dark:bg-[#1f2022]"
                        : "hover:bg-white dark:hover:bg-[#1f2022]"
                    }`}
                  >
                    <div className="relative aspect-[16/10] w-[132px] shrink-0 overflow-hidden rounded bg-neutral-200 dark:bg-[#2b2b2b] sm:w-[140px]">
                      {recVideo.cover ? (
                        <img
                          src={recVideo.cover}
                          alt=""
                          className="h-full w-full object-cover transition-transform duration-200 motion-safe:group-hover/rec:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-600 to-neutral-900">
                          <Play className="h-4 w-4 text-white/20" />
                        </div>
                      )}
                      {recVideo.category && (
                        <span className="absolute bottom-1 left-1 rounded bg-[#00a1d6] px-1 py-0.5 text-[8px] font-bold text-white">
                          {recVideo.category}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 py-0.5">
                      <h3 className="line-clamp-2 text-xs font-bold leading-snug text-neutral-900 transition-colors group-hover/rec:text-[#00a1d6] dark:text-white">
                        {recVideo.name}
                      </h3>
                      <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                        {formatLocalDate(recVideo.$createdAt)}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

// 影片表單模態框
function VideoFormModal({ video, existingVideos, onClose, onSuccess }: { video: VideoData | null; existingVideos: VideoData[]; onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: video?.name || '',
    file: video?.file || '',
    filetype: video?.filetype || '',
    note: video?.note || '',
    ref: video?.ref || '',
    category: video?.category || '',
    hash: video?.hash || '',
    cover: typeof video?.cover === 'string' ? video.cover : '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Array<{
    file: File;
    hash: string;
    filetype: string;
    defaultName: string;
    duplicateVideoName?: string;
    duplicateVideoId?: string;
  }>>([]);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadProgressItems, setUploadProgressItems] = useState<VideoUploadProgressItem[]>([]);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [fileHash, setFileHash] = useState<string>(''); // 儲存檔案 hash
  const [duplicateWarning, setDuplicateWarning] = useState<string>(''); // 重複警告
  const [selectedCoverFile, setSelectedCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string>('');
  const [coverPreviewLoading, setCoverPreviewLoading] = useState(false);
  const [coverUploadProgress, setCoverUploadProgress] = useState(0);
  const [coverUploadStatus, setCoverUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [useCategorySelect, setUseCategorySelect] = useState(true); // 是否使用選擇框

  // 獲取所有已存在的分類
  const existingCategories = Array.from(new Set(existingVideos.map(v => v.category).filter(Boolean)));

  const updateUploadProgressItem = (key: string, patch: Partial<VideoUploadProgressItem>) => {
    setUploadProgressItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  };

  // 計算檔案 SHA-256 hash
  const calculateFileHash = async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    } catch (error) {
      console.error('Hash calculation error:', error);
      // 如果計算失敗，使用備用方案
      return `fallback_${file.name}_${file.size}_${file.lastModified}`;
    }
  };

  const createCoverFileFromVideo = (file: File): Promise<File | null> => new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.src = objectUrl;
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'metadata';

    let timeoutId: number;

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.src = '';
    };

    const fail = () => {
      window.clearTimeout(timeoutId);
      cleanup();
      resolve(null);
    };

    timeoutId = window.setTimeout(fail, 8000);

    const handleSeeked = () => {
      window.clearTimeout(timeoutId);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return fail();
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (!blob) return fail();
          const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '') || 'video';
          const thumbnailName = `${nameWithoutExt}-thumbnail.jpg`;
          cleanup();
          resolve(new File([blob], thumbnailName, { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.9);
      } catch (error) {
        console.error('Thumbnail generation error:', error);
        fail();
      }
    };

    const handleLoaded = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 1;
      const captureTime = duration > 1 ? 1 : Math.max(0, duration / 2 || 0);
      try {
        video.currentTime = captureTime;
      } catch {
        fail();
      }
    };

    video.addEventListener('loadedmetadata', handleLoaded, { once: true });
    video.addEventListener('seeked', handleSeeked, { once: true });
    video.addEventListener('error', (e) => {
      console.error('Video load error:', e);
      fail();
    }, { once: true });

    video.load();
  });

  const applyAutoCoverForSingle = async (file: File) => {
    setCoverPreviewLoading(true);
    const coverFile = await createCoverFileFromVideo(file);
    setCoverPreviewLoading(false);
    if (!coverFile) return;
    setSelectedCoverFile(coverFile);
    setCoverPreviewUrl(URL.createObjectURL(coverFile));
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
    const invalidTypeFile = files.find((file) => !validTypes.includes(file.type));
    if (invalidTypeFile) {
      alert(`檔案「${invalidTypeFile.name}」格式不支援，只支援 MP4, WebM, OGG, MOV`);
      return;
    }

    setPreviewLoading(true);
    setUploadStatus('idle');
    setUploadProgress(0);
    setDuplicateWarning('');

    const preparedFiles = await Promise.all(files.map(async (file) => {
      const hash = await calculateFileHash(file);
      const filetype = file.name.split('.').pop()?.toLowerCase() || '';
      const defaultName = file.name.replace(/\.[^/.]+$/, '');
      const duplicateVideo = existingVideos.find(vid =>
        vid.hash === hash && (!video || vid.$id !== video.$id)
      );

      return {
        file,
        hash,
        filetype,
        defaultName,
        duplicateVideoName: duplicateVideo?.name,
        duplicateVideoId: duplicateVideo?.$id,
      };
    }));

    const firstFile = preparedFiles[0];
    const objectUrl = URL.createObjectURL(firstFile.file);
    const duplicateCount = preparedFiles.filter((item) => item.duplicateVideoName).length;

    setSelectedFiles(preparedFiles);
    setUploadProgressItems(preparedFiles.map((item) => createUploadProgressItem(item.file, item.hash, item.defaultName)));
    setSelectedFile(firstFile.file);
    setPreviewUrl(objectUrl);
    setFileHash(firstFile.hash);

    if (preparedFiles.length === 1) {
      const autoName = !video ? firstFile.defaultName : (formData.name || firstFile.defaultName);
      setFormData({ ...formData, name: autoName, hash: firstFile.hash, filetype: firstFile.filetype });

      if (!formData.cover && !selectedCoverFile) {
        await applyAutoCoverForSingle(firstFile.file);
      }

      if (firstFile.duplicateVideoName) {
        setDuplicateWarning(`提醒：此影片與「${firstFile.duplicateVideoName}」相同，可在儲存時選擇用新檔取代。`);
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        name: '',
        hash: '',
        filetype: '',
      }));
      setSelectedCoverFile(null);
      setCoverPreviewUrl('');
      if (duplicateCount > 0) {
        setDuplicateWarning(`提醒：${duplicateCount} 部影片與既有影片重複，儲存時可選擇用新檔取代。`);
      }
    }

    setTimeout(() => setPreviewLoading(false), 300);
  };

  const uploadFileToAppwrite = async (file: File, progressKey?: string): Promise<{ url: string; fileId: string; filetype?: string }> => {
    setUploadStatus('uploading');
    setUploadProgress(0);
    if (progressKey) updateUploadProgressItem(progressKey, { status: 'uploading', progress: 0, message: '上傳中' });

    try {
      const result = file.size > MAX_VIDEO_PART_SIZE
        ? await uploadVideoInParts(file, (progress) => {
          setUploadProgress(progress);
          if (progressKey) updateUploadProgressItem(progressKey, { progress });
        })
        : await uploadToAppwriteStorage(file, (progress) => {
          setUploadProgress(progress);
          if (progressKey) updateUploadProgressItem(progressKey, { progress });
        });

      setUploadStatus('success');
      if (progressKey) updateUploadProgressItem(progressKey, { status: 'success', progress: 100, message: '完成' });
      return result;
    } catch (error) {
      setUploadStatus('error');
      if (progressKey) updateUploadProgressItem(progressKey, {
        status: 'error',
        message: error instanceof Error ? error.message : '失敗',
      });
      throw error;
    }
  };

  const handleCoverFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 檢查檔案大小 (50MB for cover images via direct Appwrite Storage upload)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('封面圖大小不能超過 50MB');
      return;
    }

    // 檢查檔案類型
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('只支援 JPG, PNG, GIF, WEBP 格式的圖片');
      return;
    }

    // 顯示預覽載入狀態
    setCoverPreviewLoading(true);
    setCoverUploadStatus('idle');
    setCoverUploadProgress(0);

    // 儲存檔案並產生預覽 URL
    setSelectedCoverFile(file);
    const objectUrl = URL.createObjectURL(file);
    setCoverPreviewUrl(objectUrl);

    // 模擬預覽載入完成
    setTimeout(() => setCoverPreviewLoading(false), 300);
  };

  const uploadCoverFileToAppwrite = async (file: File): Promise<{ url: string; fileId: string }> => {
    setCoverUploadStatus('uploading');
    setCoverUploadProgress(0);

    try {
      // Direct upload to Appwrite Storage (bypasses Next.js API route)
      const result = await uploadToAppwriteStorage(file, (progress) => {
        setCoverUploadProgress(progress);
      });

      setCoverUploadStatus('success');
      return result;
    } catch (error) {
      setCoverUploadStatus('error');
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFiles.length && !formData.name.trim()) {
      alert('請輸入影片名稱');
      return;
    }

    const duplicateItems = selectedFiles.filter((item) => item.duplicateVideoId);
    if (selectedFiles.length <= 1 && duplicateItems.length > 0) {
      const confirmed = window.confirm(`此影片與「${duplicateItems[0].duplicateVideoName}」重複，是否用新檔取代舊影片？`);
      if (!confirmed) return;
    }

    setSubmitting(true);
    try {
      let finalFormData = { ...formData };

      if (selectedFiles.length > 1 && !video) {
        const duplicateCount = duplicateItems.length;
        let replaceDuplicates = false;
        if (duplicateCount > 0) {
          replaceDuplicates = window.confirm(`有 ${duplicateCount} 部影片與既有影片重複，是否用新檔取代舊影片？取消將略過重複項目。`);
        }
        const uploadableFiles = replaceDuplicates
          ? selectedFiles
          : selectedFiles.filter((item) => !item.duplicateVideoId);
        let successCount = 0;
        let skippedCount = selectedFiles.length - uploadableFiles.length;
        let failedCount = 0;

        const hasSharedCover = Boolean(formData.cover) || Boolean(selectedCoverFile);
        let sharedCoverUrl = formData.cover;
        if (selectedCoverFile) {
          try {
            const { url } = await uploadCoverFileToAppwrite(selectedCoverFile);
            sharedCoverUrl = url;
          } catch (coverError) {
            throw new Error(`封面圖上傳失敗: ${coverError instanceof Error ? coverError.message : '未知錯誤'}`);
          }
        }

        for (const item of uploadableFiles) {
          const progressKey = getSelectedVideoUploadKey(item.file, item.hash);
          try {
            const { url, fileId, filetype } = await uploadFileToAppwrite(item.file, progressKey);
            let coverUrl = sharedCoverUrl || '';
            if (!hasSharedCover) {
              const autoCoverFile = await createCoverFileFromVideo(item.file);
              if (autoCoverFile) {
                const { url: autoCoverUrl } = await uploadCoverFileToAppwrite(autoCoverFile);
                coverUrl = autoCoverUrl;
              }
            }
            const payload = {
              ...formData,
              name: item.defaultName,
              file: url,
              filetype: filetype || item.filetype,
              hash: item.hash || fileId,
              cover: coverUrl,
              fileSize: item.file.size,
            };

            const apiUrl = item.duplicateVideoId
              ? addAppwriteConfigToUrl(`${API_ENDPOINTS.VIDEO}/${item.duplicateVideoId}`)
              : addAppwriteConfigToUrl(API_ENDPOINTS.VIDEO);
            const method = item.duplicateVideoId ? 'PUT' : 'POST';
            const response = await fetch(apiUrl, {
              method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });

            if (response.ok) successCount++;
            else failedCount++;
          } catch (error) {
            updateUploadProgressItem(progressKey, {
              status: 'error',
              message: error instanceof Error ? error.message : '失敗',
            });
            failedCount++;
          }
        }

        if (successCount === 0 && skippedCount > 0 && failedCount === 0) {
          throw new Error('選取的影片都與既有影片重複，沒有新增任何資料。');
        }
        if (successCount === 0 && failedCount > 0) {
          throw new Error('批次上傳失敗，沒有新增任何影片。');
        }

        alert(`批次上傳完成\n成功：${successCount} 部\n跳過重複：${skippedCount} 部\n失敗：${failedCount} 部`);
      } else if (selectedFile) {
        try {
          const progressKey = getSelectedVideoUploadKey(selectedFile, fileHash);
          const { url, fileId, filetype } = await uploadFileToAppwrite(selectedFile, progressKey);
          finalFormData.file = url;
          finalFormData.filetype = filetype || finalFormData.filetype;
          // 使用已計算的 hash，如果沒有則使用 fileId
          finalFormData.hash = fileHash || fileId;
          (finalFormData as typeof finalFormData & { fileSize?: number }).fileSize = selectedFile.size;
        } catch (uploadError) {
          throw new Error(`影片上傳失敗: ${uploadError instanceof Error ? uploadError.message : '未知錯誤'}`);
        }
      } else if (!video && !formData.hash) {
        // 新增且沒有檔案也沒有 hash 的情況，生成一個備用 hash
        finalFormData.hash = `no_file_${Date.now()}`;
      }

      // 如果有選擇封面圖檔案，上傳到 Appwrite
      if (selectedCoverFile) {
        try {
          const { url } = await uploadCoverFileToAppwrite(selectedCoverFile);
          finalFormData.cover = url;
        } catch (coverError) {
          throw new Error(`封面圖上傳失敗: ${coverError instanceof Error ? coverError.message : '未知錯誤'}`);
        }
      }

      const duplicateId = duplicateItems[0]?.duplicateVideoId;
      const apiUrl = video
        ? addAppwriteConfigToUrl(`${API_ENDPOINTS.VIDEO}/${video.$id}`)
        : duplicateId
          ? addAppwriteConfigToUrl(`${API_ENDPOINTS.VIDEO}/${duplicateId}`)
          : addAppwriteConfigToUrl(API_ENDPOINTS.VIDEO);
      const method = video || duplicateId ? 'PUT' : 'POST';

      const response = await fetch(apiUrl, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalFormData),
      });

      if (!response.ok) throw new Error(video ? '更新失敗' : '新增失敗');

      onSuccess();
      onClose();
    } catch (error) {
      alert(error instanceof Error ? error.message : '操作失敗');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {video ? '編輯影片' : '新增影片'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              影片名稱 / Video Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={selectedFiles.length > 1 ? "多支上傳時會自動使用各自檔名" : "請輸入影片名稱 / Video Name"}
              required
              maxLength={100}
              className="h-12 rounded-xl"
              disabled={submitting || selectedFiles.length > 1}
            />
            <div className="px-1 h-4">
              {formData.name ? (
                <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">已輸入 / Entered</span>
              ) : (
                <span className="text-[10px] text-orange-600 dark:text-orange-400 font-medium">請輸入名稱 / Please enter name</span>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              影片檔案 / Video File (URL or Upload)
            </label>
            <div className="space-y-3">
              <Input
                value={formData.file}
                onChange={(e) => setFormData({ ...formData, file: e.target.value })}
                placeholder="https://example.com/video.mp4"
                disabled={submitting}
                className="h-12 rounded-xl"
              />
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">或 / OR</span>
                <label className="flex-1">
                  <div className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg cursor-pointer transition-colors">
                    <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      {previewLoading ? '載入中...' : selectedFiles.length > 1 ? `已選擇 ${selectedFiles.length} 部影片` : selectedFile ? `已選擇: ${selectedFile.name}` : '上傳影片 (會自動分段，每段 20MB)'}
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/ogg,video/quicktime"
                    multiple={!video}
                    onChange={handleFileSelect}
                    disabled={submitting || previewLoading}
                    className="hidden"
                  />
                </label>
              </div>
              {selectedFiles.length > 1 && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  將建立 {selectedFiles.length} 筆影片資料；分類、備註與參考會共用，封面會自動使用各自第 1 秒截圖。
                </p>
              )}
              <VideoUploadProgressList items={uploadProgressItems} />
              <div className="px-1 h-4">
                {formData.file || selectedFile ? (
                  <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">已備妥 / Ready</span>
                ) : (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請提供 URL 或上傳檔案 / (Optional) Please provide URL or upload</span>
                )}
              </div>
              {previewUrl && (
                <div className="mt-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">預覽：</p>
                  <video src={previewUrl} controls className="max-h-48 rounded-lg border border-gray-200 dark:border-gray-700" />
                </div>
              )}
              {duplicateWarning && (
                <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">
                    {duplicateWarning}
                  </p>
                </div>
              )}
              {uploadStatus === 'uploading' && (
                <div className="mt-2">
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <span>上傳至 Appwrite...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
              {uploadStatus === 'success' && (
                <p className="text-sm text-green-600 dark:text-green-400">✓ 上傳成功</p>
              )}
              {uploadStatus === 'error' && (
                <p className="text-sm text-red-600 dark:text-red-400">✗ 上傳失敗</p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              備註 / Note
            </label>
            <Textarea
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              placeholder="影片備註說明 / Video Note"
              rows={3}
              maxLength={500}
              className="rounded-xl"
            />
            <div className="px-1 h-4">
              {formData.note ? (
                <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">已輸入 / Entered</span>
              ) : (
                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請輸入備註 / (Optional) Please enter note</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                分類 / Category
              </label>
              {useCategorySelect && existingCategories.length > 0 ? (
                <div className="space-y-2">
                  <Select
                    value={formData.category}
                    onValueChange={(value) => {
                      if (value === '__custom__') {
                        setUseCategorySelect(false);
                        setFormData({ ...formData, category: '' });
                      } else {
                        setFormData({ ...formData, category: value });
                      }
                    }}
                  >
                    <SelectTrigger className="h-12 rounded-xl">
                      <SelectValue placeholder="選擇分類 / Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {existingCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                      <SelectItem value="__custom__">自行輸入... / Custom input...</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="輸入新分類 / Enter new category"
                    className="h-12 rounded-xl"
                  />
                  {existingCategories.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setUseCategorySelect(true)}
                      className="text-xs h-7"
                    >
                      從現有分類中選擇 / Select from existing
                    </Button>
                  )}
                </div>
              )}
              <div className="px-1 h-4">
                {formData.category ? (
                  <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">已輸入 / Entered</span>
                ) : (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請輸入分類 / (Optional) Please enter category</span>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                參考 / Reference
              </label>
              <Input
                value={formData.ref}
                onChange={(e) => setFormData({ ...formData, ref: e.target.value })}
                placeholder="參考資訊 / Reference Info"
                maxLength={300}
                className="h-12 rounded-xl"
              />
              <div className="px-1 h-4">
                {formData.ref ? (
                  <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">已輸入 / Entered</span>
                ) : (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請輸入參考 / (Optional) Please enter reference</span>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Hash (程式自動生成)
            </label>
            <Input
              value={formData.hash}
              disabled
              placeholder="上傳檔案後自動生成"
              className="bg-gray-100 dark:bg-gray-700 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              封面圖 URL 或上傳檔案
            </label>
            <div className="space-y-3">
              <Input
                value={formData.cover}
                onChange={(e) => setFormData({ ...formData, cover: e.target.value })}
                placeholder="https://example.com/cover.jpg"
                disabled={submitting}
                maxLength={500}
              />
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">或</span>
                <label className="flex-1">
                  <div className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg cursor-pointer transition-colors">
                    <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      {coverPreviewLoading ? '載入中...' : selectedCoverFile ? `已選擇: ${selectedCoverFile.name}` : '上傳封面圖 (最大 50MB)'}
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    onChange={handleCoverFileSelect}
                    disabled={submitting || coverPreviewLoading}
                    className="hidden"
                  />
                </label>
              </div>
              {coverPreviewUrl && (
                <div className="mt-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">封面圖預覽：</p>
                  <img src={coverPreviewUrl} alt="Cover Preview" className="max-h-32 rounded-lg border border-gray-200 dark:border-gray-700" />
                </div>
              )}
              {coverUploadStatus === 'uploading' && (
                <div className="mt-2">
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <span>上傳封面圖至 Appwrite...</span>
                    <span>{coverUploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${coverUploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
              {coverUploadStatus === 'success' && (
                <p className="text-sm text-green-600 dark:text-green-400">✓ 封面圖上傳成功</p>
              )}
              {coverUploadStatus === 'error' && (
                <p className="text-sm text-red-600 dark:text-red-400">✗ 封面圖上傳失敗</p>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" onClick={onClose} className="flex-1 bg-gray-500 hover:bg-gray-600 rounded-xl">
              取消
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-blue-500 hover:bg-blue-600 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? '處理中...' : (video ? '更新' : '新增')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 影片播放器
function VideoPlayer({ video, videoRef }: { video: VideoItem; videoRef: React.RefObject<HTMLVideoElement | null> }) {
  return (
    <DataCard className="overflow-hidden">
      <div className="p-2 sm:p-4">
        <PlyrPlayer
          type="video"
          src={getProxiedMediaUrl(videoRef.current?.src || video.url || `/videos/${video.filename}`)}
          persistOnUnmount
          className="w-full"
        />
      </div>
      <div className="p-4 pt-0">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">{video.title}</h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">{video.description}</p>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
          <div className="flex items-start gap-2">
            <span className="text-blue-500">💡</span>
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <p className="font-medium mb-1">播放控制提示：</p>
              <ul className="text-xs space-y-0.5 text-blue-600 dark:text-blue-400">
                <li>• 點擊影片或播放按鈕開始/暫停播放</li>
                <li>• 點擊時間軸任意位置快速跳轉</li>
                <li>• 雙擊影片進入全螢幕模式</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </DataCard>
  );
}

// 影片卡片
interface VideoCardProps {
  video: VideoItem;
  cacheStatus?: { cached: boolean; downloading: boolean; progress: number; error?: string };
  onPlay: () => void;
  onDownload: () => void;
  onDeleteCache: () => void;
}

function VideoCard({ video, cacheStatus, onPlay, onDownload, onDeleteCache }: VideoCardProps) {
  return (
    <DataCard className="overflow-hidden hover:shadow-md transition-all duration-200 group">
      {/* 縮圖 */}
      <div className="relative aspect-video bg-gray-100 dark:bg-gray-700 overflow-hidden cursor-pointer" onClick={onPlay}>
        {typeof video.cover === 'string' && video.cover ? (
          <img
            src={video.cover}
            alt={video.title}
            className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center group-hover:from-blue-600 group-hover:to-purple-700 transition-all duration-300">
            <Play className="text-white group-hover:scale-110 transition-transform duration-300 w-12 h-12" />
          </div>
        )}

        {typeof video.cover === 'string' && video.cover && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Play className="text-white w-12 h-12 drop-shadow-lg opacity-80" />
          </div>
        )}

        {video.duration && (
          <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm text-white text-xs px-2 py-1 rounded font-medium">
            {video.duration}
          </div>
        )}

        <div className="absolute top-2 right-2 flex gap-2 bg-white/90 backdrop-blur-sm rounded-full p-1.5 shadow-sm">
          {typeof video.cover === 'string' && video.cover && (
            <div className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center">
              THUMBNAIL
            </div>
          )}
          <CacheStatusIcon status={cacheStatus} />
        </div>
      </div>

      {/* 資訊 */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 line-clamp-1">{video.title}</h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">{video.description}</p>

        <div className="flex gap-2">
          <Button onClick={onPlay} className="flex-1 gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-xl text-sm">
            <Play size={14} />
            <span className="hidden xs:inline">播放影片</span>
            <span className="xs:hidden">播放</span>
          </Button>

          {cacheStatus?.cached ? (
            <Button onClick={onDeleteCache} variant="outline" className="gap-1 text-red-600 hover:bg-red-50 rounded-xl text-sm">
              <Trash2 size={14} />
              <span className="hidden sm:inline">刪除快取</span>
            </Button>
          ) : (
            <Button onClick={onDownload} variant="outline" disabled={cacheStatus?.downloading} className="gap-1 rounded-xl text-sm">
              {cacheStatus?.downloading ? (
                <>
                  <Loader className="animate-spin" size={14} />
                  <span className="hidden sm:inline">{Math.round(cacheStatus?.progress || 0)}%</span>
                </>
              ) : (
                <>
                  <Download size={14} />
                  <span className="hidden sm:inline">快取</span>
                </>
              )}
            </Button>
          )}
        </div>

        {cacheStatus?.error && (
          <div className="mt-2 text-red-600 text-xs bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2">
            {cacheStatus.error}
          </div>
        )}
      </div>
    </DataCard>
  );
}

// 快取狀態圖示
function CacheStatusIcon({ status }: { status?: { cached: boolean; downloading: boolean; error?: string } }) {
  if (!status) return null;
  if (status.downloading) return <Loader className="animate-spin text-blue-500" size={16} />;
  if (status.cached) return <CheckCircle className="text-green-500" size={16} />;
  if (status.error) return <AlertCircle className="text-red-500" size={16} />;
  return null;
}

// 快取管理
interface CacheManagerProps {
  cacheStats: { totalSize: number; cachedVideos: number; downloadingVideos: number };
  maxCacheSize: number;
  formatFileSize: (bytes: number) => string;
  onClearAll: () => void;
  videoCount: number;
}

function CacheManager({ cacheStats, maxCacheSize, formatFileSize, onClearAll, videoCount }: CacheManagerProps) {
  const usagePercent = Math.round((cacheStats.totalSize / maxCacheSize) * 100);

  return (
    <DataCard className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">快取管理</h2>
        <Button onClick={onClearAll} variant="ghost" className="gap-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
          <Trash2 size={16} />
          清空快取
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <SimpleStatCard title="已快取影片" value={cacheStats.cachedVideos} bgColor="bg-blue-50 dark:bg-blue-900/20" textColor="text-blue-600 dark:text-blue-400" />
        <SimpleStatCard title="下載中" value={cacheStats.downloadingVideos} bgColor="bg-green-50 dark:bg-green-900/20" textColor="text-green-600 dark:text-green-400" />
        <SimpleStatCard title="總影片數" value={videoCount} bgColor="bg-purple-50 dark:bg-purple-900/20" textColor="text-purple-600 dark:text-purple-400" />
        <SimpleStatCard title="快取大小" value={formatFileSize(cacheStats.totalSize)} icon={<HardDrive size={14} />} bgColor="bg-orange-50 dark:bg-orange-900/20" textColor="text-orange-600 dark:text-orange-400" />
      </div>

      {/* 進度條 */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
          <span>快取使用量</span>
          <span className="font-medium">{formatFileSize(cacheStats.totalSize)} / {formatFileSize(maxCacheSize)}</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(usagePercent, 100)}%` }} />
        </div>
        <div className="text-right text-xs text-gray-500 dark:text-gray-400 mt-1">{usagePercent}% 已使用</div>
      </div>

      <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
        💡 <span className="font-medium">提示：</span>快取影片到本地可以減少網路流量使用，提升播放體驗。當快取超過限制時，系統會自動清理最舊的影片。
      </div>
    </DataCard>
  );
}
