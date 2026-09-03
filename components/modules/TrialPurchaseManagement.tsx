"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ManagementDeleteDialog } from "@/components/ui/management-delete-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { useManagementCrud } from "@/hooks/useManagementCrud";
import { API_ENDPOINTS } from "@/lib/constants";
import {
  emptyTrialPurchaseForm,
  PURCHASE_STATUS_OPTIONS,
  toTrialPurchaseForm,
  TRIAL_STATUS_OPTIONS,
} from "@/lib/managementRecords";
import type {
  PurchaseStatus,
  TrialPurchase,
  TrialPurchaseFormData,
  TrialStatus,
} from "@/types";

type AttentionFilter = "all" | "untried" | "not_purchased";

interface TrialPurchaseManagementProps {
  onNavigate?: (moduleId: string) => void;
}

interface ServiceGroup {
  key: string;
  name: string;
  items: TrialPurchase[];
}

const moneyFormatter = new Intl.NumberFormat("zh-TW", {
  style: "currency",
  currency: "TWD",
  maximumFractionDigits: 0,
});

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

function trialStatusLabel(status: TrialStatus) {
  return TRIAL_STATUS_OPTIONS.find((option) => option.value === status)?.label || "尚未試用";
}

function purchaseStatusLabel(status: PurchaseStatus) {
  return PURCHASE_STATUS_OPTIONS.find((option) => option.value === status)?.label || "未首購";
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

export default function TrialPurchaseManagement({ onNavigate }: TrialPurchaseManagementProps) {
  const {
    items,
    loading,
    error,
    fetchAll,
    create,
    update,
    remove,
    accountVersion,
  } = useManagementCrud<TrialPurchase>(API_ENDPOINTS.TRIAL_PURCHASE);
  const [query, setQuery] = useState("");
  const [attentionFilter, setAttentionFilter] = useState<AttentionFilter>("all");
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());
  const [collapsedSearchServices, setCollapsedSearchServices] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TrialPurchaseFormData>(() => emptyTrialPurchaseForm());
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TrialPurchase | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyTrialPurchaseForm());
    setActionError(null);
    setExpandedServices(new Set());
    setPendingDelete(null);
  }, [accountVersion]);

  useEffect(() => {
    if (!formOpen) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById("trial-purchase-form")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
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
      const matchesAttention = attentionFilter === "all"
        || (attentionFilter === "untried" && item.trialStatus !== "tried")
        || (attentionFilter === "not_purchased" && item.purchaseStatus === "not_purchased");
      return matchesQuery && matchesAttention;
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
  }, [attentionFilter, items, query]);

  const serviceCount = useMemo(
    () => new Set(items.map((item) => serviceKey(item.name))).size,
    [items],
  );
  const untriedCount = items.filter((item) => item.trialStatus !== "tried").length;
  const notPurchasedCount = items.filter((item) => item.purchaseStatus === "not_purchased").length;
  const pendingCount = items.filter((item) => item.trialStatus !== "tried" || item.purchaseStatus === "not_purchased").length;
  const busy = saving || deletingId !== null;

  const openCreateForm = (name = "") => {
    setEditingId(null);
    setForm(emptyTrialPurchaseForm(name));
    setActionError(null);
    setFormOpen(true);
  };

  const openEditForm = (item: TrialPurchase) => {
    setEditingId(item.$id);
    setForm(toTrialPurchaseForm(item));
    setActionError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyTrialPurchaseForm());
    setActionError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setSaving(true);
    setActionError(null);
    try {
      const result = editingId
        ? await update(editingId, form)
        : await create(form);
      setExpandedServices((current) => new Set(current).add(serviceKey(result.name)));
      closeForm();
    } catch (submitError) {
      setActionError(submitError instanceof Error ? submitError.message : "儲存失敗，請稍後再試。");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: TrialPurchase) => {
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

  return (
    <section className="space-y-6" aria-labelledby="trial-purchase-title">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <h1 id="trial-purchase-title" className="font-display text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">
            鋒兄試用／首購
          </h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            依服務集中追蹤每個帳號的試用、首購與下次重要日期；點擊服務名稱即可展開帳號清單。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void fetchAll()} disabled={loading || busy}>
            <RefreshCw className={loading ? "animate-spin" : ""} />
            重新整理
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
        <SummaryValue
          label="待處理帳號"
          value={pendingCount}
          detail={`${untriedCount} 尚未試用 · ${notPurchasedCount} 未首購`}
          icon={<CircleDollarSign />}
        />
      </div>

      {formOpen ? (
        <form id="trial-purchase-form" onSubmit={handleSubmit} className="surface-raised scroll-mt-28 rounded-2xl p-4 sm:p-6">
          <div>
            <div>
              <h2 className="font-display text-xl font-semibold text-foreground">
                {editingId ? "編輯帳號紀錄" : "新增帳號紀錄"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">同一服務可建立多筆帳號，清單會自動歸在一起。</p>
            </div>
          </div>

          <fieldset disabled={busy} className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <FormField label="服務名稱" htmlFor="trial-service-name" required>
              <Input
                id="trial-service-name"
                maxLength={100}
                list="trial-purchase-services"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="例如 ChatGPT"
                required
                autoFocus
              />
              <datalist id="trial-purchase-services">
                {serviceNames.map((name) => <option key={name} value={name} />)}
              </datalist>
            </FormField>
            <FormField label="帳號" htmlFor="trial-account">
              <Input
                id="trial-account"
                maxLength={200}
                value={form.account || ""}
                onChange={(event) => setForm((current) => ({ ...current, account: event.target.value }))}
                placeholder="Email、使用者名稱或辨識名稱"
              />
            </FormField>
            <FormField label="試用／首購／到期日（扣款日）" htmlFor="trial-event-date">
              <Input
                id="trial-event-date"
                type="date"
                value={form.eventDate || ""}
                onChange={(event) => setForm((current) => ({ ...current, eventDate: event.target.value }))}
              />
            </FormField>
            <FormField label="首購價格（NT$）" htmlFor="trial-first-price">
              <Input
                id="trial-first-price"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={form.firstPurchasePrice}
                onChange={(event) => setForm((current) => ({ ...current, firstPurchasePrice: Number(event.target.value) || 0 }))}
              />
            </FormField>
            <FormField label="非首購價格（NT$）" htmlFor="trial-regular-price">
              <Input
                id="trial-regular-price"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={form.regularPrice}
                onChange={(event) => setForm((current) => ({ ...current, regularPrice: Number(event.target.value) || 0 }))}
              />
            </FormField>
            <FormField label="試用狀態" htmlFor="trial-status">
              <NativeSelect
                id="trial-status"
                value={form.trialStatus}
                onChange={(value) => setForm((current) => ({ ...current, trialStatus: value as TrialStatus }))}
              >
                {TRIAL_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </NativeSelect>
            </FormField>
            <FormField label="首購狀態" htmlFor="purchase-status">
              <NativeSelect
                id="purchase-status"
                value={form.purchaseStatus}
                onChange={(value) => setForm((current) => ({ ...current, purchaseStatus: value as PurchaseStatus }))}
              >
                {PURCHASE_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </NativeSelect>
            </FormField>
            <FormField label="備註" htmlFor="trial-note" className="sm:col-span-2 xl:col-span-2">
              <Textarea
                id="trial-note"
                maxLength={3337}
                value={form.note || ""}
                onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                placeholder="方案限制、付款方式或其他提醒"
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
          <span className="sr-only">待處理狀態</span>
          <NativeSelect id="trial-attention-filter" value={attentionFilter} onChange={(value) => setAttentionFilter(value as AttentionFilter)}>
            <option value="all">全部狀態</option>
            <option value="untried">尚未試用</option>
            <option value="not_purchased">未首購</option>
          </NativeSelect>
        </label>
      </div>

      {error ? (
        <div role="alert" className="rounded-2xl border border-destructive/25 bg-destructive/8 p-4 text-sm text-destructive">
          <p className="font-semibold">無法載入試用／首購資料</p>
          <p className="mt-1 leading-6">{error}</p>
          {onNavigate && error.includes("trialpurchase") ? (
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => onNavigate("settings")}>前往鋒兄設定</Button>
          ) : null}
        </div>
      ) : null}
      {!formOpen && actionError ? <ErrorMessage>{actionError}</ErrorMessage> : null}

      {loading && items.length === 0 ? (
        <LoadingSpinner text="載入試用／首購資料…" className="min-h-48" />
      ) : error && items.length === 0 ? null : groups.length === 0 ? (
        <EmptyState
          icon={<Users className="size-7 text-muted-foreground" />}
          title={items.length === 0 ? "尚無試用／首購紀錄" : "沒有符合條件的帳號"}
          description={items.length === 0 ? "先新增第一個服務與帳號，之後可在服務底下持續加入帳號。" : "調整搜尋文字或狀態篩選後再試一次。"}
          action={items.length === 0 ? <Button type="button" onClick={() => openCreateForm()}><Plus />新增第一筆</Button> : undefined}
        />
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const isOpen = query.trim() ? !collapsedSearchServices.has(group.key) : expandedServices.has(group.key);
            const groupUntried = group.items.filter((item) => item.trialStatus !== "tried").length;
            const groupUnpurchased = group.items.filter((item) => item.purchaseStatus === "not_purchased").length;
            return (
              <section key={group.key} className="surface-inset overflow-hidden rounded-2xl">
                <div className="flex items-center gap-2 p-3 sm:p-4">
                  <button
                    type="button"
                    onClick={() => toggleService(group.key)}
                    aria-expanded={isOpen}
                    aria-controls={`trial-accounts-${encodeURIComponent(group.key)}`}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left outline-none transition-colors hover:bg-accent/10 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent-strong">
                      <Users className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-lg font-semibold text-foreground">{group.name}</span>
                      <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span>{group.items.length} 個帳號</span>
                        {groupUntried > 0 ? <span>{groupUntried} 尚未試用</span> : null}
                        {groupUnpurchased > 0 ? <span>{groupUnpurchased} 未首購</span> : null}
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
                  <div id={`trial-accounts-${encodeURIComponent(group.key)}`} className="border-t border-[var(--line-soft)]">
                    <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,.9fr)_minmax(0,.9fr)_minmax(0,1.2fr)_minmax(0,1fr)_88px] gap-4 border-b border-[var(--line-soft)] px-5 py-2 text-xs font-semibold text-muted-foreground xl:grid">
                      <span>帳號</span><span>重要日期</span><span>價格</span><span>狀態</span><span>備註</span><span>操作</span>
                    </div>
                    <div className="divide-y divide-[var(--line-soft)]">
                      {group.items.map((item) => (
                        <div key={item.$id} className="grid gap-4 px-4 py-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,.9fr)_minmax(0,.9fr)_minmax(0,1.2fr)_minmax(0,1fr)_88px] xl:items-center xl:px-5">
                          <Cell label="帳號"><span className="break-all font-medium text-foreground">{item.account?.trim() || "未填帳號"}</span></Cell>
                          <Cell label="重要日期"><span className="inline-flex items-center gap-2 text-sm text-foreground"><CalendarDays className="size-4 text-muted-foreground" />{formatDate(item.eventDate)}</span></Cell>
                          <Cell label="價格">
                            <div className="space-y-1 text-sm tabular-nums">
                              <p><span className="text-muted-foreground">首購 </span>{moneyFormatter.format(item.firstPurchasePrice || 0)}</p>
                              <p><span className="text-muted-foreground">一般 </span>{moneyFormatter.format(item.regularPrice || 0)}</p>
                            </div>
                          </Cell>
                          <Cell label="狀態">
                            <div className="flex flex-wrap gap-1.5">
                              <StatusBadge status={item.trialStatus === "tried" ? "success" : "warning"}>{trialStatusLabel(item.trialStatus)}</StatusBadge>
                              <StatusBadge status={item.purchaseStatus === "purchased" ? "success" : item.purchaseStatus === "unavailable" ? "normal" : "warning"}>{purchaseStatusLabel(item.purchaseStatus)}</StatusBadge>
                            </div>
                          </Cell>
                          <Cell label="備註"><p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{item.note?.trim() || "—"}</p></Cell>
                          <div className="flex items-center justify-end gap-1 xl:justify-start">
                            <Button type="button" variant="ghost" size="icon" onClick={() => openEditForm(item)} disabled={busy || loading} aria-label={`編輯 ${group.name} ${item.account || "帳號"}`}><Pencil /></Button>
                            <Button type="button" variant="ghost" size="icon" onClick={() => { setActionError(null); setPendingDelete(item); }} disabled={busy || loading} aria-label={`刪除 ${group.name} ${item.account || "帳號"}`} className="text-destructive hover:text-destructive"><Trash2 /></Button>
                          </div>
                        </div>
                      ))}
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
    </section>
  );
}

function SummaryValue({ label, value, detail, icon }: { label: string; value: number; detail?: string; icon: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-2 px-3 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-5 sm:py-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent-strong sm:size-10 [&_svg]:size-4 sm:[&_svg]:size-5">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
        {detail ? <p className="hidden truncate text-xs text-muted-foreground sm:block">{detail}</p> : null}
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
