"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SectionHeader } from "@/components/ui/section-header";
import { FormCard, FormGrid, FormActions } from "@/components/ui/form-card";
import { DataCard } from "@/components/ui/data-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FullPageLoading } from "@/components/ui/loading-spinner";
import { StatCard } from "@/components/ui/stat-card";
import { useArticles } from "@/hooks/useArticles";
import { fetchApi } from "@/hooks/useApi";
import { ArticleFormData, Article } from "@/types";
import { API_ENDPOINTS } from "@/lib/constants";
import { formatDate } from "@/lib/formatters";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlyrPlayer } from "@/components/ui/plyr-player";
import { getProxiedMediaUrl, getAppwriteDownloadUrl, cn } from "@/lib/utils";
import { uploadToAppwriteStorage } from "@/lib/appwriteStorage";
import {
  getOriginalMultipartFiletype,
  isMultipartFiletype,
  MULTIPART_UPLOAD_THRESHOLD,
  resolveMultipartFileBlob,
  uploadFileInParts,
} from "@/lib/fileMultipart";
import { FileText, Link as LinkIcon, File, Copy, Check, ChevronDown, Search, Plus, Minus, Folder, FileIcon, Download, Upload, Archive, Trash2, Sparkles, Pin, PinOff, Clock3, FolderOpen, BrainCircuit, RefreshCw, LayoutGrid, List } from "lucide-react";
import JSZip from "jszip";
import { FaviconImage } from "@/components/ui/favicon-image";

function getTodayInputDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offset).toISOString().split("T")[0];
}

