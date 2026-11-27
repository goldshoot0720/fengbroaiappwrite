"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Plus, CalendarDays, Download, Upload, History, LayoutGrid, Rows3, X, Trash2, AlertTriangle, RefreshCw, Pencil, ExternalLink, CheckCheck, ListChecks, ChevronDown, SlidersHorizontal, BookOpenCheck, FileImage } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DataCard } from "@/components/ui/data-card";
import { EmptyState } from "@/components/ui/empty-state";
import { useCrud, fetchApi } from "@/hooks/useApi";
import { playVoiceSuccessTone, useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { API_ENDPOINTS } from "@/lib/constants";
import { getAppwriteHeaders, getCurrentAccountLabel, getExportFilename } from "@/lib/utils";
import { shouldAutoExecuteVoiceRisk } from "@/lib/voicePreferences";
import { VoiceCommandBar } from "@/components/ui/voice-command-bar";

import { RecentSearchInput } from "@/components/ui/recent-search-input";
import styles from "./RoutineManagement.module.css";

const HISTORY = [
  { key: "lastdate1", label: "最近一次" },
  { key: "lastdate2", label: "前一次" },
  { key: "lastdate3", label: "再前一次" },
] as const;

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

const getRoutineDateTime = (date: string | null) => {
  if (!date) return 0;
  const time = new Date(date).getTime();
  return Number.isNaN(time) ? 0 : time;
};

type VoiceRisk = "safe" | "review" | "danger";
type RoutineVoiceAction =
  | "refresh"
  | "exportCsv"
  | "importCsv"
  | "search"
  | "selectAll"
  | "clearSelection"
  | "add"
  | "filterAll"
  | "filterDated"
  | "filterLinked"
  | "filterPhoto"
  | "viewTable"
  | "viewCards"
  | "deleteSelected"
  | "noop";

type RoutineVoiceCommand = {
  action: RoutineVoiceAction;
  summary: string;
  risk: VoiceRisk;
  query?: string;
};

const ROUTINE_VOICE_HELP =
  "可說：重新整理、匯出 CSV、搜尋 倒垃圾、有日期、有連結、列表、卡片、新增、全選、刪除選取。說完會自動結束。";

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
  const [saving, setSaving] = useState(false);
  const editor = useRef<HTMLDialogElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const dialog = editor.current;
    if (isFormOpen && dialog) {
      dialog.showModal();
      nameInput.current?.focus({ preventScroll: true });
      return () => dialog.close();
    }
  }, [isFormOpen]);
  useEffect(() => {
    if (photoPreviewUrl.startsWith("blob:")) return () => URL.revokeObjectURL(photoPreviewUrl);
  }, [photoPreviewUrl]);
  const [searchQuery, setSearchQuery] = useState("");
  const [workbenchMode, setWorkbenchMode] = useState<"all" | "dated" | "linked" | "withPhoto">("all");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Bulk selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteInput, setBulkDeleteInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [deleteTotal, setDeleteTotal] = useState(0);
  const [voiceFeedback, setVoiceFeedback] = useState(ROUTINE_VOICE_HELP);
  const [pendingVoiceCommand, setPendingVoiceCommand] = useState<RoutineVoiceCommand | null>(null);
  const handleVoiceTextRef = useRef<(text: string) => void>(() => {});
  const {
    isSupported: isVoiceSupported,
    isListening: isVoiceListening,
    transcript: voiceTranscript,
    setTranscript: setVoiceTranscript,
    elapsedMs: voiceElapsedMs,
    canStop: canStopVoiceRecording,
    toggle: toggleVoiceInput,
  } = useSpeechRecognition({
    mode: "phrase",
    onResult: (text) => handleVoiceTextRef.current(text),
    onEmptyResult: () => setVoiceFeedback("沒有聽清楚，請再說一次，或直接輸入文字指令。"),
    onInterrupted: () => setVoiceFeedback("錄音已結束。可再按麥克風，或直接輸入指令。"),
    onError: (message) => setVoiceFeedback(message),
    onStart: () => {
      setPendingVoiceCommand(null);
      setVoiceFeedback("正在聽…說完停頓會自動結束，也可按「說完了」。");
    },
  });

  // 搜尋過濾
  const filteredRoutines = useMemo(() => {
    const modeFiltered = routines.filter((routine) => {
      if (workbenchMode === "dated") return Boolean(routine.lastdate1);
      if (workbenchMode === "linked") return Boolean(routine.link);
      if (workbenchMode === "withPhoto") return Boolean(routine.photo);
      return true;
    });

    const searchFiltered = !searchQuery.trim()
      ? modeFiltered
      : modeFiltered.filter(routine => {
        const query = searchQuery.trim().toLowerCase();
        return (
          routine.name?.toLowerCase().includes(query) ||
          routine.note?.toLowerCase().includes(query)
        );
      });

    return [...searchFiltered].sort((a, b) => getRoutineDateTime(b.lastdate1) - getRoutineDateTime(a.lastdate1));
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
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      alert("請輸入名稱");
      return;
    }

    if (saving) return;
    setSaving(true);
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
    } finally {
      setSaving(false);
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

  const handleShiftDates = async (routine: Routine) => {
    if (!routine.lastdate1) {
      alert("最近①為空，無法執行日期遞移");
      return;
    }

    if (confirm(`確定要執行日期遞移嗎？

最近① → 最近②
最近② → 最近③
最近① → 清空`)) {
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
        const saved = existing ? await update(existing.$id, formData) : await create(formData);
        if (saved) successCount++;
        else failCount++;
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

  const calculateAbsoluteDayDiff = (date1: string | null, date2: string | null): number | null => {
    if (!date1 || !date2) return null;

    const first = new Date(date1);
    const second = new Date(date2);

    if (Number.isNaN(first.getTime()) || Number.isNaN(second.getTime())) return null;

    first.setHours(0, 0, 0, 0);
    second.setHours(0, 0, 0, 0);

    return Math.abs(Math.round((second.getTime() - first.getTime()) / (1000 * 60 * 60 * 24)));
  };

  const formatRoutineElapsed = (startDate: string | null, endDate: string | null = null): string => {
    if (calculateDaysDiff(startDate, endDate) === "-") return "-";

    const start = new Date(startDate!);
    const finish = endDate ? new Date(endDate) : new Date();
    let years = finish.getFullYear() - start.getFullYear();
    let months = finish.getMonth() - start.getMonth();
    let days = finish.getDate() - start.getDate();

    if (days < 0) {
      months--;
      days += new Date(finish.getFullYear(), finish.getMonth(), 0).getDate();
    }

    if (months < 0) {
      years--;
      months += 12;
    }

    const startAtMidnight = new Date(start);
    const finishAtMidnight = new Date(finish);
    startAtMidnight.setHours(0, 0, 0, 0);
    finishAtMidnight.setHours(0, 0, 0, 0);
    const totalDays = Math.round((finishAtMidnight.getTime() - startAtMidnight.getTime()) / (1000 * 60 * 60 * 24));

    return `${years}年又${months}月又${days}天（${totalDays}天）`;
  };

  const normalizeRoutineLink = (rawLink: string | null | undefined) => {
    const trimmed = rawLink?.trim();
    if (!trimmed) return "";

    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^[^\s]+\.[^\s]+/.test(trimmed)) return `https://${trimmed}`;

    return "";
  };

  const parseRoutineVoiceCommand = (text: string): RoutineVoiceCommand => {
    const normalized = text.trim();
    const lower = normalized.toLowerCase();

    if (/匯入.*csv|csv.*匯入|import.*csv/i.test(normalized)) {
      return { action: "importCsv", summary: "開啟例行 CSV 檔案選擇器，選檔後仍會預覽確認。", risk: "review" };
    }
    if (/匯出.*csv|csv.*匯出|export.*csv/i.test(normalized)) {
      return { action: "exportCsv", summary: `匯出目前 ${routines.length} 筆例行事項為 CSV。`, risk: "safe" };
    }
    if (/重新整理|刷新|reload|refresh/i.test(normalized)) {
      return { action: "refresh", summary: "重新載入例行事項。", risk: "safe" };
    }
    if (/取消全選|清除選取|clear selection/i.test(normalized)) {
      return { action: "clearSelection", summary: `取消目前 ${selectedIds.size} 筆選取。`, risk: "safe" };
    }
    if (/全選|select all/i.test(normalized)) {
      return { action: "selectAll", summary: `選取目前篩選結果 ${filteredRoutines.length} 筆。`, risk: "review" };
    }
    if (/有日期|最近日期|dated/i.test(normalized)) {
      return { action: "filterDated", summary: "篩選有最近日期的例行。", risk: "safe" };
    }
    if (/有連結|有網址|linked/i.test(normalized)) {
      return { action: "filterLinked", summary: "篩選有連結的例行。", risk: "safe" };
    }
    if (/有圖|有圖片|with photo|photo/i.test(normalized)) {
      return { action: "filterPhoto", summary: "篩選有圖片的例行。", risk: "safe" };
    }
    if (/全部|顯示全部|清除篩選/i.test(normalized)) {
      return { action: "filterAll", summary: "顯示全部例行事項。", risk: "safe" };
    }
    if (/卡片|card view|cards/i.test(normalized)) {
      return { action: "viewCards", summary: "切換到卡片檢視。", risk: "safe" };
    }
    if (/列表|表格|table/i.test(normalized)) {
      return { action: "viewTable", summary: "切換到列表檢視。", risk: "safe" };
    }
    if (/新增|建立|add|create/i.test(normalized)) {
      return { action: "add", summary: "開啟新增例行事項表單。", risk: "review" };
    }
    if (/刪除選取|批次刪除|delete selected/i.test(normalized)) {
      return {
        action: "deleteSelected",
        summary: `開啟刪除選取確認（${selectedIds.size} 筆）。`,
        risk: "danger",
      };
    }
    if (/搜尋|查找|search|find/i.test(lower)) {
      const query = normalized.replace(/搜尋|查找|search|find/gi, " ").replace(/\s+/g, " ").trim();
      return query
        ? { action: "search", summary: `搜尋例行關鍵字「${query}」。`, risk: "safe", query }
        : { action: "noop", summary: "請在搜尋後面加上關鍵字，例如：搜尋 倒垃圾。", risk: "safe" };
    }
    return {
      action: "noop",
      summary: "聽到了，但還不確定。可試：重新整理、有日期、搜尋 倒垃圾、列表、匯出 CSV。",
      risk: "safe",
    };
  };

  const executeRoutineVoiceCommand = async (command: RoutineVoiceCommand) => {
    setPendingVoiceCommand(null);
    setVoiceFeedback(`執行中：${command.summary}`);
    try {
      switch (command.action) {
        case "refresh":
          await fetchAll(true);
          break;
        case "exportCsv":
          exportToCSV();
          break;
        case "importCsv":
          document.getElementById("csv-import-routine")?.click();
          break;
        case "search":
          setSearchQuery(command.query || "");
          break;
        case "selectAll":
          handleSelectAll();
          break;
        case "clearSelection":
          setSelectedIds(new Set());
          setSelectionMode(false);
          break;
        case "add":
          setIsFormOpen(true);
          break;
        case "filterAll":
          setWorkbenchMode("all");
          break;
        case "filterDated":
          setWorkbenchMode("dated");
          break;
        case "filterLinked":
          setWorkbenchMode("linked");
          break;
        case "filterPhoto":
          setWorkbenchMode("withPhoto");
          break;
        case "viewTable":
          setViewMode("table");
          break;
        case "viewCards":
          setViewMode("cards");
          break;
        case "deleteSelected":
          if (selectedIds.size === 0) {
            setVoiceFeedback("目前沒有選取項目可刪除。");
            return;
          }
          setBulkDeleteOpen(true);
          break;
        case "noop":
        default:
          break;
      }
      setVoiceFeedback(`完成：${command.summary}`);
    } catch (error) {
      setVoiceFeedback(error instanceof Error ? `執行失敗：${error.message}` : "執行失敗，請再試一次。");
    }
  };

  const handleVoiceText = (text: string) => {
    const cleaned = text.trim();
    if (!cleaned) {
      setVoiceFeedback("請先輸入或說出指令。");
      return;
    }
    const command = parseRoutineVoiceCommand(cleaned);
    setVoiceTranscript(cleaned);
    setVoiceFeedback(command.summary);
    if (shouldAutoExecuteVoiceRisk(command.risk)) {
      playVoiceSuccessTone();
      void executeRoutineVoiceCommand(command);
    } else {
      setPendingVoiceCommand(command);
    }
  };
  useEffect(() => { handleVoiceTextRef.current = handleVoiceText; });

  const today = new Date();
  const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (today.getDay() + 6) % 7);
  const dayKey = (date: Date) => date.toLocaleDateString("zh-TW");
  const week = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + index);
    return { day, key: dayKey(day), count: 0 };
  });
  for (const routine of routines) {
    for (const { key } of HISTORY) {
      const value = routine[key];
      if (!value) continue;
      const match = week.find(entry => entry.key === dayKey(new Date(value)));
      if (match) match.count++;
    }
  }
  const totalThisWeek = week.reduce((sum, entry) => sum + entry.count, 0);
  const modes = [
    { key: "all", label: "全部", count: routines.length },
    { key: "dated", label: "有最近日期", count: routinesWithDate.length },
    { key: "linked", label: "有連結", count: routinesWithLink.length },
    { key: "withPhoto", label: "有圖片", count: routinesWithPhoto.length },
  ] as const;
  const isFiltered = Boolean(searchQuery.trim()) || workbenchMode !== "all";

  return (
    <div className={styles.workspace}>
      <header className={styles.cover}>
        <div className={styles.coverIntro}>
          <h1>鋒兄例行</h1>
          <div className={styles.dateline}><CalendarDays size={16} aria-hidden="true" />{today.toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}</div>
          <div className={styles.byline}>
            <span>{getCurrentAccountLabel()}</span>
            <span role="status">{loading ? "讀取中…" : error ? "同步異常" : "已同步"}</span>
          </div>
        </div>
        <section className={styles.week} aria-label="本週完成紀錄">
          <div className={styles.weekTitle}><h2>本週紀錄</h2><span>{totalThisWeek} 筆</span></div>
          <ol>{week.map(({ day, key, count }) => (
            <li key={key} aria-current={key === dayKey(today) ? "date" : undefined} aria-label={key + "，" + count + " 筆紀錄"} title={key + "，" + count + " 筆紀錄"}>
              <span>{["日","一","二","三","四","五","六"][day.getDay()]}</span>
              <strong>{day.getDate()}</strong><small>{count > 0 ? `${count} 筆` : ""}</small>
            </li>
          ))}</ol>
        </section>
      </header>

      <section className={styles.ledger} aria-labelledby="routine-index">
        <div className={styles.indexHead}>
          <div className={styles.heading}><h2 id="routine-index">例行清單</h2><span aria-live="polite">{isFiltered ? filteredRoutines.length + " / " : ""}{routines.length} 項</span></div>
          <button type="button" className={styles.add} onClick={() => setIsFormOpen(true)}><Plus size={18} />新增例行事項</button>
        </div>
        <div className={styles.controls}>
          <RecentSearchInput value={searchQuery} onChange={setSearchQuery} placeholder="搜尋名稱或備註" storageKey="routine-management" showRecentSearches={false} />
          <div className={styles.segment} role="group" aria-label="顯示方式">
            <button type="button" aria-label="列表" title="列表" aria-pressed={viewMode === "table"} onClick={() => setViewMode("table")}><Rows3 size={16} /><span>列表</span></button>
            <button type="button" aria-label="卡片" title="卡片" aria-pressed={viewMode === "cards"} onClick={() => setViewMode("cards")}><LayoutGrid size={16} /><span>卡片</span></button>
          </div>
        </div>
        <div className={styles.filters} role="group" aria-label="篩選例行事項">
          {modes.map(mode => <button type="button" key={mode.key} aria-pressed={workbenchMode === mode.key} onClick={() => setWorkbenchMode(mode.key)}>{mode.label}<span>{mode.count}</span></button>)}
        </div>
        <details className={styles.tools}>
          <summary><SlidersHorizontal size={16} />管理工具<ChevronDown size={15} /></summary>
          <div className={styles.toolBody}>
            <div className={styles.toolButtons}>
              <Button variant="outline" disabled={loading} onClick={() => fetchAll(true)}><RefreshCw size={15} />重新整理</Button>
              <Button variant="outline" onClick={() => document.getElementById("csv-import-routine")?.click()}><Upload size={15} />匯入 CSV</Button>
              <Button variant="outline" onClick={exportToCSV}><Download size={15} />匯出 CSV</Button>
              <Button variant="outline" onClick={handleSelectAll} disabled={!filteredRoutines.length}><CheckCheck size={16} />{selectionMode && filteredRoutines.length > 0 && filteredRoutines.every(r => selectedIds.has(r.$id)) ? "取消全選" : "全選"}</Button>
            </div>
            <div className={styles.assistants}>
              <VoiceCommandBar
                title="例行語音指令"
                description=""
                helpText={ROUTINE_VOICE_HELP}
                accent="emerald"
                transcript={voiceTranscript}
                onTranscriptChange={(value) => {
                  setVoiceTranscript(value);
                  setPendingVoiceCommand(null);
                }}
                feedback={voiceFeedback}
                isListening={isVoiceListening}
                isSupported={isVoiceSupported}
                canStop={canStopVoiceRecording}
                elapsedMs={voiceElapsedMs}
                placeholder="例：搜尋 倒垃圾 / 有日期 / 列表 / 匯出 CSV"
                samples={["有日期", "有連結", "列表", "重新整理"]}
                pending={pendingVoiceCommand}
                onToggleListen={toggleVoiceInput}
                onSubmit={handleVoiceText}
                onConfirm={() => {
                  if (pendingVoiceCommand) void executeRoutineVoiceCommand(pendingVoiceCommand);
                }}
                onCancelPending={() => setPendingVoiceCommand(null)}
              />
              <details className={styles.tip}>
                <summary><ListChecks size={16} />整理提示<ChevronDown size={15} /></summary>
                <p>{!routines.length ? "新增第一筆例行事項，並填寫最近完成日期。" : routines.length > routinesWithDate.length ? `還有 ${routines.length - routinesWithDate.length} 項沒有最近完成日期，可在編輯時補上。` : "所有事項都已填寫最近完成日期。"}</p>
                <p>有固定流程的事項可附上連結，常用物品可附照片，方便下次查找。</p>
              </details>
            </div>
          </div>
        </details>
        <input type="file" accept=".csv" onChange={handleCSVFileSelect} hidden id="csv-import-routine" />
        {selectionMode && <div className={styles.selection}>
          <strong>已選 {selectedIds.size} 項</strong>
          <button type="button" onClick={() => { setSelectedIds(new Set()); setSelectionMode(false); }}>取消選取</button>
          <button type="button" disabled={!selectedIds.size} onClick={() => setBulkDeleteOpen(true)}><Trash2 size={15}/>刪除選取</button>
        </div>}

      {error && (
        <DataCard className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <p role="alert" className="text-red-600 dark:text-red-400 whitespace-pre-line">{error}</p>
          <Button variant="outline" onClick={() => fetchAll(true)} disabled={loading}>重試</Button>
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
                <div className="flex flex-col gap-3 border-t border-gray-200 p-6 dark:border-gray-700 sm:flex-row sm:justify-end">
                  {importing ? (
                    <div className="flex items-center gap-3">
                      <div className="w-48 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        匯入中 {importProgress.current}/{importProgress.total}
                      </span>
                    </div>
                  ) : (
                    <>
                      <Button variant="outline" onClick={() => setImportPreview(null)} className="rounded-xl w-full sm:w-auto">取消</Button>
                      <Button onClick={executeImport} disabled={importPreview.data.length === 0 || importPreview.errors.length > 0} className="rounded-xl w-full sm:w-auto">
                        確認匯入 ({importPreview.data.length} 筆)
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {loading && !routines.length ? (
            <p role="status" className={styles.notice}>正在讀取例行事項…</p>
          ) : !filteredRoutines.length ? (
            <EmptyState icon={<CalendarDays size={28}/>} title={isFiltered ? "找不到符合條件的事項" : "還沒有例行事項"}
              action={isFiltered ? <Button variant="outline" onClick={() => { setSearchQuery(""); setWorkbenchMode("all"); }}>清除篩選</Button> : <Button onClick={() => setIsFormOpen(true)}>新增第一筆事項</Button>} />
          ) : (
            <div className={viewMode === "cards" ? styles.cards : styles.list}>
              {viewMode === "table" && <div className={styles.columns} aria-hidden="true">
                <span>事項名稱</span><div>{HISTORY.map(({ label }) => <span key={label}>{label}</span>)}</div><span>操作</span>
              </div>}
              <ul className={styles.records}>
                {filteredRoutines.map(routine => {
                  const link = normalizeRoutineLink(routine.link);
                  return <li key={routine.$id} className={styles.record} data-selected={selectionMode && selectedIds.has(routine.$id)}>
                    <div className={styles.identity}>
                      {selectionMode && <input type="checkbox" aria-label={"選取 " + routine.name} checked={selectedIds.has(routine.$id)} onChange={() => handleToggleSelect(routine.$id)} />}
                      <div className={styles.thumb}>{routine.photo ? <img src={routine.photo} alt="" loading="lazy" /> : <BookOpenCheck size={20} />}</div>
                      <div>
                        <h3>{link ? <a href={link} target="_blank" rel="noopener noreferrer">{routine.name} <ExternalLink size={13} /></a> : routine.name}</h3>
                        {routine.note && <p>{routine.note}</p>}
                      </div>
                    </div>
                    <dl className={styles.history}>{HISTORY.map(({ key, label }, index) => {
                      const value = routine[key];
                      const reference = index ? routine[HISTORY[index - 1].key] : today.toISOString();
                      const days = calculateAbsoluteDayDiff(value, reference);
                      return <div key={key}>
                        <dt>{label}</dt>
                        <dd title={value && reference ? formatRoutineElapsed(value, reference) : undefined}>
                          {value ? <time dateTime={value}>{formatDateTime(value)}</time> : <span className={styles.missing}>未記錄</span>}
                          {days !== null && <small>{index ? `間隔 ${days} 天` : days === 0 ? "今天" : `距今 ${days} 天`}</small>}
                        </dd>
                      </div>;
                    })}</dl>
                    <div className={styles.actions}>
                      <button type="button" onClick={() => handleShiftDates(routine)} disabled={!routine.lastdate1} title="將前兩次日期各往前移一格，清空最近一次" aria-label={"日期遞移 " + routine.name}><History size={16}/><span>日期遞移</span></button>
                      <button type="button" onClick={() => handleEdit(routine)} aria-label={"編輯 " + routine.name}><Pencil size={15}/><span>編輯</span></button>
                      <button type="button" className={styles.delete} onClick={() => handleDelete(routine.$id)} aria-label={"刪除 " + routine.name} title="刪除"><Trash2 size={15}/></button>
                    </div>
                  </li>;
                })}
              </ul>
            </div>
          )}
        </>
      )}
      </section>

      {isFormOpen && (
        <dialog ref={editor} className={styles.editor} aria-labelledby="routine-editor-title"
          onCancel={event => { event.preventDefault(); if (!saving) handleCancel(); }}>
          <form onSubmit={handleSubmit}>
            <header className={styles.editorHead}>
              <div><BookOpenCheck size={20} /><h2 id="routine-editor-title">{editingId ? "編輯例行事項" : "新增例行事項"}</h2></div>
              <button type="button" onClick={handleCancel} disabled={saving} aria-label="關閉表單"><X size={19} /></button>
            </header>
            <div className={styles.editorBody}>
              <label htmlFor="routine-name">事項名稱 <small>必填</small></label>
              <Input ref={nameInput} id="routine-name" required maxLength={100} list="routine-names" value={form.name} placeholder="例如：更換濾芯" onChange={e => setForm({ ...form, name: e.target.value })} />
              <datalist id="routine-names">{existingNames.map(name => <option value={name} key={name} />)}</datalist>
              <label htmlFor="routine-note">備註</label>
              <Textarea id="routine-note" rows={2} maxLength={100} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
              <fieldset className={styles.dateFields}>
                <legend><CalendarDays size={16}/>完成紀錄</legend>
                <div>{HISTORY.map(({ key, label }) => <div key={key}>
                  <label htmlFor={"routine-" + key}>{label}</label>
                  <div className={styles.dateInput}><input id={"routine-" + key} type="date" value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} />
                  <button type="button" disabled={!form[key]} aria-label={"清空" + label} onClick={() => setForm({ ...form, [key]: "" })}><X size={14}/></button></div>
                </div>)}</div>
              </fieldset>
              <label htmlFor="routine-link">相關連結</label>
              <Input id="routine-link" inputMode="url" placeholder="https://…" value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} />
              <details className={styles.attachments}>
                <summary><FileImage size={16} />圖片附件{(selectedPhotoFile || form.photo) && <span>1</span>}<ChevronDown size={15}/></summary>
                <label htmlFor="routine-photo">圖片網址</label>
                <Input type="url" id="routine-photo" placeholder="https://…" value={form.photo} onChange={e => { setForm({...form, photo:e.target.value}); setPhotoPreviewUrl(e.target.value); setSelectedPhotoFile(null); }} />
                <label htmlFor="routine-upload">上傳圖片 <small>上限 50 MB</small></label>
                <Input id="routine-upload" type="file" accept="image/jpeg,image/jpg,image/png,image/gif,image/webp" onChange={handlePhotoFileSelect}/>
                {photoPreviewUrl && <img className={styles.preview} src={photoPreviewUrl} alt="圖片預覽" />}
              </details>
              {error && <p role="alert">{error}</p>}
            </div>
            <footer className={styles.editorFoot}>
              <button type="button" onClick={handleCancel} disabled={saving}>取消</button>
              <button type="submit" className={styles.add} disabled={saving}>{saving ? "儲存中…" : editingId ? "儲存" : "新增"}</button>
            </footer>
          </form>
        </dialog>
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
                    className="bg-destructive h-2.5 rounded-full"
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
            <div className="flex flex-col gap-3 border-t border-gray-100 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] dark:border-gray-800 sm:flex-row sm:justify-end">
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
