"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Plus, Minus, ChevronDown, Download, Upload, X, Trash2, Pencil, Check, Square, CheckSquare, AlertTriangle, Sparkles, PackageOpen, CalendarClock, RefreshCw, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormCard, FormGrid, FormActions } from "@/components/ui/form-card";
import { DataCard } from "@/components/ui/data-card";
import { FriendlyAiCrudShell } from "@/components/ui/friendly-ai-crud-shell";
import { VoiceCommandBar } from "@/components/ui/voice-command-bar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FullPageLoading } from "@/components/ui/loading-spinner";
import { StatusBadge } from "@/components/ui/status-badge";
import { useFoods, getFoodExpiryInfo } from "@/hooks/useFoods";
import { fetchApi } from "@/hooks/useApi";
import { playVoiceSuccessTone, useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { API_ENDPOINTS } from "@/lib/constants";
import { shouldAutoExecuteVoiceRisk } from "@/lib/voicePreferences";
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
type VoiceRisk = "safe" | "review" | "danger";
type FoodVoiceAction =
  | "importCsv"
  | "exportCsv"
  | "refresh"
  | "selectAll"
  | "clearSelection"
  | "filterAll"
  | "filterExpired"
  | "filterToday"
  | "filter3Days"
  | "filter7Days"
  | "filterNormal"
  | "filterNoDate"
  | "search"
  | "add"
  | "quickAdd"
  | "edit"
  | "duplicate"
  | "deleteSelected"
  | "deleteOne"
  | "eatSelected"
  | "discardSelected"
  | "increaseAmount"
  | "decreaseAmount"
  | "setAmount"
  | "setDate"
  | "setPrice"
  | "setShop"
  | "clearDate"
  | "noop";

type FoodVoiceCommand = {
  action: FoodVoiceAction;
  summary: string;
  risk: VoiceRisk;
  rawText: string;
};

const FOOD_DELETE_CONFIRMATION = "DELETE food";
const FOOD_VOICE_HELP =
  "可說：新增牛奶 2 瓶 7 天後到期、搜尋 Costco、7 天內、庫存加 3、把第一筆價格改成 99、刪除選取。說完會自動結束；安全操作直接執行。";

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

function getFoodMonthValue(food: Food) {
  if (!food.todate) return "";
  const date = new Date(food.todate);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 7);
}

