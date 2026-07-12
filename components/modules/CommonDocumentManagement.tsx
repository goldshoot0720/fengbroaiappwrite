"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { FileText as DocumentIcon, Plus, Edit, Edit2, Trash2, X, Upload, Calendar, Search, Download, Eye, FileArchive, File as FileIcon, Maximize, Minimize, ExternalLink, HardDrive, Check, FolderUp, LayoutGrid, Table as TableIcon, ImagePlus, AlertTriangle, RefreshCw } from "lucide-react";
import { useCommonDocument, CommonDocumentData } from "@/hooks/useCommonDocument";
import { useDocumentCache } from "@/hooks/useDocumentCache";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FullPageLoading, LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { API_ENDPOINTS } from "@/lib/constants";
import { formatLocalDate } from "@/lib/formatters";
import { getAppwriteHeaders, getAppwriteDownloadUrl, getProxiedMediaUrl } from "@/lib/utils";
import { uploadToAppwriteStorage } from "@/lib/appwriteStorage";
import { FriendlyAiCrudShell } from "@/components/ui/friendly-ai-crud-shell";
import { loadJSZip, type JSZipType } from "@/lib/loadJSZip";

const EditorFallback = () => (
  <div className="flex min-h-[200px] items-center justify-center">
    <LoadingSpinner />
  </div>
);

// Heavy media/editor deps — load only when a document viewer needs them.
const PlyrPlayer = dynamic(
  () => import("@/components/ui/plyr-player").then((m) => m.PlyrPlayer),
  { ssr: false, loading: EditorFallback }
);
const CodeEditor = dynamic(
  () => import("@/components/ui/code-editor").then((m) => m.CodeEditor),
  { ssr: false, loading: EditorFallback }
);
const PDFViewer = dynamic(
  () => import("@/components/ui/pdf-viewer").then((m) => m.PDFViewer),
  { ssr: false, loading: EditorFallback }
);
const ImageEditor = dynamic(
  () => import("@/components/ui/image-editor").then((m) => m.ImageEditor),
  { ssr: false, loading: EditorFallback }
);

const ReactMarkdown = dynamic(() => import("react-markdown"), {
  ssr: false,
  loading: EditorFallback,
});

function MarkdownPreview({ content }: { content: string }) {
  const [remarkGfm, setRemarkGfm] = useState<((...args: never[]) => unknown) | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("remark-gfm").then((mod) => {
      if (!cancelled) setRemarkGfm(() => mod.default);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!remarkGfm) return <EditorFallback />;
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm as never]}>
      {content}
    </ReactMarkdown>
  );
}

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

// Get file extension from filetype or filename
function getFileExtension(filename: string, filetype?: string): string {
  if (filetype) return filetype.toLowerCase();
  return filename?.toLowerCase().split('.').pop() || '';
}

