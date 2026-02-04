"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SectionHeader } from "@/components/ui/section-header";
import { FormCard, FormGrid, FormActions } from "@/components/ui/form-card";
import { DataCard, DataCardList, DataCardItem } from "@/components/ui/data-card";
import { EmptyState } from "@/components/ui/empty-state";
import { FullPageLoading } from "@/components/ui/loading-spinner";
import { StatCard } from "@/components/ui/stat-card";
import { useArticles } from "@/hooks/useArticles";
import { ArticleFormData, Article } from "@/types";
import { formatDate } from "@/lib/formatters";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlyrPlayer } from "@/components/ui/plyr-player";
import { getProxiedMediaUrl, getAppwriteDownloadUrl } from "@/lib/utils";
import { FileText, Link as LinkIcon, File, Copy, Check, ChevronDown, ChevronUp, Search, Plus, Minus, Folder, FileIcon, Download, Upload } from "lucide-react";
import JSZip from "jszip";

const INITIAL_FORM: ArticleFormData = {
  title: "",
  content: "",
  newDate: new Date().toISOString().split('T')[0],
  url1: "",
  url2: "",
  url3: "",
  file1: "",
  file1name: "",
  file1type: "",
  file2: "",
  file2name: "",
  file2type: "",
  file3: "",
  file3name: "",
  file3type: "",
};

// TXT 預覽元件 - 支援 UTF-8 編碼
function TxtPreview({ url, title }: { url: string; title: string }) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTxt = async () => {
      try {
        setLoading(true);
        const response = await fetch(url);
        if (!response.ok) throw new Error('無法讀取檔案');
        const text = await response.text();
        setContent(text);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : '讀取失敗');
      } finally {
        setLoading(false);
      }
    };
    fetchTxt();
  }, [url]);

  if (loading) {
    return <div className="w-full h-[300px] rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-500">載入中...</div>;
  }

  if (error) {
    return <div className="w-full h-[300px] rounded-lg border border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500">{error}</div>;
  }

  return (
    <pre className="w-full h-[300px] overflow-auto rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-3 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono">
      {content}
    </pre>
  );
}

// ZIP 預覽元件 - 顯示壓縮檔結構
interface ZipEntry {
  name: string;
  isDir: boolean;
  size: number;
}