function getFoodDateTime(food: Food) {
  if (!food.todate) return Number.POSITIVE_INFINITY;
  const time = new Date(food.todate).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

function sortFoodsNearToFar(a: Food, b: Food) {
  return getFoodDateTime(a) - getFoodDateTime(b);
}

function normalizeFoodVoiceValue(value?: string | number | null) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[，。,.!?！？、：:「」『』"'()（）]/g, "");
}

function formatVoiceDateValue(year: number, month: number, day: number) {
  if (!year || !month || !day) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function chineseNumberToNumber(input: string) {
  const map: Record<string, number> = {
    零: 0,
    一: 1,
    二: 2,
    兩: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
  };
  if (/^\d+$/.test(input)) return Number(input);
  if (input === "十") return 10;
  if (input.includes("十")) {
    const [left, right] = input.split("十");
    return (left ? map[left] ?? 0 : 1) * 10 + (right ? map[right] ?? 0 : 0);
  }
  return map[input] ?? 0;
}

function formatMonthOption(month: string) {
  return `${month} 月`;
}

function formatFoodPrice(price?: number) {
  if (!price) return "";
  return `NT$ ${price.toLocaleString("zh-TW")}`;
}

function getExpiryBucket(daysRemaining: number): FilterMode {
  if (daysRemaining < 0) return "expired";
  if (daysRemaining === 0) return "today";
  if (daysRemaining <= 3) return "3days";
  if (daysRemaining <= 7) return "7days";
  return "normal";
}

function getFoodFormExpiryInfo(form: FoodFormData, id = "") {
  return getFoodExpiryInfo({
    ...form,
    $id: id,
    photo: form.photo || "",
  });
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
  const [yearFilter, setYearFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
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
  const [voiceFeedback, setVoiceFeedback] = useState(FOOD_VOICE_HELP);
  const [pendingVoiceCommand, setPendingVoiceCommand] = useState<FoodVoiceCommand | null>(null);
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
      setVoiceFeedback("正在聽…說完停頓一下會自動結束，也可按「說完了」。");
    },
  });
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

  const yearOptions = useMemo(() => {
    const years = foods
      .map(getFoodMonthValue)
      .filter(Boolean)
      .map((month) => month.split("-")[0])
      .filter(Boolean);
    return Array.from(new Set(years)).sort((a, b) => Number(a) - Number(b));
  }, [foods]);

  const monthOptions = useMemo(() => {
    const months = foods
      .map(getFoodMonthValue)
      .filter(Boolean)
      .filter((month) => (yearFilter && yearFilter !== "no-date" ? month.startsWith(`${yearFilter}-`) : true))
      .map((month) => month.split("-")[1])
      .filter(Boolean);
    return Array.from(new Set(months)).sort((a, b) => Number(a) - Number(b));
  }, [foods, yearFilter]);

  // 搜尋 + 分區過濾
  const filteredFoods = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return foods.filter((food) => {
      const matchesQuery = !searchQuery.trim() ||
        food.name?.toLowerCase().includes(query) ||
        food.shop?.toLowerCase().includes(query);
      const bucket = getExpiryBucket(getFoodExpiryInfo(food).daysRemaining);
      const matchesFilter = filterMode === "all" ? true : bucket === filterMode;
      const foodMonth = getFoodMonthValue(food);
      const [foodYear, foodMonthNumber] = foodMonth.split("-");
      const matchesYear =
        yearFilter === "no-date" ? !foodMonth : yearFilter ? foodYear === yearFilter : true;
      const matchesMonth = yearFilter === "no-date" ? true : monthFilter ? foodMonthNumber === monthFilter : true;
      return matchesQuery && matchesFilter && matchesYear && matchesMonth;
    }).sort(sortFoodsNearToFar);
  }, [foods, searchQuery, filterMode, yearFilter, monthFilter]);

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

  const handleDelete = async (id: string) => {
    if (!confirm("確定刪除？")) return;
    try {
      await deleteFood(id);
    } catch {
      alert("刪除失敗，請稍後再試");
    }
  };

  const handleDuplicateFood = (food: Food) => {
    resetInlinePhotoState();
    resetInlineAddPhotoState();
    setInlineEditingId(null);
    setInlineEditForm(INITIAL_FORM);
    setInlineAddForm({
      name: `${food.name}（複製）`,
      amount: food.amount,
      todate: formatDate(food.todate),
      photo: food.photo || "",
      price: food.price || 0,
      shop: food.shop || "",
      photohash: food.photohash || "",
    });
    setIsInlineAdding(true);
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
  const resetFoodFilters = () => {
    setFilterMode("all");
    setYearFilter("");
    setMonthFilter("");
    setSearchQuery("");
  };

  const findVoiceTarget = (text: string) => {
    if (filteredFoods.length === 0) return null;
    const ordinalMatch = text.match(/第\s*(\d+|[一二兩三四五六七八九十]+)\s*(?:筆|個|項)?/);
    if (ordinalMatch) {
      const index = chineseNumberToNumber(ordinalMatch[1]) - 1;
      if (index >= 0 && index < filteredFoods.length) return filteredFoods[index];
    }
    if (/第一筆|第一個|第一項/.test(text)) return filteredFoods[0];
    if (/最後一筆|最後一個|最後一項/.test(text)) return filteredFoods[filteredFoods.length - 1];

    const normalizedText = normalizeFoodVoiceValue(text);
    return filteredFoods.find((food) => {
      const values = [food.name, food.shop, food.todate, food.price, food.amount].map(normalizeFoodVoiceValue).filter(Boolean);
      return values.some((value) => normalizedText.includes(value) || value.includes(normalizedText));
    }) || filteredFoods[0];
  };

  const extractVoiceDate = (text: string) => {
    const relative = text.match(/(\d+|[一二兩三四五六七八九十]+)\s*(?:天|日)\s*(?:後|內|以後)?/);
    if (relative) {
      const days = chineseNumberToNumber(relative[1]);
      if (days >= 0) return { date: getSuggestedExpiryDate(days), raw: relative[0] };
    }
    if (/明天/.test(text)) return { date: getSuggestedExpiryDate(1), raw: "明天" };
    if (/後天/.test(text)) return { date: getSuggestedExpiryDate(2), raw: "後天" };
    if (/下週|下禮拜|一週後|一星期後/.test(text)) return { date: getSuggestedExpiryDate(7), raw: text.match(/下週|下禮拜|一週後|一星期後/)?.[0] || "" };
    if (/月底/.test(text)) {
      const now = new Date();
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { date: end.toISOString().split("T")[0], raw: "月底" };
    }
    const slashDate = text.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (slashDate) return { date: formatVoiceDateValue(Number(slashDate[1]), Number(slashDate[2]), Number(slashDate[3])), raw: slashDate[0] };
    const zhDate = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*(?:日|號|号)?/);
    if (zhDate) return { date: formatVoiceDateValue(Number(zhDate[1]), Number(zhDate[2]), Number(zhDate[3])), raw: zhDate[0] };
    const monthDay = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*(?:日|號|号)?/);
    if (monthDay) return { date: formatVoiceDateValue(new Date().getFullYear(), Number(monthDay[1]), Number(monthDay[2])), raw: monthDay[0] };
    return { date: "", raw: "" };
  };

  const extractVoiceNumber = (text: string, labels: string[]) => {
    for (const label of labels) {
      const match = text.match(new RegExp(`${label}\\s*(?:是|為|改成|設為|:|：)?\\s*(\\d+(?:\\.\\d+)?)`, "i"));
      if (match) return Number(match[1]);
    }
    return null;
  };

  const extractVoiceAmount = (text: string) => {
    const explicitAmount = extractVoiceNumber(text, ["數量", "庫存", "個數", "份數", "amount"]);
    if (explicitAmount !== null) return explicitAmount;
    const unitAmount = text.match(/(\d+(?:\.\d+)?)\s*(?:個|瓶|盒|包|袋|罐|份|顆|台|組|件|公斤|kg|公克|g)/i);
    return unitAmount ? Number(unitAmount[1]) : null;
  };

  const extractVoicePrice = (text: string) => {
    const explicitPrice = extractVoiceNumber(text, ["價格", "價錢", "金額", "售價", "price"]);
    if (explicitPrice !== null) return explicitPrice;
    const currencyPrice = text.match(/(?:nt\$|twd|台幣|新台幣)?\s*(\d+(?:\.\d+)?)\s*(?:元|塊|twd)/i);
    return currencyPrice ? Number(currencyPrice[1]) : null;
  };

  const extractVoiceShop = (text: string) => {
    const match = text.match(/(?:商店|店家|購買地|賣場|通路|shop)\s*(?:是|為|在|:|：)?\s*([^，。,.!?！？\s]+)/i);
    return match?.[1]?.trim() || "";
  };

  const extractVoiceSearchQuery = (text: string) => {
    return text.replace(/搜尋|查詢|找|查看|search|find|鋒兄食品|食品|庫存|商品/gi, " ").replace(/\s+/g, " ").trim();
  };

  const extractVoiceName = (text: string, dateRaw: string) => {
    const quoted = text.match(/[「『"']([^」』"']+)[」』"']/);
    if (quoted?.[1]) return quoted[1].trim();
    const named = text.match(/(?:叫做|名稱(?:是|為)?|品名(?:是|為)?|名為)\s*(.+?)(?=\s*(?:數量|庫存|價格|價錢|金額|到期|有效|日期|商店|店家|購買地|賣場|$))/);
    if (named?.[1]) return named[1].trim();
    return text
      .replace(dateRaw, " ")
      .replace(/新增食品|新增商品|新增庫存|新增一筆資料|新增一筆|新增資料|新增|建立食品|建立商品|建立|在鋒兄食品|鋒兄食品|食品|商品|庫存|到期|有效期限|有效日期/gi, " ")
      .replace(/叫做|名稱是|名稱為|品名是|品名為|名為|日期為|日期是|明天|後天|下週|下禮拜|月底/gi, " ")
      .replace(/(?:數量|庫存|個數|份數)\s*(?:是|為|改成|設為|:|：)?\s*\d+(?:\.\d+)?/gi, " ")
      .replace(/(?:價格|價錢|金額|售價)\s*(?:是|為|改成|設為|:|：)?\s*\d+(?:\.\d+)?/gi, " ")
      .replace(/(?:nt\$|twd|台幣|新台幣)?\s*\d+(?:\.\d+)?\s*(?:元|塊|twd)/gi, " ")
      .replace(/(?:商店|店家|購買地|賣場|通路)\s*(?:是|為|在|:|：)?\s*[^，。,.!?！？\s]+/gi, " ")
      .replace(/\d+\s*(?:個|瓶|盒|包|袋|罐|份|顆|台|組|件|公斤|kg|公克|g)/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  };

  const buildVoiceDraft = (text: string): FoodFormData => {
    const voiceDate = extractVoiceDate(text);
    return {
      ...INITIAL_FORM,
      name: extractVoiceName(text, voiceDate.raw),
      amount: extractVoiceAmount(text) ?? 1,
      todate: voiceDate.date || getSuggestedExpiryDate(7),
      price: extractVoicePrice(text) ?? 0,
      shop: extractVoiceShop(text),
    };
  };

  const [importPreview, setImportPreview] = useState<{ data: FoodFormData[], errors: string[] } | null>(null);
  const [importFormat, setImportFormat] = useState<'appwrite' | 'supabase' | null>(null);
  const [pendingCSVText, setPendingCSVText] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importDebugMessages, setImportDebugMessages] = useState<string[]>([]);
  // 匯入進度改用 ref 節流，避免每筆 setState 重渲整頁造成「匯入中」畫面閃爍
  const importProgressRef = useRef({ current: 0, total: 0 });
  const importDebugRef = useRef<string[]>([]);
  const importUiFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (importUiFlushTimerRef.current) {
        clearTimeout(importUiFlushTimerRef.current);
        importUiFlushTimerRef.current = null;
      }
    };
  }, []);

  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });
  const [exportDebugMessages, setExportDebugMessages] = useState<string[]>([]);
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

  const exportToCSV = async () => {
    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`;
      return str;
    };

    setExporting(true);
    setExportProgress({ current: 0, total: foods.length });
    setExportDebugMessages([`Export started: ${foods.length} rows`]);

    try {
      const rows = [CSV_HEADERS.join(',')];
      for (let i = 0; i < foods.length; i++) {
        const food = foods[i];
        rows.push([escapeCSV(food.name), escapeCSV(food.amount || 0), escapeCSV(food.todate || ''), escapeCSV(food.photo || ''), escapeCSV(food.price || 0), escapeCSV(food.shop || ''), escapeCSV(food.photohash || '')].join(','));
        setExportProgress({ current: i + 1, total: foods.length });
        setExportDebugMessages((prev) => [...prev.slice(-79), `${i + 1}/${foods.length} Exported ${food.name}`]);
        if (i % 25 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = getExportFilename('food');
      link.click();
      URL.revokeObjectURL(link.href);
      setExportDebugMessages((prev) => [...prev.slice(-79), `Export finished: ${foods.length} rows`]);
      setTimeout(() => {
        setExporting(false);
        setExportProgress({ current: 0, total: 0 });
      }, 1200);
    } catch (error) {
      console.error('Export CSV failed:', error);
      setExportDebugMessages((prev) => [...prev.slice(-79), 'Export failed']);
      setExporting(false);
      setExportProgress({ current: 0, total: 0 });
      throw error;
    }
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
    const target = e.target;
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const format = detectCSVFormat(text);
      if (format === 'appwrite') { setImportPreview(parseCSV(text)); }
      else if (format === 'supabase') { setImportFormat('supabase'); setPendingCSVText(text); }
      else { alert('無法辨識 CSV 格式：表頭不符合 Appwrite 或 Supabase 格式'); }
      setTimeout(() => { target.value = ''; }, 0);
    };
    reader.readAsText(file, 'UTF-8');
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

  const flushImportUi = (force = false) => {
    const pushState = () => {
      setImportProgress({ ...importProgressRef.current });
      setImportDebugMessages([...importDebugRef.current]);
      importUiFlushTimerRef.current = null;
    };

    if (force) {
      if (importUiFlushTimerRef.current) {
        clearTimeout(importUiFlushTimerRef.current);
        importUiFlushTimerRef.current = null;
      }
      pushState();
      return;
    }

    // 約每 200ms 刷新一次 UI，避免大 CSV 每筆都重渲
    if (importUiFlushTimerRef.current) return;
    importUiFlushTimerRef.current = setTimeout(pushState, 200);
  };

  const appendImportDebug = (message: string, forceFlush = false) => {
    importDebugRef.current = [...importDebugRef.current.slice(-79), message];
    flushImportUi(forceFlush);
  };

  const executeImport = async () => {
    if (!importPreview || importPreview.data.length === 0) return;

    const total = importPreview.data.length;
    importProgressRef.current = { current: 0, total };
    importDebugRef.current = [`Import started: ${total} rows`];
    setImporting(true);
    setImportProgress({ current: 0, total });
    setImportDebugMessages([`Import started: ${total} rows`]);

    // 快照現有資料，匯入過程不走 createFood/updateFood，
    // 避免每筆都 bumpRefreshKey → loadFoods(true) → FullPageLoading 造成畫面閃爍
    const existingByName = new Map(foods.map((f) => [f.name, f]));

    let successCount = 0, failCount = 0;
    for (let i = 0; i < importPreview.data.length; i++) {
      const formData = importPreview.data[i];
      const rowNo = i + 1;
      importProgressRef.current = { current: rowNo, total };
      appendImportDebug(`${rowNo}/${total} Processing ${formData.name}`);
      try {
        const existing = existingByName.get(formData.name);
        // 直接呼叫 API，完成後才統一重新載入一次
        if (existing) {
          await fetchApi(`${API_ENDPOINTS.FOOD}/${existing.$id}`, {
            method: "PUT",
            body: JSON.stringify(formData),
          });
        } else {
          const created = await fetchApi<Food>(API_ENDPOINTS.FOOD, {
            method: "POST",
            body: JSON.stringify(formData),
          });
          if (created?.$id) {
            existingByName.set(formData.name, created);
          }
        }
        successCount++;
        appendImportDebug(`${rowNo}/${total} Success ${formData.name}`, rowNo === total);
      } catch {
        failCount++;
        appendImportDebug(`${rowNo}/${total} Failed ${formData.name}`, rowNo === total);
      }
    }

    flushImportUi(true);
    if (importUiFlushTimerRef.current) {
      clearTimeout(importUiFlushTimerRef.current);
      importUiFlushTimerRef.current = null;
    }
    setImporting(false);
    setImportProgress({ current: 0, total: 0 });
    setImportPreview(null);
    importDebugRef.current = [];
    setImportDebugMessages([]);
    // 匯入完成後才重新載入一次
    await loadFoods(true);
    alert(`匯入完成！\n成功: ${successCount} 筆\n失敗: ${failCount} 筆`);
  };

  const createVoiceCommand = (text: string, action: FoodVoiceAction, summary: string, risk: VoiceRisk = "safe"): FoodVoiceCommand => ({
    action,
    summary,
    risk,
    rawText: text,
  });

  const parseVoiceCommand = (text: string): FoodVoiceCommand | null => {
    const normalized = text.trim();
    if (!normalized) return null;

    if (/匯入|import/.test(normalized) && /csv/i.test(normalized)) {
      return createVoiceCommand(normalized, "importCsv", "開啟食品 CSV 檔案選擇器，選檔後仍會顯示匯入預覽。", "review");
    }
    if (/匯出|export/.test(normalized) && /csv/i.test(normalized)) {
      return createVoiceCommand(normalized, "exportCsv", `匯出目前 ${foods.length} 筆食品為 CSV。`);
    }
    if (/重新整理|刷新|refresh|reload/.test(normalized)) {
      return createVoiceCommand(normalized, "refresh", "重新向 Appwrite 載入食品資料。");
    }
    if (/取消全選|清除選取|取消選取|unselect/.test(normalized)) {
      return createVoiceCommand(normalized, "clearSelection", `取消目前 ${selectedIds.size} 筆選取。`);
    }
    if (/全選|select all/i.test(normalized)) {
      return createVoiceCommand(normalized, "selectAll", `選取目前篩選結果 ${filteredFoods.length} 筆食品。`, "review");
    }
    if (/清除篩選|顯示全部|全部|filter all/i.test(normalized)) {
      return createVoiceCommand(normalized, "filterAll", "清除搜尋、年份、月份與狀態篩選。");
    }
    if (/無日期|沒日期|未設定日期/.test(normalized)) {
      return createVoiceCommand(normalized, "filterNoDate", "篩選沒有到期日的食品。");
    }
    if (/已過期|過期|expired|overdue/i.test(normalized)) {
      return createVoiceCommand(normalized, "filterExpired", `切換到已過期清單，目前 ${filterCounts.expired} 筆。`);
    }
    if (/今天|今日|今天到期/.test(normalized)) {
      return createVoiceCommand(normalized, "filterToday", `切換到今天到期清單，目前 ${filterCounts.today} 筆。`);
    }
    if (/3\s*天內|三天內/.test(normalized)) {
      return createVoiceCommand(normalized, "filter3Days", `切換到 3 天內到期清單，目前 ${filterCounts["3days"]} 筆。`);
    }
    if (/7\s*天內|七天內|快過期|即將過期/.test(normalized)) {
      return createVoiceCommand(normalized, "filter7Days", `切換到 7 天內到期清單，目前 ${filterCounts["7days"]} 筆。`);
    }
    if (/正常|安全|未過期|normal/i.test(normalized)) {
      return createVoiceCommand(normalized, "filterNormal", `切換到正常庫存清單，目前 ${filterCounts.normal} 筆。`);
    }
    if (/搜尋|查詢|找|search|find/i.test(normalized)) {
      const query = extractVoiceSearchQuery(normalized);
      return query
        ? createVoiceCommand(normalized, "search", `搜尋食品關鍵字「${query}」。`)
        : createVoiceCommand(normalized, "noop", "請在搜尋指令後面加上關鍵字，例如：搜尋 牛奶。");
    }

    if (/快速新增|直接新增|立即新增/.test(normalized)) {
      const draft = buildVoiceDraft(normalized);
      return draft.name
        ? createVoiceCommand(normalized, "quickAdd", `直接新增「${draft.name}」，數量 ${draft.amount || 1}，到期日 ${draft.todate || "未設定"}。`, "review")
        : createVoiceCommand(normalized, "noop", "請說出要新增的食品名稱。");
    }
    if (/新增|建立|add|create/i.test(normalized)) {
      const draft = buildVoiceDraft(normalized);
      return createVoiceCommand(
        normalized,
        "add",
        draft.name
          ? `開啟新增列，預填「${draft.name}」、數量 ${draft.amount || 1}、到期日 ${draft.todate || "未設定"}${draft.price ? `、價格 ${draft.price}` : ""}${draft.shop ? `、商店 ${draft.shop}` : ""}。`
          : "開啟新增列，請再手動確認欄位。",
        "review"
      );
    }
    if (/複製|copy|duplicate/i.test(normalized)) {
      const target = findVoiceTarget(normalized);
      return target
        ? createVoiceCommand(normalized, "duplicate", `複製「${target.name}」成一筆新食品，儲存前可再修改。`, "review")
        : createVoiceCommand(normalized, "noop", "目前找不到可複製的食品。");
    }
    if (/編輯|修改|edit|update/i.test(normalized) && !/數量|庫存|價格|價錢|日期|到期|商店|店家/.test(normalized)) {
      const target = findVoiceTarget(normalized);
      return target
        ? createVoiceCommand(normalized, "edit", `開啟「${target.name}」編輯列，儲存前還要再按一次。`, "review")
        : createVoiceCommand(normalized, "noop", "目前找不到可編輯的食品。");
    }
    if (/(加|增加|補貨|\+)/.test(normalized) && /數量|庫存|個|瓶|盒|包|袋|罐|份|顆/.test(normalized)) {
      const target = findVoiceTarget(normalized);
      const amount = extractVoiceAmount(normalized) || 1;
      return target
        ? createVoiceCommand(normalized, "increaseAmount", `把「${target.name}」庫存增加 ${amount}。`, "review")
        : createVoiceCommand(normalized, "noop", "目前找不到要增加庫存的食品。");
    }
    if (/(減|減少|吃掉|用掉|扣|少|-)/.test(normalized) && /數量|庫存|個|瓶|盒|包|袋|罐|份|顆/.test(normalized)) {
      const target = findVoiceTarget(normalized);
      const amount = extractVoiceAmount(normalized) || 1;
      return target
        ? createVoiceCommand(normalized, "decreaseAmount", `把「${target.name}」庫存減少 ${amount}。`, "review")
        : createVoiceCommand(normalized, "noop", "目前找不到要減少庫存的食品。");
    }
    if (/設為|改成|設定|更新/.test(normalized) && /數量|庫存/.test(normalized)) {
      const target = findVoiceTarget(normalized);
      const amount = extractVoiceAmount(normalized);
      return target && amount !== null
        ? createVoiceCommand(normalized, "setAmount", `把「${target.name}」庫存改成 ${amount}。`, "review")
        : createVoiceCommand(normalized, "noop", "請說出要設定的食品和數量。");
    }
    if (/設為|改成|設定|更新/.test(normalized) && /價格|價錢|金額|售價/.test(normalized)) {
      const target = findVoiceTarget(normalized);
      const price = extractVoicePrice(normalized);
      return target && price !== null
        ? createVoiceCommand(normalized, "setPrice", `把「${target.name}」價格改成 ${price}。`, "review")
        : createVoiceCommand(normalized, "noop", "請說出要設定的食品和價格。");
    }
    if (/設為|改成|設定|更新|延長/.test(normalized) && /日期|到期|有效/.test(normalized)) {
      const target = findVoiceTarget(normalized);
      const date = extractVoiceDate(normalized).date;
      return target && date
        ? createVoiceCommand(normalized, "setDate", `把「${target.name}」到期日改成 ${date}。`, "review")
        : createVoiceCommand(normalized, "noop", "請說出要設定的食品和到期日期。");
    }
    if (/清除|移除/.test(normalized) && /日期|到期/.test(normalized)) {
      const target = findVoiceTarget(normalized);
      return target
        ? createVoiceCommand(normalized, "clearDate", `清除「${target.name}」的到期日。`, "review")
        : createVoiceCommand(normalized, "noop", "目前找不到要清除日期的食品。");
    }
    if (/設為|改成|設定|更新/.test(normalized) && /商店|店家|購買地|賣場|通路/.test(normalized)) {
      const target = findVoiceTarget(normalized);
      const shop = extractVoiceShop(normalized);
      return target && shop
        ? createVoiceCommand(normalized, "setShop", `把「${target.name}」商店改成 ${shop}。`, "review")
        : createVoiceCommand(normalized, "noop", "請說出要設定的食品和商店。");
    }
    if (/吃完|已吃|已用完/.test(normalized)) {
      return createVoiceCommand(normalized, "eatSelected", `開啟標記吃完確認，對象為目前選取 ${selectedIds.size} 筆；仍需輸入 ${FOOD_DELETE_CONFIRMATION}。`, "danger");
    }
    if (/丟棄|報廢|不要了/.test(normalized)) {
      return createVoiceCommand(normalized, "discardSelected", `開啟標記丟棄確認，對象為目前選取 ${selectedIds.size} 筆；仍需輸入 ${FOOD_DELETE_CONFIRMATION}。`, "danger");
    }
    if (/刪除選取|刪除已選|delete selected/i.test(normalized)) {
      return createVoiceCommand(normalized, "deleteSelected", `開啟批次刪除確認，對象為目前選取 ${selectedIds.size} 筆；仍需輸入 ${FOOD_DELETE_CONFIRMATION}。`, "danger");
    }
    if (/刪除|delete|remove/i.test(normalized)) {
      const target = findVoiceTarget(normalized);
      return target
        ? createVoiceCommand(normalized, "deleteOne", `選取「${target.name}」並開啟刪除確認；仍需輸入 ${FOOD_DELETE_CONFIRMATION}。`, "danger")
        : createVoiceCommand(normalized, "noop", "目前找不到可刪除的食品。");
    }

    return createVoiceCommand(normalized, "noop", "聽到了，但還不確定要做什麼。可以試：搜尋牛奶、7 天內、新增雞蛋 10 顆、把第一筆庫存加 2。");
  };

  const openBulkDeleteModalForIds = (ids: string[], action: CleanupAction) => {
    if (ids.length === 0) {
      setVoiceFeedback("請先選取食品，或說出食品名稱，例如：刪除牛奶。");
      return;
    }
    setSelectedIds(new Set(ids));
    setSelectionMode(true);
    setCleanupAction(action);
    setBulkDeleteInput("");
    setBulkDeleteOpen(true);
  };

  const updateFoodFromVoice = async (food: Food, patch: Partial<FoodFormData>) => {
    await updateFood(food.$id, {
      name: food.name,
      amount: food.amount || 0,
      todate: formatDate(food.todate),
      photo: food.photo || "",
      price: food.price || 0,
      shop: food.shop || "",
      photohash: food.photohash || "",
      ...patch,
    });
  };

  const executeVoiceCommand = async (command: FoodVoiceCommand) => {
    const text = command.rawText;
    setPendingVoiceCommand(null);
    setVoiceFeedback(`執行中：${command.summary}`);

    try {
      switch (command.action) {
        case "importCsv":
          document.getElementById("csv-import-food")?.click();
          break;
        case "exportCsv":
          await exportToCSV();
          break;
        case "refresh":
          loadFoods(true);
          break;
        case "selectAll":
          setSelectionMode(true);
          setSelectedIds(new Set(filteredFoods.map((food) => food.$id).filter(Boolean)));
          break;
        case "clearSelection":
          setSelectedIds(new Set());
          setSelectionMode(false);
          break;
        case "filterAll":
          resetFoodFilters();
          break;
        case "filterExpired":
          setFilterMode("expired");
          break;
        case "filterToday":
          setFilterMode("today");
          break;
        case "filter3Days":
          setFilterMode("3days");
          break;
        case "filter7Days":
          setFilterMode("7days");
          break;
        case "filterNormal":
          setFilterMode("normal");
          break;
        case "filterNoDate":
          setFilterMode("all");
          setYearFilter("no-date");
          setMonthFilter("");
          break;
        case "search":
          setSearchQuery(extractVoiceSearchQuery(text));
          break;
        case "add": {
          setInlineAddForm(buildVoiceDraft(text));
          setIsInlineAdding(true);
          setInlineEditingId(null);
          setInlineEditForm(INITIAL_FORM);
          resetInlinePhotoState();
          resetInlineAddPhotoState();
          break;
        }
        case "quickAdd":
          await createFood(buildVoiceDraft(text));
          break;
        case "edit": {
          const target = findVoiceTarget(text);
          if (target) handleInlineEdit(target);
          break;
        }
        case "duplicate": {
          const target = findVoiceTarget(text);
          if (target) handleDuplicateFood(target);
          break;
        }
        case "increaseAmount": {
          const target = findVoiceTarget(text);
          if (target) await updateAmount(target, extractVoiceAmount(text) || 1);
          break;
        }
        case "decreaseAmount": {
          const target = findVoiceTarget(text);
          if (target) await updateAmount(target, -(extractVoiceAmount(text) || 1));
          break;
        }
        case "setAmount": {
          const target = findVoiceTarget(text);
          const amount = extractVoiceAmount(text);
          if (target && amount !== null) await updateFoodFromVoice(target, { amount });
          break;
        }
        case "setPrice": {
          const target = findVoiceTarget(text);
          const price = extractVoicePrice(text);
          if (target && price !== null) await updateFoodFromVoice(target, { price });
          break;
        }
        case "setDate": {
          const target = findVoiceTarget(text);
          const date = extractVoiceDate(text).date;
          if (target && date) await updateFoodFromVoice(target, { todate: date });
          break;
        }
        case "clearDate": {
          const target = findVoiceTarget(text);
          if (target) await updateFoodFromVoice(target, { todate: "" });
          break;
        }
        case "setShop": {
          const target = findVoiceTarget(text);
          const shop = extractVoiceShop(text);
          if (target && shop) await updateFoodFromVoice(target, { shop });
          break;
        }
        case "deleteOne": {
          const target = findVoiceTarget(text);
          if (target) openBulkDeleteModalForIds([target.$id], "delete");
          break;
        }
        case "deleteSelected":
          openBulkDeleteModalForIds(Array.from(selectedIds), "delete");
          break;
        case "eatSelected":
          openBulkDeleteModalForIds(Array.from(selectedIds), "eat");
          break;
        case "discardSelected":
          openBulkDeleteModalForIds(Array.from(selectedIds), "discard");
          break;
        case "noop":
        default:
          setVoiceFeedback(command.summary);
          return;
      }
      setVoiceFeedback(`完成：${command.summary}`);
    } catch (error) {
      console.error("Food voice command failed:", error);
      setVoiceFeedback(error instanceof Error ? `執行失敗：${error.message}` : "執行失敗，請再試一次。");
    }
  };

  const handleVoiceText = (text: string) => {
    const cleaned = text.trim();
    if (!cleaned) {
      setVoiceFeedback("請先輸入或說出語音指令。");
      return;
    }
    const command = parseVoiceCommand(cleaned);
    if (!command) {
      setVoiceFeedback("請先輸入或錄到語音指令。");
      return;
    }
    setVoiceTranscript(command.rawText);
    setVoiceFeedback(command.summary);
    if (shouldAutoExecuteVoiceRisk(command.risk)) {
      playVoiceSuccessTone();
      void executeVoiceCommand(command);
    } else {
      setPendingVoiceCommand(command);
    }
  };
  handleVoiceTextRef.current = handleVoiceText;

  // 僅初次尚無資料時全頁 loading；背景重新整理 / CSV 匯入中不要卸載整頁（避免匯入 modal 被拆掉閃爍）
  if (loading && foods.length === 0 && !importing && !importPreview) {
    return <FullPageLoading text="載入食品資料中..." />;
  }

  return (
    <div className="space-y-4 lg:space-y-6" id="food-management-container">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <FriendlyAiCrudShell
        title="鋒兄食品（＋商品庫存）"
        description="以目前 Appwrite `food` 表為準，集中管理食品、商品、有效期限、數量、圖片、商店與價格。上方先看臨期與庫存風險，下方再用同一張 CRUD 表格新增、編輯、複製、刪除。"
        searchPlaceholder="搜尋食品名稱、商店..."
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        recentSearchKey="food-management"
        searchExtras={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-w-[260px] flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
              <CalendarClock size={18} className="shrink-0 text-slate-400" />
              <span className="shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">日期</span>
              <Select
                value={yearFilter || "all"}
                onValueChange={(value) => {
                  setYearFilter(value === "all" ? "" : value);
                  setMonthFilter("");
                }}
              >
                <SelectTrigger className="h-8 min-w-[112px] border-0 bg-transparent px-0 shadow-none focus:ring-0">
                  <span className={yearFilter ? "text-slate-900 dark:text-slate-100" : "text-slate-500 dark:text-slate-400"}>
                    {yearFilter === "no-date" ? "無日期" : yearFilter || "全部年份"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部年份</SelectItem>
                  <SelectItem value="no-date">無日期</SelectItem>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year} 年
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={monthFilter || "all"}
                onValueChange={(value) => setMonthFilter(value === "all" ? "" : value)}
                disabled={yearFilter === "no-date"}
              >
                <SelectTrigger className="h-8 min-w-[104px] border-0 bg-transparent px-0 shadow-none focus:ring-0 disabled:opacity-50">
                  <span className={monthFilter ? "text-slate-900 dark:text-slate-100" : "text-slate-500 dark:text-slate-400"}>
                    {monthFilter ? formatMonthOption(monthFilter) : "全部月份"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部月份</SelectItem>
                  {monthOptions.map((month) => (
                    <SelectItem key={month} value={month}>
                      {formatMonthOption(month)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(yearFilter || monthFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setYearFilter("");
                    setMonthFilter("");
                  }}
                  className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  aria-label="清除年月篩選"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        }
        intro={
          <div className="space-y-4">
            <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-end 2xl:justify-between">
              <div className="min-w-0 space-y-2">
                <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500 dark:text-slate-400">
                  Workspace Section
                </p>
                <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl lg:text-4xl">
                  鋒兄食品 <span className="text-base font-medium text-slate-500 dark:text-slate-400">（＋商品庫存）</span>
                </h1>
                <p className="text-base leading-7 text-slate-600 dark:text-slate-300">
                  共 {foods.length} 項食品
                </p>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--accent-strong)]">
                  APPWRITE-.ENV
                </p>
              </div>
              <div className="inline-flex items-center gap-2 self-start rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 2xl:self-auto">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span>即時同步</span>
              </div>
            </div>
            <p className="max-w-4xl text-sm leading-7 text-slate-600 dark:text-slate-300 sm:text-base">
              食品與商品庫存走同一套 CRUD：新增、編輯、複製會先進入表格內編輯列，確認後才寫入；刪除與批次刪除保留確認流程，避免誤刪。
            </p>
          </div>
        }
        activeMode={filterMode}
        onModeChange={(mode) => setFilterMode(mode as FilterMode)}
        modeItems={[
          { key: "all", label: "全部", count: filterCounts.all },
          { key: "expired", label: "已過期", count: filterCounts.expired },
          { key: "today", label: "今天到期", count: filterCounts.today },
          { key: "3days", label: "3 天內", count: filterCounts["3days"] },
          { key: "7days", label: "7 天內", count: filterCounts["7days"] },
          { key: "normal", label: "正常庫存", count: filterCounts.normal },
        ]}
        summaries={[
          {
            label: "食品總數",
            value: foods.length,
            detail: "食品與商品庫存合計",
            tone: "blue",
          },
          {
            label: "已過期",
            value: dashboardStats.expired.length,
            detail: dashboardStats.expired.length > 0 ? "優先批次處理" : "目前沒有過期食品",
            tone: dashboardStats.expired.length > 0 ? "red" : "green",
          },
          {
            label: "7 天內到期",
            value: dashboardStats.expiring7Days.length,
            detail: "適合提前排菜單與分批消耗",
            tone: dashboardStats.expiring7Days.length > 0 ? "amber" : "neutral",
          },
          {
            label: "低庫存 / 庫存價值",
            value: dashboardStats.lowStock.length,
            detail: `約 NT$ ${dashboardStats.totalValue.toLocaleString()} 在庫`,
            tone: dashboardStats.lowStock.length > 0 ? "green" : "neutral",
          },
        ]}
        suggestions={[
          dashboardStats.expired.length > 0
            ? { title: "先處理過期", body: `目前有 ${dashboardStats.expired.length} 項過期食品，建議先刪除或更新日期。`, tone: "red" }
            : { title: "過期狀態正常", body: "目前沒有過期食品，可以優先看臨期與低庫存。", tone: "green" },
          dashboardStats.expiring3Days.length > 0
            ? { title: "3 天內到期", body: `有 ${dashboardStats.expiring3Days.length} 項 3 天內到期，今天適合先安排消耗。`, tone: "amber" }
            : { title: "短期壓力低", body: "3 天內沒有到期項目，庫存壓力低。", tone: "blue" },
          dashboardStats.lowStock.length > 0
            ? { title: "低庫存提醒", body: `目前有 ${dashboardStats.lowStock.length} 項低庫存，可以用複製或新增快速補資料。`, tone: "neutral" }
            : { title: "庫存維護", body: "目前沒有低庫存項目，表格可用來補圖片、商店與價格。", tone: "neutral" },
        ]}
        toolbar={
          <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 xl:w-auto xl:flex-nowrap">
            <input type="file" accept=".csv" onChange={handleCSVFileSelect} className="hidden" id="csv-import-food" />
            <Button onClick={() => loadFoods(true)} variant="outline" className="min-w-[8.5rem] rounded-xl" title="重新整理" disabled={loading}>
              <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> 重新整理
            </Button>
            <Button onClick={() => document.getElementById("csv-import-food")?.click()} variant="outline" className="min-w-[8rem] rounded-xl" title="匯入 CSV">
              <Upload className="mr-1 h-4 w-4" /> 匯入
            </Button>
            <Button onClick={() => void exportToCSV()} variant="outline" className="min-w-[8rem] rounded-xl" title="匯出 CSV">
              <Download className="mr-1 h-4 w-4" /> 匯出
            </Button>
            <Button onClick={handleSelectAll} variant="outline" className="min-w-[7.5rem] rounded-xl">
              {selectionMode && filteredFoods.length > 0 && filteredFoods.every(food => selectedIds.has(food.$id)) ? "取消全選" : "全選"}
            </Button>
            {selectedIds.size > 0 && (
              <Button onClick={() => { setCleanupAction("delete"); setBulkDeleteOpen(true); }} className="min-w-[8.75rem] rounded-xl bg-red-600 text-white hover:bg-red-700">
                真刪除 ({selectedIds.size})
              </Button>
            )}
            <Button
              onClick={() => setIsFormOpen(!isFormOpen)}
              className="min-w-[12rem] rounded-xl bg-blue-600 px-6 text-white hover:bg-blue-700"
            >
              <Plus className="mr-1 h-4 w-4" />
              {isFormOpen ? "收起表單" : "新增食品(或商品)"}
            </Button>
          </div>
        }
      />

      <VoiceCommandBar
        title="語音 CRUD 管理"
        description="說完會自動結束 · 安全操作直接執行 · 新增／刪除需確認"
        helpText={FOOD_VOICE_HELP}
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
        placeholder="例：新增牛奶 2 瓶 7 天後到期 / 搜尋 Costco / 把第一筆庫存加 3 / 刪除選取"
        samples={["7 天內", "已過期", "無日期", "清除篩選"]}
        pending={pendingVoiceCommand}
        onToggleListen={toggleVoiceInput}
        onSubmit={handleVoiceText}
        onConfirm={() => {
          if (pendingVoiceCommand) void executeVoiceCommand(pendingVoiceCommand);
        }}
        onCancelPending={() => setPendingVoiceCommand(null)}
      />

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

      {exporting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Export CSV</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">food.csv</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>Progress</span>
                  <span>{exportProgress.current}/{exportProgress.total}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${exportProgress.total > 0 ? (exportProgress.current / exportProgress.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm font-semibold text-gray-800 dark:text-gray-100">
                  <span>Export Debug Console Output</span>
                  <span className="text-xs font-normal text-gray-500 dark:text-gray-400">{exportDebugMessages.length} entries</span>
                </div>
                <div className="max-h-48 overflow-y-auto rounded-xl bg-gray-900 px-3 py-2 text-xs leading-5 text-green-200">
                  {exportDebugMessages.length > 0 ? (
                    exportDebugMessages.map((message, index) => (
                      <div key={`${index}-${message}`} className="border-b border-white/5 py-1 last:border-b-0">
                        {message}
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-400">Waiting for export logs...</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {importPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-[1px]">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
            <div className="border-b border-gray-200 p-6 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {importing ? "匯入中" : "匯入預覽"}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {importing
                  ? "正在寫入 Appwrite，請稍候。進度會節流更新以避免畫面閃爍。"
                  : "請確認以下資料是否正確"}
              </p>
            </div>
            <div className="max-h-[50vh] overflow-y-auto p-6">
              {importing ? (
                <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    正在處理第 {importProgress.current} / {importProgress.total || importPreview.data.length} 筆
                  </div>
                  <div className="h-2 w-full max-w-sm overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-[width] duration-200 ease-out"
                      style={{
                        width: `${
                          importProgress.total > 0
                            ? Math.min(100, (importProgress.current / importProgress.total) * 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  {importPreview.errors.length > 0 && (
                    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
                      <h4 className="mb-2 font-semibold text-red-600 dark:text-red-400">格式錯誤:</h4>
                      <ul className="space-y-1 text-sm text-red-600 dark:text-red-400">
                        {importPreview.errors.map((err, i) => (
                          <li key={i}>• {err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {importPreview.data.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-700 dark:text-gray-300">
                        將匯入 {importPreview.data.length} 筆資料:
                      </h4>
                      <div className="space-y-2">
                        {importPreview.data.slice(0, 50).map((item, i) => {
                          const existing = foods.find((f) => f.name === item.name);
                          return (
                            <div
                              key={`${item.name}-${i}`}
                              className="flex items-center gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-800"
                            >
                              <span className="font-medium text-gray-900 dark:text-gray-100">{item.name}</span>
                              <span className="text-xs text-gray-500">{item.amount} 個</span>
                              {existing ? (
                                <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                                  更新
                                </span>
                              ) : (
                                <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                  新增
                                </span>
                              )}
                            </div>
                          );
                        })}
                        {importPreview.data.length > 50 && (
                          <div className="p-3 text-center text-sm text-gray-500">
                            ...以及其他 {importPreview.data.length - 50} 筆資料
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex flex-col gap-3 border-t border-gray-200 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] dark:border-gray-700 sm:flex-row sm:justify-end">
              {importing ? (
                <div className="flex w-full flex-col gap-3 sm:max-w-xl">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm font-semibold text-gray-800 dark:text-gray-100">
                      <span>Import Debug Console Output</span>
                      <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                        {importDebugMessages.length} entries
                      </span>
                    </div>
                    <div className="max-h-48 overflow-y-auto rounded-xl bg-gray-900 px-3 py-2 text-xs leading-5 text-green-200">
                      {importDebugMessages.length > 0 ? (
                        importDebugMessages.map((message, index) => (
                          <div key={`import-log-${index}`} className="border-b border-white/5 py-1 last:border-b-0">
                            {message}
                          </div>
                        ))
                      ) : (
                        <div className="text-gray-400">Waiting for import logs...</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setImportPreview(null)} className="rounded-xl">
                    取消
                  </Button>
                  <Button
                    onClick={executeImport}
                    disabled={importPreview.data.length === 0 || importPreview.errors.length > 0}
                    className="rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
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

      <DataCard>
        {/* 匯入進行中先卸載大型表格，避免每筆進度更新重渲數百列造成畫面閃爍 */}
        {importing ? (
          <EmptyState
            emoji="📥"
            title="CSV 匯入進行中"
            description={`正在寫入第 ${importProgress.current}/${importProgress.total || "?"} 筆，完成後會自動重新整理列表。`}
          />
        ) : foods.length === 0 ? (
          <EmptyState emoji="🍔" title="暫無食品資料" description="點擊上方按鈕新增您的第一筆食品資料" />
        ) : filteredFoods.length === 0 ? (
          <EmptyState emoji="🔍" title="無搜尋結果" description={`找不到「${searchQuery}」相關的食品`} />
        ) : (
          <>
            <DesktopTable
              foods={filteredFoods}
              onDelete={handleDelete}
              onDuplicate={handleDuplicateFood}
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
              onDuplicate={handleDuplicateFood}
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
    <FormCard title={editingId ? "編輯食品" : "新增食品(或商品)"} accentColor="from-blue-500 to-blue-600">
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
            {photoUploading ? "上傳中..." : editingId ? "更新食品" : "新增食品(或商品)"}
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
  onDuplicate: (food: Food) => void;
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

function DesktopTable({ foods, onDelete, onDuplicate, onAmountChange, inlineEditingId, inlineEditForm, setInlineEditForm, onInlineEdit, onInlineSave, onInlineCancel, onInlinePhotoFileSelect, inlinePhotoPreviewUrl, inlinePhotoUploading, isEditMode, setIsEditMode, selectedIds, toggleSelect, isAllSelected, toggleSelectAll, deleteSelected, isInlineAdding, inlineAddForm, setInlineAddForm, onInlineAddPhotoFileSelect, inlineAddPhotoPreviewUrl, inlineAddPhotoUploading, onInlineAddSave, onInlineAddCancel, startInlineAdd }: TableProps) {
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
            <TableHead className="font-semibold">剩餘日期</TableHead>
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
                <StatusBadge status={getFoodFormExpiryInfo(inlineAddForm).status}>
                  {formatDaysRemaining(getFoodFormExpiryInfo(inlineAddForm).daysRemaining)}
                </StatusBadge>
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
                <div className="space-y-2 w-[260px] max-w-[260px]">
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
              {!isEditMode && (
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" onClick={onInlineAddSave} className="rounded-lg h-8 w-8 p-0 bg-green-500 hover:bg-green-600 text-white" title="新增"><Check size={16} /></Button>
                    <Button type="button" size="sm" variant="outline" onClick={onInlineAddCancel} className="rounded-lg h-8 w-8 p-0" title="取消"><X size={16} /></Button>
                  </div>
                </TableCell>
              )}
            </TableRow>
          )}
          {foods.map((food) => (
            <FoodTableRow
              key={food.$id}
              food={food}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
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
  onDuplicate: (food: Food) => void;
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

function FoodTableRow({ food, onDelete, onDuplicate, onAmountChange, isEditing, inlineEditForm, setInlineEditForm, onInlineEdit, onInlineSave, onInlineCancel, onInlinePhotoFileSelect, inlinePhotoPreviewUrl, inlinePhotoUploading, isEditMode, isSelected, toggleSelect }: FoodTableRowProps) {
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
          <StatusBadge status={getFoodFormExpiryInfo(inlineEditForm, food.$id).status}>
            {formatDaysRemaining(getFoodFormExpiryInfo(inlineEditForm, food.$id).daysRemaining)}
          </StatusBadge>
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
        {!isEditMode && <TableCell />}
      </TableRow>
    );
  }

  return (
    <TableRow className={`hover:bg-gray-50/50 dark:hover:bg-gray-700/50 ${rowClass}`}>
      <TableCell className="font-medium">
        <div className="flex flex-col gap-1">
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
            {food.shop ? <span>{food.shop}</span> : null}
            {food.shop && food.price ? <span className="text-gray-300 dark:text-gray-600">|</span> : null}
            {food.price ? <span className="font-medium text-gray-700 dark:text-gray-300">{formatFoodPrice(food.price)}</span> : null}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <span>{formattedDate}</span>
        </div>
      </TableCell>
      <TableCell>
        <StatusBadge status={status}>{formatDaysRemaining(daysRemaining)}</StatusBadge>
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
            <Button type="button" size="sm" variant="outline" onClick={() => onDuplicate(food)} className="rounded-lg border-emerald-200 text-emerald-700 hover:bg-emerald-50">
              <Copy size={14} className="mr-1" />
              複製
            </Button>
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
function MobileList({ foods, onDelete, onDuplicate, onAmountChange, inlineEditingId, inlineEditForm, setInlineEditForm, onInlineEdit, onInlineSave, onInlineCancel, onInlinePhotoFileSelect, inlinePhotoPreviewUrl, inlinePhotoUploading, isEditMode, setIsEditMode, selectedIds, toggleSelect, isAllSelected, toggleSelectAll, deleteSelected, isInlineAdding, inlineAddForm, setInlineAddForm, onInlineAddPhotoFileSelect, inlineAddPhotoPreviewUrl, inlineAddPhotoUploading, onInlineAddSave, onInlineAddCancel, startInlineAdd }: TableProps) {
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
            onDuplicate={onDuplicate}
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
  onDuplicate: (food: Food) => void;
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

function FoodMobileCard({ food, onDelete, onDuplicate, onAmountChange, isEditing, inlineEditForm, setInlineEditForm, onInlineEdit, onInlineSave, onInlineCancel, onInlinePhotoFileSelect, inlinePhotoPreviewUrl, inlinePhotoUploading, isEditMode, isSelected, toggleSelect }: FoodMobileCardProps) {
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
            <div className="flex items-center gap-1.5 text-xs min-[390px]:text-sm text-gray-500 dark:text-gray-400">
              <span className="font-medium">剩餘日期:</span>
              <StatusBadge status={status}>{formatDaysRemaining(daysRemaining)}</StatusBadge>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs min-[390px]:text-sm text-gray-500 dark:text-gray-400">
              {food.shop ? <span>{food.shop}</span> : null}
              {food.shop && food.price ? <span className="text-gray-300 dark:text-gray-600">|</span> : null}
              {food.price ? <span className="font-semibold text-gray-900 dark:text-gray-100">{formatFoodPrice(food.price)}</span> : null}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 min-[390px]:mt-4 flex flex-col gap-3">
        <div className="w-full">
          <AmountControl food={food} onAmountChange={onAmountChange} />
        </div>
        {!isEditMode && (
          <div className="grid grid-cols-1 min-[360px]:grid-cols-3 gap-2">
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
              onClick={() => onDuplicate(food)}
              className="h-10 min-[390px]:h-11 rounded-xl text-emerald-700 border-emerald-200 hover:bg-emerald-50 font-bold w-full"
            >
              <Copy size={14} className="mr-1" />
              複製
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