// Get file type info for styling
function getFileTypeInfo(filename: string, filetype?: string): { color: string; bgColor: string; label: string } {
  const ext = getFileExtension(filename, filetype);
  switch (ext) {
    case 'pdf':
      return { color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30', label: 'PDF' };
    case 'doc':
    case 'docx':
      return { color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', label: 'Word' };
    case 'xls':
    case 'xlsx':
      return { color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30', label: 'Excel' };
    case 'ppt':
    case 'pptx':
      return { color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30', label: 'PPT' };
    case 'txt':
      return { color: 'text-gray-600', bgColor: 'bg-gray-100 dark:bg-gray-700', label: 'TXT' };
    case 'md':
      return { color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30', label: 'MD' };
    case 'json':
      return { color: 'text-yellow-600', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30', label: 'JSON' };
    case 'xml':
      return { color: 'text-teal-600', bgColor: 'bg-teal-100 dark:bg-teal-900/30', label: 'XML' };
    case 'html':
    case 'htm':
      return { color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30', label: 'HTML' };
    case 'css':
      return { color: 'text-blue-500', bgColor: 'bg-blue-100 dark:bg-blue-900/30', label: 'CSS' };
    case 'js':
    case 'jsx':
      return { color: 'text-yellow-500', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30', label: 'JS' };
    case 'ts':
    case 'tsx':
      return { color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', label: 'TS' };
    case 'zip':
    case 'rar':
    case '7z':
      return { color: 'text-yellow-600', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30', label: 'ZIP' };
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
    case 'svg':
    case 'bmp':
    case 'ico':
      return { color: 'text-pink-600', bgColor: 'bg-pink-100 dark:bg-pink-900/30', label: 'IMG' };
    case 'mp4':
    case 'webm':
    case 'mov':
      return { color: 'text-indigo-600', bgColor: 'bg-indigo-100 dark:bg-indigo-900/30', label: 'VIDEO' };
    case 'mp3':
    case 'wav':
    case 'm4a':
    case 'ogg':
      return { color: 'text-cyan-600', bgColor: 'bg-cyan-100 dark:bg-cyan-900/30', label: 'AUDIO' };
    default:
      return { color: 'text-gray-600', bgColor: 'bg-gray-100 dark:bg-gray-700', label: ext.toUpperCase() || 'File' };
  }
}

// Check if file can be previewed
function canPreviewFile(filename: string, filetype?: string): boolean {
  const ext = getFileExtension(filename, filetype);
  return [
    // Documents
    'pdf', 'txt', 'md', 'json', 'xml', 'html', 'htm', 'css', 'js', 'ts', 'jsx', 'tsx', 'csv',
    // Office (new & old formats)
    'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    // Archives
    'zip',
    // Images
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico',
    // Video/Audio
    'mp4', 'webm', 'mp3', 'wav', 'm4a', 'ogg', 'mov'
  ].includes(ext);
}

// Check if file can be edited
function canEditFile(filename: string, filetype?: string): boolean {
  const ext = getFileExtension(filename, filetype);
  return ['txt', 'md', 'json', 'xml', 'html', 'htm', 'css', 'js', 'ts', 'jsx', 'tsx', 'csv'].includes(ext);
}

// Get syntax highlighting language
function getCodeLanguage(ext: string): string {
  const langMap: Record<string, string> = {
    'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript', 'tsx': 'typescript',
    'json': 'json', 'xml': 'xml', 'html': 'html', 'htm': 'html', 'css': 'css', 'md': 'markdown'
  };
  return langMap[ext] || 'text';
}

export default function CommonDocumentManagement() {
  const { commondocument, loading, error, stats, loadCommonDocument } = useCommonDocument();
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingDocument, setEditingDocument] = useState<CommonDocumentData | null>(null);
  const [isInlineCreating, setIsInlineCreating] = useState(false);
  const [inlineCreateForm, setInlineCreateForm] = useState({ name: '', file: '', filetype: '', category: '', note: '', ref: '', cover: '', hash: '' });
  const [searchQuery, setSearchQuery] = useState("");
  const [previewDocument, setPreviewDocument] = useState<CommonDocumentData | null>(null);
  const [openInEditMode, setOpenInEditMode] = useState(false);
  const [importPreview, setImportPreview] = useState<{ data: DocumentFormData[]; errors: string[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [exportingZip, setExportingZip] = useState(false);
  const [exportZipProgress, setExportZipProgress] = useState({ current: 0, total: 0, status: '' });
  const [exportZipDebugMessages, setExportZipDebugMessages] = useState<string[]>([]);
  const [importingZip, setImportingZip] = useState(false);
  const [importZipProgress, setImportZipProgress] = useState({ current: 0, total: 0, status: '', success: 0, failed: 0 });
  const [importZipDebugMessages, setImportZipDebugMessages] = useState<string[]>([]);
  const importZipInputRef = useRef<HTMLInputElement>(null);

  // Inline editing state
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineEditForm, setInlineEditForm] = useState({ name: '', file: '', filetype: '', category: '', note: '', ref: '', cover: '', hash: '' });

  // View mode state (grid or table)
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [workbenchMode, setWorkbenchMode] = useState<"all" | "previewable" | "missingCover" | "uncategorized" | "duplicates">("all");

  // Cover upload state
  const [uploadingCoverId, setUploadingCoverId] = useState<string | null>(null);

  // Bulk selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteInput, setBulkDeleteInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [deleteTotal, setDeleteTotal] = useState(0);

  // 文件快取管理
  const {
    cacheStatus,
    cacheStats,
    downloadAndCacheDocument,
    deleteDocumentCache,
    clearAllCache,
    updateCacheStats,
    formatFileSize,
    maxCacheSize,
  } = useDocumentCache();

  useEffect(() => {
    updateCacheStats();
  }, [updateCacheStats]);

  useEffect(() => {
    if (exportingZip) {
      setExportZipDebugMessages([`開始匯出，共 ${exportZipProgress.total || commondocument.length} 份文件。`]);
    }
  }, [exportingZip, exportZipProgress.total, commondocument.length]);

  useEffect(() => {
    if (!exportingZip || !exportZipProgress.status) return;
    console.log(`[Document export] ${exportZipProgress.current}/${exportZipProgress.total || commondocument.length} ${exportZipProgress.status}`);
    setExportZipDebugMessages((prev) => [...prev.slice(-79), `${exportZipProgress.current}/${exportZipProgress.total || commondocument.length} ${exportZipProgress.status}`]);
  }, [exportingZip, exportZipProgress.current, exportZipProgress.total, exportZipProgress.status, commondocument.length]);

  useEffect(() => {
    if (importingZip) {
      setImportZipDebugMessages(['開始匯入 ZIP。']);
    }
  }, [importingZip]);

  useEffect(() => {
    if (!importingZip || !importZipProgress.status) return;
    console.log(`[Document import] ${importZipProgress.current}/${importZipProgress.total} ${importZipProgress.status}`);
    setImportZipDebugMessages((prev) => [...prev.slice(-79), `${importZipProgress.current}/${importZipProgress.total} ${importZipProgress.status} (成功 ${importZipProgress.success} / 失敗 ${importZipProgress.failed})`]);
  }, [importingZip, importZipProgress.current, importZipProgress.total, importZipProgress.status, importZipProgress.success, importZipProgress.failed]);

  // CSV 匯出/匯入
  const CSV_HEADERS = ['name', 'file', 'cover', 'filetype', 'category', 'note', 'ref', 'hash'];
  const EXPECTED_COLUMN_COUNT = CSV_HEADERS.length;

  interface DocumentFormData {
    name: string;
    file: string;
    cover: string;
    filetype: string;
    category: string;
    note: string;
    ref: string;
    hash: string;
  }


  const parseCSV = (text: string): { data: DocumentFormData[]; errors: string[] } => {
    const errors: string[] = [];
    const data: DocumentFormData[] = [];
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
      data.push({ name: values[0].trim(), file: values[1]?.trim() || '', cover: values[2]?.trim() || '', filetype: values[3]?.trim() || '', category: values[4]?.trim() || '', note: values[5]?.trim() || '', ref: values[6]?.trim() || '', hash: values[7]?.trim() || '' });
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
        const existing = commondocument.find(d => d.name === formData.name);
        const apiUrl = existing
          ? addAppwriteConfigToUrl(`${API_ENDPOINTS.COMMONDOCUMENT}/${existing.$id}`)
          : addAppwriteConfigToUrl(API_ENDPOINTS.COMMONDOCUMENT);
        const method = existing ? 'PUT' : 'POST';
        const submitData = {
          name: formData.name, category: formData.category, note: formData.note, ref: formData.ref, cover: formData.cover || (existing ? existing.cover : ''),
          file: formData.file || (existing ? existing.file : ''),
          filetype: formData.filetype || (existing ? existing.filetype : ''),
          hash: formData.hash || (existing ? existing.hash : `csv_import_${Date.now()}_${Math.random().toString(36).substring(7)}`),
        };
        const response = await fetch(apiUrl, { method, headers: { 'Content-Type': 'application/json', ...getAppwriteHeaders() }, body: JSON.stringify(submitData) });
        if (response.ok) { successCount++; } else { failCount++; }
      } catch { failCount++; }
    }

    // 匯入完成後統一重新載入一次
    await loadCommonDocument(true);

    setImporting(false);
    setImportProgress({ current: 0, total: 0 });
    setImportPreview(null);
    alert(`匯入完成！\n成功: ${successCount} 筆\n失敗: ${failCount} 筆`);
  };

  // ZIP Export (full backup with files, covers, and CSV metadata)
  const handleExportZip = async () => {
    if (commondocument.length === 0) { alert('沒有文件可以匯出'); return; }
    if (exportingZip) return;
    const confirm = window.confirm(`準備匯出 ${commondocument.length} 份文件至 ZIP（含封面圖和元資料），是否繼續？`);
    if (!confirm) return;
    setExportingZip(true);
    setExportZipProgress({ current: 0, total: commondocument.length, status: '準備中...' });
    try {
      const JSZip = await loadJSZip();
      const zip = new JSZip();
      zip.folder('files');
      zip.folder('covers');

      const csvRows: string[][] = [];
      const csvHeaders = ['name', 'file', 'cover', 'filetype', 'category', 'note', 'ref', 'hash'];
      csvRows.push(csvHeaders);

      for (let i = 0; i < commondocument.length; i++) {
        const doc = commondocument[i];
        const seq = String(i + 1).padStart(3, '0');
        const sanitizedName = doc.name.replace(/[<>:"\/\\|?*]/g, '_');
        const baseName = `${seq}_${sanitizedName}`;

        setExportZipProgress({ current: i + 1, total: commondocument.length, status: `正在處理: ${doc.name}` });

        // Detect file extension
        let fileExtension = doc.filetype || '';
        if (!fileExtension && doc.file) {
          const urlPath = doc.file.split('?')[0];
          fileExtension = urlPath.split('.').pop()?.toLowerCase() || 'pdf';
        }
        if (!fileExtension) fileExtension = 'pdf';

        // Download and add document file
        let filePath = '';
        if (doc.file) {
          try {
            const proxyUrl = getProxiedMediaUrl(doc.file);
            const response = await fetch(proxyUrl);
            if (response.ok) {
              const blob = await response.blob();
              filePath = `files/${baseName}.${fileExtension}`;
              zip.file(filePath, blob);
            }
          } catch (err) { console.error(`下載文件 ${doc.name} 時出錯:`, err); }
        }

        // Download and add cover image
        let coverPath = '';
        if (doc.cover) {
          try {
            const coverProxyUrl = getProxiedMediaUrl(doc.cover);
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
          } catch (err) { console.error(`下載封面 ${doc.name} 時出錯:`, err); }
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
          escapeCsv(doc.name || ''),
          escapeCsv(filePath),
          escapeCsv(coverPath),
          escapeCsv(doc.filetype || fileExtension),
          escapeCsv(doc.category || ''),
          escapeCsv(doc.note || ''),
          escapeCsv(doc.ref || ''),
          escapeCsv(doc.hash || ''),
        ]);
      }

      // Generate CSV and add to ZIP
      const csvContent = csvRows.map(row => row.join(',')).join('\n');
      zip.file('document.csv', csvContent);

      setExportZipProgress({ current: commondocument.length, total: commondocument.length, status: '正在壓縮...' });
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = `appwrite-document.zip`;
      link.click();
      URL.revokeObjectURL(link.href);
      setExportZipProgress({ current: commondocument.length, total: commondocument.length, status: '完成！' });
      setTimeout(() => { setExportingZip(false); setExportZipProgress({ current: 0, total: 0, status: '' }); }, 1500);
    } catch (error) { console.error('ZIP export error:', error); alert('匯出失敗，請再試一次'); setExportingZip(false); setExportZipProgress({ current: 0, total: 0, status: '' }); }
  };

  // ZIP Import (full backup with CSV support + backwards compatible)
  const handleImportZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (importZipInputRef.current) importZipInputRef.current.value = '';
    if (!file.name.toLowerCase().endsWith('.zip')) { alert('請選擇 ZIP 檔案'); return; }
    setImportingZip(true);
    setImportZipProgress({ current: 0, total: 0, status: '讀取 ZIP 檔案...', success: 0, failed: 0 });
    try {
      const JSZip = await loadJSZip();
      const zip = await JSZip.loadAsync(file);

      // Check if this is new format with document.csv
      const csvFile = zip.files['document.csv'];
      if (csvFile) {
        // New format: parse CSV and restore full data
        const csvText = await csvFile.async('string');
        const lines = csvText.split('\n').filter(line => line.trim());
        if (lines.length < 2) { alert('CSV 檔案沒有資料'); setImportingZip(false); return; }

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
        const confirmImport = window.confirm(`找到 ${total} 筆文件記錄（含元資料），是否開始匯入？`);
        if (!confirmImport) { setImportingZip(false); return; }

        setImportZipProgress({ current: 0, total, status: `找到 ${total} 筆文件記錄`, success: 0, failed: 0 });
        let successCount = 0, failedCount = 0;

        for (let i = 0; i < dataRows.length; i++) {
          const row = dataRows[i];
          setImportZipProgress({ current: i + 1, total, status: `正在處理: ${row.name || '未知'}`, success: successCount, failed: failedCount });

          try {
            // Upload document file from ZIP
            let remoteFileUrl = '';
            if (row.file && zip.files[row.file]) {
              const fileBlob = await zip.files[row.file].async('blob');
              const fileName = row.file.split('/').pop() || 'document.pdf';
              const fileObj = new File([fileBlob], fileName, { type: 'application/octet-stream' });
              const uploadResult = await uploadToAppwriteStorage(fileObj);
              remoteFileUrl = uploadResult.url;
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

            // Check if record already exists (by name)
            const existing = commondocument.find(d => d.name === row.name);
            const apiUrl = existing
              ? addAppwriteConfigToUrl(`${API_ENDPOINTS.COMMONDOCUMENT}/${existing.$id}`)
              : addAppwriteConfigToUrl(API_ENDPOINTS.COMMONDOCUMENT);
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
        setTimeout(() => { setImportingZip(false); setImportZipProgress({ current: 0, total: 0, status: '', success: 0, failed: 0 }); loadCommonDocument(true); }, 2000);
      } else {
        // Legacy format: plain document files in ZIP (backwards compatible)
        const docFiles: { name: string; file: any }[] = [];
        zip.forEach((relativePath, zipEntry) => {
          if (!zipEntry.dir) docFiles.push({ name: relativePath, file: zipEntry });
        });
        if (docFiles.length === 0) { alert('ZIP 檔案中沒有找到文件檔案'); setImportingZip(false); return; }
        const confirmImport = window.confirm(`找到 ${docFiles.length} 份文件（舊格式），是否開始匯入？`);
        if (!confirmImport) { setImportingZip(false); return; }
        let successCount = 0, failedCount = 0;
        for (let i = 0; i < docFiles.length; i++) {
          const docFile = docFiles[i];
          const fileName = docFile.name.split('/').pop() || docFile.name;
          setImportZipProgress({ current: i + 1, total: docFiles.length, status: `正在處理: ${fileName}`, success: successCount, failed: failedCount });
          try {
            const arrayBuffer = await docFile.file.async('arraybuffer');
            const ext = fileName.split('.').pop()?.toLowerCase() || 'pdf';
            const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
            const docFileObj = new File([blob], fileName, { type: 'application/octet-stream' });
            const uploadData = await uploadToAppwriteStorage(docFileObj);
            const createUrl = addAppwriteConfigToUrl(API_ENDPOINTS.COMMONDOCUMENT);
            const createResponse = await fetch(createUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: fileName, file: uploadData.url, filetype: ext, note: '', ref: '', category: '', hash: '', cover: '' }) });
            if (!createResponse.ok) throw new Error('建立記錄失敗');
            successCount++;
          } catch (error) { console.error(`匯入失敗: ${fileName}`, error); failedCount++; }
        }
        setImportZipProgress({ current: docFiles.length, total: docFiles.length, status: '完成！', success: successCount, failed: failedCount });
        setTimeout(() => { setImportingZip(false); setImportZipProgress({ current: 0, total: 0, status: '', success: 0, failed: 0 }); if (successCount > 0) loadCommonDocument(true); }, 2000);
      }
    } catch (error) { console.error('ZIP import error:', error); alert('匯入失敗，請確認 ZIP 檔案格式正確'); setImportingZip(false); setImportZipProgress({ current: 0, total: 0, status: '', success: 0, failed: 0 }); }
  };

  const previewableDocuments = useMemo(
    () => commondocument.filter((document) => canPreviewFile(document.name || document.file || "", document.filetype)),
    [commondocument]
  );

  const documentsMissingCover = useMemo(
    () => commondocument.filter((document) => !document.cover),
    [commondocument]
  );

  const uncategorizedDocuments = useMemo(
    () => commondocument.filter((document) => !document.category),
    [commondocument]
  );
  const duplicateGroups = useMemo(() => {
    const groups = new Map<string, CommonDocumentData[]>();
    commondocument.forEach((doc) => {
      const key = (doc.hash || doc.file || "").trim();
      if (!key) return;
      const group = groups.get(key) ?? [];
      group.push(doc);
      groups.set(key, group);
    });

    const grouped = Array.from(groups.values())
      .filter((group) => group.length > 1)
      .map((group) => [...group].sort((a, b) => (a.$createdAt || "").localeCompare(b.$createdAt || "")));

    const duplicates = grouped.flat();
    const duplicatesToRemove = grouped.flatMap((group) => group.slice(1));
    const duplicateIds = new Set(duplicates.map((doc) => doc.$id));

    return {
      duplicates,
      duplicatesToRemove,
      duplicateIds,
      groupCount: grouped.length,
    };
  }, [commondocument]);

  // 搜尋過濾
  const filteredDocuments = useMemo(() => {
    const modeFiltered = commondocument.filter((item) => {
      if (workbenchMode === "previewable") return canPreviewFile(item.name || item.file || "", item.filetype);
      if (workbenchMode === "missingCover") return !item.cover;
      if (workbenchMode === "uncategorized") return !item.category;
      if (workbenchMode === "duplicates") return duplicateGroups.duplicateIds.has(item.$id);
      return true;
    });

    if (!searchQuery.trim()) return modeFiltered;
    const query = searchQuery.toLowerCase();
    return modeFiltered.filter(item =>
      item.name?.toLowerCase().includes(query) ||
      item.note?.toLowerCase().includes(query) ||
      item.category?.toLowerCase().includes(query)
    );
  }, [commondocument, searchQuery, workbenchMode, duplicateGroups.duplicateIds]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      
      if (next.size > 0 && !selectionMode) {
        setTimeout(() => setSelectionMode(true), 0);
      } else if (next.size === 0 && selectionMode) {
        setTimeout(() => setSelectionMode(false), 0);
      }
      
      return next;
    });
  };

  const handleSelectAll = () => {
    if (filteredDocuments.length > 0 && filteredDocuments.every(d => selectedIds.has(d.$id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDocuments.map(d => d.$id).filter(Boolean)));
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds).filter(id => !!id);
    setDeleteTotal(ids.length);
    setDeleteProgress(0);
    setIsDeleting(true);
    await Promise.all(ids.map(id => {
      const url = addAppwriteConfigToUrl(`${API_ENDPOINTS.COMMONDOCUMENT}/${id}`);
      return fetch(url, { method: 'DELETE' })
        .catch(err => console.error('Delete failed:', err))
        .finally(() => setDeleteProgress(prev => prev + 1));
    }));
    setIsDeleting(false);
    setSelectedIds(new Set());
    setSelectionMode(false);
    setBulkDeleteOpen(false);
    setBulkDeleteInput("");
    loadCommonDocument(true);
  };

  const handleCleanupDuplicates = async () => {
    const ids = duplicateGroups.duplicatesToRemove.map(doc => doc.$id).filter(Boolean);
    if (ids.length === 0) { alert('沒有可清理的重複文件'); return; }
    const confirmText = 'DELETE duplicates';
    const userInput = prompt(`找到 ${duplicateGroups.groupCount} 組重複文件，將刪除 ${ids.length} 份，只保留每組最早建立的 1 份。\n\n請輸入以下文字確認：\n${confirmText}`);
    if (userInput !== confirmText) {
      if (userInput !== null) {
        alert('輸入不正確，已取消');
      }
      return;
    }
    setDeleteTotal(ids.length);
    setDeleteProgress(0);
    setIsDeleting(true);
    let successCount = 0;
    let failedCount = 0;
    for (const id of ids) {
      try {
        const url = addAppwriteConfigToUrl(`${API_ENDPOINTS.COMMONDOCUMENT}/${id}`);
        const response = await fetch(url, { method: 'DELETE' });
        if (response.ok) successCount++;
        else failedCount++;
      } catch (err) {
        console.error('Delete duplicate failed:', err);
        failedCount++;
      } finally {
        setDeleteProgress(prev => prev + 1);
      }
    }
    setIsDeleting(false);
    alert(`重複文件清理完成。\n成功: ${successCount} 筆\n失敗: ${failedCount} 筆`);
    loadCommonDocument(true);
  };

  const handleAdd = () => {
    setEditingDocument(null);
    setShowFormModal(true);
    setIsInlineCreating(false);
    setInlineCreateForm({ name: '', file: '', filetype: '', category: '', note: '', ref: '', cover: '', hash: '' });
  };

  const handleEdit = (doc: CommonDocumentData) => {
    setEditingDocument(doc);
    setShowFormModal(true);
  };

  const handleDelete = async (doc: CommonDocumentData) => {
    const confirmText = `DELETE ${doc.name}`;
    const userInput = prompt(`確定要刪除文件「${doc.name}」嗎？\n\n請輸入以下文字以確認刪除：\n${confirmText}`);

    if (userInput !== confirmText) {
      if (userInput !== null) {
        alert('輸入不正確，刪除已取消');
      }
      return;
    }

    try {
      const url = addAppwriteConfigToUrl(`${API_ENDPOINTS.COMMONDOCUMENT}/${doc.$id}`);
      const response = await fetch(url, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('刪除失敗');
      loadCommonDocument(true);
    } catch (error) {
      alert(error instanceof Error ? error.message : '刪除失敗');
    }
  };

  // 開始行內編輯
  const handleInlineEdit = (doc: CommonDocumentData) => {
    setInlineEditForm({
      name: doc.name || '',
      file: doc.file || '',
      filetype: doc.filetype || '',
      category: doc.category || '',
      note: doc.note || '',
      ref: doc.ref || '',
      cover: doc.cover || '',
      hash: doc.hash || '',
    });
    setInlineEditingId(doc.$id);
  };

  // 儲存行內編輯
  const handleInlineSave = async (docId: string) => {
    if (!inlineEditingId) return;
    try {
      const url = addAppwriteConfigToUrl(`${API_ENDPOINTS.COMMONDOCUMENT}/${docId}`);
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: inlineEditForm.name,
          file: inlineEditForm.file,
          filetype: inlineEditForm.filetype,
          category: inlineEditForm.category,
          note: inlineEditForm.note,
          ref: inlineEditForm.ref,
          cover: inlineEditForm.cover,
          hash: inlineEditForm.hash,
        }),
      });
      if (!response.ok) throw new Error('更新失敗');
      loadCommonDocument(true);
      setInlineEditingId(null);
      setInlineEditForm({ name: '', file: '', filetype: '', category: '', note: '', ref: '', cover: '', hash: '' });
    } catch (error) {
      console.error('Inline edit failed:', error);
      alert(error instanceof Error ? error.message : '更新失敗，請稍後再試');
    }
  };

  // 取消行內編輯
  const cancelInlineEdit = () => {
    setInlineEditingId(null);
    setInlineEditForm({ name: '', file: '', filetype: '', category: '', note: '', ref: '', cover: '', hash: '' });
  };

  // 處理封面上傳
  const handleCoverUpload = async (docId: string, file: File) => {
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      alert('封面圖片大小不能超過 50MB');
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('只支援 JPG, PNG, GIF, WebP 格式的圖片');
      return;
    }

    setUploadingCoverId(docId);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const response = await fetch('/api/upload-music', {
        method: 'POST',
        headers: getAppwriteHeaders(),
        body: formDataUpload,
      });

      if (!response.ok) {
        throw new Error('上傳失敗');
      }

      const data = await response.json();

      // Update document with new cover URL
      const doc = commondocument.find(d => d.$id === docId);
      if (doc) {
        const url = addAppwriteConfigToUrl(`${API_ENDPOINTS.COMMONDOCUMENT}/${docId}`);
        const updateResponse = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: doc.name,
            category: doc.category,
            note: doc.note,
            ref: doc.ref,
            cover: data.url,
          }),
        });

        if (!updateResponse.ok) throw new Error('更新封面失敗');

        loadCommonDocument(true);
      }
    } catch (error) {
      console.error('Cover upload failed:', error);
      alert(error instanceof Error ? error.message : '封面上傳失敗');
    } finally {
      setUploadingCoverId(null);
    }
  };

  const handleFormSuccess = () => {
    setShowFormModal(false);
    setEditingDocument(null);
    setIsInlineCreating(false);
    loadCommonDocument(true);
  };

  const cancelInlineCreate = () => {
    setIsInlineCreating(false);
    setInlineCreateForm({ name: '', file: '', filetype: '', category: '', note: '', ref: '', cover: '', hash: '' });
  };

  const handleInlineCreateSave = async () => {
    if (!inlineCreateForm.name.trim()) {
      alert('請輸入文件名稱');
      return;
    }

    try {
      const response = await fetch(addAppwriteConfigToUrl(API_ENDPOINTS.COMMONDOCUMENT), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...inlineCreateForm,
          hash: inlineCreateForm.hash || `inline_create_${Date.now()}`,
        }),
      });
      if (!response.ok) throw new Error('新增失敗');
      cancelInlineCreate();
      loadCommonDocument(true);
    } catch (error) {
      alert(error instanceof Error ? error.message : '新增失敗');
    }
  };

  const handlePreview = (doc: CommonDocumentData, editMode = false) => {
    if (doc.file && canPreviewFile(doc.name || doc.file, doc.filetype)) {
      setPreviewDocument(doc);
      setOpenInEditMode(editMode);
    }
  };

  const handleEditContent = (doc: CommonDocumentData) => {
    handlePreview(doc, true);
  };

  if (loading) {
    return <FullPageLoading text="載入文件資料中..." />;
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <FriendlyAiCrudShell
        title="鋒兄文件"
        description="文件收藏、可預覽內容與待補封面整理成同一個知識工作台，先把看得到的入口整理好，再進入摘要與問答。"
        searchPlaceholder="搜尋文件名稱、備註、分類..."
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        workspaceCountText={`共 ${commondocument.length} 份文件`}
        workspaceDescription="整理文件名稱、分類、封面與可預覽狀態，優先補齊封面、分類與快取可用性。"
        activeMode={workbenchMode}
        onModeChange={(mode) => setWorkbenchMode(mode as typeof workbenchMode)}
        modeItems={[
          { key: "all", label: "全部文件", count: commondocument.length },
          { key: "previewable", label: "可預覽", count: previewableDocuments.length },
          { key: "missingCover", label: "缺封面", count: documentsMissingCover.length },
          { key: "uncategorized", label: "未分類", count: uncategorizedDocuments.length },
          { key: "duplicates", label: "重複文件", count: duplicateGroups.duplicates.length },
        ]}
        suggestions={[
          documentsMissingCover.length > 0
            ? { title: "補封面優先", body: `有 ${documentsMissingCover.length} 份文件沒有封面，列表辨識速度會明顯下降。`, tone: "amber" }
            : { title: "封面狀態", body: "封面狀態不錯，接下來可補 AI 摘要與重點。", tone: "green" },
          uncategorizedDocuments.length > 0
            ? { title: "分類清理", body: "先把未分類文件分到主題資料夾，後續搜尋和 AI 關聯才會更準。", tone: "blue" }
            : { title: "分類完成度", body: "分類已有基礎，之後可把重點放在內容摘要與問答。", tone: "green" },
          duplicateGroups.duplicates.length > 0
            ? { title: "重複檔案", body: `偵測到 ${duplicateGroups.duplicates.length} 份重複文件，建議先一鍵清理。`, tone: "amber" }
            : { title: "重複檢查", body: "目前未偵測到重複文件。", tone: "green" },
          previewableDocuments.length > 0
            ? { title: "快速回顧", body: `目前有 ${previewableDocuments.length} 份文件可直接預覽，適合先整理高頻查閱的內容。`, tone: "neutral" }
            : { title: "可讀性提醒", body: "如果常用的是圖片或掃描檔，之後很值得補 OCR 與摘要。", tone: "neutral" },
        ]}
        toolbar={
          <>
            <Button
              onClick={() => loadCommonDocument(true)}
              disabled={loading || exportingZip || importingZip}
              variant="outline"
              className="gap-2 rounded-xl h-10 px-4"
              title="重新整理"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              <span className="hidden sm:inline">重新整理</span>
            </Button>
            <Button onClick={handleExportZip} disabled={loading || exportingZip || importingZip || commondocument.length === 0} className="gap-2 bg-purple-500 hover:bg-purple-600 rounded-xl disabled:opacity-50" title="匯出所有文件為 ZIP">
              <Download size={16} className={exportingZip ? "animate-bounce" : ""} />
              <span className="hidden sm:inline">{exportingZip ? "匯出中..." : "匯出 ZIP"}</span>
            </Button>
              <Button onClick={() => importZipInputRef.current?.click()} disabled={loading || exportingZip || importingZip} className="gap-2 bg-orange-500 hover:bg-orange-600 rounded-xl disabled:opacity-50" title="從 ZIP 匯入文件">
                <FolderUp size={16} className={importingZip ? "animate-bounce" : ""} />
                <span className="hidden sm:inline">{importingZip ? "匯入中..." : "匯入 ZIP"}</span>
              </Button>
              <input ref={importZipInputRef} type="file" accept=".zip" onChange={handleImportZip} className="hidden" />
              {duplicateGroups.duplicatesToRemove.length > 0 && (
                <Button
                  onClick={handleCleanupDuplicates}
                  disabled={loading || exportingZip || importingZip || isDeleting}
                  className="gap-2 bg-red-500 hover:bg-red-600 rounded-xl disabled:opacity-50"
                  title="一鍵清理重複文件"
                >
                  <Trash2 size={16} className={isDeleting ? "animate-pulse" : ""} />
                  <span className="hidden sm:inline">
                    {isDeleting ? `清理中 ${deleteProgress}/${deleteTotal}` : `清理重複 (${duplicateGroups.duplicatesToRemove.length})`}
                  </span>
                </Button>
              )}
              {selectionMode ? (
                <>
                  <Button onClick={() => { setSelectedIds(new Set()); setSelectionMode(false); }} variant="outline" className="rounded-xl h-10 px-4">
                    取消選取
                  </Button>
                  <Button onClick={handleSelectAll} variant="outline" className="rounded-xl h-10 px-4">
                    {filteredDocuments.length > 0 && filteredDocuments.every((document) => selectedIds.has(document.$id)) ? "取消全選" : "全選"}
                  </Button>
                </>
              ) : (
                <Button onClick={() => setSelectionMode(true)} variant="outline" className="rounded-xl h-10 px-4">
                  開啟選取
                </Button>
              )}
            {selectedIds.size > 0 && (
              <Button onClick={() => setBulkDeleteOpen(true)} className="rounded-xl h-10 px-4 bg-red-600 hover:bg-red-700 text-white">
                <Trash2 size={18} />
                刪除選取 ({selectedIds.size})
              </Button>
            )}
            <div className="hidden xl:flex w-full sm:w-auto bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={`flex flex-1 items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${viewMode === "grid"
                  ? "bg-blue-500 text-white"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
              >
                <LayoutGrid size={16} />
                卡片
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`flex flex-1 items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${viewMode === "table"
                  ? "bg-blue-500 text-white"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
              >
                <TableIcon size={16} />
                表格
              </button>
            </div>
            <Button onClick={handleAdd} className="w-full sm:w-auto gap-2 bg-blue-500 hover:bg-blue-600 rounded-xl"><Plus size={16} />新增文件</Button>
          </>
        }
      />

      {/* 統計卡片 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        <StatCard title="文件總數" value={stats.total} icon={DocumentIcon} />
        <StatCard title="已快取" value={cacheStats.cachedDocuments} icon={Check} />
        <StatCard title="快取大小" value={formatFileSize(cacheStats.totalSize)} icon={HardDrive} />
      </div>

      {/* 文件列表 */}
      {isInlineCreating && (
        <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden border-2 border-blue-500 dark:border-blue-400 p-4 space-y-3">
          <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">新增中</div>
          <Input placeholder="文件名稱" value={inlineCreateForm.name} onChange={(e) => setInlineCreateForm({ ...inlineCreateForm, name: e.target.value })} className="h-9 rounded-lg text-sm" />
          <Input placeholder="分類" value={inlineCreateForm.category} onChange={(e) => setInlineCreateForm({ ...inlineCreateForm, category: e.target.value })} className="h-9 rounded-lg text-sm" />
          <Textarea placeholder="備註" value={inlineCreateForm.note} onChange={(e) => setInlineCreateForm({ ...inlineCreateForm, note: e.target.value })} className="rounded-lg text-sm h-20 resize-none" />
          <Input placeholder="參考" value={inlineCreateForm.ref} onChange={(e) => setInlineCreateForm({ ...inlineCreateForm, ref: e.target.value })} className="h-9 rounded-lg text-sm" />
          <Input placeholder="檔案類型 (pdf, md, mp4...)" value={inlineCreateForm.filetype} onChange={(e) => setInlineCreateForm({ ...inlineCreateForm, filetype: e.target.value })} className="h-9 rounded-lg text-sm" />
          <Input placeholder="文件 URL" value={inlineCreateForm.file} onChange={(e) => setInlineCreateForm({ ...inlineCreateForm, file: e.target.value })} className="h-9 rounded-lg text-sm" />
          <Input placeholder="封面圖 URL" value={inlineCreateForm.cover} onChange={(e) => setInlineCreateForm({ ...inlineCreateForm, cover: e.target.value })} className="h-9 rounded-lg text-sm" />
          <Input placeholder="Hash（選填）" value={inlineCreateForm.hash} onChange={(e) => setInlineCreateForm({ ...inlineCreateForm, hash: e.target.value })} className="h-9 rounded-lg text-sm" />
          <div className="flex gap-2">
            <Button onClick={handleInlineCreateSave} className="flex-1 gap-1 bg-green-500 hover:bg-green-600 rounded-lg text-xs py-1.5">
              新增
            </Button>
            <Button onClick={cancelInlineCreate} variant="outline" className="flex-1 gap-1 rounded-lg text-xs py-1.5">
              取消
            </Button>
          </div>
        </div>
      )}

      {commondocument.length === 0 && !isInlineCreating ? (
        <EmptyState
          icon={<DocumentIcon className="w-12 h-12" />}
          title="尚無文件"
          description="點擊上方「新增文件」按鈕新增第一份文件"
        />
      ) : filteredDocuments.length === 0 ? (
        <EmptyState
          icon={<Search className="w-12 h-12" />}
          title="無搜尋結果"
          description={`找不到「${searchQuery}」相關的文件`}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:hidden">
            {filteredDocuments.map((doc) => (
              <DocumentCard
                key={doc.$id}
                document={doc}
                onEdit={() => handleEdit(doc)}
                onDelete={() => handleDelete(doc)}
                onPreview={() => handlePreview(doc)}
                onEditContent={() => handleEditContent(doc)}
                inlineEditingId={inlineEditingId}
                inlineEditForm={inlineEditForm}
                setInlineEditForm={setInlineEditForm}
                onInlineEdit={handleInlineEdit}
                onInlineSave={handleInlineSave}
                onInlineCancel={cancelInlineEdit}
                onCoverUpload={handleCoverUpload}
                uploadingCoverId={uploadingCoverId}
                selectionMode={selectionMode}
                isSelected={selectedIds.has(doc.$id)}
                onToggleSelect={() => handleToggleSelect(doc.$id)}
              />
            ))}
          </div>
          <div className={viewMode === 'grid' ? "hidden xl:grid xl:grid-cols-2 2xl:grid-cols-3 gap-4" : "hidden"}>
            {filteredDocuments.map((doc) => (
              <DocumentCard
                key={doc.$id}
                document={doc}
                onEdit={() => handleEdit(doc)}
                onDelete={() => handleDelete(doc)}
                onPreview={() => handlePreview(doc)}
                onEditContent={() => handleEditContent(doc)}
                inlineEditingId={inlineEditingId}
                inlineEditForm={inlineEditForm}
                setInlineEditForm={setInlineEditForm}
                onInlineEdit={handleInlineEdit}
                onInlineSave={handleInlineSave}
                onInlineCancel={cancelInlineEdit}
                onCoverUpload={handleCoverUpload}
                uploadingCoverId={uploadingCoverId}
                selectionMode={selectionMode}
                isSelected={selectedIds.has(doc.$id)}
                onToggleSelect={() => handleToggleSelect(doc.$id)}
              />
            ))}
          </div>
          <div className={viewMode === 'table' ? "hidden xl:block" : "hidden"}>
            <DocumentTable
              documents={filteredDocuments}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onPreview={handlePreview}
              onEditContent={handleEditContent}
              inlineEditingId={inlineEditingId}
              inlineEditForm={inlineEditForm}
              setInlineEditForm={setInlineEditForm}
              onInlineEdit={handleInlineEdit}
              onInlineSave={handleInlineSave}
              onInlineCancel={cancelInlineEdit}
              onCoverUpload={handleCoverUpload}
              uploadingCoverId={uploadingCoverId}
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
            />
          </div>
        </>
      )}

      {/* 表單模態框 */}
      {showFormModal && (
        <DocumentFormModal
          document={editingDocument}
          existingDocuments={commondocument}
          onClose={() => {
            setShowFormModal(false);
            setEditingDocument(null);
          }}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* 預覽模態框 */}
      {previewDocument && (
        <DocumentPreviewModal
          document={previewDocument}
          onClose={() => {
            setPreviewDocument(null);
            setOpenInEditMode(false);
          }}
          openInEditMode={openInEditMode}
        />
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
                      ⚠️ <strong>注意：</strong>匯入不包含文件檔案和封面圖，這些需要另行上傳。
                    </p>
                  </div>
                  <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">將匯入 {importPreview.data.length} 筆資料:</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-[760px] w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100 dark:bg-gray-700">
                          <th className="px-3 py-2 text-left">名稱</th>
                          <th className="px-3 py-2 text-left">分類</th>
                          <th className="px-3 py-2 text-left">備註</th>
                          <th className="px-3 py-2 text-left">封面</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.data.slice(0, 10).map((item, i) => (
                          <tr key={i} className="border-b border-gray-200 dark:border-gray-700">
                            <td className="px-3 py-2 font-medium">{item.name}</td>
                            <td className="px-3 py-2">{item.category || '-'}</td>
                            <td className="px-3 py-2 max-w-[200px] truncate">{item.note || '-'}</td>
                            <td className="px-3 py-2 max-w-[100px] truncate">{item.cover ? '有' : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {importPreview.data.length > 10 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">...還有 {importPreview.data.length - 10} 筆</p>
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

      {/* ZIP 匯出進度模態框 */}
      {exportingZip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-2xl w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">匯出文件中...</h3>
            <div className="space-y-3">
              <div className="text-sm text-gray-600 dark:text-gray-400">{exportZipProgress.status}</div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400"><span>進度</span><span>{exportZipProgress.current} / {exportZipProgress.total}</span></div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3"><div className="bg-purple-600 h-3 rounded-full transition-all duration-300" style={{ width: `${exportZipProgress.total > 0 ? (exportZipProgress.current / exportZipProgress.total) * 100 : 0}%` }}></div></div>
              </div>
              <div className="rounded-xl border border-purple-200/70 bg-purple-50/70 p-3 dark:border-purple-900/40 dark:bg-purple-950/20">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-700 dark:text-purple-300">
                    Debug Console Output
                  </span>
                  <span className="text-[11px] text-purple-600/70 dark:text-purple-300/70">
                    {exportZipDebugMessages.length} entries
                  </span>
                </div>
                <div className="max-h-48 overflow-y-auto rounded-lg bg-slate-950 px-3 py-2 font-mono text-xs leading-5 text-green-300">
                  {exportZipDebugMessages.length > 0 ? (
                    exportZipDebugMessages.map((message, index) => (
                      <div key={`${index}-${message.slice(0, 24)}`}>{message}</div>
                    ))
                  ) : (
                    <div className="text-slate-400">Waiting for export logs...</div>
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
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">匯入文件中...</h3>
            <div className="space-y-3">
              <div className="text-sm text-gray-600 dark:text-gray-400">{importZipProgress.status}</div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400"><span>進度</span><span>{importZipProgress.current} / {importZipProgress.total}</span></div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3"><div className="bg-orange-600 h-3 rounded-full transition-all duration-300" style={{ width: `${importZipProgress.total > 0 ? (importZipProgress.current / importZipProgress.total) * 100 : 0}%` }}></div></div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 text-xs text-center">
                <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-2"><div className="font-bold text-green-600 dark:text-green-400">{importZipProgress.success}</div><div className="text-green-600/70 dark:text-green-400/70">成功</div></div>
                <div className="bg-red-100 dark:bg-red-900/30 rounded-lg p-2"><div className="font-bold text-red-600 dark:text-red-400">{importZipProgress.failed}</div><div className="text-red-600/70 dark:text-red-400/70">失敗</div></div>
              </div>
              <div className="rounded-xl border border-orange-200/70 bg-orange-50/70 p-3 dark:border-orange-900/40 dark:bg-orange-950/20">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-700 dark:text-orange-300">
                    Debug Console Output
                  </span>
                  <span className="text-[11px] text-orange-600/70 dark:text-orange-300/70">
                    {importZipDebugMessages.length} entries
                  </span>
                </div>
                <div className="max-h-48 overflow-y-auto rounded-lg bg-slate-950 px-3 py-2 font-mono text-xs leading-5 text-green-300">
                  {importZipDebugMessages.length > 0 ? (
                    importZipDebugMessages.map((message, index) => (
                      <div key={`${index}-${message.slice(0, 24)}`}>{message}</div>
                    ))
                  ) : (
                    <div className="text-slate-400">Waiting for import logs...</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 快取管理 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">快取管理</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              已使用 {formatFileSize(cacheStats.totalSize)} / {formatFileSize(maxCacheSize)}
            </p>
          </div>
          <Button
            onClick={clearAllCache}
            variant="outline"
            className="rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            disabled={cacheStats.cachedDocuments === 0}
          >
            清空快取
          </Button>
        </div>
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-cyan-600 transition-all duration-300"
            style={{ width: `${Math.min((cacheStats.totalSize / maxCacheSize) * 100, 100)}%` }}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">已快取文件：</span>
            <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">{cacheStats.cachedDocuments} / {commondocument.length}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">下載中：</span>
            <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">{cacheStats.downloadingDocuments}</span>
          </div>
        </div>
      </div>

      {/* 批次刪除確認 Modal */}
      {bulkDeleteOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3 mb-3">
                <AlertTriangle className="text-red-500" size={24} />
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">確認批次刪除</h3>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">即將刪除 <span className="font-bold text-red-600">{selectedIds.size}</span> 份文件，此操作無法復原</p>
            </div>
            {isDeleting ? (
              <div className="p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600 shrink-0" />
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">正在刪除中... ({deleteProgress} / {deleteTotal} 筆)</p>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                  <div className="bg-red-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${deleteTotal > 0 ? (deleteProgress / deleteTotal) * 100 : 0}%` }} />
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">請輸入以下文字確認：</p>
                <code className="block bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg text-sm font-mono text-red-600">DELETE document</code>
                <input
                  type="text"
                  value={bulkDeleteInput}
                  onChange={(e) => setBulkDeleteInput(e.target.value)}
                  placeholder="輸入 DELETE document"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                />
              </div>
            )}
            <div className="flex flex-col gap-3 border-t border-gray-100 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] dark:border-gray-800 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => { setBulkDeleteOpen(false); setBulkDeleteInput(""); }} disabled={isDeleting}>取消</Button>
              <Button onClick={handleBulkDelete} disabled={bulkDeleteInput !== "DELETE document" || isDeleting} className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50">
                {isDeleting ? '刪除中...' : `確認刪除 (${selectedIds.size} 筆)`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 文件卡片
interface DocumentCardProps {
  document: CommonDocumentData;
  onEdit: () => void;
  onDelete: () => void;
  onPreview: () => void;
  onEditContent: () => void;
  // Inline editing props
  inlineEditingId: string | null;
  inlineEditForm: { name: string; file: string; filetype: string; category: string; note: string; ref: string; cover: string; hash: string };
  setInlineEditForm: (form: { name: string; file: string; filetype: string; category: string; note: string; ref: string; cover: string; hash: string }) => void;
  onInlineEdit: (doc: CommonDocumentData) => void;
  onInlineSave: (docId: string) => void;
  onInlineCancel: () => void;
  // Cover upload props
  onCoverUpload: (docId: string, file: File) => void;
  uploadingCoverId: string | null;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

function DocumentCard({ document, onEdit, onDelete, onPreview, onEditContent, inlineEditingId, inlineEditForm, setInlineEditForm, onInlineEdit, onInlineSave, onInlineCancel, onCoverUpload, uploadingCoverId, selectionMode, isSelected, onToggleSelect }: DocumentCardProps) {
  const fileInfo = getFileTypeInfo(document.name || document.file || '', document.filetype);
  const canPreview = document.file && canPreviewFile(document.name || document.file || '', document.filetype);
  const canEditContent = document.file && canEditFile(document.name || document.file || '', document.filetype);
  const { cacheStatus, downloadAndCacheDocument, checkDocumentCache } = useDocumentCache();
  const [isCached, setIsCached] = useState(false);
  const isInlineEditing = inlineEditingId === document.$id;
  const coverInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadFileProgress, setUploadFileProgress] = useState(0);
  const [uploadedFileName, setUploadedFileName] = useState('');

  // 檢查快取狀態
  useEffect(() => {
    const checkCache = async () => {
      const cached = await checkDocumentCache(document.$id);
      setIsCached(cached);
    };
    checkCache();
  }, [document.$id, checkDocumentCache]);

  // 處理快取下載
  const handleCacheDownload = async () => {
    await downloadAndCacheDocument({
      $id: document.$id,
      name: document.name,
      file: getProxiedMediaUrl(document.file),
      note: document.note,
      category: document.category,
      cover: document.cover
    });
    setIsCached(true);
  };

  const documentCacheStatus = cacheStatus[document.$id];

  // 行內編輯模式
  if (isInlineEditing) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden border-2 border-orange-500 p-4">
        <div className="space-y-3">
          <div className="text-sm font-semibold text-orange-600 dark:text-orange-400 mb-2">編輯中</div>
          {/* 文件名稱 */}
          <Input
            placeholder="文件名稱"
            value={inlineEditForm.name}
            onChange={(e) => setInlineEditForm({ ...inlineEditForm, name: e.target.value })}
            className="h-9 rounded-lg text-sm"
          />
          {/* 分類 */}
          <Input
            placeholder="分類"
            value={inlineEditForm.category}
            onChange={(e) => setInlineEditForm({ ...inlineEditForm, category: e.target.value })}
            className="h-9 rounded-lg text-sm"
          />
          {/* 備註 */}
          <Textarea
            placeholder="備註"
            value={inlineEditForm.note}
            onChange={(e) => setInlineEditForm({ ...inlineEditForm, note: e.target.value })}
            className="rounded-lg text-sm h-16 resize-none"
          />
          {/* 參考 */}
          <Input
            placeholder="參考 (ref)"
            value={inlineEditForm.ref}
            onChange={(e) => setInlineEditForm({ ...inlineEditForm, ref: e.target.value })}
            className="h-9 rounded-lg text-sm"
          />
          {/* 檔案類型 */}
          <Input
            placeholder="檔案類型 (例: pdf, docx, mp4)"
            value={inlineEditForm.filetype}
            onChange={(e) => setInlineEditForm({ ...inlineEditForm, filetype: e.target.value })}
            className="h-9 rounded-lg text-sm"
          />
          {/* 上傳文件 */}
          <div className="space-y-1">
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md,.json,.xml,.html,.htm,.css,.js,.ts,.jsx,.tsx,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.jpg,.jpeg,.png,.gif,.webp,.svg,.bmp,.ico,.mp4,.webm,.mov,.mp3,.wav,.m4a,.ogg"
                className="hidden"
                id={`card-file-upload-${document.$id}`}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  e.target.value = '';
                  setUploadingFile(true);
                  setUploadFileProgress(0);
                  setUploadedFileName(file.name);
                  try {
                    const ext = file.name.split('.').pop()?.toLowerCase() || '';
                    // calculate hash
                    let hash = '';
                    try {
                      const buf = await file.arrayBuffer();
                      const hashBuf = await crypto.subtle.digest('SHA-256', buf);
                      hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
                    } catch { hash = `inline_${file.name}_${file.size}`; }
                    // upload
                    const result = await uploadToAppwriteStorage(file, (pct) => setUploadFileProgress(pct));
                    setInlineEditForm({ ...inlineEditForm, file: result.url, filetype: ext, hash });
                  } catch {
                    alert('文件上傳失敗，請再試一次');
                    setUploadedFileName('');
                  } finally {
                    setUploadingFile(false);
                  }
                }}
              />
              <label
                htmlFor={`card-file-upload-${document.$id}`}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${uploadingFile
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40 text-green-600 dark:text-green-400'
                  }`}
              >
                {uploadingFile ? (
                  <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {uploadingFile ? `上傳中 ${uploadFileProgress}%` : '上傳文件'}
              </label>
              <Input
                placeholder="或貼上檔案 URL"
                value={inlineEditForm.file}
                onChange={(e) => setInlineEditForm({ ...inlineEditForm, file: e.target.value })}
                className="h-9 rounded-lg text-sm flex-1"
              />
            </div>
            {uploadedFileName && !uploadingFile && (
              <p className="text-xs text-green-600 dark:text-green-400 truncate">✓ {uploadedFileName}</p>
            )}
            {inlineEditForm.file && !uploadedFileName && (
              <p className="text-xs text-gray-400 truncate">目前: {inlineEditForm.file.split('/').pop() || inlineEditForm.file}</p>
            )}
          </div>
          {/* Hash */}
          <Input
            placeholder="Hash"
            value={inlineEditForm.hash}
            onChange={(e) => setInlineEditForm({ ...inlineEditForm, hash: e.target.value })}
            className="h-9 rounded-lg text-sm"
          />
          {/* 封面圖片 - 可上傳或輸入 URL */}
          <div className="flex gap-2">
            <Input
              placeholder="封面圖 URL"
              value={inlineEditForm.cover}
              onChange={(e) => setInlineEditForm({ ...inlineEditForm, cover: e.target.value })}
              className="h-9 rounded-lg text-sm flex-1"
            />
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  onCoverUpload(document.$id, file);
                  const previewUrl = URL.createObjectURL(file);
                  setInlineEditForm({ ...inlineEditForm, cover: previewUrl });
                }
                e.target.value = '';
              }}
              className="hidden"
              id={`card-cover-upload-${document.$id}`}
            />
            <label
              htmlFor={`card-cover-upload-${document.$id}`}
              className="px-3 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg cursor-pointer transition-colors flex items-center"
              title="上傳封面"
            >
              <Upload className="w-4 h-4" />
            </label>
          </div>
          {/* 封面預覽 */}
          {uploadingCoverId === document.$id ? (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              上傳封面中...
            </div>
          ) : inlineEditForm.cover ? (
            <div className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <img
                src={inlineEditForm.cover}
                alt="封面預覽"
                className="w-16 h-16 object-cover rounded-lg border"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <button
                onClick={() => setInlineEditForm({ ...inlineEditForm, cover: '' })}
                className="text-xs text-red-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50"
              >
                清除封面
              </button>
            </div>
          ) : null}
          <div className="flex gap-2">
            <Button size="sm" onClick={() => onInlineSave(document.$id)} className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-lg">
              <Check className="w-4 h-4 mr-1" /> 儲存
            </Button>
            <Button size="sm" variant="outline" onClick={onInlineCancel} className="flex-1 rounded-lg">
              <X className="w-4 h-4 mr-1" /> 取消
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const hasCover = document.cover && document.cover.trim() !== '';
  const isUploadingCover = uploadingCoverId === document.$id;

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 group border ${isSelected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200 dark:border-gray-700'} p-4`}>
      {/* 封面圖片區域 */}
      <div className="relative mb-4 -mx-4 -mt-4 h-32 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 overflow-hidden">
        <div className={`absolute top-2 left-2 z-10 bg-white/80 dark:bg-gray-800/80 p-1 rounded-md backdrop-blur-sm shadow-sm transition-opacity ${selectionMode || isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <input 
            type="checkbox" 
            checked={isSelected || false} 
            onChange={onToggleSelect} 
            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
        </div>
        {hasCover ? (
          <>
            <img
              src={document.cover}
              alt={document.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            {isUploadingCover ? (
              <div className="flex flex-col items-center gap-2 text-gray-400">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs">上傳中...</span>
              </div>
            ) : (
              <>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onCoverUpload(document.$id, file);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
                <button
                  onClick={() => coverInputRef.current?.click()}
                  className="flex flex-col items-center gap-1 text-gray-400 hover:text-blue-500 transition-colors"
                >
                  <ImagePlus className="w-8 h-8" />
                  <span className="text-xs">上傳封面</span>
                </button>
              </>
            )}
          </div>
        )}
        {/* 文件類型標籤 */}
        <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-medium ${fileInfo.bgColor} ${fileInfo.color}`}>
          {fileInfo.label}
        </span>
      </div>

      <div className="flex items-start gap-4">
        {/* 文件圖示 */}
        <div className={`w-12 h-12 flex-shrink-0 rounded-xl ${fileInfo.bgColor} flex items-center justify-center`}>
          {getFileExtension(document.name || document.file || '', document.filetype) === 'zip' ? (
            <FileArchive className={`w-6 h-6 ${fileInfo.color}`} />
          ) : (
            <DocumentIcon className={`w-6 h-6 ${fileInfo.color}`} />
          )}
        </div>

        {/* 資訊區 */}
        <div className="flex-1 min-w-0 space-y-1">
          <h3 className="font-bold text-base text-gray-900 dark:text-gray-100 truncate">{document.name}</h3>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
            {document.category && (
              <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full font-medium">
                {document.category}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
            <Calendar className="w-3 h-3" />
            {formatLocalDate(document.$createdAt)}
          </div>
          {document.note && (
            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">{document.note}</p>
          )}
        </div>
      </div>

      {/* 操作按鈕 */}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
        {document.file && (
          <>
            <a
              href={getAppwriteDownloadUrl(document.file)}
              download={document.name || "download"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 transition-all duration-200 text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              下載
            </a>
            {/* 快取按鈕 */}
            <button
              onClick={handleCacheDownload}
              disabled={isCached || documentCacheStatus?.downloading}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all duration-200 text-sm font-medium relative ${isCached || documentCacheStatus?.cached
                ? 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 cursor-default'
                : documentCacheStatus?.downloading
                  ? 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-500 cursor-wait'
                  : 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-100 dark:hover:bg-cyan-900/40'
                }`}
              title={
                isCached || documentCacheStatus?.cached
                  ? '已快取'
                  : documentCacheStatus?.downloading
                    ? `下載中 ${Math.round(documentCacheStatus.progress)}%`
                    : '快取到本地'
              }
            >
              {isCached || documentCacheStatus?.cached ? (
                <>
                  <Check className="w-4 h-4" />
                  已快取
                </>
              ) : (
                <>
                  <HardDrive className="w-4 h-4" />
                  快取
                </>
              )}
              {documentCacheStatus?.downloading && (
                <span className="absolute -top-1 -right-1 text-[8px] bg-cyan-600 text-white rounded-full px-1.5 py-0.5">
                  {Math.round(documentCacheStatus.progress)}%
                </span>
              )}
            </button>
          </>
        )}
        {canPreview && (
          <button
            onClick={onPreview}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all duration-200 text-sm font-medium"
          >
            <Eye className="w-4 h-4" />
            預覽
          </button>
        )}
        {canEditContent && (
          <button
            onClick={onEditContent}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-all duration-200 text-sm font-medium"
            title="編輯文件"
          >
            <Edit className="w-4 h-4" />
            編輯文件
          </button>
        )}
        <button
          onClick={() => onInlineEdit(document)}
          className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all duration-200"
          title="編輯資訊"
        >
          <Edit2 className="w-4 h-4" />
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
  );
}

// 文件表格
interface DocumentTableProps {
  documents: CommonDocumentData[];
  onEdit: (doc: CommonDocumentData) => void;
  onDelete: (doc: CommonDocumentData) => void;
  onPreview: (doc: CommonDocumentData) => void;
  onEditContent: (doc: CommonDocumentData) => void;
  inlineEditingId: string | null;
  inlineEditForm: { name: string; file: string; filetype: string; category: string; note: string; ref: string; cover: string; hash: string };
  setInlineEditForm: (form: { name: string; file: string; filetype: string; category: string; note: string; ref: string; cover: string; hash: string }) => void;
  onInlineEdit: (doc: CommonDocumentData) => void;
  onInlineSave: (docId: string) => void;
  onInlineCancel: () => void;
  onCoverUpload: (docId: string, file: File) => void;
  uploadingCoverId: string | null;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

function DocumentTable({
  documents,
  onEdit,
  onDelete,
  onPreview,
  onEditContent,
  inlineEditingId,
  inlineEditForm,
  setInlineEditForm,
  onInlineEdit,
  onInlineSave,
  onInlineCancel,
  onCoverUpload,
  uploadingCoverId,
  selectionMode,
  selectedIds = new Set(),
  onToggleSelect
}: DocumentTableProps) {
  const coverInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-3 w-10"></th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-16">封面</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">文件名稱</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">分類</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">備註</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-40">建立日期</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {documents.map((doc) => (
              <DocumentTableRow
                key={doc.$id}
                document={doc}
                onEdit={onEdit}
                onDelete={onDelete}
                onPreview={onPreview}
                onEditContent={onEditContent}
                isInlineEditing={inlineEditingId === doc.$id}
                inlineEditForm={inlineEditForm}
                setInlineEditForm={setInlineEditForm}
                onInlineEdit={onInlineEdit}
                onInlineSave={onInlineSave}
                onInlineCancel={onInlineCancel}
                onCoverUpload={onCoverUpload}
                isUploadingCover={uploadingCoverId === doc.$id}
                coverInputRefs={coverInputRefs}
                selectionMode={selectionMode}
                isSelected={selectedIds.has(doc.$id)}
                onToggleSelect={() => onToggleSelect && onToggleSelect(doc.$id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 表格行組件
interface DocumentTableRowProps {
  document: CommonDocumentData;
  onEdit: (doc: CommonDocumentData) => void;
  onDelete: (doc: CommonDocumentData) => void;
  onPreview: (doc: CommonDocumentData) => void;
  onEditContent: (doc: CommonDocumentData) => void;
  isInlineEditing: boolean;
  inlineEditForm: { name: string; file: string; filetype: string; category: string; note: string; ref: string; cover: string; hash: string };
  setInlineEditForm: (form: { name: string; file: string; filetype: string; category: string; note: string; ref: string; cover: string; hash: string }) => void;
  onInlineEdit: (doc: CommonDocumentData) => void;
  onInlineSave: (docId: string) => void;
  onInlineCancel: () => void;
  onCoverUpload: (docId: string, file: File) => void;
  isUploadingCover: boolean;
  coverInputRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

function DocumentTableRow({
  document,
  onEdit,
  onDelete,
  onPreview,
  onEditContent,
  isInlineEditing,
  inlineEditForm,
  setInlineEditForm,
  onInlineEdit,
  onInlineSave,
  onInlineCancel,
  onCoverUpload,
  isUploadingCover,
  coverInputRefs,
  selectionMode,
  isSelected,
  onToggleSelect
}: DocumentTableRowProps) {
  const fileInfo = getFileTypeInfo(document.name || document.file || '', document.filetype);
  const canPreview = document.file && canPreviewFile(document.name || document.file || '', document.filetype);
  const canEditContent = document.file && canEditFile(document.name || document.file || '', document.filetype);
  const hasCover = document.cover && document.cover.trim() !== '';
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadFileProgress, setUploadFileProgress] = useState(0);
  const [uploadedFileName, setUploadedFileName] = useState('');

  // 行內編輯模式
  if (isInlineEditing) {
    return (
      <tr className="bg-orange-50 dark:bg-orange-900/20">
        <td colSpan={6} className="px-4 py-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">編輯中</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                value={inlineEditForm.name}
                onChange={(e) => setInlineEditForm({ ...inlineEditForm, name: e.target.value })}
                placeholder="文件名稱"
                className="h-9 text-sm"
              />
              <Input
                value={inlineEditForm.category}
                onChange={(e) => setInlineEditForm({ ...inlineEditForm, category: e.target.value })}
                placeholder="分類"
                className="h-9 text-sm"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                value={inlineEditForm.note}
                onChange={(e) => setInlineEditForm({ ...inlineEditForm, note: e.target.value })}
                placeholder="備註"
                className="h-9 text-sm"
              />
              <Input
                value={inlineEditForm.ref}
                onChange={(e) => setInlineEditForm({ ...inlineEditForm, ref: e.target.value })}
                placeholder="參考連結"
                className="h-9 text-sm"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                value={inlineEditForm.filetype}
                onChange={(e) => setInlineEditForm({ ...inlineEditForm, filetype: e.target.value })}
                placeholder="檔案類型 (例: pdf, docx, mp4)"
                className="h-9 text-sm"
              />
              <Input
                value={inlineEditForm.hash}
                onChange={(e) => setInlineEditForm({ ...inlineEditForm, hash: e.target.value })}
                placeholder="Hash"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <div className="flex gap-2">
                <input
                  type="file"
                  accept=".pdf,.txt,.md,.json,.xml,.html,.htm,.css,.js,.ts,.jsx,.tsx,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.jpg,.jpeg,.png,.gif,.webp,.svg,.bmp,.ico,.mp4,.webm,.mov,.mp3,.wav,.m4a,.ogg"
                  className="hidden"
                  id={`table-file-upload-${document.$id}`}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    e.target.value = '';
                    setUploadingFile(true);
                    setUploadFileProgress(0);
                    setUploadedFileName(file.name);
                    try {
                      const ext = file.name.split('.').pop()?.toLowerCase() || '';
                      let hash = '';
                      try {
                        const buf = await file.arrayBuffer();
                        const hashBuf = await crypto.subtle.digest('SHA-256', buf);
                        hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
                      } catch { hash = `inline_${file.name}_${file.size}`; }
                      const result = await uploadToAppwriteStorage(file, (pct) => setUploadFileProgress(pct));
                      setInlineEditForm({ ...inlineEditForm, file: result.url, filetype: ext, hash });
                    } catch {
                      alert('文件上傳失敗，請再試一次');
                      setUploadedFileName('');
                    } finally {
                      setUploadingFile(false);
                    }
                  }}
                />
                <label
                  htmlFor={`table-file-upload-${document.$id}`}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors whitespace-nowrap ${uploadingFile
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40 text-green-600 dark:text-green-400'
                    }`}
                >
                  {uploadingFile ? (
                    <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {uploadingFile ? `上傳中 ${uploadFileProgress}%` : '上傳文件'}
                </label>
                <Input
                  value={inlineEditForm.file}
                  onChange={(e) => setInlineEditForm({ ...inlineEditForm, file: e.target.value })}
                  placeholder="或貼上檔案 URL"
                  className="h-9 text-sm flex-1"
                />
              </div>
              {uploadedFileName && !uploadingFile && (
                <p className="text-xs text-green-600 dark:text-green-400 truncate">✓ {uploadedFileName}</p>
              )}
              {inlineEditForm.file && !uploadedFileName && (
                <p className="text-xs text-gray-400 truncate">目前: {inlineEditForm.file.split('/').pop() || inlineEditForm.file}</p>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex gap-2">
                <Input
                  value={inlineEditForm.cover}
                  onChange={(e) => setInlineEditForm({ ...inlineEditForm, cover: e.target.value })}
                  placeholder="封面圖片 URL"
                  className="h-9 text-sm flex-1"
                />
                {/* 上傳封面按鈕 */}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      onCoverUpload(document.$id, file);
                      const previewUrl = URL.createObjectURL(file);
                      setInlineEditForm({ ...inlineEditForm, cover: previewUrl });
                    }
                    e.target.value = '';
                  }}
                  className="hidden"
                  id={`inline-cover-upload-${document.$id}`}
                />
                <label
                  htmlFor={`inline-cover-upload-${document.$id}`}
                  className="px-3 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                  title="上傳封面"
                >
                  <Upload className="w-4 h-4" />
                </label>
              </div>
              {/* 封面預覽 */}
              <div className="flex items-center gap-3">
                {isUploadingCover ? (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    上傳中...
                  </div>
                ) : inlineEditForm.cover ? (
                  <>
                    <img
                      src={inlineEditForm.cover}
                      alt="封面預覽"
                      className="w-12 h-12 object-cover rounded-lg border"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <button
                      onClick={() => setInlineEditForm({ ...inlineEditForm, cover: '' })}
                      className="text-xs text-red-500 hover:text-red-600"
                    >
                      清除
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-gray-400">無封面</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => onInlineSave(document.$id)}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
              >
                <Check className="w-4 h-4" />
                儲存
              </button>
              <button
                onClick={onInlineCancel}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                取消
              </button>
            </div>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
      <td className="px-4 py-3 w-10">
        <input 
          type="checkbox" 
          checked={isSelected || false} 
          onChange={onToggleSelect} 
          className={`w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer transition-opacity ${selectionMode || isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        />
      </td>
      {/* 封面欄位 */}
      <td className="px-4 py-3">
        <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 group">
          <input
            ref={(el) => { coverInputRefs.current[document.$id] = el; }}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onCoverUpload(document.$id, file);
              e.target.value = '';
            }}
            className="hidden"
          />
          {hasCover ? (
            <>
              <img src={document.cover} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => coverInputRefs.current[document.$id]?.click()}
                className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                title="更換封面"
              >
                <Edit2 className="w-4 h-4 text-white" />
              </button>
            </>
          ) : isUploadingCover ? (
            <div className="flex items-center justify-center w-full h-full">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <button
              onClick={() => coverInputRefs.current[document.$id]?.click()}
              className="flex items-center justify-center w-full h-full text-gray-400 hover:text-blue-500 transition-colors"
              title="上傳封面"
            >
              <ImagePlus className="w-5 h-5" />
            </button>
          )}
        </div>
      </td>

      {/* 文件名稱 */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {getFileExtension(document.name || document.file || '', document.filetype) === 'zip' ? (
            <FileArchive className={`w-4 h-4 ${fileInfo.color}`} />
          ) : (
            <DocumentIcon className={`w-4 h-4 ${fileInfo.color}`} />
          )}
          <span className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[200px]">
            {document.name}
          </span>
        </div>
      </td>

      {/* 分類 */}
      <td className="px-4 py-3">
        {document.category ? (
          <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full text-xs font-medium">
            {document.category}
          </span>
        ) : (
          <span className="text-gray-400 text-xs">-</span>
        )}
      </td>

      {/* 備註 */}
      <td className="px-4 py-3">
        <span className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-[200px] block">
          {document.note || '-'}
        </span>
      </td>

      {/* 建立日期 */}
      <td className="px-4 py-3 text-sm text-gray-500">
        {formatLocalDate(document.$createdAt)}
      </td>

      {/* 操作 */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          {canPreview && (
            <button
              onClick={() => onPreview(document)}
              className="p-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition-colors"
              title="預覽"
            >
              <Eye className="w-4 h-4" />
            </button>
          )}
          {canEditContent && (
            <button
              onClick={() => onEditContent(document)}
              className="p-1.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded-lg transition-colors"
              title="編輯文件"
            >
              <Edit className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onInlineEdit(document)}
            className="p-1.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/40 rounded-lg transition-colors"
            title="快速編輯"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEdit(document)}
            className="p-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
            title="編輯詳情"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(document)}
            className="p-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors"
            title="刪除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// 文件表單模態框
function DocumentFormModal({ document, existingDocuments, onClose, onSuccess }: {
  document: CommonDocumentData | null;
  existingDocuments: CommonDocumentData[];
  onClose: () => void;
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState({
    name: document?.name || '',
    file: document?.file || '',
    filetype: document?.filetype || '',
    note: document?.note || '',
    ref: document?.ref || '',
    category: document?.category || '',
    hash: document?.hash || '',
    cover: document?.cover || '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [fileHash, setFileHash] = useState<string>('');
  const [duplicateWarning, setDuplicateWarning] = useState<string>('');
  const [useCategorySelect, setUseCategorySelect] = useState(true);
  const [selectedCoverFile, setSelectedCoverFile] = useState<File | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);

  const existingCategories = Array.from(new Set(existingDocuments.map(d => d.category).filter(Boolean)));

  // 處理封面上傳
  const handleCoverFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      alert('封面圖片大小不能超過 50MB');
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('只支援 JPG, PNG, GIF, WebP 格式的圖片');
      return;
    }

    setSelectedCoverFile(file);
    // 創建本地預覽 URL
    const previewUrl = URL.createObjectURL(file);
    setFormData(prev => ({ ...prev, cover: previewUrl }));
  };

  const uploadCoverToAppwrite = async (file: File): Promise<string> => {
    setCoverUploading(true);
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    try {
      const response = await fetch('/api/upload-music', {
        method: 'POST',
        headers: getAppwriteHeaders(),
        body: formDataUpload,
      });

      if (!response.ok) {
        throw new Error('封面上傳失敗');
      }

      const data = await response.json();
      return data.url;
    } finally {
      setCoverUploading(false);
    }
  };

  const calculateFileHash = async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.error('Hash calculation error:', error);
      return `fallback_${file.name}_${file.size}_${file.lastModified}`;
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const file = files[0];
    e.currentTarget.value = '';

    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('檔案大小不能超過 50MB');
      return;
    }

    const oversizedFile = files.find((item) => item.size > maxSize);
    if (oversizedFile) {
      alert(`${oversizedFile.name} 檔案大小不可超過 50MB`);
      return;
    }

    const validExtensions = [
      // Documents
      '.pdf', '.txt', '.md', '.json', '.xml', '.html', '.htm', '.css', '.js', '.ts', '.jsx', '.tsx',
      // Office
      '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      // Archives
      '.zip', '.rar', '.7z',
      // Images
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico',
      // Video/Audio
      '.mp4', '.webm', '.mov', '.avi', '.mkv', '.mp3', '.wav', '.m4a', '.ogg'
    ];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!validExtensions.includes(ext)) {
      alert('只支援 PDF, 文字檔, 程式碼, Office 文件, 壓縮檔, 圖片, 影音 格式');
      return;
    }

    const invalidFile = files.find((item) => {
      const itemExt = '.' + item.name.split('.').pop()?.toLowerCase();
      return !validExtensions.includes(itemExt);
    });
    if (invalidFile) {
      alert(`${invalidFile.name} 檔案類型不支援`);
      return;
    }

    setUploadStatus('idle');
    setUploadProgress(0);
    setDuplicateWarning('');
    setSelectedFiles((prev) => {
      if (document) return files.slice(0, 1);
      const existingKeys = new Set(prev.map((item) => `${item.name}-${item.size}-${item.lastModified}`));
      const nextFiles = files.filter((item) => !existingKeys.has(`${item.name}-${item.size}-${item.lastModified}`));
      return [...prev, ...nextFiles];
    });

    // Extract filetype from filename
    const filetype = file.name.split('.').pop()?.toLowerCase() || '';

    if (!formData.name) {
      setFormData(prev => ({ ...prev, name: file.name, filetype }));
    } else {
      setFormData(prev => ({ ...prev, filetype }));
    }

    const hash = await calculateFileHash(file);
    setFileHash(hash);
    setFormData(prev => ({ ...prev, hash }));

    const duplicateDoc = existingDocuments.find(d =>
      d.hash === hash && (!document || d.$id !== document.$id)
    );

    if (duplicateDoc) {
      setDuplicateWarning(`警告：此文件與「${duplicateDoc.name}」相同，請勿重複上傳！`);
    }
  };

  const uploadFileToAppwrite = async (file: File): Promise<{ url: string; fileId: string }> => {
    setUploadStatus('uploading');
    setUploadProgress(0);

    try {
      const result = await uploadToAppwriteStorage(file, (progress) => {
        setUploadProgress(progress);
      });
      setUploadStatus('success');
      setUploadProgress(100);
      return result;
    } catch (error) {
      setUploadStatus('error');
      throw error instanceof Error ? error : new Error('上傳失敗');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('請輸入文件名稱');
      return;
    }

    setSubmitting(true);
    try {
      let fileUrl = formData.file;
      let coverUrl = formData.cover;

      if (selectedFiles.length > 0 && (selectedFiles.length === 1 || document)) {
        const uploadResult = await uploadFileToAppwrite(selectedFiles[0]);
        fileUrl = uploadResult.url;
      }

      // 上傳封面圖片
      if (selectedCoverFile) {
        coverUrl = await uploadCoverToAppwrite(selectedCoverFile);
      }

      const url = document
        ? addAppwriteConfigToUrl(`${API_ENDPOINTS.COMMONDOCUMENT}/${document.$id}`)
        : addAppwriteConfigToUrl(API_ENDPOINTS.COMMONDOCUMENT);

      if (!document && selectedFiles.length > 1) {
        for (let i = 0; i < selectedFiles.length; i++) {
          const item = selectedFiles[i];
          const uploadResult = await uploadFileToAppwrite(item);
          const itemHash = await calculateFileHash(item);
          const itemFiletype = item.name.split('.').pop()?.toLowerCase() || '';
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...formData,
              name: i === 0 && formData.name.trim() ? formData.name : item.name,
              file: uploadResult.url,
              cover: coverUrl,
              filetype: itemFiletype,
              hash: itemHash,
            }),
          });

          if (!response.ok) throw new Error(`新增 ${item.name} 失敗`);
        }
        onSuccess();
        return;
      }

      const response = await fetch(url, {
        method: document ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          file: fileUrl,
          cover: coverUrl,
          filetype: formData.filetype,
          hash: fileHash || formData.hash,
        }),
      });

      if (!response.ok) throw new Error(document ? '更新失敗' : '新增失敗');
      onSuccess();
    } catch (error) {
      alert(error instanceof Error ? error.message : '操作失敗');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {document ? '編輯資訊' : '新增文件'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 文件名稱 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              文件名稱 <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="輸入文件名稱"
              className="h-12 rounded-xl"
            />
          </div>

          {/* 檔案上傳 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              上傳文件
            </label>
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 text-center hover:border-blue-500 dark:hover:border-blue-400 transition-colors">
              <input
                type="file"
                accept=".pdf,.txt,.md,.json,.xml,.html,.htm,.css,.js,.ts,.jsx,.tsx,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.jpg,.jpeg,.png,.gif,.webp,.svg,.bmp,.ico,.mp4,.webm,.mov,.avi,.mkv,.mp3,.wav,.m4a,.ogg"
                multiple={!document}
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="w-10 h-10 mx-auto mb-3 text-gray-400" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedFiles.length > 1 ? `已選擇 ${selectedFiles.length} 個檔案` : selectedFiles[0]?.name || '點擊或拖曳上傳文件'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  可重複選檔累加；也可按住 Ctrl 或 Shift 多選。支援 PDF, 文字檔, 程式碼, Office, 壓縮檔, 圖片, 影音 (最大 50MB)
                </p>
              </label>
            </div>

            {/* 上傳進度 */}
            {uploadStatus === 'uploading' && (
              <div className="mt-3">
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">上傳中... {uploadProgress}%</p>
              </div>
            )}

            {/* 重複警告 */}
            {duplicateWarning && (
              <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-700 dark:text-yellow-400">{duplicateWarning}</p>
              </div>
            )}

            {/* 現有檔案 URL */}
            {!document && selectedFiles.length > 0 && (
              <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-left dark:border-blue-800 dark:bg-blue-900/20">
                <p className="mb-2 text-xs font-medium text-blue-700 dark:text-blue-300">將建立 {selectedFiles.length} 份文件</p>
                <div className="max-h-28 space-y-1 overflow-y-auto text-xs text-blue-700 dark:text-blue-300">
                  {selectedFiles.map((file) => (
                    <div key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center justify-between gap-2">
                      <p className="truncate">{file.name}</p>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFiles((prev) => prev.filter((item) => item !== file));
                        }}
                        className="shrink-0 rounded-md px-2 py-0.5 text-blue-600 hover:bg-blue-100 dark:text-blue-200 dark:hover:bg-blue-800/40"
                      >
                        移除
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {formData.file && selectedFiles.length === 0 && (
              <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  目前檔案：{formData.file}
                </p>
              </div>
            )}
          </div>

          {/* 分類 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                分類
              </label>
              {existingCategories.length > 0 && (
                <button
                  type="button"
                  onClick={() => setUseCategorySelect(!useCategorySelect)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {useCategorySelect ? '自訂輸入' : '從列表選擇'}
                </button>
              )}
            </div>
            {useCategorySelect && existingCategories.length > 0 ? (
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder="選擇分類" />
                </SelectTrigger>
                <SelectContent>
                  {existingCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="輸入分類"
                className="h-12 rounded-xl"
              />
            )}
          </div>

          {/* 備註 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              備註
            </label>
            <Textarea
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              placeholder="輸入備註"
              rows={3}
              className="rounded-xl"
            />
          </div>

          {/* 參考連結 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              參考連結
            </label>
            <Input
              value={formData.ref}
              onChange={(e) => setFormData({ ...formData, ref: e.target.value })}
              placeholder="輸入參考連結"
              className="h-12 rounded-xl"
            />
          </div>

          {/* 封面圖片 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              封面圖片
            </label>

            {/* 上傳區域 */}
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-4 text-center hover:border-blue-500 dark:hover:border-blue-400 transition-colors">
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleCoverFileSelect}
                className="hidden"
                id="cover-upload"
              />
              <label htmlFor="cover-upload" className="cursor-pointer flex items-center justify-center gap-2">
                <ImagePlus className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedCoverFile ? selectedCoverFile.name : (formData.cover ? '更換封面' : '點擊上傳封面圖片')}
                </span>
              </label>
              <p className="text-xs text-gray-400 mt-1">支援 JPG, PNG, GIF, WebP (最大 5MB)</p>
            </div>

            {/* 或輸入 URL */}
            <div className="mt-2">
              <span className="text-xs text-gray-500">或輸入圖片網址：</span>
              <Input
                value={formData.cover && !selectedCoverFile ? formData.cover : ''}
                onChange={(e) => {
                  setFormData({ ...formData, cover: e.target.value });
                  setSelectedCoverFile(null);
                }}
                placeholder="https://..."
                className="h-10 rounded-lg mt-1"
              />
            </div>

            {/* 封面預覽 */}
            {formData.cover && (
              <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">封面預覽：</span>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, cover: '' }));
                      setSelectedCoverFile(null);
                    }}
                    className="text-xs text-red-500 hover:text-red-600"
                  >
                    移除
                  </button>
                </div>
                <img
                  src={formData.cover}
                  alt="封面預覽"
                  className="w-full h-32 object-cover rounded-lg"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}

            {/* 上傳中狀態 */}
            {coverUploading && (
              <div className="mt-2 flex items-center gap-2 text-sm text-blue-600">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                上傳封面圖片中...
              </div>
            )}
          </div>

          {/* 提交按鈕 */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 h-12 rounded-xl"
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={submitting || uploadStatus === 'uploading'}
              className="flex-1 h-12 rounded-xl bg-blue-500 hover:bg-blue-600"
            >
              {submitting ? '儲存中...' : document ? '更新' : '新增'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 文件預覽模態框
function DocumentPreviewModal({ document, onClose, openInEditMode = false }: { document: CommonDocumentData; onClose: () => void; openInEditMode?: boolean }) {
  const ext = getFileExtension(document.name || document.file || '', document.filetype);
  const [txtContent, setTxtContent] = useState<string>('');
  const [txtLoading, setTxtLoading] = useState(false);
  const [zipEntries, setZipEntries] = useState<{ name: string; isDir: boolean; size: number }[]>([]);
  const [zipLoading, setZipLoading] = useState(false);
  const [zipCurrentPath, setZipCurrentPath] = useState<string>('');
  const [zipFileContent, setZipFileContent] = useState<string | null>(null);
  const [zipViewingFile, setZipViewingFile] = useState<string | null>(null);
  const [zipInstance, setZipInstance] = useState<JSZipType | null>(null);
  const [isEditing, setIsEditing] = useState(openInEditMode);
  const [editedContent, setEditedContent] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [showMarkdownPreview, setShowMarkdownPreview] = useState(ext === 'md');
  const [officeViewerType, setOfficeViewerType] = useState<'microsoft' | 'google'>('microsoft');
  const [officePreviewFailed, setOfficePreviewFailed] = useState(false);

  useEffect(() => {
    // Load text content for editable file types
    if (canEditFile(document.name || document.file || '', document.filetype) && document.file) {
      setTxtLoading(true);
      fetch(getProxiedMediaUrl(document.file))
        .then(res => res.text())
        .then(text => {
          setTxtContent(text);
          if (openInEditMode) {
            setEditedContent(text);
          }
          setTxtLoading(false);
        })
        .catch(() => {
          setTxtContent('無法讀取檔案');
          setTxtLoading(false);
        });
    } else if (ext === 'zip' && document.file) {
      setZipLoading(true);
      fetch(getProxiedMediaUrl(document.file))
        .then(res => res.arrayBuffer())
        .then(async (buffer) => {
          const JSZip = await loadJSZip();
          const zip = await JSZip.loadAsync(buffer);
          setZipInstance(zip);
          const entries: { name: string; isDir: boolean; size: number }[] = [];
          zip.forEach((relativePath, file) => {
            entries.push({
              name: relativePath,
              isDir: file.dir,
              size: (file as any)._data?.uncompressedSize || 0,
            });
          });
          entries.sort((a, b) => {
            if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
            return a.name.localeCompare(b.name);
          });
          setZipEntries(entries);
          setZipLoading(false);
        })
        .catch(() => {
          setZipEntries([]);
          setZipLoading(false);
        });
    }
  }, [ext, document.file]);

  // Handle ESC key to exit fullscreen
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleEscKey);
    return () => window.removeEventListener('keydown', handleEscKey);
  }, [isFullscreen]);

  const getPreviewContent = () => {
    if (!document.file) return null;

    // Image Preview (including SVG, BMP, ICO)
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) {
      return (
        <div className="flex items-center justify-center h-full p-4 bg-gray-50 dark:bg-gray-900/50">
          <img
            src={getProxiedMediaUrl(document.file)}
            alt={document.name}
            className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
          />
        </div>
      );
    }

    // Video/Audio Preview (including MOV, OGG)
    if (['mp4', 'webm', 'mov', 'mp3', 'wav', 'm4a', 'ogg'].includes(ext)) {
      const isAudio = ['mp3', 'wav', 'm4a', 'ogg'].includes(ext);
      return (
        <div className="flex items-center justify-center h-full p-8 bg-black">
          <div className={`w-full ${isAudio ? 'max-w-2xl' : 'max-w-4xl'}`}>
            <PlyrPlayer
              src={getProxiedMediaUrl(document.file)}
              type={isAudio ? 'audio' : 'video'}
            />
          </div>
        </div>
      );
    }

    // Office documents (old and new formats)
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) {
      const optimizedFileUrl = document.file.includes('?') ? `${document.file}&ext=.${ext}` : `${document.file}?ext=.${ext}`;
      const microsoftViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(optimizedFileUrl)}`;
      const googleViewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(document.file)}&embedded=true`;
      const viewerUrl = officeViewerType === 'microsoft' ? microsoftViewerUrl : googleViewerUrl;

      return (
        <div className="relative w-full h-full">
          {!officePreviewFailed ? (
            <>
              <iframe
                src={viewerUrl}
                className="w-full h-full border-0"
                title={document.name}
                onError={() => {
                  console.error('Office preview failed');
                  setOfficePreviewFailed(true);
                }}
              />
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-xl shadow-xl flex items-center gap-4 z-10">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">Office 文件預覽</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setOfficeViewerType('microsoft')}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${officeViewerType === 'microsoft'
                        ? 'bg-white text-blue-500'
                        : 'bg-blue-400 text-white hover:bg-blue-300'
                        }`}
                    >
                      Microsoft
                    </button>
                    <button
                      onClick={() => setOfficeViewerType('google')}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${officeViewerType === 'google'
                        ? 'bg-white text-blue-500'
                        : 'bg-blue-400 text-white hover:bg-blue-300'
                        }`}
                    >
                      Google
                    </button>
                  </div>
                </div>
                <a
                  href={`https://office.live.com/start/default.aspx`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 bg-white text-blue-500 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors flex items-center gap-1"
                >
                  <ExternalLink className="w-4 h-4" />
                  編輯
                </a>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-8 bg-gray-50 dark:bg-gray-900">
              <div className="max-w-md text-center">
                <FileArchive className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  無法預覽此 Office 文件
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  線上預覽服務無法存取此文件。這可能是因為文件URL為私有或網路限制。
                </p>
                <div className="flex flex-col gap-3">
                  <a
                    href={getAppwriteDownloadUrl(document.file)}
                    download={document.name}
                    className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-5 h-5" />
                    下載文件
                  </a>
                  <button
                    onClick={() => {
                      setOfficePreviewFailed(false);
                      setOfficeViewerType(officeViewerType === 'microsoft' ? 'google' : 'microsoft');
                    }}
                    className="px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg font-medium transition-colors"
                  >
                    嘗試其他預覽器
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    // PDF Preview with Annotation
    if (ext === 'pdf') {
      return (
        <PDFViewer
          url={getProxiedMediaUrl(document.file)}
          fileName={document.name}
        />
      );
    }

    // Text/Code files preview and edit
    if (canEditFile(document.name || document.file || '', document.filetype)) {
      if (txtLoading) {
        return <div className="flex items-center justify-center h-full"><LoadingSpinner /></div>;
      }
      if (isEditing) {
        return (
          <div className="h-full overflow-hidden bg-gray-50 dark:bg-gray-900">
            <CodeEditor
              value={editedContent}
              onChange={(value) => setEditedContent(value || '')}
              fileName={document.name || document.file || ''}
              height={isFullscreen ? "calc(100vh - 80px)" : "calc(90vh - 150px)"}
            />
          </div>
        );
      }
      // Show Markdown preview for .md files when enabled
      if (ext === 'md' && showMarkdownPreview) {
        return (
          <div className="h-full overflow-auto p-8 bg-white dark:bg-gray-900">
            <article className="prose prose-lg dark:prose-invert max-w-none">
              <MarkdownPreview content={txtContent} />
            </article>
          </div>
        );
      }

      // Show CSV preview for .csv files
      if (ext === 'csv') {
        const rows = txtContent.split('\n').filter(line => line.trim());
        const parseRow = (row: string) => {
          const cells = [];
          let inQuotes = false;
          let currentCell = '';
          for (let i = 0; i < row.length; i++) {
            const char = row[i];
            if (char === '"') {
              if (inQuotes && row[i+1] === '"') {
                currentCell += '"';
                i++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if (char === ',' && !inQuotes) {
              cells.push(currentCell);
              currentCell = '';
            } else {
              currentCell += char;
            }
          }
          cells.push(currentCell);
          return cells;
        };
        const parsedRows = rows.map(parseRow);
        return (
          <div className="h-full overflow-auto bg-white dark:bg-gray-900">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 shadow-sm z-10">
                <tr>
                  {parsedRows[0]?.map((header, i) => (
                    <th key={i} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                {parsedRows.slice(1).map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    {row.map((cell, j) => (
                      <td key={j} className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      // Show code editor for source view
      return (
        <div className="h-full overflow-hidden bg-gray-50 dark:bg-gray-900">
          <CodeEditor
            value={txtContent}
            onChange={() => { }}
            fileName={document.name || document.file || ''}
            height={isFullscreen ? "calc(100vh - 80px)" : "calc(90vh - 150px)"}
            readOnly={true}
          />
        </div>
      );
    }

    // ZIP Preview with Interactive Browsing
    if (ext === 'zip') {
      if (zipLoading) {
        return <div className="flex items-center justify-center h-full"><LoadingSpinner /></div>;
      }

      const handleViewZipFile = async (filePath: string) => {
        if (!zipInstance) return;
        try {
          const file = zipInstance.file(filePath);
          if (file) {
            const content = await file.async('string');
            setZipFileContent(content);
            setZipViewingFile(filePath);
          }
        } catch (error) {
          alert('無法讀取此檔案');
        }
      };

      const handleDownloadZipFile = async (filePath: string) => {
        if (!zipInstance) return;
        try {
          const file = zipInstance.file(filePath);
          if (file) {
            const blob = await file.async('blob');
            const url = URL.createObjectURL(blob);
            const a = globalThis.document.createElement('a');
            a.href = url;
            a.download = filePath.split('/').pop() || 'file';
            a.click();
            URL.revokeObjectURL(url);
          }
        } catch (error) {
          alert('下載失敗');
        }
      };

      // Filter entries by current path
      const currentEntries = zipEntries.filter(entry => {
        if (zipCurrentPath === '') {
          // Root level: show items in root only
          return !entry.name.includes('/') || entry.name.split('/').filter(s => s).length === 1;
        }
        // Inside folder: show direct children only
        const normalizedPath = zipCurrentPath.endsWith('/') ? zipCurrentPath : zipCurrentPath + '/';
        return entry.name.startsWith(normalizedPath) &&
          entry.name.slice(normalizedPath.length).split('/').filter(s => s).length === 1;
      });

      if (zipViewingFile && zipFileContent !== null) {
        return (
          <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setZipViewingFile(null);
                    setZipFileContent(null);
                  }}
                  className="px-3 py-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded text-sm"
                >
                  ← 返回
                </button>
                <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">{zipViewingFile}</span>
              </div>
              <button
                onClick={() => handleDownloadZipFile(zipViewingFile)}
                className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm flex items-center gap-1"
              >
                <Download className="w-4 h-4" />
                下載
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre className="text-sm text-gray-800 dark:text-gray-200 font-mono whitespace-pre-wrap">{zipFileContent}</pre>
            </div>
          </div>
        );
      }

      return (
        <div className="p-6 h-full overflow-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {zipCurrentPath && (
                <button
                  onClick={() => {
                    const parts = zipCurrentPath.split('/').filter(s => s);
                    parts.pop();
                    setZipCurrentPath(parts.join('/'));
                  }}
                  className="px-3 py-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded text-sm"
                >
                  ← 上一層
                </button>
              )}
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {zipCurrentPath || 'ZIP 檔案根目錄'} ({currentEntries.length} 項)
              </h3>
            </div>
          </div>
          <div className="space-y-1">
            {currentEntries.map((entry, idx) => {
              const displayName = entry.name.split('/').filter(s => s).pop() || entry.name;
              const isTextFile = /\.(txt|md|json|xml|html|css|js|ts|jsx|tsx|log|csv)$/i.test(entry.name);

              return (
                <div key={idx} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                  {entry.isDir ? (
                    <FileArchive className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                  ) : (
                    <FileIcon className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  )}
                  <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">{displayName}</span>
                  {!entry.isDir && (
                    <span className="text-xs text-gray-400 flex-shrink-0 w-20 text-right">
                      {entry.size < 1024 ? `${entry.size} B` :
                        entry.size < 1024 * 1024 ? `${(entry.size / 1024).toFixed(1)} KB` :
                          `${(entry.size / 1024 / 1024).toFixed(1)} MB`}
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    {entry.isDir ? (
                      <button
                        onClick={() => setZipCurrentPath(entry.name)}
                        className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm"
                      >
                        開啟
                      </button>
                    ) : (
                      <>
                        {isTextFile && (
                          <button
                            onClick={() => handleViewZipFile(entry.name)}
                            className="px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white rounded text-sm flex items-center gap-1"
                          >
                            <Eye className="w-4 h-4" />
                            預覽
                          </button>
                        )}
                        <button
                          onClick={() => handleDownloadZipFile(entry.name)}
                          className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-sm flex items-center gap-1"
                        >
                          <Download className="w-4 h-4" />
                          下載
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        無法預覽此文件格式
      </div>
    );
  };

  const handleEditToggle = () => {
    if (!isEditing) {
      setEditedContent(txtContent);
    }
    setIsEditing(!isEditing);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      // Determine MIME type based on extension
      const mimeTypes: Record<string, string> = {
        'txt': 'text/plain', 'md': 'text/markdown', 'json': 'application/json',
        'xml': 'application/xml', 'html': 'text/html', 'htm': 'text/html',
        'css': 'text/css', 'js': 'application/javascript', 'jsx': 'application/javascript',
        'ts': 'application/typescript', 'tsx': 'application/typescript'
      };
      const mimeType = mimeTypes[ext] || 'text/plain';

      // Create a new file with edited content
      const blob = new Blob([editedContent], { type: mimeType });
      const file = new globalThis.File([blob], document.name || `edited.${ext}`, { type: blob.type });

      // Upload the new file directly to Appwrite (bypasses Next.js body limit)
      const uploadData = await uploadToAppwriteStorage(file);

      // Update the document with new file URL
      const url = addAppwriteConfigToUrl(`${API_ENDPOINTS.COMMONDOCUMENT}/${document.$id}`);
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...document,
          file: uploadData.url,
        }),
      });

      if (!response.ok) throw new Error('更新失敗');

      setTxtContent(editedContent);
      setIsEditing(false);
      alert('儲存成功！');
    } catch (error) {
      alert(error instanceof Error ? error.message : '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveImage = async (imageBlob: Blob, fileName: string) => {
    setSaving(true);
    try {
      const file = new globalThis.File([imageBlob], fileName, { type: imageBlob.type });
      // Upload directly to Appwrite (bypasses Next.js body limit)
      const uploadData = await uploadToAppwriteStorage(file);

      const url = addAppwriteConfigToUrl(`${API_ENDPOINTS.COMMONDOCUMENT}/${document.$id}`);
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...document,
          file: uploadData.url,
        }),
      });

      if (!response.ok) throw new Error('更新失敗');

      setIsEditingImage(false);
      alert('圖片儲存成功！');
      window.location.reload();
    } catch (error) {
      alert(error instanceof Error ? error.message : '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const canEdit = canEditFile(document.name || document.file || '', document.filetype);
  const canEditImage = ['jpg', 'jpeg', 'png', 'webp', 'bmp'].includes(ext);

  return (
    <>
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className={`bg-white dark:bg-gray-800 flex flex-col overflow-hidden ${isFullscreen
          ? 'w-full h-full rounded-none'
          : 'rounded-2xl w-full max-w-5xl h-[90vh]'
          }`}>
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-bold text-gray-900 dark:text-gray-100 truncate flex-1 mr-4">{document.name}</h2>
            <div className="flex items-center gap-2">
              {canEdit && (
                <>
                  {isEditing ? (
                    <>
                      <button
                        onClick={handleSaveEdit}
                        disabled={saving}
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                        <Download className="w-4 h-4" />
                        {saving ? '儲存中...' : '儲存'}
                      </button>
                      <button
                        onClick={handleEditToggle}
                        disabled={saving}
                        className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        取消
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleEditToggle}
                      className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      <Edit className="w-4 h-4" />
                      編輯
                    </button>
                  )}
                </>
              )}
              {ext === 'md' && !isEditing && (
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                  <button
                    onClick={() => setShowMarkdownPreview(false)}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${!showMarkdownPreview
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                      }`}
                  >
                    原始碼
                  </button>
                  <button
                    onClick={() => setShowMarkdownPreview(true)}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${showMarkdownPreview
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                      }`}
                  >
                    預覽
                  </button>
                </div>
              )}
              {canEditImage && !isEditingImage && (
                <button
                  onClick={() => setIsEditingImage(true)}
                  className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  編輯圖片
                </button>
              )}
              <a
                href={getAppwriteDownloadUrl(document.file)}
                download={document.name || "download"}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                下載
              </a>
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title={isFullscreen ? "退出全螢幕" : "全螢幕"}
              >
                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </button>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            {getPreviewContent()}
          </div>
        </div>
      </div>

      {isEditingImage && canEditImage && (
        <ImageEditor
          imageUrl={getProxiedMediaUrl(document.file)}
          onSave={handleSaveImage}
          onCancel={() => setIsEditingImage(false)}
          fileName={document.name || 'edited-image.png'}
        />
      )}
    </>
  );
}
