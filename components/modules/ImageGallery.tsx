"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Image as ImageIcon, Plus, Edit, Trash2, RefreshCw, X, Calendar, Upload, Search, ChevronDown, Download, FolderUp, AlertTriangle, LayoutGrid, Rows3, ChevronLeft, ChevronRight } from "lucide-react";
import { SectionHeader } from "@/components/ui/section-header";
import { StatCard } from "@/components/ui/stat-card";
import { DataCard } from "@/components/ui/data-card";
import { FullPageLoading } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useImages, ImageData } from "@/hooks";
import { API_ENDPOINTS } from "@/lib/constants";
import { formatLocalDate } from "@/lib/formatters";
import { getAppwriteHeaders, getAppwriteDownloadUrl, getProxiedMediaUrl } from "@/lib/utils";
import { uploadToAppwriteStorage } from "@/lib/appwriteStorage";
import JSZip from "jszip";
import { FriendlyAiCrudShell } from "@/components/ui/friendly-ai-crud-shell";

type ImageSortMode = "created-desc" | "size-desc";

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

function formatFileSize(size?: number | null): string {
  if (typeof size !== "number" || !Number.isFinite(size) || size < 0) return "--";
  if (size === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const unitIndex = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / Math.pow(1024, unitIndex);
  const digits = unitIndex === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

export default function ImageGallery() {
  const { images, loading, error, loadImages } = useImages();
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingImage, setEditingImage] = useState<ImageData | null>(null);
  const [isInlineCreating, setIsInlineCreating] = useState(false);
  const [inlineCreateForm, setInlineCreateForm] = useState({
    name: '',
    file: '',
    filetype: '',
    note: '',
    ref: '',
    category: '',
    hash: '',
    cover: false,
  });
  const [inlineCreateFile, setInlineCreateFile] = useState<File | null>(null);
  const [inlineCreateFiles, setInlineCreateFiles] = useState<Array<{
    file: File;
    hash: string;
    filetype: string;
    defaultName: string;
    duplicateImageName?: string;
  }>>([]);
  const [inlineCreatePreviewUrl, setInlineCreatePreviewUrl] = useState('');
  const [inlineCreateSubmitting, setInlineCreateSubmitting] = useState(false);
  const [inlineCreatePreviewLoading, setInlineCreatePreviewLoading] = useState(false);
  const [inlineCreateUploadProgress, setInlineCreateUploadProgress] = useState(0);
  const [inlineCreateUploadStatus, setInlineCreateUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [inlineCreateFileHash, setInlineCreateFileHash] = useState('');
  const [inlineCreateDuplicateWarning, setInlineCreateDuplicateWarning] = useState('');
  const [inlineCreateUseCategorySelect, setInlineCreateUseCategorySelect] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [workbenchMode, setWorkbenchMode] = useState<"all" | "duplicates" | "uncategorized" | "annotated">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortMode, setSortMode] = useState<ImageSortMode>("created-desc");
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0, status: '', success: 0, failed: 0 });
  const [exportDebugMessages, setExportDebugMessages] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, status: '', success: 0, skipped: 0, failed: 0 });
  const [importDebugMessages, setImportDebugMessages] = useState<string[]>([]);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Inline editing state
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineEditForm, setInlineEditForm] = useState({
    name: '',
    note: '',
    category: '',
    ref: '',
    file: '',
    filetype: '',
    hash: '',
  });
  const [inlineEditFile, setInlineEditFile] = useState<File | null>(null);
  const [inlineEditPreviewUrl, setInlineEditPreviewUrl] = useState('');
  const [inlineEditPreviewLoading, setInlineEditPreviewLoading] = useState(false);
  const [inlineEditUploadProgress, setInlineEditUploadProgress] = useState(0);
  const [inlineEditUploadStatus, setInlineEditUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [inlineEditDuplicateWarning, setInlineEditDuplicateWarning] = useState('');

  // Bulk delete state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteInput, setBulkDeleteInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [deleteTotal, setDeleteTotal] = useState(0);
  const [isDeduplicating, setIsDeduplicating] = useState(false);

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 搜尋過濾
  const imageHashCounts = useMemo(() => {
    const counts = new Map<string, number>();
    images.forEach((image) => {
      if (image.hash) {
        counts.set(image.hash, (counts.get(image.hash) || 0) + 1);
      }
    });
    return counts;
  }, [images]);

  const duplicateImages = useMemo(
    () => images.filter((image) => image.hash && (imageHashCounts.get(image.hash) || 0) > 1),
    [images, imageHashCounts]
  );

  const duplicateGroups = useMemo(() => {
    const groups = new Map<string, ImageData[]>();
    duplicateImages.forEach((image) => {
      if (!image.hash) return;
      const existing = groups.get(image.hash) || [];
      existing.push(image);
      groups.set(image.hash, existing);
    });
    return Array.from(groups.values());
  }, [duplicateImages]);

  const duplicateExtraCount = useMemo(
    () => duplicateGroups.reduce((sum, group) => sum + Math.max(group.length - 1, 0), 0),
    [duplicateGroups]
  );

  const uncategorizedImages = useMemo(
    () => images.filter((image) => !image.category),
    [images]
  );

  const annotatedImages = useMemo(
    () => images.filter((image) => Boolean(image.note)),
    [images]
  );

  const filteredImages = useMemo(() => {
    const modeFiltered = images.filter((image) => {
      if (workbenchMode === "duplicates") return image.hash && (imageHashCounts.get(image.hash) || 0) > 1;
      if (workbenchMode === "uncategorized") return !image.category;
      if (workbenchMode === "annotated") return Boolean(image.note);
      return true;
    });

    const searched = searchQuery.trim()
      ? modeFiltered.filter(image => {
        const query = searchQuery.toLowerCase();
        return (
          image.name?.toLowerCase().includes(query) ||
          image.note?.toLowerCase().includes(query) ||
          image.category?.toLowerCase().includes(query)
        );
      })
      : modeFiltered;

    if (sortMode === "size-desc") {
      return [...searched].sort((a, b) => {
        const left = typeof a.size === "number" ? a.size : -1;
        const right = typeof b.size === "number" ? b.size : -1;
        if (right !== left) return right - left;
        return new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime();
      });
    }

    return searched;
  }, [images, searchQuery, workbenchMode, imageHashCounts, sortMode]);

  const existingCategories = useMemo(
    () => Array.from(new Set(images.map((img) => img.category).filter(Boolean))),
    [images]
  );

  const handleSelectAll = () => {
    if (filteredImages.length > 0 && filteredImages.every(img => selectedIds.has(img.$id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredImages.map(img => img.$id).filter(Boolean)));
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds).filter(id => !!id);
    setDeleteTotal(ids.length);
    setDeleteProgress(0);
    setIsDeleting(true);
    await Promise.all(ids.map(id => {
      const url = addAppwriteConfigToUrl(`${API_ENDPOINTS.IMAGE}/${id}`);
      return fetch(url, { method: 'DELETE' })
        .catch(err => console.error("Delete failed:", err))
        .finally(() => setDeleteProgress(prev => prev + 1));
    }));
    setIsDeleting(false);
    setSelectedIds(new Set());
    setSelectionMode(false);
    setBulkDeleteOpen(false);
    setBulkDeleteInput("");
    loadImages(true);
  };

  const getImageRetentionScore = (image: ImageData) => {
    let score = 0;
    if (image.category?.trim()) score += 4;
    if (image.note?.trim()) score += 4;
    if (image.ref?.trim()) score += 3;
    if (image.file?.trim()) score += 2;
    if (image.name?.trim()) score += 1;
    return score;
  };

  const handleCleanupDuplicates = async () => {
    if (duplicateGroups.length === 0 || isDeduplicating) return;

    const confirmed = window.confirm(
      `目前有 ${duplicateGroups.length} 組重複圖片，預計刪除 ${duplicateExtraCount} 張重複項目。\n` +
      `系統會優先保留資訊較完整、時間較新的圖片。\n\n是否繼續？`
    );

    if (!confirmed) return;

    const idsToDelete = duplicateGroups.flatMap((group) => {
      const sorted = [...group].sort((a, b) => {
        const scoreDiff = getImageRetentionScore(b) - getImageRetentionScore(a);
        if (scoreDiff !== 0) return scoreDiff;

        const updatedDiff = new Date(b.$updatedAt).getTime() - new Date(a.$updatedAt).getTime();
        if (updatedDiff !== 0) return updatedDiff;

        return new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime();
      });

      return sorted.slice(1).map((image) => image.$id).filter(Boolean);
    });

    if (idsToDelete.length === 0) {
      alert('目前沒有可清理的重複圖片。');
      return;
    }

    setIsDeduplicating(true);
    setDeleteTotal(idsToDelete.length);
    setDeleteProgress(0);

    let failedCount = 0;

    for (const id of idsToDelete) {
      try {
        const url = addAppwriteConfigToUrl(`${API_ENDPOINTS.IMAGE}/${id}`);
        const response = await fetch(url, { method: 'DELETE' });
        if (!response.ok) failedCount++;
      } catch (error) {
        console.error('Duplicate cleanup delete failed:', error);
        failedCount++;
      } finally {
        setDeleteProgress((prev) => prev + 1);
      }
    }

    setIsDeduplicating(false);
    await loadImages(true);

    if (failedCount > 0) {
      alert(`重複圖片清理完成，但有 ${failedCount} 張刪除失敗。`);
      return;
    }

    alert(`重複圖片清理完成，已刪除 ${idsToDelete.length} 張重複圖片。`);
  };

  const handleEdit = (image: ImageData) => {
    setEditingImage(image);
    setShowForm(true);
  };

  const handleAdd = () => {
    setIsInlineCreating(true);
    setInlineCreateForm({
      name: '',
      file: '',
      filetype: '',
      note: '',
      ref: '',
      category: '',
      hash: '',
      cover: false,
    });
    setInlineCreateFile(null);
    setInlineCreateFiles([]);
    setInlineCreatePreviewUrl('');
    setInlineCreateSubmitting(false);
    setInlineCreatePreviewLoading(false);
    setInlineCreateUploadProgress(0);
    setInlineCreateUploadStatus('idle');
    setInlineCreateFileHash('');
    setInlineCreateDuplicateWarning('');
    setInlineCreateUseCategorySelect(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingImage(null);
  };

  const handleInlineCreateCancel = () => {
    setIsInlineCreating(false);
    setInlineCreateForm({
      name: '',
      file: '',
      filetype: '',
      note: '',
      ref: '',
      category: '',
      hash: '',
      cover: false,
    });
    setInlineCreateFile(null);
    setInlineCreateFiles([]);
    setInlineCreatePreviewUrl('');
    setInlineCreateSubmitting(false);
    setInlineCreatePreviewLoading(false);
    setInlineCreateUploadProgress(0);
    setInlineCreateUploadStatus('idle');
    setInlineCreateFileHash('');
    setInlineCreateDuplicateWarning('');
    setInlineCreateUseCategorySelect(true);
  };

  // 開始行內編輯
  const appendExportDebug = (message: string) => {
    console.log(`[Image export] ${message}`);
    setExportDebugMessages((prev) => [...prev.slice(-79), message]);
  };

  const appendImportDebug = (message: string) => {
    console.log(`[Image import] ${message}`);
    setImportDebugMessages((prev) => [...prev.slice(-79), message]);
  };

  const handleInlineEdit = (image: ImageData) => {
    setInlineEditForm({
      name: image.name || '',
      note: image.note || '',
      category: image.category || '',
      ref: image.ref || '',
      file: image.file || '',
      filetype: image.filetype || '',
      hash: image.hash || '',
    });
    setInlineEditFile(null);
    setInlineEditPreviewUrl(image.file ? getProxiedMediaUrl(image.file) : '');
    setInlineEditPreviewLoading(false);
    setInlineEditUploadProgress(0);
    setInlineEditUploadStatus('idle');
    setInlineEditDuplicateWarning('');
    setInlineEditingId(image.$id);
  };

  const handleInlineEditFileSelect = async (file: File | null, currentImage: ImageData) => {
    if (!file) return;

    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('檔案大小不能超過 50MB');
      return;
    }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('只支援 JPG, PNG, GIF, WEBP 格式的圖片');
      return;
    }

    setInlineEditPreviewLoading(true);
    setInlineEditUploadStatus('idle');
    setInlineEditUploadProgress(0);
    setInlineEditDuplicateWarning('');
    setInlineEditFile(file);
    setInlineEditPreviewUrl(URL.createObjectURL(file));

    const hash = await calculateFileHash(await file.arrayBuffer());
    const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
    const duplicateImage = images.find((img) => img.hash === hash && img.$id !== currentImage.$id);

    setInlineEditForm((prev) => ({
      ...prev,
      filetype: fileExt,
      hash,
    }));

    if (duplicateImage) {
      setInlineEditDuplicateWarning(`警告：此圖片與「${duplicateImage.name}」相同，請勿重複上傳！`);
    }

    setTimeout(() => setInlineEditPreviewLoading(false), 300);
  };

  const uploadInlineEditFileToAppwrite = async (file: File): Promise<{ url: string; fileId: string }> => {
    setInlineEditUploadStatus('uploading');
    setInlineEditUploadProgress(0);

    try {
      const result = await uploadToAppwriteStorage(file, (progress) => {
        setInlineEditUploadProgress(progress);
      });
      setInlineEditUploadProgress(100);
      setInlineEditUploadStatus('success');
      return result;
    } catch (error) {
      setInlineEditUploadStatus('error');
      throw error;
    }
  };

  // 儲存行內編輯
  const handleInlineSave = async (imageId: string) => {
    if (!inlineEditingId) return;
    try {
      if (inlineEditDuplicateWarning) {
        alert('此圖片與既有圖片重複，無法重新上傳！請選擇其他圖片。');
        return;
      }

      const finalFormData = { ...inlineEditForm };
      if (inlineEditFile) {
        const { url, fileId } = await uploadInlineEditFileToAppwrite(inlineEditFile);
        finalFormData.file = url;
        finalFormData.hash = finalFormData.hash || fileId;
      }

      const url = addAppwriteConfigToUrl(`${API_ENDPOINTS.IMAGE}/${imageId}`);
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: finalFormData.name,
          note: finalFormData.note,
          category: finalFormData.category,
          ref: finalFormData.ref,
          file: finalFormData.file,
          filetype: finalFormData.filetype,
          hash: finalFormData.hash,
        }),
      });
      if (!response.ok) throw new Error('更新失敗');
      loadImages(true);
      setInlineEditingId(null);
      setInlineEditForm({ name: '', note: '', category: '', ref: '', file: '', filetype: '', hash: '' });
      setInlineEditFile(null);
      setInlineEditPreviewUrl('');
      setInlineEditPreviewLoading(false);
      setInlineEditUploadProgress(0);
      setInlineEditUploadStatus('idle');
      setInlineEditDuplicateWarning('');
    } catch (error) {
      console.error('Inline edit failed:', error);
      alert(error instanceof Error ? error.message : '更新失敗，請稍後再試');
    }
  };

  // 取消行內編輯
  const cancelInlineEdit = () => {
    setInlineEditingId(null);
    setInlineEditForm({ name: '', note: '', category: '', ref: '', file: '', filetype: '', hash: '' });
    setInlineEditFile(null);
    setInlineEditPreviewUrl('');
    setInlineEditPreviewLoading(false);
    setInlineEditUploadProgress(0);
    setInlineEditUploadStatus('idle');
    setInlineEditDuplicateWarning('');
  };

  const handleInlineCreateFileSelect = async (files: File[]) => {
    if (files.length === 0) return;

    const maxSize = 50 * 1024 * 1024;
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

    const invalidSizeFile = files.find((file) => file.size > maxSize);
    if (invalidSizeFile) {
      alert(`檔案「${invalidSizeFile.name}」大小不能超過 50MB`);
      return;
    }

    const invalidTypeFile = files.find((file) => !validTypes.includes(file.type));
    if (invalidTypeFile) {
      alert(`檔案「${invalidTypeFile.name}」格式不支援，僅支援 JPG, PNG, GIF, WEBP`);
      return;
    }

    setInlineCreatePreviewLoading(true);
    setInlineCreateUploadStatus('idle');
    setInlineCreateUploadProgress(0);
    setInlineCreateDuplicateWarning('');

    const preparedFiles = await Promise.all(files.map(async (file) => {
      const hash = await calculateFileHash(await file.arrayBuffer());
      const filetype = file.name.split('.').pop()?.toLowerCase() || '';
      const defaultName = file.name.replace(/\.[^/.]+$/, '');
      const duplicateImage = images.find((img) => img.hash === hash);

      return {
        file,
        hash,
        filetype,
        defaultName,
        duplicateImageName: duplicateImage?.name,
      };
    }));

    const firstFile = preparedFiles[0];
    const duplicateCount = preparedFiles.filter((item) => item.duplicateImageName).length;

    setInlineCreateFiles(preparedFiles);
    setInlineCreateFile(firstFile.file);
    setInlineCreatePreviewUrl(URL.createObjectURL(firstFile.file));
    setInlineCreateFileHash(firstFile.hash);
    setInlineCreateForm((prev) => ({
      ...prev,
      name: preparedFiles.length === 1 ? (prev.name.trim() ? prev.name : firstFile.defaultName) : '',
      hash: preparedFiles.length === 1 ? firstFile.hash : '',
      filetype: preparedFiles.length === 1 ? firstFile.filetype : '',
    }));

    if (duplicateCount > 0) {
      setInlineCreateDuplicateWarning(`提醒：${duplicateCount} 張圖片與既有圖片重複，儲存時會自動跳過。`);
    }

    setTimeout(() => setInlineCreatePreviewLoading(false), 300);
  };

  const uploadInlineCreateFileToAppwrite = async (
    file: File,
    mapProgress?: (progress: number) => number
  ): Promise<{ url: string; fileId: string }> => {
    setInlineCreateUploadStatus('uploading');
    if (!mapProgress) setInlineCreateUploadProgress(0);

    try {
      const result = await uploadToAppwriteStorage(file, (progress) => {
        setInlineCreateUploadProgress(mapProgress ? mapProgress(progress) : progress);
      });
      if (!mapProgress) {
        setInlineCreateUploadProgress(100);
        setInlineCreateUploadStatus('success');
      }
      return result;
    } catch (error) {
      setInlineCreateUploadStatus('error');
      throw error;
    }
  };

  const handleInlineCreateSave = async () => {
    if (!inlineCreateFiles.length && !inlineCreateForm.name.trim()) {
      alert('請輸入圖片名稱');
      return;
    }

    if (inlineCreateFiles.length === 1 && inlineCreateFiles[0]?.duplicateImageName) {
      alert('此圖片與既有圖片重複，無法上傳！請選擇其他圖片。');
      return;
    }

    setInlineCreateSubmitting(true);

    try {
      if (inlineCreateFiles.length > 1) {
        const uploadableFiles = inlineCreateFiles.filter((item) => !item.duplicateImageName);
        let successCount = 0;
        let skippedCount = inlineCreateFiles.length - uploadableFiles.length;
        let failedCount = 0;
        const totalUploadable = Math.max(uploadableFiles.length, 1);
        setInlineCreateUploadStatus('uploading');
        setInlineCreateUploadProgress(0);

        for (let i = 0; i < uploadableFiles.length; i++) {
          const item = uploadableFiles[i];
          const { url, fileId } = await uploadInlineCreateFileToAppwrite(item.file, (fileProgress) => {
            return Math.min(99, Math.round(((i + fileProgress / 100) / totalUploadable) * 100));
          });
          setInlineCreateUploadProgress(Math.round(((i + 1) / totalUploadable) * 100));
          const payload = {
            ...inlineCreateForm,
            name: item.defaultName,
            file: url,
            filetype: item.filetype,
            hash: item.hash || fileId,
          };

          const response = await fetch(addAppwriteConfigToUrl(API_ENDPOINTS.IMAGE), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (response.ok) successCount++;
          else failedCount++;
        }
        setInlineCreateUploadProgress(100);
        setInlineCreateUploadStatus(failedCount > 0 && successCount === 0 ? 'error' : 'success');

        if (successCount === 0 && skippedCount > 0 && failedCount === 0) {
          throw new Error('選取的圖片都與既有圖片重複，沒有新增任何資料。');
        }

        if (successCount === 0 && failedCount > 0) {
          throw new Error('批次上傳失敗，沒有新增任何圖片。');
        }

        alert(`批次上傳完成\n成功：${successCount} 張\n跳過重複：${skippedCount} 張\n失敗：${failedCount} 張`);
      } else {
        const finalFormData = { ...inlineCreateForm };

        if (inlineCreateFile) {
          const { url, fileId } = await uploadInlineCreateFileToAppwrite(inlineCreateFile);
          finalFormData.file = url;
          finalFormData.hash = inlineCreateFileHash || fileId;
        } else if (!finalFormData.hash) {
          finalFormData.hash = `no_file_${Date.now()}`;
        }

        const response = await fetch(addAppwriteConfigToUrl(API_ENDPOINTS.IMAGE), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(finalFormData),
        });

        if (!response.ok) throw new Error('新增失敗');
      }

      handleInlineCreateCancel();
      loadImages(true);
    } catch (error) {
      alert(error instanceof Error ? error.message : '操作失敗');
      setInlineCreateSubmitting(false);
    }
  };

  // Export all images as ZIP
  const handleExportZip = async () => {
    if (images.length === 0) {
      alert('沒有圖片可以匯出');
      return;
    }

    if (exporting) return;

    const confirm = window.confirm(`準備匯出 ${images.length} 張圖片至 ZIP 檔案，是否繼續？`);
    if (!confirm) return;

    setExporting(true);
    setExportDebugMessages([]);
    setExportProgress({ current: 0, total: images.length, status: '準備中...', success: 0, failed: 0 });
    appendExportDebug(`開始匯出，共 ${images.length} 張圖片。`);

    try {
      const zip = new JSZip();
      zip.folder('images');

      const csvRows: string[][] = [];
      const csvHeaders = ['name', 'file', 'filetype', 'category', 'note', 'ref', 'hash'];
      csvRows.push(csvHeaders);

      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const seq = String(i + 1).padStart(3, '0');
        const sanitizedName = image.name.replace(/[<>:"\/\\|?*]/g, '_');
        const baseName = `${seq}_${sanitizedName}`;

        setExportProgress((prev) => ({ ...prev, current: i + 1, total: images.length, status: `正在下載: ${image.name}` }));
        appendExportDebug(`[${i + 1}/${images.length}] 開始下載 ${image.name}`);

        // Detect file extension
        const fileExtension = image.filetype || image.file?.split('.').pop()?.split('?')[0] || 'jpg';

        // Download and add image file
        let imagePath = '';
        if (image.file) {
          try {
            const downloadUrl = getProxiedMediaUrl(getAppwriteDownloadUrl(image.file));
            const response = await fetch(downloadUrl);
            if (response.ok) {
              const blob = await response.blob();
              imagePath = `images/${baseName}.${fileExtension}`;
              zip.file(imagePath, blob);
              setExportProgress((prev) => ({ ...prev, success: prev.success + 1 }));
              appendExportDebug(`[${i + 1}/${images.length}] 下載成功 ${image.name} -> ${imagePath}`);
            } else {
              setExportProgress((prev) => ({ ...prev, failed: prev.failed + 1 }));
              appendExportDebug(`[${i + 1}/${images.length}] 下載失敗 ${image.name}，HTTP ${response.status}`);
            }
          } catch (err) {
            console.error(`下載圖片 ${image.name} 時出錯:`, err);
            setExportProgress((prev) => ({ ...prev, failed: prev.failed + 1 }));
            appendExportDebug(`[${i + 1}/${images.length}] 下載例外 ${image.name}: ${err instanceof Error ? err.message : '未知錯誤'}`);
          }
        } else {
          setExportProgress((prev) => ({ ...prev, failed: prev.failed + 1 }));
          appendExportDebug(`[${i + 1}/${images.length}] 跳過 ${image.name}，沒有可下載的檔案網址。`);
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
          escapeCsv(image.name || ''),
          escapeCsv(imagePath),
          escapeCsv(image.filetype || ''),
          escapeCsv(image.category || ''),
          escapeCsv(image.note || ''),
          escapeCsv(image.ref || ''),
          escapeCsv(image.hash || ''),
        ]);
      }

      // Generate CSV and add to ZIP
      const csvContent = csvRows.map(row => row.join(',')).join('\n');
      zip.file('image.csv', csvContent);

      setExportProgress((prev) => ({ ...prev, current: images.length, total: images.length, status: '正在壓縮...' }));
      appendExportDebug('所有圖片處理完成，開始壓縮 ZIP。');

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = `appwrite-image.zip`;
      link.click();
      URL.revokeObjectURL(link.href);

      setExportProgress((prev) => ({ ...prev, current: images.length, total: images.length, status: '完成！' }));
      appendExportDebug('ZIP 產生完成，已開始下載。');
      window.setTimeout(() => {
        setExporting(false);
        setExportProgress({ current: 0, total: 0, status: '', success: 0, failed: 0 });
        setExportDebugMessages([]);
      }, 2200);
    } catch (error) {
      console.error('ZIP export error:', error);
      appendExportDebug(`匯出失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
      setExportProgress((prev) => ({ ...prev, status: '匯出失敗，請查看 debug 訊息。' }));
      alert('匯出失敗，請再試一次');
      window.setTimeout(() => {
        setExporting(false);
        setExportProgress({ current: 0, total: 0, status: '', success: 0, failed: 0 });
        setExportDebugMessages([]);
      }, 4000);
    }
  };

  // 計算檔案 SHA-256 hash
  const calculateFileHash = async (arrayBuffer: ArrayBuffer): Promise<string> => {
    try {
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.error('Hash calculation error:', error);
      return `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  };

  // Import images from ZIP
  const handleImportZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input
    if (importInputRef.current) {
      importInputRef.current.value = '';
    }

    if (!file.name.toLowerCase().endsWith('.zip')) {
      alert('請選擇 ZIP 檔案');
      return;
    }

    setImporting(true);
    setImportProgress({ current: 0, total: 0, status: '正在解壓縮 ZIP...', success: 0, skipped: 0, failed: 0 });

    try {
      const zip = await JSZip.loadAsync(file);

      // Check if this is a new-format ZIP with image.csv
      const csvFile = zip.files['image.csv'];
      if (csvFile) {
        // New format: parse CSV and restore full data
        const csvText = await csvFile.async('string');
        const lines = csvText.split('\n').filter(line => line.trim());
        if (lines.length < 2) { alert('CSV 檔案沒有資料'); setImporting(false); return; }

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
        setImportProgress({ current: 0, total, status: `找到 ${total} 筆圖片記錄`, success: 0, skipped: 0, failed: 0 });
        let successCount = 0, failedCount = 0;

        for (let i = 0; i < dataRows.length; i++) {
          const row = dataRows[i];
          setImportProgress({ current: i + 1, total, status: `正在處理: ${row.name || '未知'}`, success: successCount, skipped: 0, failed: failedCount });

          try {
            // Upload image file from ZIP
            let remoteFileUrl = '';
            if (row.file && zip.files[row.file]) {
              const imageBlob = await zip.files[row.file].async('blob');
              const fileName = row.file.split('/').pop() || 'image.jpg';
              const imageFileObj = new File([imageBlob], fileName, { type: 'application/octet-stream' });
              const uploadResult = await uploadToAppwriteStorage(imageFileObj);
              remoteFileUrl = uploadResult.url;
            }

            // Check if record already exists (same name)
            const existing = images.find(m => m.name === row.name);
            const apiUrl = existing
              ? addAppwriteConfigToUrl(`${API_ENDPOINTS.IMAGE}/${existing.$id}`)
              : addAppwriteConfigToUrl(API_ENDPOINTS.IMAGE);
            const method = existing ? 'PUT' : 'POST';

            const submitData: Record<string, string | boolean> = {
              name: row.name || '',
              file: remoteFileUrl || (existing ? existing.file : ''),
              filetype: row.filetype || '',
              category: row.category || '',
              note: row.note || '',
              ref: row.ref || '',
              hash: row.hash || (existing ? existing.hash : `zip_import_${Date.now()}_${Math.random().toString(36).substring(7)}`),
              cover: false,
            };

            const response = await fetch(apiUrl, {
              method,
              headers: { 'Content-Type': 'application/json', ...getAppwriteHeaders() },
              body: JSON.stringify(submitData),
            });

            if (response.ok) successCount++; else failedCount++;
          } catch (err) { console.error(`處理 ${row.name} 時出錯:`, err); failedCount++; }
          setImportProgress({ current: i + 1, total, status: `正在處理: ${row.name || '未知'}`, success: successCount, skipped: 0, failed: failedCount });
        }

        setImportProgress({ current: total, total, status: '完成！', success: successCount, skipped: 0, failed: failedCount });
        setTimeout(() => { setImporting(false); setImportProgress({ current: 0, total: 0, status: '', success: 0, skipped: 0, failed: 0 }); loadImages(true); }, 2000);
      } else {
        // Legacy format: plain image files in ZIP (backwards compatible)
        const imageFiles: { name: string; file: JSZip.JSZipObject }[] = [];
        const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

        zip.forEach((relativePath, zipEntry) => {
          if (!zipEntry.dir) {
            const ext = relativePath.split('.').pop()?.toLowerCase() || '';
            if (validExtensions.includes(ext)) {
              imageFiles.push({ name: relativePath, file: zipEntry });
            }
          }
        });

        if (imageFiles.length === 0) {
          alert('ZIP 檔案中沒有找到圖片檔案 (JPG, PNG, GIF, WEBP)');
          setImporting(false);
          return;
        }

        let successCount = 0;
        let failedCount = 0;

        for (let i = 0; i < imageFiles.length; i++) {
          const imageFile = imageFiles[i];
          const fileName = imageFile.name.split('/').pop() || imageFile.name;

          setImportProgress({
            current: i + 1,
            total: imageFiles.length,
            status: `正在處理: ${fileName}`,
            success: successCount,
            skipped: 0,
            failed: failedCount
          });

          try {
            const arrayBuffer = await imageFile.file.async('arraybuffer');
            const ext = fileName.split('.').pop()?.toLowerCase() || 'jpg';
            const mimeType = ext === 'png' ? 'image/png' :
              ext === 'gif' ? 'image/gif' :
                ext === 'webp' ? 'image/webp' : 'image/jpeg';
            const blob = new Blob([arrayBuffer], { type: mimeType });
            const imageFileObj = new File([blob], fileName, { type: mimeType });

            const formDataUpload = new FormData();
            formDataUpload.append('file', imageFileObj);

            const uploadResponse = await fetch('/api/upload-image', {
              method: 'POST',
              headers: getAppwriteHeaders(),
              body: formDataUpload,
            });

            if (!uploadResponse.ok) throw new Error('上傳失敗');
            const uploadData = await uploadResponse.json();

            const createUrl = addAppwriteConfigToUrl(API_ENDPOINTS.IMAGE);
            const createResponse = await fetch(createUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: fileName,
                file: uploadData.url,
                filetype: ext,
                note: '',
                ref: '',
                category: '',
                hash: '',
                cover: false
              }),
            });

            if (createResponse.ok) successCount++; else failedCount++;
          } catch (error) {
            console.error(`匯入失敗: ${fileName}`, error);
            failedCount++;
          }
        }

        setImportProgress({
          current: imageFiles.length,
          total: imageFiles.length,
          status: '完成！',
          success: successCount,
          skipped: 0,
          failed: failedCount
        });
        setTimeout(() => { setImporting(false); setImportProgress({ current: 0, total: 0, status: '', success: 0, skipped: 0, failed: 0 }); loadImages(true); }, 2000);
      }
    } catch (error) {
      console.error('ZIP import error:', error);
      alert('匯入失敗，請確認 ZIP 檔案格式正確');
    } finally {
      setImporting(false);
      setImportProgress({ current: 0, total: 0, status: '', success: 0, skipped: 0, failed: 0 });
    }
  };

  const handleImportZipWithDebug = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (importInputRef.current) {
      importInputRef.current.value = '';
    }

    if (!file.name.toLowerCase().endsWith('.zip')) {
      alert('隢??ZIP 瑼?');
      return;
    }

    const resetImportUi = () => {
      setImporting(false);
      setImportProgress({ current: 0, total: 0, status: '', success: 0, skipped: 0, failed: 0 });
      setImportDebugMessages([]);
    };

    setImporting(true);
    setImportDebugMessages([]);
    setImportProgress({ current: 0, total: 0, status: '讀取 ZIP 中...', success: 0, skipped: 0, failed: 0 });
    appendImportDebug(`開始匯入 ZIP：${file.name}`);

    try {
      const zip = await JSZip.loadAsync(file);
      appendImportDebug('ZIP 讀取完成。');

      const csvFile = zip.files['image.csv'];
      if (csvFile) {
        appendImportDebug('偵測到 image.csv，使用完整備份匯入模式。');

        const csvText = await csvFile.async('string');
        const lines = csvText.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
          appendImportDebug('image.csv 沒有可用資料列。');
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

        const total = dataRows.length;
        let successCount = 0;
        let failedCount = 0;

        setImportProgress({ current: 0, total, status: `準備匯入 ${total} 筆圖片`, success: 0, skipped: 0, failed: 0 });
        appendImportDebug(`CSV 解析完成，共 ${total} 筆。`);

        for (let i = 0; i < dataRows.length; i++) {
          const row = dataRows[i];
          const rowName = row.name || '未命名圖片';

          setImportProgress({ current: i + 1, total, status: `處理中: ${rowName}`, success: successCount, skipped: 0, failed: failedCount });
          appendImportDebug(`[${i + 1}/${total}] 開始處理 ${rowName}`);

          try {
            let remoteFileUrl = '';
            if (row.file && zip.files[row.file]) {
              const imageBlob = await zip.files[row.file].async('blob');
              const fileName = row.file.split('/').pop() || 'image.jpg';
              const imageFileObj = new File([imageBlob], fileName, { type: 'application/octet-stream' });
              const uploadResult = await uploadToAppwriteStorage(imageFileObj);
              remoteFileUrl = uploadResult.url;
              appendImportDebug(`[${i + 1}/${total}] 圖片上傳成功 ${fileName}`);
            } else {
              appendImportDebug(`[${i + 1}/${total}] 找不到對應圖片檔，將沿用既有欄位。`);
            }

            const existing = images.find((item) => item.name === row.name);
            const apiUrl = existing
              ? addAppwriteConfigToUrl(`${API_ENDPOINTS.IMAGE}/${existing.$id}`)
              : addAppwriteConfigToUrl(API_ENDPOINTS.IMAGE);
            const method = existing ? 'PUT' : 'POST';

            const submitData: Record<string, string | boolean> = {
              name: row.name || '',
              file: remoteFileUrl || (existing ? existing.file : ''),
              filetype: row.filetype || '',
              category: row.category || '',
              note: row.note || '',
              ref: row.ref || '',
              hash: row.hash || (existing ? existing.hash : `zip_import_${Date.now()}_${Math.random().toString(36).substring(7)}`),
              cover: false,
            };

            const response = await fetch(apiUrl, {
              method,
              headers: { 'Content-Type': 'application/json', ...getAppwriteHeaders() },
              body: JSON.stringify(submitData),
            });

            if (response.ok) {
              successCount++;
              appendImportDebug(`[${i + 1}/${total}] ${existing ? '更新' : '新增'}成功 ${rowName}`);
            } else {
              failedCount++;
              appendImportDebug(`[${i + 1}/${total}] ${existing ? '更新' : '新增'}失敗 ${rowName}，HTTP ${response.status}`);
            }
          } catch (error) {
            console.error(`[Image import] Failed: ${rowName}`, error);
            failedCount++;
            appendImportDebug(`[${i + 1}/${total}] 處理失敗 ${rowName}: ${error instanceof Error ? error.message : '未知錯誤'}`);
          }
        }

        setImportProgress({ current: total, total, status: '匯入完成', success: successCount, skipped: 0, failed: failedCount });
        appendImportDebug(`匯入完成，成功 ${successCount} 筆，失敗 ${failedCount} 筆。`);
        setTimeout(() => {
          resetImportUi();
          loadImages(true);
        }, 2000);
        return;
      }

      appendImportDebug('未偵測到 image.csv，改用舊格式圖片匯入模式。');
      const imageFiles: { name: string; file: JSZip.JSZipObject }[] = [];
      const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

      zip.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir) {
          const ext = relativePath.split('.').pop()?.toLowerCase() || '';
          if (validExtensions.includes(ext)) {
            imageFiles.push({ name: relativePath, file: zipEntry });
          }
        }
      });

      if (imageFiles.length === 0) {
        appendImportDebug('ZIP 中沒有可匯入的圖片檔案。');
        alert('ZIP 瑼?銝剜???啣???獢?(JPG, PNG, GIF, WEBP)');
        resetImportUi();
        return;
      }

      let successCount = 0;
      let failedCount = 0;
      setImportProgress({ current: 0, total: imageFiles.length, status: `找到 ${imageFiles.length} 張圖片`, success: 0, skipped: 0, failed: 0 });
      appendImportDebug(`找到 ${imageFiles.length} 張圖片檔案。`);

      for (let i = 0; i < imageFiles.length; i++) {
        const imageFile = imageFiles[i];
        const fileName = imageFile.name.split('/').pop() || imageFile.name;

        setImportProgress({ current: i + 1, total: imageFiles.length, status: `處理中: ${fileName}`, success: successCount, skipped: 0, failed: failedCount });
        appendImportDebug(`[${i + 1}/${imageFiles.length}] 開始匯入 ${fileName}`);

        try {
          const arrayBuffer = await imageFile.file.async('arraybuffer');
          const ext = fileName.split('.').pop()?.toLowerCase() || 'jpg';
          const mimeType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
          const blob = new Blob([arrayBuffer], { type: mimeType });
          const imageFileObj = new File([blob], fileName, { type: mimeType });

          const formDataUpload = new FormData();
          formDataUpload.append('file', imageFileObj);

          const uploadResponse = await fetch('/api/upload-image', {
            method: 'POST',
            headers: getAppwriteHeaders(),
            body: formDataUpload,
          });

          if (!uploadResponse.ok) {
            throw new Error('銝憭望?');
          }

          const uploadData = await uploadResponse.json();
          const createUrl = addAppwriteConfigToUrl(API_ENDPOINTS.IMAGE);
          const createResponse = await fetch(createUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: fileName,
              file: uploadData.url,
              filetype: ext,
              note: '',
              ref: '',
              category: '',
              hash: '',
              cover: false,
            }),
          });

          if (createResponse.ok) {
            successCount++;
            appendImportDebug(`[${i + 1}/${imageFiles.length}] 新增成功 ${fileName}`);
          } else {
            failedCount++;
            appendImportDebug(`[${i + 1}/${imageFiles.length}] 新增失敗 ${fileName}，HTTP ${createResponse.status}`);
          }
        } catch (error) {
          console.error(`[Image import] Failed: ${fileName}`, error);
          failedCount++;
          appendImportDebug(`[${i + 1}/${imageFiles.length}] 匯入失敗 ${fileName}: ${error instanceof Error ? error.message : '未知錯誤'}`);
        }
      }

      setImportProgress({ current: imageFiles.length, total: imageFiles.length, status: '匯入完成', success: successCount, skipped: 0, failed: failedCount });
      appendImportDebug(`舊格式匯入完成，成功 ${successCount} 筆，失敗 ${failedCount} 筆。`);
      setTimeout(() => {
        resetImportUi();
        loadImages(true);
      }, 2000);
    } catch (error) {
      console.error('ZIP import error:', error);
      appendImportDebug(`匯入流程失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
      alert('?臬憭望?嚗?蝣箄? ZIP 瑼??澆?甇?Ⅱ');
      setTimeout(() => {
        resetImportUi();
      }, 2000);
    }
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <FriendlyAiCrudShell
        title="鋒兄圖片"
        description="圖片資產、重複檢查與快速整理入口放在同一個工作台，先看出哪些該補分類、哪些可能重複。"
        searchPlaceholder="搜尋圖片名稱、備註、分類..."
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        workspaceCountText={`共 ${images.length} 張圖片`}
        workspaceDescription="集中整理圖片名稱、分類、標籤與備註，優先處理重複圖片、缺少分類與標註不足的內容。"
        activeMode={workbenchMode}
        onModeChange={(mode) => setWorkbenchMode(mode as typeof workbenchMode)}
        modeItems={[
          { key: "all", label: "全部圖片", count: images.length },
          { key: "duplicates", label: "重複疑慮", count: duplicateImages.length },
          { key: "uncategorized", label: "未分類", count: uncategorizedImages.length },
          { key: "annotated", label: "有備註", count: annotatedImages.length },
        ]}
        suggestions={[
          duplicateImages.length > 0
            ? { title: "先清重複", body: `目前有 ${duplicateImages.length} 張圖片 hash 重複，建議先批次清理再做標註。`, tone: "red" }
            : { title: "重複狀態", body: "目前沒有明顯重複圖，之後可以把重心放到分類與備註。", tone: "green" },
          uncategorizedImages.length > 0
            ? { title: "補分類", body: `有 ${uncategorizedImages.length} 張圖片沒有分類，之後語意搜尋和批次整理會變慢。`, tone: "amber" }
            : { title: "分類完整度", body: "圖片分類已經有基礎，後續可再補 AI 標籤或 OCR。", tone: "blue" },
          annotatedImages.length < images.length
            ? { title: "上下文不足", body: "若是工作或生活紀錄圖，替關鍵圖片補備註會比只看檔名更容易回想。", tone: "neutral" }
            : { title: "上下文充足", body: "大多數圖片已有備註，接下來適合做語意搜尋和批次整理。", tone: "green" },
        ]}
        toolbar={
          <>
            <Button
              onClick={() => loadImages(true)}
              disabled={loading || exporting || importing}
              variant="outline"
              className="gap-2 rounded-xl h-10 px-4"
              title="重新整理"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              <span className="hidden sm:inline">重新整理</span>
            </Button>
            <Button
              onClick={handleExportZip}
              disabled={loading || exporting || importing || images.length === 0}
              className="gap-2 bg-purple-500 hover:bg-purple-600 rounded-xl disabled:opacity-50"
              title="匯出所有圖片為 ZIP"
            >
              <Download size={16} className={exporting ? "animate-bounce" : ""} />
              <span className="hidden sm:inline">{exporting ? "匯出中..." : "匯出 ZIP"}</span>
            </Button>
            <Button
              onClick={() => importInputRef.current?.click()}
              disabled={loading || exporting || importing}
              className="gap-2 bg-orange-500 hover:bg-orange-600 rounded-xl disabled:opacity-50"
              title="從 ZIP 匯入圖片"
            >
              <FolderUp size={16} className={importing ? "animate-bounce" : ""} />
              <span className="hidden sm:inline">{importing ? "匯入中..." : "匯入 ZIP"}</span>
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept=".zip"
              onChange={handleImportZipWithDebug}
              className="hidden"
            />
            {duplicateImages.length > 0 && (
              <Button
                onClick={handleCleanupDuplicates}
                disabled={loading || exporting || importing || isDeduplicating}
                className="gap-2 rounded-xl h-10 px-4 bg-red-500 hover:bg-red-600 text-white disabled:opacity-50"
                title="一鍵清理重複圖片"
              >
                <Trash2 size={16} className={isDeduplicating ? "animate-pulse" : ""} />
                <span className="hidden sm:inline">
                  {isDeduplicating ? `清理中 ${deleteProgress}/${deleteTotal}` : `清理重複 (${duplicateExtraCount})`}
                </span>
              </Button>
            )}
            {selectionMode ? (
              <>
                <Button onClick={() => { setSelectedIds(new Set()); setSelectionMode(false); }} variant="outline" className="rounded-xl h-10 px-4">
                  取消選取
                </Button>
                <Button onClick={handleSelectAll} variant="outline" className="rounded-xl h-10 px-4">
                  {filteredImages.length > 0 && filteredImages.every((image) => selectedIds.has(image.$id)) ? "取消全選" : "全選"}
                </Button>
              </>
            ) : (
              <Button onClick={() => setSelectionMode(true)} variant="outline" className="rounded-xl h-10 px-4">
                開啟選取
              </Button>
            )}
            <Select value={sortMode} onValueChange={(value) => setSortMode(value as ImageSortMode)}>
              <SelectTrigger className="h-10 w-[170px] rounded-xl bg-white/80 text-sm dark:bg-slate-900/70">
                <SelectValue placeholder="排序" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created-desc">最新建立</SelectItem>
                <SelectItem value="size-desc">檔案大小：大到小</SelectItem>
              </SelectContent>
            </Select>
            <div className="hidden xl:flex overflow-hidden rounded-xl border border-slate-200 bg-white/80 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors ${viewMode === "grid"
                  ? "bg-slate-900 text-white dark:bg-sky-400 dark:text-slate-950"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
              >
                <LayoutGrid size={16} />
                卡片式
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-2 border-l border-slate-200 px-3 py-2 text-sm font-medium transition-colors dark:border-slate-700 ${viewMode === "list"
                  ? "bg-slate-900 text-white dark:bg-sky-400 dark:text-slate-950"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
              >
                <Rows3 size={16} />
                列表式
              </button>
            </div>
            {selectedIds.size > 0 && (
              <Button onClick={() => setBulkDeleteOpen(true)} className="rounded-xl h-10 px-4 bg-red-600 hover:bg-red-700 text-white">
                <Trash2 size={18} />
                刪除選取 ({selectedIds.size})
              </Button>
            )}
            <Button onClick={handleAdd} className="gap-2 bg-green-500 hover:bg-green-600 rounded-xl">
              <Plus size={16} />
              <span className="hidden sm:inline">新增圖片</span>
            </Button>
          </>
        }
      />

      <ImageStats images={images} />

      {/* Export Progress Modal */}
      {exporting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-2xl w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">匯出圖片中...</h3>
            <div className="space-y-3">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {exportProgress.status}
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>進度</span>
                  <span>{exportProgress.current} / {exportProgress.total}</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className="bg-purple-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${exportProgress.total > 0 ? (exportProgress.current / exportProgress.total) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">
                  成功下載：{exportProgress.success}
                </div>
                <div className="rounded-xl bg-rose-50 px-3 py-2 text-rose-700 dark:bg-rose-950/30 dark:text-rose-200">
                  失敗或略過：{exportProgress.failed}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm font-semibold text-gray-800 dark:text-gray-100">
                  <span>匯出 Debug 訊息</span>
                  <span className="text-xs font-normal text-gray-500 dark:text-gray-400">{exportDebugMessages.length} 筆</span>
                </div>
                <div className="max-h-64 overflow-y-auto rounded-xl bg-gray-900 px-3 py-2 text-xs leading-5 text-green-200">
                  {exportDebugMessages.length > 0 ? (
                    exportDebugMessages.map((message, index) => (
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
                  <span className="text-xs font-normal text-gray-500 dark:text-gray-400">{importDebugMessages.length} 筆</span>
                </div>
                <div className="max-h-64 overflow-y-auto rounded-xl bg-gray-900 px-3 py-2 text-xs leading-5 text-green-200">
                  {importDebugMessages.length > 0 ? (
                    importDebugMessages.map((message, index) => (
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

      {/* Import Progress Modal */}
      {importing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-2xl w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">匯入圖片中...</h3>
            <div className="space-y-3">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {importProgress.status}
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>進度</span>
                  <span>{importProgress.current} / {importProgress.total}</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className="bg-orange-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 text-xs text-center">
                <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-2">
                  <div className="font-bold text-green-600 dark:text-green-400">{importProgress.success}</div>
                  <div className="text-green-600/70 dark:text-green-400/70">成功</div>
                </div>
                <div className="bg-yellow-100 dark:bg-yellow-900/30 rounded-lg p-2">
                  <div className="font-bold text-yellow-600 dark:text-yellow-400">{importProgress.skipped}</div>
                  <div className="text-yellow-600/70 dark:text-yellow-400/70">跳過</div>
                </div>
                <div className="bg-red-100 dark:bg-red-900/30 rounded-lg p-2">
                  <div className="font-bold text-red-600 dark:text-red-400">{importProgress.failed}</div>
                  <div className="text-red-600/70 dark:text-red-400/70">失敗</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {filteredImages.length === 0 && images.length > 0 ? (
        <EmptyState icon={<Search className="text-gray-400" size={32} />} title="無搜尋結果" description={`找不到「${searchQuery}」相關的圖片`} />
      ) : (
        <>
          <div className="xl:hidden">
            <ImageGrid
              images={filteredImages}
              loading={loading}
              onSelectImage={setSelectedImage}
              onEdit={handleEdit}
              onRefresh={() => loadImages(true)}
              isInlineCreating={isInlineCreating}
              inlineCreateForm={inlineCreateForm}
              setInlineCreateForm={setInlineCreateForm}
              inlineCreatePreviewUrl={inlineCreatePreviewUrl}
              inlineCreatePreviewLoading={inlineCreatePreviewLoading}
              inlineCreateSubmitting={inlineCreateSubmitting}
              inlineCreateUploadProgress={inlineCreateUploadProgress}
              inlineCreateUploadStatus={inlineCreateUploadStatus}
              inlineCreateDuplicateWarning={inlineCreateDuplicateWarning}
              inlineCreateUseCategorySelect={inlineCreateUseCategorySelect}
              setInlineCreateUseCategorySelect={setInlineCreateUseCategorySelect}
              existingCategories={existingCategories}
              inlineCreateFileCount={inlineCreateFiles.length}
              onInlineCreateFileSelect={handleInlineCreateFileSelect}
              onInlineCreateSave={handleInlineCreateSave}
              onInlineCreateCancel={handleInlineCreateCancel}
              inlineEditingId={inlineEditingId}
              inlineEditForm={inlineEditForm}
              setInlineEditForm={setInlineEditForm}
              onInlineEdit={handleInlineEdit}
              onInlineSave={handleInlineSave}
              onInlineCancel={cancelInlineEdit}
              inlineEditPreviewUrl={inlineEditPreviewUrl}
              inlineEditPreviewLoading={inlineEditPreviewLoading}
              inlineEditUploadProgress={inlineEditUploadProgress}
              inlineEditUploadStatus={inlineEditUploadStatus}
              inlineEditDuplicateWarning={inlineEditDuplicateWarning}
              onInlineEditFileSelect={handleInlineEditFileSelect}
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
            />
          </div>
          <div className={viewMode === "grid" ? "hidden xl:block" : "hidden"}>
            <ImageGrid
              images={filteredImages}
              loading={loading}
              onSelectImage={setSelectedImage}
              onEdit={handleEdit}
              onRefresh={() => loadImages(true)}
              isInlineCreating={isInlineCreating}
              inlineCreateForm={inlineCreateForm}
              setInlineCreateForm={setInlineCreateForm}
              inlineCreatePreviewUrl={inlineCreatePreviewUrl}
              inlineCreatePreviewLoading={inlineCreatePreviewLoading}
              inlineCreateSubmitting={inlineCreateSubmitting}
              inlineCreateUploadProgress={inlineCreateUploadProgress}
              inlineCreateUploadStatus={inlineCreateUploadStatus}
              inlineCreateDuplicateWarning={inlineCreateDuplicateWarning}
              inlineCreateUseCategorySelect={inlineCreateUseCategorySelect}
              setInlineCreateUseCategorySelect={setInlineCreateUseCategorySelect}
              existingCategories={existingCategories}
              inlineCreateFileCount={inlineCreateFiles.length}
              onInlineCreateFileSelect={handleInlineCreateFileSelect}
              onInlineCreateSave={handleInlineCreateSave}
              onInlineCreateCancel={handleInlineCreateCancel}
              inlineEditingId={inlineEditingId}
              inlineEditForm={inlineEditForm}
              setInlineEditForm={setInlineEditForm}
              onInlineEdit={handleInlineEdit}
              onInlineSave={handleInlineSave}
              onInlineCancel={cancelInlineEdit}
              inlineEditPreviewUrl={inlineEditPreviewUrl}
              inlineEditPreviewLoading={inlineEditPreviewLoading}
              inlineEditUploadProgress={inlineEditUploadProgress}
              inlineEditUploadStatus={inlineEditUploadStatus}
              inlineEditDuplicateWarning={inlineEditDuplicateWarning}
              onInlineEditFileSelect={handleInlineEditFileSelect}
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
            />
          </div>
          <div className={viewMode === "list" ? "hidden xl:block" : "hidden"}>
            <ImageList
              images={filteredImages}
              loading={loading}
              onSelectImage={setSelectedImage}
              onEdit={handleEdit}
              onRefresh={() => loadImages(true)}
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
            />
          </div>
        </>
      )}

      {/* 圖片預覽模態框 */}
      {selectedImage && (
        <ImagePreviewPortal image={selectedImage} images={filteredImages} onClose={() => setSelectedImage(null)} />
      )}

      {showForm && (
        <ImageFormModal image={editingImage} existingImages={images} onClose={handleCloseForm} onSuccess={() => loadImages(true)} />
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
                即將刪除 <span className="font-bold text-red-600">{selectedIds.size}</span> 筆資料，此操作無法復原
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
                <code className="block bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg text-sm font-mono text-red-600">DELETE image</code>
                <input
                  type="text"
                  value={bulkDeleteInput}
                  onChange={(e) => setBulkDeleteInput(e.target.value)}
                  placeholder="輸入 DELETE image"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                />
              </div>
            )}
            <div className="flex flex-col gap-3 border-t border-gray-100 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] dark:border-gray-800 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => { setBulkDeleteOpen(false); setBulkDeleteInput(""); }} disabled={isDeleting}>取消</Button>
              <Button
                onClick={handleBulkDelete}
                disabled={bulkDeleteInput !== "DELETE image" || isDeleting}
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

// 統計卡片
function ImageStats({ images }: { images: ImageData[] }) {
  const totalImages = images.length;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
      <StatCard title="總圖片數" value={totalImages} icon={ImageIcon} gradient="from-blue-500 to-blue-600" />
      <StatCard title="Appwrite 儲存" value={totalImages} iconElement={<span className="text-2xl">☁️</span>} gradient="from-purple-500 to-purple-600" />
    </div>
  );
}

// 圖片網格
interface ImageGridProps {
  images: ImageData[];
  loading: boolean;
  onSelectImage: (img: ImageData) => void;
  onEdit: (img: ImageData) => void;
  onRefresh: () => void;
  isInlineCreating: boolean;
  inlineCreateForm: { name: string; file: string; filetype: string; note: string; ref: string; category: string; hash: string; cover: boolean };
  setInlineCreateForm: (form: { name: string; file: string; filetype: string; note: string; ref: string; category: string; hash: string; cover: boolean }) => void;
  inlineCreatePreviewUrl: string;
  inlineCreatePreviewLoading: boolean;
  inlineCreateSubmitting: boolean;
  inlineCreateUploadProgress: number;
  inlineCreateUploadStatus: 'idle' | 'uploading' | 'success' | 'error';
  inlineCreateDuplicateWarning: string;
  inlineCreateUseCategorySelect: boolean;
  setInlineCreateUseCategorySelect: (value: boolean) => void;
  existingCategories: string[];
  inlineCreateFileCount: number;
  onInlineCreateFileSelect: (files: File[]) => void;
  onInlineCreateSave: () => void;
  onInlineCreateCancel: () => void;
  inlineEditingId: string | null;
  inlineEditForm: { name: string; note: string; category: string; ref: string; file: string; filetype: string; hash: string };
  setInlineEditForm: (form: { name: string; note: string; category: string; ref: string; file: string; filetype: string; hash: string }) => void;
  onInlineEdit: (img: ImageData) => void;
  onInlineSave: (imageId: string) => void;
  onInlineCancel: () => void;
  inlineEditPreviewUrl: string;
  inlineEditPreviewLoading: boolean;
  inlineEditUploadProgress: number;
  inlineEditUploadStatus: 'idle' | 'uploading' | 'success' | 'error';
  inlineEditDuplicateWarning: string;
  onInlineEditFileSelect: (file: File | null, image: ImageData) => void;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

interface ImageListProps {
  images: ImageData[];
  loading: boolean;
  onSelectImage: (img: ImageData) => void;
  onEdit: (img: ImageData) => void;
  onRefresh: () => void;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

function ImageGrid({ images, loading, onSelectImage, onEdit, onRefresh, isInlineCreating, inlineCreateForm, setInlineCreateForm, inlineCreatePreviewUrl, inlineCreatePreviewLoading, inlineCreateSubmitting, inlineCreateUploadProgress, inlineCreateUploadStatus, inlineCreateDuplicateWarning, inlineCreateUseCategorySelect, setInlineCreateUseCategorySelect, existingCategories, inlineCreateFileCount, onInlineCreateFileSelect, onInlineCreateSave, onInlineCreateCancel, inlineEditingId, inlineEditForm, setInlineEditForm, onInlineEdit, onInlineSave, onInlineCancel, inlineEditPreviewUrl, inlineEditPreviewLoading, inlineEditUploadProgress, inlineEditUploadStatus, inlineEditDuplicateWarning, onInlineEditFileSelect, selectionMode, selectedIds, onToggleSelect }: ImageGridProps) {
  if (loading) return <FullPageLoading text="載入圖片中..." />;
  if (images.length === 0 && !isInlineCreating) return <EmptyState icon={<ImageIcon className="text-gray-400" size={32} />} title="沒有找到圖片" />;

  return (
    <DataCard className="p-3 sm:p-4 lg:p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
        {isInlineCreating && (
          <InlineCreateImageCard
            form={inlineCreateForm}
            setForm={setInlineCreateForm}
            previewUrl={inlineCreatePreviewUrl}
            previewLoading={inlineCreatePreviewLoading}
            submitting={inlineCreateSubmitting}
            uploadProgress={inlineCreateUploadProgress}
            uploadStatus={inlineCreateUploadStatus}
            duplicateWarning={inlineCreateDuplicateWarning}
            useCategorySelect={inlineCreateUseCategorySelect}
            setUseCategorySelect={setInlineCreateUseCategorySelect}
            existingCategories={existingCategories}
            fileCount={inlineCreateFileCount}
            onFileSelect={onInlineCreateFileSelect}
            onSave={onInlineCreateSave}
            onCancel={onInlineCreateCancel}
          />
        )}
        {images.map((image) => (
          <ImageCard
            key={image.$id}
            image={image}
            onSelect={() => onSelectImage(image)}
            onEdit={() => onEdit(image)}
            onRefresh={onRefresh}
            isEditing={inlineEditingId === image.$id}
            inlineEditForm={inlineEditForm}
            setInlineEditForm={setInlineEditForm}
            onInlineEdit={onInlineEdit}
            onInlineSave={onInlineSave}
            onInlineCancel={onInlineCancel}
            inlineEditPreviewUrl={inlineEditPreviewUrl}
            inlineEditPreviewLoading={inlineEditPreviewLoading}
            inlineEditUploadProgress={inlineEditUploadProgress}
            inlineEditUploadStatus={inlineEditUploadStatus}
            inlineEditDuplicateWarning={inlineEditDuplicateWarning}
            onInlineEditFileSelect={onInlineEditFileSelect}
            selectionMode={selectionMode}
            isSelected={selectedIds?.has(image.$id) ?? false}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </div>
    </DataCard>
  );
}

function ImageList({ images, loading, onSelectImage, onEdit, onRefresh, selectionMode, selectedIds, onToggleSelect }: ImageListProps) {
  if (loading) return <FullPageLoading text="載入圖片中..." />;
  if (images.length === 0) return <EmptyState icon={<ImageIcon className="text-gray-400" size={32} />} title="沒有找到圖片" />;

  return (
    <DataCard className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="min-w-[760px] w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600 dark:bg-slate-900 dark:text-slate-300">
            <tr>
              {selectionMode ? <th className="px-4 py-3 font-medium">選取</th> : null}
              <th className="px-4 py-3 font-medium">圖片</th>
              <th className="px-4 py-3 font-medium">名稱</th>
              <th className="px-4 py-3 font-medium">分類</th>
              <th className="px-4 py-3 font-medium">備註</th>
              <th className="px-4 py-3 font-medium">檔案大小</th>
              <th className="px-4 py-3 font-medium">建立日期</th>
              <th className="px-4 py-3 font-medium text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {images.map((image) => (
              <ImageListRow
                key={image.$id}
                image={image}
                onSelect={() => onSelectImage(image)}
                onEdit={() => onEdit(image)}
                onRefresh={onRefresh}
                selectionMode={selectionMode}
                isSelected={selectedIds?.has(image.$id) ?? false}
                onToggleSelect={onToggleSelect}
              />
            ))}
          </tbody>
        </table>
      </div>
    </DataCard>
  );
}

function InlineCreateImageCard({
  form,
  setForm,
  previewUrl,
  previewLoading,
  submitting,
  uploadProgress,
  uploadStatus,
  duplicateWarning,
  useCategorySelect,
  setUseCategorySelect,
  existingCategories,
  fileCount,
  onFileSelect,
  onSave,
  onCancel,
}: {
  form: { name: string; file: string; filetype: string; note: string; ref: string; category: string; hash: string; cover: boolean };
  setForm: (form: { name: string; file: string; filetype: string; note: string; ref: string; category: string; hash: string; cover: boolean }) => void;
  previewUrl: string;
  previewLoading: boolean;
  submitting: boolean;
  uploadProgress: number;
  uploadStatus: 'idle' | 'uploading' | 'success' | 'error';
  duplicateWarning: string;
  useCategorySelect: boolean;
  setUseCategorySelect: (value: boolean) => void;
  existingCategories: string[];
  fileCount: number;
  onFileSelect: (files: File[]) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="bg-white dark:bg-[#1f1f1f] rounded-xl overflow-hidden shadow-sm border-2 border-green-500 dark:border-green-400 p-4 space-y-3 animate-in zoom-in-95 duration-300">
      <div className="text-sm font-semibold text-green-600 dark:text-green-400 mb-1">新增中</div>
      <Input placeholder={fileCount > 1 ? "多張上傳時會自動使用各自檔名" : "圖片名稱"} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-9 rounded-lg text-sm" disabled={submitting || fileCount > 1} />
      <Input placeholder="圖片 URL（選填）" value={form.file} onChange={(e) => setForm({ ...form, file: e.target.value })} className="h-9 rounded-lg text-sm" disabled={submitting} />
      <label className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg cursor-pointer transition-colors">
        <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
          {previewLoading ? '載入中...' : fileCount > 1 ? `已選擇 ${fileCount} 張圖片` : previewUrl ? '已選擇圖片' : '上傳圖片 (最大 50MB)'}
        </span>
        <input type="file" accept="image/jpeg,image/jpg,image/png,image/gif,image/webp" multiple onChange={(e) => onFileSelect(Array.from(e.target.files || []))} disabled={submitting || previewLoading} className="hidden" />
      </label>
      {fileCount > 1 && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          將建立 {fileCount} 筆圖片資料，並共用下方的分類、備註與參考連結。
        </p>
      )}
      {previewUrl && (
        <img src={previewUrl} alt="Preview" className="max-h-40 w-full rounded-lg border border-gray-200 object-contain dark:border-gray-700" />
      )}
      {duplicateWarning && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm font-medium text-red-600 dark:text-red-400">{duplicateWarning}</p>
        </div>
      )}
      <Input placeholder="分類" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-9 rounded-lg text-sm" hidden={useCategorySelect && existingCategories.length > 0} />
      {useCategorySelect && existingCategories.length > 0 ? (
        <Select
          value={form.category}
          onValueChange={(value) => {
            if (value === '__custom__') {
              setUseCategorySelect(false);
              setForm({ ...form, category: '' });
            } else {
              setForm({ ...form, category: value });
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
      <Input placeholder="參考" value={form.ref} onChange={(e) => setForm({ ...form, ref: e.target.value })} className="h-9 rounded-lg text-sm" />
      <Textarea placeholder="備註" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="rounded-lg text-sm h-20 resize-none" />
      {uploadStatus === 'uploading' && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
            <span>上傳至 Appwrite...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}
      {uploadStatus === 'success' && <p className="text-sm text-green-600 dark:text-green-400">✓ 上傳成功</p>}
      {uploadStatus === 'error' && <p className="text-sm text-red-600 dark:text-red-400">✗ 上傳失敗</p>}
      <div className="flex gap-2 pt-1">
        <Button onClick={onSave} disabled={submitting || (fileCount <= 1 && !!duplicateWarning)} className="flex-1 gap-1 bg-green-500 hover:bg-green-600 rounded-lg text-xs py-1.5 disabled:opacity-50">
          {submitting ? '新增中...' : '新增'}
        </Button>
        <Button onClick={onCancel} variant="outline" disabled={submitting} className="flex-1 gap-1 rounded-lg text-xs py-1.5">
          取消
        </Button>
      </div>
    </div>
  );
}

// 單張圖片卡片
interface ImageCardProps {
  image: ImageData;
  onSelect: () => void;
  onEdit: () => void;
  onRefresh: () => void;
  isEditing: boolean;
  inlineEditForm: { name: string; note: string; category: string; ref: string; file: string; filetype: string; hash: string };
  setInlineEditForm: (form: { name: string; note: string; category: string; ref: string; file: string; filetype: string; hash: string }) => void;
  onInlineEdit: (img: ImageData) => void;
  onInlineSave: (imageId: string) => void;
  onInlineCancel: () => void;
  inlineEditPreviewUrl: string;
  inlineEditPreviewLoading: boolean;
  inlineEditUploadProgress: number;
  inlineEditUploadStatus: 'idle' | 'uploading' | 'success' | 'error';
  inlineEditDuplicateWarning: string;
  onInlineEditFileSelect: (file: File | null, image: ImageData) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
}

interface ImageListRowProps {
  image: ImageData;
  onSelect: () => void;
  onEdit: () => void;
  onRefresh: () => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
}

function ImageCard({ image, onSelect, onEdit, onRefresh, isEditing, inlineEditForm, setInlineEditForm, onInlineEdit, onInlineSave, onInlineCancel, inlineEditPreviewUrl, inlineEditPreviewLoading, inlineEditUploadProgress, inlineEditUploadStatus, inlineEditDuplicateWarning, onInlineEditFileSelect, selectionMode, isSelected, onToggleSelect }: ImageCardProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`確定要刪除圖片 "${image.name}" 嗎?`)) return;

    setDeleting(true);
    try {
      const url = addAppwriteConfigToUrl(`${API_ENDPOINTS.IMAGE}/${image.$id}`);
      const response = await fetch(url, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('刪除失敗');
      onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : '刪除失敗');
    } finally {
      setDeleting(false);
    }
  };

  // 行內編輯模式 - 全卡片取代
  if (isEditing) {
    return (
      <div className="bg-white dark:bg-[#1f1f1f] rounded-xl overflow-hidden shadow-sm border-2 border-blue-500 dark:border-blue-400 p-4 space-y-3 animate-in zoom-in-95 duration-300">
        <div className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-1">編輯中</div>
        <Input placeholder="圖片名稱" value={inlineEditForm.name} onChange={(e) => setInlineEditForm({ ...inlineEditForm, name: e.target.value })} className="h-9 rounded-lg text-sm" />
        <label className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg cursor-pointer transition-colors">
          <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
            {inlineEditPreviewLoading ? '載入中...' : '重新上傳圖片'}
          </span>
          <input
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            onChange={(e) => onInlineEditFileSelect(e.target.files?.[0] || null, image)}
            disabled={inlineEditPreviewLoading}
            className="hidden"
          />
        </label>
        {inlineEditPreviewUrl && (
          <img src={inlineEditPreviewUrl} alt="Edit Preview" className="max-h-40 w-full rounded-lg border border-gray-200 object-contain dark:border-gray-700" />
        )}
        {inlineEditDuplicateWarning && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm font-medium text-red-600 dark:text-red-400">{inlineEditDuplicateWarning}</p>
          </div>
        )}
        <Input placeholder="分類" value={inlineEditForm.category} onChange={(e) => setInlineEditForm({ ...inlineEditForm, category: e.target.value })} className="h-9 rounded-lg text-sm" />
        <Input placeholder="參考" value={inlineEditForm.ref} onChange={(e) => setInlineEditForm({ ...inlineEditForm, ref: e.target.value })} className="h-9 rounded-lg text-sm" />
        <Textarea placeholder="備註" value={inlineEditForm.note} onChange={(e) => setInlineEditForm({ ...inlineEditForm, note: e.target.value })} className="rounded-lg text-sm h-20 resize-none" />
        {inlineEditUploadStatus === 'uploading' && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
              <span>上傳至 Appwrite...</span>
              <span>{inlineEditUploadProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${inlineEditUploadProgress}%` }} />
            </div>
          </div>
        )}
        {inlineEditUploadStatus === 'success' && <p className="text-sm text-green-600 dark:text-green-400">✓ 上傳成功</p>}
        {inlineEditUploadStatus === 'error' && <p className="text-sm text-red-600 dark:text-red-400">✗ 上傳失敗</p>}
        <div className="flex gap-2 pt-1">
          <Button onClick={(e) => { e.stopPropagation(); onInlineSave(image.$id); }} className="flex-1 gap-1 bg-green-500 hover:bg-green-600 rounded-lg text-xs py-1.5">儲存</Button>
          <Button onClick={(e) => { e.stopPropagation(); onInlineCancel(); }} variant="outline" className="flex-1 gap-1 rounded-lg text-xs py-1.5">取消</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative bg-white dark:bg-gray-800 rounded-xl overflow-hidden hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700">
      {/* 圖片預覽區 */}
      <div
        className="relative aspect-video bg-gray-100 dark:bg-gray-700 overflow-hidden cursor-pointer"
        onClick={onSelect}
      >
        {image.file ? (
          <img
            src={getProxiedMediaUrl(image.file)}
            alt={image.name}
            className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4 text-center">
            <div className="bg-white/80 dark:bg-gray-800/80 p-3 rounded-full shadow-sm">
              <ImageIcon className="text-gray-400 w-6 h-6" />
            </div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">無圖片</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* 分類標籤 */}
        {image.category && (
          <div className="absolute top-2 left-2">
            <span className="px-2 py-1 text-xs font-medium bg-blue-500/90 text-white rounded-md backdrop-blur-sm">
              {image.category}
            </span>
          </div>
        )}
      </div>

      {/* 資訊區 */}
      <div className="p-3 sm:p-4 overflow-hidden">
        <div className="flex items-center gap-2 mb-2">
          {selectionMode && (
            <input
              type="checkbox"
              checked={isSelected ?? false}
              onChange={() => onToggleSelect?.(image.$id)}
              className="h-4 w-4 rounded border-gray-300 text-red-600 cursor-pointer shrink-0"
            />
          )}
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base truncate min-w-0" title={image.name}>
            {image.name}
          </h3>
        </div>

        {image.note && (
          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">{image.note}</p>
        )}

        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-3">
          <Calendar className="w-3 h-3" />
          <span>{formatLocalDate(image.$createdAt)}</span>
          <span>•</span>
          <span>{formatFileSize(image.size)}</span>
        </div>

        {/* 操作按鈕 */}
        <div className="flex gap-2">
          <Button
            onClick={(e) => { e.stopPropagation(); onInlineEdit(image); }}
            className="flex-1 gap-1 bg-blue-500 hover:bg-blue-600 rounded-lg text-xs py-1.5"
          >
            <Edit size={14} />
            編輯
          </Button>
          <Button
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 gap-1 bg-red-500 hover:bg-red-600 rounded-lg text-xs py-1.5"
          >
            <Trash2 size={14} />
            {deleting ? '刪除中...' : '刪除'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ImageListRow({ image, onSelect, onEdit, onRefresh, selectionMode, isSelected, onToggleSelect }: ImageListRowProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`確定要刪除圖片 "${image.name}" 嗎?`)) return;

    setDeleting(true);
    try {
      const url = addAppwriteConfigToUrl(`${API_ENDPOINTS.IMAGE}/${image.$id}`);
      const response = await fetch(url, { method: "DELETE" });
      if (!response.ok) throw new Error("刪除失敗");
      onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "刪除失敗");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <tr className="border-t border-slate-200/80 align-middle hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-900/50">
      {selectionMode ? (
        <td className="px-4 py-3">
          <input
            type="checkbox"
            checked={isSelected ?? false}
            onChange={() => onToggleSelect?.(image.$id)}
            className="h-4 w-4 rounded border-gray-300 text-red-600 cursor-pointer"
          />
        </td>
      ) : null}
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={onSelect}
          className="flex h-14 w-20 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
        >
          {image.file ? (
            <img
              src={getProxiedMediaUrl(image.file)}
              alt={image.name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <ImageIcon className="h-5 w-5 text-slate-400" />
          )}
        </button>
      </td>
      <td className="px-4 py-3">
        <div className="max-w-[240px]">
          <div className="truncate font-medium text-slate-900 dark:text-slate-100">{image.name}</div>
          {image.ref ? <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{image.ref}</div> : null}
        </div>
      </td>
      <td className="px-4 py-3">
        {image.category ? (
          <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            {image.category}
          </span>
        ) : (
          <span className="text-xs text-slate-400">未分類</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="max-w-[280px] truncate text-slate-600 dark:text-slate-300">
          {image.note || <span className="text-xs text-slate-400">無備註</span>}
        </div>
      </td>
      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{formatFileSize(image.size)}</td>
      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{formatLocalDate(image.$createdAt)}</td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-2">
          <Button onClick={onEdit} className="gap-1 rounded-lg bg-blue-500 px-3 py-2 text-xs hover:bg-blue-600">
            <Edit size={14} />
            編輯
          </Button>
          <Button onClick={handleDelete} disabled={deleting} className="gap-1 rounded-lg bg-red-500 px-3 py-2 text-xs hover:bg-red-600">
            <Trash2 size={14} />
            {deleting ? "刪除中..." : "刪除"}
          </Button>
        </div>
      </td>
    </tr>
  );
}

// 圖片預覽模態框
function ImagePreviewModal({ image, onClose, onPrev, onNext, currentIndex, totalImages }: { image: ImageData; onClose: () => void; onPrev?: () => void; onNext?: () => void; currentIndex?: number; totalImages?: number }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-2 sm:p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full h-full max-w-7xl max-h-screen flex flex-col">
        {/* 頂部控制欄 */}
        <div className="absolute top-2 sm:top-4 right-2 sm:right-4 z-20 flex items-center gap-4">
          {totalImages !== undefined && totalImages > 1 && (
            <div className="rounded-lg bg-black/50 px-3 py-1.5 text-sm text-white/80 font-medium tracking-wide">
              {currentIndex !== undefined ? currentIndex + 1 : 1} / {totalImages}
            </div>
          )}
          <button onClick={onClose} className="rounded-lg bg-black/80 p-2.5 text-white transition-colors hover:bg-black/95 hover:scale-105 active:scale-95">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 圖片 - 置中顯示 */}
        <div className="flex-1 flex items-center justify-center p-8 sm:p-16 relative">
          {onPrev && (
            <button 
              onClick={(e) => { e.stopPropagation(); onPrev(); }}
              className="absolute left-0 sm:left-4 z-20 p-2 sm:p-3 rounded-full bg-black/40 text-white hover:bg-black/80 transition-all hover:scale-110 active:scale-90 focus:outline-none focus:ring-2 focus:ring-white/50"
            >
              <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8" />
            </button>
          )}

          {image.file ? (
            <img
              src={getProxiedMediaUrl(image.file)}
              alt={image.name}
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl transition-opacity duration-300"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div className="text-white text-center">
              <ImageIcon className="mx-auto mb-4 w-24 h-24" />
              <p>沒有圖片 URL</p>
            </div>
          )}

          {onNext && (
            <button 
              onClick={(e) => { e.stopPropagation(); onNext(); }}
              className="absolute right-0 sm:right-4 z-20 p-2 sm:p-3 rounded-full bg-black/40 text-white hover:bg-black/80 transition-all hover:scale-110 active:scale-90 focus:outline-none focus:ring-2 focus:ring-white/50"
            >
              <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8" />
            </button>
          )}
        </div>

        {/* 底部資訊欄 */}
        <div className="absolute bottom-2 sm:bottom-4 left-2 sm:left-4 right-2 sm:right-4 z-20 pointer-events-none">
          <div className="rounded-xl bg-black/82 p-3 text-white sm:p-4 pointer-events-auto shadow-lg backdrop-blur-md border border-white/10">
            <h3 className="font-medium mb-2">{image.name}</h3>
            {image.note && <p className="text-sm text-white/80 mb-2">{image.note}</p>}
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="flex items-center gap-1 text-white/90">
                <Calendar className="w-4 h-4 text-white/70" />
                {formatLocalDate(image.$createdAt)}
              </span>
              {image.category && <span className="bg-white/10 px-2 py-0.5 rounded text-white/90">分類: {image.category}</span>}
              <span className="text-white/80">大小: {formatFileSize(image.size)}</span>
              {image.ref && <span className="text-white/80">參考: {image.ref}</span>}
              <span className="ml-auto text-xs text-white/40 hidden sm:inline-block">點擊空白關閉 / 左右鍵切換</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 圖片預覽 Portal
function ImagePreviewPortal({ image, images = [], onClose }: { image: ImageData; images?: ImageData[]; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [currentId, setCurrentId] = useState(image.$id);
  
  useEffect(() => {
    setCurrentId(image.$id);
  }, [image.$id]);

  const currentIndex = images.findIndex(img => img.$id === currentId);
  const actualIndex = currentIndex >= 0 ? currentIndex : 0;
  const currentImage = images.length > 0 && currentIndex >= 0 ? images[currentIndex] : image;

  useEffect(() => {
    setMounted(true);

    const originalOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowLeft" && images.length > 1) {
        setCurrentId(prevId => {
          const idx = images.findIndex(img => img.$id === prevId);
          if (idx < 0) return prevId;
          const newIdx = idx > 0 ? idx - 1 : images.length - 1;
          return images[newIdx].$id;
        });
      } else if (event.key === "ArrowRight" && images.length > 1) {
        setCurrentId(prevId => {
          const idx = images.findIndex(img => img.$id === prevId);
          if (idx < 0) return prevId;
          const newIdx = idx < images.length - 1 ? idx + 1 : 0;
          return images[newIdx].$id;
        });
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, images]);

  if (!mounted) return null;

  return createPortal(
    <ImagePreviewModal 
      image={currentImage} 
      onClose={onClose}
      onPrev={images.length > 1 ? () => {
        const idx = images.findIndex(img => img.$id === currentId);
        if (idx >= 0) setCurrentId(images[idx > 0 ? idx - 1 : images.length - 1].$id);
      } : undefined}
      onNext={images.length > 1 ? () => {
        const idx = images.findIndex(img => img.$id === currentId);
        if (idx >= 0) setCurrentId(images[idx < images.length - 1 ? idx + 1 : 0].$id);
      } : undefined}
      currentIndex={images.length > 1 ? actualIndex : undefined}
      totalImages={images.length > 1 ? images.length : undefined}
    />,
    document.body
  );
}

function ImageFormModal({ image, existingImages, onClose, onSuccess }: { image: ImageData | null; existingImages: ImageData[]; onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: image?.name || '',
    file: image?.file || '',
    filetype: image?.filetype || '',
    note: image?.note || '',
    ref: image?.ref || '',
    category: image?.category || '',
    hash: image?.hash || '',
    cover: false, // 一律為 false
  });
  const [submitting, setSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [fileHash, setFileHash] = useState<string>(''); // 儲存檔案 hash
  const [duplicateWarning, setDuplicateWarning] = useState<string>(''); // 重複警告
  const [useCategorySelect, setUseCategorySelect] = useState(true); // 是否使用選擇框

  // 獲取所有已存在的分類
  const existingCategories = Array.from(new Set(existingImages.map(img => img.category).filter(Boolean)));

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 檢查檔案大小 (50MB = 50 * 1024 * 1024 bytes)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('檔案大小不能超過 50MB');
      return;
    }

    // 檢查檔案類型
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('只支援 JPG, PNG, GIF, WEBP 格式的圖片');
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

    // 取得檔案類型（副檔名）
    const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
    const filetype = fileExt; // e.g., 'png', 'jpg', 'gif', 'webp'

    // 新增模式：永遠使用檔名（去除副檔名）作為預設名稱；編輯模式：僅在名稱為空時自動填入
    const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, '');

    setFormData(prev => ({
      ...prev,
      name: !image ? fileNameWithoutExt : (prev.name.trim() ? prev.name : fileNameWithoutExt),
      hash: hash,
      filetype: filetype
    }));

    // 檢查是否有重複的 hash
    const duplicateImage = existingImages.find(img =>
      img.hash === hash && (!image || img.$id !== image.$id)
    );

    if (duplicateImage) {
      setDuplicateWarning(`警告：此圖片與「${duplicateImage.name}」相同，請勿重複上傳！`);
    }

    // 模擬預覽載入完成
    setTimeout(() => setPreviewLoading(false), 300);
  };

  const uploadFileToAppwrite = async (file: File): Promise<{ url: string; fileId: string }> => {
    setUploadStatus('uploading');
    setUploadProgress(0);

    try {
      // 直接從瀏覽器上傳到 Appwrite，繞過 Vercel 4.5MB 限制
      const result = await uploadToAppwriteStorage(file, (progress) => {
        setUploadProgress(progress);
      });

      setUploadProgress(100);
      setUploadStatus('success');
      return result;
    } catch (error) {
      setUploadStatus('error');
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('請輸入圖片名稱');
      return;
    }

    // 檢查是否有重複
    if (duplicateWarning) {
      alert('此圖片與既有圖片重複，無法上傳！請選擇其他圖片。');
      return;
    }

    setSubmitting(true);
    try {
      let finalFormData = { ...formData };

      // 如果有選擇新檔案，先上傳到 Appwrite
      if (selectedFile) {
        const { url, fileId } = await uploadFileToAppwrite(selectedFile);
        finalFormData.file = url;
        // 使用已計算的 hash，如果沒有則使用 fileId
        finalFormData.hash = fileHash || fileId;
      } else if (!image && !formData.hash) {
        // 新增且沒有檔案也沒有 hash 的情況，生成一個備用 hash
        finalFormData.hash = `no_file_${Date.now()}`;
      }

      const url = image
        ? addAppwriteConfigToUrl(`${API_ENDPOINTS.IMAGE}/${image.$id}`)
        : addAppwriteConfigToUrl(API_ENDPOINTS.IMAGE);
      const method = image ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalFormData),
      });

      if (!response.ok) throw new Error(image ? '更新失敗' : '新增失敗');

      onSuccess();
      onClose();
    } catch (error) {
      alert(error instanceof Error ? error.message : '操作失敗');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {image ? '編輯圖片' : '新增圖片'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              圖片名稱 <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="請輸入圖片名稱"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              圖片 URL 或上傳檔案
            </label>
            <div className="space-y-3">
              <Input
                value={formData.file}
                onChange={(e) => setFormData({ ...formData, file: e.target.value })}
                placeholder="https://example.com/image.jpg"
                disabled={submitting}
              />
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">或</span>
                <label className="flex-1">
                  <div className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg cursor-pointer transition-colors">
                    <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      {previewLoading ? '載入中...' : selectedFile ? `已選擇: ${selectedFile.name}` : '上傳圖片 (最大 50MB)'}
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    onChange={handleFileSelect}
                    disabled={submitting || previewLoading}
                    className="hidden"
                  />
                </label>
              </div>
              {previewUrl && (
                <div className="mt-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">預覽：</p>
                  <img src={previewUrl} alt="Preview" className="max-h-48 rounded-lg border border-gray-200 dark:border-gray-700" />
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

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              備註
            </label>
            <Textarea
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              placeholder="圖片備註說明"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                分類
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
                    <SelectTrigger>
                      <SelectValue placeholder="選擇分類" />
                    </SelectTrigger>
                    <SelectContent>
                      {existingCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                      <SelectItem value="__custom__">自行輸入...</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="輸入新分類"
                  />
                  {existingCategories.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setUseCategorySelect(true)}
                      className="text-xs h-7"
                    >
                      從現有分類中選擇
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                參考
              </label>
              <Input
                value={formData.ref}
                onChange={(e) => setFormData({ ...formData, ref: e.target.value })}
                placeholder="參考資訊"
              />
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

          <div className="flex gap-3 pt-4">
            <Button type="button" onClick={onClose} className="flex-1 bg-gray-500 hover:bg-gray-600 rounded-xl">
              取消
            </Button>
            <Button
              type="submit"
              disabled={submitting || !!duplicateWarning}
              className="flex-1 bg-blue-500 hover:bg-blue-600 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? '處理中...' : (image ? '更新' : '新增')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
