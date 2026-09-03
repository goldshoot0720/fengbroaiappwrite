"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Laptop,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ManagementDeleteDialog } from "@/components/ui/management-delete-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { fetchApi } from "@/hooks/useApi";
import { useManagementCrud } from "@/hooks/useManagementCrud";
import { API_ENDPOINTS } from "@/lib/constants";
import { buildReinstallCsv, parseReinstallCsv, reinstallImportKey } from "@/lib/reinstallCsv";
import { getExportFilename } from "@/lib/utils";
import { formatCurrencyWithExchange } from "@/lib/formatters";
import {
  emptyReinstallSoftwareForm,
  matchesReinstallViewPassword,
  REINSTALL_CURRENCY_OPTIONS,
  REINSTALL_LICENSE_TYPE_OPTIONS,
  REINSTALL_PERIOD_UNIT_OPTIONS,
  REINSTALL_SOFTWARE_TYPE_OPTIONS,
  REINSTALL_SYSTEM_OPTIONS,
  reinstallSubscriptionPeriodLabel,
  safeSoftwareUrl,
  toReinstallSoftwareForm,
} from "@/lib/managementRecords";
import type {
  ReinstallLicenseType,
  ReinstallSoftware,
  ReinstallSoftwareFormData,
  ReinstallSoftwareType,
  ReinstallSubscriptionCurrency,
  ReinstallSubscriptionPeriodUnit,
  ReinstallSystem,
} from "@/types";

type SystemFilter = "all" | ReinstallSystem;
type SoftwareFilter = "all" | ReinstallSoftwareType;
type SubscriptionFilter = "all" | "yes" | "no";

interface ReinstallManagementProps {
  onNavigate?: (moduleId: string) => void;
}