function ZipPreview({ url, title }: { url: string; title: string }) {
  const [entries, setEntries] = useState<ZipEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchZip = async () => {
      try {
        setLoading(true);
        const response = await fetch(url);
        if (!response.ok) throw new Error('無法讀取檔案');
        const blob = await response.blob();
        const zip = await JSZip.loadAsync(blob);
        
        const fileEntries: ZipEntry[] = [];
        zip.forEach((relativePath, file) => {
          fileEntries.push({
            name: relativePath,
            isDir: file.dir,
            size: (file as any)._data?.uncompressedSize || 0,
          });
        });
        
        // 排序：資料夾在前，然後按名稱排序
        fileEntries.sort((a, b) => {
          if (a.isDir && !b.isDir) return -1;
          if (!a.isDir && b.isDir) return 1;
          return a.name.localeCompare(b.name);
        });
        
        setEntries(fileEntries);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : '讀取失敗');
      } finally {
        setLoading(false);
      }
    };
    fetchZip();
  }, [url]);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return <div className="w-full h-[300px] rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-500">載入中...</div>;
  }

  if (error) {
    return <div className="w-full h-[300px] rounded-lg border border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500">{error}</div>;
  }

  return (
    <div className="w-full h-[300px] overflow-auto rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2">
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 px-1">共 {entries.length} 個項目</div>
      <div className="space-y-0.5">
        {entries.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-sm">
            {entry.isDir ? (
              <Folder className="w-4 h-4 text-yellow-500 flex-shrink-0" />
            ) : (
              <FileIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
            )}
            <span className="flex-1 truncate text-gray-700 dark:text-gray-300">{entry.name}</span>
            {!entry.isDir && entry.size > 0 && (
              <span className="text-xs text-gray-400 flex-shrink-0">{formatSize(entry.size)}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function NotesManagement() {
  const { articles, loading, error, stats, createArticle, updateArticle, deleteArticle } = useArticles();
  const [form, setForm] = useState<ArticleFormData>(INITIAL_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ArticleFormData>(INITIAL_FORM);
  const [expandedArticles, setExpandedArticles] = useState<Set<string>>(new Set());
  const [previewFiles, setPreviewFiles] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isFormCollapsed, setIsFormCollapsed] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // CSV 匯入/匯出功能
  const [importPreview, setImportPreview] = useState<{data: ArticleFormData[], errors: string[]} | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const CSV_HEADERS = ['title', 'content', 'newDate', 'url1', 'url2', 'url3'];
  const EXPECTED_COLUMN_COUNT = CSV_HEADERS.length;
  
  // File upload states
  const [selectedFile1, setSelectedFile1] = useState<File | null>(null);
  const [selectedFile2, setSelectedFile2] = useState<File | null>(null);
  const [selectedFile3, setSelectedFile3] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  
  // Edit mode file upload states
  const [editSelectedFile1, setEditSelectedFile1] = useState<File | null>(null);
  const [editSelectedFile2, setEditSelectedFile2] = useState<File | null>(null);
  const [editSelectedFile3, setEditSelectedFile3] = useState<File | null>(null);
  const [editUploadingFile, setEditUploadingFile] = useState<number | null>(null);
  const [editUploadProgress, setEditUploadProgress] = useState<number>(0);

  // 取得已存在的不重複標題用於下拉選單
  const existingTitles = useMemo(() => {
    const titles = articles.map(a => a.title).filter(Boolean);
    return Array.from(new Set(titles)).sort();
  }, [articles]);

  // 搜尋過濾
  const filteredArticles = useMemo(() => {
    if (!searchQuery.trim()) return articles;
    const query = searchQuery.toLowerCase();
    return articles.filter(article => 
      article.title?.toLowerCase().includes(query) ||
      article.content?.toLowerCase().includes(query)
    );
  }, [articles, searchQuery]);

  // File upload handlers
  const handleFileSelect = (fileNumber: 1 | 2 | 3, file: File | null) => {
    if (!file) return;
    
    // Determine file type by MIME type and extension
    const fileName = file.name.toLowerCase();
    const ext = fileName.substring(fileName.lastIndexOf('.'));
    let fileType = 'other';
    
    if (file.type.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
      fileType = 'jpg';
    } else if (file.type.startsWith('video/') || ['.mp4', '.webm', '.mov', '.avi'].includes(ext)) {
      fileType = 'mp4';
    } else if (file.type.startsWith('audio/') || ['.mp3', '.wav', '.ogg', '.m4a'].includes(ext)) {
      fileType = 'mp3';
    } else if (file.type === 'application/pdf' || ext === '.pdf') {
      fileType = 'pdf';
    } else if (file.type === 'text/plain' || ext === '.txt') {
      fileType = 'txt';
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ext === '.docx') {
      fileType = 'docx';
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || ext === '.xlsx') {
      fileType = 'xlsx';
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || ext === '.pptx') {
      fileType = 'pptx';
    } else if (file.type === 'application/zip' || file.type === 'application/x-zip-compressed' || ext === '.zip') {
      fileType = 'zip';
    }
    
    if (fileNumber === 1) {
      setSelectedFile1(file);
      setForm({ ...form, file1name: file.name, [`file${fileNumber}type`]: fileType });
    } else if (fileNumber === 2) {
      setSelectedFile2(file);
      setForm({ ...form, file2name: file.name, [`file${fileNumber}type`]: fileType });
    } else {
      setSelectedFile3(file);
      setForm({ ...form, file3name: file.name, [`file${fileNumber}type`]: fileType });
    }
  };

  const handleEditFileSelect = (fileNumber: 1 | 2 | 3, file: File | null) => {
    if (!file) return;
    
    // Determine file type by MIME type and extension
    const fileName = file.name.toLowerCase();
    const ext = fileName.substring(fileName.lastIndexOf('.'));
    let fileType = 'other';
    
    if (file.type.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
      fileType = 'jpg';
    } else if (file.type.startsWith('video/') || ['.mp4', '.webm', '.mov', '.avi'].includes(ext)) {
      fileType = 'mp4';
    } else if (file.type.startsWith('audio/') || ['.mp3', '.wav', '.ogg', '.m4a'].includes(ext)) {
      fileType = 'mp3';
    } else if (file.type === 'application/pdf' || ext === '.pdf') {
      fileType = 'pdf';
    } else if (file.type === 'text/plain' || ext === '.txt') {
      fileType = 'txt';
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ext === '.docx') {
      fileType = 'docx';
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || ext === '.xlsx') {
      fileType = 'xlsx';
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || ext === '.pptx') {
      fileType = 'pptx';
    } else if (file.type === 'application/zip' || file.type === 'application/x-zip-compressed' || ext === '.zip') {
      fileType = 'zip';
    }
    
    if (fileNumber === 1) {
      setEditSelectedFile1(file);
      setEditForm({ ...editForm, file1name: file.name, [`file${fileNumber}type`]: fileType });
    } else if (fileNumber === 2) {
      setEditSelectedFile2(file);
      setEditForm({ ...editForm, file2name: file.name, [`file${fileNumber}type`]: fileType });
    } else {
      setEditSelectedFile3(file);
      setEditForm({ ...editForm, file3name: file.name, [`file${fileNumber}type`]: fileType });
    }
  };

  const uploadFile = async (file: File, endpoint: string, isEdit: boolean = false): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    const appwriteConfig = localStorage.getItem('appwriteConfig');
    const config = appwriteConfig ? JSON.parse(appwriteConfig) : {};
    const params = new URLSearchParams({
      _endpoint: config.endpoint || '',
      _project: config.projectId || '',
      _database: config.databaseId || '',
      _key: config.apiKey || '',
      _bucket: config.bucketId || '',
    });

    // Simulate upload progress
    const progressInterval = setInterval(() => {
      if (isEdit) {
        setEditUploadProgress(prev => Math.min(prev + 10, 90));
      } else {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }
    }, 200);

    try {
      const response = await fetch(`${endpoint}?${params}`, {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      
      if (!response.ok) {
        throw new Error('上傳失敗');
      }

      const data = await response.json();
      
      // Complete progress
      if (isEdit) {
        setEditUploadProgress(100);
      } else {
        setUploadProgress(100);
      }
      
      return data.url;
    } catch (error) {
      clearInterval(progressInterval);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formDataToSubmit = { ...form };

      // Upload files if selected
      if (selectedFile1) {
        setUploadingFile(1);
        setUploadProgress(0);
        const endpoint = ['jpg', 'image'].includes(form.file1type || '') ? '/api/upload-image' : 
                        ['mp4', 'video'].includes(form.file1type || '') ? '/api/upload-video' : 
                        '/api/upload-music'; // Use music endpoint for audio and documents
        formDataToSubmit.file1 = await uploadFile(selectedFile1, endpoint, false);
      }
      if (selectedFile2) {
        setUploadingFile(2);
        setUploadProgress(0);
        const endpoint = ['jpg', 'image'].includes(form.file2type || '') ? '/api/upload-image' : 
                        ['mp4', 'video'].includes(form.file2type || '') ? '/api/upload-video' : 
                        '/api/upload-music'; // Use music endpoint for audio and documents
        formDataToSubmit.file2 = await uploadFile(selectedFile2, endpoint, false);
      }
      if (selectedFile3) {
        setUploadingFile(3);
        setUploadProgress(0);
        const endpoint = ['jpg', 'image'].includes(form.file3type || '') ? '/api/upload-image' : 
                        ['mp4', 'video'].includes(form.file3type || '') ? '/api/upload-video' : 
                        '/api/upload-music'; // Use music endpoint for audio and documents
        formDataToSubmit.file3 = await uploadFile(selectedFile3, endpoint, false);
      }

      setUploadingFile(null);
      setUploadProgress(0);
      await createArticle(formDataToSubmit);
      resetForm();
      setIsFormCollapsed(true);
    } catch (error) {
      setUploadingFile(null);
      setUploadProgress(0);
      console.error("新增筆記失敗:", error);
      alert("操作失敗，請稍後再試");
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    try {
      const formDataToSubmit = { ...editForm };

      // Upload new files if selected
      if (editSelectedFile1) {
        setEditUploadingFile(1);
        setEditUploadProgress(0);
        const endpoint = ['jpg', 'image'].includes(editForm.file1type || '') ? '/api/upload-image' : 
                        ['mp4', 'video'].includes(editForm.file1type || '') ? '/api/upload-video' : 
                        '/api/upload-music';
        formDataToSubmit.file1 = await uploadFile(editSelectedFile1, endpoint, true);
      }
      if (editSelectedFile2) {
        setEditUploadingFile(2);
        setEditUploadProgress(0);
        const endpoint = ['jpg', 'image'].includes(editForm.file2type || '') ? '/api/upload-image' : 
                        ['mp4', 'video'].includes(editForm.file2type || '') ? '/api/upload-video' : 
                        '/api/upload-music';
        formDataToSubmit.file2 = await uploadFile(editSelectedFile2, endpoint, true);
      }
      if (editSelectedFile3) {
        setEditUploadingFile(3);
        setEditUploadProgress(0);
        const endpoint = ['jpg', 'image'].includes(editForm.file3type || '') ? '/api/upload-image' : 
                        ['mp4', 'video'].includes(editForm.file3type || '') ? '/api/upload-video' : 
                        '/api/upload-music';
        formDataToSubmit.file3 = await uploadFile(editSelectedFile3, endpoint, true);
      }

      setEditUploadingFile(null);
      setEditUploadProgress(0);
      await updateArticle(editingId, formDataToSubmit);
      setEditingId(null);
      setEditSelectedFile1(null);
      setEditSelectedFile2(null);
      setEditSelectedFile3(null);
    } catch (error) {
      setEditUploadingFile(null);
      setEditUploadProgress(0);
      console.error("編輯筆記失敗:", error);
      alert("更新失敗，請稍後再試");
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`確定刪除 ${title}？`)) return;
    try {
      await deleteArticle(id);
    } catch {
      alert("刪除失敗，請稍後再試");
    }
  };

  const handleEdit = (article: Article) => {
    setEditForm({
      title: article.title,
      content: article.content,
      newDate: formatDate(article.newDate),
      url1: article.url1 || "",
      url2: article.url2 || "",
      url3: article.url3 || "",
      file1: article.file1 || "",
      file1name: article.file1name || "",
      file1type: article.file1type || "",
      file2: article.file2 || "",
      file2name: article.file2name || "",
      file2type: article.file2type || "",
      file3: article.file3 || "",
      file3name: article.file3name || "",
      file3type: article.file3type || "",
    });
    setEditingId(article.$id);
    setEditSelectedFile1(null);
    setEditSelectedFile2(null);
    setEditSelectedFile3(null);
  };

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setSelectedFile1(null);
    setSelectedFile2(null);
    setSelectedFile3(null);
    setUploadingFile(null);
  };

  const resetEditForm = () => {
    setEditingId(null);
    setEditForm(INITIAL_FORM);
  };

  const toggleExpanded = (id: string) => {
    setExpandedArticles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const togglePreview = (fileKey: string) => {
    setPreviewFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileKey)) {
        newSet.delete(fileKey);
      } else {
        newSet.add(fileKey);
      }
      return newSet;
    });
  };

  const handleCopyContent = async (content: string, id: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("複製失敗:", err);
      alert("複製失敗，請再試一次");
    }
  };

  // CSV Export function
  const exportToCSV = () => {
    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`;
      return str;
    };
    const rows = [CSV_HEADERS.join(',')];
    articles.forEach(item => {
      rows.push([
        escapeCSV(item.title),
        escapeCSV(item.content || ''),
        escapeCSV(formatDate(item.newDate) || ''),
        escapeCSV(item.url1 || ''),
        escapeCSV(item.url2 || ''),
        escapeCSV(item.url3 || '')
      ].join(','));
    });
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `appwrite-Notes-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // RFC 4180 compliant CSV parser
  const parseCSV = (text: string): {data: ArticleFormData[], errors: string[]} => {
    const errors: string[] = [];
    const data: ArticleFormData[] = [];
    const cleanText = text.replace(/^\uFEFF/, '');
    
    // Parse CSV properly handling multi-line quoted fields
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;
    
    for (let i = 0; i < cleanText.length; i++) {
      const char = cleanText[i];
      const nextChar = cleanText[i + 1];
      
      if (inQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            currentField += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          currentField += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          currentRow.push(currentField);
          currentField = '';
        } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
          currentRow.push(currentField);
          currentField = '';
          if (currentRow.length > 0 && currentRow.some(f => f.trim())) {
            rows.push(currentRow);
          }
          currentRow = [];
          if (char === '\r') i++;
        } else if (char !== '\r') {
          currentField += char;
        }
      }
    }
    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField);
      if (currentRow.some(f => f.trim())) {
        rows.push(currentRow);
      }
    }
    
    if (rows.length < 2) {
      errors.push('CSV 檔案至少需要表頭和一行資料');
      return { data, errors };
    }
    
    const headerValues = rows[0];
    if (headerValues.length !== EXPECTED_COLUMN_COUNT) {
      errors.push(`表頭欄位數量錯誤: 預期 ${EXPECTED_COLUMN_COUNT} 欄，實際 ${headerValues.length} 欄`);
      return { data, errors };
    }
    for (let i = 0; i < CSV_HEADERS.length; i++) {
      if (headerValues[i]?.trim() !== CSV_HEADERS[i]) {
        errors.push(`表頭第 ${i + 1} 欄錯誤: 預期 "${CSV_HEADERS[i]}"，實際 "${headerValues[i]?.trim()}"`);
        if (errors.length >= 5) { errors.push('...更多錯誤已省略'); break; }
      }
    }
    if (errors.length > 0) return { data, errors };
    
    for (let i = 1; i < rows.length; i++) {
      const values = rows[i];
      const lineNum = i + 1;
      if (values.length !== EXPECTED_COLUMN_COUNT) {
        errors.push(`第 ${lineNum} 行: 欄位數量錯誤 (預期 ${EXPECTED_COLUMN_COUNT} 欄，實際 ${values.length} 欄)`);
        continue;
      }
      if (!values[0]?.trim()) {
        errors.push(`第 ${lineNum} 行: title 欄位不能為空`);
        continue;
      }
      data.push({
        title: values[0].trim(),
        content: values[1]?.trim() || '',
        newDate: values[2]?.trim() || new Date().toISOString().split('T')[0],
        url1: values[3]?.trim() || '',
        url2: values[4]?.trim() || '',
        url3: values[5]?.trim() || '',
        file1: '',
        file1name: '',
        file1type: '',
        file2: '',
        file2name: '',
        file2type: '',
        file3: '',
        file3name: '',
        file3type: ''
      });
    }
    return { data, errors };
  };

  const handleCsvFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      alert('請選擇 CSV 檔案');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setImportPreview(parseCSV(event.target?.result as string));
    };
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
        // 查找是否已存在相同 title 的記錄
        const existing = articles.find(a => a.title === formData.title);
        
        if (existing) {
          // 更新現有記錄
          const success = await updateArticle(existing.$id, formData);
          if (success) successCount++;
          else failCount++;
        } else {
          // 建立新記錄
          const success = await createArticle(formData);
          if (success) successCount++;
          else failCount++;
        }
      } catch {
        failCount++;
      }
    }
    
    setImporting(false);
    setImportProgress({ current: 0, total: 0 });
    setImportPreview(null);
    alert(`匯入完成！
成功: ${successCount} 筆
失敗: ${failCount} 筆

注意：檔案附件需要另行上傳`);
  };

  if (loading) return <FullPageLoading text="載入筆記資料中..." />;

  return (
    <div className="space-y-4 lg:space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <SectionHeader
        title="鋒兄筆記"
        subtitle={`共 ${stats.total} 篇筆記`}
        showAccountLabel={true}
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={() => document.getElementById('csv-import-notes')?.click()} variant="outline" className="rounded-xl flex items-center gap-2 h-12" title="匯入 CSV">
              <Upload size={18} /> 匯入
            </Button>
            <input id="csv-import-notes" type="file" accept=".csv" className="hidden" onChange={handleCsvFileSelect} />
            <Button onClick={exportToCSV} variant="outline" className="rounded-xl flex items-center gap-2 h-12" title="匯出 CSV">
              <Download size={18} /> 匯出
            </Button>
            <StatCard title="筆記總數" value={stats.total} gradient="from-blue-500 to-blue-600" className="min-w-[160px]" />
          </div>
        }
      />

      <FormCard 
        title={
          <div className="flex items-center justify-between w-full border-l-4 border-purple-500 pl-4 py-2">
            <h2 className="text-lg font-bold bg-gradient-to-r from-purple-500 to-purple-600 bg-clip-text text-transparent">
              新增筆記
            </h2>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setIsFormCollapsed(!isFormCollapsed)}
              className="h-8 px-2 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20"
            >
              {isFormCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
            </Button>
          </div>
        }
        accentColor="from-purple-500 to-purple-600"
      >
        {!isFormCollapsed && (
          <form onSubmit={handleSubmit} className="space-y-4">
          <FormGrid>
            <div className="space-y-1 col-span-2">
              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <Input
                    placeholder="筆記標題 / Note Title"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    required
                    className="h-12 rounded-xl w-full"
                  />
                  <div className="px-1 h-4">
                    {form.title ? (
                      <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">已輸入 / Entered</span>
                    ) : (
                      <span className="text-[10px] text-orange-600 dark:text-orange-400 font-medium">請輸入標題 / Please enter title</span>
                    )}
                  </div>
                </div>
                {existingTitles.length > 0 && (
                  <Select value="" onValueChange={(val) => val && setForm({ ...form, title: val })}>
                    <SelectTrigger className="h-12 w-12 rounded-xl px-0 justify-center">
                      <ChevronDown className="h-4 w-4" />
                    </SelectTrigger>
                    <SelectContent>
                      {existingTitles.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex gap-1 items-center">
                <Input
                  placeholder="日期 / Date"
                  type="date"
                  value={form.newDate}
                  onChange={(e) => setForm({ ...form, newDate: e.target.value })}
                  className="h-12 rounded-xl flex-1"
                />
                {form.newDate && (
                  <div className="flex flex-col gap-0.5">
                    <button 
                      type="button"
                      onClick={() => {
                        const d = new Date(form.newDate);
                        d.setDate(d.getDate() + 7);
                        setForm({ ...form, newDate: d.toISOString().split('T')[0] });
                      }}
                      className="p-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 rounded transition-colors"
                      title="+7天"
                    >
                      <Plus size={14} />
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        const d = new Date(form.newDate);
                        d.setDate(d.getDate() - 7);
                        setForm({ ...form, newDate: d.toISOString().split('T')[0] });
                      }}
                      className="p-1 hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-600 rounded transition-colors"
                      title="-7天"
                    >
                      <Minus size={14} />
                    </button>
                  </div>
                )}
              </div>
              <div className="px-1 h-4">
                {form.newDate ? (
                  <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">可以 + 或 - (7天) / Can use + or - (7 Days)</span>
                ) : (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請選擇日期 / (Optional) Please select a date</span>
                )}
              </div>
            </div>
          </FormGrid>
          
          <div className="space-y-1">
            <Textarea
              placeholder="筆記內容 (上限 1000 字) / Note Content (Max 1000 chars)"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              className="min-h-[200px] rounded-xl w-full"
              maxLength={1000}
            />
            <div className="px-1 h-4">
              {form.content ? (
                <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">已輸入 / Entered</span>
              ) : (
                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請輸入內容 / (Optional) Please enter content</span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">相關連結（選填） / Related Links (Optional)</label>
            <div className="space-y-3">
              <div className="space-y-1">
                <Input
                  placeholder="URL 1"
                  type="url"
                  value={form.url1}
                  onChange={(e) => setForm({ ...form, url1: e.target.value })}
                  className="h-12 rounded-xl w-full"
                />
                <div className="px-1 h-4">
                  {form.url1 ? (
                    <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">已輸入 / Entered</span>
                  ) : (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請輸入 URL / (Optional) Please enter URL</span>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <Input
                  placeholder="URL 2"
                  type="url"
                  value={form.url2}
                  onChange={(e) => setForm({ ...form, url2: e.target.value })}
                  className="h-12 rounded-xl w-full"
                />
                <div className="px-1 h-4">
                  {form.url2 ? (
                    <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">已輸入 / Entered</span>
                  ) : (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請輸入 URL / (Optional) Please enter URL</span>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <Input
                  placeholder="URL 3"
                  type="url"
                  value={form.url3}
                  onChange={(e) => setForm({ ...form, url3: e.target.value })}
                  className="h-12 rounded-xl w-full"
                />
                <div className="px-1 h-4">
                  {form.url3 ? (
                    <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">已輸入 / Entered</span>
                  ) : (
                    <span className="text-[10px] text-orange-600 dark:text-orange-400 font-medium">請輸入 URL / Please enter URL</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">上傳檔案（選填）</label>
            <div className="space-y-3">
              <div className="space-y-1">
                <Input
                  type="file"
                  accept="image/*,video/*,audio/*,.pdf,.txt,.docx,.xlsx,.pptx,.zip"
                  onChange={(e) => handleFileSelect(1, e.target.files?.[0] || null)}
                  disabled={uploadingFile !== null}
                  className="h-12 rounded-xl"
                />
                {selectedFile1 && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">已選擇: {selectedFile1.name}</p>}
                <Input
                  placeholder="檔案名稱 / File name (選填)"
                  value={form.file1name || ""}
                  onChange={(e) => setForm({ ...form, file1name: e.target.value })}
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <Input
                  type="file"
                  accept="image/*,video/*,audio/*,.pdf,.txt,.docx,.xlsx,.pptx,.zip"
                  onChange={(e) => handleFileSelect(2, e.target.files?.[0] || null)}
                  disabled={uploadingFile !== null}
                  className="h-12 rounded-xl"
                />
                {selectedFile2 && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">已選擇: {selectedFile2.name}</p>}
                <Input
                  placeholder="檔案名稱 / File name (選填)"
                  value={form.file2name || ""}
                  onChange={(e) => setForm({ ...form, file2name: e.target.value })}
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <Input
                  type="file"
                  accept="image/*,video/*,audio/*,.pdf,.txt,.docx,.xlsx,.pptx,.zip"
                  onChange={(e) => handleFileSelect(3, e.target.files?.[0] || null)}
                  disabled={uploadingFile !== null}
                  className="h-12 rounded-xl"
                />
                {selectedFile3 && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">已選擇: {selectedFile3.name}</p>}
                <Input
                  placeholder="檔案名稱 / File name (選填)"
                  value={form.file3name || ""}
                  onChange={(e) => setForm({ ...form, file3name: e.target.value })}
                  className="h-10 rounded-xl"
                />
              </div>
            </div>
            {uploadingFile && (
              <div className="space-y-2">
                <p className="text-sm text-purple-600 dark:text-purple-400">正在上傳檔案 {uploadingFile}...</p>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                  <div 
                    className="bg-purple-600 h-2.5 rounded-full transition-all duration-300" 
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{uploadProgress}%</p>
              </div>
            )}
          </div>

          <FormActions>
            <Button type="submit" className="h-12 px-6 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 rounded-xl font-medium shadow-lg shadow-purple-500/25">
              新增筆記
            </Button>
            {!isFormCollapsed && <Button type="button" variant="outline" onClick={() => setIsFormCollapsed(true)} className="h-12 px-6 rounded-xl">關閉</Button>}
          </FormActions>
        </form>
        )}
      </FormCard>

      {/* CSV 匯入預覽對話框 */}
      {importPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">CSV 匯入預覽</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {importPreview.errors.length > 0 ? '發現錯誤，請修正後重試' : `準備匯入 ${importPreview.data.length} 筆資料`}
              </p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {importPreview.errors.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="font-semibold text-red-600 dark:text-red-400">錯誤訊息：</h3>
                  {importPreview.errors.map((err, idx) => (
                    <div key={idx} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
                      {err}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <p>• 如果標題已存在，將會更新該筆記</p>
                    <p>• 如果標題不存在，將會建立新筆記</p>
                    <p>• 檔案附件需要在匯入後另行上傳</p>
                  </div>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <div className="max-h-96 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">#</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">標題</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">內容</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">日期</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {importPreview.data.map((item, idx) => (
                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                              <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{idx + 1}</td>
                              <td className="px-3 py-2 text-gray-900 dark:text-gray-100 font-medium">{item.title}</td>
                              <td className="px-3 py-2 text-gray-600 dark:text-gray-400 max-w-xs truncate">{item.content || '-'}</td>
                              <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{item.newDate}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
              
              {importing && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm text-purple-600 dark:text-purple-400">正在匯入中... ({importProgress.current}/{importProgress.total})</p>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div 
                      className="bg-purple-600 h-2.5 rounded-full transition-all duration-300" 
                      style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <Button 
                onClick={() => setImportPreview(null)} 
                variant="outline" 
                className="rounded-xl"
                disabled={importing}
              >
                取消
              </Button>
              {importPreview.errors.length === 0 && (
                <Button 
                  onClick={executeImport} 
                  className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl"
                  disabled={importing}
                >
                  {importing ? '匯入中...' : '確認匯入'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 搜尋欄位 */}
      {articles.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            placeholder="搜尋標題、內容..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 rounded-xl"
          />
        </div>
      )}

      <DataCard>
        {articles.length === 0 ? (
          <EmptyState emoji="📝" title="暫無筆記資料" description="點擊上方表單新增第一篇筆記" />
        ) : filteredArticles.length === 0 ? (
          <EmptyState emoji="🔍" title="無搜尋結果" description={`找不到「${searchQuery}」相關的筆記`} />
        ) : (
          <DataCardList>
            {filteredArticles.map((article) => {
              const isEditing = editingId === article.$id;
              const isExpanded = expandedArticles.has(article.$id);
              const hasUrls = article.url1 || article.url2 || article.url3;
              
              return (
                <DataCardItem key={article.$id} className={isEditing ? "ring-2 ring-purple-500" : ""}>
                  {isEditing ? (
                    <form onSubmit={handleUpdate} className="space-y-4 p-2">
                      <div className="flex items-center gap-3 mb-2 border-l-4 border-purple-500 pl-3">
                        <FileText className="text-purple-600" size={20} />
                        <h3 className="font-bold text-gray-900 dark:text-gray-100">編輯筆記</h3>
                      </div>
                      
                      <FormGrid columns={2}>
                        <Input
                          placeholder="筆記標題"
                          value={editForm.title}
                          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          required
                          className="h-10 rounded-lg"
                        />
                        <Input
                          placeholder="日期"
                          type="date"
                          value={editForm.newDate}
                          onChange={(e) => setEditForm({ ...editForm, newDate: e.target.value })}
                          required
                          className="h-10 rounded-lg"
                        />
                      </FormGrid>
                      
                      <Textarea
                        placeholder="筆記內容 (上限 1000 字)"
                        value={editForm.content}
                        onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                        className="min-h-[150px] rounded-lg text-sm"
                        maxLength={1000}
                      />

                      <div className="grid grid-cols-1 gap-2">
                        <Input placeholder="URL 1" type="url" value={editForm.url1} onChange={(e) => setEditForm({ ...editForm, url1: e.target.value })} className="h-9 rounded-lg text-xs" />
                        <Input placeholder="URL 2" type="url" value={editForm.url2} onChange={(e) => setEditForm({ ...editForm, url2: e.target.value })} className="h-9 rounded-lg text-xs" />
                        <Input placeholder="URL 3" type="url" value={editForm.url3} onChange={(e) => setEditForm({ ...editForm, url3: e.target.value })} className="h-9 rounded-lg text-xs" />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">上傳新檔案（選填）</label>
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <Input
                              type="file"
                              accept="image/*,video/*,audio/*,.pdf,.txt,.docx,.xlsx,.pptx,.zip"
                              onChange={(e) => handleEditFileSelect(1, e.target.files?.[0] || null)}
                              disabled={editUploadingFile !== null}
                              className="h-9 rounded-lg text-xs"
                            />
                            {editSelectedFile1 ? (
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">已選擇: {editSelectedFile1.name}</p>
                            ) : editForm.file1 ? (
                              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">現有: {editForm.file1type === 'image' ? '🖼️' : editForm.file1type === 'video' ? '🎥' : editForm.file1type === 'audio' ? '🎵' : '📄'} 檔案 1</p>
                            ) : null}
                            <Input
                              placeholder="檔案名稱 / File name (選填)"
                              value={editForm.file1name || ""}
                              onChange={(e) => setEditForm({ ...editForm, file1name: e.target.value })}
                              className="h-8 rounded-lg text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Input
                              type="file"
                              accept="image/*,video/*,audio/*,.pdf,.txt,.docx,.xlsx,.pptx,.zip"
                              onChange={(e) => handleEditFileSelect(2, e.target.files?.[0] || null)}
                              disabled={editUploadingFile !== null}
                              className="h-9 rounded-lg text-xs"
                            />
                            {editSelectedFile2 ? (
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">已選擇: {editSelectedFile2.name}</p>
                            ) : editForm.file2 ? (
                              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">現有: {editForm.file2type === 'image' ? '🖼️' : editForm.file2type === 'video' ? '🎥' : editForm.file2type === 'audio' ? '🎵' : '📄'} 檔案 2</p>
                            ) : null}
                            <Input
                              placeholder="檔案名稱 / File name (選填)"
                              value={editForm.file2name || ""}
                              onChange={(e) => setEditForm({ ...editForm, file2name: e.target.value })}
                              className="h-8 rounded-lg text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Input
                              type="file"
                              accept="image/*,video/*,audio/*,.pdf,.txt,.docx,.xlsx,.pptx,.zip"
                              onChange={(e) => handleEditFileSelect(3, e.target.files?.[0] || null)}
                              disabled={editUploadingFile !== null}
                              className="h-9 rounded-lg text-xs"
                            />
                            {editSelectedFile3 ? (
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">已選擇: {editSelectedFile3.name}</p>
                            ) : editForm.file3 ? (
                              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">現有: {editForm.file3type === 'image' ? '🖼️' : editForm.file3type === 'video' ? '🎥' : editForm.file3type === 'audio' ? '🎵' : '📄'} 檔案 3</p>
                            ) : null}
                            <Input
                              placeholder="檔案名稱 / File name (選填)"
                              value={editForm.file3name || ""}
                              onChange={(e) => setEditForm({ ...editForm, file3name: e.target.value })}
                              className="h-8 rounded-lg text-xs"
                            />
                          </div>
                        </div>
                        {editUploadingFile && (
                          <div className="space-y-1">
                            <p className="text-xs text-purple-600 dark:text-purple-400">正在上傳檔案 {editUploadingFile}...</p>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div 
                                className="bg-purple-600 h-2 rounded-full transition-all duration-300" 
                                style={{ width: `${editUploadProgress}%` }}
                              ></div>
                            </div>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">{editUploadProgress}%</p>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 justify-end pt-2">
                        <Button type="button" variant="outline" size="sm" onClick={resetEditForm} className="rounded-lg h-9 px-4">取消</Button>
                        <Button type="submit" size="sm" className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg h-9 px-4">更新</Button>
                        <Button type="button" variant="destructive" size="sm" onClick={() => handleDelete(article.$id, article.title)} className="rounded-lg h-9 px-4 ml-auto">刪除</Button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="text-purple-600 dark:text-purple-400" size={20} />
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{article.title}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCopyContent(article.content, article.$id)}
                            className="h-8 px-2 rounded-lg"
                            title="複製內容"
                          >
                            {copiedId === article.$id ? (
                              <Check className="text-green-600 dark:text-green-400" size={16} />
                            ) : (
                              <Copy className="text-gray-600 dark:text-gray-400" size={16} />
                            )}
                          </Button>
                          <span className="text-sm text-gray-500 dark:text-gray-400">{formatDate(article.newDate)}</span>
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        {isExpanded ? (
                          <p className="whitespace-pre-wrap">{article.content}</p>
                        ) : (
                          <p className="line-clamp-5 whitespace-pre-wrap">{article.content}</p>
                        )}
                      </div>

                      {article.content.length > 100 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleExpanded(article.$id)}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                        >
                          {isExpanded ? "收起" : "展開全文"}
                        </Button>
                      )}

                      {hasUrls && (
                        <div className="space-y-1 pt-2 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                            <LinkIcon size={16} />
                            <span>相關連結</span>
                          </div>
                          {article.url1 && (
                            <a href={article.url1} target="_blank" rel="noreferrer" className="block text-sm text-blue-600 dark:text-blue-400 hover:underline truncate">
                              {article.url1}
                            </a>
                          )}
                          {article.url2 && (
                            <a href={article.url2} target="_blank" rel="noreferrer" className="block text-sm text-blue-600 dark:text-blue-400 hover:underline truncate">
                              {article.url2}
                            </a>
                          )}
                          {article.url3 && (
                            <a href={article.url3} target="_blank" rel="noreferrer" className="block text-sm text-blue-600 dark:text-blue-400 hover:underline truncate">
                              {article.url3}
                            </a>
                          )}
                        </div>
                      )}

                      {(article.file1 || article.file2 || article.file3) && (
                        <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                            <File size={16} />
                            <span>附件</span>
                          </div>
                          <div className="flex gap-4 flex-wrap items-start">
                          {article.file1 && (
                            <div className="space-y-1 flex-shrink-0">
                              <div className="flex items-center gap-2">
                                <a 
                                  href={getAppwriteDownloadUrl(article.file1)} 
                                  download={article.file1name || "download"}
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="text-sm text-green-600 dark:text-green-400 hover:underline"
                                >
                                  {article.file1type === 'jpg' ? '🖼️' : article.file1type === 'mp4' ? '🎥' : article.file1type === 'mp3' ? '🎵' : article.file1type === 'pdf' ? '📄' : article.file1type === 'txt' ? '📄' : article.file1type === 'docx' ? '📄' : article.file1type === 'xlsx' ? '📊' : article.file1type === 'pptx' ? '📽️' : article.file1type === 'zip' ? '🗂️' : '📄'} {article.file1name || '檔案 1'}
                                </a>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => togglePreview(`${article.$id}-file1`)}
                                  className="h-6 px-2 text-xs"
                                >
                                  {previewFiles.has(`${article.$id}-file1`) ? '收起' : '預覽'}
                                </Button>
                              </div>
                              {previewFiles.has(`${article.$id}-file1`) && (
                                <>
                                  {article.file1type === 'jpg' && (
                                    <img src={article.file1} alt={article.file1name || '檔案 1'} className="max-w-[150px] rounded-lg border border-gray-300 dark:border-gray-600" />
                                  )}
                                  {article.file1type === 'mp4' && (
                                    <PlyrPlayer type="video" src={getProxiedMediaUrl(article.file1)} className="max-w-[300px] rounded-lg" />
                                  )}
                                  {article.file1type === 'mp3' && (
                                    <PlyrPlayer type="audio" src={getProxiedMediaUrl(article.file1)} className="max-w-[300px]" />
                                  )}
                                  {article.file1type === 'pdf' && (
                                    <iframe src={article.file1} className="w-full h-[400px] rounded-lg border border-gray-300 dark:border-gray-600" title={article.file1name || '檔案 1'}></iframe>
                                  )}
                                  {article.file1type === 'txt' && (
                                    <TxtPreview url={article.file1} title={article.file1name || '檔案 1'} />
                                  )}
                                  {(article.file1type === 'xlsx' || article.file1type === 'pptx' || article.file1type === 'docx') && (
                                    <iframe src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(article.file1)}`} className="w-full h-[400px] rounded-lg border border-gray-300 dark:border-gray-600" title={article.file1name || '檔案 1'}></iframe>
                                  )}
                                  {article.file1type === 'zip' && (
                                    <ZipPreview url={article.file1} title={article.file1name || '檔案 1'} />
                                  )}
                                </>
                              )}
                            </div>
                          )}
                          {article.file2 && (
                            <div className="space-y-1 flex-shrink-0">
                              <div className="flex items-center gap-2">
                                <a 
                                  href={getAppwriteDownloadUrl(article.file2)} 
                                  download={article.file2name || "download"}
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="text-sm text-green-600 dark:text-green-400 hover:underline"
                                >
                                  {article.file2type === 'jpg' ? '🖼️' : article.file2type === 'mp4' ? '🎥' : article.file2type === 'mp3' ? '🎵' : article.file2type === 'pdf' ? '📄' : article.file2type === 'txt' ? '📄' : article.file2type === 'docx' ? '📄' : article.file2type === 'xlsx' ? '📊' : article.file2type === 'pptx' ? '📽️' : article.file2type === 'zip' ? '🗂️' : '📄'} {article.file2name || '檔案 2'}
                                </a>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => togglePreview(`${article.$id}-file2`)}
                                  className="h-6 px-2 text-xs"
                                >
                                  {previewFiles.has(`${article.$id}-file2`) ? '收起' : '預覽'}
                                </Button>
                              </div>
                              {previewFiles.has(`${article.$id}-file2`) && (
                                <>
                                  {article.file2type === 'jpg' && (
                                    <img src={article.file2} alt={article.file2name || '檔案 2'} className="max-w-[150px] rounded-lg border border-gray-300 dark:border-gray-600" />
                                  )}
                                  {article.file2type === 'mp4' && (
                                    <PlyrPlayer type="video" src={getProxiedMediaUrl(article.file2)} className="max-w-[300px] rounded-lg" />
                                  )}
                                  {article.file2type === 'mp3' && (
                                    <PlyrPlayer type="audio" src={getProxiedMediaUrl(article.file2)} className="max-w-[300px]" />
                                  )}
                                  {article.file2type === 'pdf' && (
                                    <iframe src={article.file2} className="w-full h-[400px] rounded-lg border border-gray-300 dark:border-gray-600" title={article.file2name || '檔案 2'}></iframe>
                                  )}
                                  {article.file2type === 'txt' && (
                                    <TxtPreview url={article.file2} title={article.file2name || '檔案 2'} />
                                  )}
                                  {(article.file2type === 'xlsx' || article.file2type === 'pptx' || article.file2type === 'docx') && (
                                    <iframe src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(article.file2)}`} className="w-full h-[400px] rounded-lg border border-gray-300 dark:border-gray-600" title={article.file2name || '檔案 2'}></iframe>
                                  )}
                                  {article.file2type === 'zip' && (
                                    <ZipPreview url={article.file2} title={article.file2name || '檔案 2'} />
                                  )}
                                </>
                              )}
                            </div>
                          )}
                          {article.file3 && (
                            <div className="space-y-1 flex-shrink-0">
                              <div className="flex items-center gap-2">
                                <a 
                                  href={getAppwriteDownloadUrl(article.file3)} 
                                  download={article.file3name || "download"}
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="text-sm text-green-600 dark:text-green-400 hover:underline"
                                >
                                  {article.file3type === 'jpg' ? '🖼️' : article.file3type === 'mp4' ? '🎥' : article.file3type === 'mp3' ? '🎵' : article.file3type === 'pdf' ? '📄' : article.file3type === 'txt' ? '📄' : article.file3type === 'docx' ? '📄' : article.file3type === 'xlsx' ? '📊' : article.file3type === 'pptx' ? '📽️' : article.file3type === 'zip' ? '🗂️' : '📄'} {article.file3name || '檔案 3'}
                                </a>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => togglePreview(`${article.$id}-file3`)}
                                  className="h-6 px-2 text-xs"
                                >
                                  {previewFiles.has(`${article.$id}-file3`) ? '收起' : '預覽'}
                                </Button>
                              </div>
                              {previewFiles.has(`${article.$id}-file3`) && (
                                <>
                                  {article.file3type === 'jpg' && (
                                    <img src={article.file3} alt={article.file3name || '檔案 3'} className="max-w-[150px] rounded-lg border border-gray-300 dark:border-gray-600" />
                                  )}
                                  {article.file3type === 'mp4' && (
                                    <PlyrPlayer type="video" src={getProxiedMediaUrl(article.file3)} className="max-w-[300px] rounded-lg" />
                                  )}
                                  {article.file3type === 'mp3' && (
                                    <PlyrPlayer type="audio" src={getProxiedMediaUrl(article.file3)} className="max-w-[300px]" />
                                  )}
                                  {article.file3type === 'pdf' && (
                                    <iframe src={article.file3} className="w-full h-[400px] rounded-lg border border-gray-300 dark:border-gray-600" title={article.file3name || '檔案 3'}></iframe>
                                  )}
                                  {article.file3type === 'txt' && (
                                    <TxtPreview url={article.file3} title={article.file3name || '檔案 3'} />
                                  )}
                                  {(article.file3type === 'xlsx' || article.file3type === 'pptx' || article.file3type === 'docx') && (
                                    <iframe src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(article.file3)}`} className="w-full h-[400px] rounded-lg border border-gray-300 dark:border-gray-600" title={article.file3name || '檔案 3'}></iframe>
                                  )}
                                  {article.file3type === 'zip' && (
                                    <ZipPreview url={article.file3} title={article.file3name || '檔案 3'} />
                                  )}
                                </>
                              )}
                            </div>
                          )}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => handleEdit(article)} className="flex-1 rounded-xl">編輯</Button>
                      </div>
                    </div>
                  )}
                </DataCardItem>
              );
            })}
          </DataCardList>
        )}
      </DataCard>
    </div>
  );
}
