"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Podcast as PodcastIcon, Plus, Edit, Trash2, X, Upload, Calendar, Play, Pause, Search, ChevronDown, Repeat, HardDrive, Check, FolderUp, AlertTriangle, RefreshCw } from "lucide-react";
import { usePodcast, PodcastData } from "@/hooks/usePodcast";
import { usePodcastCache } from "@/hooks/usePodcastCache";
import { DataCard } from "@/components/ui/data-card";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FullPageLoading } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { PlyrPlayer } from "@/components/ui/plyr-player";
import { API_ENDPOINTS } from "@/lib/constants";
import { formatLocalDate } from "@/lib/formatters";
import { getAppwriteHeaders, getProxiedMediaUrl } from "@/lib/utils";
import { uploadToAppwriteStorage } from "@/lib/appwriteStorage";
import JSZip from "jszip";
import { FriendlyAiCrudShell } from "@/components/ui/friendly-ai-crud-shell";

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

// Helper function to detect if a file is a video
function isVideoFile(fileUrlOrName: string): boolean {
  if (!fileUrlOrName) return false;
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.m4v'];
  const lowercase = fileUrlOrName.toLowerCase();
  return videoExtensions.some(ext => lowercase.endsWith(ext) || lowercase.includes(`mime=video/`) || lowercase.includes('video%2F'));
}