function createInitialForm(): ArticleFormData {
  return {
    title: "",
    content: "",
    newDate: "",
    category: "",
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
}

const INITIAL_FORM: ArticleFormData = createInitialForm();

const NOTE_TEMPLATES: Record<string, { title: string; category: string; content: string }> = {
  meeting: { title: "會議紀錄", category: "專案", content: "會議主題：\n參與者：\n重點：\n待辦：\n下一步：" },
  todo: { title: "待辦事項", category: "待辦", content: "- [ ] 事項一\n- [ ] 事項二\n- [ ] 事項三" },
  study: { title: "讀書筆記", category: "學習", content: "主題：\n重點摘要：\n重要觀念：\n複習提醒：" },
  idea: { title: "靈感", category: "想法", content: "這個想法是什麼：\n為什麼有趣：\n下一步可以做什麼：" },
};

type NoteFilterMode = "all" | "recent" | "pinned" | "withFiles";
type NoteViewMode = "card" | "list";

function summarizeContent(content: string) {
  const normalized = (content || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "空白筆記，建議補上重點或待辦。";
  if (normalized.length <= 90) return normalized;
  return `${normalized.slice(0, 90)}...`;
}

function extractTodoCount(content: string) {
  return (content.match(/- \[ \]|TODO|待辦/gi) || []).length;
}

function getAttachmentCount(article: Article) {
  return [article.file1, article.file2, article.file3].filter(Boolean).length;
}

function getAttachmentType(filetype?: string | null) {
  return getOriginalMultipartFiletype(filetype);
}

function getAttachmentIcon(filetype?: string | null) {
  const normalizedType = getAttachmentType(filetype);
  if (normalizedType === "jpg") return "🖼️";
  if (normalizedType === "mp4") return "🎥";
  if (normalizedType === "mp3") return "🎵";
  if (normalizedType === "xlsx") return "📊";
  if (normalizedType === "pptx") return "📽️";
  if (normalizedType === "zip") return "🗂️";
  return "📄";
}

function canPreviewAttachment(filetype?: string | null) {
  return getAttachmentType(filetype) === "zip" || !isMultipartFiletype(filetype);
}

// TXT 預覽元件 - 支援 UTF-8 編碼
function TxtPreview({ url }: { url: string; title: string }) {
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

function ZipPreview({
  url,
  title,
  filetype,
}: {
  url: string;
  title: string;
  filetype?: string;
}) {
  const [entries, setEntries] = useState<ZipEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchZip = async () => {
      try {
        setLoading(true);
        const response = {
          ok: true,
          blob: async () => (await resolveMultipartFileBlob({ file: url, filetype, name: title })).blob,
        };
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
  }, [url, title, filetype]);

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
  const { articles, loading, error, stats, loadArticles, createArticle, updateArticle, deleteArticle } = useArticles();
  const [form, setForm] = useState<ArticleFormData>(() => createInitialForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ArticleFormData>(() => createInitialForm());
  const [expandedArticles, setExpandedArticles] = useState<Set<string>>(new Set());
  const [previewFiles, setPreviewFiles] = useState<Set<string>>(new Set());
  const [downloadingAttachments, setDownloadingAttachments] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isFormCollapsed, setIsFormCollapsed] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [noteFilterMode, setNoteFilterMode] = useState<NoteFilterMode>("all");
  const [noteViewMode, setNoteViewMode] = useState<NoteViewMode>("card");
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());

  // ZIP/CSV 匯入/匯出功能
  const [importPreview, setImportPreview] = useState<{ data: ArticleFormData[], zipFile?: JSZip | null, errors: string[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, status: '' });
  const [importDebugMessages, setImportDebugMessages] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });
  const [exportStatus, setExportStatus] = useState('');
  const [exportDebugMessages, setExportDebugMessages] = useState<string[]>([]);
  const exportAbortRef = useRef<AbortController | null>(null);
  const ZIP_CSV_HEADERS = ['title', 'content', 'category', 'newDate', 'url1', 'url2', 'url3', 'file1', 'file1name', 'file1type', 'file2', 'file2name', 'file2type', 'file3', 'file3name', 'file3type'];
  const ZIP_CSV_COLUMN_COUNT = ZIP_CSV_HEADERS.length;

  // Select all / batch delete states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [batchDeleteProgress, setBatchDeleteProgress] = useState({ current: 0, total: 0 });
  const [batchCategory, setBatchCategory] = useState("");
  const [batchCategorizing, setBatchCategorizing] = useState(false);

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

  // 取得已存在的不重複分類用於下拉選單
  const existingCategories = useMemo(() => {
    const cats = articles.map(a => a.category).filter(Boolean) as string[];
    return Array.from(new Set(cats)).sort();
  }, [articles]);

  // 分類篩選狀態
  const [categoryFilter, setCategoryFilter] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("notes_pinned_ids");
    if (!raw) return;
    try {
      setPinnedIds(new Set(JSON.parse(raw)));
    } catch {
      setPinnedIds(new Set());
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("notes_pinned_ids", JSON.stringify(Array.from(pinnedIds)));
  }, [pinnedIds]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("notes_view_mode");
    if (raw === "card" || raw === "list") {
      setNoteViewMode(raw);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("notes_view_mode", noteViewMode);
  }, [noteViewMode]);

  useEffect(() => {
    setForm((prev) => (prev.newDate ? prev : { ...prev, newDate: getTodayInputDate() }));
  }, []);

  useEffect(() => {
    if (exporting) {
      setExportDebugMessages([`Starting ZIP export for ${exportProgress.total || articles.length} notes`]);
      return;
    }
    setExportDebugMessages([]);
  }, [exporting, exportProgress.total, articles.length]);

  useEffect(() => {
    if (!exporting || !exportStatus) return;
    setExportDebugMessages((prev) => [...prev.slice(-79), `${exportProgress.current}/${exportProgress.total || articles.length} ${exportStatus}`]);
  }, [exporting, exportProgress.current, exportProgress.total, exportStatus, articles.length]);

  useEffect(() => {
    if (importing) {
      setImportDebugMessages([`Starting ZIP import for ${importProgress.total || importPreview?.data.length || 0} notes`]);
      return;
    }
    setImportDebugMessages([]);
  }, [importing, importProgress.total, importPreview]);

  useEffect(() => {
    if (!importing || !importProgress.status) return;
    setImportDebugMessages((prev) => [...prev.slice(-79), `${importProgress.current}/${importProgress.total} ${importProgress.status}`]);
  }, [importing, importProgress.current, importProgress.total, importProgress.status]);

  // 搜尋過濾（包含分類）
  const filteredArticles = useMemo(() => {
    let result = articles;
    if (categoryFilter) {
      if (categoryFilter === '__none__') {
        result = result.filter(article => !article.category || article.category.trim() === '');
      } else {
        result = result.filter(article => article.category === categoryFilter);
      }
    }
    if (!searchQuery.trim()) return result;
    const query = searchQuery.toLowerCase();
    result = result.filter(article =>
      article.title?.toLowerCase().includes(query) ||
      article.content?.toLowerCase().includes(query) ||
      article.category?.toLowerCase().includes(query)
    );
    if (noteFilterMode === "recent") {
      result = result.filter((article) => {
        const diff = Date.now() - new Date(article.$updatedAt || article.newDate).getTime();
        return diff <= 7 * 24 * 60 * 60 * 1000;
      });
    } else if (noteFilterMode === "pinned") {
      result = result.filter((article) => pinnedIds.has(article.$id));
    } else if (noteFilterMode === "withFiles") {
      result = result.filter((article) => article.file1 || article.file2 || article.file3);
    }
    return result;
  }, [articles, searchQuery, categoryFilter, noteFilterMode, pinnedIds]);

  const dashboardStats = useMemo(() => {
    const recent = articles.filter((article) => {
      const diff = Date.now() - new Date(article.$updatedAt || article.newDate).getTime();
      return diff <= 7 * 24 * 60 * 60 * 1000;
    });
    const withFiles = articles.filter((article) => article.file1 || article.file2 || article.file3);
    const uncategorized = articles.filter((article) => !article.category);
    return {
      recent,
      pinned: articles.filter((article) => pinnedIds.has(article.$id)),
      withFiles,
      uncategorized,
    };
  }, [articles, pinnedIds]);

  const aiWorkbench = useMemo(() => {
    const topRecent = [...articles]
      .sort((a, b) => new Date(b.$updatedAt || b.newDate).getTime() - new Date(a.$updatedAt || a.newDate).getTime())
      .slice(0, 3);

    return {
      suggestions: [
        topRecent[0] ? `最近最值得回顧的是「${topRecent[0].title}」：${summarizeContent(topRecent[0].content)}` : "目前還沒有筆記，可以先用快速模板開始。",
        dashboardStats.uncategorized.length > 0 ? `還有 ${dashboardStats.uncategorized.length} 篇未分類筆記，建議先整理分類。` : "分類覆蓋良好，找筆記會比較快。",
        dashboardStats.withFiles.length > 0 ? `${dashboardStats.withFiles.length} 篇筆記有附件，適合當成知識索引入口。` : "目前沒有附件型筆記。",
      ],
      topRecent,
    };
  }, [articles, dashboardStats.uncategorized.length, dashboardStats.withFiles.length]);

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

  const uploadFile = async (file: File, _endpoint: string, isEdit: boolean = false): Promise<{ url: string; filetype?: string }> => {
    try {
      const uploader =
        file.size > MULTIPART_UPLOAD_THRESHOLD ? uploadFileInParts : uploadToAppwriteStorage;

      const result = await uploader(file, (progress) => {
        if (isEdit) {
          setEditUploadProgress(progress);
        } else {
          setUploadProgress(progress);
        }
      });
      return {
        url: result.url,
        filetype: "filetype" in result && typeof result.filetype === "string" ? result.filetype : undefined,
      };
    } catch (error) {
      throw error instanceof Error ? error : new Error('上傳失敗');
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
        const uploaded = await uploadFile(selectedFile1, endpoint, false);
        formDataToSubmit.file1 = uploaded.url;
        if (uploaded.filetype) formDataToSubmit.file1type = uploaded.filetype;
      }
      if (selectedFile2) {
        setUploadingFile(2);
        setUploadProgress(0);
        const endpoint = ['jpg', 'image'].includes(form.file2type || '') ? '/api/upload-image' :
          ['mp4', 'video'].includes(form.file2type || '') ? '/api/upload-video' :
            '/api/upload-music'; // Use music endpoint for audio and documents
        const uploaded = await uploadFile(selectedFile2, endpoint, false);
        formDataToSubmit.file2 = uploaded.url;
        if (uploaded.filetype) formDataToSubmit.file2type = uploaded.filetype;
      }
      if (selectedFile3) {
        setUploadingFile(3);
        setUploadProgress(0);
        const endpoint = ['jpg', 'image'].includes(form.file3type || '') ? '/api/upload-image' :
          ['mp4', 'video'].includes(form.file3type || '') ? '/api/upload-video' :
            '/api/upload-music'; // Use music endpoint for audio and documents
        const uploaded = await uploadFile(selectedFile3, endpoint, false);
        formDataToSubmit.file3 = uploaded.url;
        if (uploaded.filetype) formDataToSubmit.file3type = uploaded.filetype;
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
      alert(error instanceof Error ? error.message : "操作失敗，請稍後再試");
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
        const uploaded = await uploadFile(editSelectedFile1, endpoint, true);
        formDataToSubmit.file1 = uploaded.url;
        if (uploaded.filetype) formDataToSubmit.file1type = uploaded.filetype;
      }
      if (editSelectedFile2) {
        setEditUploadingFile(2);
        setEditUploadProgress(0);
        const endpoint = ['jpg', 'image'].includes(editForm.file2type || '') ? '/api/upload-image' :
          ['mp4', 'video'].includes(editForm.file2type || '') ? '/api/upload-video' :
            '/api/upload-music';
        const uploaded = await uploadFile(editSelectedFile2, endpoint, true);
        formDataToSubmit.file2 = uploaded.url;
        if (uploaded.filetype) formDataToSubmit.file2type = uploaded.filetype;
      }
      if (editSelectedFile3) {
        setEditUploadingFile(3);
        setEditUploadProgress(0);
        const endpoint = ['jpg', 'image'].includes(editForm.file3type || '') ? '/api/upload-image' :
          ['mp4', 'video'].includes(editForm.file3type || '') ? '/api/upload-video' :
            '/api/upload-music';
        const uploaded = await uploadFile(editSelectedFile3, endpoint, true);
        formDataToSubmit.file3 = uploaded.url;
        if (uploaded.filetype) formDataToSubmit.file3type = uploaded.filetype;
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
      alert(error instanceof Error ? error.message : "更新失敗，請稍後再試");
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`確定刪除筆記「${title}」嗎？\n\n目前這一版仍是直接刪除，尚未提供垃圾桶復原。`)) return;
    try {
      await deleteArticle(id);
      setSelectedIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    } catch {
      alert("刪除失敗，請稍後再試");
    }
  };

  // 全選/取消全選
  const handleSelectAll = () => {
    if (selectedIds.size === filteredArticles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredArticles.map(a => a.$id)));
    }
  };

  // 切換單項選取
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  // 批次刪除選取的筆記
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;

    const confirmText = `DELETE 鋒兄筆記`;
    const userInput = prompt(
      `確定要刪除所選的 ${selectedIds.size} 篇筆記嗎？\n\n目前這一版仍是直接刪除，尚未提供垃圾桶復原。\n\n請輸入以下文字以確認刪除：\n${confirmText}`
    );
    if (userInput !== confirmText) {
      if (userInput !== null) {
        alert('輸入不正確，刪除已取消');
      }
      return;
    }

    setBatchDeleting(true);
    const ids = Array.from(selectedIds);
    setBatchDeleteProgress({ current: 0, total: ids.length });

    let successCount = 0, failCount = 0;
    for (let i = 0; i < ids.length; i++) {
      setBatchDeleteProgress({ current: i + 1, total: ids.length });
      try {
        await deleteArticle(ids[i]);
        successCount++;
      } catch {
        failCount++;
      }
    }

    setBatchDeleting(false);
    setBatchDeleteProgress({ current: 0, total: 0 });
    setSelectedIds(new Set());
    alert(`批次刪除完成！\n成功: ${successCount} 篇\n失敗: ${failCount} 篇`);
  };

  const handleBatchCategorize = async (nextCategory: string) => {
    if (selectedIds.size === 0) return;

    const ids = Array.from(selectedIds);
    const normalizedCategory = nextCategory.trim();
    setBatchCategorizing(true);

    let successCount = 0;
    let failCount = 0;

    for (const id of ids) {
      const article = articles.find((item) => item.$id === id);
      if (!article) {
        failCount++;
        continue;
      }

      try {
        await updateArticle(id, {
          title: article.title,
          content: article.content,
          newDate: formatDate(article.newDate),
          category: normalizedCategory,
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
        successCount++;
      } catch {
        failCount++;
      }
    }

    setBatchCategorizing(false);
    setBatchCategory("");

    if (failCount === 0) {
      alert(normalizedCategory ? `已將 ${successCount} 篇筆記歸類到「${normalizedCategory}」` : `已清除 ${successCount} 篇筆記的分類`);
      return;
    }

    alert(
      normalizedCategory
        ? `批次分類完成\n成功: ${successCount} 篇\n失敗: ${failCount} 篇\n分類: ${normalizedCategory}`
        : `批次清除分類完成\n成功: ${successCount} 篇\n失敗: ${failCount} 篇`
    );
  };

  const handleEdit = (article: Article) => {
    setEditForm({
      title: article.title,
      content: article.content,
      newDate: formatDate(article.newDate),
      category: article.category || "",
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
    setForm({ ...createInitialForm(), newDate: getTodayInputDate() });
    setSelectedFile1(null);
    setSelectedFile2(null);
    setSelectedFile3(null);
    setUploadingFile(null);
  };

  const resetEditForm = () => {
    setEditingId(null);
    setEditForm(createInitialForm());
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

  const handleAttachmentDownload = async (
    attachmentKey: string,
    fileUrl: string,
    filetype?: string,
    fileName?: string
  ) => {
    if (downloadingAttachments.has(attachmentKey)) {
      return;
    }

    setDownloadingAttachments((prev) => new Set(prev).add(attachmentKey));

    try {
      const { blob, fileName: resolvedName } = await resolveMultipartFileBlob({
        file: fileUrl,
        filetype,
        name: fileName,
      });

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = resolvedName;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      alert(error instanceof Error ? error.message : "下載失敗");
    } finally {
      setDownloadingAttachments((prev) => {
        const next = new Set(prev);
        next.delete(attachmentKey);
        return next;
      });
    }
  };

  const togglePinned = (id: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applyTemplate = (templateKey: keyof typeof NOTE_TEMPLATES) => {
    const template = NOTE_TEMPLATES[templateKey];
    setForm((prev) => ({
      ...prev,
      title: template.title,
      category: template.category,
      content: template.content,
      newDate: prev.newDate || getTodayInputDate(),
    }));
    setIsFormCollapsed(false);
  };

  // ZIP Export function - 匯出 ZIP（含附件檔案 + CSV）
  const exportToZIP = async () => {
    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`;
      return str;
    };

    // 下載單一檔案，帶獨立超時，不會因單一檔案失敗而中斷整體匯出
    const downloadFileWithTimeout = async (url: string, globalSignal: AbortSignal, timeoutMs = 30000): Promise<Blob | null> => {
      if (globalSignal.aborted) return null;
      const fileAbort = new AbortController();
      const onGlobalAbort = () => fileAbort.abort();
      globalSignal.addEventListener('abort', onGlobalAbort, { once: true });
      console.log(`[匯出]   fetch URL: ${url}`);
      try {
        const fetchPromise = (async () => {
          const response = await fetch(url, { signal: fileAbort.signal });
          if (!response.ok) { console.warn(`[匯出]   HTTP ${response.status}`); return null; }
          console.log(`[匯出]   headers 收到，開始讀取 body...`);
          // response.blob() 無法被 AbortController 中斷，用 Promise.race 處理超時
          const blobResult = await Promise.race([
            response.blob(),
            new Promise<null>((resolve) => {
              const tid = setTimeout(() => { console.warn('[匯出]   blob() 讀取超時'); resolve(null); }, timeoutMs);
              globalSignal.addEventListener('abort', () => { clearTimeout(tid); resolve(null); }, { once: true });
            })
          ]);
          if (!blobResult) {
            // 超時或取消，嘗試中止下載串流
            try { response.body?.cancel(); } catch { }
          }
          return blobResult;
        })();
        const timeoutPromise = new Promise<null>((resolve) =>
          setTimeout(() => { console.warn(`[匯出]   整體下載超時 (${timeoutMs}ms)`); fileAbort.abort(); resolve(null); }, timeoutMs)
        );
        return await Promise.race([fetchPromise, timeoutPromise]);
      } catch {
        return null;
      } finally {
        globalSignal.removeEventListener('abort', onGlobalAbort);
      }
    };

    const abortController = new AbortController();
    exportAbortRef.current = abortController;

    setExporting(true);
    setExportProgress({ current: 0, total: articles.length });
    setExportStatus('準備中...');
    console.log(`[匯出] 開始匯出，共 ${articles.length} 篇筆記`);

    try {
      const zip = new JSZip();
      const filesFolder = zip.folder('files')!;
      const rows = [ZIP_CSV_HEADERS.join(',')];

      for (let i = 0; i < articles.length; i++) {
        if (abortController.signal.aborted) { console.log('[匯出] 使用者取消'); break; }

        const item = articles[i];
        setExportProgress({ current: i + 1, total: articles.length });
        setExportStatus(`${item.title}`);
        console.log(`[匯出] (${i + 1}/${articles.length}) 處理筆記: "${item.title}"`);

        let file1Path = '';
        let file2Path = '';
        let file3Path = '';

        // 下載 file1
        if (item.file1 && !abortController.signal.aborted) {
          const fileName = item.file1name || `file1.${item.file1type || 'bin'}`;
          const localName = `${i}_1_${fileName}`;
          setExportStatus(`${item.title} → 下載 ${fileName}`);
          console.log(`[匯出]   下載 file1: ${fileName}`);
          const blob = isMultipartFiletype(item.file1type)
            ? (await resolveMultipartFileBlob({ file: item.file1, filetype: item.file1type, name: item.file1name })).blob
            : await downloadFileWithTimeout(getAppwriteDownloadUrl(item.file1), abortController.signal);
          if (blob) {
            filesFolder.file(localName, blob);
            file1Path = `files/${localName}`;
            console.log(`[匯出]   file1 完成 (${(blob.size / 1024).toFixed(1)} KB)`);
          } else {
            console.warn(`[匯出]   file1 下載失敗或超時，已跳過`);
          }
        }

        // 下載 file2
        if (item.file2 && !abortController.signal.aborted) {
          const fileName = item.file2name || `file2.${item.file2type || 'bin'}`;
          const localName = `${i}_2_${fileName}`;
          setExportStatus(`${item.title} → 下載 ${fileName}`);
          console.log(`[匯出]   下載 file2: ${fileName}`);
          const blob = isMultipartFiletype(item.file2type)
            ? (await resolveMultipartFileBlob({ file: item.file2, filetype: item.file2type, name: item.file2name })).blob
            : await downloadFileWithTimeout(getAppwriteDownloadUrl(item.file2), abortController.signal);
          if (blob) {
            filesFolder.file(localName, blob);
            file2Path = `files/${localName}`;
            console.log(`[匯出]   file2 完成 (${(blob.size / 1024).toFixed(1)} KB)`);
          } else {
            console.warn(`[匯出]   file2 下載失敗或超時，已跳過`);
          }
        }

        // 下載 file3
        if (item.file3 && !abortController.signal.aborted) {
          const fileName = item.file3name || `file3.${item.file3type || 'bin'}`;
          const localName = `${i}_3_${fileName}`;
          setExportStatus(`${item.title} → 下載 ${fileName}`);
          console.log(`[匯出]   下載 file3: ${fileName}`);
          const blob = isMultipartFiletype(item.file3type)
            ? (await resolveMultipartFileBlob({ file: item.file3, filetype: item.file3type, name: item.file3name })).blob
            : await downloadFileWithTimeout(getAppwriteDownloadUrl(item.file3), abortController.signal);
          if (blob) {
            filesFolder.file(localName, blob);
            file3Path = `files/${localName}`;
            console.log(`[匯出]   file3 完成 (${(blob.size / 1024).toFixed(1)} KB)`);
          } else {
            console.warn(`[匯出]   file3 下載失敗或超時，已跳過`);
          }
        }

        rows.push([
          escapeCSV(item.title),
          escapeCSV(item.content || ''),
          escapeCSV(item.category || ''),
          escapeCSV(formatDate(item.newDate) || ''),
          escapeCSV(item.url1 || ''),
          escapeCSV(item.url2 || ''),
          escapeCSV(item.url3 || ''),
          escapeCSV(file1Path),
          escapeCSV(item.file1name || ''),
          escapeCSV(item.file1type || ''),
          escapeCSV(file2Path),
          escapeCSV(item.file2name || ''),
          escapeCSV(item.file2type || ''),
          escapeCSV(file3Path),
          escapeCSV(item.file3name || ''),
          escapeCSV(item.file3type || '')
        ].join(','));
      }

      if (abortController.signal.aborted) return;

      // 將 CSV 加入 ZIP
      const BOM = '\uFEFF';
      const csvContent = BOM + rows.join('\n');
      zip.file('appwrite-article.csv', csvContent);

      setExportStatus('產生 ZIP 壓縮中...');
      console.log('[匯出] 產生 ZIP 中...');
      // 產生 ZIP 並下載
      const blob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'appwrite-article.zip';
      link.click();
      URL.revokeObjectURL(link.href);
      console.log(`[匯出] 完成！ZIP 大小: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('匯出 ZIP 失敗:', err);
        alert('匯出 ZIP 失敗，請稍後再試');
      }
    } finally {
      exportAbortRef.current = null;
      setExportStatus('');
      setExporting(false);
      setExportProgress({ current: 0, total: 0 });
    }
  };

  const cancelExport = () => {
    exportAbortRef.current?.abort();
  };

  // RFC 4180 compliant CSV parser - 支援 16 欄（ZIP 格式）、7 欄（含分類）與 6 欄（舊 CSV 格式）
  const parseCSV = (text: string): { data: ArticleFormData[], errors: string[] } => {
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
    const columnCount = headerValues.length;

    // 支援 16 欄（ZIP 格式）、7 欄（含分類）或 6 欄（舊 CSV 格式）
    if (columnCount !== ZIP_CSV_COLUMN_COUNT && columnCount !== 7 && columnCount !== 6) {
      errors.push(`表頭欄位數量錯誤: 預期 ${ZIP_CSV_COLUMN_COUNT} 欄、7 欄或 6 欄，實際 ${columnCount} 欄`);
      return { data, errors };
    }

    const expectedHeaders = columnCount === ZIP_CSV_COLUMN_COUNT
      ? ZIP_CSV_HEADERS
      : columnCount === 7
        ? ['title', 'content', 'category', 'newDate', 'url1', 'url2', 'url3']
        : ['title', 'content', 'newDate', 'url1', 'url2', 'url3'];
    for (let i = 0; i < expectedHeaders.length; i++) {
      if (headerValues[i]?.trim() !== expectedHeaders[i]) {
        errors.push(`表頭第 ${i + 1} 欄錯誤: 預期 "${expectedHeaders[i]}"，實際 "${headerValues[i]?.trim()}"`);
        if (errors.length >= 5) { errors.push('...更多錯誤已省略'); break; }
      }
    }
    if (errors.length > 0) return { data, errors };

    for (let i = 1; i < rows.length; i++) {
      const values = rows[i];
      const lineNum = i + 1;
      if (values.length !== columnCount) {
        errors.push(`第 ${lineNum} 行: 欄位數量錯誤 (預期 ${columnCount} 欄，實際 ${values.length} 欄)`);
        continue;
      }
      if (!values[0]?.trim()) {
        errors.push(`第 ${lineNum} 行: title 欄位不能為空`);
        continue;
      }
      const hasCategory = columnCount === ZIP_CSV_COLUMN_COUNT || columnCount === 7;
      const categoryIndex = hasCategory ? 2 : -1;
      const newDateIndex = hasCategory ? 3 : 2;
      const url1Index = hasCategory ? 4 : 3;
      const url2Index = hasCategory ? 5 : 4;
      const url3Index = hasCategory ? 6 : 5;
      const fileBaseIndex = 7;

      data.push({
        title: values[0].trim(),
        content: values[1]?.trim() || '',
        category: hasCategory ? (values[categoryIndex]?.trim() || '') : '',
        newDate: values[newDateIndex]?.trim() || getTodayInputDate(),
        url1: values[url1Index]?.trim() || '',
        url2: values[url2Index]?.trim() || '',
        url3: values[url3Index]?.trim() || '',
        file1: columnCount === ZIP_CSV_COLUMN_COUNT ? (values[fileBaseIndex]?.trim() || '') : '',
        file1name: columnCount === ZIP_CSV_COLUMN_COUNT ? (values[fileBaseIndex + 1]?.trim() || '') : '',
        file1type: columnCount === ZIP_CSV_COLUMN_COUNT ? (values[fileBaseIndex + 2]?.trim() || '') : '',
        file2: columnCount === ZIP_CSV_COLUMN_COUNT ? (values[fileBaseIndex + 3]?.trim() || '') : '',
        file2name: columnCount === ZIP_CSV_COLUMN_COUNT ? (values[fileBaseIndex + 4]?.trim() || '') : '',
        file2type: columnCount === ZIP_CSV_COLUMN_COUNT ? (values[fileBaseIndex + 5]?.trim() || '') : '',
        file3: columnCount === ZIP_CSV_COLUMN_COUNT ? (values[fileBaseIndex + 6]?.trim() || '') : '',
        file3name: columnCount === ZIP_CSV_COLUMN_COUNT ? (values[fileBaseIndex + 7]?.trim() || '') : '',
        file3type: columnCount === ZIP_CSV_COLUMN_COUNT ? (values[fileBaseIndex + 8]?.trim() || '') : ''
      });
    }
    return { data, errors };
  };

  // ZIP 匯入 - 選擇 ZIP 檔案
  const handleZipFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.zip')) {
      alert('請選擇 ZIP 檔案');
      e.target.value = '';
      return;
    }

    try {
      const zip = await JSZip.loadAsync(file);

      // 找到 CSV 檔案
      let csvFile: JSZip.JSZipObject | null = null;
      zip.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir && relativePath.endsWith('.csv')) {
          csvFile = zipEntry;
        }
      });

      if (!csvFile) {
        alert('ZIP 中找不到 CSV 檔案');
        e.target.value = '';
        return;
      }

      const csvText = await (csvFile as JSZip.JSZipObject).async('string');
      const result = parseCSV(csvText);
      setImportPreview({ ...result, zipFile: zip });
    } catch (err) {
      console.error('讀取 ZIP 失敗:', err);
      alert('讀取 ZIP 檔案失敗，請確認檔案格式正確');
    }
    e.target.value = '';
  };

  // 準備匯入用的 API 資料（包含檔案欄位）
  const prepareArticleData = (formData: ArticleFormData) => {
    const dateTime = new Date(formData.newDate).toISOString();
    const dataToSend: any = {
      title: formData.title,
      content: formData.content,
      newDate: dateTime,
    };
    if (formData.category !== undefined) dataToSend.category = formData.category.trim();
    if (formData.url1 && formData.url1.trim()) dataToSend.url1 = formData.url1;
    if (formData.url2 && formData.url2.trim()) dataToSend.url2 = formData.url2;
    if (formData.url3 && formData.url3.trim()) dataToSend.url3 = formData.url3;
    if (formData.file1 && formData.file1.trim()) dataToSend.file1 = formData.file1;
    if (formData.file1name && formData.file1name.trim()) dataToSend.file1name = formData.file1name;
    if (formData.file1type && formData.file1type.trim()) dataToSend.file1type = formData.file1type;
    if (formData.file2 && formData.file2.trim()) dataToSend.file2 = formData.file2;
    if (formData.file2name && formData.file2name.trim()) dataToSend.file2name = formData.file2name;
    if (formData.file2type && formData.file2type.trim()) dataToSend.file2type = formData.file2type;
    if (formData.file3 && formData.file3.trim()) dataToSend.file3 = formData.file3;
    if (formData.file3name && formData.file3name.trim()) dataToSend.file3name = formData.file3name;
    if (formData.file3type && formData.file3type.trim()) dataToSend.file3type = formData.file3type;
    return dataToSend;
  };

  const executeImport = async () => {
    if (!importPreview || importPreview.data.length === 0) return;

    const zipFile = importPreview.zipFile;
    setImporting(true);
    setImportProgress({ current: 0, total: importPreview.data.length, status: '準備匯入...' });

    let successCount = 0, failCount = 0;
    for (let i = 0; i < importPreview.data.length; i++) {
      const formData = { ...importPreview.data[i] };
      setImportProgress({ current: i + 1, total: importPreview.data.length, status: `處理: ${formData.title}` });

      try {
        // 如果有 ZIP 檔且 file 欄位指向 ZIP 內路徑，上傳檔案到 Appwrite
        if (zipFile) {
          for (const fileNum of [1, 2, 3] as const) {
            const fileKey = `file${fileNum}` as keyof ArticleFormData;
            const nameKey = `file${fileNum}name` as keyof ArticleFormData;
            const localPath = formData[fileKey] as string;

            if (localPath && localPath.startsWith('files/')) {
              const zipEntry = zipFile.file(localPath);
              if (zipEntry) {
                setImportProgress({ current: i + 1, total: importPreview.data.length, status: `上傳檔案: ${formData[nameKey] || localPath}` });
                const fileBlob = await zipEntry.async('blob');
                const fileName = (formData[nameKey] as string) || localPath.split('/').pop() || `file${fileNum}`;
                const fileObj = new window.File([fileBlob], fileName, { type: fileBlob.type || 'application/octet-stream' });

                try {
                  const { url } = await uploadToAppwriteStorage(fileObj);
                  (formData as any)[fileKey] = url;
                } catch (uploadErr) {
                  console.warn(`上傳 ${fileKey} 失敗 (${formData.title}):`, uploadErr);
                  (formData as any)[fileKey] = ''; // 清空失敗的檔案路徑
                }
              } else {
                (formData as any)[fileKey] = ''; // ZIP 中找不到檔案
              }
            }
          }
        }

        const existing = articles.find(a => a.title === formData.title);
        const dataToSend = prepareArticleData(formData);

        if (existing) {
          await fetchApi(`${API_ENDPOINTS.ARTICLE}/${existing.$id}`, {
            method: "PUT",
            body: JSON.stringify(dataToSend),
          });
        } else {
          await fetchApi(API_ENDPOINTS.ARTICLE, {
            method: "POST",
            body: JSON.stringify(dataToSend),
          });
        }
        successCount++;
      } catch {
        failCount++;
      }
    }

    // 全部完成後一次性重新載入
    await loadArticles(true);

    setImporting(false);
    setImportProgress({ current: 0, total: 0, status: '' });
    setImportPreview(null);
    alert(`匯入完成！\n成功: ${successCount} 筆\n失敗: ${failCount} 筆`);
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
            <Button onClick={() => loadArticles(true)} variant="outline" className="rounded-xl flex items-center gap-2 h-12" disabled={loading}>
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} /> 重新整理
            </Button>
            <Button
              onClick={() => setIsFormCollapsed(false)}
              className="rounded-xl flex items-center gap-2 h-12 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white"
            >
              <Plus size={18} /> 新增筆記
            </Button>
            <Button onClick={() => document.getElementById('zip-import-notes')?.click()} variant="outline" className="rounded-xl flex items-center gap-2 h-12" title="匯入 ZIP">
              <Upload size={18} /> 匯入 ZIP
            </Button>
            <input id="zip-import-notes" type="file" accept=".zip" className="hidden" onChange={handleZipFileSelect} />
            {exporting ? (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Button variant="outline" className="rounded-xl flex items-center gap-2 h-12" disabled>
                    <Archive size={18} className="animate-pulse" /> 匯出中 ({exportProgress.current}/{exportProgress.total})...
                  </Button>
                  <Button onClick={cancelExport} variant="outline" className="rounded-xl flex items-center gap-2 h-12 border-red-400 text-red-500 hover:bg-red-50" title="取消匯出">
                    <Trash2 size={18} /> 取消
                  </Button>
                </div>
                {exportStatus && (
                  <p className="text-xs text-muted-foreground truncate max-w-[280px]" title={exportStatus}>
                    {exportStatus}
                  </p>
                )}
              </div>
            ) : (
              <Button onClick={exportToZIP} variant="outline" className="rounded-xl flex items-center gap-2 h-12" title="匯出 ZIP">
                <Download size={18} /> 匯出 ZIP
              </Button>
            )}
            <StatCard title="筆記總數" value={stats.total} gradient="from-blue-500 to-blue-600" className="min-w-[160px]" />
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-sky-200 bg-gradient-to-br from-sky-50 to-white shadow-sm">
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2 text-sky-700"><Clock3 size={16} /> 最近 7 天</CardDescription>
            <CardTitle className="text-3xl text-sky-800">{dashboardStats.recent.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-sky-800/80">最近更新的筆記，適合當成回顧入口。</CardContent>
        </Card>
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white shadow-sm">
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2 text-amber-700"><Pin size={16} /> 釘選筆記</CardDescription>
            <CardTitle className="text-3xl text-amber-800">{dashboardStats.pinned.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-amber-800/80">把常用與高價值筆記固定在前面。</CardContent>
        </Card>
        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white shadow-sm">
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2 text-emerald-700"><FolderOpen size={16} /> 有附件筆記</CardDescription>
            <CardTitle className="text-3xl text-emerald-800">{dashboardStats.withFiles.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-emerald-800/80">附件型筆記適合做成知識索引與素材倉庫。</CardContent>
        </Card>
        <Card className="border-rose-200 bg-gradient-to-br from-rose-50 to-white shadow-sm">
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2 text-rose-700"><BrainCircuit size={16} /> 待整理</CardDescription>
            <CardTitle className="text-3xl text-rose-800">{dashboardStats.uncategorized.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-rose-800/80">未分類筆記愈少，之後愈找得到。</CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card className="border-purple-200 bg-gradient-to-br from-purple-50 via-white to-fuchsia-50 shadow-sm">
          <CardHeader className="pb-4">
            <CardDescription className="flex items-center gap-2 text-purple-700"><Plus size={16} /> 快速新增與模板</CardDescription>
            <CardTitle>先記下來，再慢慢整理</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {Object.entries(NOTE_TEMPLATES).map(([key, template]) => (
                <Button key={key} type="button" variant="outline" className="rounded-full border-purple-200 text-purple-700 hover:bg-purple-50" onClick={() => applyTemplate(key as keyof typeof NOTE_TEMPLATES)}>
                  {template.title}
                </Button>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Input placeholder="快速標題" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-11 rounded-xl md:col-span-2" />
              <Input placeholder="分類" value={form.category || ""} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-11 rounded-xl" />
              <Textarea placeholder="快速記錄內容" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="min-h-[120px] rounded-xl md:col-span-3" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white" onClick={() => setIsFormCollapsed(false)}>
                打開完整編輯器
              </Button>
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setForm({ ...createInitialForm(), newDate: getTodayInputDate() })}>
                清空草稿
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 shadow-sm">
          <CardHeader className="pb-4">
            <CardDescription className="flex items-center gap-2 text-amber-700"><Sparkles size={16} /> Friendly AI 整理區</CardDescription>
            <CardTitle>今天值得整理什麼</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
            {aiWorkbench.suggestions.map((suggestion, index) => (
              <div key={index} className="rounded-2xl border border-amber-200 bg-white/80 px-4 py-3">
                {suggestion}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {!isFormCollapsed && (
        <FormCard title="新增筆記" accentColor="from-purple-500 to-purple-600">
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
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">分類（選填）/ Category (Optional)</label>
              <div className="relative">
                <input
                  id="category-datalist"
                  list="category-options"
                  placeholder="輸入分類名稱（可從建議選取）"
                  value={form.category || ""}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="flex h-12 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
                <datalist id="category-options">
                  {existingCategories.map(cat => <option key={cat} value={cat} />)}
                </datalist>
              </div>
              <div className="px-1 h-4">
                {form.category ? (
                  <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">已設定分類: {form.category}</span>
                ) : (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 輸入分類 / (Optional) Enter category</span>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Textarea
                placeholder="筆記內容 (上限 3377 字) / Note Content (Max 3377 chars)"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                className="min-h-[200px] rounded-xl w-full"
                maxLength={3377}
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
              <Button type="button" variant="outline" onClick={() => setIsFormCollapsed(true)} className="h-12 px-6 rounded-xl">關閉</Button>
            </FormActions>
          </form>
        </FormCard>
      )}

      {/* ZIP 匯入預覽對話框 */}
      {exporting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">ZIP Export Progress</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Exporting notes ZIP with CSV and attachments.
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-purple-600 dark:text-purple-400">
                    Exporting... ({exportProgress.current}/{exportProgress.total})
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">{exportStatus || 'Preparing export...'}</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                  <div
                    className="bg-purple-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${exportProgress.total ? (exportProgress.current / exportProgress.total) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Export Debug Console Output</h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{exportDebugMessages.length} entries</span>
                </div>
                <div className="max-h-72 overflow-y-auto rounded-xl bg-black px-3 py-2 font-mono text-xs text-green-300 space-y-1">
                  {exportDebugMessages.length > 0 ? (
                    exportDebugMessages.map((message, index) => (
                      <div key={`${message}-${index}`}>{message}</div>
                    ))
                  ) : (
                    <div>Waiting for export logs...</div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end border-t border-gray-200 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] dark:border-gray-700">
              <Button onClick={cancelExport} variant="outline" className="rounded-xl border-red-400 text-red-500 hover:bg-red-50">
                Cancel Export
              </Button>
            </div>
          </div>
        </div>
      )}

      {importPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">ZIP 匯入預覽</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {importPreview.errors.length > 0 ? '發現錯誤，請修正後重試' : `準備匯入 ${importPreview.data.length} 筆資料${importPreview.zipFile ? '（含附件檔案）' : ''}`}
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
                    {importPreview.zipFile && <p>• 附件檔案將自動上傳到 Appwrite Storage</p>}
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
                            <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">附件</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {importPreview.data.map((item, idx) => (
                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                              <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{idx + 1}</td>
                              <td className="px-3 py-2 text-gray-900 dark:text-gray-100 font-medium">{item.title}</td>
                              <td className="px-3 py-2 text-gray-600 dark:text-gray-400 max-w-xs truncate">{item.content || '-'}</td>
                              <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{item.newDate}</td>
                              <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                                {[item.file1, item.file2, item.file3].filter(Boolean).length > 0
                                  ? `${[item.file1, item.file2, item.file3].filter(Boolean).length} 個檔案`
                                  : '-'}
                              </td>
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
                  {importProgress.status && <p className="text-xs text-gray-500 dark:text-gray-400">{importProgress.status}</p>}
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div
                      className="bg-purple-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                    ></div>
                  </div>
                  <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Import Debug Console Output</h3>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{importDebugMessages.length} entries</span>
                    </div>
                    <div className="max-h-60 overflow-y-auto rounded-xl bg-black px-3 py-2 font-mono text-xs text-green-300 space-y-1">
                      {importDebugMessages.length > 0 ? (
                        importDebugMessages.map((message, index) => (
                          <div key={`${message}-${index}`}>{message}</div>
                        ))
                      ) : (
                        <div>Waiting for import logs...</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-gray-200 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] dark:border-gray-700 sm:flex-row sm:justify-end">
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

      {/* 搜尋欄位 + 分類篩選 + 全選/批次刪除 */}
      {articles.length > 0 && (
        <div className="space-y-3 mb-4">
          <div className="flex flex-wrap gap-2">
            {[
              { key: "all", label: "全部" },
              { key: "recent", label: "最近筆記" },
              { key: "pinned", label: "釘選" },
              { key: "withFiles", label: "有附件" },
            ].map((item) => (
              <Button
                key={item.key}
                type="button"
                variant="outline"
                onClick={() => setNoteFilterMode(item.key as NoteFilterMode)}
                className={`rounded-full ${noteFilterMode === item.key ? "border-purple-500 bg-purple-50 text-purple-700" : ""}`}
              >
                {item.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-col gap-2 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                placeholder="搜尋標題、內容、分類..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 rounded-xl"
              />
            </div>
            <Select value={categoryFilter || "__all__"} onValueChange={(v) => setCategoryFilter(v === "__all__" ? "" : v)}>
              <SelectTrigger className="h-12 rounded-xl w-full flex-shrink-0 lg:w-36">
                <SelectValue placeholder="全部分類" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">📚 全部</SelectItem>
                {existingCategories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
                {existingCategories.length > 0 && (
                  <SelectItem value="__none__">未分類</SelectItem>
                )}
              </SelectContent>
            </Select>
            <div className="flex h-12 w-full items-center rounded-xl border border-[var(--line-soft)] bg-white/70 p-1 shadow-sm dark:bg-white/5 lg:w-auto">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setNoteViewMode("card")}
                className={cn(
                  "h-10 rounded-lg px-3",
                  noteViewMode === "card" && "bg-[var(--accent)]/15 text-[var(--accent-strong)]"
                )}
                title="卡片式"
              >
                <LayoutGrid size={16} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setNoteViewMode("list")}
                className={cn(
                  "h-10 rounded-lg px-3",
                  noteViewMode === "list" && "bg-[var(--accent)]/15 text-[var(--accent-strong)]"
                )}
                title="列表式"
              >
                <List size={16} />
              </Button>
            </div>
          </div>
          {filteredArticles.length > 0 && (
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selectedIds.size === filteredArticles.length && filteredArticles.length > 0}
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  全選 ({selectedIds.size}/{filteredArticles.length})
                </span>
              </label>
              {selectedIds.size > 0 && (
                <>
                  <div className="flex min-w-[220px] flex-1 flex-col gap-2 sm:min-w-[280px] sm:flex-row">
                    <Input
                      list="batch-note-category-options"
                      placeholder="輸入要套用的分類"
                      value={batchCategory}
                      onChange={(e) => setBatchCategory(e.target.value)}
                      className="h-9 rounded-xl"
                      disabled={batchCategorizing}
                    />
                    <datalist id="batch-note-category-options">
                      {existingCategories.map((cat) => (
                        <option key={cat} value={cat} />
                      ))}
                    </datalist>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleBatchCategorize(batchCategory)}
                      disabled={batchCategorizing || !batchCategory.trim()}
                      className="h-9 min-w-[132px] rounded-xl bg-purple-600 text-white hover:bg-purple-700"
                    >
                      {batchCategorizing ? "分類中..." : `套用分類 (${selectedIds.size})`}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleBatchCategorize("")}
                      disabled={batchCategorizing}
                      className="h-9 min-w-[108px] rounded-xl"
                    >
                      清除分類
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleBatchDelete}
                    disabled={batchDeleting || batchCategorizing}
                    className="rounded-xl flex items-center gap-2 h-9"
                  >
                    <Trash2 size={16} />
                    {batchDeleting
                      ? `刪除中 (${batchDeleteProgress.current}/${batchDeleteProgress.total})...`
                      : `刪除所選 (${selectedIds.size})`}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <DataCard>
        {articles.length === 0 ? (
          <EmptyState emoji="📝" title="暫無筆記資料" description="點擊上方「新增筆記」按鈕新增第一篇筆記" />
        ) : filteredArticles.length === 0 ? (
          <EmptyState emoji="🔍" title="無搜尋結果" description={`找不到「${searchQuery}」相關的筆記`} />
        ) : (
          <div
            className={cn(
              "p-4",
              noteViewMode === "card"
                ? "grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3"
                : "flex flex-col gap-4"
            )}
          >
            {filteredArticles.map((article) => {
              const isEditing = editingId === article.$id;
              const isExpanded = expandedArticles.has(article.$id);
              const hasUrls = article.url1 || article.url2 || article.url3;
              const isPinned = pinnedIds.has(article.$id);
              const aiSummary = summarizeContent(article.content);
              const todoCount = extractTodoCount(article.content);
              const attachmentCount = getAttachmentCount(article);

              return (
                <div key={article.$id} className={cn(
                  "bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm transition-all",
                  noteViewMode === "list" && !isEditing && "rounded-[24px] px-5 py-4",
                  isPinned && "border-amber-300 bg-amber-50/40 dark:bg-amber-900/10",
                  isEditing && "ring-2 ring-purple-500"
                )}>
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

                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">分類 / Category</label>
                        <div className="relative">
                          <input
                            id="edit-category-datalist"
                            list="edit-category-options"
                            placeholder="輸入分類名稱"
                            value={editForm.category || ""}
                            onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          />
                          <datalist id="edit-category-options">
                            {existingCategories.map(cat => <option key={cat} value={cat} />)}
                          </datalist>
                        </div>
                      </div>

                      <Textarea
                        placeholder="筆記內容 (上限 3377 字)"
                        value={editForm.content}
                        onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                        className="min-h-[150px] rounded-lg text-sm"
                        maxLength={3377}
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
                      <div className={cn(
                        "flex items-start justify-between gap-3",
                        noteViewMode === "list" && "flex-col lg:flex-row"
                      )}>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(article.$id)}
                            onChange={() => handleToggleSelect(article.$id)}
                            className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 flex-shrink-0 mt-0.5"
                          />
                          <FileText className="text-purple-600 dark:text-purple-400" size={20} />
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{article.title}</h3>
                              {isPinned && <Pin className="text-amber-500" size={14} />}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {article.category && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700">
                                  {article.category}
                                </span>
                              )}
                              {todoCount > 0 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                                  TODO {todoCount}
                                </span>
                              )}
                              {attachmentCount > 0 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-100 text-sky-700 border border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-700">
                                  附件 {attachmentCount}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className={cn(
                          "flex items-center gap-2",
                          noteViewMode === "list" && "w-full justify-between lg:w-auto lg:justify-end"
                        )}>
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

                      <div className={cn(
                        "rounded-2xl border border-amber-200 bg-amber-50/80 px-3 py-2",
                        noteViewMode === "list" && "lg:max-w-[420px]"
                      )}>
                        <div className="mb-1 flex items-center gap-1 text-xs font-semibold text-amber-700">
                          <Sparkles size={12} /> AI 摘要
                        </div>
                        <p className="text-sm text-amber-900/80">{aiSummary}</p>
                      </div>

                      <div className={cn(
                        "text-sm text-gray-600 dark:text-gray-300",
                        noteViewMode === "list" && "lg:flex lg:items-start lg:gap-6"
                      )}>
                        <div className="flex-1">
                        {isExpanded ? (
                          <p className="whitespace-pre-wrap">{article.content}</p>
                        ) : (
                          <p className={cn("whitespace-pre-wrap", noteViewMode === "card" ? "line-clamp-5" : "line-clamp-3")}>{article.content}</p>
                        )}
                        </div>
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
                            <a href={article.url1} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline truncate">
                              <FaviconImage siteUrl={article.url1} siteName={article.title} size={14} />
                              {article.url1}
                            </a>
                          )}
                          {article.url2 && (
                            <a href={article.url2} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline truncate">
                              <FaviconImage siteUrl={article.url2} siteName={article.title} size={14} />
                              {article.url2}
                            </a>
                          )}
                          {article.url3 && (
                            <a href={article.url3} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline truncate">
                              <FaviconImage siteUrl={article.url3} siteName={article.title} size={14} />
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
                                  <button
                                    type="button"
                                    onClick={() => handleAttachmentDownload(`${article.$id}-download-file1`, article.file1!, article.file1type, article.file1name)}
                                    disabled={downloadingAttachments.has(`${article.$id}-download-file1`)}
                                    className="text-sm text-green-600 dark:text-green-400 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {getAttachmentIcon(article.file1type)} {downloadingAttachments.has(`${article.$id}-download-file1`) ? '下載中...' : (article.file1name || '檔案 1')}
                                  </button>
                                  {canPreviewAttachment(article.file1type) && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => togglePreview(`${article.$id}-file1`)}
                                      className="h-6 px-2 text-xs"
                                    >
                                      {previewFiles.has(`${article.$id}-file1`) ? '收起' : '預覽'}
                                    </Button>
                                  )}
                                </div>
                                {isMultipartFiletype(article.file1type) && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400">分段檔案，下載時會自動合併</p>
                                )}
                                {canPreviewAttachment(article.file1type) && previewFiles.has(`${article.$id}-file1`) && (
                                  <>
                                    {getAttachmentType(article.file1type) === 'jpg' && (
                                      <img src={article.file1} alt={article.file1name || '檔案 1'} className="max-w-[150px] rounded-lg border border-gray-300 dark:border-gray-600" />
                                    )}
                                    {getAttachmentType(article.file1type) === 'mp4' && (
                                      <PlyrPlayer type="video" src={getProxiedMediaUrl(article.file1)} className="max-w-[300px] rounded-lg" />
                                    )}
                                    {getAttachmentType(article.file1type) === 'mp3' && (
                                      <PlyrPlayer type="audio" src={getProxiedMediaUrl(article.file1)} className="max-w-[300px]" />
                                    )}
                                    {getAttachmentType(article.file1type) === 'pdf' && (
                                      <iframe src={article.file1} className="w-full h-[400px] rounded-lg border border-gray-300 dark:border-gray-600" title={article.file1name || '檔案 1'}></iframe>
                                    )}
                                    {getAttachmentType(article.file1type) === 'txt' && (
                                      <TxtPreview url={article.file1} title={article.file1name || '檔案 1'} />
                                    )}
                                    {(['xlsx', 'pptx', 'docx'] as const).includes(getAttachmentType(article.file1type) as "xlsx" | "pptx" | "docx") && (
                                      <iframe src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(article.file1)}`} className="w-full h-[400px] rounded-lg border border-gray-300 dark:border-gray-600" title={article.file1name || '檔案 1'}></iframe>
                                    )}
                                    {getAttachmentType(article.file1type) === 'zip' && (
                                      <ZipPreview url={article.file1} title={article.file1name || '檔案 1'} filetype={article.file1type} />
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                            {article.file2 && (
                              <div className="space-y-1 flex-shrink-0">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleAttachmentDownload(`${article.$id}-download-file2`, article.file2!, article.file2type, article.file2name)}
                                    disabled={downloadingAttachments.has(`${article.$id}-download-file2`)}
                                    className="text-sm text-green-600 dark:text-green-400 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {getAttachmentIcon(article.file2type)} {downloadingAttachments.has(`${article.$id}-download-file2`) ? '下載中...' : (article.file2name || '檔案 2')}
                                  </button>
                                  {canPreviewAttachment(article.file2type) && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => togglePreview(`${article.$id}-file2`)}
                                      className="h-6 px-2 text-xs"
                                    >
                                      {previewFiles.has(`${article.$id}-file2`) ? '收起' : '預覽'}
                                    </Button>
                                  )}
                                </div>
                                {isMultipartFiletype(article.file2type) && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400">分段檔案，下載時會自動合併</p>
                                )}
                                {canPreviewAttachment(article.file2type) && previewFiles.has(`${article.$id}-file2`) && (
                                  <>
                                    {getAttachmentType(article.file2type) === 'jpg' && (
                                      <img src={article.file2} alt={article.file2name || '檔案 2'} className="max-w-[150px] rounded-lg border border-gray-300 dark:border-gray-600" />
                                    )}
                                    {getAttachmentType(article.file2type) === 'mp4' && (
                                      <PlyrPlayer type="video" src={getProxiedMediaUrl(article.file2)} className="max-w-[300px] rounded-lg" />
                                    )}
                                    {getAttachmentType(article.file2type) === 'mp3' && (
                                      <PlyrPlayer type="audio" src={getProxiedMediaUrl(article.file2)} className="max-w-[300px]" />
                                    )}
                                    {getAttachmentType(article.file2type) === 'pdf' && (
                                      <iframe src={article.file2} className="w-full h-[400px] rounded-lg border border-gray-300 dark:border-gray-600" title={article.file2name || '檔案 2'}></iframe>
                                    )}
                                    {getAttachmentType(article.file2type) === 'txt' && (
                                      <TxtPreview url={article.file2} title={article.file2name || '檔案 2'} />
                                    )}
                                    {(['xlsx', 'pptx', 'docx'] as const).includes(getAttachmentType(article.file2type) as "xlsx" | "pptx" | "docx") && (
                                      <iframe src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(article.file2)}`} className="w-full h-[400px] rounded-lg border border-gray-300 dark:border-gray-600" title={article.file2name || '檔案 2'}></iframe>
                                    )}
                                    {getAttachmentType(article.file2type) === 'zip' && (
                                      <ZipPreview url={article.file2} title={article.file2name || '檔案 2'} filetype={article.file2type} />
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                            {article.file3 && (
                              <div className="space-y-1 flex-shrink-0">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleAttachmentDownload(`${article.$id}-download-file3`, article.file3!, article.file3type, article.file3name)}
                                    disabled={downloadingAttachments.has(`${article.$id}-download-file3`)}
                                    className="text-sm text-green-600 dark:text-green-400 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {getAttachmentIcon(article.file3type)} {downloadingAttachments.has(`${article.$id}-download-file3`) ? '下載中...' : (article.file3name || '檔案 3')}
                                  </button>
                                  {canPreviewAttachment(article.file3type) && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => togglePreview(`${article.$id}-file3`)}
                                      className="h-6 px-2 text-xs"
                                    >
                                      {previewFiles.has(`${article.$id}-file3`) ? '收起' : '預覽'}
                                    </Button>
                                  )}
                                </div>
                                {isMultipartFiletype(article.file3type) && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400">分段檔案，下載時會自動合併</p>
                                )}
                                {canPreviewAttachment(article.file3type) && previewFiles.has(`${article.$id}-file3`) && (
                                  <>
                                    {getAttachmentType(article.file3type) === 'jpg' && (
                                      <img src={article.file3} alt={article.file3name || '檔案 3'} className="max-w-[150px] rounded-lg border border-gray-300 dark:border-gray-600" />
                                    )}
                                    {getAttachmentType(article.file3type) === 'mp4' && (
                                      <PlyrPlayer type="video" src={getProxiedMediaUrl(article.file3)} className="max-w-[300px] rounded-lg" />
                                    )}
                                    {getAttachmentType(article.file3type) === 'mp3' && (
                                      <PlyrPlayer type="audio" src={getProxiedMediaUrl(article.file3)} className="max-w-[300px]" />
                                    )}
                                    {getAttachmentType(article.file3type) === 'pdf' && (
                                      <iframe src={article.file3} className="w-full h-[400px] rounded-lg border border-gray-300 dark:border-gray-600" title={article.file3name || '檔案 3'}></iframe>
                                    )}
                                    {getAttachmentType(article.file3type) === 'txt' && (
                                      <TxtPreview url={article.file3} title={article.file3name || '檔案 3'} />
                                    )}
                                    {(['xlsx', 'pptx', 'docx'] as const).includes(getAttachmentType(article.file3type) as "xlsx" | "pptx" | "docx") && (
                                      <iframe src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(article.file3)}`} className="w-full h-[400px] rounded-lg border border-gray-300 dark:border-gray-600" title={article.file3name || '檔案 3'}></iframe>
                                    )}
                                    {getAttachmentType(article.file3type) === 'zip' && (
                                      <ZipPreview url={article.file3} title={article.file3name || '檔案 3'} filetype={article.file3type} />
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 pt-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => togglePinned(article.$id)} className="rounded-xl">
                          {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
                          {isPinned ? "取消釘選" : "釘選"}
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => handleEdit(article)} className="flex-1 rounded-xl">編輯</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => handleCopyContent(`摘要：${aiSummary}\n\n${article.content}`, article.$id)} className="rounded-xl">
                          <Sparkles size={14} />
                          AI 摘要
                        </Button>
                        <Button type="button" size="sm" variant="destructive" onClick={() => handleDelete(article.$id, article.title)} className="rounded-xl">刪除</Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DataCard>
    </div>
  );
}
