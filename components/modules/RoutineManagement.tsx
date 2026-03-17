"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Calendar, Search, Download, Upload, ArrowRight, X, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormCard, FormGrid, FormActions } from "@/components/ui/form-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataCard } from "@/components/ui/data-card";
import { EmptyState } from "@/components/ui/empty-state";
import { FullPageLoading } from "@/components/ui/loading-spinner";
import { useCrud, fetchApi } from "@/hooks/useApi";
import { API_ENDPOINTS } from "@/lib/constants";
import { getExportFilename } from "@/lib/utils";
import { FriendlyAiCrudShell } from "@/components/ui/friendly-ai-crud-shell";

interface Routine {
  $id: string;
  name: string;
  note: string;
  lastdate1: string | null;
  lastdate2: string | null;
  lastdate3: string | null;
  link: string;
  photo: string;
}

interface RoutineFormData {
  name: string;
  note: string;
  lastdate1: string;
  lastdate2: string;
  lastdate3: string;
  link: string;
  photo: string;
}

const INITIAL_FORM: RoutineFormData = {
  name: "",
  note: "",
  lastdate1: "",
  lastdate2: "",
  lastdate3: "",
  link: "",
  photo: "",
};

export default function RoutineManagement() {
  const { items: routines, loading, error, create, update, remove, fetchAll } = useCrud<Routine>(API_ENDPOINTS.ROUTINE);
  const [form, setForm] = useState<RoutineFormData>(INITIAL_FORM);

  // Extract unique existing names for "Select or Input" pattern
  const existingNames = useMemo(() => {
    return Array.from(new Set(routines.map(r => r.name).filter(Boolean))).sort();
  }, [routines]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string>("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [workbenchMode, setWorkbenchMode] = useState<"all" | "dated" | "linked" | "withPhoto">("all");

  // Inline editing state
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineEditForm, setInlineEditForm] = useState<RoutineFormData>(INITIAL_FORM);

  // Bulk selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteInput, setBulkDeleteInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [deleteTotal, setDeleteTotal] = useState(0);

  // 搜尋過濾
  const filteredRoutines = useMemo(() => {
    const modeFiltered = routines.filter((routine) => {
      if (workbenchMode === "dated") return Boolean(routine.lastdate1);
      if (workbenchMode === "linked") return Boolean(routine.link);
      if (workbenchMode === "withPhoto") return Boolean(routine.photo);
      return true;
    });

    if (!searchQuery.trim()) return modeFiltered;
    const query = searchQuery.toLowerCase();
    return modeFiltered.filter(routine =>
      routine.name?.toLowerCase().includes(query) ||
      routine.note?.toLowerCase().includes(query)
    );
  }, [routines, searchQuery, workbenchMode]);

  const routinesWithDate = useMemo(() => routines.filter((routine) => Boolean(routine.lastdate1)), [routines]);
  const routinesWithLink = useMemo(() => routines.filter((routine) => Boolean(routine.link)), [routines]);
  const routinesWithPhoto = useMemo(() => routines.filter((routine) => Boolean(routine.photo)), [routines]);

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
      setSelectedIds(new Set(filteredRoutines.map(r => r.$id).filter(Boolean)));
    } else if (filteredRoutines.length > 0 && filteredRoutines.every(r => selectedIds.has(r.$id))) {
      setSelectedIds(new Set());
      setSelectionMode(false);
    } else {
      setSelectedIds(new Set(filteredRoutines.map(r => r.$id).filter(Boolean)));
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds).filter(id => !!id);
    setDeleteTotal(ids.length);
    setDeleteProgress(0);
    setIsDeleting(true);
    await Promise.all(ids.map(id =>
      fetchApi(`${API_ENDPOINTS.ROUTINE}/${id}`, { method: 'DELETE' })
        .catch(err => console.error("Delete failed:", err))
        .finally(() => setDeleteProgress(prev => prev + 1))
    ));
    setIsDeleting(false);
    setSelectedIds(new Set());
    setSelectionMode(false);
    setBulkDeleteOpen(false);
    setBulkDeleteInput("");
    fetchAll();
  };

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const getAppwriteHeaders = () => {
    if (typeof window === 'undefined') return {};
    const endpoint = localStorage.getItem('appwrite_endpoint');
    const project = localStorage.getItem('appwrite_project');
    const database = localStorage.getItem('appwrite_database');
    const apiKey = localStorage.getItem('appwrite_api_key');
    return {
      ...(endpoint && { 'X-Appwrite-Endpoint': endpoint }),
      ...(project && { 'X-Appwrite-Project': project }),
      ...(database && { 'X-Appwrite-Database': database }),
      ...(apiKey && { 'X-Appwrite-API-Key': apiKey }),
    };
  };

  const handlePhotoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB in bytes
    if (file.size > maxSize) {
      alert(`檔案大小超過限制（${Math.round(file.size / 1024 / 1024)}MB > 50MB）`);
      return;
    }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('只支援 JPG, PNG, GIF, WEBP 格式的圖片');
      return;
    }

    // Store file for later upload, create preview URL
    setSelectedPhotoFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPhotoPreviewUrl(objectUrl);
    // Clear the URL input when file is selected
    setForm({ ...form, photo: "" });
  };

  const uploadPhotoToAppwrite = async (file: File): Promise<string> => {
    setPhotoUploading(true);
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    try {
      const response = await fetch('/api/upload-image', {
        method: 'POST',
        headers: getAppwriteHeaders(),
        body: formDataUpload,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '圖片上傳失敗');
      }

      const data = await response.json();
      return data.url;
    } catch (error) {
      throw error;
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      alert("請輸入名稱");
      return;
    }

    try {
      let finalPhoto = form.photo;

      // 如果有選擇圖片檔案，上傳到 Appwrite
      if (selectedPhotoFile) {
        finalPhoto = await uploadPhotoToAppwrite(selectedPhotoFile);
      }

      const payload = {
        ...form,
        photo: finalPhoto,
        lastdate1: form.lastdate1 || null,
        lastdate2: form.lastdate2 || null,
        lastdate3: form.lastdate3 || null,
      };

      const success = editingId
        ? await update(editingId, payload)
        : await create(payload);

      if (success) {
        setForm(INITIAL_FORM);
        setEditingId(null);
        setIsFormOpen(false);
        setSelectedPhotoFile(null);
        setPhotoPreviewUrl("");
      }
    } catch (err) {
      alert("操作失敗：" + (err instanceof Error ? err.message : "請稍後再試"));
    }
  };

  const handleEdit = (routine: Routine) => {
    setForm({
      name: routine.name,
      note: routine.note || "",
      lastdate1: routine.lastdate1 ? routine.lastdate1.substring(0, 10) : "",
      lastdate2: routine.lastdate2 ? routine.lastdate2.substring(0, 10) : "",
      lastdate3: routine.lastdate3 ? routine.lastdate3.substring(0, 10) : "",
      link: routine.link || "",
      photo: routine.photo || "",
    });
    setEditingId(routine.$id);
    setIsFormOpen(true);
    setPhotoPreviewUrl(routine.photo || "");
    setSelectedPhotoFile(null);
  };

  const handleDelete = async (id: string) => {
    const routine = routines.find(r => r.$id === id);
    if (routine && confirm(`確定要刪除此例行事項嗎？\n\n注意：若包含圖片，將同時從Appwrite儲存空間永久刪除。`)) {
      await remove(id);
    }
  };

  // 開始行內編輯
  const handleInlineEdit = (routine: Routine) => {
    setInlineEditForm({
      name: routine.name || '',
      note: routine.note || '',
      lastdate1: routine.lastdate1 ? routine.lastdate1.substring(0, 10) : '',
      lastdate2: routine.lastdate2 ? routine.lastdate2.substring(0, 10) : '',
      lastdate3: routine.lastdate3 ? routine.lastdate3.substring(0, 10) : '',
      link: routine.link || '',
      photo: routine.photo || '',
    });
    setInlineEditingId(routine.$id);
  };

  // 儲存行內編輯
  const handleInlineSave = async (routineId: string) => {
    if (!inlineEditingId) return;
    try {
      await update(routineId, inlineEditForm);
      setInlineEditingId(null);
      setInlineEditForm(INITIAL_FORM);
    } catch (error) {
      console.error('Inline edit failed:', error);
      alert('更新失敗，請稍後再試');
    }
  };

  // 取消行內編輯
  const cancelInlineEdit = () => {
    setInlineEditingId(null);
    setInlineEditForm(INITIAL_FORM);
  };

  const handleShiftDates = async (routine: Routine) => {
    if (!routine.lastdate1) {
      alert("最近例行之一為空，無法執行日期遞移");
      return;
    }

    if (confirm(`確定要執行日期遞移嗎？

最近例行之一 → 最近例行之二
最近例行之二 → 最近例行之三
最近例行之一 → 清空`)) {
      const payload = {
        name: routine.name,
        note: routine.note || "",
        lastdate1: null,
        lastdate2: routine.lastdate1,
        lastdate3: routine.lastdate2 || null,
        link: routine.link || "",
        photo: routine.photo || "",
      };
      await update(routine.$id, payload);
    }
  };

  const handleCancel = () => {
    setForm(INITIAL_FORM);
    setEditingId(null);
    setIsFormOpen(false);
    setSelectedPhotoFile(null);
    setPhotoPreviewUrl("");
  };

  // CSV 匯入/匯出功能
  const [importPreview, setImportPreview] = useState<{ data: RoutineFormData[], errors: string[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const CSV_HEADERS = ['name', 'note', 'lastdate1', 'lastdate2', 'lastdate3', 'link', 'photo'];
  const EXPECTED_COLUMN_COUNT = CSV_HEADERS.length; // 7 欄

  const exportToCSV = () => {
    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`;
      return str;
    };
    const rows = [CSV_HEADERS.join(',')];
    routines.forEach(routine => {
      rows.push([escapeCSV(routine.name), escapeCSV(routine.note || ''), escapeCSV(routine.lastdate1 || ''), escapeCSV(routine.lastdate2 || ''), escapeCSV(routine.lastdate3 || ''), escapeCSV(routine.link || ''), escapeCSV(routine.photo || '')].join(','));
    });
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = getExportFilename('routine');
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = []; let current = ''; let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuotes) { if (char === '"') { if (line[i + 1] === '"') { current += '"'; i++; } else { inQuotes = false; } } else { current += char; } }
      else { if (char === '"') { inQuotes = true; } else if (char === ',') { result.push(current); current = ''; } else { current += char; } }
    }
    result.push(current); return result;
  };

  // 解析完整 CSV（處理多行欄位）
  const parseFullCSV = (text: string): string[][] => {
    const rows: string[][] = [];
    const cleanText = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    let currentRow: string[] = []; let currentField = ''; let inQuotes = false;
    for (let i = 0; i < cleanText.length; i++) {
      const char = cleanText[i];
      if (inQuotes) {
        if (char === '"') { if (cleanText[i + 1] === '"') { currentField += '"'; i++; } else { inQuotes = false; } }
        else { currentField += char; }
      } else {
        if (char === '"') { inQuotes = true; }
        else if (char === ',') { currentRow.push(currentField); currentField = ''; }
        else if (char === '\n') {
          currentRow.push(currentField);
          if (currentRow.length > 0 && currentRow.some(f => f.trim())) { rows.push(currentRow); }
          currentRow = []; currentField = '';
        } else { currentField += char; }
      }
    }
    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField);
      if (currentRow.some(f => f.trim())) { rows.push(currentRow); }
    }
    return rows;
  };

  const parseCSV = (text: string): { data: RoutineFormData[], errors: string[] } => {
    const errors: string[] = []; const data: RoutineFormData[] = [];
    const rows = parseFullCSV(text);
    if (rows.length < 2) { errors.push('CSV 檔案至少需要表頭和一行資料'); return { data, errors }; }
    const headerValues = rows[0].map(h => h.trim());
    if (headerValues.length !== EXPECTED_COLUMN_COUNT) {
      errors.push(`表頭欄位數量錯誤: 預期 ${EXPECTED_COLUMN_COUNT} 欄，實際 ${headerValues.length} 欄`);
      return { data, errors };
    }
    for (let i = 0; i < CSV_HEADERS.length; i++) {
      if (headerValues[i] !== CSV_HEADERS[i]) {
        errors.push(`表頭第 ${i + 1} 欄錯誤: 預期 "${CSV_HEADERS[i]}"，實際 "${headerValues[i]}"`);
        if (errors.length >= 5) { errors.push('...更多錯誤已省略'); break; }
      }
    }
    if (errors.length > 0) return { data, errors };
    for (let i = 1; i < rows.length; i++) {
      const values = rows[i]; const lineNum = i + 1;
      if (values.length !== EXPECTED_COLUMN_COUNT) { errors.push(`第 ${lineNum} 行: 欄位數量錯誤`); continue; }
      if (!values[0]?.trim()) { errors.push(`第 ${lineNum} 行: name 欄位不能為空`); continue; }
      data.push({ name: values[0].trim(), note: values[1]?.trim() || '', lastdate1: values[2]?.trim() || '', lastdate2: values[3]?.trim() || '', lastdate3: values[4]?.trim() || '', link: values[5]?.trim() || '', photo: values[6]?.trim() || '' });
    }
    return { data, errors };
  };

  const handleCSVFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!file.name.endsWith('.csv')) { alert('請選擇 CSV 檔案'); return; }
    const reader = new FileReader();
    reader.onload = (event) => { setImportPreview(parseCSV(event.target?.result as string)); };
    reader.readAsText(file, 'UTF-8'); e.target.value = '';
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
        const existing = routines.find(r => r.name === formData.name);
        if (existing) await update(existing.$id, formData); else await create(formData);
        successCount++;
      } catch { failCount++; }
    }

    // 匯入完成後統一重新載入一次
    await fetchAll();

    setImporting(false);
    setImportProgress({ current: 0, total: 0 });
    setImportPreview(null);
    alert(`匯入完成！\n成功: ${successCount} 筆\n失敗: ${failCount} 筆`);
  };

  const formatDateTime = (datetime: string | null) => {
    if (!datetime) return "-";
    return new Date(datetime).toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const calculateDaysDiff = (date1: string | null, date2: string | null): string => {
    if (!date1) return "-";

    const start = new Date(date1);
    const end = date2 ? new Date(date2) : new Date();

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return "-";

    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    if (end < start) return "-";

    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();
    let days = end.getDate() - start.getDate();

    if (days < 0) {
      months--;
      const lastDayPrevMonth = new Date(end.getFullYear(), end.getMonth(), 0).getDate();
      days += lastDayPrevMonth;
    }
    if (months < 0) {
      years--;
      months += 12;
    }

    const parts: string[] = [];
    if (years > 0) parts.push(`${years}年`);
    if (months > 0) parts.push(`${months}個月`);
    if (days > 0 || (years === 0 && months === 0)) parts.push(`${days}天`);

    return parts.join(" 又 ");
  };

  return (
    <div className="space-y-6">
      <FriendlyAiCrudShell
        title="鋒兄例行"
        description="把日常任務、最近完成時間與整理節奏放在同一個工作台，先看得出哪些有紀錄、哪些還缺上下文。"
        searchPlaceholder="搜尋名稱、備註..."
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeMode={workbenchMode}
        onModeChange={(mode) => setWorkbenchMode(mode as typeof workbenchMode)}
        modeItems={[
          { key: "all", label: "全部", count: routines.length },
          { key: "dated", label: "有最近日期", count: routinesWithDate.length },
          { key: "linked", label: "有連結", count: routinesWithLink.length },
          { key: "withPhoto", label: "有圖片", count: routinesWithPhoto.length },
        ]}
        summaries={[
          { label: "例行總數", value: routines.length, tone: "blue" },
          { label: "有日期", value: routinesWithDate.length, detail: "可追蹤最近完成", tone: "green" },
          { label: "有連結", value: routinesWithLink.length, detail: "可快速跳轉", tone: "neutral" },
          { label: "有圖片", value: routinesWithPhoto.length, detail: "辨識更直覺", tone: "amber" },
        ]}
        suggestions={[
          routines.length === 0
            ? { title: "先建立節奏", body: "先把每週或每天最常做的 3 到 5 個例行建進來，之後再慢慢補日期與連結。", tone: "green" }
            : { title: "優先補日期", body: `目前有 ${Math.max(routines.length - routinesWithDate.length, 0)} 筆沒有最近日期，AI 很難判斷哪些最久沒做。`, tone: routines.length - routinesWithDate.length > 0 ? "amber" : "green" },
          routinesWithLink.length < routines.length
            ? { title: "加快操作", body: "有操作流程的例行項目可補上連結，之後從清單就能直接跳轉。", tone: "blue" }
            : { title: "入口完整", body: "大多數例行都有對應入口，之後可再補提醒與排程邏輯。", tone: "green" },
          routinesWithPhoto.length > 0
            ? { title: "視覺整理", body: `已有 ${routinesWithPhoto.length} 筆使用圖片，可優先把高頻例行補圖，手機上更好辨識。`, tone: "neutral" }
            : { title: "手機優化", body: "如果常在手機上用，替高頻例行補圖會讓辨識和點擊都更快。", tone: "neutral" },
        ]}
        toolbar={
          <>
            <input type="file" accept=".csv" onChange={handleCSVFileSelect} className="hidden" id="csv-import-routine" />
            <Button onClick={() => document.getElementById('csv-import-routine')?.click()} variant="outline" className="rounded-xl flex items-center gap-2">
              <Upload size={18} /> 匯入
            </Button>
            <Button onClick={exportToCSV} variant="outline" className="rounded-xl flex items-center gap-2">
              <Download size={18} /> 匯出
            </Button>
            <Button onClick={handleSelectAll} variant="outline" className="rounded-xl flex items-center gap-2">
              {selectionMode && filteredRoutines.length > 0 && filteredRoutines.every((routine) => selectedIds.has(routine.$id)) ? "取消全選" : "全選"}
            </Button>
            {selectedIds.size > 0 && (
              <Button onClick={() => setBulkDeleteOpen(true)} className="rounded-xl flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white">
                <Trash2 size={18} />
                刪除選取 ({selectedIds.size})
              </Button>
            )}
            <Button onClick={() => setIsFormOpen(!isFormOpen)} className="w-full md:w-auto">
              <Plus size={18} className="mr-2" />
              {isFormOpen ? "收起表單" : "新增例行事項"}
            </Button>
          </>
        }
      />

      {error && (
        <DataCard className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <p className="text-red-600 dark:text-red-400 whitespace-pre-line">{error}</p>
        </DataCard>
      )}

      {!error && (
        <>
          {importPreview && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">匯入預覽</h3>
                  <p className="text-sm text-gray-500 mt-1">請確認以下資料是否正確</p>
                </div>
                <div className="p-6 overflow-y-auto max-h-[50vh]">
                  {importPreview.errors.length > 0 && (
                    <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                      <h4 className="font-semibold text-red-600 dark:text-red-400 mb-2">格式錯誤:</h4>
                      <ul className="text-sm text-red-600 dark:text-red-400 space-y-1">
                        {importPreview.errors.map((err, i) => <li key={i}>• {err}</li>)}
                      </ul>
                    </div>
                  )}
                  {importPreview.data.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-700 dark:text-gray-300">將匯入 {importPreview.data.length} 筆資料:</h4>
                      <div className="space-y-2">
                        {importPreview.data.map((item, i) => {
                          const existing = routines.find(r => r.name === item.name);
                          return (
                            <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                              <span className="font-medium text-gray-900 dark:text-gray-100">{item.name}</span>
                              {existing ? <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded">更新</span> : <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded">新增</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
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
                      <Button variant="outline" onClick={() => setImportPreview(null)} className="rounded-xl">取消</Button>
                      <Button onClick={executeImport} disabled={importPreview.data.length === 0 || importPreview.errors.length > 0} className="rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed">
                        確認匯入 ({importPreview.data.length} 筆)
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {isFormOpen && (
            <FormCard title={editingId ? "編輯例行事項" : "新增例行事項"}>
              <form onSubmit={handleSubmit}>
                <FormGrid columns={1} className="md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="block text-sm font-medium mb-2">
                      名稱 / Name <span className="text-red-500">*</span>
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Input
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="名稱 / Name (例如：晨跑、閱讀)"
                        maxLength={100}
                        required
                        className="h-12 rounded-xl sm:flex-1"
                      />
                      {existingNames.length > 0 && (
                        <Select
                          value=""
                          onValueChange={(val) => val && setForm({ ...form, name: val })}
                        >
                          <SelectTrigger className="h-12 w-full rounded-xl sm:w-36">
                            <SelectValue placeholder="套用既有名稱" />
                          </SelectTrigger>
                          <SelectContent>
                            {existingNames.map(name => (
                              <SelectItem key={name} value={name}>{name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div className="px-1 h-4">
                      {form.name ? (
                        <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">已輸入 / Entered</span>
                      ) : (
                        <span className="text-[10px] text-orange-600 dark:text-orange-400 font-medium">請輸入名稱 / Please enter name</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-sm font-medium mb-2">備註 / Note</label>
                    <Textarea
                      value={form.note}
                      onChange={(e) => setForm({ ...form, note: e.target.value })}
                      placeholder="額外說明 / Additional Description"
                      maxLength={100}
                      rows={3}
                      className="rounded-xl"
                    />
                    <div className="px-1 h-4">
                      {form.note ? (
                        <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">已輸入 / Entered</span>
                      ) : (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請輸入備註 / (Optional) Please enter note</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-sm font-medium mb-2">最近例行日期之一 / Last Date 1 (Recent)</label>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Input
                        type="date"
                        value={form.lastdate1}
                        onChange={(e) => setForm({ ...form, lastdate1: e.target.value })}
                        className="h-12 rounded-xl sm:flex-1"
                      />
                      {form.lastdate1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setForm({ ...form, lastdate1: "" })}
                          className="h-12 w-full rounded-xl px-0 sm:w-12"
                          title="清空日期"
                        >
                          <X size={16} />
                        </Button>
                      )}
                    </div>
                    <div className="px-1 h-4">
                      {form.lastdate1 ? (
                        <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">已選擇 / Selected</span>
                      ) : (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請選擇日期 / (Optional) Please select a date</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-sm font-medium mb-2">最近例行日期之二 / Last Date 2</label>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Input
                        type="date"
                        value={form.lastdate2}
                        onChange={(e) => setForm({ ...form, lastdate2: e.target.value })}
                        className="h-12 rounded-xl sm:flex-1"
                      />
                      {form.lastdate2 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setForm({ ...form, lastdate2: "" })}
                          className="h-12 w-full rounded-xl px-0 sm:w-12"
                          title="清空日期"
                        >
                          <X size={16} />
                        </Button>
                      )}
                    </div>
                    <div className="px-1 h-4">
                      {form.lastdate2 ? (
                        <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">已選擇 / Selected</span>
                      ) : (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請選擇日期 / (Optional) Please select a date</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-sm font-medium mb-2">最近例行日期之三 / Last Date 3 (Oldest)</label>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Input
                        type="date"
                        value={form.lastdate3}
                        onChange={(e) => setForm({ ...form, lastdate3: e.target.value })}
                        className="h-12 rounded-xl sm:flex-1"
                      />
                      {form.lastdate3 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setForm({ ...form, lastdate3: "" })}
                          className="h-12 w-full rounded-xl px-0 sm:w-12"
                          title="清空日期"
                        >
                          <X size={16} />
                        </Button>
                      )}
                    </div>
                    <div className="px-1 h-4">
                      {form.lastdate3 ? (
                        <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">已選擇 / Selected</span>
                      ) : (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請選擇日期 / (Optional) Please select a date</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-sm font-medium mb-2">連結 / Link</label>
                    <Input
                      type="url"
                      value={form.link}
                      onChange={(e) => setForm({ ...form, link: e.target.value })}
                      placeholder="https://..."
                      className="h-12 rounded-xl"
                    />
                    <div className="px-1 h-4">
                      {form.link ? (
                        <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">已輸入 / Entered</span>
                      ) : (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請輸入 URL / (Optional) Please enter URL</span>
                      )}
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2">圖片</label>
                    <div className="space-y-3">
                      {/* URL 輸入 */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">圖片網址</label>
                        <Input
                          type="url"
                          value={form.photo}
                          onChange={(e) => {
                            setForm({ ...form, photo: e.target.value });
                            setPhotoPreviewUrl(e.target.value);
                            setSelectedPhotoFile(null);
                          }}
                          placeholder="https://..."
                        />
                      </div>

                      {/* 或者上傳檔案 */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">或上傳圖片檔案（上限 50MB）</label>
                        <Input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                          onChange={handlePhotoFileSelect}
                        />
                        {selectedPhotoFile && (
                          <p className="text-xs text-gray-500 mt-1">
                            已選擇: {selectedPhotoFile.name} ({Math.round(selectedPhotoFile.size / 1024)}KB)
                          </p>
                        )}
                      </div>

                      {/* 預覽 */}
                      {photoPreviewUrl && (
                        <div className="mt-2">
                          <img
                            src={photoPreviewUrl}
                            alt="圖片預覽"
                            className="w-32 h-32 object-contain rounded border"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </FormGrid>

                <FormActions>
                  <Button type="submit" disabled={photoUploading}>
                    {photoUploading ? "上傳中..." : editingId ? "更新" : "新增"}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCancel} disabled={photoUploading}>
                    取消
                  </Button>
                </FormActions>
              </form>
            </FormCard>
          )}

          {!loading && routines.length === 0 ? (
            <EmptyState
              icon={<Calendar size={48} />}
              title="暫無例行事項"
              description="點擊上方按鈕新增第一筆例行事項"
            />
          ) : (
            <>
              {filteredRoutines.length === 0 ? (
                <EmptyState
                  icon={<Search size={48} />}
                  title="無搜尋結果"
                  description={`找不到「${searchQuery}」相關的例行事項`}
                />
              ) : (
                <>
                  {/* 桌面版表格 */}
                  <div className="hidden md:block">
                    <DataCard>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-8"></TableHead>
                            <TableHead>名稱</TableHead>
                            <TableHead>備註</TableHead>
                            <TableHead>圖片</TableHead>
                            <TableHead>最近例行之一</TableHead>
                            <TableHead>最近例行之二</TableHead>
                            <TableHead>相距天數</TableHead>
                            <TableHead>最近例行之三</TableHead>
                            <TableHead className="text-right">操作</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredRoutines.map((routine) => (
                            <TableRow key={routine.$id}>
                              {inlineEditingId === routine.$id ? (
                                // 行內編輯模式
                                <>
                                  <TableCell colSpan={9} className="bg-orange-50 dark:bg-orange-900/20">
                                    <div className="space-y-3 py-2">
                                      <div className="flex items-center gap-2 mb-2">
                                        <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">編輯中</span>
                                      </div>
                                      <div className="grid grid-cols-4 gap-3">
                                        <Input
                                          placeholder="名稱"
                                          value={inlineEditForm.name}
                                          onChange={(e) => setInlineEditForm({ ...inlineEditForm, name: e.target.value })}
                                          className="h-9 rounded-lg text-sm"
                                        />
                                        <Textarea
                                          placeholder="備註"
                                          value={inlineEditForm.note}
                                          onChange={(e) => setInlineEditForm({ ...inlineEditForm, note: e.target.value })}
                                          className="min-h-[72px] rounded-lg text-sm col-span-3 resize-y"
                                        />
                                      </div>
                                      <div className="grid grid-cols-4 gap-3">
                                        <Input
                                          placeholder="日期一"
                                          type="date"
                                          value={inlineEditForm.lastdate1}
                                          onChange={(e) => setInlineEditForm({ ...inlineEditForm, lastdate1: e.target.value })}
                                          className="h-9 rounded-lg text-sm"
                                        />
                                        <Input
                                          placeholder="日期二"
                                          type="date"
                                          value={inlineEditForm.lastdate2}
                                          onChange={(e) => setInlineEditForm({ ...inlineEditForm, lastdate2: e.target.value })}
                                          className="h-9 rounded-lg text-sm"
                                        />
                                      </div>
                                      <div className="grid grid-cols-4 gap-3">
                                        <Input
                                          placeholder="日期三"
                                          type="date"
                                          value={inlineEditForm.lastdate3}
                                          onChange={(e) => setInlineEditForm({ ...inlineEditForm, lastdate3: e.target.value })}
                                          className="h-9 rounded-lg text-sm"
                                        />
                                        <Input
                                          placeholder="連結"
                                          value={inlineEditForm.link}
                                          onChange={(e) => setInlineEditForm({ ...inlineEditForm, link: e.target.value })}
                                          className="h-9 rounded-lg text-sm"
                                        />
                                        <Input
                                          placeholder="圖片網址"
                                          value={inlineEditForm.photo}
                                          onChange={(e) => setInlineEditForm({ ...inlineEditForm, photo: e.target.value })}
                                          className="h-9 rounded-lg text-sm col-span-2"
                                        />
                                      </div>
                                      <div className="flex gap-2 justify-end">
                                        <Button size="sm" onClick={() => handleInlineSave(routine.$id)} className="bg-green-600 hover:bg-green-700 text-white rounded-lg">
                                          儲存
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={cancelInlineEdit} className="rounded-lg">
                                          取消
                                        </Button>
                                      </div>
                                    </div>
                                  </TableCell>
                                </>
                              ) : (
                                // 正常顯示模式
                                <>
                                  <TableCell>
                                    {selectionMode && (
                                      <input
                                        type="checkbox"
                                        checked={selectedIds.has(routine.$id)}
                                        onChange={() => handleToggleSelect(routine.$id)}
                                        className="h-4 w-4 rounded border-gray-300 text-red-600 cursor-pointer"
                                      />
                                    )}
                                  </TableCell>
                                  <TableCell className="font-medium">{routine.name}</TableCell>
                                  <TableCell>
                                    {routine.note && (
                                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 bg-gray-50 dark:bg-gray-800/50 p-2 rounded border border-gray-100 dark:border-gray-700 max-w-[250px] max-h-[150px] overflow-y-auto whitespace-pre-wrap break-all shadow-sm">
                                        {routine.note}
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {routine.photo ? (
                                      <img
                                        src={routine.photo}
                                        alt={routine.name}
                                        className="w-12 h-12 object-contain rounded"
                                      />
                                    ) : (
                                      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center">
                                        <Calendar size={20} className="text-gray-400" />
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell>{formatDateTime(routine.lastdate1)}</TableCell>
                                  <TableCell>{formatDateTime(routine.lastdate2)}</TableCell>
                                  <TableCell>{calculateDaysDiff(routine.lastdate1, routine.lastdate2)}</TableCell>
                                  <TableCell>{formatDateTime(routine.lastdate3)}</TableCell>
                                  <TableCell className="text-right space-x-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleShiftDates(routine)}
                                      disabled={!routine.lastdate1}
                                      title="日期遞移：一→二，二→三"
                                    >
                                      <ArrowRight size={16} />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleInlineEdit(routine)}
                                    >
                                      編輯
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => handleDelete(routine.$id)}
                                    >
                                      刪除
                                    </Button>
                                  </TableCell>
                                </>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </DataCard>
                  </div>

                  {/* 手機版卡片 */}
                  <div className="md:hidden space-y-4">
                    {filteredRoutines.map((routine) => (
                      <DataCard key={routine.$id}>
                        {inlineEditingId === routine.$id ? (
                          // 行內編輯模式
                          <div className="space-y-3 border-2 border-orange-500 rounded-lg p-4 -m-4">
                            <div className="text-sm font-semibold text-orange-600 dark:text-orange-400 mb-2">編輯中</div>
                            <Input
                              placeholder="例行事項名稱"
                              value={inlineEditForm.name}
                              onChange={(e) => setInlineEditForm({ ...inlineEditForm, name: e.target.value })}
                              className="h-9 rounded-lg text-sm"
                            />
                            <Textarea
                              placeholder="備註"
                              value={inlineEditForm.note}
                              onChange={(e) => setInlineEditForm({ ...inlineEditForm, note: e.target.value })}
                              className="rounded-lg text-sm h-16 resize-none"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                placeholder="日期一"
                                type="date"
                                value={inlineEditForm.lastdate1}
                                onChange={(e) => setInlineEditForm({ ...inlineEditForm, lastdate1: e.target.value })}
                                className="h-9 rounded-lg text-sm"
                              />
                              <Input
                                placeholder="日期二"
                                type="date"
                                value={inlineEditForm.lastdate2}
                                onChange={(e) => setInlineEditForm({ ...inlineEditForm, lastdate2: e.target.value })}
                                className="h-9 rounded-lg text-sm"
                              />
                            </div>
                            <Input
                              placeholder="日期三"
                              type="date"
                              value={inlineEditForm.lastdate3}
                              onChange={(e) => setInlineEditForm({ ...inlineEditForm, lastdate3: e.target.value })}
                              className="h-9 rounded-lg text-sm"
                            />
                            <Input
                              placeholder="連結"
                              value={inlineEditForm.link}
                              onChange={(e) => setInlineEditForm({ ...inlineEditForm, link: e.target.value })}
                              className="h-9 rounded-lg text-sm"
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleInlineSave(routine.$id)} className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-lg">
                                儲存
                              </Button>
                              <Button size="sm" variant="outline" onClick={cancelInlineEdit} className="flex-1 rounded-lg">
                                取消
                              </Button>
                            </div>
                          </div>
                        ) : (
                          // 正常顯示模式
                          <div className="space-y-3">
                            <div className="flex items-start gap-3">
                              {selectionMode && (
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(routine.$id)}
                                  onChange={() => handleToggleSelect(routine.$id)}
                                  className="h-4 w-4 rounded border-gray-300 text-red-600 cursor-pointer mt-1 shrink-0"
                                />
                              )}
                              {routine.photo ? (
                                <img
                                  src={routine.photo}
                                  alt={routine.name}
                                  className="w-16 h-16 object-contain rounded flex-shrink-0"
                                />
                              ) : (
                                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center flex-shrink-0">
                                  <Calendar size={24} className="text-gray-400" />
                                </div>
                              )}
                              <div className="flex-1">
                                <h3 className="font-semibold text-lg">{routine.name}</h3>
                              </div>
                            </div>
                            {routine.note && (
                              <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700 whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto shadow-inner">
                                {routine.note}
                              </div>
                            )}
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-500">最近例行之一:</span>
                                <span>{formatDateTime(routine.lastdate1)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">最近例行之二:</span>
                                <span>{formatDateTime(routine.lastdate2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">相距天數:</span>
                                <span>{calculateDaysDiff(routine.lastdate1, routine.lastdate2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">最近例行之三:</span>
                                <span>{formatDateTime(routine.lastdate3)}</span>
                              </div>
                            </div>
                            <div className="flex gap-2 pt-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleShiftDates(routine)}
                                disabled={!routine.lastdate1}
                                className="flex-1"
                                title="日期遞移：一→二，二→三"
                              >
                                <ArrowRight size={16} />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleInlineEdit(routine)}
                                className="flex-1"
                              >
                                編輯
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDelete(routine.$id)}
                                className="flex-1"
                              >
                                刪除
                              </Button>
                            </div>
                          </div>
                        )}
                      </DataCard>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </>
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
                即將刪除 <span className="font-bold text-red-600">{selectedIds.size}</span> 筆例行事項，此操作無法復原
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
                <code className="block bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg text-sm font-mono text-red-600">DELETE routine</code>
                <input
                  type="text"
                  value={bulkDeleteInput}
                  onChange={(e) => setBulkDeleteInput(e.target.value)}
                  placeholder="輸入 DELETE routine"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                />
              </div>
            )}
            <div className="p-6 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setBulkDeleteOpen(false); setBulkDeleteInput(""); }} disabled={isDeleting}>取消</Button>
              <Button
                onClick={handleBulkDelete}
                disabled={bulkDeleteInput !== "DELETE routine" || isDeleting}
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