function optionLabel<T extends string>(
  options: ReadonlyArray<{ value: T; label: string }>,
  value: T,
) {
  return options.find((option) => option.value === value)?.label || value;
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

export default function ReinstallManagement({ onNavigate }: ReinstallManagementProps) {
  const {
    items,
    loading,
    error,
    fetchAll,
    create,
    update,
    remove,
    accountVersion,
  } = useManagementCrud<ReinstallSoftware>(API_ENDPOINTS.REINSTALL);
  const [query, setQuery] = useState("");
  const [systemFilter, setSystemFilter] = useState<SystemFilter>("all");
  const [softwareFilter, setSoftwareFilter] = useState<SoftwareFilter>("all");
  const [subscriptionFilter, setSubscriptionFilter] = useState<SubscriptionFilter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ReinstallSoftwareFormData>(() => emptyReinstallSoftwareForm());
  const [showFormSerial, setShowFormSerial] = useState(false);
  const [showFormViewPassword, setShowFormViewPassword] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ReinstallSoftware | null>(null);
  const [pendingReveal, setPendingReveal] = useState<ReinstallSoftware | null>(null);
  const [revealPassword, setRevealPassword] = useState("");
  const [revealError, setRevealError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const revealInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const importCloseTimer = useRef<number | null>(null);
  const [importPreview, setImportPreview] = useState<{ data: ReinstallSoftwareFormData[]; errors: string[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importResult, setImportResult] = useState<{ successCount: number; failCount: number } | null>(null);

  useEffect(() => {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyReinstallSoftwareForm());
    setShowFormSerial(false);
    setShowFormViewPassword(false);
    setRevealedIds(new Set());
    setActionError(null);
    setPendingDelete(null);
    setPendingReveal(null);
    setRevealPassword("");
    setRevealError(null);
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
      document.getElementById("reinstall-form")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [editingId, formOpen]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-Hant");
    return items
      .filter((item) => {
        const matchesQuery = !normalizedQuery || [item.name, item.site, item.note]
          .some((value) => String(value || "").toLocaleLowerCase("zh-Hant").includes(normalizedQuery));
        const matchesSystem = systemFilter === "all" || item.system === systemFilter;
        const matchesSoftware = softwareFilter === "all" || item.softwareType === softwareFilter;
        const matchesSubscription = subscriptionFilter === "all"
          || (subscriptionFilter === "yes" && item.subscriptionSoftware)
          || (subscriptionFilter === "no" && !item.subscriptionSoftware);
        return matchesQuery && matchesSystem && matchesSoftware && matchesSubscription;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
  }, [items, query, softwareFilter, subscriptionFilter, systemFilter]);

  const windowsCount = items.filter((item) => item.system === "win").length;
  const macCount = items.filter((item) => item.system === "mac").length;
  const serialCount = items.filter((item) => item.licenseType === "paid_serial").length;
  const busy = saving || deletingId !== null || importing;

  const refresh = () => {
    setRevealedIds(new Set());
    setShowFormSerial(false);
    setShowFormViewPassword(false);
    setPendingReveal(null);
    void fetchAll();
  };

  const openCreateForm = () => {
    setEditingId(null);
    setForm(emptyReinstallSoftwareForm());
    setShowFormSerial(false);
    setShowFormViewPassword(false);
    setActionError(null);
    setFormOpen(true);
  };

  const openEditForm = (item: ReinstallSoftware) => {
    setEditingId(item.$id);
    setForm(toReinstallSoftwareForm(item));
    setShowFormSerial(false);
    setShowFormViewPassword(false);
    setActionError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyReinstallSoftwareForm());
    setShowFormSerial(false);
    setShowFormViewPassword(false);
    setActionError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setSaving(true);
    setActionError(null);
    try {
      const payload = form.licenseType === "none" ? { ...form, serial: "", viewPassword: "" } : form;
      if (editingId) await update(editingId, payload);
      else await create(payload);
      setRevealedIds(new Set());
      closeForm();
    } catch (submitError) {
      setActionError(submitError instanceof Error ? submitError.message : "儲存失敗，請稍後再試。");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: ReinstallSoftware) => {
    if (busy) return;
    setDeletingId(item.$id);
    setActionError(null);
    try {
      await remove(item.$id);
      setPendingDelete(null);
      if (editingId === item.$id) closeForm();
      setRevealedIds((current) => {
        const next = new Set(current);
        next.delete(item.$id);
        return next;
      });
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : "刪除失敗，請確認連線後再試一次。");
    } finally {
      setDeletingId(null);
    }
  };

  const hideSerial = (id: string) => {
    setRevealedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  };

  const revealSerial = (id: string) => {
    setRevealedIds((current) => new Set(current).add(id));
  };

  const requestRevealSerial = (item: ReinstallSoftware) => {
    if (revealedIds.has(item.$id)) {
      hideSerial(item.$id);
      return;
    }
    if ((item.viewPassword || "").trim()) {
      setPendingReveal(item);
      setRevealPassword("");
      setRevealError(null);
      return;
    }
    revealSerial(item.$id);
  };

  const closeRevealDialog = () => {
    setPendingReveal(null);
    setRevealPassword("");
    setRevealError(null);
  };

  const confirmRevealSerial = () => {
    if (!pendingReveal) return;
    if (!matchesReinstallViewPassword(pendingReveal.viewPassword, revealPassword)) {
      setRevealError("查看密碼不正確");
      return;
    }
    revealSerial(pendingReveal.$id);
    closeRevealDialog();
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
      const csv = buildReinstallCsv(items);
      const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = getExportFilename("reinstall");
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
      setImportPreview(parseReinstallCsv(text));
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
    const index = new Map(items.map((item) => [reinstallImportKey(item), item.$id]));

    for (let i = 0; i < importPreview.data.length; i++) {
      const formData = importPreview.data[i];
      setImportProgress({ current: i + 1, total: importPreview.data.length });
      try {
        const key = reinstallImportKey(formData);
        const existingId = index.get(key);
        if (existingId) {
          await fetchApi(`${API_ENDPOINTS.REINSTALL}/${encodeURIComponent(existingId)}`, {
            method: "PUT",
            body: JSON.stringify(formData),
          });
        } else {
          const created = await fetchApi<ReinstallSoftware>(API_ENDPOINTS.REINSTALL, {
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

  return (
    <section className="space-y-6" aria-labelledby="reinstall-title">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <h1 id="reinstall-title" className="font-display text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">
            鋒兄重灌
          </h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            整理 Windows 與 Mac 重灌時需要的軟體、網站和授權資訊；付費序號預設保持隱藏，可另設查看密碼。訂閱制軟體可記下週期與費用。可用 CSV 匯出備份或批次匯入。
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
          <Button type="button" variant="outline" onClick={refresh} disabled={loading || busy}>
            <RefreshCw className={loading ? "animate-spin" : ""} />
            重新整理
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => csvInputRef.current?.click()}
            disabled={loading || busy}
            title="從 CSV 匯入重灌軟體（相同服務名稱與系統會更新）"
          >
            <Upload />
            匯入 CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={exportToCsv}
            disabled={busy}
            title="匯出目前全部重灌軟體為 CSV（含序號與查看密碼）"
          >
            <Download />
            匯出 CSV
          </Button>
          <Button type="button" onClick={openCreateForm} disabled={loading || busy}>
            <Plus />
            新增軟體
          </Button>
        </div>
      </header>

      <div className="surface-inset grid grid-cols-2 overflow-hidden rounded-2xl sm:grid-cols-4 sm:divide-x sm:divide-[var(--line-soft)]">
        <SummaryValue label="全部軟體" value={items.length} icon={<Laptop />} />
        <SummaryValue label="Windows" value={windowsCount} icon={<Laptop />} />
        <SummaryValue label="Mac" value={macCount} icon={<Laptop />} />
        <SummaryValue label="付費序號" value={serialCount} icon={<KeyRound />} />
      </div>

      {formOpen ? (
        <form id="reinstall-form" onSubmit={handleSubmit} className="surface-raised scroll-mt-28 rounded-2xl p-4 sm:p-6">
          <div>
            <div>
              <h2 className="font-display text-xl font-semibold text-foreground">
                {editingId ? "編輯重灌軟體" : "新增重灌軟體"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">儲存安裝時真正需要找到的資訊。付費序號與查看密碼都不會預設攤開。</p>
            </div>
          </div>

          <fieldset disabled={busy} className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <FormField label="服務名稱" htmlFor="reinstall-name" required>
              <Input
                id="reinstall-name"
                maxLength={100}
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="例如 7-Zip、Adobe Acrobat"
                required
                autoFocus
              />
            </FormField>
            <FormField label="使用系統" htmlFor="reinstall-system">
              <NativeSelect id="reinstall-system" value={form.system} onChange={(value) => setForm((current) => ({ ...current, system: value as ReinstallSystem }))}>
                {REINSTALL_SYSTEM_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </NativeSelect>
            </FormField>
            <FormField label="軟體類型" htmlFor="reinstall-software-type">
              <NativeSelect id="reinstall-software-type" value={form.softwareType} onChange={(value) => setForm((current) => ({ ...current, softwareType: value as ReinstallSoftwareType }))}>
                {REINSTALL_SOFTWARE_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </NativeSelect>
            </FormField>
            <FormField label="訂閱制軟體" htmlFor="reinstall-subscription">
              <NativeSelect
                id="reinstall-subscription"
                value={form.subscriptionSoftware ? "yes" : "no"}
                onChange={(value) => setForm((current) => ({ ...current, subscriptionSoftware: value === "yes" }))}
              >
                <option value="no">否</option>
                <option value="yes">是</option>
              </NativeSelect>
            </FormField>
            {form.subscriptionSoftware ? (
              <>
                <FormField label="訂閱週期" htmlFor="reinstall-subscription-period">
                  <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
                    <Input
                      id="reinstall-subscription-period"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      value={form.subscriptionPeriodCount}
                      onChange={(event) => setForm((current) => ({ ...current, subscriptionPeriodCount: Number(event.target.value) || 0 }))}
                    />
                    <NativeSelect
                      id="reinstall-subscription-period-unit"
                      value={form.subscriptionPeriodUnit}
                      onChange={(value) => setForm((current) => ({ ...current, subscriptionPeriodUnit: value as ReinstallSubscriptionPeriodUnit }))}
                    >
                      {REINSTALL_PERIOD_UNIT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </NativeSelect>
                  </div>
                </FormField>
                <FormField label="訂閱費用" htmlFor="reinstall-subscription-price">
                  <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-2">
                    <Input
                      id="reinstall-subscription-price"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      value={form.subscriptionPrice}
                      onChange={(event) => setForm((current) => ({ ...current, subscriptionPrice: Number(event.target.value) || 0 }))}
                    />
                    <NativeSelect
                      id="reinstall-subscription-currency"
                      value={form.subscriptionCurrency}
                      onChange={(value) => setForm((current) => ({ ...current, subscriptionCurrency: value as ReinstallSubscriptionCurrency }))}
                    >
                      {REINSTALL_CURRENCY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </NativeSelect>
                  </div>
                </FormField>
              </>
            ) : null}
            <FormField label="授權方式" htmlFor="reinstall-license-type">
              <NativeSelect
                id="reinstall-license-type"
                value={form.licenseType}
                onChange={(value) => {
                  const licenseType = value as ReinstallLicenseType;
                  setForm((current) => ({
                    ...current,
                    licenseType,
                    serial: licenseType === "none" ? "" : current.serial,
                    viewPassword: licenseType === "none" ? "" : current.viewPassword,
                  }));
                  setShowFormSerial(false);
                  setShowFormViewPassword(false);
                }}
              >
                {REINSTALL_LICENSE_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </NativeSelect>
            </FormField>
            {form.licenseType === "paid_serial" ? (
              <>
                <FormField label="付費序號" htmlFor="reinstall-serial">
                  <SecretInput
                    id="reinstall-serial"
                    maxLength={500}
                    value={form.serial || ""}
                    visible={showFormSerial}
                    onChange={(value) => setForm((current) => ({ ...current, serial: value }))}
                    onToggleVisible={() => setShowFormSerial((visible) => !visible)}
                    placeholder="輸入序號"
                    showLabel="顯示付費序號"
                    hideLabel="隱藏付費序號"
                  />
                </FormField>
                <FormField label="查看密碼" htmlFor="reinstall-view-password">
                  <SecretInput
                    id="reinstall-view-password"
                    maxLength={100}
                    value={form.viewPassword || ""}
                    visible={showFormViewPassword}
                    onChange={(value) => setForm((current) => ({ ...current, viewPassword: value }))}
                    onToggleVisible={() => setShowFormViewPassword((visible) => !visible)}
                    placeholder="選填，清單顯示序號時需輸入"
                    showLabel="顯示查看密碼"
                    hideLabel="隱藏查看密碼"
                  />
                </FormField>
              </>
            ) : null}
            <FormField label="軟體網站" htmlFor="reinstall-site">
              <Input
                id="reinstall-site"
                maxLength={2000}
                type="url"
                value={form.site || ""}
                onChange={(event) => setForm((current) => ({ ...current, site: event.target.value }))}
                placeholder="https://example.com"
              />
            </FormField>
            <FormField label="備註" htmlFor="reinstall-note" className="sm:col-span-2 xl:col-span-3">
              <Textarea
                id="reinstall-note"
                maxLength={3337}
                value={form.note || ""}
                onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                placeholder="安裝順序、登入方式、下載版本或其他提醒"
              />
            </FormField>
          </fieldset>

          {actionError ? <ErrorMessage>{actionError}</ErrorMessage> : null}
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeForm} disabled={saving}>取消</Button>
            <Button type="submit" disabled={busy}>
              {saving ? <RefreshCw className="animate-spin" /> : null}
              {saving ? "儲存中…" : editingId ? "儲存變更" : "新增軟體"}
            </Button>
          </div>
        </form>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_160px_160px]">
        <label className="relative min-w-0">
          <span className="sr-only">搜尋服務、網站或備註</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="搜尋服務、網站或備註" />
        </label>
        <label>
          <span className="sr-only">篩選使用系統</span>
          <NativeSelect id="reinstall-system-filter" value={systemFilter} onChange={(value) => setSystemFilter(value as SystemFilter)}>
            <option value="all">全部系統</option>
            {REINSTALL_SYSTEM_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </NativeSelect>
        </label>
        <label>
          <span className="sr-only">篩選軟體類型</span>
          <NativeSelect id="reinstall-software-filter" value={softwareFilter} onChange={(value) => setSoftwareFilter(value as SoftwareFilter)}>
            <option value="all">全部軟體類型</option>
            {REINSTALL_SOFTWARE_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </NativeSelect>
        </label>
        <label>
          <span className="sr-only">篩選訂閱制</span>
          <NativeSelect id="reinstall-subscription-filter" value={subscriptionFilter} onChange={(value) => setSubscriptionFilter(value as SubscriptionFilter)}>
            <option value="all">全部訂閱狀態</option>
            <option value="yes">訂閱制</option>
            <option value="no">非訂閱制</option>
          </NativeSelect>
        </label>
      </div>

      {error ? (
        <div role="alert" className="rounded-2xl border border-destructive/25 bg-destructive/8 p-4 text-sm text-destructive">
          <p className="font-semibold">無法載入重灌資料</p>
          <p className="mt-1 leading-6">{error}</p>
          {onNavigate && error.includes("reinstall") ? (
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => onNavigate("settings")}>前往鋒兄設定</Button>
          ) : null}
        </div>
      ) : null}
      {!formOpen && actionError ? <ErrorMessage>{actionError}</ErrorMessage> : null}

      {loading && items.length === 0 ? (
        <LoadingSpinner text="載入重灌清單…" className="min-h-48" />
      ) : error && items.length === 0 ? null : filteredItems.length === 0 ? (
        <EmptyState
          icon={<Laptop className="size-7 text-muted-foreground" />}
          title={items.length === 0 ? "尚無重灌軟體" : "沒有符合條件的軟體"}
          description={items.length === 0 ? "先加入第一套軟體，建立下一次重灌可以照著走的清單。" : "調整搜尋文字、系統或軟體類型後再試一次。"}
          action={items.length === 0 ? <Button type="button" onClick={openCreateForm}><Plus />新增第一套</Button> : undefined}
        />
      ) : (
        <div className="surface-inset overflow-hidden rounded-2xl">
          <div className="hidden grid-cols-[minmax(0,1.1fr)_70px_100px_minmax(0,1.3fr)_minmax(0,1fr)_88px] gap-4 border-b border-[var(--line-soft)] px-5 py-3 text-xs font-semibold text-muted-foreground xl:grid">
            <span>服務名稱</span><span>系統</span><span>軟體類型</span><span>序號</span><span>網站／備註</span><span>操作</span>
          </div>
          <div className="divide-y divide-[var(--line-soft)]">
            {filteredItems.map((item) => {
              const serialRevealed = revealedIds.has(item.$id);
              const hasSerial = item.licenseType === "paid_serial";
              const website = safeSoftwareUrl(item.site);
              return (
                <article key={item.$id} className="grid gap-4 px-4 py-5 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.1fr)_70px_100px_minmax(0,1.3fr)_minmax(0,1fr)_88px] xl:items-center xl:px-5">
                  <Cell label="服務名稱"><h2 className="break-words font-semibold text-foreground">{item.name}</h2></Cell>
                  <Cell label="系統"><StatusBadge status="info">{optionLabel(REINSTALL_SYSTEM_OPTIONS, item.system)}</StatusBadge></Cell>
                  <Cell label="軟體類型">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap gap-1.5">
                        <StatusBadge status={item.softwareType === "free" ? "success" : item.softwareType === "trial" ? "warning" : "info"}>
                          {optionLabel(REINSTALL_SOFTWARE_TYPE_OPTIONS, item.softwareType)}
                        </StatusBadge>
                        {item.subscriptionSoftware ? <StatusBadge status="warning">訂閱制</StatusBadge> : null}
                      </div>
                      {item.subscriptionSoftware ? (
                        <p className="text-sm tabular-nums text-muted-foreground">
                          {reinstallSubscriptionPeriodLabel(item.subscriptionPeriod)} · {formatCurrencyWithExchange(item.subscriptionPrice, item.subscriptionCurrency || "TWD")}
                        </p>
                      ) : null}
                    </div>
                  </Cell>
                  <Cell label="序號">
                    {hasSerial ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge status="warning">付費序號</StatusBadge>
                          {item.viewPassword?.trim() ? <StatusBadge status="info">需查看密碼</StatusBadge> : null}
                        </div>
                        <div className="flex min-w-0 items-center gap-2">
                          <code className="min-w-0 flex-1 break-all rounded-lg bg-background/60 px-2 py-1 text-sm text-foreground">
                            {item.serial ? (serialRevealed ? item.serial : "•••• •••• ••••") : "尚未填序號"}
                          </code>
                          {item.serial ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="shrink-0"
                              onClick={() => requestRevealSerial(item)}
                              aria-label={serialRevealed ? `隱藏 ${item.name} 序號` : `顯示 ${item.name} 序號`}
                              aria-pressed={serialRevealed}
                            >
                              {serialRevealed ? <EyeOff /> : <Eye />}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ) : <StatusBadge status="normal">無序號</StatusBadge>}
                  </Cell>
                  <Cell label="網站／備註">
                    <div className="space-y-1.5">
                      {website ? (
                        <a href={website} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-accent-strong underline-offset-4 hover:underline">
                          開啟網站 <ExternalLink className="size-3.5" />
                        </a>
                      ) : <span className="text-sm text-muted-foreground">未填網站</span>}
                      <p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{item.note?.trim() || "—"}</p>
                    </div>
                  </Cell>
                  <div className="flex items-center justify-end gap-1 xl:justify-start">
                    <Button type="button" variant="ghost" size="icon" onClick={() => openEditForm(item)} disabled={busy || loading} aria-label={`編輯 ${item.name}`}><Pencil /></Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => { setActionError(null); setPendingDelete(item); }} disabled={busy || loading} aria-label={`刪除 ${item.name}`} className="text-destructive hover:text-destructive"><Trash2 /></Button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      <p className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
        付費序號只在你主動點擊眼睛按鈕後顯示；若有設定查看密碼，需先輸入正確密碼。切換頁面後會再次隱藏。這只是畫面遮罩，不是加密保管庫。CSV 匯出會包含序號與查看密碼，請妥善保管檔案。
      </p>
      <Dialog.Root open={pendingReveal !== null} onOpenChange={(open) => { if (!open) closeRevealDialog(); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[120] bg-foreground/35" />
          <Dialog.Content
            className="surface-raised fixed left-1/2 top-1/2 z-[121] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 outline-none"
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              revealInputRef.current?.focus();
            }}
          >
            <Dialog.Title className="font-display text-xl font-semibold text-foreground">輸入查看密碼</Dialog.Title>
            <Dialog.Description className="mt-3 text-sm leading-7 text-muted-foreground">
              顯示「{pendingReveal?.name}」的付費序號前，請輸入這筆紀錄的查看密碼。
            </Dialog.Description>
            <form
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                confirmRevealSerial();
              }}
            >
              <FormField label="查看密碼" htmlFor="reinstall-reveal-password">
                <Input
                  ref={revealInputRef}
                  id="reinstall-reveal-password"
                  type="password"
                  value={revealPassword}
                  onChange={(event) => {
                    setRevealPassword(event.target.value);
                    setRevealError(null);
                  }}
                  autoComplete="off"
                  placeholder="輸入查看密碼"
                />
              </FormField>
              {revealError ? <p role="alert" className="text-sm font-medium text-destructive">{revealError}</p> : null}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeRevealDialog}>取消</Button>
                <Button type="submit">顯示序號</Button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <ManagementDeleteDialog
        open={pendingDelete !== null}
        recordName={pendingDelete ? `${pendingDelete.name}／${optionLabel(REINSTALL_SYSTEM_OPTIONS, pendingDelete.system)}` : ""}
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
            aria-labelledby="reinstall-csv-import-title"
            className="surface-raised flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl"
          >
            <div className="border-b border-[var(--line-soft)] p-5 sm:p-6">
              <h2 id="reinstall-csv-import-title" className="font-display text-xl font-semibold text-foreground">
                匯入 CSV 預覽
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                相同服務名稱與使用系統會更新既有紀錄，其餘新增。有格式錯誤時不會寫入。檔案含序號與查看密碼。
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
                    const existing = items.some((current) => reinstallImportKey(current) === reinstallImportKey(item));
                    return (
                      <div key={`${item.name}-${item.system}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-accent/8 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{item.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{optionLabel(REINSTALL_SYSTEM_OPTIONS, item.system)}</p>
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

function SecretInput({
  id,
  value,
  visible,
  onChange,
  onToggleVisible,
  placeholder,
  maxLength,
  showLabel,
  hideLabel,
}: {
  id: string;
  value: string;
  visible: boolean;
  onChange: (value: string) => void;
  onToggleVisible: () => void;
  placeholder: string;
  maxLength: number;
  showLabel: string;
  hideLabel: string;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        maxLength={maxLength}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="pr-11 font-mono"
        autoComplete="off"
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={onToggleVisible}
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
        className="absolute right-0 top-0 flex size-10 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-accent/10 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function SummaryValue({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-4 sm:px-5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent-strong [&_svg]:size-5">{icon}</span>
      <div>
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
