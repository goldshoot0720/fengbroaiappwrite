"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Bot,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Gauge,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { BulkDeleteDialog } from "@/components/ui/bulk-delete-dialog";
import { BulkSelectionControls, SelectionCheckbox } from "@/components/ui/bulk-selection-controls";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ManagementDeleteDialog } from "@/components/ui/management-delete-dialog";
import { Textarea } from "@/components/ui/textarea";
import { fetchApi } from "@/hooks/useApi";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { useManagementCrud } from "@/hooks/useManagementCrud";
import { deleteByIds } from "@/lib/bulkSelection";
import { API_ENDPOINTS } from "@/lib/constants";
import {
  emptyQuotaForm,
  QUOTA_SERVICE_TYPE_OPTIONS,
  toQuotaForm,
} from "@/lib/managementRecords";
import {
  buildQuotaCsv,
  parseQuotaCsv,
  quotaImportKey,
} from "@/lib/quotaCsv";
import { parseChatGptSession } from "@/lib/chatgptSession";
import { readStoredClaudeCredential } from "@/lib/claudeSession";
import { toClaudeQuotaFields, type ClaudeUsageSnapshot } from "@/lib/claudeUsage";
import { isMindvideoImageService, MINDVIDEO_FRESH_WINDOW_MS } from "@/lib/mindvideoPoints";
import {
  formatCountdown,
  formatDateCountdown,
  hasDateWindowReset,
  hasFiveHourWindowReset,
  isUsageStale,
  parseDateField,
  projectNextFiveHourReset,
  QUOTA_TIME_ZONE,
  toLocalTimeField,
  toQuotaFields,
  type CodexUsageSnapshot,
} from "@/lib/codexUsage";
import {
  isLitmediaServiceName,
  LITMEDIA_FRESH_WINDOW_MS,
  resolveLitmediaKey,
} from "@/lib/litmediaPoints";
import { AccessTokenReveal } from "@/components/ui/access-token-reveal";
import { cn, getExportFilename } from "@/lib/utils";
import type { Quota, QuotaFormData, QuotaServiceType } from "@/types";

interface QuotaManagementProps {
  onNavigate?: (moduleId: string) => void;
}

interface ServiceGroup {
  key: string;
  name: string;
  items: Quota[];
}

type TypeFilter = "all" | QuotaServiceType;

function serviceKey(name: string) {
  return name.trim().toLocaleLowerCase("zh-Hant");
}

