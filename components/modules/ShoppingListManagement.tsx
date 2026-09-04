"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Copy,
  Download,
  ImagePlus,
  Link2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Store,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { BulkDeleteDialog } from "@/components/ui/bulk-delete-dialog";
import { BulkSelectionControls, SelectionCheckbox } from "@/components/ui/bulk-selection-controls";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ManagementDeleteDialog } from "@/components/ui/management-delete-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { fetchApi } from "@/hooks/useApi";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import {
  getShoppingItemExpiryInfo,
  SHOPPING_LIST_REFRESH_KEY,
} from "@/hooks/useShoppingList";
import { bumpRefreshKey } from "@/hooks/useRefreshKey";
import { API_ENDPOINTS } from "@/lib/constants";
import {
  emptyShoppingItemForm,
  SHOPPING_CURRENCY_OPTIONS,
  SHOPPING_PICKUP_METHOD_PRESETS,
  toShoppingItemForm,
} from "@/lib/managementRecords";
import {
  buildShoppingCsv,
  parseShoppingCsv,
  shoppingImportKey,
} from "@/lib/shoppingCsv";
import { formatCurrencyWithExchange } from "@/lib/formatters";
import { deleteByIds } from "@/lib/bulkSelection";
import { getExportFilename, getAppwriteHeaders } from "@/lib/utils";
import type { ShoppingItem, ShoppingItemFormData } from "@/types";

type StatusFilter = "all" | "due" | "today" | "upcoming" | "nodate";

/** 取貨方式下拉中代表「自行輸入」的選項值 */
const PICKUP_METHOD_CUSTOM = "__custom__";

function NativeSelect({
  id,
  value,
  onChange,
  children,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full rounded-xl border border-input bg-transparent px-3 text-base text-foreground shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {children}
    </select>
  );
}

