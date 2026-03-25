"use client";

import { useState, useEffect, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Plus, Minus, ChevronDown, ChevronUp, Search, Download, Upload, X, Trash2, Pencil, Check, Square, CheckSquare, AlertTriangle, Sparkles, PackageOpen, Refrigerator, CalendarClock, Flame, ShoppingBasket, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionHeader } from "@/components/ui/section-header";
import { FormCard, FormGrid, FormActions } from "@/components/ui/form-card";
import { DataCard } from "@/components/ui/data-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FullPageLoading } from "@/components/ui/loading-spinner";
import { StatusBadge } from "@/components/ui/status-badge";
import { useFoods, getFoodExpiryInfo } from "@/hooks/useFoods";
import { fetchApi } from "@/hooks/useApi";
import { API_ENDPOINTS } from "@/lib/constants";
import { FoodFormData, Food } from "@/types";
import { formatDate, formatDaysRemaining } from "@/lib/formatters";
import { getExportFilename } from "@/lib/utils";

const INITIAL_FORM: FoodFormData = { name: "", amount: 0, todate: "", photo: "", price: 0, shop: "", photohash: "" };
const QUICK_ADD_PRESETS: Record<string, { label: string; amount?: number; days: number; shop?: string }> = {
  milk: { label: "牛奶", amount: 1, days: 7, shop: "冷藏" },
  egg: { label: "雞蛋", amount: 10, days: 14, shop: "冷藏" },
  bread: { label: "吐司", amount: 1, days: 3, shop: "常溫" },
  yogurt: { label: "優格", amount: 1, days: 7, shop: "冷藏" },
  rice: { label: "即食飯", amount: 1, days: 30, shop: "常溫" },
};

type FilterMode = "all" | "expired" | "today" | "3days" | "7days" | "normal";
type CleanupAction = "eat" | "discard" | "delete";