function formatDate(value?: string) {
  if (!value) return "未設定";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "日期格式錯誤";
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function ratioLabel(value?: number) {
  if (value == null || value === 0) return null;
  return `${value}%`;
}

/**
 * 5 小時／一週比例是「哪一刻量到的」。
 * usageSyncedAt 是自動更新成功時寫的量測時刻；沒有的話（手填、或還沒同步過的舊資料）
 * 只好退回 $updatedAt——那是寫入時間，換 token、同步點數、改備註都會動到它。
 */
function measuredAtOf(item: Quota): number | null {
  const source = item.usageSyncedAt || item.$updatedAt;
  if (!source) return null;
  const parsed = new Date(source).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

/** 相對時間：讓「這份數字有多舊」一眼看得出來。 */
function formatSince(updatedAt: string | undefined, now: number): string | null {
  if (!updatedAt) return null;
  const parsed = new Date(updatedAt).getTime();
  if (Number.isNaN(parsed)) return null;

  const minutes = Math.floor(Math.max(0, now - parsed) / 60_000);
  if (minutes < 1) return "剛剛";
  if (minutes < 60) return `${minutes} 分鐘前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時前`;
  return `${Math.floor(hours / 24)} 天前`;
}

/**
 * LitMedia 的點數是「上一次簽到成功當下」讀到的數字，不是此刻的即時值。
 * 所以要標 pointsSyncedAt（那次簽到的時刻），標 $updatedAt（我們寫進資料庫的時間）
 * 會讓幾小時前的數字看起來像剛剛才更新的。
 */
function formatPointsSynced(pointsSyncedAt: string | undefined, now: number): string | null {
  if (!pointsSyncedAt) return null;
  const parsed = new Date(pointsSyncedAt);
  if (Number.isNaN(parsed.getTime())) return null;

  const stamp = parsed.toLocaleString("zh-TW", {
    timeZone: QUOTA_TIME_ZONE,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const since = formatSince(pointsSyncedAt, now);
  return since ? `${stamp} 簽到時的數字（${since}）` : `${stamp} 簽到時的數字`;
}

interface QuotaRefreshResult {
  quotaId: string;
  account?: string;
  status: "updated" | "fresh" | "skipped" | "error";
  error?: string;
}

interface QuotaRefreshResponse {
  refreshedAt: string;
  checked: number;
  updated: number;
  failed: number;
  results: QuotaRefreshResult[];
}

/**
 * 下一次重設的時間戳，用來把帳號由近到遠排序。
 *
 * 5 小時視窗只存 `HH:mm`，所以取「從現在算起的下一次」——今天還沒到就是今天，
 * 已經過了就是明天。沒有任何重設時間的排最後。
 */
function nextResetTime(item: Quota, now: number): number {
  if (item.serviceType === "ai" && item.expiry5h) {
    const syncedAt = measuredAtOf(item);
    const projected = projectNextFiveHourReset(item.expiry5h, syncedAt, now);
    if (projected) return projected.at;

    // 沒有同步時間可還原時，退回「從現在算起的下一個 HH:mm」
    const [hours, minutes] = item.expiry5h.split(":").map(Number);
    if (Number.isFinite(hours) && Number.isFinite(minutes)) {
      const candidate = new Date(now);
      candidate.setHours(hours, minutes, 0, 0);
      if (candidate.getTime() <= now) candidate.setDate(candidate.getDate() + 1);
      return candidate.getTime();
    }
  }

  for (const value of [item.expiryWeek, item.expiryMonth, item.quotaExpiry]) {
    if (!value) continue;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  }

  return Number.POSITIVE_INFINITY;
}

function serviceTypeLabel(type: QuotaServiceType) {
  return QUOTA_SERVICE_TYPE_OPTIONS.find((option) => option.value === type)?.label || "一般";
}

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

export default function QuotaManagement({ onNavigate }: QuotaManagementProps) {
  const {
    items,
    loading,
    error,
    fetchAll,
    create,
    update,
    remove,
    accountVersion,
  } = useManagementCrud<Quota>(API_ENDPOINTS.QUOTA);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());
  const [collapsedSearchServices, setCollapsedSearchServices] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<QuotaFormData>(() => emptyQuotaForm());
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Quota | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // 全站共用的四位數密碼，在鋒兄設定建立；這裡只需要知道有沒有設定過
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const importCloseTimer = useRef<number | null>(null);
  const [importPreview, setImportPreview] = useState<{ data: QuotaFormData[]; errors: string[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importResult, setImportResult] = useState<{ successCount: number; failCount: number } | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteInput, setBulkDeleteInput] = useState("");
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkTotal, setBulkTotal] = useState(0);
  const [bulkError, setBulkError] = useState<string | null>(null);
  // 用量是快照，畫面得自己往前走：每 30 秒重算一次新舊，回到分頁時立刻重算
  const [now, setNow] = useState(() => Date.now());
  const [refreshingUsage, setRefreshingUsage] = useState(false);
  const [usageNote, setUsageNote] = useState<string | null>(null);
  const usageInFlight = useRef(false);
  const lastUsageAttempt = useRef(0);

  useEffect(() => {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyQuotaForm());
    setActionError(null);
    setExpandedServices(new Set());
    setPendingDelete(null);
    setBulkDeleteOpen(false);
    setBulkDeleteInput("");
    setBulkError(null);
    setImportPreview(null);
    setImportResult(null);
    setImporting(false);
    setUsageNote(null);
    lastUsageAttempt.current = 0;
    if (importCloseTimer.current) {
      window.clearTimeout(importCloseTimer.current);
      importCloseTimer.current = null;
    }
  }, [accountVersion]);

  useEffect(() => () => {
    if (importCloseTimer.current) window.clearTimeout(importCloseTimer.current);
  }, []);

  useEffect(() => {
    if (!formOpen) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById("quota-form")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [editingId, formOpen]);

  const serviceNames = useMemo(
    () => [...new Set(items.map((item) => item.name.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-Hant")),
    [items],
  );

  // 只讀「有沒有設定過密碼」，不會拿到密碼內容
  useEffect(() => {
    let cancelled = false;
    fetchApi<{ hasPin: boolean }>(API_ENDPOINTS.ACCESS_PIN)
      .then((data) => {
        if (!cancelled) setHasPin(Boolean(data.hasPin));
      })
      .catch(() => {
        if (!cancelled) setHasPin(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") setNow(Date.now());
    };
    const timer = window.setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, []);

  // 只有超過保鮮期的帳號要重抓，其餘沿用現有數字。
  // ChatGPT 是即時查詢所以 5 分鐘就算舊；LitMedia 的數字本來就來自幾小時前的簽到，給 33 分鐘。
  const staleQuotaIds = useMemo(
    () => items
      .filter((item) => {
        if (isMindvideoImageService(item.name)) {
          return isUsageStale(item.$updatedAt, now, MINDVIDEO_FRESH_WINDOW_MS);
        }
        if (item.serviceType === "ai" && item.hasAccessToken) {
          // 從沒量到用量的那幾筆（例如剛貼上憑證）也算過期，不然要等 $updatedAt 過保鮮期才輪得到
          return isUsageStale(item.usageSyncedAt || item.$updatedAt, now);
        }
        if (resolveLitmediaKey(item)) {
          return isUsageStale(item.$updatedAt, now, LITMEDIA_FRESH_WINDOW_MS);
        }
        return false;
      })
      .map((item) => item.$id),
    [items, now],
  );

  const refreshUsage = useCallback(async (options: { force?: boolean; quotaIds?: string[] } = {}) => {
    if (usageInFlight.current) return;
    usageInFlight.current = true;
    lastUsageAttempt.current = Date.now();
    setRefreshingUsage(true);
    try {
      const result = await fetchApi<QuotaRefreshResponse>(API_ENDPOINTS.QUOTA_REFRESH, {
        method: "POST",
        cache: "no-store",
        body: JSON.stringify({
          force: options.force === true,
          ...(options.quotaIds?.length ? { quotaIds: options.quotaIds } : {}),
        }),
      });
      const firstError = result.results.find((entry) => entry.status === "error");
      setUsageNote(
        firstError
          ? `${result.failed} 個帳號的用量更新失敗（${firstError.account || "帳號"}）：${firstError.error || "原因不明"}`
          : null,
      );
      if (result.updated > 0) await fetchAll();
      setNow(Date.now());
    } catch (err) {
      setUsageNote(err instanceof Error ? err.message : "用量自動更新失敗");
    } finally {
      usageInFlight.current = false;
      setRefreshingUsage(false);
    }
  }, [fetchAll]);

  // 過期就自動補上；失敗後隔一分鐘才再試，不要每次 tick 都重打
  useEffect(() => {
    if (loading || staleQuotaIds.length === 0) return;
    if (usageInFlight.current) return;
    if (now - lastUsageAttempt.current < 60_000) return;
    void refreshUsage({ quotaIds: staleQuotaIds });
  }, [loading, now, staleQuotaIds, refreshUsage]);

  const groups = useMemo<ServiceGroup[]>(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-Hant");
    const filtered = items.filter((item) => {
      const matchesQuery = !normalizedQuery || [item.name, item.account, item.note]
        .some((value) => String(value || "").toLocaleLowerCase("zh-Hant").includes(normalizedQuery));
      const matchesType = typeFilter === "all" || item.serviceType === typeFilter;
      return matchesQuery && matchesType;
    });

    const grouped = new Map<string, ServiceGroup>();
    filtered.forEach((item) => {
      const key = serviceKey(item.name);
      const group = grouped.get(key) || { key, name: item.name.trim(), items: [] };
      group.items.push(item);
      grouped.set(key, group);
    });

    // 同一個服務底下的帳號依「下次重設時間」由近到遠；沒有重設時間的排最後、再以帳號排序
    return [...grouped.values()]
      .map((group) => ({
        ...group,
        items: group.items.sort((a, b) => {
          const resetA = nextResetTime(a, now);
          const resetB = nextResetTime(b, now);
          if (resetA !== resetB) return resetA - resetB;
          return String(a.account || "").localeCompare(String(b.account || ""), "zh-Hant");
        }),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
  }, [items, now, query, typeFilter]);

  const visibleIds = useMemo(
    () => groups.flatMap((group) => group.items.map((item) => item.$id).filter(Boolean)),
    [groups],
  );
  const bulk = useBulkSelection(visibleIds);
  const quotaRowCols = bulk.selectionMode
    ? "xl:grid-cols-[28px_minmax(0,1.1fr)_minmax(8rem,1fr)_minmax(8rem,1.2fr)_minmax(0,.8fr)_minmax(0,1fr)_136px]"
    : "xl:grid-cols-[minmax(0,1.1fr)_minmax(8rem,1fr)_minmax(8rem,1.2fr)_minmax(0,.8fr)_minmax(0,1fr)_136px]";

  const clearBulkSelection = bulk.clear;
  useEffect(() => {
    clearBulkSelection();
  }, [accountVersion, clearBulkSelection]);

  const serviceCount = useMemo(
    () => new Set(items.map((item) => serviceKey(item.name))).size,
    [items],
  );
  const aiCount = items.filter((item) => item.serviceType === "ai").length;
  const busy = saving || deletingId !== null || importing || bulkDeleting;

  const openCreateForm = (name = "") => {
    setEditingId(null);
    setForm(emptyQuotaForm(name));
    setActionError(null);
    setFormOpen(true);
  };

  const openEditForm = (item: Quota) => {
    setEditingId(item.$id);
    setForm(toQuotaForm(item));
    setActionError(null);
    setFormOpen(true);
  };

  const openCopyForm = (item: Quota) => {
    setEditingId(null);
    setForm({ ...toQuotaForm(item), name: `${item.name || "未命名"} (複製)` });
    setActionError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyQuotaForm());
    setActionError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setSaving(true);
    setActionError(null);
    try {
      const result = editingId ? await update(editingId, form) : await create(form);
      setExpandedServices((current) => new Set(current).add(serviceKey(result.name)));
      closeForm();
    } catch (submitError) {
      setActionError(submitError instanceof Error ? submitError.message : "儲存失敗，請稍後再試。");
    } finally {
      setSaving(false);
    }
  };

  const handleSelectAllVisible = () => {
    if (!bulk.selectionMode) {
      setExpandedServices(new Set(groups.map((group) => group.key)));
      setCollapsedSearchServices(new Set());
    }
    bulk.selectAll();
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
      (id) => fetchApi(`${API_ENDPOINTS.QUOTA}/${encodeURIComponent(id)}`, { method: "DELETE" }),
      (done) => setBulkProgress(done),
    );
    await fetchAll();
    setBulkDeleting(false);
    if (failCount > 0) {
      setBulkError(`有 ${failCount} 筆刪除失敗，請確認連線後再試。`);
      return;
    }
    bulk.clear();
    setBulkDeleteOpen(false);
    setBulkDeleteInput("");
  };

  const handleDelete = async (item: Quota) => {
    if (busy) return;
    setDeletingId(item.$id);
    setActionError(null);
    try {
      await remove(item.$id);
      setPendingDelete(null);
      if (editingId === item.$id) closeForm();
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : "刪除失敗，請確認連線後再試一次。");
    } finally {
      setDeletingId(null);
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
      const csv = buildQuotaCsv(items);
      const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = getExportFilename("quota");
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
      setImportPreview(parseQuotaCsv(text));
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
    const index = new Map(items.map((item) => [quotaImportKey(item), item.$id]));

    for (let i = 0; i < importPreview.data.length; i++) {
      const formData = importPreview.data[i];
      setImportProgress({ current: i + 1, total: importPreview.data.length });
      try {
        const key = quotaImportKey(formData);
        const existingId = index.get(key);
        if (existingId) {
          await fetchApi(`${API_ENDPOINTS.QUOTA}/${encodeURIComponent(existingId)}`, {
            method: "PUT",
            body: JSON.stringify(formData),
          });
        } else {
          const created = await fetchApi<Quota>(API_ENDPOINTS.QUOTA, {
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
      await fetchAll();
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

  const toggleService = (key: string) => {
    if (query.trim()) {
      setCollapsedSearchServices((current) => {
        const next = new Set(current);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
      return;
    }
    setExpandedServices((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const setNumberField = (key: keyof QuotaFormData) => (value: string) => {
    setForm((current) => ({ ...current, [key]: Number(value) || 0 }));
  };

  return (
    <section className="space-y-6" aria-labelledby="quota-title">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <h1 id="quota-title" className="font-display text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">
            鋒兄額度
          </h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            依服務集中追蹤每個帳號的剩餘額度、比例與到期日；AI 服務可再記錄 5 小時／一週／一月方案的比例與到期。點擊服務名稱即可展開帳號清單。
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
          <Button type="button" variant="outline" onClick={() => void fetchAll()} disabled={loading || busy}>
            <RefreshCw className={loading ? "animate-spin" : ""} />
            重新整理
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void refreshUsage({ force: true })}
            disabled={loading || busy || refreshingUsage}
            title="用已存的 accessToken 立刻重抓 AI 服務的 5 小時／一週用量並寫回"
          >
            <Gauge className={refreshingUsage ? "animate-pulse" : ""} />
            {refreshingUsage ? "更新用量中…" : "更新用量"}
          </Button>
          {hasPin === false ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => onNavigate?.("settings")}
              title="四位數密碼是全站共用的，於鋒兄設定建立"
              className="border-accent text-accent-strong"
            >
              <KeyRound />
              去鋒兄設定建立四位數密碼
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => csvInputRef.current?.click()}
            disabled={loading || busy}
            title="從 CSV 匯入額度紀錄（相同服務與帳號會更新）"
          >
            <Upload />
            匯入 CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={exportToCsv}
            disabled={busy}
            title="匯出目前全部額度紀錄為 CSV"
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
            onSelectAll={handleSelectAllVisible}
            onClear={bulk.clear}
            onDeleteSelected={() => { setBulkError(null); setBulkDeleteInput(""); setBulkDeleteOpen(true); }}
          />
          <Button type="button" onClick={() => openCreateForm()} disabled={loading || busy}>
            <Plus />
            新增紀錄
          </Button>
        </div>
      </header>

      <div className="surface-inset grid grid-cols-3 divide-x divide-[var(--line-soft)] overflow-hidden rounded-2xl">
        <SummaryValue label="服務" value={serviceCount} icon={<BadgeCheck />} />
        <SummaryValue label="帳號紀錄" value={items.length} icon={<Users />} />
        <SummaryValue label="AI 服務帳號" value={aiCount} icon={<Bot />} />
      </div>

      {formOpen ? (
        <form id="quota-form" onSubmit={handleSubmit} className="surface-raised scroll-mt-28 rounded-2xl p-4 sm:p-6">
          <div>
            <h2 className="font-display text-xl font-semibold text-foreground">
              {editingId ? "編輯帳號紀錄" : "新增帳號紀錄"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">同一服務可建立多筆帳號，清單會自動歸在一起。</p>
          </div>

          <fieldset disabled={busy} className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <FormField label="服務名稱" htmlFor="quota-service-name" required>
              <Input
                id="quota-service-name"
                maxLength={100}
                list="quota-services"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="例如 ChatGPT"
                required
                autoFocus
              />
              <datalist id="quota-services">
                {serviceNames.map((name) => <option key={name} value={name} />)}
              </datalist>
            </FormField>
            <FormField label="服務類型" htmlFor="quota-service-type">
              <NativeSelect
                id="quota-service-type"
                value={form.serviceType}
                onChange={(value) => setForm((current) => ({ ...current, serviceType: value as QuotaServiceType }))}
              >
                {QUOTA_SERVICE_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </NativeSelect>
            </FormField>
            <FormField label="帳號" htmlFor="quota-account">
              <Input
                id="quota-account"
                maxLength={200}
                value={form.account || ""}
                onChange={(event) => setForm((current) => ({ ...current, account: event.target.value }))}
                placeholder="Email、使用者名稱或辨識名稱"
              />
            </FormField>
            <FormField label="額度剩餘次數" htmlFor="quota-remaining">
              <Input
                id="quota-remaining"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={form.quotaRemaining}
                onChange={(event) => setNumberField("quotaRemaining")(event.target.value)}
              />
            </FormField>
            <FormField label="額度剩餘點數" htmlFor="quota-points">
              <Input
                id="quota-points"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={form.quotaPoints}
                onChange={(event) => setNumberField("quotaPoints")(event.target.value)}
              />
            </FormField>
            {/* 只有 LitMedia 的服務才需要對簽到槽位，其他服務不該看到這一格 */}
            {isLitmediaServiceName(form.name) ? (
              <FormField label="LitMedia 簽到帳號" htmlFor="quota-litmedia-account">
                <Input
                  id="quota-litmedia-account"
                  maxLength={100}
                  value={form.litmediaAccount || ""}
                  onChange={(event) => setForm((current) => ({ ...current, litmediaAccount: event.target.value }))}
                  placeholder="留空就用上面的帳號對；對不上時才填槽位編號，例如 19"
                />
              </FormField>
            ) : null}
            <FormField label="額度剩餘比例（%）" htmlFor="quota-ratio">
              <Input
                id="quota-ratio"
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                step={1}
                value={form.quotaRatio}
                onChange={(event) => setNumberField("quotaRatio")(event.target.value)}
              />
            </FormField>
            <FormField label="額度到期日" htmlFor="quota-expiry">
              <Input
                id="quota-expiry"
                type="date"
                value={form.quotaExpiry || ""}
                onChange={(event) => setForm((current) => ({ ...current, quotaExpiry: event.target.value }))}
              />
            </FormField>

            {form.serviceType === "ai" ? (
              <>
                <div className="sm:col-span-2 xl:col-span-3">
                  <h3 className="border-t border-[var(--line-soft)] pt-4 text-sm font-semibold text-foreground">AI 服務方案（比例＋到期）</h3>
                </div>
                <FormField label="5 小時比例（%）" htmlFor="quota-ratio-5h">
                  <Input
                    id="quota-ratio-5h"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={100}
                    step={1}
                    value={form.ratio5h}
                    onChange={(event) => setNumberField("ratio5h")(event.target.value)}
                  />
                </FormField>
                <FormField label="5 小時到期" htmlFor="quota-expiry-5h">
                  <Input
                    id="quota-expiry-5h"
                    type="time"
                    value={form.expiry5h || ""}
                    onChange={(event) => setForm((current) => ({ ...current, expiry5h: event.target.value }))}
                  />
                </FormField>
                <FormField label="一週比例（%）" htmlFor="quota-ratio-week">
                  <Input
                    id="quota-ratio-week"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={100}
                    step={1}
                    value={form.ratioWeek}
                    onChange={(event) => setNumberField("ratioWeek")(event.target.value)}
                  />
                </FormField>
                <FormField label="一週到期（西元年／月／日）" htmlFor="quota-expiry-week">
                  <Input
                    id="quota-expiry-week"
                    type="date"
                    value={form.expiryWeek || ""}
                    onChange={(event) => setForm((current) => ({ ...current, expiryWeek: event.target.value }))}
                  />
                </FormField>
                <FormField label="一月比例（%）" htmlFor="quota-ratio-month">
                  <Input
                    id="quota-ratio-month"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={100}
                    step={1}
                    value={form.ratioMonth}
                    onChange={(event) => setNumberField("ratioMonth")(event.target.value)}
                  />
                </FormField>
                <FormField label="一月到期（西元年／月／日）" htmlFor="quota-expiry-month">
                  <Input
                    id="quota-expiry-month"
                    type="date"
                    value={form.expiryMonth || ""}
                    onChange={(event) => setForm((current) => ({ ...current, expiryMonth: event.target.value }))}
                  />
                </FormField>
                <FormField label="重置機會次數" htmlFor="quota-reset-credits-balance">
                  <Input
                    id="quota-reset-credits-balance"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    value={form.resetCreditsBalance ?? 0}
                    onChange={(event) => setNumberField("resetCreditsBalance")(event.target.value)}
                  />
                </FormField>
                <FormField label="重置機會到期" htmlFor="quota-reset-credits-expiry">
                  <Input
                    id="quota-reset-credits-expiry"
                    maxLength={20}
                    value={form.resetCreditsExpiry || ""}
                    onChange={(event) => setForm((current) => ({ ...current, resetCreditsExpiry: event.target.value }))}
                    placeholder="西元年-月-日 時:分，例如 2026-10-05 07:34"
                  />
                </FormField>
                <AiAccessTokenField
                  form={form}
                  setForm={setForm}
                  quotaId={editingId}
                  hasExistingToken={Boolean(
                    editingId && items.some((item) => item.$id === editingId && item.hasAccessToken)
                  )}
                  hasPin={hasPin}
                  onOpenPinPanel={() => onNavigate?.("settings")}
                />
              </>
            ) : null}

            <FormField label="備註" htmlFor="quota-note" className="sm:col-span-2 xl:col-span-3">
              <Textarea
                id="quota-note"
                maxLength={3337}
                value={form.note || ""}
                onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                placeholder="方案限制、計費週期或其他提醒"
              />
            </FormField>
          </fieldset>

          {actionError ? <ErrorMessage>{actionError}</ErrorMessage> : null}
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeForm} disabled={saving}>取消</Button>
            <Button type="submit" disabled={busy}>
              {saving ? <RefreshCw className="animate-spin" /> : null}
              {saving ? "儲存中…" : editingId ? "儲存變更" : "新增紀錄"}
            </Button>
          </div>
        </form>
      ) : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">搜尋服務、帳號或備註</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCollapsedSearchServices(new Set());
            }}
            className="pl-9"
            placeholder="搜尋服務、帳號或備註"
          />
        </label>
        <label className="w-full md:w-48">
          <span className="sr-only">服務類型</span>
          <NativeSelect id="quota-type-filter" value={typeFilter} onChange={(value) => setTypeFilter(value as TypeFilter)}>
            <option value="all">全部類型</option>
            <option value="general">一般服務</option>
            <option value="ai">AI 服務</option>
          </NativeSelect>
        </label>
      </div>

      {error ? (
        <div role="alert" className="rounded-2xl border border-destructive/25 bg-destructive/8 p-4 text-sm text-destructive">
          <p className="font-semibold">無法載入額度資料</p>
          <p className="mt-1 leading-6">{error}</p>
          {onNavigate && error.includes("quota") ? (
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => onNavigate("settings")}>前往鋒兄設定</Button>
          ) : null}
        </div>
      ) : null}
      {!formOpen && actionError ? <ErrorMessage>{actionError}</ErrorMessage> : null}
      {usageNote ? (
        <div role="status" className="rounded-2xl border border-[var(--line-soft)] bg-accent/8 p-4 text-sm leading-6 text-muted-foreground">
          <p className="font-semibold text-foreground">用量沒有更新成功</p>
          <p className="mt-1">{usageNote}</p>
          <p className="mt-1">畫面上的比例是上次成功同步的結果，可能已經不是現況。</p>
        </div>
      ) : null}

      {loading && items.length === 0 ? (
        <LoadingSpinner text="載入額度資料…" className="min-h-48" />
      ) : error && items.length === 0 ? null : groups.length === 0 ? (
        <EmptyState
          icon={<Users className="size-7 text-muted-foreground" />}
          title={items.length === 0 ? "尚無額度紀錄" : "沒有符合條件的帳號"}
          description={items.length === 0 ? "先新增第一個服務與帳號，之後可在服務底下持續加入帳號。" : "調整搜尋文字或類型篩選後再試一次。"}
          action={items.length === 0 ? <Button type="button" onClick={() => openCreateForm()}><Plus />新增第一筆</Button> : undefined}
        />
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const isOpen = query.trim() ? !collapsedSearchServices.has(group.key) : expandedServices.has(group.key);
            const groupAiCount = group.items.filter((item) => item.serviceType === "ai").length;
            return (
              <section key={group.key} className="surface-inset overflow-hidden rounded-2xl">
                <div className="flex items-center gap-2 p-3 sm:p-4">
                  {bulk.selectionMode ? (
                    <SelectionCheckbox
                      checked={group.items.length > 0 && group.items.every((item) => bulk.isSelected(item.$id))}
                      onChange={() => {
                        const ids = group.items.map((item) => item.$id).filter(Boolean);
                        const allSelected = ids.length > 0 && ids.every((id) => bulk.isSelected(id));
                        bulk.toggleMany(ids, !allSelected);
                      }}
                      label={`選取 ${group.name} 全部帳號`}
                      disabled={busy || loading}
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => toggleService(group.key)}
                    aria-expanded={isOpen}
                    aria-controls={`quota-accounts-${encodeURIComponent(group.key)}`}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left outline-none transition-colors hover:bg-accent/10 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent-strong">
                      <Users className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-lg font-semibold text-foreground">{group.name}</span>
                      <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span>{group.items.length} 個帳號</span>
                        {groupAiCount > 0 ? <span>{groupAiCount} 個 AI 帳號</span> : null}
                      </span>
                    </span>
                    {isOpen ? <ChevronUp className="shrink-0" /> : <ChevronDown className="shrink-0" />}
                  </button>
                  <Button type="button" variant="outline" size="sm" onClick={() => openCreateForm(group.name)} disabled={busy || loading} aria-label={`新增 ${group.name} 帳號`}>
                    <Plus />
                    <span className="hidden sm:inline">新增帳號</span>
                  </Button>
                </div>

                {isOpen ? (
                  <div id={`quota-accounts-${encodeURIComponent(group.key)}`} className="border-t border-[var(--line-soft)]">
                    <div className={cn("hidden gap-4 border-b border-[var(--line-soft)] px-5 py-2 text-xs font-semibold leading-5 text-muted-foreground xl:grid", quotaRowCols)}>
                      {bulk.selectionMode ? <span className="sr-only">選取</span> : null}
                      <span>帳號</span><span>剩餘額度</span><span>到期</span><span>類型</span><span>備註</span><span>操作</span>
                    </div>
                    <div className="divide-y divide-[var(--line-soft)]">
                      {group.items.map((item) => {
                        const basicRatio = ratioLabel(item.quotaRatio);
                        // 這些比例是「上次量到當下」的快照，usageSyncedAt 就是那個當下
                        const syncedAt = measuredAtOf(item);
                        const syncedLabel = formatSince(item.$updatedAt, now);
                        // 只有自動更新成功才會有 usageSyncedAt；沒有就代表這排數字是手填的
                        const usageSyncedLabel = formatSince(item.usageSyncedAt, now);
                        const pointsSyncedLabel = formatPointsSynced(item.pointsSyncedAt, now);
                        // 點數只對「點數制」的列有意義：填過點數，或設定了 LitMedia 簽到帳號
                        // （等著同步的列要看得到 0 點，才知道它有在等）。其餘的列不該掛一個沒意義的 0。
                        const showPoints = Boolean(item.quotaPoints) || Boolean(resolveLitmediaKey(item)) || isMindvideoImageService(item.name);
                        // 使用者最在意「下次什麼時候重設」，所以過去的重設點要推到下一次而不是照抄
                        const fiveHour = projectNextFiveHourReset(item.expiry5h, syncedAt, now);
                        const aiPlans = item.serviceType === "ai"
                          ? [
                              {
                                key: "5h",
                                prefix: "5 小時",
                                ratio: item.ratio5h,
                                expiry: item.expiry5h,
                                // 對不上 5 小時上界的值不拿來倒數，避免出現「還有 20 小時」這種矛盾
                                resetAt: fiveHour?.reliable ? fiveHour.at : null,
                                resetLabel: fiveHour
                                  ? toLocalTimeField(new Date(fiveHour.at).toISOString())
                                  : item.expiry5h || "",
                                // 推算出來的時間只是估計，真正的要等下次同步
                                projected: Boolean(fiveHour?.projected),
                                unverified: Boolean(fiveHour && !fiveHour.reliable),
                                // 重設時刻已經過了，這筆比例講的是上一個視窗
                                expired: hasFiveHourWindowReset(item.expiry5h, syncedAt, now),
                                dateOnly: false,
                              },
                              {
                                key: "week",
                                prefix: "一週",
                                ratio: item.ratioWeek,
                                expiry: item.expiryWeek,
                                resetAt: parseDateField(item.expiryWeek),
                                resetLabel: item.expiryWeek || "",
                                projected: false,
                                unverified: false,
                                expired: hasDateWindowReset(item.expiryWeek, now),
                                // 只有日期、沒有時分，倒數要照日曆天數算
                                dateOnly: true,
                              },
                              {
                                key: "month",
                                prefix: "一月",
                                ratio: item.ratioMonth,
                                expiry: item.expiryMonth,
                                resetAt: parseDateField(item.expiryMonth),
                                resetLabel: item.expiryMonth || "",
                                projected: false,
                                unverified: false,
                                expired: hasDateWindowReset(item.expiryMonth, now),
                                dateOnly: true,
                              },
                            ].map((plan) => {
                              // 有填重設時間才算「有在追蹤這段」，0% 才是真的用完而不是沒填
                              const depleted = Boolean(plan.expiry) && (plan.ratio ?? 0) === 0;
                              // 只存到「日」的欄位在重設那天整天都還算「即將重設」——
                              // 當天 00:00 一過就把倒數收掉，等於提早一天說它結束了
                              const upcoming =
                                plan.resetAt !== null && (plan.dateOnly ? !plan.expired : plan.resetAt > now);
                              return {
                                ...plan,
                                depleted,
                                upcoming,
                                countdown: upcoming
                                  ? plan.dateOnly
                                    ? formatDateCountdown(plan.resetAt as number, now)
                                    : formatCountdown(plan.resetAt as number, now)
                                  : null,
                                // 手動填的數字不確定是不是最新，只有 API 量回來的才敢示警
                                // （有憑證不等於量到過——換 token 也會寫這一列）；
                                // 已經過了重設時刻就更不能標紅，那是舊視窗的數字
                                warn: depleted && !plan.expired && Boolean(item.usageSyncedAt),
                                ratioText: plan.expired
                                  ? "已重設・待更新"
                                  : depleted
                                    ? "0% 剩餘"
                                    : ratioLabel(plan.ratio),
                              };
                            })
                          : [];
                        return (
                          <div key={item.$id} className={cn("grid gap-4 px-4 py-4 sm:grid-cols-2 xl:items-start xl:px-5", quotaRowCols, bulk.selectionMode && bulk.isSelected(item.$id) && "bg-destructive/5")}>
                            {bulk.selectionMode ? (
                              <div className="flex items-start pt-1">
                                <SelectionCheckbox
                                  checked={bulk.isSelected(item.$id)}
                                  onChange={() => bulk.toggle(item.$id)}
                                  label={`選取 ${group.name} ${item.account || "帳號"}`}
                                  disabled={busy || loading}
                                />
                              </div>
                            ) : null}
                            <Cell label="帳號">
                              <span className="break-all font-medium text-foreground">{item.account?.trim() || "未填帳號"}</span>
                              {item.hasAccessToken ? (
                                <div className="mt-2">
                                  <div className="mb-1 flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                                    <KeyRound className="h-3 w-3" />
                                    accessToken
                                  </div>
                                  <AccessTokenReveal quotaId={item.$id} hint={item.accessTokenHint} />
                                </div>
                              ) : null}
                            </Cell>
                            <Cell label="剩餘額度">
                              <div className="space-y-1 text-sm tabular-nums text-foreground">
                                <p>{item.quotaRemaining} 次</p>
                                {showPoints ? <p>{item.quotaPoints || 0} 點</p> : null}
                                {showPoints && pointsSyncedLabel ? (
                                  <p className="text-xs font-normal text-muted-foreground">{pointsSyncedLabel}</p>
                                ) : null}
                                {basicRatio ? <p><span className="text-muted-foreground">比例 </span>{basicRatio}</p> : null}
                                {/* 「重置機會」是額外的手動歸零機會，跟上面剩餘次數／點數是不同的東西，只有填過到期時間才代表有在追蹤 */}
                                {item.serviceType === "ai" && item.resetCreditsExpiry ? (
                                  <p className="text-xs font-normal text-muted-foreground">
                                    重置機會 {item.resetCreditsBalance ?? 0} 次・{item.resetCreditsExpiry} 前
                                  </p>
                                ) : null}
                              </div>
                            </Cell>
                            <Cell label="到期">
                              <div className="space-y-1.5">
                                <p className="inline-flex items-center gap-2 text-sm text-foreground"><CalendarDays className="size-4 shrink-0 text-muted-foreground" />{formatDate(item.quotaExpiry)}</p>
                                {aiPlans.length > 0 ? (
                                  <div className="flex flex-wrap gap-1.5">
                                    {aiPlans.map((plan) => plan.ratioText || plan.expiry ? (
                                      <span
                                        key={plan.key}
                                        className={cn(
                                          "rounded-full px-2 py-0.5 text-xs",
                                          plan.warn
                                            ? "bg-destructive/12 font-medium text-destructive"
                                            : "bg-accent/12 text-foreground"
                                        )}
                                      >
                                        {plan.prefix}
                                        {plan.upcoming ? (
                                          <>
                                            {" · 下次重設 "}
                                            <span className="font-semibold tabular-nums">{plan.resetLabel}</span>
                                            {plan.projected ? "（估計）" : ""}
                                            {plan.countdown ? `・${plan.countdown}` : ""}
                                          </>
                                        ) : plan.unverified ? (
                                          <>
                                            {" · 重設 "}
                                            <span className="font-semibold tabular-nums">{plan.resetLabel}</span>
                                            {"（時間待確認）"}
                                          </>
                                        ) : null}
                                        {plan.ratioText ? ` · ${plan.ratioText}` : ""}
                                        {plan.warn ? " · 已達使用上限" : ""}
                                      </span>
                                    ) : null)}
                                  </div>
                                ) : null}
                                {/*
                                  「用量更新於」報的是 usageSyncedAt——API 真的量到比例的那一刻。
                                  $updatedAt 只是寫入時間，換 token、同步點數、改備註都會動到它，
                                  拿它報時間會讓一排從沒同步成功的舊數字看起來像剛更新的。
                                  沒量到過就退回「手動填寫於」（$updatedAt）；點數自動寫回的列連這個都不能標，
                                  那已經有「簽到時的數字」那行負責報時間了。
                                */}
                                {item.serviceType === "ai" && (usageSyncedLabel || (syncedLabel && !item.pointsSyncedAt)) ? (
                                  <p className="text-xs text-muted-foreground">
                                    {usageSyncedLabel
                                      ? `用量更新於 ${usageSyncedLabel}${refreshingUsage ? "・更新中…" : ""}`
                                      : `手動填寫於 ${syncedLabel}${item.hasAccessToken && refreshingUsage ? "・更新中…" : ""}`}
                                  </p>
                                ) : null}
                              </div>
                            </Cell>
                            <Cell label="類型">
                              <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
                                {item.serviceType === "ai" ? <Bot className="size-4 text-muted-foreground" /> : null}
                                {serviceTypeLabel(item.serviceType)}
                              </span>
                            </Cell>
                            <Cell label="備註"><p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{item.note?.trim() || "—"}</p></Cell>
                            <div className="flex items-center justify-end gap-1 xl:justify-start">
                              <Button type="button" variant="ghost" size="icon" onClick={() => openEditForm(item)} disabled={busy || loading} aria-label={`編輯 ${group.name} ${item.account || "帳號"}`}><Pencil /></Button>
                              <Button type="button" variant="ghost" size="icon" onClick={() => openCopyForm(item)} disabled={busy || loading} aria-label={`複製 ${group.name} ${item.account || "帳號"}`} title="複製此帳號紀錄（預先填好欄位，供你確認後新增）"><Copy /></Button>
                              <Button type="button" variant="ghost" size="icon" onClick={() => { setActionError(null); setPendingDelete(item); }} disabled={busy || loading} aria-label={`刪除 ${group.name} ${item.account || "帳號"}`} className="text-destructive hover:text-destructive"><Trash2 /></Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
      <ManagementDeleteDialog
        open={pendingDelete !== null}
        recordName={pendingDelete ? `${pendingDelete.name}／${pendingDelete.account?.trim() || "未填帳號"}` : ""}
        busy={deletingId !== null}
        error={actionError}
        onCancel={() => { setPendingDelete(null); setActionError(null); }}
        onConfirm={() => { if (pendingDelete) void handleDelete(pendingDelete); }}
      />
      <BulkDeleteDialog
        open={bulkDeleteOpen}
        count={bulk.selectedCount}
        noun="額度紀錄"
        confirmPhrase="DELETE quota"
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
            aria-labelledby="quota-csv-import-title"
            className="surface-raised flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl"
          >
            <div className="border-b border-[var(--line-soft)] p-5 sm:p-6">
              <h2 id="quota-csv-import-title" className="font-display text-xl font-semibold text-foreground">
                匯入 CSV 預覽
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                相同服務名稱與帳號會更新既有紀錄，其餘新增。有格式錯誤時不會寫入。
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
                    {importPreview.errors.map((error, index) => (
                      <li key={`${index}-${error}`}>• {error}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {importPreview.data.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">將匯入 {importPreview.data.length} 筆</p>
                  {importPreview.data.map((item, index) => {
                    const existing = items.some((current) => quotaImportKey(current) === quotaImportKey(item));
                    return (
                      <div key={`${item.name}-${item.account || ""}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-accent/8 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{item.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{item.account?.trim() || "未填帳號"}</p>
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

function SummaryValue({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-2 px-3 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-5 sm:py-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent-strong sm:size-10 [&_svg]:size-4 sm:[&_svg]:size-5">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      </div>
    </div>
  );
}

interface CodexUsageResponse extends CodexUsageSnapshot {
  quotaId: string | null;
  quotaName: string;
  tokenExpiry: string | null;
}

interface ClaudeUsageResponse extends ClaudeUsageSnapshot {
  quotaId: string | null;
  quotaName: string;
  tokenExpiry: string | null;
}

/** Claude 憑證專屬錯誤：/api/claude-usage 對「不是 Claude 格式」的 accessToken 一律回這句。 */
const CLAUDE_CREDENTIAL_MISMATCH_ERROR = "沒有可用的 Claude 憑證，請先貼上 accessToken／憑證 JSON。";

/**
 * ChatGPT Plus / Codex 與 Claude Code 共用同一個 accessToken 欄位：
 * 貼上 session.json、accessToken 或 Claude 的 `.credentials.json` 後，
 * 可直接向對應的來源 API 帶入 5 小時／一週的剩餘比例與重設時間
 * （Codex 另外還有剩餘積分／重置機會，Claude 官方端點沒提供這兩個數字，維持手動填寫）。
 *
 * 明文預設隱藏；讀取已存的 token 需要四位數密碼。存的是哪一種憑證看格式辨識，
 * 辨識順序跟 `/api/quota-refresh` 一致：先試 Claude（`sk-ant-`／JSON），對不上再當 ChatGPT。
 */
function AiAccessTokenField({
  form,
  setForm,
  quotaId,
  hasExistingToken,
  hasPin,
  onOpenPinPanel,
}: {
  form: QuotaFormData;
  setForm: React.Dispatch<React.SetStateAction<QuotaFormData>>;
  quotaId: string | null;
  hasExistingToken: boolean;
  hasPin: boolean | null;
  onOpenPinPanel: () => void;
}) {
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);
  const [fetching, setFetching] = useState(false);

  const typedClaudeCredential = form.accessToken ? readStoredClaudeCredential(form.accessToken) : null;
  const typedChatGptCredential =
    !typedClaudeCredential && form.accessToken ? parseChatGptSession(form.accessToken) : null;
  const typedCredential = typedClaudeCredential || typedChatGptCredential;
  // 手打的 token 直接用；沿用已存的 token 才需要密碼
  const needsPin = !typedCredential && hasExistingToken;

  const applyCodexUsage = (usage: CodexUsageResponse) => {
    const fields = toQuotaFields(usage);
    setForm((current) => ({ ...current, ...fields }));

    const primary = usage.windows.find((window) => window.key === "primary");
    const secondary = usage.windows.find((window) => window.key === "secondary");
    setFailed(false);
    setStatus(
      `已帶入（ChatGPT）：5 小時 ${fields.ratio5h}% 剩餘${
        primary?.resetsAt ? `（重設 ${fields.expiry5h}）` : ""
      }、一週 ${fields.ratioWeek}% 剩餘${
        secondary?.resetsAt ? `（重設 ${fields.expiryWeek}）` : ""
      }、剩餘積分 ${fields.quotaRemaining}${
        fields.resetCreditsBalance > 0
          ? `、重置機會 ${fields.resetCreditsBalance} 次（${fields.resetCreditsExpiry} 前）`
          : ""
      }`
    );
  };

  const applyClaudeUsage = (usage: ClaudeUsageResponse) => {
    const fields = toClaudeQuotaFields(usage);
    // 這次沒讀到的視窗維持原值：填 0 會被存成「已達使用上限」，比留著舊數字更誤導
    setForm((current) => ({
      ...current,
      ...(fields.ratio5h === null ? {} : { ratio5h: fields.ratio5h, expiry5h: fields.expiry5h || "" }),
      ...(fields.ratioWeek === null ? {} : { ratioWeek: fields.ratioWeek, expiryWeek: fields.expiryWeek || "" }),
    }));

    const fiveHour = usage.windows.find((window) => window.key === "five_hour");
    const sevenDay = usage.windows.find((window) => window.key.startsWith("seven_day"));
    const fiveHourText =
      fields.ratio5h === null
        ? "5 小時（這次沒讀到，維持原值）"
        : `5 小時 ${fields.ratio5h}% 剩餘${fiveHour?.resetsAt ? `（重設 ${fields.expiry5h}）` : ""}`;
    const weekText =
      fields.ratioWeek === null
        ? "一週（這次沒讀到，維持原值）"
        : `一週 ${fields.ratioWeek}% 剩餘${sevenDay?.resetsAt ? `（重設 ${fields.expiryWeek}）` : ""}`;

    const nothingRead = fields.ratio5h === null && fields.ratioWeek === null;
    setFailed(nothingRead);
    setStatus(
      nothingRead
        ? "回應裡沒有可用的用量視窗（非公開 API 可能已變動），欄位維持原值。"
        : `已帶入（Claude）：${fiveHourText}、${weekText}（重置機會等欄位 Claude 官方沒提供，仍需手動維護）`
    );
  };

  const fetchCodexUsage = (body: Record<string, unknown>) =>
    fetchApi<CodexUsageResponse>(API_ENDPOINTS.CHATGPT_USAGE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  const fetchClaudeUsage = (body: Record<string, unknown>) =>
    fetchApi<ClaudeUsageResponse>(API_ENDPOINTS.CLAUDE_USAGE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  const handleFetchUsage = async () => {
    if (needsPin && !/^\d{4}$/.test(pin)) {
      setFailed(true);
      setStatus("請輸入四位數密碼");
      return;
    }

    setFetching(true);
    setStatus("");
    setFailed(false);
    try {
      if (typedClaudeCredential) {
        applyClaudeUsage(await fetchClaudeUsage({ accessToken: form.accessToken }));
      } else if (typedChatGptCredential) {
        applyCodexUsage(await fetchCodexUsage({ accessToken: form.accessToken }));
      } else {
        // 已存的 token 看不到明文，猜不出格式；照 /api/quota-refresh 的順序先試 Claude，
        // 對不上格式再退回 ChatGPT（四位數密碼驗證沒有次數限制，兩次都試不影響安全性）。
        try {
          applyClaudeUsage(await fetchClaudeUsage({ quotaId, pin }));
        } catch (err) {
          if (err instanceof Error && err.message === CLAUDE_CREDENTIAL_MISMATCH_ERROR) {
            applyCodexUsage(await fetchCodexUsage({ quotaId, pin }));
          } else {
            throw err;
          }
        }
      }
      setPin("");
    } catch (err) {
      setFailed(true);
      setStatus(err instanceof Error ? err.message : "查詢用量失敗");
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className="sm:col-span-2 xl:col-span-3">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <label htmlFor="quota-access-token" className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <KeyRound className="h-3.5 w-3.5" />
          accessToken（ChatGPT Plus／Claude Code 自動帶入用，選填）
        </label>
        <a
          href="https://chatgpt.com/api/auth/session"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 underline dark:text-blue-400"
        >
          取得 session.json
        </a>
      </div>
      <Textarea
        id="quota-access-token"
        rows={2}
        spellCheck={false}
        className="font-mono text-xs"
        placeholder="貼上 session.json／accessToken（eyJ...），或 Claude 的 ~/.claude/.credentials.json（sk-ant-...）；留空代表不變更"
        value={form.accessToken || ""}
        onChange={(event) =>
          setForm((current) => ({ ...current, accessToken: event.target.value, clearAccessToken: false }))
        }
      />
      {hasPin === false ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-accent/10 px-3 py-2">
          <span className="text-xs text-foreground">
            還沒設定四位數密碼（全站共用），顯示 accessToken 與帶入用量都需要它。
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onOpenPinPanel}
            className="rounded-lg"
          >
            <KeyRound className="mr-1 h-3.5 w-3.5" />
            去鋒兄設定
          </Button>
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {needsPin && hasPin ? (
          <Input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            placeholder="••••"
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
            className="h-9 w-24 text-center tracking-[0.4em]"
            aria-label="四位數密碼"
          />
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleFetchUsage}
          disabled={
            fetching || (!typedCredential && (!hasExistingToken || hasPin === false))
          }
          className="rounded-lg"
        >
          <RefreshCw className={cn("mr-1 h-3.5 w-3.5", fetching && "animate-spin")} />
          {fetching ? "查詢中…" : "帶入用量"}
        </Button>
        {hasExistingToken ? (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={form.clearAccessToken === true}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  clearAccessToken: event.target.checked,
                  accessToken: event.target.checked ? "" : current.accessToken,
                }))
              }
            />
            清除既有 accessToken
          </label>
        ) : null}
      </div>
      <p className={cn("mt-1.5 text-xs", failed ? "text-destructive" : "text-muted-foreground")}>
        {status ||
          (typedClaudeCredential
            ? `已辨識 Claude 憑證（末 4 碼 ${typedClaudeCredential.accessToken.slice(-4)}）${
                typedClaudeCredential.refreshToken ? "，含 refresh token（可自動換新）" : "（沒有 refresh token，過期需手動重貼）"
              }；只會存精簡後的 accessToken／refreshToken／expiresAt。`
            : typedChatGptCredential
              ? `已辨識 ChatGPT token（末 4 碼 ${typedChatGptCredential.accessToken.slice(-4)}）${
                  typedChatGptCredential.accountId ? "，含帳號 ID" : ""
                }；只會存 accessToken 與帳號 ID，不存 sessionToken。`
              : hasExistingToken
                ? hasPin === false
                  ? "已存有 token，但四位數密碼還沒建立；設定後才能顯示明文或帶入用量。"
                  : "已存有 token；輸入四位數密碼即可直接帶入最新用量，或貼上新 token 覆蓋。"
                : "貼上後即可帶入 5 小時／一週剩餘比例與重設時間（Codex 另含剩餘積分／重置機會）。")}
      </p>
    </div>
  );
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

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-xs font-semibold text-muted-foreground xl:hidden">{label}</p>
      {children}
    </div>
  );
}

function ErrorMessage({ children }: { children: React.ReactNode }) {
  return <p role="alert" className="mt-4 rounded-xl bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">{children}</p>;
}
