"use client";

import { useState, useMemo, useEffect } from "react";
import { FileText as DocumentIcon, Plus, Edit, Edit2, Trash2, X, Upload, Calendar, Search, Download, Eye, FileArchive, File, Maximize, Minimize, ExternalLink, HardDrive, Check } from "lucide-react";
import { useCommonDocument, CommonDocumentData } from "@/hooks/useCommonDocument";
import { useDocumentCache } from "@/hooks/useDocumentCache";
import { SectionHeader } from "@/components/ui/section-header";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { API_ENDPOINTS } from "@/lib/constants";
import { formatLocalDate } from "@/lib/formatters";
import { getAppwriteHeaders, getAppwriteDownloadUrl, getProxiedMediaUrl } from "@/lib/utils";
import { PlyrPlayer } from "@/components/ui/plyr-player";
import { CodeEditor } from "@/components/ui/code-editor";
import { PDFViewer } from "@/components/ui/pdf-viewer";
import { ImageEditor } from "@/components/ui/image-editor";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import JSZip from "jszip";

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
    'pdf', 'txt', 'md', 'json', 'xml', 'html', 'htm', 'css', 'js', 'ts', 'jsx', 'tsx',
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
  return ['txt', 'md', 'json', 'xml', 'html', 'htm', 'css', 'js', 'ts', 'jsx', 'tsx'].includes(ext);
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
  const [searchQuery, setSearchQuery] = useState("");
  const [previewDocument, setPreviewDocument] = useState<CommonDocumentData | null>(null);
  const [openInEditMode, setOpenInEditMode] = useState(false);
  const [importPreview, setImportPreview] = useState<{ data: DocumentFormData[]; errors: string[] } | null>(null);
    const [importing, setImporting] = useState(false);
    const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

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

  // CSV 匯出/匯入
  const CSV_HEADERS = ['name', 'category', 'note', 'ref'];
  const EXPECTED_COLUMN_COUNT = CSV_HEADERS.length;

  interface DocumentFormData {
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
    commondocument.forEach(item => {
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
    link.download = 'appwrite-CommonDocument.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

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
        const existing = commondocument.find(d => d.name === formData.name);
        const apiUrl = existing
          ? addAppwriteConfigToUrl(`${API_ENDPOINTS.COMMONDOCUMENT}/${existing.$id}`)
          : addAppwriteConfigToUrl(API_ENDPOINTS.COMMONDOCUMENT);
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
    await loadCommonDocument(true);
    
    setImporting(false);
    setImportProgress({ current: 0, total: 0 });
    setImportPreview(null);
    alert(`匯入完成！\n成功: ${successCount} 筆\n失敗: ${failCount} 筆`);
  };

  // 搜尋過濾
  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) return commondocument;
    const query = searchQuery.toLowerCase();
    return commondocument.filter(item => 
      item.name?.toLowerCase().includes(query) ||
      item.note?.toLowerCase().includes(query) ||
      item.category?.toLowerCase().includes(query)
    );
  }, [commondocument, searchQuery]);

  const handleAdd = () => {
    setEditingDocument(null);
    setShowFormModal(true);
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

  const handleFormSuccess = () => {
    setShowFormModal(false);
    setEditingDocument(null);
    loadCommonDocument(true);
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
    return (
      <div className="space-y-4 lg:space-y-6">
        <SectionHeader title="鋒兄文件" subtitle="文件管理" showAccountLabel={true} />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <SectionHeader
        title="鋒兄文件"
        subtitle="管理文件收藏，支援 PDF、Word、Excel、PowerPoint、TXT、MD、ZIP、影片"
        showAccountLabel={true}
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={() => document.getElementById('csv-import-document')?.click()} variant="outline" className="rounded-xl flex items-center gap-2" title="匯入 CSV">
              <Upload size={18} /> 匯入
            </Button>
            <input id="csv-import-document" type="file" accept=".csv" className="hidden" onChange={handleCsvFileSelect} />
            <Button onClick={exportToCSV} variant="outline" className="rounded-xl flex items-center gap-2" title="匯出 CSV">
              <Download size={18} /> 匯出
            </Button>
            <Button onClick={handleAdd} className="gap-2 bg-blue-500 hover:bg-blue-600 rounded-xl">
              <Plus size={16} />
              新增文件
            </Button>
          </div>
        }
      />

      {/* 統計卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="文件總數" value={stats.total} icon={DocumentIcon} />
        <StatCard title="已快取" value={cacheStats.cachedDocuments} icon={Check} />
        <StatCard title="快取大小" value={formatFileSize(cacheStats.totalSize)} icon={HardDrive} />
      </div>

      {/* 搜尋欄位 */}
      {commondocument.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            placeholder="搜尋文件名稱、備註、分類..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 rounded-xl"
          />
        </div>
      )}

      {/* 文件列表 */}
      {commondocument.length === 0 ? (
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.map((doc) => (
            <DocumentCard
              key={doc.$id}
              document={doc}
              onEdit={() => handleEdit(doc)}
              onDelete={() => handleDelete(doc)}
              onPreview={() => handlePreview(doc)}
              onEditContent={() => handleEditContent(doc)}
            />
          ))}
        </div>
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
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100 dark:bg-gray-700">
                          <th className="px-3 py-2 text-left">名稱</th>
                          <th className="px-3 py-2 text-left">分類</th>
                          <th className="px-3 py-2 text-left">備註</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.data.slice(0, 10).map((item, i) => (
                          <tr key={i} className="border-b border-gray-200 dark:border-gray-700">
                            <td className="px-3 py-2 font-medium">{item.name}</td>
                            <td className="px-3 py-2">{item.category || '-'}</td>
                            <td className="px-3 py-2 max-w-[200px] truncate">{item.note || '-'}</td>
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
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
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
}

function DocumentCard({ document, onEdit, onDelete, onPreview, onEditContent }: DocumentCardProps) {
  const fileInfo = getFileTypeInfo(document.name || document.file || '', document.filetype);
  const canPreview = document.file && canPreviewFile(document.name || document.file || '', document.filetype);
  const canEditContent = document.file && canEditFile(document.name || document.file || '', document.filetype);
  const { cacheStatus, downloadAndCacheDocument, checkDocumentCache } = useDocumentCache();
  const [isCached, setIsCached] = useState(false);

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

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 group border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-start gap-4">
        {/* 文件圖示 */}
        <div className={`w-14 h-14 flex-shrink-0 rounded-xl ${fileInfo.bgColor} flex items-center justify-center`}>
          {getFileExtension(document.name || document.file || '', document.filetype) === 'zip' ? (
            <FileArchive className={`w-7 h-7 ${fileInfo.color}`} />
          ) : (
            <DocumentIcon className={`w-7 h-7 ${fileInfo.color}`} />
          )}
        </div>

        {/* 資訊區 */}
        <div className="flex-1 min-w-0 space-y-1">
          <h3 className="font-bold text-base text-gray-900 dark:text-gray-100 truncate">{document.name}</h3>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full ${fileInfo.bgColor} ${fileInfo.color} font-medium`}>
              {fileInfo.label}
            </span>
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
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all duration-200 text-sm font-medium relative ${
                isCached || documentCacheStatus?.cached
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
          onClick={onEdit}
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [fileHash, setFileHash] = useState<string>('');
  const [duplicateWarning, setDuplicateWarning] = useState<string>('');
  const [useCategorySelect, setUseCategorySelect] = useState(true);

  const existingCategories = Array.from(new Set(existingDocuments.map(d => d.category).filter(Boolean)));

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
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('檔案大小不能超過 50MB');
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

    setUploadStatus('idle');
    setUploadProgress(0);
    setDuplicateWarning('');
    setSelectedFile(file);

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

    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    const progressInterval = setInterval(() => {
      setUploadProgress(prev => prev >= 90 ? prev : prev + 10);
    }, 200);

    try {
      const response = await fetch('/api/upload-music', {
        method: 'POST',
        headers: getAppwriteHeaders(),
        body: formDataUpload,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        let errorMessage = '上傳失敗';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch (parseError) {
          // If response is not JSON, use status text
          errorMessage = `${errorMessage} (${response.status}: ${response.statusText})`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setUploadStatus('success');
      return { url: data.url, fileId: data.fileId || '' };
    } catch (error) {
      clearInterval(progressInterval);
      setUploadStatus('error');
      throw error;
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

      if (selectedFile) {
        const uploadResult = await uploadFileToAppwrite(selectedFile);
        fileUrl = uploadResult.url;
      }

      const url = document
        ? addAppwriteConfigToUrl(`${API_ENDPOINTS.COMMONDOCUMENT}/${document.$id}`)
        : addAppwriteConfigToUrl(API_ENDPOINTS.COMMONDOCUMENT);
      
      const response = await fetch(url, {
        method: document ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          file: fileUrl,
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
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="w-10 h-10 mx-auto mb-3 text-gray-400" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedFile ? selectedFile.name : '點擊或拖曳上傳文件'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  支援 PDF, 文字檔, 程式碼, Office, 壓縮檔, 圖片, 影音 (最大 50MB)
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
            {formData.file && !selectedFile && (
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
  const [zipInstance, setZipInstance] = useState<JSZip | null>(null);
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
      const microsoftViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(document.file)}`;
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
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        officeViewerType === 'microsoft'
                          ? 'bg-white text-blue-500'
                          : 'bg-blue-400 text-white hover:bg-blue-300'
                      }`}
                    >
                      Microsoft
                    </button>
                    <button
                      onClick={() => setOfficeViewerType('google')}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        officeViewerType === 'google'
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
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {txtContent}
              </ReactMarkdown>
            </article>
          </div>
        );
      }

      // Show code editor for source view
      return (
        <div className="h-full overflow-hidden bg-gray-50 dark:bg-gray-900">
          <CodeEditor
            value={txtContent}
            onChange={() => {}}
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
                    <File className="w-5 h-5 text-blue-500 flex-shrink-0" />
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
      
      // Upload the new file
      const formData = new FormData();
      formData.append('file', file);
      
      const uploadResponse = await fetch('/api/upload-music', {
        method: 'POST',
        headers: getAppwriteHeaders(),
        body: formData,
      });
      
      if (!uploadResponse.ok) {
        throw new Error('上傳失敗');
      }
      
      const uploadData = await uploadResponse.json();
      
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
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await fetch('/api/upload-music', {
        method: 'POST',
        headers: getAppwriteHeaders(),
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('上傳失敗');
      }

      const uploadData = await uploadResponse.json();

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
        <div className={`bg-white dark:bg-gray-800 flex flex-col overflow-hidden ${
          isFullscreen
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
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    !showMarkdownPreview
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  原始碼
                </button>
                <button
                  onClick={() => setShowMarkdownPreview(true)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    showMarkdownPreview
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