export default function PodcastManagement() {
  const { podcast, loading, error, stats, loadPodcast } = usePodcast();
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingPodcast, setEditingPodcast] = useState<PodcastData | null>(null);
  const [isInlineCreating, setIsInlineCreating] = useState(false);
  const [inlineCreateForm, setInlineCreateForm] = useState({ name: '', category: '', note: '', ref: '', cover: '' });
  const [inlineCreateCoverFile, setInlineCreateCoverFile] = useState<File | null>(null);
  const [inlineCreateCoverPreview, setInlineCreateCoverPreview] = useState<string>('');
  const [inlineCreateCoverUploading, setInlineCreateCoverUploading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [workbenchMode, setWorkbenchMode] = useState<"all" | "withMedia" | "missingCover" | "uncategorized">("all");
  const [expandedPodcastId, setExpandedPodcastId] = useState<string | null>(null);
  const [exportingZip, setExportingZip] = useState(false);
  const [exportZipProgress, setExportZipProgress] = useState({ current: 0, total: 0, status: '' });
  const [importingZip, setImportingZip] = useState(false);
  const [importZipProgress, setImportZipProgress] = useState({ current: 0, total: 0, status: '', success: 0, failed: 0 });
  const importZipInputRef = useRef<HTMLInputElement>(null);

  // Inline editing state
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineEditForm, setInlineEditForm] = useState({ name: '', category: '', note: '', ref: '', cover: '' });
  // Inline cover upload state
  const [inlineCoverFile, setInlineCoverFile] = useState<File | null>(null);
  const [inlineCoverPreview, setInlineCoverPreview] = useState<string>('');
  const [inlineCoverUploading, setInlineCoverUploading] = useState(false);

  // Bulk selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteInput, setBulkDeleteInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [deleteTotal, setDeleteTotal] = useState(0);

  // 播客快取管理
  const {
    cacheStatus,
    cacheStats,
    downloadAndCachePodcast,
    deletePodcastCache,
    clearAllCache,
    updateCacheStats,
    formatFileSize,
    maxCacheSize,
  } = usePodcastCache();

  useEffect(() => {
    updateCacheStats();
  }, [updateCacheStats]);

  // 搜尋過濾
  const podcastsWithMedia = useMemo(() => podcast.filter((item) => Boolean(item.file)), [podcast]);
  const podcastsMissingCover = useMemo(() => podcast.filter((item) => !item.cover), [podcast]);
  const uncategorizedPodcasts = useMemo(() => podcast.filter((item) => !item.category), [podcast]);

  const filteredPodcast = useMemo(() => {
    const modeFiltered = podcast.filter((item) => {
      if (workbenchMode === "withMedia") return Boolean(item.file);
      if (workbenchMode === "missingCover") return !item.cover;
      if (workbenchMode === "uncategorized") return !item.category;
      return true;
    });

    if (!searchQuery.trim()) return modeFiltered;
    const query = searchQuery.toLowerCase();
    return modeFiltered.filter(item =>
      item.name?.toLowerCase().includes(query)
    );
  }, [podcast, searchQuery, workbenchMode]);

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
      setSelectedIds(new Set(filteredPodcast.map(p => p.$id).filter(Boolean)));
    } else if (filteredPodcast.length > 0 && filteredPodcast.every(p => selectedIds.has(p.$id))) {
      setSelectedIds(new Set());
      setSelectionMode(false);
    } else {
      setSelectedIds(new Set(filteredPodcast.map(p => p.$id).filter(Boolean)));
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds).filter(id => !!id);
    setDeleteTotal(ids.length);
    setDeleteProgress(0);
    setIsDeleting(true);
    await Promise.all(ids.map(id => {
      const url = addAppwriteConfigToUrl(`${API_ENDPOINTS.PODCAST}/${id}`);
      return fetch(url, { method: 'DELETE' })
        .catch(err => console.error("Delete failed:", err))
        .finally(() => setDeleteProgress(prev => prev + 1));
    }));
    setIsDeleting(false);
    setSelectedIds(new Set());
    setSelectionMode(false);
    setBulkDeleteOpen(false);
    setBulkDeleteInput("");
    loadPodcast(true);
  };

  const handleAdd = () => {
    setEditingPodcast(null);
    setShowFormModal(false);
    setIsInlineCreating(true);
    setInlineCreateForm({ name: '', category: '', note: '', ref: '', cover: '' });
    setInlineCreateCoverFile(null);
    setInlineCreateCoverPreview('');
    setInlineCreateCoverUploading(false);
  };

  const handleEdit = (podcastItem: PodcastData) => {
    setEditingPodcast(podcastItem);
    setShowFormModal(true);
  };

  const handleDelete = async (podcastItem: PodcastData) => {
    const confirmText = `DELETE ${podcastItem.name}`;
    const userInput = prompt(`確定要刪除播客「${podcastItem.name}」嗎？\n\n請輸入以下文字以確認刪除：\n${confirmText}`);

    if (userInput !== confirmText) {
      if (userInput !== null) {
        alert('輸入不正確，刪除已取消');
      }
      return;
    }

    try {
      const url = addAppwriteConfigToUrl(`${API_ENDPOINTS.PODCAST}/${podcastItem.$id}`);
      const response = await fetch(url, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('刪除失敗');
      loadPodcast(true);
    } catch (error) {
      alert(error instanceof Error ? error.message : '刪除失敗');
    }
  };

  // 開始行內編輯
  const handleInlineEdit = (podcastItem: PodcastData) => {
    setInlineEditForm({
      name: podcastItem.name || '',
      category: podcastItem.category || '',
      note: podcastItem.note || '',
      ref: podcastItem.ref || '',
      cover: podcastItem.cover || '',
    });
    setInlineCoverFile(null);
    setInlineCoverPreview('');
    setInlineCoverUploading(false);
    setInlineEditingId(podcastItem.$id);
  };

  // 儲存行內編輯
  const handleInlineSave = async (podcastId: string) => {
    if (!inlineEditingId) return;
    setInlineCoverUploading(true);
    try {
      let coverUrl = '';

      // 如果有選擇封面檔案，先上傳
      if (inlineCoverFile) {
        const formDataUpload = new FormData();
        formDataUpload.append('file', inlineCoverFile);

        const response = await fetch('/api/upload-image', {
          method: 'POST',
          headers: getAppwriteHeaders(),
          body: formDataUpload,
        });

        if (!response.ok) throw new Error('封面上傳失敗');
        const data = await response.json();
        coverUrl = data.url;
      }

      const url = addAppwriteConfigToUrl(`${API_ENDPOINTS.PODCAST}/${podcastId}`);
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: inlineEditForm.name,
          category: inlineEditForm.category,
          note: inlineEditForm.note,
          ref: inlineEditForm.ref,
          cover: coverUrl || inlineEditForm.cover, // Use new URL if uploaded, otherwise existing from form
        }),
      });
      if (!response.ok) throw new Error('更新失敗');
      loadPodcast(true);
      setInlineEditingId(null);
      setInlineEditForm({ name: '', category: '', note: '', ref: '', cover: '' });
      setInlineCoverFile(null);
      setInlineCoverPreview('');
    } catch (error) {
      console.error('Inline edit failed:', error);
      alert(error instanceof Error ? error.message : '更新失敗，請稍後再試');
    } finally {
      setInlineCoverUploading(false);
    }
  };

  // 取消行內編輯
  const cancelInlineEdit = () => {
    setInlineEditingId(null);
    setInlineEditForm({ name: '', category: '', note: '', ref: '', cover: '' });
    setInlineCoverFile(null);
    setInlineCoverPreview('');
    setInlineCoverUploading(false);
  };

  const handleFormSuccess = () => {
    setShowFormModal(false);
    setEditingPodcast(null);
    setIsInlineCreating(false);
    loadPodcast(true);
  };

  const cancelInlineCreate = () => {
    setIsInlineCreating(false);
    setInlineCreateForm({ name: '', category: '', note: '', ref: '', cover: '' });
    setInlineCreateCoverFile(null);
    setInlineCreateCoverPreview('');
    setInlineCreateCoverUploading(false);
  };

  const handleInlineCreateSave = async () => {
    if (!inlineCreateForm.name.trim()) {
      alert('請輸入播客名稱');
      return;
    }

    setInlineCreateCoverUploading(true);
    try {
      let coverUrl = inlineCreateForm.cover;

      if (inlineCreateCoverFile) {
        const formDataUpload = new FormData();
        formDataUpload.append('file', inlineCreateCoverFile);

        const response = await fetch('/api/upload-image', {
          method: 'POST',
          headers: getAppwriteHeaders(),
          body: formDataUpload,
        });

        if (!response.ok) throw new Error('封面上傳失敗');
        const data = await response.json();
        coverUrl = data.url;
      }

      const response = await fetch(addAppwriteConfigToUrl(API_ENDPOINTS.PODCAST), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: inlineCreateForm.name,
          category: inlineCreateForm.category,
          note: inlineCreateForm.note,
          ref: inlineCreateForm.ref,
          cover: coverUrl,
          file: '',
          filetype: '',
          hash: `inline_create_${Date.now()}`,
        }),
      });

      if (!response.ok) throw new Error('新增失敗');
      cancelInlineCreate();
      loadPodcast(true);
    } catch (error) {
      alert(error instanceof Error ? error.message : '新增失敗');
    } finally {
      setInlineCreateCoverUploading(false);
    }
  };

  const togglePlay = (id: string) => {
    setPlayingId(playingId === id ? null : id);
  };

  const handleExportZip = async () => {
    if (podcast.length === 0) { alert('沒有播客可以匯出'); return; }
    setExportingZip(true); setExportZipProgress({ current: 0, total: podcast.length, status: '準備中...' });
    try {
      const zip = new JSZip();
      zip.folder('podcast');
      zip.folder('covers');

      const csvRows: string[][] = [];
      const csvHeaders = ['name', 'file', 'cover', 'filetype', 'category', 'note', 'ref', 'hash'];
      csvRows.push(csvHeaders);

      for (let i = 0; i < podcast.length; i++) {
        const item = podcast[i];
        const seq = String(i + 1).padStart(3, '0');
        const sanitizedName = item.name.replace(/[<>:"\/\\|?*]/g, '_');
        const baseName = `${seq}_${sanitizedName}`;

        setExportZipProgress({ current: i + 1, total: podcast.length, status: `正在處理: ${item.name}` });

        // Detect file extension
        let fileExtension = 'mp3';
        if (item.file) {
          const urlLower = item.file.toLowerCase();
          if (urlLower.includes('.mp4') || urlLower.includes('video%2Fmp4')) fileExtension = 'mp4';
          else if (urlLower.includes('.webm') || urlLower.includes('video%2Fwebm')) fileExtension = 'webm';
          else if (urlLower.includes('.ogg') || urlLower.includes('audio%2Fogg') || urlLower.includes('video%2Fogg')) fileExtension = 'ogg';
          else if (urlLower.includes('.mov') || urlLower.includes('video%2Fmov')) fileExtension = 'mov';
          else if (urlLower.includes('.wav') || urlLower.includes('audio%2Fwav')) fileExtension = 'wav';
          else if (urlLower.includes('.aac') || urlLower.includes('audio%2Faac')) fileExtension = 'aac';
          else if (urlLower.includes('.flac') || urlLower.includes('audio%2Fflac')) fileExtension = 'flac';
          else if (urlLower.includes('.m4a') || urlLower.includes('audio%2Fm4a')) fileExtension = 'm4a';
        }

        // Download and add podcast file
        let podcastPath = '';
        if (item.file) {
          try {
            const proxyUrl = getProxiedMediaUrl(item.file);
            const response = await fetch(proxyUrl);
            if (response.ok) {
              const blob = await response.blob();
              podcastPath = `podcast/${baseName}.${fileExtension}`;
              zip.file(podcastPath, blob);
            }
          } catch (err) { console.error(`下載播客 ${item.name} 時出錯:`, err); }
        }

        // Download and add cover image
        let coverPath = '';
        if (item.cover) {
          try {
            const coverProxyUrl = getProxiedMediaUrl(item.cover);
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
            }
          } catch (err) { console.error(`下載封面 ${item.name} 時出錯:`, err); }
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
          escapeCsv(item.name || ''),
          escapeCsv(podcastPath),
          escapeCsv(coverPath),
          escapeCsv(item.filetype || ''),
          escapeCsv(item.category || ''),
          escapeCsv(item.note || ''),
          escapeCsv(item.ref || ''),
          escapeCsv(item.hash || ''),
        ]);
      }

      // Generate CSV and add to ZIP
      const csvContent = csvRows.map(row => row.join(',')).join('\n');
      zip.file('podcast.csv', csvContent);

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content); const a = document.createElement('a'); a.href = url; a.download = 'appwrite-podcast.zip'; a.click(); URL.revokeObjectURL(url);
      setExportZipProgress({ current: podcast.length, total: podcast.length, status: '完成！' });
      setTimeout(() => setExportingZip(false), 1500);
    } catch (error) { console.error('匯出 ZIP 失敗:', error); alert('匯出失敗'); setExportingZip(false); }
  };

  const handleImportZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImportingZip(true); setImportZipProgress({ current: 0, total: 0, status: '讀取 ZIP 檔案...', success: 0, failed: 0 });
    try {
      const zip = new JSZip();
      const contents = await zip.loadAsync(file);

      // Check if this is a new-format ZIP with podcast.csv
      const csvFile = contents.files['podcast.csv'];
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
        setImportZipProgress({ current: 0, total, status: `找到 ${total} 筆播客記錄`, success: 0, failed: 0 });
        let successCount = 0, failedCount = 0;

        for (let i = 0; i < dataRows.length; i++) {
          const row = dataRows[i];
          setImportZipProgress({ current: i + 1, total, status: `正在處理: ${row.name || '未知'}`, success: successCount, failed: failedCount });

          try {
            // Upload podcast file from ZIP
            let remoteFileUrl = '';
            if (row.file && contents.files[row.file]) {
              const podcastBlob = await contents.files[row.file].async('blob');
              const fileName = row.file.split('/').pop() || 'audio.mp3';
              const podcastFileObj = new File([podcastBlob], fileName, { type: 'application/octet-stream' });
              const uploadResult = await uploadToAppwriteStorage(podcastFileObj);
              remoteFileUrl = uploadResult.url;
            }

            // Upload cover image from ZIP
            let remoteCoverUrl = '';
            if (row.cover && contents.files[row.cover]) {
              const coverBlob = await contents.files[row.cover].async('blob');
              const coverName = row.cover.split('/').pop() || 'cover.png';
              const coverFileObj = new File([coverBlob], coverName, { type: 'application/octet-stream' });
              const coverUpload = await uploadToAppwriteStorage(coverFileObj);
              remoteCoverUrl = coverUpload.url;
            }

            // Check if record already exists (same name)
            const existing = podcast.find(m => m.name === row.name);
            const apiUrl = existing
              ? addAppwriteConfigToUrl(`${API_ENDPOINTS.PODCAST}/${existing.$id}`)
              : addAppwriteConfigToUrl(API_ENDPOINTS.PODCAST);
            const method = existing ? 'PUT' : 'POST';

            const submitData: Record<string, string> = {
              name: row.name || '',
              file: remoteFileUrl || (existing ? existing.file : ''),
              cover: remoteCoverUrl || (existing ? existing.cover : ''),
              filetype: row.filetype || '',
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

        setImportZipProgress({ current: total, total, status: '完成！', success: successCount, failed: failedCount });
        setTimeout(() => { setImportingZip(false); loadPodcast(true); }, 2000);
      } else {
        // Legacy format: plain media files in ZIP (backwards compatible)
        const files = Object.keys(contents.files).filter(name => !contents.files[name].dir);
        setImportZipProgress({ current: 0, total: files.length, status: `找到 ${files.length} 個檔案（舊格式）`, success: 0, failed: 0 });
        let successCount = 0, failedCount = 0;
        for (let i = 0; i < files.length; i++) {
          const fileName = files[i]; setImportZipProgress({ current: i + 1, total: files.length, status: `正在處理: ${fileName}`, success: successCount, failed: failedCount });
          try {
            const fileData = await contents.files[fileName].async('blob'); const ext = fileName.split('.').pop()?.toLowerCase() || 'mp3';
            const validExts = ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'mp4', 'webm', 'mov'];
            if (!validExts.includes(ext)) { failedCount++; continue; }
            const podcastFileObj = new File([fileData], fileName, { type: 'application/octet-stream' });
            const uploadData = await uploadToAppwriteStorage(podcastFileObj);
            const createUrl = addAppwriteConfigToUrl(API_ENDPOINTS.PODCAST);
            const createResponse = await fetch(createUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: fileName, file: uploadData.url, filetype: ext, note: '', ref: '', category: '', hash: '', cover: false }) });
            if (createResponse.ok) successCount++; else failedCount++;
          } catch (err) { console.error(`處理 ${fileName} 時出錯:`, err); failedCount++; }
          setImportZipProgress({ current: i + 1, total: files.length, status: `正在處理: ${fileName}`, success: successCount, failed: failedCount });
        }
        setImportZipProgress({ current: files.length, total: files.length, status: '完成！', success: successCount, failed: failedCount });
        setTimeout(() => { setImportingZip(false); loadPodcast(true); }, 2000);
      }
    } catch (error) { console.error('匯入 ZIP 失敗:', error); alert('匯入失敗'); setImportingZip(false); }
    if (importZipInputRef.current) importZipInputRef.current.value = '';
  };

  if (loading) {
    return <FullPageLoading text="載入播客資料中..." />;
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <FriendlyAiCrudShell
        title="鋒兄播客"
        description="節目收藏、快取狀態與待補封面都放在同一個控制台，先決定要補哪一批，再進入細節編輯。"
        searchPlaceholder="搜尋播客名稱..."
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeMode={workbenchMode}
        onModeChange={(mode) => setWorkbenchMode(mode as typeof workbenchMode)}
        modeItems={[
          { key: "all", label: "全部播客", count: podcast.length },
          { key: "withMedia", label: "有媒體", count: podcastsWithMedia.length },
          { key: "missingCover", label: "缺封面", count: podcastsMissingCover.length },
          { key: "uncategorized", label: "未分類", count: uncategorizedPodcasts.length },
        ]}
        suggestions={[
          podcastsMissingCover.length > 0
            ? { title: "先補封面", body: `有 ${podcastsMissingCover.length} 筆播客缺封面，列表辨識和手機點選都會比較吃力。`, tone: "amber" }
            : { title: "封面完整", body: "播客封面狀態不錯，接下來可以補分類或節目摘要。", tone: "green" },
          podcastsWithMedia.length < podcast.length
            ? { title: "媒體待補", body: `還有 ${podcast.length - podcastsWithMedia.length} 筆沒有上傳音檔或影片，收藏和可播放要分清楚。`, tone: "red" }
            : { title: "可播放度", body: "目前清單大多可以直接播放，之後可以強化逐字稿和摘要。", tone: "blue" },
          uncategorizedPodcasts.length > 0
            ? { title: "分類整理", body: "先把節目分成新聞、訪談、知識型等分類，後續 AI 才能推薦下一步。", tone: "neutral" }
            : { title: "下一步", body: "分類已經有基礎，接下來最值得做的是補封面和近期收聽重點。", tone: "neutral" },
        ]}
        toolbar={
          <>
            <Button onClick={() => loadPodcast(true)} disabled={loading || exportingZip || importingZip} variant="outline" className="gap-2 rounded-xl h-10 px-4">
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              重新整理
            </Button>
            <Button onClick={handleExportZip} disabled={exportingZip || podcast.length === 0} className="gap-2 bg-purple-500 hover:bg-purple-600 rounded-xl">
              <FolderUp size={16} />
              匯出 ZIP
            </Button>
            <Button onClick={() => importZipInputRef.current?.click()} disabled={importingZip} className="gap-2 bg-orange-500 hover:bg-orange-600 rounded-xl">
              <FolderUp size={16} />
              匯入 ZIP
            </Button>
            <input ref={importZipInputRef} type="file" accept=".zip" onChange={handleImportZip} className="hidden" />
            <Button onClick={handleSelectAll} variant="outline" className="rounded-xl h-10 px-4">
              {selectionMode && filteredPodcast.length > 0 && filteredPodcast.every((item) => selectedIds.has(item.$id)) ? "取消全選" : "全選"}
            </Button>
            {selectedIds.size > 0 && (
              <Button onClick={() => setBulkDeleteOpen(true)} className="rounded-xl h-10 px-4 bg-red-600 hover:bg-red-700 text-white">
                <Trash2 size={18} />
                刪除選取 ({selectedIds.size})
              </Button>
            )}
            <Button onClick={handleAdd} className="gap-2 bg-blue-500 hover:bg-blue-600 rounded-xl">
              <Plus size={16} />
              新增播客
            </Button>
          </>
        }
      />

      {/* 統計卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="播客總數" value={stats.total} icon={PodcastIcon} />
        <StatCard title="已快取" value={cacheStats.cachedPodcasts} icon={Check} />
        <StatCard title="快取大小" value={formatFileSize(cacheStats.totalSize)} icon={HardDrive} />
      </div>

      {/* 播客列表 */}
      {isInlineCreating && (
        <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden border-2 border-blue-500 dark:border-blue-400 p-4 space-y-3">
          <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">新增中</div>
          {(inlineCreateCoverPreview || inlineCreateForm.cover) && (
            <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
              <img
                src={inlineCreateCoverPreview || inlineCreateForm.cover}
                alt="封面預覽"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => {
                  setInlineCreateCoverFile(null);
                  setInlineCreateCoverPreview('');
                  setInlineCreateForm({ ...inlineCreateForm, cover: '' });
                }}
                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          <Input placeholder="封面圖 URL" value={inlineCreateForm.cover} onChange={(e) => setInlineCreateForm({ ...inlineCreateForm, cover: e.target.value })} className="h-9 rounded-lg text-sm" />
          <label className="flex items-center justify-center gap-2 px-3 py-2 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg cursor-pointer transition-colors">
            <Upload className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
              {inlineCreateCoverUploading ? '上傳中...' : inlineCreateCoverFile ? inlineCreateCoverFile.name : '上傳封面圖 (最大 5MB)'}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
                if (!validTypes.includes(file.type)) { alert('只支援 JPG, PNG, GIF, WEBP 格式的圖片'); return; }
                if (file.size > 5 * 1024 * 1024) { alert('封面圖大小不能超過 5MB'); return; }
                setInlineCreateCoverFile(file);
                setInlineCreateCoverPreview(URL.createObjectURL(file));
              }}
              disabled={inlineCreateCoverUploading}
              className="hidden"
            />
          </label>
          <Input placeholder="播客名稱" value={inlineCreateForm.name} onChange={(e) => setInlineCreateForm({ ...inlineCreateForm, name: e.target.value })} className="h-9 rounded-lg text-sm" />
          <Input placeholder="分類" value={inlineCreateForm.category} onChange={(e) => setInlineCreateForm({ ...inlineCreateForm, category: e.target.value })} className="h-9 rounded-lg text-sm" />
          <Input placeholder="參考" value={inlineCreateForm.ref} onChange={(e) => setInlineCreateForm({ ...inlineCreateForm, ref: e.target.value })} className="h-9 rounded-lg text-sm" />
          <Textarea placeholder="備註" value={inlineCreateForm.note} onChange={(e) => setInlineCreateForm({ ...inlineCreateForm, note: e.target.value })} className="rounded-lg text-sm h-20 resize-none" />
          <div className="flex gap-2">
            <Button onClick={handleInlineCreateSave} disabled={inlineCreateCoverUploading} className="flex-1 gap-1 bg-green-500 hover:bg-green-600 rounded-lg text-xs py-1.5">
              {inlineCreateCoverUploading ? '上傳中...' : '新增'}
            </Button>
            <Button onClick={cancelInlineCreate} variant="outline" disabled={inlineCreateCoverUploading} className="flex-1 gap-1 rounded-lg text-xs py-1.5">
              取消
            </Button>
          </div>
        </div>
      )}

      {podcast.length === 0 && !isInlineCreating ? (
        <EmptyState
          icon={<PodcastIcon className="w-12 h-12" />}
          title="尚無播客"
          description="點擊上方「新增播客」按鈕新增第一首播客"
        />
      ) : filteredPodcast.length === 0 ? (
        <EmptyState
          icon={<Search className="w-12 h-12" />}
          title="無搜尋結果"
          description={`找不到「${searchQuery}」相關的播客`}
        />
      ) : (
        <div className="space-y-3">
          {/* 操作提示 */}
          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 px-1">
            <PodcastIcon className="w-3.5 h-3.5" />
            <span>點擊封面圖或卡片顯示詳情</span>
          </div>
          {filteredPodcast.map((podcastItem) => (
            <PodcastCard
              key={podcastItem.$id}
              podcast={podcastItem}
              isPlaying={playingId === podcastItem.$id}
              isExpanded={expandedPodcastId === podcastItem.$id}
              onPlay={() => togglePlay(podcastItem.$id)}
              onToggleExpand={() => setExpandedPodcastId(expandedPodcastId === podcastItem.$id ? null : podcastItem.$id)}
              onEdit={() => handleEdit(podcastItem)}
              onDelete={() => handleDelete(podcastItem)}
              selectionMode={selectionMode}
              isSelected={selectedIds.has(podcastItem.$id)}
              onToggleSelect={() => handleToggleSelect(podcastItem.$id)}
              cacheStatus={cacheStatus}
              downloadAndCachePodcast={downloadAndCachePodcast}
              inlineEditingId={inlineEditingId}
              inlineEditForm={inlineEditForm}
              setInlineEditForm={setInlineEditForm}
              onInlineEdit={handleInlineEdit}
              onInlineSave={handleInlineSave}
              onInlineCancel={cancelInlineEdit}
              inlineCoverFile={inlineCoverFile}
              inlineCoverPreview={inlineCoverPreview}
              setInlineCoverFile={setInlineCoverFile}
              setInlineCoverPreview={setInlineCoverPreview}
              inlineCoverUploading={inlineCoverUploading}
            />
          ))}
        </div>
      )}

      {/* 快取管理 */}
      {podcast.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">快取管理</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                已使用 {formatFileSize(cacheStats.totalSize)} / {formatFileSize(maxCacheSize)}
              </p>
            </div>
            <Button onClick={clearAllCache} variant="outline" className="rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" disabled={cacheStats.cachedPodcasts === 0}>
              清空快取
            </Button>
          </div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-cyan-500 to-cyan-600 transition-all duration-300" style={{ width: `${Math.min((cacheStats.totalSize / maxCacheSize) * 100, 100)}%` }} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">已快取播客：</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">{cacheStats.cachedPodcasts} / {podcast.length}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">下載中：</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">{cacheStats.downloadingPodcasts}</span>
            </div>
          </div>
        </div>
      )}

      {/* 表單模態框 */}
      {showFormModal && (
        <PodcastFormModal
          podcast={editingPodcast}
          existingPodcast={podcast}
          onClose={() => {
            setShowFormModal(false);
            setEditingPodcast(null);
          }}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* 匯出 ZIP 進度 */}
      {exportingZip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">匯出 ZIP</h3>
            <div className="space-y-2">
              <div className="text-sm text-gray-600 dark:text-gray-400">{exportZipProgress.status}</div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all duration-300" style={{ width: `${exportZipProgress.total > 0 ? (exportZipProgress.current / exportZipProgress.total) * 100 : 0}%` }} />
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{exportZipProgress.current} / {exportZipProgress.total}</div>
            </div>
          </div>
        </div>
      )}

      {/* 匯入 ZIP 進度 */}
      {importingZip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">匯入 ZIP</h3>
            <div className="space-y-2">
              <div className="text-sm text-gray-600 dark:text-gray-400">{importZipProgress.status}</div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-orange-500 to-orange-600 transition-all duration-300" style={{ width: `${importZipProgress.total > 0 ? (importZipProgress.current / importZipProgress.total) * 100 : 0}%` }} />
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {importZipProgress.current} / {importZipProgress.total}
                {importZipProgress.total > 0 && ` (成功: ${importZipProgress.success}, 失敗: ${importZipProgress.failed})`}
              </div>
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
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">確認批次刪除</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                即將刪除 <span className="font-bold text-red-600">{selectedIds.size}</span> 筆播客，此操作無法復原
              </p>
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
                <code className="block bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg text-sm font-mono text-red-600">DELETE podcast</code>
                <input
                  type="text"
                  value={bulkDeleteInput}
                  onChange={(e) => setBulkDeleteInput(e.target.value)}
                  placeholder="輸入 DELETE podcast"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                />
              </div>
            )}
            <div className="p-6 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setBulkDeleteOpen(false); setBulkDeleteInput(""); }} disabled={isDeleting}>取消</Button>
              <Button
                onClick={handleBulkDelete}
                disabled={bulkDeleteInput !== "DELETE podcast" || isDeleting}
                className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
              >
                {isDeleting ? '刪除中...' : `確認刪除 (${selectedIds.size} 筆)`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 播客卡片
interface MusicCardProps {
  podcast: PodcastData;
  isPlaying: boolean;
  isExpanded: boolean;
  onPlay: () => void;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  cacheStatus: any;
  downloadAndCachePodcast: (podcast: any, onProgress?: (progress: number) => void) => Promise<void>;
  // Inline editing props
  inlineEditingId: string | null;
  inlineEditForm: { name: string; category: string; note: string; ref: string; cover: string };
  setInlineEditForm: (form: { name: string; category: string; note: string; ref: string; cover: string }) => void;
  onInlineEdit: (podcast: PodcastData) => void;
  onInlineSave: (podcastId: string) => void;
  onInlineCancel: () => void;
  // Inline cover upload props
  inlineCoverFile: File | null;
  inlineCoverPreview: string;
  setInlineCoverFile: (file: File | null) => void;
  setInlineCoverPreview: (preview: string) => void;
  inlineCoverUploading: boolean;
  // Bulk selection props
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

function PodcastCard({ podcast, isPlaying, isExpanded, onPlay, onToggleExpand, onEdit, onDelete, cacheStatus, downloadAndCachePodcast, inlineEditingId, inlineEditForm, setInlineEditForm, onInlineEdit, onInlineSave, onInlineCancel, inlineCoverFile, inlineCoverPreview, setInlineCoverFile, setInlineCoverPreview, inlineCoverUploading, selectionMode, isSelected, onToggleSelect }: MusicCardProps) {
  const [isLooping, setIsLooping] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const { checkPodcastCache } = usePodcastCache();
  const isInlineEditing = inlineEditingId === podcast.$id;

  // 檢查快取狀態
  useEffect(() => {
    const checkCache = async () => {
      const cached = await checkPodcastCache(podcast.$id);
      setIsCached(cached);
    };
    checkCache();
  }, [podcast.$id, checkPodcastCache]);

  const podcastCacheStatus = cacheStatus[podcast.$id];

  // 行內編輯模式
  if (isInlineEditing) {
    const handleInlineCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // 檢查檔案類型
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        alert('只支援 JPG, PNG, GIF, WEBP 格式的圖片');
        return;
      }

      // 檢查檔案大小 (5MB)
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        alert('封面圖大小不能超過 5MB');
        return;
      }

      setInlineCoverFile(file);
      const objectUrl = URL.createObjectURL(file);
      setInlineCoverPreview(objectUrl);
    };

    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden border-2 border-orange-500 p-4">
        <div className="space-y-3">
          <div className="text-sm font-semibold text-orange-600 dark:text-orange-400 mb-2">編輯中</div>

          {/* 封面圖編輯區域 */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">封面圖</label>
            {(inlineCoverPreview || inlineEditForm.cover) && (
              <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                <img
                  src={inlineCoverPreview || inlineEditForm.cover}
                  alt="封面預覽"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setInlineCoverFile(null);
                    setInlineCoverPreview('');
                    setInlineEditForm({ ...inlineEditForm, cover: '' });
                  }}
                  className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <Input
              placeholder="封面圖 URL"
              value={inlineEditForm.cover}
              onChange={(e) => setInlineEditForm({ ...inlineEditForm, cover: e.target.value })}
              className="h-9 rounded-lg text-sm"
            />
            <label className="flex items-center justify-center gap-2 px-3 py-2 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg cursor-pointer transition-colors">
              <Upload className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                {inlineCoverUploading ? '上傳中...' : inlineCoverFile ? inlineCoverFile.name : '上傳封面圖 (最大 5MB)'}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                onChange={handleInlineCoverSelect}
                disabled={inlineCoverUploading}
                className="hidden"
              />
            </label>
          </div>

          <Input
            placeholder="播客名稱"
            value={inlineEditForm.name}
            onChange={(e) => setInlineEditForm({ ...inlineEditForm, name: e.target.value })}
            className="h-9 rounded-lg text-sm"
          />
          <Input
            placeholder="分類"
            value={inlineEditForm.category}
            onChange={(e) => setInlineEditForm({ ...inlineEditForm, category: e.target.value })}
            className="h-9 rounded-lg text-sm"
          />
          <Input
            placeholder="參考 / Reference"
            value={inlineEditForm.ref}
            onChange={(e) => setInlineEditForm({ ...inlineEditForm, ref: e.target.value })}
            className="h-9 rounded-lg text-sm"
          />
          <Textarea
            placeholder="備註"
            value={inlineEditForm.note}
            onChange={(e) => setInlineEditForm({ ...inlineEditForm, note: e.target.value })}
            className="rounded-lg text-sm h-16 resize-none"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => onInlineSave(podcast.$id)}
              disabled={inlineCoverUploading}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50"
            >
              {inlineCoverUploading ? (
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  上傳中...
                </span>
              ) : (
                <><Check className="w-4 h-4 mr-1" /> 儲存</>
              )}
            </Button>
            <Button size="sm" variant="outline" onClick={onInlineCancel} disabled={inlineCoverUploading} className="flex-1 rounded-lg">
              <X className="w-4 h-4 mr-1" /> 取消
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 group border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={onToggleExpand}>
        {/* 全選 checkbox */}
        {selectionMode && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => { e.stopPropagation(); onToggleSelect?.(); }}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 rounded border-gray-300 text-red-600 cursor-pointer shrink-0"
          />
        )}
        {/* 封面 */}
        <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 group/cover">
          {podcast.cover ? (
            <img src={podcast.cover} alt={podcast.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <PodcastIcon className="text-white w-10 h-10 drop-shadow-lg" />
            </div>
          )}
          {/* 點擊提示 */}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/cover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="text-center text-white text-[10px] font-medium px-1">
              <ChevronDown className={`w-4 h-4 mx-auto mb-0.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              <span>詳情</span>
            </div>
          </div>
        </div>

        {/* 資訊區 */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-base text-gray-900 dark:text-gray-100 truncate">{podcast.name}</h3>
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                <Calendar className="w-3 h-3" />
                {formatLocalDate(podcast.$createdAt)}
              </div>
            </div>

            {/* 標籤 */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {podcast.category && (
                <span className="px-2.5 py-1 text-xs font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full">
                  {podcast.category}
                </span>
              )}
            </div>
          </div>

          {/* 播放器或占位 */}
          {podcast.file ? (
            <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2">
                <PlyrPlayer
                  type={isVideoFile(podcast.file) ? "video" : "audio"}
                  src={getProxiedMediaUrl(podcast.file)}
                  loop={isLooping}
                  className="w-full"
                />
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-400 dark:text-gray-500">
              尚未上傳播客檔案
            </div>
          )}
        </div>

        {/* 操作按鈕 */}
        <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {podcast.file && (
            <>
              <button
                onClick={() => setIsLooping(!isLooping)}
                className={`p-2 rounded-lg transition-all duration-200 ${isLooping
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                title={isLooping ? '重複播放' : '單次播放'}
              >
                <Repeat className="w-4 h-4" />
              </button>
              <button
                onClick={async () => {
                  await downloadAndCachePodcast({
                    $id: podcast.$id,
                    name: podcast.name,
                    file: getProxiedMediaUrl(podcast.file),
                    cover: podcast.cover,
                    category: podcast.category
                  });
                  setIsCached(true);
                }}
                disabled={isCached || podcastCacheStatus?.downloading}
                className={`p-2 rounded-lg transition-all duration-200 relative ${isCached || podcastCacheStatus?.cached
                  ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 cursor-default'
                  : podcastCacheStatus?.downloading
                    ? 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-500 cursor-wait'
                    : 'bg-gray-100 dark:bg-gray-700 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20'
                  }`}
                title={
                  isCached || podcastCacheStatus?.cached
                    ? '已快取'
                    : podcastCacheStatus?.downloading
                      ? `下載中 ${Math.round(podcastCacheStatus.progress)}%`
                      : '快取到本地'
                }
              >
                {isCached || podcastCacheStatus?.cached ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <HardDrive className="w-4 h-4" />
                )}
                {podcastCacheStatus?.downloading && (
                  <span className="absolute -bottom-1 -right-1 text-[8px] bg-cyan-600 text-white rounded-full px-1">
                    {Math.round(podcastCacheStatus.progress)}%
                  </span>
                )}
              </button>
            </>
          )}
          <button
            onClick={() => onInlineEdit(podcast)}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200"
            title="編輯"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
            title="刪除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 展開的詳細資訊 */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
          {/* 大封面 */}
          <div className="flex justify-center">
            <div className="relative w-full max-w-sm aspect-square rounded-xl overflow-hidden bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 shadow-xl">
              {podcast.cover ? (
                <img src={podcast.cover} alt={podcast.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <PodcastIcon className="text-white w-32 h-32 drop-shadow-2xl" />
                </div>
              )}
            </div>
          </div>

          {/* 標題和標籤 */}
          <div className="text-center space-y-2">
            <h3 className="font-bold text-xl text-gray-900 dark:text-gray-100">{podcast.name}</h3>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {podcast.category && (
                <span className="px-3 py-1 text-xs font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full">
                  {podcast.category}
                </span>
              )}
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <Calendar className="w-3 h-3" />
                {formatLocalDate(podcast.$createdAt)}
              </div>
            </div>
          </div>

          {/* 備註 */}
          {podcast.note && (
            <div>
              <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2">備註</h4>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                <p className="text-sm text-gray-700 dark:text-gray-300">{podcast.note}</p>
              </div>
            </div>
          )}

          {/* 關閉按鈕 */}
          <div className="flex justify-center">
            <button
              onClick={onToggleExpand}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors duration-200 flex items-center gap-2"
            >
              <ChevronDown className="w-4 h-4 rotate-180" />
              收起
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// 播客表單模態框
function PodcastFormModal({ podcast, existingPodcast, onClose, onSuccess }: { podcast: PodcastData | null; existingPodcast: PodcastData[]; onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: podcast?.name || '',
    file: podcast?.file || '',
    note: podcast?.note || '',
    ref: podcast?.ref || '',
    category: podcast?.category || '',
    hash: podcast?.hash || '',
    cover: podcast?.cover || '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
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
  const existingCategories = Array.from(new Set(existingPodcast.map(m => m.category).filter(Boolean)));

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

  // 從影片截圖作為封面（自動跳過黑畫面）
  const captureVideoThumbnail = (file: File): Promise<File | null> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true;
      video.playsInline = true;
      const objectUrl = URL.createObjectURL(file);
      video.src = objectUrl;

      // 設定超時，避免無限等待
      const timeout = setTimeout(() => {
        cleanup();
        console.warn('影片截圖超時');
        resolve(null);
      }, 15000);

      const cleanup = () => {
        clearTimeout(timeout);
        URL.revokeObjectURL(objectUrl);
        video.remove();
      };

      // 要嘗試的時間點（秒）
      const tryTimestamps = [3, 5, 1, 10];
      let currentTryIndex = 0;

      // 檢查畫面是否為黑畫面（平均亮度 < 10）
      const isBlackFrame = (ctx: CanvasRenderingContext2D, width: number, height: number): boolean => {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        let totalBrightness = 0;
        const sampleStep = Math.max(1, Math.floor(data.length / 4 / 500)); // 取樣 ~500 個像素
        let sampleCount = 0;
        for (let i = 0; i < data.length; i += 4 * sampleStep) {
          totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
          sampleCount++;
        }
        const avgBrightness = totalBrightness / sampleCount;
        return avgBrightness < 10;
      };

      const captureFrame = (): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return { canvas, ctx };
      };

      const handleSeeked = () => {
        try {
          const result = captureFrame();
          if (!result) { cleanup(); resolve(null); return; }
          const { canvas, ctx } = result;

          // 檢查是否黑畫面，如果是且還有其他時間點可嘗試
          if (isBlackFrame(ctx, canvas.width, canvas.height) && currentTryIndex < tryTimestamps.length) {
            const nextTime = Math.min(tryTimestamps[currentTryIndex], video.duration || 0);
            currentTryIndex++;
            video.currentTime = nextTime;
            return; // 等待下一次 seeked 事件
          }

          // 不是黑畫面，或已用完所有嘗試 → 輸出結果
          canvas.toBlob(
            (blob) => {
              cleanup();
              if (blob) {
                const thumbnailName = file.name.replace(/\.[^.]+$/, '') + '_cover.jpg';
                const thumbnailFile = new File([blob], thumbnailName, { type: 'image/jpeg' });
                resolve(thumbnailFile);
              } else {
                resolve(null);
              }
            },
            'image/jpeg',
            0.85
          );
        } catch (err) {
          cleanup();
          console.error('影片截圖失敗:', err);
          resolve(null);
        }
      };

      video.addEventListener('loadeddata', () => {
        // 先嘗試第一個時間點
        const firstTime = Math.min(tryTimestamps[currentTryIndex], video.duration || 0);
        currentTryIndex++;
        video.currentTime = firstTime;
      });

      video.addEventListener('seeked', handleSeeked);

      video.addEventListener('error', () => {
        cleanup();
        console.error('影片載入失敗');
        resolve(null);
      });
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 檢查檔案大小 (50MB = 50 * 1024 * 1024 bytes)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('播客檔案大小不能超過 50MB');
      return;
    }

    // 檢查檔案類型
    const validAudioTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/flac', 'audio/m4a', 'audio/x-m4a', 'audio/mp4'];
    const validVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
    const validTypes = [...validAudioTypes, ...validVideoTypes];

    if (!validTypes.includes(file.type)) {
      alert('只支援 MP3, WAV, OGG, AAC, FLAC, M4A 格式的音訊，或 MP4, WebM, MOV 格式的影片');
      return;
    }

    // 顯示預覽載入狀態
    setPreviewLoading(true);
    setUploadStatus('idle');
    setUploadProgress(0);
    setDuplicateWarning(''); // 清除之前的警告

    // 儲存檔案並產生預覽 URL
    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    // 計算檔案 hash
    const hash = await calculateFileHash(file);
    setFileHash(hash);

    // 如果名稱欄位為空，自動填入檔案名稱
    if (!formData.name) {
      setFormData({ ...formData, name: file.name, hash });
    } else {
      setFormData({ ...formData, hash });
    }

    // 檢查是否有重複的 hash
    const duplicatePodcast = existingPodcast.find(m =>
      m.hash === hash && (!podcast || m.$id !== podcast.$id)
    );

    if (duplicatePodcast) {
      setDuplicateWarning(`警告：此播客與「${duplicatePodcast.name}」相同，請勿重複上傳！`);
    }

    // 如果是影片且尚未手動選擇封面，自動從第 1 秒截圖作為封面
    if (validVideoTypes.includes(file.type) && !selectedCoverFile && !formData.cover) {
      setCoverPreviewLoading(true);
      captureVideoThumbnail(file).then((thumbnailFile) => {
        if (thumbnailFile) {
          setSelectedCoverFile(thumbnailFile);
          const thumbUrl = URL.createObjectURL(thumbnailFile);
          setCoverPreviewUrl(thumbUrl);
        }
        setCoverPreviewLoading(false);
      });
    }

    // 模擬預覽載入完成
    setTimeout(() => setPreviewLoading(false), 300);
  };

  const uploadFileToAppwrite = async (file: File): Promise<{ url: string; fileId: string }> => {
    setUploadStatus('uploading');
    setUploadProgress(0);

    try {
      const result = await uploadToAppwriteStorage(file, (progress) => {
        setUploadProgress(Math.min(progress, 99));
      });

      setUploadProgress(100);
      setUploadStatus('success');
      return result;
    } catch (error) {
      setUploadStatus('error');
      throw error;
    }
  };

  const handleCoverFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 檢查檔案大小 (50MB for cover images)
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
      const result = await uploadToAppwriteStorage(file, (progress) => {
        setCoverUploadProgress(Math.min(progress, 99));
      });

      setCoverUploadProgress(100);
      setCoverUploadStatus('success');
      return result;
    } catch (error) {
      setCoverUploadStatus('error');
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('請輸入播客名稱');
      return;
    }

    // 檢查是否有重複
    if (duplicateWarning) {
      alert('此播客與既有播客重複，無法上傳！請選擇其他播客。');
      return;
    }

    setSubmitting(true);
    try {
      let finalFormData = { ...formData };

      // 如果有選擇新檔案，先上傳到 Appwrite
      if (selectedFile) {
        try {
          const { url, fileId } = await uploadFileToAppwrite(selectedFile);
          finalFormData.file = url;
          // 使用已計算的 hash，如果沒有則使用 fileId
          finalFormData.hash = fileHash || fileId;
        } catch (uploadError) {
          throw new Error(`播客上傳失敗: ${uploadError instanceof Error ? uploadError.message : '未知錯誤'}`);
        }
      } else if (!podcast && !formData.hash) {
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

      const apiUrl = podcast
        ? addAppwriteConfigToUrl(`${API_ENDPOINTS.PODCAST}/${podcast.$id}`)
        : addAppwriteConfigToUrl(API_ENDPOINTS.PODCAST);
      const method = podcast ? 'PUT' : 'POST';

      const response = await fetch(apiUrl, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalFormData),
      });

      if (!response.ok) throw new Error(podcast ? '更新失敗' : '新增失敗');

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
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {podcast ? '編輯播客' : '新增播客'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              播客名稱 / Podcast Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="請輸入播客名稱 / Podcast Name"
              required
              className="h-12 rounded-xl"
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
              播客檔案 / Podcast File (URL or Upload)
            </label>
            <div className="space-y-3">
              <Input
                value={formData.file}
                onChange={(e) => setFormData({ ...formData, file: e.target.value })}
                placeholder="https://example.com/audio.mp3"
                disabled={submitting}
                className="h-12 rounded-xl"
              />
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">或 / OR</span>
                <label className="flex-1">
                  <div className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg cursor-pointer transition-colors">
                    <Upload className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                      {previewLoading ? '載入中...' : selectedFile ? `已選擇: ${selectedFile.name}` : '上傳播客 (最大 50MB) / Upload (Max 50MB)'}
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="audio/*,video/mp4,video/webm,video/quicktime,.m4a"
                    onChange={handleFileSelect}
                    disabled={submitting || previewLoading}
                    className="hidden"
                  />
                </label>
              </div>
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
                  {isVideoFile(selectedFile?.name || formData.file) ? (
                    <video src={previewUrl} controls className="w-full rounded-lg" />
                  ) : (
                    <audio src={previewUrl} controls className="w-full" />
                  )}
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
                      className="bg-purple-600 h-2 rounded-full transition-all duration-300"
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
                maxLength={150}
              />
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">或</span>
                <label className="flex-1">
                  <div className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg cursor-pointer transition-colors">
                    <Upload className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                      {coverPreviewLoading ? '載入中...' : selectedCoverFile ? `已選擇: ${selectedCoverFile.name}` : '上傳封面圖 (最大 50MB) / Upload Cover (Max 50MB)'}
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
                      className="bg-purple-600 h-2 rounded-full transition-all duration-300"
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

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              備註 / Note
            </label>
            <Textarea
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              placeholder="播客備註說明 / Podcast Note"
              rows={3}
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
                參考 / Reference
              </label>
              <Input
                value={formData.ref}
                onChange={(e) => setFormData({ ...formData, ref: e.target.value })}
                placeholder="參考資訊 / Reference Info"
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
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" onClick={onClose} className="flex-1 bg-gray-500 hover:bg-gray-600 rounded-xl">
              取消
            </Button>
            <Button
              type="submit"
              disabled={submitting || !!duplicateWarning}
              className="flex-1 bg-purple-500 hover:bg-purple-600 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? '處理中...' : (podcast ? '更新' : '新增')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