function addDaysToDate(baseDate: string, days: number) {
  if (!baseDate) return "";
  const date = new Date(baseDate);
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

function getSuggestedExpiryDate(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

function getExpiryBucket(daysRemaining: number): FilterMode {
  if (daysRemaining < 0) return "expired";
  if (daysRemaining === 0) return "today";
  if (daysRemaining <= 3) return "3days";
  if (daysRemaining <= 7) return "7days";
  return "normal";
}

export default function FoodManagement() {
  const { foods, loading, error, createFood, updateFood, deleteFood, updateAmount, loadFoods } = useFoods();
  const [form, setForm] = useState<FoodFormData>(INITIAL_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string>("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [quickAddForm, setQuickAddForm] = useState<FoodFormData>({
    ...INITIAL_FORM,
    amount: 1,
    todate: getSuggestedExpiryDate(7),
  });

  // Inline editing state
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineEditForm, setInlineEditForm] = useState<FoodFormData>(INITIAL_FORM);
  const [inlineSelectedPhotoFile, setInlineSelectedPhotoFile] = useState<File | null>(null);
  const [inlinePhotoPreviewUrl, setInlinePhotoPreviewUrl] = useState<string>("");
  const [inlinePhotoUploading, setInlinePhotoUploading] = useState(false);

  // Inline add state
  const [isInlineAdding, setIsInlineAdding] = useState(false);
  const [inlineAddForm, setInlineAddForm] = useState<FoodFormData>(INITIAL_FORM);
  const [inlineAddSelectedPhotoFile, setInlineAddSelectedPhotoFile] = useState<File | null>(null);
  const [inlineAddPhotoPreviewUrl, setInlineAddPhotoPreviewUrl] = useState<string>("");
  const [inlineAddPhotoUploading, setInlineAddPhotoUploading] = useState(false);

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);

  // Selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteInput, setBulkDeleteInput] = useState("");
  const [cleanupAction, setCleanupAction] = useState<CleanupAction>("discard");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [deleteTotal, setDeleteTotal] = useState(0);
  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  // 取得已存在的不重複商店
  const existingShops = useMemo(() => {
    const shops = foods.map(f => f.shop).filter(Boolean) as string[];
    return Array.from(new Set(shops)).sort();
  }, [foods]);

  // 取得已存在的不重複食品名稱
  const existingNames = useMemo(() => {
    const names = foods.map(f => f.name).filter(Boolean);
    return Array.from(new Set(names)).sort();
  }, [foods]);

  const filterCounts = useMemo(() => {
    return foods.reduce(
      (acc, food) => {
        const bucket = getExpiryBucket(getFoodExpiryInfo(food).daysRemaining);
        acc.all += 1;
        acc[bucket] += 1;
        return acc;
      },
      { all: 0, expired: 0, today: 0, "3days": 0, "7days": 0, normal: 0 } as Record<FilterMode, number>
    );
  }, [foods]);

  // 搜尋 + 分區過濾
  const filteredFoods = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return foods.filter((food) => {
      const matchesQuery = !searchQuery.trim() ||
        food.name?.toLowerCase().includes(query) ||
        food.shop?.toLowerCase().includes(query);
      const bucket = getExpiryBucket(getFoodExpiryInfo(food).daysRemaining);
      const matchesFilter = filterMode === "all" ? true : bucket === filterMode;
      return matchesQuery && matchesFilter;
    });
  }, [foods, searchQuery, filterMode]);

  const dashboardStats = useMemo(() => {
    const expired = foods.filter((food) => getFoodExpiryInfo(food).daysRemaining < 0);
    const today = foods.filter((food) => getFoodExpiryInfo(food).daysRemaining === 0);
    const expiring3Days = foods.filter((food) => {
      const days = getFoodExpiryInfo(food).daysRemaining;
      return days >= 0 && days <= 3;
    });
    const expiring7Days = foods.filter((food) => {
      const days = getFoodExpiryInfo(food).daysRemaining;
      return days >= 0 && days <= 7;
    });
    const lowStock = foods.filter((food) => (food.amount || 0) <= 1);
    const totalValue = foods.reduce((sum, food) => sum + (food.price || 0) * (food.amount || 0), 0);

    return {
      expired,
      today,
      expiring3Days,
      expiring7Days,
      lowStock,
      totalValue,
    };
  }, [foods]);

  const aiInsights = useMemo(() => {
    const urgentFoods = foods
      .map((food) => ({ food, info: getFoodExpiryInfo(food) }))
      .filter(({ info }) => info.daysRemaining <= 3)
      .sort((a, b) => a.info.daysRemaining - b.info.daysRemaining)
      .slice(0, 3);
    const lowStockFoods = foods
      .filter((food) => (food.amount || 0) <= 1)
      .slice(0, 3);

    const suggestions = [
      urgentFoods.length > 0
        ? `這週先吃 ${urgentFoods.map(({ food }) => food.name).join("、")}，避免先買後忘。`
        : "目前沒有 3 天內到期的食品，庫存壓力低。",
      dashboardStats.expiring3Days.length >= 5
        ? `3 天內到期共有 ${dashboardStats.expiring3Days.length} 項，建議今天做一次批次清理。`
        : `7 天內到期 ${dashboardStats.expiring7Days.length} 項，還有時間安排料理。`,
      lowStockFoods.length > 0
        ? `可順手補貨 ${lowStockFoods.map((food) => food.name).join("、")}。`
        : "目前沒有明顯低庫存項目。",
    ];

    return {
      urgentFoods,
      lowStockFoods,
      suggestions,
    };
  }, [foods, dashboardStats.expiring3Days.length, dashboardStats.expiring7Days.length]);

  // Selection helpers (after filteredFoods)
  const isAllSelected = filteredFoods.length > 0 && filteredFoods.every(food => selectedIds.has(food.$id));
  const handleSelectAll = () => {
    if (!selectionMode) {
      setSelectionMode(true);
      setSelectedIds(new Set(filteredFoods.map(food => food.$id).filter(Boolean)));
    } else if (filteredFoods.length > 0 && filteredFoods.every(food => selectedIds.has(food.$id))) {
      setSelectedIds(new Set());
      setSelectionMode(false);
    } else {
      setSelectedIds(new Set(filteredFoods.map(food => food.$id).filter(Boolean)));
    }
  };
  const toggleSelectAll = handleSelectAll;

  // 批量刪除選中的項目
  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds).filter(id => !!id);
    setDeleteTotal(ids.length);
    setDeleteProgress(0);
    setIsDeleting(true);
    await Promise.all(ids.map(id =>
      fetchApi(`${API_ENDPOINTS.FOOD}/${id}`, { method: 'DELETE' })
        .catch(err => console.error("Delete failed:", err))
        .finally(() => setDeleteProgress(prev => prev + 1))
    ));
    setIsDeleting(false);
    setSelectedIds(new Set());
    setSelectionMode(false);
    setBulkDeleteOpen(false);
    setBulkDeleteInput("");
    setCleanupAction("discard");
    loadFoods(true);
  };
  const deleteSelected = () => setBulkDeleteOpen(true);

  useEffect(() => {
    // Clean up object URLs on unmount
    return () => {
      if (photoPreviewUrl && photoPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
      if (inlinePhotoPreviewUrl && inlinePhotoPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(inlinePhotoPreviewUrl);
      }
      if (inlineAddPhotoPreviewUrl && inlineAddPhotoPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(inlineAddPhotoPreviewUrl);
      }
    };
  }, [photoPreviewUrl, inlinePhotoPreviewUrl, inlineAddPhotoPreviewUrl]);

  const getAppwriteHeaders = () => {
    if (typeof window === 'undefined') return {};
    const endpoint = localStorage.getItem('appwrite_endpoint');
    const project = localStorage.getItem('appwrite_project');
    const database = localStorage.getItem('appwrite_database');
    const apiKey = localStorage.getItem('appwrite_api_key');
    const bucket = localStorage.getItem('appwrite_bucket');
    return {
      ...(endpoint && { 'X-Appwrite-Endpoint': endpoint }),
      ...(project && { 'X-Appwrite-Project': project }),
      ...(database && { 'X-Appwrite-Database': database }),
      ...(apiKey && { 'X-Appwrite-API-Key': apiKey }),
      ...(bucket && { 'X-Appwrite-Bucket-ID': bucket }),
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

  const resetInlinePhotoState = () => {
    setInlineSelectedPhotoFile(null);
    setInlinePhotoUploading(false);
    setInlinePhotoPreviewUrl((prev) => {
      if (prev && prev.startsWith('blob:')) {
        URL.revokeObjectURL(prev);
      }
      return "";
    });
  };

  const resetInlineAddPhotoState = () => {
    setInlineAddSelectedPhotoFile(null);
    setInlineAddPhotoUploading(false);
    setInlineAddPhotoPreviewUrl((prev) => {
      if (prev && prev.startsWith('blob:')) {
        URL.revokeObjectURL(prev);
      }
      return "";
    });
  };

  const handleInlinePhotoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      alert(`圖片大小超過限制：${Math.round(file.size / 1024 / 1024)}MB > 50MB`);
      return;
    }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('只支援 JPG、PNG、GIF、WEBP 圖片格式');
      return;
    }

    setInlineSelectedPhotoFile(file);
    setInlinePhotoPreviewUrl((prev) => {
      if (prev && prev.startsWith('blob:')) {
        URL.revokeObjectURL(prev);
      }
      return URL.createObjectURL(file);
    });
    setInlineEditForm((prev) => ({ ...prev, photo: "" }));
  };

  const handleInlineAddPhotoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      alert(`圖片大小超過限制：${Math.round(file.size / 1024 / 1024)}MB > 50MB`);
      return;
    }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('只支援 JPG、PNG、GIF、WEBP 圖片格式');
      return;
    }

    setInlineAddSelectedPhotoFile(file);
    setInlineAddPhotoPreviewUrl((prev) => {
      if (prev && prev.startsWith('blob:')) {
        URL.revokeObjectURL(prev);
      }
      return URL.createObjectURL(file);
    });
    setInlineAddForm((prev) => ({ ...prev, photo: "" }));
  };

  const uploadPhotoToAppwrite = async (file: File, mode: "form" | "inline" | "inlineAdd" = "form"): Promise<string> => {
    if (mode === "form") {
      setPhotoUploading(true);
    } else if (mode === "inline") {
      setInlinePhotoUploading(true);
    } else {
      setInlineAddPhotoUploading(true);
    }
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
      if (mode === "form") setPhotoUploading(false);
      if (mode === "inline") setInlinePhotoUploading(false);
      if (mode === "inlineAdd") setInlineAddPhotoUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      let finalPhoto = form.photo;

      // If a file is selected, upload it to Appwrite
      if (selectedPhotoFile) {
        finalPhoto = await uploadPhotoToAppwrite(selectedPhotoFile);
      }

      const formData = {
        ...form,
        photo: finalPhoto,
        price: form.price || 0,
        shop: form.shop || '',
        photohash: form.photohash || '',
      };

      if (editingId) {
        await updateFood(editingId, formData);
      } else {
        await createFood(formData);
      }
      resetForm();
    } catch (err) {
      alert("操作失敗：" + (err instanceof Error ? err.message : "請稍後再試"));
    }
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddForm.name.trim()) {
      alert("請輸入食品名稱");
      return;
    }

    try {
      await createFood({
        ...quickAddForm,
        amount: quickAddForm.amount || 1,
        photo: quickAddForm.photo || "",
        price: quickAddForm.price || 0,
        shop: quickAddForm.shop || "",
        photohash: quickAddForm.photohash || "",
      });
      setQuickAddForm({
        ...INITIAL_FORM,
        amount: 1,
        todate: quickAddForm.todate || getSuggestedExpiryDate(7),
        shop: quickAddForm.shop || "",
      });
    } catch (err) {
      alert("快速新增失敗：" + (err instanceof Error ? err.message : "請稍後再試"));
    }
  };

  const applyQuickPreset = (presetKey: keyof typeof QUICK_ADD_PRESETS) => {
    const preset = QUICK_ADD_PRESETS[presetKey];
    setQuickAddForm((prev) => ({
      ...prev,
      name: preset.label,
      amount: preset.amount ?? prev.amount ?? 1,
      todate: getSuggestedExpiryDate(preset.days),
      shop: preset.shop ?? prev.shop,
    }));
  };

  const handleQuickCleanup = async (food: Food, action: CleanupAction) => {
    const labels: Record<CleanupAction, string> = {
      eat: "標記吃完",
      discard: "標記丟棄",
      delete: "永久刪除",
    };

    if (!confirm(`確定要${labels[action]}「${food.name}」嗎？`)) return;

    try {
      await deleteFood(food.$id);
    } catch {
      alert(`${labels[action]}失敗，請稍後再試`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("確定刪除？")) return;
    try {
      await deleteFood(id);
    } catch {
      alert("刪除失敗，請稍後再試");
    }
  };

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setEditingId(null);
    setIsFormOpen(false);
    // Reset photo-related states
    setSelectedPhotoFile(null);
    setPhotoPreviewUrl("");
  };

  // 開始行內編輯
  const handleInlineEdit = (food: Food) => {
    resetInlinePhotoState();
    setInlineEditForm({
      name: food.name,
      amount: food.amount,
      todate: formatDate(food.todate),
      photo: food.photo || '',
      price: food.price || 0,
      shop: food.shop || '',
      photohash: food.photohash || '',
    });
    setInlineEditingId(food.$id);
  };

  // 儲存行內編輯
  const handleInlineSave = async () => {
    if (!inlineEditingId) return;
    try {
      let finalPhoto = inlineEditForm.photo || '';
      if (inlineSelectedPhotoFile) {
        finalPhoto = await uploadPhotoToAppwrite(inlineSelectedPhotoFile, "inline");
      }

      await updateFood(inlineEditingId, {
        ...inlineEditForm,
        photo: finalPhoto,
      });
      resetInlinePhotoState();
      setInlineEditingId(null);
      setInlineEditForm(INITIAL_FORM);
    } catch (error) {
      console.error('Inline edit failed:', error);
      const errorMessage = error instanceof Error ? error.message : '更新失敗，請稍後再試';
      alert(errorMessage);
    }
  };

  // 取消行內編輯
  const cancelInlineEdit = () => {
    resetInlinePhotoState();
    setInlineEditingId(null);
    setInlineEditForm(INITIAL_FORM);
  };

  // 開始行內新增
  const startInlineAdd = () => {
    setIsInlineAdding(true);
    setInlineAddForm(INITIAL_FORM);
    // 關閉其他編輯狀態
    resetInlinePhotoState();
    resetInlineAddPhotoState();
    setInlineEditingId(null);
    setInlineEditForm(INITIAL_FORM);
  };

  // 儲存行內新增
  const handleInlineAddSave = async () => {
    if (!inlineAddForm.name.trim()) {
      alert('請輸入食品名稱');
      return;
    }
    try {
      let finalPhoto = inlineAddForm.photo || '';
      if (inlineAddSelectedPhotoFile) {
        finalPhoto = await uploadPhotoToAppwrite(inlineAddSelectedPhotoFile, "inlineAdd");
      }

      await createFood({
        ...inlineAddForm,
        photo: finalPhoto,
      });
      setIsInlineAdding(false);
      resetInlineAddPhotoState();
      setInlineAddForm(INITIAL_FORM);
    } catch (error) {
      console.error('Inline add failed:', error);
      const errorMessage = error instanceof Error ? error.message : '新增失敗，請稍後再試';
      alert(errorMessage);
    }
  };

  // 取消行內新增
  const cancelInlineAdd = () => {
    setIsInlineAdding(false);
    resetInlineAddPhotoState();
    setInlineAddForm(INITIAL_FORM);
  };

  // CSV 匯入/匯出功能
  const [importPreview, setImportPreview] = useState<{ data: FoodFormData[], errors: string[] } | null>(null);
  const [importFormat, setImportFormat] = useState<'appwrite' | 'supabase' | null>(null);
  const [pendingCSVText, setPendingCSVText] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const CSV_HEADERS = ['name', 'amount', 'todate', 'photo', 'price', 'shop', 'photohash'];
  const EXPECTED_COLUMN_COUNT = CSV_HEADERS.length; // 7 欄

  const convertSupabaseFood = (text: string): string => {
    const rows = parseFullCSV(text);
    if (rows.length < 1) return text;
    const newLines: string[] = [CSV_HEADERS.join(',')];
    for (let i = 1; i < rows.length; i++) {
      const values = rows[i];
      // Supabase: 食物名稱, 數量, 價格(NT$), 購買商店, 到期日期, 照片網址
      // Appwrite: name, amount, todate, photo, price, shop, photohash
      const name = values[0]?.trim() || '';
      const amount = values[1]?.trim() || '0';
      const price = values[2]?.trim() || '0';
      const shop = values[3]?.trim() || '';
      const todate = values[4]?.trim() || '';
      const photo = values[5]?.trim() || '';
      const photohash = '';
      const escapeCSV = (val: string) => {
        if (val.includes(',') || val.includes('"') || val.includes('\n')) return `"${val.replace(/"/g, '""')}"`;
        return val;
      };
      newLines.push([escapeCSV(name), escapeCSV(amount), escapeCSV(todate), escapeCSV(photo), escapeCSV(price), escapeCSV(shop), escapeCSV(photohash)].join(','));
    }
    return newLines.join('\n');
  };

  const exportToCSV = () => {
    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`;
      return str;
    };
    const rows = [CSV_HEADERS.join(',')];
    foods.forEach(food => {
      rows.push([escapeCSV(food.name), escapeCSV(food.amount || 0), escapeCSV(food.todate || ''), escapeCSV(food.photo || ''), escapeCSV(food.price || 0), escapeCSV(food.shop || ''), escapeCSV(food.photohash || '')].join(','));
    });
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = getExportFilename('food');
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

  const detectCSVFormat = (text: string): 'appwrite' | 'supabase' | 'unknown' => {
    const rows = parseFullCSV(text);
    if (rows.length === 0) return 'unknown';
    const headers = rows[0].map(h => h.trim());
    if (headers.includes('name')) return 'appwrite';
    if (headers.includes('食物名稱')) return 'supabase';
    return 'unknown';
  };

  const parseCSV = (text: string): { data: FoodFormData[], errors: string[] } => {
    const errors: string[] = []; const data: FoodFormData[] = [];
    const rows = parseFullCSV(text);
    if (rows.length < 2) { errors.push('CSV 檔案至少需要表頭和一行資料'); return { data, errors }; }

    const headerValues = rows[0].map(h => h.trim());
    if (headerValues.length !== EXPECTED_COLUMN_COUNT) {
      errors.push(`表頭欄位數量錯誤: 預期 ${EXPECTED_COLUMN_COUNT} 欄，實際 ${headerValues.length} 欄`);
      return { data, errors };
    }

    const missingHeaders = CSV_HEADERS.filter(header => !headerValues.includes(header));
    if (missingHeaders.length > 0) {
      errors.push(`表頭缺少欄位: ${missingHeaders.join(', ')}`);
      return { data, errors };
    }

    const unexpectedHeaders = headerValues.filter(header => !CSV_HEADERS.includes(header));
    if (unexpectedHeaders.length > 0) {
      errors.push(`表頭包含未知欄位: ${unexpectedHeaders.join(', ')}`);
      return { data, errors };
    }

    const headerIndexMap = Object.fromEntries(headerValues.map((header, index) => [header, index])) as Record<string, number>;

    for (let i = 1; i < rows.length; i++) {
      const values = rows[i]; const lineNum = i + 1;
      if (values.length !== EXPECTED_COLUMN_COUNT) { errors.push(`第 ${lineNum} 行: 欄位數量錯誤`); continue; }

      const name = values[headerIndexMap.name]?.trim() || '';
      if (!name) { errors.push(`第 ${lineNum} 行: name 欄位不能為空`); continue; }

      data.push({
        name,
        amount: parseFloat(values[headerIndexMap.amount]) || 0,
        todate: values[headerIndexMap.todate]?.trim() || '',
        photo: values[headerIndexMap.photo]?.trim() || '',
        price: parseFloat(values[headerIndexMap.price]) || 0,
        shop: values[headerIndexMap.shop]?.trim() || '',
        photohash: values[headerIndexMap.photohash]?.trim() || '',
      });
    }
    return { data, errors };
  };

  const handleCSVFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!file.name.endsWith('.csv')) { alert('請選擇 CSV 檔案'); return; }
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const format = detectCSVFormat(text);
      if (format === 'appwrite') { setImportPreview(parseCSV(text)); }
      else if (format === 'supabase') { setImportFormat('supabase'); setPendingCSVText(text); }
      else { alert('無法辨識 CSV 格式：表頭不符合 Appwrite 或 Supabase 格式'); }
    };
    reader.readAsText(file, 'UTF-8'); e.target.value = '';
  };

  const confirmSupabaseFoodImport = () => {
    const converted = convertSupabaseFood(pendingCSVText);
    setImportPreview(parseCSV(converted));
    setImportFormat(null);
    setPendingCSVText('');
  };

  const cancelSupabaseFoodImport = () => {
    setImportFormat(null);
    setPendingCSVText('');
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
        const existing = foods.find(f => f.name === formData.name);
        if (existing) {
          await updateFood(existing.$id, formData);
        } else {
          await createFood(formData);
        }
        successCount++;
      } catch { failCount++; }
    }

    setImporting(false);
    setImportProgress({ current: 0, total: 0 });
    setImportPreview(null);
    alert(`匯入完成！\n成功: ${successCount} 筆\n失敗: ${failCount} 筆`);
  };

  if (loading) return <FullPageLoading text="載入食品資料中..." />;

  return (
    <div className="space-y-4 lg:space-y-6" id="food-management-container">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <SectionHeader
        title="鋒兄食品"
        subtitle={`共 ${foods.length} 項食品`}
        showAccountLabel={true}
        action={
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>即時同步</span>
          </div>
        }
      />

      <div className="flex flex-wrap justify-end gap-2">
        <input type="file" accept=".csv" onChange={handleCSVFileSelect} className="hidden" id="csv-import-food" />
        <Button onClick={() => loadFoods(true)} variant="outline" className="rounded-xl flex items-center gap-2 w-full sm:w-auto" title="重新整理" disabled={loading}>
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} /> 重新整理
        </Button>
        <Button onClick={() => document.getElementById('csv-import-food')?.click()} variant="outline" className="rounded-xl flex items-center gap-2 w-full sm:w-auto" title="匯入 CSV">
          <Upload size={18} /> 匯入
        </Button>
        <Button onClick={exportToCSV} variant="outline" className="rounded-xl flex items-center gap-2 w-full sm:w-auto" title="匯出 CSV">
          <Download size={18} /> 匯出
        </Button>
        <Button
          onClick={() => setIsFormOpen(!isFormOpen)}
          variant="outline"
          className="rounded-xl flex items-center gap-2 border-blue-500 text-blue-600 hover:bg-blue-50 hover:text-blue-700 h-10 px-4 w-full sm:w-auto"
        >
          {isFormOpen ? <ChevronUp size={18} /> : <Plus size={18} />}
          {isFormOpen ? "收起表單" : "新增食品"}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <Card className="border-red-200 bg-gradient-to-br from-red-50 to-white shadow-sm">
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2 text-red-600"><Flame size={16} /> 已過期</CardDescription>
            <CardTitle className="text-3xl text-red-700">{dashboardStats.expired.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-red-700/80">
            {dashboardStats.expired.length > 0 ? "優先批次處理，避免舊品持續堆積。" : "目前沒有過期食品。"}
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-white shadow-sm">
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2 text-orange-600"><CalendarClock size={16} /> 3 天內到期</CardDescription>
            <CardTitle className="text-3xl text-orange-700">{dashboardStats.expiring3Days.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-orange-700/80">
            今天最需要決策的區塊，先吃清單會以這裡為主。
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white shadow-sm">
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2 text-amber-600"><Refrigerator size={16} /> 7 天內到期</CardDescription>
            <CardTitle className="text-3xl text-amber-700">{dashboardStats.expiring7Days.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-amber-700/80">
            適合提前排菜單與分批消耗，避免臨期一起爆量。
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white shadow-sm">
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2 text-emerald-600"><ShoppingBasket size={16} /> 低庫存 / 庫存價值</CardDescription>
            <CardTitle className="text-3xl text-emerald-700">{dashboardStats.lowStock.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-emerald-700/80">
            約 NT$ {dashboardStats.totalValue.toLocaleString()} 在庫，低庫存 {dashboardStats.lowStock.length} 項。
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,1fr)]">
        <Card className="border-blue-200 bg-gradient-to-br from-sky-50 via-white to-blue-50 shadow-sm">
          <CardHeader className="pb-4">
            <CardDescription className="flex items-center gap-2 text-blue-600"><PackageOpen size={16} /> 快速新增模式</CardDescription>
            <CardTitle>常用食品一筆完成</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap gap-2">
              {Object.entries(QUICK_ADD_PRESETS).map(([key, preset]) => (
                <Button key={key} type="button" variant="outline" className="rounded-full border-blue-200 text-blue-700 hover:bg-blue-50" onClick={() => applyQuickPreset(key as keyof typeof QUICK_ADD_PRESETS)}>
                  {preset.label} +{preset.days}天
                </Button>
              ))}
            </div>
            <form onSubmit={handleQuickAdd} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="md:col-span-2 xl:col-span-2">
                <Input
                  list="food-name-suggestions"
                  placeholder="食品名稱"
                  value={quickAddForm.name}
                  onChange={(e) => setQuickAddForm({ ...quickAddForm, name: e.target.value })}
                  className="h-12 rounded-xl"
                />
              </div>
              <Input
                type="date"
                value={quickAddForm.todate}
                onChange={(e) => setQuickAddForm({ ...quickAddForm, todate: e.target.value })}
                className="h-12 rounded-xl"
              />
              <Input
                type="number"
                min="0"
                placeholder="數量"
                value={quickAddForm.amount || ""}
                onChange={(e) => setQuickAddForm({ ...quickAddForm, amount: e.target.value === "" ? 0 : parseInt(e.target.value) || 0 })}
                className="h-12 rounded-xl"
              />
              <Input
                placeholder="位置 / 商店"
                value={quickAddForm.shop || ""}
                onChange={(e) => setQuickAddForm({ ...quickAddForm, shop: e.target.value })}
                className="h-12 rounded-xl"
              />
              <div className="md:col-span-2 xl:col-span-3 flex flex-wrap gap-2">
                {[1, 3, 7].map((days) => (
                  <Button key={days} type="button" variant="outline" className="rounded-full" onClick={() => setQuickAddForm((prev) => ({ ...prev, todate: addDaysToDate(prev.todate || getSuggestedExpiryDate(0), days) }))}>
                    到期 +{days} 天
                  </Button>
                ))}
              </div>
              <Button type="submit" className="h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white w-full xl:w-auto">
                <Plus size={16} /> 立即新增
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 shadow-sm">
          <CardHeader className="pb-4">
            <CardDescription className="flex items-center gap-2 text-amber-700"><Sparkles size={16} /> Friendly AI 建議</CardDescription>
            <CardTitle>今天先處理什麼</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
            <div className="space-y-2">
              {aiInsights.suggestions.map((suggestion, index) => (
                <div key={index} className="rounded-2xl border border-amber-200 bg-white/80 px-4 py-3">
                  {suggestion}
                </div>
              ))}
            </div>
            {aiInsights.urgentFoods.length > 0 && (
              <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3">
                <div className="mb-2 font-semibold text-orange-700">優先消耗</div>
                <div className="flex flex-wrap gap-2">
                  {aiInsights.urgentFoods.map(({ food, info }) => (
                    <span key={food.$id} className="rounded-full bg-white px-3 py-1 text-orange-700 border border-orange-200">
                      {food.name} {formatDaysRemaining(info.daysRemaining)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Supabase 格式確認對話框 */}
      {importFormat === 'supabase' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">偵測到 Supabase 格式</h3>
              <p className="text-sm text-gray-500 mt-1">此 CSV 檔案來自 Supabase，需要轉換欄位後才能匯入</p>
            </div>
            <div className="p-6 overflow-y-auto max-h-[50vh]">
              <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                <h4 className="font-semibold text-blue-600 dark:text-blue-400 mb-3">欄位轉換對照：</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">食物名稱</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono">name</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">數量</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono">amount</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">價格(NT$)</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono">price</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">購買商店</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono">shop</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">到期日期</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono">todate</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">照片網址</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono">photo</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">(無)</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono">photohash (空值)</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3 border-t border-gray-200 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] dark:border-gray-700 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={cancelSupabaseFoodImport} className="rounded-xl">取消</Button>
              <Button onClick={confirmSupabaseFoodImport} className="rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white">
                確認轉換並匯入
              </Button>
            </div>
          </div>
        </div>
      )}

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
                      const existing = foods.find(f => f.name === item.name);
                      return (
                        <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <span className="font-medium text-gray-900 dark:text-gray-100">{item.name}</span>
                          <span className="text-xs text-gray-500">{item.amount} 個</span>
                          {existing ? <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded">更新</span> : <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded">新增</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-3 border-t border-gray-200 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] dark:border-gray-700 sm:flex-row sm:justify-end">
              {importing ? (
                <div className="flex items-center gap-3">
                  <div className="w-48 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300"
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
        <FoodForm
          form={form}
          setForm={setForm}
          editingId={editingId}
          photoPreviewUrl={photoPreviewUrl}
          selectedPhotoFile={selectedPhotoFile}
          photoUploading={photoUploading}
          handlePhotoFileSelect={handlePhotoFileSelect}
          existingShops={existingShops}
          existingNames={existingNames}
          onSubmit={handleSubmit}
          onCancel={resetForm}
        />
      )}

      <datalist id="food-name-suggestions">
        {existingNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {/* 搜尋欄位 */}
      {foods.length > 0 && (
        <div className="space-y-3 mb-4">
          <div className="flex flex-wrap gap-2">
            {[
              { key: "all", label: "全部" },
              { key: "expired", label: "已過期" },
              { key: "today", label: "今天到期" },
              { key: "3days", label: "3 天內" },
              { key: "7days", label: "7 天內" },
              { key: "normal", label: "正常庫存" },
            ].map((item) => (
              <Button
                key={item.key}
                type="button"
                variant="outline"
                onClick={() => setFilterMode(item.key as FilterMode)}
                className={`rounded-full ${filterMode === item.key ? "border-blue-500 bg-blue-50 text-blue-700" : ""}`}
              >
                {item.label} ({filterCounts[item.key as FilterMode]})
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                placeholder="搜尋食品名稱、商店..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 rounded-xl"
              />
            </div>
            <Button onClick={handleSelectAll} variant="outline" className="h-12 px-4 rounded-xl flex items-center gap-2 shrink-0">
              {selectionMode && filteredFoods.length > 0 && filteredFoods.every(food => selectedIds.has(food.$id)) ? "取消全選" : "全選"}
            </Button>
            {selectedIds.size > 0 && (
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => { setCleanupAction("eat"); setBulkDeleteOpen(true); }} className="h-12 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
                  標記吃完 ({selectedIds.size})
                </Button>
                <Button onClick={() => { setCleanupAction("discard"); setBulkDeleteOpen(true); }} className="h-12 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white">
                  標記丟棄 ({selectedIds.size})
                </Button>
                <Button onClick={() => { setCleanupAction("delete"); setBulkDeleteOpen(true); }} className="h-12 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white">
                  真刪除 ({selectedIds.size})
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      <DataCard>
        {foods.length === 0 ? (
          <EmptyState emoji="🍔" title="暫無食品資料" description="點擊上方按鈕新增您的第一筆食品資料" />
        ) : filteredFoods.length === 0 ? (
          <EmptyState emoji="🔍" title="無搜尋結果" description={`找不到「${searchQuery}」相關的食品`} />
        ) : (
          <>
            <DesktopTable
              foods={filteredFoods}
              onDelete={handleDelete}
              onQuickCleanup={handleQuickCleanup}
              onAmountChange={updateAmount}
              inlineEditingId={inlineEditingId}
              inlineEditForm={inlineEditForm}
              setInlineEditForm={setInlineEditForm}
              onInlineEdit={handleInlineEdit}
              onInlineSave={handleInlineSave}
              onInlineCancel={cancelInlineEdit}
              onInlinePhotoFileSelect={handleInlinePhotoFileSelect}
              inlinePhotoPreviewUrl={inlinePhotoPreviewUrl}
              inlinePhotoUploading={inlinePhotoUploading}
              isEditMode={isEditMode || selectionMode}
              setIsEditMode={setIsEditMode}
              selectedIds={selectedIds}
              toggleSelect={toggleSelect}
              isAllSelected={isAllSelected}
              toggleSelectAll={toggleSelectAll}
              deleteSelected={deleteSelected}
              isInlineAdding={isInlineAdding}
              inlineAddForm={inlineAddForm}
              setInlineAddForm={setInlineAddForm}
              onInlineAddPhotoFileSelect={handleInlineAddPhotoFileSelect}
              inlineAddPhotoPreviewUrl={inlineAddPhotoPreviewUrl}
              inlineAddPhotoUploading={inlineAddPhotoUploading}
              onInlineAddSave={handleInlineAddSave}
              onInlineAddCancel={cancelInlineAdd}
              startInlineAdd={startInlineAdd}
            />
            <MobileList
              foods={filteredFoods}
              onDelete={handleDelete}
              onQuickCleanup={handleQuickCleanup}
              onAmountChange={updateAmount}
              inlineEditingId={inlineEditingId}
              inlineEditForm={inlineEditForm}
              setInlineEditForm={setInlineEditForm}
              onInlineEdit={handleInlineEdit}
              onInlineSave={handleInlineSave}
              onInlineCancel={cancelInlineEdit}
              onInlinePhotoFileSelect={handleInlinePhotoFileSelect}
              inlinePhotoPreviewUrl={inlinePhotoPreviewUrl}
              inlinePhotoUploading={inlinePhotoUploading}
              isEditMode={isEditMode || selectionMode}
              setIsEditMode={setIsEditMode}
              selectedIds={selectedIds}
              toggleSelect={toggleSelect}
              isAllSelected={isAllSelected}
              toggleSelectAll={toggleSelectAll}
              deleteSelected={deleteSelected}
              isInlineAdding={isInlineAdding}
              inlineAddForm={inlineAddForm}
              setInlineAddForm={setInlineAddForm}
              onInlineAddPhotoFileSelect={handleInlineAddPhotoFileSelect}
              inlineAddPhotoPreviewUrl={inlineAddPhotoPreviewUrl}
              inlineAddPhotoUploading={inlineAddPhotoUploading}
              onInlineAddSave={handleInlineAddSave}
              onInlineAddCancel={cancelInlineAdd}
              startInlineAdd={startInlineAdd}
            />
          </>
        )}
      </DataCard>

      {/* 批次刪除確認 Modal */}
      {bulkDeleteOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3 mb-3">
                <AlertTriangle className={`${cleanupAction === "delete" ? "text-red-500" : cleanupAction === "discard" ? "text-orange-500" : "text-emerald-500"}`} size={24} />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {cleanupAction === "eat" ? "確認批次標記吃完" : cleanupAction === "discard" ? "確認批次標記丟棄" : "確認批次刪除"}
                </h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                {cleanupAction === "eat" && <>即將把 <span className="font-bold text-emerald-600">{selectedIds.size}</span> 筆食品從庫存移除，代表已吃完。</>}
                {cleanupAction === "discard" && <>即將把 <span className="font-bold text-orange-600">{selectedIds.size}</span> 筆食品從庫存移除，代表已丟棄。</>}
                {cleanupAction === "delete" && <>即將永久刪除 <span className="font-bold text-red-600">{selectedIds.size}</span> 筆資料，此操作無法復原。</>}
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
                <code className="block bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg text-sm font-mono text-red-600">DELETE food</code>
                <input
                  type="text"
                  value={bulkDeleteInput}
                  onChange={(e) => setBulkDeleteInput(e.target.value)}
                  placeholder="輸入 DELETE food"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                />
              </div>
            )}
            <div className="flex flex-col gap-3 border-t border-gray-100 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] dark:border-gray-800 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => { setBulkDeleteOpen(false); setBulkDeleteInput(""); setCleanupAction("discard"); }} disabled={isDeleting}>取消</Button>
              <Button
                onClick={handleBulkDelete}
                disabled={bulkDeleteInput !== "DELETE food" || isDeleting}
                className={`${cleanupAction === "delete" ? "bg-red-600 hover:bg-red-700" : cleanupAction === "discard" ? "bg-orange-600 hover:bg-orange-700" : "bg-emerald-600 hover:bg-emerald-700"} text-white disabled:opacity-50`}
              >
                {isDeleting ? '處理中...' : `${cleanupAction === "eat" ? "確認標記吃完" : cleanupAction === "discard" ? "確認標記丟棄" : "確認刪除"} (${selectedIds.size} 筆)`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 表單元件
interface FoodFormProps {
  form: FoodFormData;
  setForm: (form: FoodFormData) => void;
  editingId: string | null;
  photoPreviewUrl: string;
  selectedPhotoFile: File | null;
  photoUploading: boolean;
  handlePhotoFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  existingShops: string[];
  existingNames: string[];
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

function FoodForm({
  form,
  setForm,
  editingId,
  photoPreviewUrl,
  selectedPhotoFile,
  photoUploading,
  handlePhotoFileSelect,
  existingShops,
  existingNames,
  onSubmit,
  onCancel
}: FoodFormProps) {
  return (
    <FormCard title={editingId ? "編輯食品" : "新增食品"} accentColor="from-blue-500 to-blue-600">
      <form onSubmit={onSubmit} className="space-y-4">
        <FormGrid>
          <div className="space-y-1">
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Input
                  placeholder="食品名稱 / Food Name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="h-12 rounded-xl w-full"
                />
                <div className="px-1 h-4">
                  {form.name ? (
                    <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">已輸入 / Entered</span>
                  ) : (
                    <span className="text-[10px] text-orange-600 dark:text-orange-400 font-medium">請輸入名稱 / Please enter name</span>
                  )}
                </div>
              </div>
              {existingNames.length > 0 && (
                <Select value="" onValueChange={(val) => val && setForm({ ...form, name: val })}>
                  <SelectTrigger className="h-12 w-12 rounded-xl px-0 justify-center">
                    <ChevronDown className="h-4 w-4" />
                  </SelectTrigger>
                  <SelectContent>
                    {existingNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex gap-1 items-center">
              <Input
                placeholder="數量 / Quantity"
                type="number"
                min="0"
                value={form.amount || ""}
                onChange={(e) => setForm({ ...form, amount: e.target.value === "" ? 0 : parseInt(e.target.value) || 0 })}
                className="h-12 rounded-xl flex-1"
              />
              {(form.amount || 0) > 0 && (
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, amount: (form.amount || 0) + 1 })}
                    className="p-1 hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 rounded transition-colors"
                    title="+1"
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, amount: Math.max(0, (form.amount || 0) - 1) })}
                    className="p-1 hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-600 rounded transition-colors"
                    title="-1"
                  >
                    <Minus size={14} />
                  </button>
                </div>
              )}
            </div>
            <div className="px-1 h-4">
              {(form.amount || 0) > 0 ? (
                <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">可以 + 或 - / Can use + or -</span>
              ) : (
                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請輸入數量 / (Optional) Please enter quantity</span>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex gap-1 items-center">
              <Input
                placeholder="有效期限 / Expiry Date"
                type="date"
                value={form.todate}
                onChange={(e) => setForm({ ...form, todate: e.target.value })}
                className="h-12 rounded-xl flex-1"
              />
              {form.todate && (
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(form.todate);
                      d.setDate(d.getDate() + 7);
                      setForm({ ...form, todate: d.toISOString().split('T')[0] });
                    }}
                    className="p-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 rounded transition-colors"
                    title="+7天"
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(form.todate);
                      d.setDate(d.getDate() - 7);
                      setForm({ ...form, todate: d.toISOString().split('T')[0] });
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
              {form.todate ? (
                <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">可以 + 或 - (7天) / Can use + or - (7 Days)</span>
              ) : (
                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請選擇日期 / (Optional) Please select a date</span>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex gap-1 items-center">
              <Input
                placeholder="價格 / Price"
                type="number"
                min="0"
                value={form.price || ''}
                onChange={(e) => setForm({ ...form, price: e.target.value ? parseInt(e.target.value) : 0 })}
                className="h-12 rounded-xl flex-1"
              />
              {(form.price || 0) > 0 && (
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, price: (form.price || 0) + 10 })}
                    className="p-1 hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 rounded transition-colors"
                    title="+10"
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, price: Math.max(0, (form.price || 0) - 10) })}
                    className="p-1 hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-600 rounded transition-colors"
                    title="-10"
                  >
                    <Minus size={14} />
                  </button>
                </div>
              )}
            </div>
            <div className="px-1 h-4">
              {(form.price || 0) > 0 ? (
                <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">可以 + 或 - / Can use + or -</span>
              ) : (
                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請輸入金額 / (Optional) Please enter amount</span>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Input
                  placeholder="商店/地點 / Shop/Location"
                  value={form.shop || ''}
                  onChange={(e) => setForm({ ...form, shop: e.target.value })}
                  className="h-12 rounded-xl w-full"
                />
                <div className="px-1 h-4">
                  {form.shop ? (
                    <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">已輸入 / Entered</span>
                  ) : (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請輸入商店 / (Optional) Please enter shop</span>
                  )}
                </div>
              </div>
              {existingShops.length > 0 && (
                <Select
                  value=""
                  onValueChange={(value) => {
                    if (value) {
                      setForm({ ...form, shop: value });
                    }
                  }}
                >
                  <SelectTrigger className="h-12 w-12 rounded-xl px-0 justify-center">
                    <ChevronDown className="h-4 w-4" />
                  </SelectTrigger>
                  <SelectContent>
                    {existingShops.map((shop) => (
                      <SelectItem key={shop} value={shop}>{shop}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <div className="col-span-2">
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
                    // We don't need to set photo preview here since it's passed as prop
                    // setSelectedPhotoFile(null) equivalent is handled by parent
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
          <Button type="submit" disabled={photoUploading} className="h-12 px-6 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-xl font-medium shadow-lg shadow-blue-500/25">
            {photoUploading ? "上傳中..." : editingId ? "更新食品" : "新增食品"}
          </Button>
          {editingId && (
            <Button type="button" variant="outline" onClick={onCancel} className="h-12 px-6 rounded-xl" disabled={photoUploading}>
              取消編輯
            </Button>
          )}
          {!editingId && (
            <Button type="button" variant="outline" onClick={onCancel} className="h-12 px-6 rounded-xl" disabled={photoUploading}>
              取消
            </Button>
          )}
        </FormActions>
      </form>
    </FormCard>
  );
}

// 桌面版表格
interface TableProps {
  foods: Food[];
  onDelete: (id: string) => void;
  onQuickCleanup: (food: Food, action: CleanupAction) => void;
  onAmountChange: (food: Food, delta: number) => void;
  inlineEditingId: string | null;
  inlineEditForm: FoodFormData;
  setInlineEditForm: (form: FoodFormData) => void;
  onInlineEdit: (food: Food) => void;
  onInlineSave: () => void;
  onInlineCancel: () => void;
  onInlinePhotoFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  inlinePhotoPreviewUrl: string;
  inlinePhotoUploading: boolean;
  isEditMode: boolean;
  setIsEditMode: (value: boolean) => void;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  isAllSelected: boolean;
  toggleSelectAll: () => void;
  deleteSelected: () => void;
  // Inline add props
  isInlineAdding: boolean;
  inlineAddForm: FoodFormData;
  setInlineAddForm: (form: FoodFormData) => void;
  onInlineAddPhotoFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  inlineAddPhotoPreviewUrl: string;
  inlineAddPhotoUploading: boolean;
  onInlineAddSave: () => void;
  onInlineAddCancel: () => void;
  startInlineAdd: () => void;
}

function DesktopTable({ foods, onDelete, onQuickCleanup, onAmountChange, inlineEditingId, inlineEditForm, setInlineEditForm, onInlineEdit, onInlineSave, onInlineCancel, onInlinePhotoFileSelect, inlinePhotoPreviewUrl, inlinePhotoUploading, isEditMode, setIsEditMode, selectedIds, toggleSelect, isAllSelected, toggleSelectAll, deleteSelected, isInlineAdding, inlineAddForm, setInlineAddForm, onInlineAddPhotoFileSelect, inlineAddPhotoPreviewUrl, inlineAddPhotoUploading, onInlineAddSave, onInlineAddCancel, startInlineAdd }: TableProps) {
  if (foods.length === 0) {
    return (
      <div className="hidden lg:block">
        <EmptyState emoji="📦" title="暫無食品資料" description="點擊上方表單新增第一個食品" />
      </div>
    );
  }

  return (
    <div className="hidden lg:block overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50/50 dark:bg-gray-700/50">
            <TableHead className="font-semibold">
              <div className="flex items-center gap-2">
                名稱
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (isInlineAdding) {
                      onInlineAddCancel();
                    } else {
                      startInlineAdd();
                    }
                  }}
                  variant="outline"
                  className="rounded-lg flex items-center gap-1 border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700 h-7 px-2 text-xs"
                >
                  {isInlineAdding ? <X size={14} /> : <Plus size={14} />}
                  {isInlineAdding ? "取消" : "新增"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setIsEditMode(!isEditMode);
                    if (isEditMode) {
                      onInlineCancel();
                    }
                  }}
                  variant="outline"
                  className={`rounded-lg flex items-center gap-1 h-7 px-2 text-xs ${isEditMode ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                >
                  <Pencil size={14} />
                  {isEditMode ? "取消編輯" : "編輯"}
                </Button>
                {isEditMode && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={toggleSelectAll}
                    variant="outline"
                    className={`rounded-lg flex items-center gap-1 h-7 px-2 text-xs ${isAllSelected ? 'border-purple-500 text-purple-600 bg-purple-50' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                  >
                    {isAllSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                    {isAllSelected ? "取消全選" : "全選"}
                    {selectedIds.size > 0 && ` (${selectedIds.size})`}
                  </Button>
                )}
                {isEditMode && selectedIds.size > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={deleteSelected}
                    variant="outline"
                    className="rounded-lg flex items-center gap-1 h-7 px-2 text-xs border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 size={14} />
                    刪除選中 ({selectedIds.size})
                  </Button>
                )}
              </div>
            </TableHead>
            <TableHead className="font-semibold">有效期限</TableHead>
            <TableHead className="font-semibold">數量</TableHead>
            <TableHead className="font-semibold">圖片</TableHead>
            {!isEditMode && <TableHead className="font-semibold">操作</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* 行內新增列 (桌面版) */}
          {isInlineAdding && (
            <TableRow className="bg-green-50 dark:bg-green-900/20">
              <TableCell className="font-medium">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-12 shrink-0">名稱</span>
                    <Input
                      placeholder="食品名稱"
                      value={inlineAddForm.name}
                      onChange={(e) => setInlineAddForm({ ...inlineAddForm, name: e.target.value })}
                      className="h-9 rounded-lg text-sm"
                      required
                      autoFocus
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-12 shrink-0">價格</span>
                    <Input
                      type="number"
                      min="0"
                      placeholder="價格"
                      value={inlineAddForm.price || ""}
                      onChange={(e) => setInlineAddForm({ ...inlineAddForm, price: e.target.value === "" ? 0 : parseInt(e.target.value) || 0 })}
                      className="h-9 rounded-lg text-sm w-24"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-12 shrink-0">商店</span>
                    <Input
                      placeholder="商店名稱"
                      value={inlineAddForm.shop || ""}
                      onChange={(e) => setInlineAddForm({ ...inlineAddForm, shop: e.target.value })}
                      className="h-9 rounded-lg text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Input
                      type="url"
                      placeholder="圖片網址"
                      value={inlineAddForm.photo || ""}
                      onChange={(e) => setInlineAddForm({ ...inlineAddForm, photo: e.target.value })}
                      className="h-9 rounded-lg text-sm"
                    />
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={onInlineAddPhotoFileSelect}
                      className="h-9 rounded-lg text-sm file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-2 file:py-1 file:text-xs file:font-medium file:text-blue-700"
                    />
                    {inlineAddPhotoUploading && (
                      <div className="text-xs text-blue-600">圖片上傳中...</div>
                    )}
                    {inlineAddPhotoPreviewUrl || inlineAddForm.photo ? (
                      <img
                        src={inlineAddPhotoPreviewUrl || inlineAddForm.photo}
                        alt="圖片預覽"
                        className="w-16 h-16 object-cover rounded-xl border border-gray-200"
                      />
                    ) : (
                      <div className="w-16 h-16 flex items-center justify-center text-gray-400 border border-dashed border-gray-300 rounded-xl text-xs">
                        NO IMAGE
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <Button type="button" size="sm" onClick={onInlineAddSave} className="rounded-xl bg-green-500 hover:bg-green-600 text-white">新增</Button>
                    <Button type="button" size="sm" variant="outline" onClick={onInlineAddCancel} className="rounded-xl">取消</Button>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Input
                    type="date"
                    value={inlineAddForm.todate || ""}
                    onChange={(e) => setInlineAddForm({ ...inlineAddForm, todate: e.target.value })}
                    className="h-9 rounded-lg text-sm"
                  />
                  {inlineAddForm.todate && (
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (!inlineAddForm.todate) return;
                          const d = new Date(inlineAddForm.todate);
                          d.setDate(d.getDate() + 7);
                          setInlineAddForm({ ...inlineAddForm, todate: d.toISOString().split('T')[0] });
                        }}
                        className="p-1 hover:bg-blue-100 dark:hover:bg-blue-800 text-blue-600 rounded transition-colors"
                        title="+7天"
                      >
                        <Plus size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!inlineAddForm.todate) return;
                          const d = new Date(inlineAddForm.todate);
                          d.setDate(d.getDate() - 7);
                          setInlineAddForm({ ...inlineAddForm, todate: d.toISOString().split('T')[0] });
                        }}
                        className="p-1 hover:bg-orange-100 dark:hover:bg-orange-800 text-orange-600 rounded transition-colors"
                        title="-7天"
                      >
                        <Minus size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  min="0"
                  placeholder="數量"
                  value={inlineAddForm.amount || ""}
                  onChange={(e) => setInlineAddForm({ ...inlineAddForm, amount: e.target.value === "" ? 0 : parseInt(e.target.value) || 0 })}
                  className="h-9 rounded-lg text-sm w-20"
                />
              </TableCell>
              <TableCell>
                <div className="space-y-2 min-w-[220px]">
                  <Input
                    type="url"
                    placeholder="圖片網址"
                    value={inlineAddForm.photo || ""}
                    onChange={(e) => setInlineAddForm({ ...inlineAddForm, photo: e.target.value })}
                    className="h-9 rounded-lg text-sm"
                  />
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={onInlineAddPhotoFileSelect}
                    className="h-9 rounded-lg text-sm file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-2 file:py-1 file:text-xs file:font-medium file:text-blue-700"
                  />
                  {inlineAddPhotoUploading && (
                    <div className="text-xs text-blue-600">圖片上傳中...</div>
                  )}
                  {inlineAddPhotoPreviewUrl || inlineAddForm.photo ? (
                    <img
                      src={inlineAddPhotoPreviewUrl || inlineAddForm.photo}
                      alt="圖片預覽"
                      className="w-16 h-16 object-cover rounded-xl border border-gray-200"
                    />
                  ) : (
                    <div className="w-16 h-16 flex items-center justify-center text-gray-400 border border-dashed border-gray-300 rounded-xl text-xs">
                      NO IMAGE
                    </div>
                  )}
                </div>
              </TableCell>
            </TableRow>
          )}
          {foods.map((food) => (
            <FoodTableRow
              key={food.$id}
              food={food}
              onDelete={onDelete}
              onQuickCleanup={onQuickCleanup}
              onAmountChange={onAmountChange}
              isEditing={inlineEditingId === food.$id}
              inlineEditForm={inlineEditForm}
              setInlineEditForm={setInlineEditForm}
              onInlineEdit={onInlineEdit}
              onInlineSave={onInlineSave}
              onInlineCancel={onInlineCancel}
              onInlinePhotoFileSelect={onInlinePhotoFileSelect}
              inlinePhotoPreviewUrl={inlinePhotoPreviewUrl}
              inlinePhotoUploading={inlinePhotoUploading}
              isEditMode={isEditMode}
              isSelected={selectedIds.has(food.$id)}
              toggleSelect={toggleSelect}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

interface FoodTableRowProps {
  food: Food;
  onDelete: (id: string) => void;
  onQuickCleanup: (food: Food, action: CleanupAction) => void;
  onAmountChange: (food: Food, delta: number) => void;
  isEditing: boolean;
  inlineEditForm: FoodFormData;
  setInlineEditForm: (form: FoodFormData) => void;
  onInlineEdit: (food: Food) => void;
  onInlineSave: () => void;
  onInlineCancel: () => void;
  onInlinePhotoFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  inlinePhotoPreviewUrl: string;
  inlinePhotoUploading: boolean;
  isEditMode: boolean;
  isSelected: boolean;
  toggleSelect: (id: string) => void;
}

function FoodTableRow({ food, onDelete, onQuickCleanup, onAmountChange, isEditing, inlineEditForm, setInlineEditForm, onInlineEdit, onInlineSave, onInlineCancel, onInlinePhotoFileSelect, inlinePhotoPreviewUrl, inlinePhotoUploading, isEditMode, isSelected, toggleSelect }: FoodTableRowProps) {
  const { daysRemaining, status, formattedDate, isExpired, isExpiringSoon } = getFoodExpiryInfo(food);
  const rowClass = isExpired ? "bg-red-50 dark:bg-red-900/20" : isExpiringSoon ? "bg-yellow-50 dark:bg-yellow-900/20" : "";

  if (isEditing) {
    return (
      <TableRow className="bg-blue-50 dark:bg-blue-900/20">
        <TableCell className="font-medium">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-12 shrink-0">名稱</span>
              <Input
                placeholder="食品名稱"
                value={inlineEditForm.name}
                onChange={(e) => setInlineEditForm({ ...inlineEditForm, name: e.target.value })}
                className="h-9 rounded-lg text-sm"
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-12 shrink-0">價格</span>
              <Input
                type="number"
                min="0"
                placeholder="價格"
                value={inlineEditForm.price || ""}
                onChange={(e) => setInlineEditForm({ ...inlineEditForm, price: e.target.value === "" ? 0 : parseInt(e.target.value) || 0 })}
                className="h-9 rounded-lg text-sm w-24"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-12 shrink-0">商店</span>
              <Input
                placeholder="商店名稱"
                value={inlineEditForm.shop || ""}
                onChange={(e) => setInlineEditForm({ ...inlineEditForm, shop: e.target.value })}
                className="h-9 rounded-lg text-sm"
              />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Button type="button" size="sm" onClick={onInlineSave} disabled={inlinePhotoUploading} className="rounded-lg bg-green-500 hover:bg-green-600 text-white h-8 w-8 p-0" title="儲存"><Check size={16} /></Button>
              <Button type="button" size="sm" variant="outline" onClick={onInlineCancel} disabled={inlinePhotoUploading} className="rounded-lg h-8 w-8 p-0" title="取消"><X size={16} /></Button>
              <Button type="button" size="sm" variant="destructive" onClick={() => onDelete(food.$id)} disabled={inlinePhotoUploading} className="rounded-lg h-8 w-8 p-0" title="刪除"><Trash2 size={16} /></Button>
            </div>
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <Input
              type="date"
              value={inlineEditForm.todate || ""}
              onChange={(e) => setInlineEditForm({ ...inlineEditForm, todate: e.target.value })}
              className="h-9 rounded-lg text-sm"
            />
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => {
                  if (!inlineEditForm.todate) return;
                  const d = new Date(inlineEditForm.todate);
                  d.setDate(d.getDate() + 7);
                  setInlineEditForm({ ...inlineEditForm, todate: d.toISOString().split('T')[0] });
                }}
                className="p-1 hover:bg-blue-100 dark:hover:bg-blue-800 text-blue-600 rounded transition-colors"
                title="+7天"
              >
                <Plus size={12} />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!inlineEditForm.todate) return;
                  const d = new Date(inlineEditForm.todate);
                  d.setDate(d.getDate() - 7);
                  setInlineEditForm({ ...inlineEditForm, todate: d.toISOString().split('T')[0] });
                }}
                className="p-1 hover:bg-orange-100 dark:hover:bg-orange-800 text-orange-600 rounded transition-colors"
                title="-7天"
              >
                <Minus size={12} />
              </button>
            </div>
          </div>
        </TableCell>
        <TableCell>
          <Input
            type="number"
            min="0"
            value={inlineEditForm.amount || ""}
            onChange={(e) => setInlineEditForm({ ...inlineEditForm, amount: e.target.value === "" ? 0 : parseInt(e.target.value) || 0 })}
            className="h-9 rounded-lg text-sm w-20"
          />
        </TableCell>
        <TableCell>
          <div className="space-y-2 min-w-[220px]">
            <Input
              type="url"
              placeholder="圖片網址"
              value={inlineEditForm.photo || ""}
              onChange={(e) => setInlineEditForm({ ...inlineEditForm, photo: e.target.value })}
              className="h-9 rounded-lg text-sm"
            />
            <Input
              type="file"
              accept="image/*"
              onChange={onInlinePhotoFileSelect}
              className="h-9 rounded-lg text-sm file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-2 file:py-1 file:text-xs file:font-medium file:text-blue-700"
            />
            {inlinePhotoUploading && (
              <div className="text-xs text-blue-600">圖片上傳中...</div>
            )}
            <FoodImage
              food={{
                ...food,
                photo: inlinePhotoPreviewUrl || inlineEditForm.photo || food.photo,
              }}
            />
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow className={`hover:bg-gray-50/50 dark:hover:bg-gray-700/50 ${rowClass}`}>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {isEditMode && (
            <button
              type="button"
              onClick={() => toggleSelect(food.$id)}
              className="text-gray-400 hover:text-purple-600 transition-colors"
            >
              {isSelected ? <CheckSquare size={18} className="text-purple-600" /> : <Square size={18} />}
            </button>
          )}
          <span>{food.name}</span>
          {isEditMode && (
            <Button type="button" size="sm" variant="outline" onClick={() => onInlineEdit(food)} className="rounded-lg h-7 px-2" title="編輯"><Pencil size={14} /></Button>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <span>{formattedDate}</span>
          {status !== "normal" && (
            <StatusBadge status={status}>{formatDaysRemaining(daysRemaining)}</StatusBadge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <AmountControl food={food} onAmountChange={onAmountChange} />
      </TableCell>
      <TableCell>
        <FoodImage food={food} />
      </TableCell>
      {!isEditMode && (
        <TableCell>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => onInlineEdit(food)} className="rounded-lg">編輯</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => onQuickCleanup(food, "eat")} className="rounded-lg border-emerald-200 text-emerald-700 hover:bg-emerald-50">吃完</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => onQuickCleanup(food, "discard")} className="rounded-lg border-orange-200 text-orange-700 hover:bg-orange-50">丟棄</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => {
              onInlineEdit(food);
              setInlineEditForm({
                name: food.name,
                amount: food.amount,
                todate: addDaysToDate(formatDate(food.todate), 3),
                photo: food.photo || '',
                price: food.price || 0,
                shop: food.shop || '',
                photohash: food.photohash || '',
              });
            }} className="rounded-lg border-blue-200 text-blue-700 hover:bg-blue-50">+3天</Button>
            <Button type="button" size="sm" variant="destructive" onClick={() => onDelete(food.$id)} className="rounded-lg">刪除</Button>
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}

// 手機版列表
function MobileList({ foods, onDelete, onQuickCleanup, onAmountChange, inlineEditingId, inlineEditForm, setInlineEditForm, onInlineEdit, onInlineSave, onInlineCancel, onInlinePhotoFileSelect, inlinePhotoPreviewUrl, inlinePhotoUploading, isEditMode, setIsEditMode, selectedIds, toggleSelect, isAllSelected, toggleSelectAll, deleteSelected, isInlineAdding, inlineAddForm, setInlineAddForm, onInlineAddPhotoFileSelect, inlineAddPhotoPreviewUrl, inlineAddPhotoUploading, onInlineAddSave, onInlineAddCancel, startInlineAdd }: TableProps) {
  if (foods.length === 0) {
    return (
      <div className="lg:hidden">
        <EmptyState emoji="📦" title="暫無食品資料" description="點擊上方表單新增第一個食品" />
      </div>
    );
  }

  return (
    <div className="lg:hidden px-1 overflow-x-hidden">
      <div className="mb-3 flex items-center gap-2 flex-wrap">
        <span className="font-semibold text-gray-700 dark:text-gray-300">食品列表</span>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            if (isInlineAdding) {
              onInlineAddCancel();
            } else {
              startInlineAdd();
            }
          }}
          variant="outline"
          className="rounded-lg flex items-center gap-1 border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700 h-7 px-2 text-xs"
        >
          {isInlineAdding ? <X size={14} /> : <Plus size={14} />}
          {isInlineAdding ? "取消" : "新增"}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setIsEditMode(!isEditMode);
            if (isEditMode) {
              onInlineCancel();
            }
          }}
          variant="outline"
          className={`rounded-lg flex items-center gap-1 h-7 px-2 text-xs ${isEditMode ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
        >
          <Pencil size={14} />
          {isEditMode ? "取消編輯" : "編輯"}
        </Button>
        {isEditMode && (
          <Button
            type="button"
            size="sm"
            onClick={toggleSelectAll}
            variant="outline"
            className={`rounded-lg flex items-center gap-1 h-7 px-2 text-xs ${isAllSelected ? 'border-purple-500 text-purple-600 bg-purple-50' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
          >
            {isAllSelected ? <CheckSquare size={14} /> : <Square size={14} />}
            {isAllSelected ? "取消全選" : "全選"}
            {selectedIds.size > 0 && ` (${selectedIds.size})`}
          </Button>
        )}
        {isEditMode && selectedIds.size > 0 && (
          <Button
            type="button"
            size="sm"
            onClick={deleteSelected}
            variant="outline"
            className="rounded-lg flex items-center gap-1 h-7 px-2 text-xs border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 size={14} />
            刪除選中 ({selectedIds.size})
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 min-[390px]:gap-4 sm:grid-cols-2">
        {/* 行內新增卡片 (手機版) */}
        {isInlineAdding && (
          <div className="p-4 border-b last:border-0 border-gray-100 dark:border-gray-800 bg-green-50 dark:bg-green-900/20 rounded-xl">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-12 shrink-0">名稱</span>
                <Input
                  placeholder="食品名稱"
                  value={inlineAddForm.name}
                  onChange={(e) => setInlineAddForm({ ...inlineAddForm, name: e.target.value })}
                  className="h-10 rounded-lg flex-1"
                  required
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-1">
                  <span className="text-xs text-gray-500 w-12 shrink-0">期限</span>
                  <Input
                    type="date"
                    value={inlineAddForm.todate || ""}
                    onChange={(e) => setInlineAddForm({ ...inlineAddForm, todate: e.target.value })}
                    className="h-10 rounded-lg flex-1"
                  />
                  {inlineAddForm.todate && (
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (!inlineAddForm.todate) return;
                          const d = new Date(inlineAddForm.todate);
                          d.setDate(d.getDate() + 7);
                          setInlineAddForm({ ...inlineAddForm, todate: d.toISOString().split('T')[0] });
                        }}
                        className="p-1 hover:bg-blue-100 dark:hover:bg-blue-800 text-blue-600 rounded transition-colors"
                        title="+7天"
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!inlineAddForm.todate) return;
                          const d = new Date(inlineAddForm.todate);
                          d.setDate(d.getDate() - 7);
                          setInlineAddForm({ ...inlineAddForm, todate: d.toISOString().split('T')[0] });
                        }}
                        className="p-1 hover:bg-orange-100 dark:hover:bg-orange-800 text-orange-600 rounded transition-colors"
                        title="-7天"
                      >
                        <Minus size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-12 shrink-0">數量</span>
                <Input
                  type="number"
                  min="0"
                  placeholder="數量"
                  value={inlineAddForm.amount || ""}
                  onChange={(e) => setInlineAddForm({ ...inlineAddForm, amount: e.target.value === "" ? 0 : parseInt(e.target.value) || 0 })}
                  className="h-10 rounded-lg flex-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-12 shrink-0">價格</span>
                <Input
                  type="number"
                  min="0"
                  placeholder="價格"
                  value={inlineAddForm.price || ""}
                  onChange={(e) => setInlineAddForm({ ...inlineAddForm, price: e.target.value === "" ? 0 : parseInt(e.target.value) || 0 })}
                  className="h-10 rounded-lg flex-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-12 shrink-0">商店</span>
                <Input
                  placeholder="商店名稱"
                  value={inlineAddForm.shop || ""}
                  onChange={(e) => setInlineAddForm({ ...inlineAddForm, shop: e.target.value })}
                  className="h-10 rounded-lg flex-1"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-12 shrink-0">圖片</span>
                  <Input
                    type="url"
                    placeholder="圖片網址"
                    value={inlineAddForm.photo || ""}
                    onChange={(e) => setInlineAddForm({ ...inlineAddForm, photo: e.target.value })}
                    className="h-10 rounded-lg flex-1"
                  />
                </div>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={onInlineAddPhotoFileSelect}
                  className="h-10 rounded-lg file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-2 file:py-1 file:text-xs file:font-medium file:text-blue-700"
                />
                {inlineAddPhotoUploading && (
                  <div className="text-xs text-blue-600">圖片上傳中...</div>
                )}
                {inlineAddPhotoPreviewUrl || inlineAddForm.photo ? (
                  <img
                    src={inlineAddPhotoPreviewUrl || inlineAddForm.photo}
                    alt="圖片預覽"
                    className="w-24 h-24 object-cover rounded-xl border border-gray-200"
                  />
                ) : (
                  <div className="w-24 h-24 flex items-center justify-center text-gray-400 border border-dashed border-gray-300 rounded-xl text-xs">
                    NO IMAGE
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Button type="button" size="sm" onClick={onInlineAddSave} className="rounded-lg bg-green-500 hover:bg-green-600 text-white h-10 px-4 flex items-center gap-1 font-bold"><Check size={16} /> 新增</Button>
                <Button type="button" size="sm" variant="outline" onClick={onInlineAddCancel} className="rounded-lg h-10 px-4 flex items-center gap-1 font-bold"><X size={16} /> 取消</Button>
              </div>
            </div>
          </div>
        )}
        {foods.map((food) => (
          <FoodMobileCard
            key={food.$id}
            food={food}
            onDelete={onDelete}
            onQuickCleanup={onQuickCleanup}
            onAmountChange={onAmountChange}
            isEditing={inlineEditingId === food.$id}
            inlineEditForm={inlineEditForm}
            setInlineEditForm={setInlineEditForm}
            onInlineEdit={onInlineEdit}
            onInlineSave={onInlineSave}
            onInlineCancel={onInlineCancel}
            onInlinePhotoFileSelect={onInlinePhotoFileSelect}
            inlinePhotoPreviewUrl={inlinePhotoPreviewUrl}
            inlinePhotoUploading={inlinePhotoUploading}
            isEditMode={isEditMode}
            isSelected={selectedIds.has(food.$id)}
            toggleSelect={toggleSelect}
          />
        ))}
      </div>
    </div>
  );
}

interface FoodMobileCardProps {
  food: Food;
  onDelete: (id: string) => void;
  onQuickCleanup: (food: Food, action: CleanupAction) => void;
  onAmountChange: (food: Food, delta: number) => void;
  isEditing: boolean;
  inlineEditForm: FoodFormData;
  setInlineEditForm: (form: FoodFormData) => void;
  onInlineEdit: (food: Food) => void;
  onInlineSave: () => void;
  onInlineCancel: () => void;
  onInlinePhotoFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  inlinePhotoPreviewUrl: string;
  inlinePhotoUploading: boolean;
  isEditMode: boolean;
  isSelected: boolean;
  toggleSelect: (id: string) => void;
}

function FoodMobileCard({ food, onDelete, onQuickCleanup, onAmountChange, isEditing, inlineEditForm, setInlineEditForm, onInlineEdit, onInlineSave, onInlineCancel, onInlinePhotoFileSelect, inlinePhotoPreviewUrl, inlinePhotoUploading, isEditMode, isSelected, toggleSelect }: FoodMobileCardProps) {
  const { daysRemaining, status, formattedDate, isExpired, isExpiringSoon } = getFoodExpiryInfo(food);

  if (isEditing) {
    return (
      <div className="p-4 border-b last:border-0 border-gray-100 dark:border-gray-800 bg-blue-50 dark:bg-blue-900/20">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-12 shrink-0">名稱</span>
            <Input
              placeholder="食品名稱"
              value={inlineEditForm.name}
              onChange={(e) => setInlineEditForm({ ...inlineEditForm, name: e.target.value })}
              className="h-10 rounded-lg flex-1"
              required
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-1">
              <span className="text-xs text-gray-500 w-12 shrink-0">期限</span>
              <Input
                type="date"
                value={inlineEditForm.todate || ""}
                onChange={(e) => setInlineEditForm({ ...inlineEditForm, todate: e.target.value })}
                className="h-10 rounded-lg flex-1"
              />
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    if (!inlineEditForm.todate) return;
                    const d = new Date(inlineEditForm.todate);
                    d.setDate(d.getDate() + 7);
                    setInlineEditForm({ ...inlineEditForm, todate: d.toISOString().split('T')[0] });
                  }}
                  className="p-1 hover:bg-blue-100 dark:hover:bg-blue-800 text-blue-600 rounded transition-colors"
                  title="+7天"
                >
                  <Plus size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!inlineEditForm.todate) return;
                    const d = new Date(inlineEditForm.todate);
                    d.setDate(d.getDate() - 7);
                    setInlineEditForm({ ...inlineEditForm, todate: d.toISOString().split('T')[0] });
                  }}
                  className="p-1 hover:bg-orange-100 dark:hover:bg-orange-800 text-orange-600 rounded transition-colors"
                  title="-7天"
                >
                  <Minus size={14} />
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-12 shrink-0">數量</span>
            <Input
              type="number"
              min="0"
              placeholder="數量"
              value={inlineEditForm.amount || ""}
              onChange={(e) => setInlineEditForm({ ...inlineEditForm, amount: e.target.value === "" ? 0 : parseInt(e.target.value) || 0 })}
              className="h-10 rounded-lg flex-1"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-12 shrink-0">價格</span>
            <Input
              type="number"
              min="0"
              placeholder="價格"
              value={inlineEditForm.price || ""}
              onChange={(e) => setInlineEditForm({ ...inlineEditForm, price: e.target.value === "" ? 0 : parseInt(e.target.value) || 0 })}
              className="h-10 rounded-lg flex-1"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-12 shrink-0">商店</span>
            <Input
              placeholder="商店名稱"
              value={inlineEditForm.shop || ""}
              onChange={(e) => setInlineEditForm({ ...inlineEditForm, shop: e.target.value })}
              className="h-10 rounded-lg flex-1"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-12 shrink-0">圖片</span>
              <Input
                type="url"
                placeholder="圖片網址"
                value={inlineEditForm.photo || ""}
                onChange={(e) => setInlineEditForm({ ...inlineEditForm, photo: e.target.value })}
                className="h-10 rounded-lg flex-1"
              />
            </div>
            <Input
              type="file"
              accept="image/*"
              onChange={onInlinePhotoFileSelect}
              className="h-10 rounded-lg file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-2 file:py-1 file:text-xs file:font-medium file:text-blue-700"
            />
            {inlinePhotoUploading && (
              <div className="text-xs text-blue-600">圖片上傳中...</div>
            )}
            <FoodImage
              food={{
                ...food,
                photo: inlinePhotoPreviewUrl || inlineEditForm.photo || food.photo,
              }}
              className="w-24 h-24"
            />
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Button type="button" size="sm" onClick={onInlineSave} disabled={inlinePhotoUploading} className="rounded-lg bg-green-500 hover:bg-green-600 text-white h-10 px-4 flex items-center gap-1 font-bold"><Check size={16} /> 儲存</Button>
            <Button type="button" size="sm" variant="outline" onClick={onInlineCancel} disabled={inlinePhotoUploading} className="rounded-lg h-10 px-4 flex items-center gap-1 font-bold"><X size={16} /> 取消</Button>
            <Button type="button" size="sm" variant="destructive" onClick={() => onDelete(food.$id)} disabled={inlinePhotoUploading} className="rounded-lg h-10 px-4 flex items-center gap-1 font-bold"><Trash2 size={16} /> 刪除</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full overflow-hidden p-3 min-[390px]:p-4 border-b last:border-0 border-gray-100 dark:border-gray-800 ${isExpired ? "bg-red-50/50" : isExpiringSoon ? "bg-amber-50/50" : ""}`}>
      <div className="flex gap-3 min-[390px]:gap-4 items-start">
        {isEditMode && (
          <button
            type="button"
            onClick={() => toggleSelect(food.$id)}
            className="text-gray-400 hover:text-purple-600 transition-colors mt-1"
          >
            {isSelected ? <CheckSquare size={22} className="text-purple-600" /> : <Square size={22} />}
          </button>
        )}
        <FoodImage food={food} className="h-16 w-16 min-[390px]:h-20 min-[390px]:w-20 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start gap-2">
            <h3 className="min-w-0 flex-1 font-bold text-gray-900 dark:text-gray-100 text-base min-[390px]:text-lg leading-snug break-words line-clamp-2">
              {food.name}
            </h3>
            {isEditMode && (
              <Button type="button" size="sm" variant="outline" onClick={() => onInlineEdit(food)} className="rounded-lg h-8 px-2 shrink-0" title="編輯"><Pencil size={14} /></Button>
            )}
          </div>
          <div className="mt-1 space-y-1">
            <div className="flex items-center gap-1.5 text-xs min-[390px]:text-sm text-gray-500 dark:text-gray-400">
              <span className="font-medium">期限:</span>
              <span className={isExpired ? "text-red-600 font-bold" : isExpiringSoon ? "text-amber-600 font-bold" : ""}>
                {formattedDate}
              </span>
            </div>
            {status !== "normal" && (
              <StatusBadge status={status}>{formatDaysRemaining(daysRemaining)}</StatusBadge>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 min-[390px]:mt-4 flex flex-col gap-3">
        <div className="w-full">
          <AmountControl food={food} onAmountChange={onAmountChange} />
        </div>
        {!isEditMode && (
          <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onInlineEdit(food)}
              className="h-10 min-[390px]:h-11 rounded-xl text-blue-600 border-blue-200 hover:bg-blue-50 font-bold w-full"
            >
              編輯
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onQuickCleanup(food, "eat")}
              className="h-10 min-[390px]:h-11 rounded-xl font-bold text-emerald-700 border-emerald-200 hover:bg-emerald-50 w-full"
            >
              吃完
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onQuickCleanup(food, "discard")}
              className="h-10 min-[390px]:h-11 rounded-xl font-bold text-orange-700 border-orange-200 hover:bg-orange-50 w-full"
            >
              丟棄
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => onDelete(food.$id)}
              className="h-10 min-[390px]:h-11 rounded-xl font-bold w-full"
            >
              刪除
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// 數量控制元件
function AmountControl({ food, onAmountChange }: { food: Food; onAmountChange: (food: Food, delta: number) => void }) {
  return (
    <div className="flex items-center justify-between w-full bg-gray-50 dark:bg-gray-900 rounded-xl p-1.5 border border-gray-200 dark:border-gray-700">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => onAmountChange(food, -1)}
        disabled={food.amount <= 0}
        className="w-10 h-10 p-0 rounded-lg text-gray-500 hover:text-red-500 hover:bg-white dark:hover:bg-gray-800"
      >
        -
      </Button>
      <div className="flex flex-col items-center">
        <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">數量</span>
        <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{food.amount}</span>
      </div>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => onAmountChange(food, 1)}
        className="w-10 h-10 p-0 rounded-lg text-gray-500 hover:text-green-500 hover:bg-white dark:hover:bg-gray-800"
      >
        +
      </Button>
    </div>
  );
}

// 食品圖片元件
function FoodImage({ food, className }: { food: Food; className?: string }) {
  const baseClass = "object-cover rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-800";
  const sizeClass = className || "w-16 h-16";

  if (food.photo) {
    return (
      <img src={food.photo} alt={food.name} className={`${baseClass} ${sizeClass}`} />
    );
  }
  return (
    <div className={`${baseClass} ${sizeClass} flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 gap-1`}>
      <div className="text-[10px] font-medium opacity-50">NO IMAGE</div>
    </div>
  );
}
