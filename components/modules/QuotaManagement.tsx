"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Bot,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ManagementDeleteDialog } from "@/components/ui/management-delete-dialog";
import { Textarea } from "@/components/ui/textarea";
import { fetchApi } from "@/hooks/useApi";
import { useManagementCrud } from "@/hooks/useManagementCrud";
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
import { getExportFilename } from "@/lib/utils";
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
  const csvInputRef = useRef<HTMLInputElement>(null);
  const importCloseTimer = useRef<number | null>(null);
  const [importPreview, setImportPreview] = useState<{ data: QuotaFormData[]; errors: string[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importResult, setImportResult] = useState<{ successCount: number; failCount: number } | null>(null);

  useEffect(() => {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyQuotaForm());
    setActionError(null);
    setExpandedServices(new Set());
    setPendingDelete(null);
    setImportPreview(null);
    setImportResult(null);
    setImporting(false);
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

    return [...grouped.values()]
      .map((group) => ({
        ...group,
        items: group.items.sort((a, b) =>
          String(a.account || "").localeCompare(String(b.account || ""), "zh-Hant"),
        ),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
  }, [items, query, typeFilter]);

  const serviceCount = useMemo(
    () => new Set(items.map((item) => serviceKey(item.name))).size,
    [items],
  );
  const aiCount = items.filter((item) => item.serviceType === "ai").length;
  const busy = saving || deletingId !== null || importing;

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
                    <div className="hidden grid-cols-[minmax(0,1.1fr)_minmax(8rem,1fr)_minmax(8rem,1.2fr)_minmax(0,.8fr)_minmax(0,1fr)_136px] gap-4 border-b border-[var(--line-soft)] px-5 py-2 text-xs font-semibold leading-5 text-muted-foreground xl:grid">
                      <span>帳號</span><span>剩餘額度</span><span>到期</span><span>類型</span><span>備註</span><span>操作</span>
                    </div>
                    <div className="divide-y divide-[var(--line-soft)]">
                      {group.items.map((item) => {
                        const basicRatio = ratioLabel(item.quotaRatio);
                        const aiPlans = item.serviceType === "ai"
                          ? [
                              { key: "5h", prefix: "5 小時", ratio: ratioLabel(item.ratio5h), expiry: item.expiry5h },
                              { key: "week", prefix: "一週", ratio: ratioLabel(item.ratioWeek), expiry: item.expiryWeek },
                              { key: "month", prefix: "一月", ratio: ratioLabel(item.ratioMonth), expiry: item.expiryMonth },
                            ]
                          : [];
                        return (
                          <div key={item.$id} className="grid gap-4 px-4 py-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.1fr)_minmax(8rem,1fr)_minmax(8rem,1.2fr)_minmax(0,.8fr)_minmax(0,1fr)_136px] xl:items-start xl:px-5">
                            <Cell label="帳號"><span className="break-all font-medium text-foreground">{item.account?.trim() || "未填帳號"}</span></Cell>
                            <Cell label="剩餘額度">
                              <div className="space-y-1 text-sm tabular-nums text-foreground">
                                <p>{item.quotaRemaining} 次</p>
                                {basicRatio ? <p><span className="text-muted-foreground">比例 </span>{basicRatio}</p> : null}
                              </div>
                            </Cell>
                            <Cell label="到期">
                              <div className="space-y-1.5">
                                <p className="inline-flex items-center gap-2 text-sm text-foreground"><CalendarDays className="size-4 shrink-0 text-muted-foreground" />{formatDate(item.quotaExpiry)}</p>
                                {aiPlans.length > 0 ? (
                                  <div className="flex flex-wrap gap-1.5">
                                    {aiPlans.map((plan) => plan.ratio || plan.expiry ? (
                                      <span key={plan.key} className="rounded-full bg-accent/12 px-2 py-0.5 text-xs text-foreground">
                                        {plan.prefix} {plan.ratio ?? ""}{plan.ratio && plan.expiry ? " · " : ""}{plan.expiry ?? ""}
                                      </span>
                                    ) : null)}
                                  </div>
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