export default function ShoppingListManagement() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ShoppingItemFormData>(() => emptyShoppingItemForm());
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ShoppingItem | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const imageUploadRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const importCloseTimer = useRef<number | null>(null);
  const [importPreview, setImportPreview] = useState<{ data: ShoppingItemFormData[]; errors: string[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importResult, setImportResult] = useState<{ successCount: number; failCount: number } | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteInput, setBulkDeleteInput] = useState("");
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkTotal, setBulkTotal] = useState(0);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const revision = useRef(0);
  const mounted = useRef(false);

  const loadItems = async (silent = false) => {
    const requestRevision = ++revision.current;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const result = await fetchApi<ShoppingItem[]>(`${API_ENDPOINTS.SHOPPING_LIST}?t=${Date.now()}`, { cache: "no-store" });
      if (mounted.current && requestRevision === revision.current) {
        const sorted = (Array.isArray(result) ? result : []).sort(compareByPlannedDate);
        setItems(sorted);
      }
    } catch (err) {
      if (mounted.current && requestRevision === revision.current) {
        setError(err instanceof Error ? err.message : "載入失敗，請重新整理。");
      }
    } finally {
      if (mounted.current && requestRevision === revision.current) setLoading(false);
    }
  };

  useEffect(() => {
    mounted.current = true;
    void loadItems();
    return () => {
      mounted.current = false;
      revision.current += 1;
    };
  }, []);

  const busy = saving || deletingId !== null || importing || imageUploading || bulkDeleting;

  const itemNames = useMemo(
    () => [...new Set(items.map((item) => item.name.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-Hant")),
    [items],
  );
  const shopNames = useMemo(
    () => [...new Set(items.map((item) => item.shop?.trim()).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, "zh-Hant")),
    [items],
  );
  const pickupMethods = useMemo(
    () => [...new Set(items.map((item) => item.pickupMethod?.trim()).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, "zh-Hant")),
    [items],
  );

  const currentPickupInPresets = Boolean(form.pickupMethod && SHOPPING_PICKUP_METHOD_PRESETS.includes(form.pickupMethod));
  const pickupSelectValue = currentPickupInPresets || !form.pickupMethod ? form.pickupMethod || "" : PICKUP_METHOD_CUSTOM;

  const handlePickupSelectChange = (value: string) => {
    if (value === PICKUP_METHOD_CUSTOM) {
      // 進入自行輸入模式，保留空值讓使用者輸入
      setForm((current) => ({ ...current, pickupMethod: "" }));
      return;
    }
    setForm((current) => ({ ...current, pickupMethod: value }));
  };

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-Hant");
    return items.filter((item) => {
      const matchesQuery = !normalizedQuery || [item.name, item.shop, item.account, item.note, item.pickupMethod]
        .some((value) => String(value || "").toLocaleLowerCase("zh-Hant").includes(normalizedQuery));
      if (!matchesQuery) return false;
      const info = getShoppingItemExpiryInfo(item);
      switch (statusFilter) {
        case "all": return true;
        case "due": return info.hasDate && info.daysRemaining < 0;
        case "today": return info.isToday;
        case "upcoming": return info.isUpcomingSoon && !info.isToday;
        case "nodate": return !info.hasDate;
        default: return true;
      }
    });
  }, [items, query, statusFilter]);

  const visibleIds = useMemo(
    () => filtered.map((item) => item.$id).filter(Boolean),
    [filtered],
  );
  const bulk = useBulkSelection(visibleIds);

  const openCreateForm = (name = "") => {
    setEditingId(null);
    setForm(emptyShoppingItemForm(name));
    setActionError(null);
    resetImageState();
    setFormOpen(true);
  };

  const openEditForm = (item: ShoppingItem) => {
    setEditingId(item.$id);
    setForm(toShoppingItemForm(item));
    setActionError(null);
    resetImageState();
    setFormOpen(true);
  };

  const openCopyForm = (item: ShoppingItem) => {
    setEditingId(null);
    setForm({ ...toShoppingItemForm(item), name: `${item.name || "未命名"} (複製)` });
    setActionError(null);
    resetImageState();
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyShoppingItemForm());
    setActionError(null);
    resetImageState();
  };

  useEffect(() => {
    if (!formOpen) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById("shopping-form")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [editingId, formOpen]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || imageUploading) return;
    setSaving(true);
    setActionError(null);
    try {
      let formToSubmit = form;
      // 有選擇本機圖片時，先上傳取得圖片網址
      if (imageFile) {
        setImageUploading(true);
        try {
          const uploadedUrl = await uploadSelectedImage();
          if (!uploadedUrl) throw new Error("圖片上傳失敗，請稍後再試");
          formToSubmit = { ...form, imageUrl: uploadedUrl };
        } finally {
          setImageUploading(false);
        }
      }
      const result = editingId
        ? await fetchApi<ShoppingItem>(`${API_ENDPOINTS.SHOPPING_LIST}/${encodeURIComponent(editingId)}`, {
            method: "PUT",
            body: JSON.stringify(formToSubmit),
          })
        : await fetchApi<ShoppingItem>(API_ENDPOINTS.SHOPPING_LIST, {
            method: "POST",
            body: JSON.stringify(formToSubmit),
          });
      setItems((prev) => {
        const next = editingId
          ? prev.map((item) => (item.$id === editingId ? result : item))
          : [...prev, result];
        return next.sort(compareByPlannedDate);
      });
      bumpRefreshKey(SHOPPING_LIST_REFRESH_KEY);
      closeForm();
    } catch (submitError) {
      setActionError(submitError instanceof Error ? submitError.message : "儲存失敗，請稍後再試。");
    } finally {
      setSaving(false);
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(bulk.selectedIds).filter(Boolean);
    if (ids.length === 0) return;
    setBulkDeleting(true);
    setBulkError(null);
    setBulkTotal(ids.length);
    setBulkProgress(0);
    const { failCount } = await deleteByIds(
      ids,
      (id) => fetchApi(`${API_ENDPOINTS.SHOPPING_LIST}/${encodeURIComponent(id)}`, { method: "DELETE" }),
      (done) => setBulkProgress(done),
    );
    await loadItems(true);
    bumpRefreshKey(SHOPPING_LIST_REFRESH_KEY);
    setBulkDeleting(false);
    if (failCount > 0) {
      setBulkError(`有 ${failCount} 筆刪除失敗，請確認連線後再試。`);
      return;
    }
    bulk.clear();
    setBulkDeleteOpen(false);
    setBulkDeleteInput("");
  };

  const handleDelete = async (item: ShoppingItem) => {
    if (busy) return;
    setDeletingId(item.$id);
    setActionError(null);
    try {
      await fetchApi(`${API_ENDPOINTS.SHOPPING_LIST}/${encodeURIComponent(item.$id)}`, { method: "DELETE" });
      setItems((prev) => prev.filter((current) => current.$id !== item.$id));
      bumpRefreshKey(SHOPPING_LIST_REFRESH_KEY);
      setPendingDelete(null);
      if (editingId === item.$id) closeForm();
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : "刪除失敗，請確認連線後再試一次。");
    } finally {
      setDeletingId(null);
    }
  };

  const resetImageState = () => {
    setImageFile(null);
    setImageUploading(false);
    setImagePreviewUrl((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return "";
    });
  };

  const handleImageFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      setActionError(`圖片大小超過限制：${Math.round(file.size / 1024 / 1024)}MB > 50MB`);
      return;
    }
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setActionError("只支援 JPG、PNG、GIF、WEBP 圖片格式");
      return;
    }
    setImageFile(file);
    setImagePreviewUrl((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    // 選取檔案後，清空網址輸入，避免兩者並存造成混淆
    setForm((current) => ({ ...current, imageUrl: "" }));
    setActionError(null);
  };

  const uploadSelectedImage = async (): Promise<string> => {
    if (!imageFile) return "";
    setImageUploading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", imageFile);
      const response = await fetch("/api/upload-image", {
        method: "POST",
        headers: getAppwriteHeaders(),
        body: formDataUpload,
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "圖片上傳失敗");
      }
      const data = await response.json();
      return data.url as string;
    } finally {
      setImageUploading(false);
    }
  };

  const closeImportPreview = () => {
    if (importing) return;
    if (importCloseTimer.current) {
      window.clearTimeout(importCloseTimer.current);
      importCloseTimer.current = null;
    }
    setImportPreview(null);
    setImportResult(null);
    setImportProgress({ current: 0, total: 0 });
  };

  const exportToCsv = () => {
    if (busy) return;
    try {
      const csv = buildShoppingCsv(items);
      const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = getExportFilename("shoppinglist");
      link.click();
      URL.revokeObjectURL(link.href);
      setActionError(null);
    } catch (exportError) {
      setActionError(exportError instanceof Error ? exportError.message : "匯出 CSV 失敗");
    }
  };

  const handleCsvFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setActionError("請選擇 CSV 檔案");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      if (importCloseTimer.current) {
        window.clearTimeout(importCloseTimer.current);
        importCloseTimer.current = null;
      }
      setImportResult(null);
      setActionError(null);
      setImportPreview(parseShoppingCsv(text));
    };
    reader.onerror = () => setActionError("讀取 CSV 檔案失敗");
    reader.readAsText(file, "UTF-8");
  };

  const executeImport = async () => {
    if (!importPreview || importPreview.data.length === 0 || importPreview.errors.length > 0 || importing) return;
    setImporting(true);
    setImportResult(null);
    setImportProgress({ current: 0, total: importPreview.data.length });
    let successCount = 0;
    let failCount = 0;
    const index = new Map(items.map((item) => [shoppingImportKey(item), item.$id]));

    for (let i = 0; i < importPreview.data.length; i++) {
      const formData = importPreview.data[i];
      setImportProgress({ current: i + 1, total: importPreview.data.length });
      try {
        const key = shoppingImportKey(formData);
        const existingId = index.get(key);
        if (existingId) {
          await fetchApi(`${API_ENDPOINTS.SHOPPING_LIST}/${encodeURIComponent(existingId)}`, {
            method: "PUT",
            body: JSON.stringify(formData),
          });
        } else {
          const created = await fetchApi<ShoppingItem>(API_ENDPOINTS.SHOPPING_LIST, {
            method: "POST",
            body: JSON.stringify(formData),
          });
          index.set(key, created.$id);
        }
        successCount += 1;
      } catch {
        failCount += 1;
      }
    }

    try {
      await loadItems(true);
      bumpRefreshKey(SHOPPING_LIST_REFRESH_KEY);
      setImportResult({ successCount, failCount });
      if (failCount === 0) {
        importCloseTimer.current = window.setTimeout(() => {
          setImportPreview(null);
          setImportResult(null);
          setImportProgress({ current: 0, total: 0 });
          importCloseTimer.current = null;
        }, 1200);
      }
    } finally {
      setImporting(false);
    }
  };

  return (
    <section className="space-y-6" aria-labelledby="shopping-title">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <h1 id="shopping-title" className="font-display text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">
            鋒兄購物清單
          </h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            記錄想買的商品、預定購買日、預算、取貨方式與商品圖片。預定購買日前 3 天會開始提醒，到期當天仍會通知。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleCsvFileSelect}
          />
          <Button type="button" variant="outline" onClick={() => void loadItems()} disabled={loading || busy}>
            <RefreshCw className={loading ? "animate-spin" : ""} />
            重新整理
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => csvInputRef.current?.click()}
            disabled={loading || busy}
            title="從 CSV 匯入購物清單（相同購物名稱會更新）"
          >
            <Upload />
            匯入 CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={exportToCsv}
            disabled={busy}
            title="匯出目前全部購物清單為 CSV"
          >
            <Download />
            匯出 CSV
          </Button>
          <BulkSelectionControls
            selectionMode={bulk.selectionMode}
            isAllSelected={bulk.isAllSelected}
            selectedCount={bulk.selectedCount}
            visibleCount={visibleIds.length}
            disabled={loading || busy}
            onSelectAll={bulk.selectAll}
            onClear={bulk.clear}
            onDeleteSelected={() => { setBulkError(null); setBulkDeleteInput(""); setBulkDeleteOpen(true); }}
          />
          <Button type="button" onClick={() => openCreateForm()} disabled={loading || busy}>
            <Plus />
            新增商品
          </Button>
        </div>
      </header>

      {formOpen ? (
        <form id="shopping-form" onSubmit={handleSubmit} className="surface-raised scroll-mt-28 rounded-2xl p-4 sm:p-6">
          <div>
            <h2 className="font-display text-xl font-semibold text-foreground">
              {editingId ? "編輯購物項目" : "新增購物項目"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">預定價格支援台幣／美元／日圓／人民幣；未設定日期就不參與到期提醒。</p>
          </div>

          <fieldset disabled={busy} className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <FormField label="購物名稱" htmlFor="shopping-name" required>
              <Input
                id="shopping-name"
                maxLength={100}
                list="shopping-names"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="例如 洗碗機、米 10kg"
                required
                autoFocus
              />
              <datalist id="shopping-names">
                {itemNames.map((name) => <option key={name} value={name} />)}
              </datalist>
            </FormField>
            <FormField label="預定購買日" htmlFor="shopping-date">
              <Input
                id="shopping-date"
                type="date"
                value={form.plannedDate || ""}
                onChange={(event) => setForm((current) => ({ ...current, plannedDate: event.target.value }))}
              />
            </FormField>
            <FormField label="預定價格" htmlFor="shopping-price">
              <Input
                id="shopping-price"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={form.price ?? 0}
                onChange={(event) => setForm((current) => ({ ...current, price: Number(event.target.value) || 0 }))}
              />
            </FormField>
            <FormField label="幣別" htmlFor="shopping-currency">
              <NativeSelect
                id="shopping-currency"
                value={form.currency || "TWD"}
                onChange={(value) => setForm((current) => ({ ...current, currency: value }))}
              >
                {SHOPPING_CURRENCY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </NativeSelect>
            </FormField>
            <FormField label="預定數量" htmlFor="shopping-quantity">
              <Input
                id="shopping-quantity"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={form.quantity ?? 1}
                onChange={(event) => setForm((current) => ({ ...current, quantity: Math.max(1, Number(event.target.value) || 1) }))}
              />
            </FormField>
            <FormField label="預定商店" htmlFor="shopping-shop">
              <Input
                id="shopping-shop"
                maxLength={100}
                list="shopping-shops"
                value={form.shop || ""}
                onChange={(event) => setForm((current) => ({ ...current, shop: event.target.value }))}
                placeholder="例如 PChome、家樂福"
              />
              <datalist id="shopping-shops">
                {shopNames.map((name) => <option key={name} value={name} />)}
              </datalist>
            </FormField>
            <FormField label="預定購買／取貨方式" htmlFor="shopping-pickup">
              <NativeSelect
                id="shopping-pickup"
                value={pickupSelectValue}
                onChange={handlePickupSelectChange}
              >
                <option value="">未設定</option>
                {SHOPPING_PICKUP_METHOD_PRESETS.map((method) => <option key={method} value={method}>{method}</option>)}
                {pickupMethods
                  .filter((method) => !SHOPPING_PICKUP_METHOD_PRESETS.includes(method))
                  .map((method) => <option key={method} value={method}>{method}</option>)}
                <option value={PICKUP_METHOD_CUSTOM}>自行輸入…</option>
              </NativeSelect>
              {pickupSelectValue === PICKUP_METHOD_CUSTOM ? (
                <Input
                  id="shopping-pickup-custom"
                  className="mt-2"
                  maxLength={30}
                  value={form.pickupMethod || ""}
                  onChange={(event) => setForm((current) => ({ ...current, pickupMethod: event.target.value }))}
                  placeholder="輸入其他取貨方式"
                  autoFocus
                />
              ) : null}
            </FormField>
            <FormField label="帳號" htmlFor="shopping-account">
              <Input
                id="shopping-account"
                maxLength={200}
                value={form.account || ""}
                onChange={(event) => setForm((current) => ({ ...current, account: event.target.value }))}
                placeholder="Email、使用者名稱或辨識名稱"
              />
            </FormField>
            <FormField label="商品圖片" htmlFor="shopping-image" className="sm:col-span-2 xl:col-span-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative min-w-0 flex-1">
                  <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="shopping-image"
                    className="pl-9 pr-9"
                    maxLength={2000}
                    value={form.imageUrl || ""}
                    onChange={(event) => {
                      // 手動輸入網址時，清除已選取的檔案
                      setImageFile(null);
                      setImagePreviewUrl((prev) => {
                        if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
                        return "";
                      });
                      setForm((current) => ({ ...current, imageUrl: event.target.value }));
                    }}
                    placeholder="貼上圖片網址，或按右側「上傳圖片」"
                  />
                  {form.imageUrl ? (
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      onClick={() => setForm((current) => ({ ...current, imageUrl: "" }))}
                      aria-label="清除圖片網址"
                    >
                      <X className="size-4" />
                    </button>
                  ) : null}
                </div>
                <input
                  ref={imageUploadRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={handleImageFileSelect}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => imageUploadRef.current?.click()}
                  disabled={busy}
                >
                  {imageFile ? <ImagePlus className="text-accent" /> : <Upload />}
                  {imageFile ? "已選取圖片" : "上傳圖片"}
                </Button>
                {(imageFile || imagePreviewUrl) && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={resetImageState}
                    disabled={busy}
                  >
                    <X />
                    移除
                  </Button>
                )}
                {!imageFile && !imagePreviewUrl && form.imageUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setForm((current) => ({ ...current, imageUrl: "" }))}
                    disabled={busy}
                  >
                    <X />
                    移除圖片
                  </Button>
                ) : null}
              </div>
              {(imagePreviewUrl || form.imageUrl) ? (
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-[var(--line-soft)] bg-muted/30 p-3">
                  {/* 預覽圖：本機檔案以 blob 優先；編輯既有圖片用網址 */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreviewUrl || form.imageUrl || ""}
                    alt={`${form.name || "商品"}圖片預覽`}
                    className="h-24 w-24 shrink-0 rounded-lg border border-[var(--line-soft)] object-cover"
                  />
                  <div className="min-w-0 text-sm leading-6 text-muted-foreground">
                    <p className="truncate">{imageFile ? imageFile.name : (form.imageUrl || "")}</p>
                    <p>{imageUploading ? "上傳中…" : "儲存後圖片會跟著這筆購物項目保存。"}</p>
                  </div>
                </div>
              ) : null}
            </FormField>
            <FormField label="備註" htmlFor="shopping-note" className="sm:col-span-2 xl:col-span-3">
              <Textarea
                id="shopping-note"
                maxLength={3337}
                value={form.note || ""}
                onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                placeholder="規格、比價連結等"
              />
            </FormField>
          </fieldset>

          {actionError ? <ErrorMessage>{actionError}</ErrorMessage> : null}
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeForm} disabled={saving}>取消</Button>
            <Button type="submit" disabled={busy}>
              {saving ? <RefreshCw className="animate-spin" /> : null}
              {saving ? "儲存中…" : editingId ? "儲存變更" : "新增商品"}
            </Button>
          </div>
        </form>
      ) : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">搜尋名稱、商店、取貨方式、帳號或備註</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
            placeholder="搜尋名稱、商店、取貨方式、帳號或備註"
          />
        </label>
        <label className="w-full md:w-48">
          <span className="sr-only">狀態篩選</span>
          <NativeSelect id="shopping-status-filter" value={statusFilter} onChange={(value) => setStatusFilter(value as StatusFilter)}>
            <option value="all">全部狀態</option>
            <option value="upcoming">3 天內要買</option>
            <option value="today">今天要買</option>
            <option value="due">已過購買日</option>
            <option value="nodate">未設定日期</option>
          </NativeSelect>
        </label>
      </div>

      {error ? (
        <div role="alert" className="rounded-2xl border border-destructive/25 bg-destructive/8 p-4 text-sm text-destructive">
          <p className="font-semibold">無法載入購物清單</p>
          <p className="mt-1 leading-6">{error}</p>
        </div>
      ) : null}
      {!formOpen && actionError ? <ErrorMessage>{actionError}</ErrorMessage> : null}

      {loading && items.length === 0 ? (
        <LoadingSpinner text="載入購物清單…" className="min-h-48" />
      ) : error && items.length === 0 ? null : filtered.length === 0 ? (
        <EmptyState
          icon={<ShoppingCart className="size-7 text-muted-foreground" />}
          title={items.length === 0 ? "尚無購物項目" : "沒有符合條件的項目"}
          description={items.length === 0 ? "先新增第一個想買的商品與預定購買日。" : "調整搜尋文字或狀態篩選後再試一次。"}
          action={items.length === 0 ? <Button type="button" onClick={() => openCreateForm()}><Plus />新增第一筆</Button> : undefined}
        />
      ) : (
        <>
          {/* 桌上型表格 */}
          <div className="hidden overflow-hidden rounded-2xl border border-[var(--line-soft)] lg:block">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  {bulk.selectionMode ? <TableHead className="w-[40px]"><span className="sr-only">選取</span></TableHead> : null}
                  <TableHead className="w-[20%]">購物名稱</TableHead>
                  <TableHead className="w-[14%]">預定購買日</TableHead>
                  <TableHead className="w-[15%]">預定價格</TableHead>
                  <TableHead className="w-[9%]">數量</TableHead>
                  <TableHead className="w-[15%]">商店／取貨</TableHead>
                  <TableHead className="w-[10%]">帳號</TableHead>
                  <TableHead className="w-[17%] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => {
                  const info = getShoppingItemExpiryInfo(item);
                  return (
                    <TableRow key={item.$id} className={bulk.selectionMode && bulk.isSelected(item.$id) ? "bg-destructive/5" : undefined}>
                      {bulk.selectionMode ? (
                        <TableCell>
                          <SelectionCheckbox
                            checked={bulk.isSelected(item.$id)}
                            onChange={() => bulk.toggle(item.$id)}
                            label={`選取 ${item.name}`}
                            disabled={busy || loading}
                          />
                        </TableCell>
                      ) : null}
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-2.5">
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.imageUrl}
                              alt=""
                              loading="lazy"
                              className="size-10 shrink-0 rounded-lg border border-[var(--line-soft)] bg-muted object-cover"
                            />
                          ) : null}
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{item.name}</p>
                            {item.note ? <p className="truncate text-xs text-muted-foreground">{item.note}</p> : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="truncate text-sm text-foreground">{info.formattedDate || "未設定"}</p>
                            {info.hasDate ? (
                              <StatusBadge status={info.isExpired ? "expired" : info.isToday || info.isUpcomingSoon ? "urgent" : "normal"}>
                                {info.isExpired
                                  ? `${Math.abs(info.daysRemaining)} 天前`
                                  : info.isToday
                                    ? "今天"
                                    : info.daysRemaining === 1
                                      ? "明天"
                                      : `${info.daysRemaining} 天後`}
                              </StatusBadge>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm tabular-nums text-foreground">
                          {formatCurrencyWithExchange(item.price, item.currency || "TWD")}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm tabular-nums text-foreground">× {item.quantity ?? 1}</p>
                        {item.price ? (
                          <p className="text-xs text-muted-foreground">
                            小計 {formatCurrencyWithExchange((item.price || 0) * (item.quantity || 1), item.currency || "TWD")}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0 space-y-1">
                          {item.shop ? (
                            <p className="flex items-center gap-1.5 truncate text-sm text-foreground">
                              <Store className="size-3.5 shrink-0 text-muted-foreground" />{item.shop}
                            </p>
                          ) : null}
                          {item.pickupMethod ? (
                            <p className="truncate text-xs text-muted-foreground">{item.pickupMethod}</p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="truncate text-sm text-muted-foreground">{item.account?.trim() || "—"}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button type="button" variant="ghost" size="icon" onClick={() => openEditForm(item)} disabled={busy || loading} aria-label={`編輯 ${item.name}`}><Pencil /></Button>
                          <Button type="button" variant="ghost" size="icon" onClick={() => openCopyForm(item)} disabled={busy || loading} aria-label={`複製 ${item.name}`} title="複製此項目（預先填好欄位，供你確認後新增）"><Copy /></Button>
                          <Button type="button" variant="ghost" size="icon" onClick={() => { setActionError(null); setPendingDelete(item); }} disabled={busy || loading} aria-label={`刪除 ${item.name}`} className="text-destructive hover:text-destructive"><Trash2 /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* 行動版卡片 */}
          <div className="space-y-3 lg:hidden">
            {filtered.map((item) => {
              const info = getShoppingItemExpiryInfo(item);
              return (
                <div key={item.$id} className={`surface-inset rounded-2xl p-4 ${bulk.selectionMode && bulk.isSelected(item.$id) ? "ring-2 ring-destructive/30" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    {bulk.selectionMode ? (
                      <SelectionCheckbox
                        checked={bulk.isSelected(item.$id)}
                        onChange={() => bulk.toggle(item.$id)}
                        label={`選取 ${item.name}`}
                        disabled={busy || loading}
                      />
                    ) : null}
                    <div className="flex min-w-0 items-center gap-2.5">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt=""
                          loading="lazy"
                          className="size-12 shrink-0 rounded-xl border border-[var(--line-soft)] bg-muted object-cover"
                        />
                      ) : null}
                      <div className="min-w-0">
                        <p className="break-words font-semibold text-foreground">{item.name}</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {[item.shop, item.pickupMethod].filter(Boolean).join(" · ") || "未填商店"}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button type="button" variant="ghost" size="icon" onClick={() => openEditForm(item)} disabled={busy || loading} aria-label={`編輯 ${item.name}`}><Pencil /></Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => openCopyForm(item)} disabled={busy || loading} aria-label={`複製 ${item.name}`}><Copy /></Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => { setActionError(null); setPendingDelete(item); }} disabled={busy || loading} aria-label={`刪除 ${item.name}`} className="text-destructive hover:text-destructive"><Trash2 /></Button>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <p className="flex items-center gap-1.5 text-muted-foreground"><CalendarDays className="size-4 shrink-0" />{info.formattedDate || "未設定日期"}</p>
                    <p className="flex items-center gap-1.5 text-muted-foreground"><Users className="size-4 shrink-0" />{item.account?.trim() || "未填帳號"}</p>
                    <p className="tabular-nums text-foreground">{formatCurrencyWithExchange(item.price, item.currency || "TWD")}</p>
                    <p className="tabular-nums text-foreground">× {item.quantity ?? 1}</p>
                  </div>
                  {info.hasDate ? (
                    <div className="mt-2">
                      <StatusBadge status={info.isExpired ? "expired" : info.isToday || info.isUpcomingSoon ? "urgent" : "normal"}>
                        {info.isExpired
                          ? `已過 ${Math.abs(info.daysRemaining)} 天`
                          : info.isToday
                            ? "今天要買"
                            : info.daysRemaining === 1
                              ? "明天要買"
                              : `${info.daysRemaining} 天後要買`}
                      </StatusBadge>
                    </div>
                  ) : null}
                  {item.note ? <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{item.note}</p> : null}
                </div>
              );
            })}
          </div>
        </>
      )}

      <ManagementDeleteDialog
        open={pendingDelete !== null}
        recordName={pendingDelete ? `${pendingDelete.name}${pendingDelete.shop ? `（${pendingDelete.shop}）` : ""}` : ""}
        busy={deletingId !== null}
        error={actionError}
        onCancel={() => { setPendingDelete(null); setActionError(null); }}
        onConfirm={() => { if (pendingDelete) void handleDelete(pendingDelete); }}
      />
      <BulkDeleteDialog
        open={bulkDeleteOpen}
        count={bulk.selectedCount}
        noun="購物項目"
        confirmPhrase="DELETE shopping-list"
        busy={bulkDeleting}
        progress={bulkProgress}
        total={bulkTotal}
        error={bulkError}
        confirmInput={bulkDeleteInput}
        onConfirmInputChange={setBulkDeleteInput}
        onCancel={() => { if (!bulkDeleting) { setBulkDeleteOpen(false); setBulkDeleteInput(""); setBulkError(null); } }}
        onConfirm={() => { void handleBulkDelete(); }}
      />
      {importPreview ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-foreground/35 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeImportPreview();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="shopping-csv-import-title"
            className="surface-raised flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl"
          >
            <div className="border-b border-[var(--line-soft)] p-5 sm:p-6">
              <h2 id="shopping-csv-import-title" className="font-display text-xl font-semibold text-foreground">
                匯入 CSV 預覽
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                相同購物名稱會更新既有項目，其餘新增。有格式錯誤時不會寫入。
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
              {importResult ? (
                <div className="mb-4 rounded-xl bg-accent/10 px-3 py-2 text-sm text-foreground">
                  <p className="font-semibold">匯入完成</p>
                  <p className="mt-1">成功 {importResult.successCount} 筆 · 失敗 {importResult.failCount} 筆</p>
                </div>
              ) : null}
              {importPreview.errors.length > 0 ? (
                <div role="alert" className="mb-4 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <p className="font-semibold">格式錯誤</p>
                  <ul className="mt-1 space-y-1">
                    {importPreview.errors.map((item, index) => (
                      <li key={`${index}-${item}`}>• {item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {importPreview.data.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">將匯入 {importPreview.data.length} 筆</p>
                  {importPreview.data.map((item, index) => {
                    const existing = items.some((current) => shoppingImportKey(current) === shoppingImportKey(item));
                    return (
                      <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-accent/8 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{item.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{item.shop || "未填商店"}{item.plannedDate ? ` · ${item.plannedDate}` : ""}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${existing ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"}`}>
                          {existing ? "更新" : "新增"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">沒有可匯入的資料列。</p>
              )}
            </div>
            <div className="flex flex-col gap-3 border-t border-[var(--line-soft)] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:p-6">
              {importing ? (
                <div className="flex w-full items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-accent transition-all"
                      style={{ width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {importProgress.current}/{importProgress.total}
                  </span>
                </div>
              ) : importResult ? (
                <Button type="button" variant="outline" onClick={closeImportPreview}>完成</Button>
              ) : (
                <>
                  <Button type="button" variant="outline" onClick={closeImportPreview}>取消</Button>
                  <Button
                    type="button"
                    onClick={() => void executeImport()}
                    disabled={importPreview.data.length === 0 || importPreview.errors.length > 0}
                  >
                    確認匯入（{importPreview.data.length} 筆）
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function compareByPlannedDate(a: ShoppingItem, b: ShoppingItem) {
  const dateA = a.plannedDate ? new Date(a.plannedDate).getTime() : Number.POSITIVE_INFINITY;
  const dateB = b.plannedDate ? new Date(b.plannedDate).getTime() : Number.POSITIVE_INFINITY;
  return dateA - dateB;
}

function FormField({ label, htmlFor, required, className, children }: { label: string; htmlFor: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-foreground">
        {label}{required ? <span className="ml-1 text-destructive">*</span> : null}
      </label>
      {children}
    </div>
  );
}

function ErrorMessage({ children }: { children: React.ReactNode }) {
  return <p role="alert" className="mt-4 rounded-xl bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">{children}</p>;
}
