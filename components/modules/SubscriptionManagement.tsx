"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { AlertTriangle, ArchiveRestore, CheckSquare, ChevronDown, ChevronUp, Copy, Download, ExternalLink, Pencil, Plus, RefreshCw, Search, SearchX, Square, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataCard } from "@/components/ui/data-card";
import { EmptyState } from "@/components/ui/empty-state";
import { FullPageLoading } from "@/components/ui/loading-spinner";
import { FriendlyAiCrudShell } from "@/components/ui/friendly-ai-crud-shell";
import { VoiceCommandBar } from "@/components/ui/voice-command-bar";
import { FaviconImage } from "@/components/ui/favicon-image";
import { useSubscriptions, getSubscriptionExpiryInfo } from "@/hooks/useSubscriptions";
import { fetchApi } from "@/hooks/useApi";
import { playVoiceSuccessTone, useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { API_ENDPOINTS } from "@/lib/constants";
import { shouldAutoExecuteVoiceRisk } from "@/lib/voicePreferences";
import {
  convertToTWD,
  CURRENCY_OPTIONS,
  formatCurrency,
  formatCurrencyWithExchange,
  formatDate,
  getCurrencySymbol,
} from "@/lib/formatters";
import { getAppwriteConfig, getCurrentAccountLabel, getExportFilename } from "@/lib/utils";
import {
  SUBSCRIPTION_CSV_HEADERS,
  detectSubscriptionCsvMode,
  emptySubscriptionForm,
  parseSubscriptionCsvRow,
  subscriptionFormToCsvValues,
  toSubscriptionForm,
} from "@/lib/subscriptionFields";
import {
  activateSubscriptionSimilarityView,
  buildSimilarSubscriptionMatches,
  restoreSubscriptionSimilarityView,
  type ActiveSubscriptionSimilarityView,
  type SubscriptionSimilarityMatch,
  type SubscriptionSimilarityViewState,
} from "@/lib/subscriptionSimilarity";
import { subscriptionMatchesSearch, type SubscriptionSearchScope } from "@/lib/subscriptionSearch";
import { Subscription, SubscriptionFormData } from "@/types";

const INITIAL_FORM: SubscriptionFormData = emptySubscriptionForm();

const SUBSCRIPTION_TABLE_COL_SPAN = 5;

/** 「加入銀行」下拉選單的銀行選項 */
const BANK_OPTIONS = ["台新銀行", "中國信託", "玉山銀行", "台北富邦", "國泰世華"];

/** 「加入付款平台」下拉選單的平台選項 */
const PAYMENT_PLATFORM_OPTIONS = ["PayPal", "Google Play"];

/** 列表用價格：0 不顯示；非台幣第一列原幣、第二列換算台幣 */
function SubscriptionPriceDisplay({
  price,
  currency = "TWD",
  className = "",
}: {
  price?: number | null;
  currency?: string;
  className?: string;
}) {
  const amount = Number(price || 0);
  if (!amount) return null;

  const code = currency || "TWD";
  if (code === "TWD") {
    return (
      <div className={`text-sm font-medium text-gray-900 dark:text-gray-100 ${className}`}>
        {formatCurrency(amount)}
      </div>
    );
  }

  const symbol = getCurrencySymbol(code);
  const twdAmount = convertToTWD(amount, code);

  return (
    <div className={className}>
      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
        {symbol} {amount.toLocaleString()}
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400">
        ≈ NT$ {twdAmount.toLocaleString()}
      </div>
    </div>
  );
}

function SimilarServicesButton({
  match,
  isActive,
  onToggle,
}: {
  match: SubscriptionSimilarityMatch;
  isActive: boolean;
  onToggle: (term: string) => void;
}) {
  const tooltip = isActive ? "取消相似服務" : "相似服務";
  const label = isActive
    ? "取消相似服務並還原原本的搜尋與篩選狀態"
    : `查看包含「${match.term}」的相似服務`;

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => onToggle(match.term)}
      className={`size-9 rounded-lg border-accent/50 p-0 text-[var(--accent-strong)] hover:bg-accent/10 ${
        isActive ? "bg-accent/10" : ""
      }`}
      title={tooltip}
      aria-label={label}
      aria-pressed={isActive}
    >
      {isActive ? <SearchX className="h-3.5 w-3.5" /> : <Search className="h-3.5 w-3.5" />}
    </Button>
  );
}

const SUBSCRIPTION_DELETE_CONFIRMATION = "DELETE subscription";
const SUBSCRIPTION_TRASH_KEY = "fengbro.subscription.trash";
const LEGACY_SUBSCRIPTION_RECENT_SEARCH_KEYS = ["fengbro.subscription.recentSearches"];
const SUBSCRIPTION_VOICE_HELP =
  "可說：匯出 CSV、重新整理、全選、新增訂閱 Netflix 100 元、已過期、編輯第一筆、刪除選取。說完會自動結束；安全操作直接執行。";

type VoiceCommandRisk = "safe" | "review" | "danger";

type VoiceCommand = {
  action: string;
  summary: string;
  risk: VoiceCommandRisk;
};

type TrashedSubscription = {
  subscription: Subscription;
  deletedAt: string;
};

function AccountComboBox({
  value,
  onChange,
  accounts,
}: {
  value: string;
  onChange: (value: string) => void;
  accounts: string[];
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [open]);

  const updatePosition = () => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
    });
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  const filtered = accounts.filter((item) => item.toLowerCase().includes(inputValue.toLowerCase()));

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          value={inputValue}
          placeholder="帳號 / Email"
          onFocus={() => {
            updatePosition();
            setOpen(true);
          }}
          onChange={(event) => {
            setInputValue(event.target.value);
            onChange(event.target.value);
            updatePosition();
            setOpen(true);
          }}
          className="pr-8"
        />
        <button
          type="button"
          onClick={() => {
            if (open) {
              setOpen(false);
            } else {
              updatePosition();
              setOpen(true);
            }
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
      {open && filtered.length > 0 && typeof document !== "undefined"
        ? ReactDOM.createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="max-h-48 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
          >
            {filtered.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setInputValue(item);
                  onChange(item);
                  setOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-blue-50 dark:hover:bg-gray-700"
              >
                {item}
              </button>
            ))}
          </div>,
          document.body
        )
        : null}
    </div>
  );
}

function getDraftSummary(form: SubscriptionFormData) {
  const price = Number(form.price || 0);
  const currency = form.currency || "TWD";
  const dueInfo = form.nextdate
    ? getSubscriptionExpiryInfo({
      $id: "draft",
      name: form.name || "草稿",
      site: form.site,
      price,
      nextdate: form.nextdate,
      note: form.note,
      account: form.account,
      currency,
      continue: form.continue,
    })
    : null;

  return {
    amountLabel: formatCurrencyWithExchange(price, currency),
    dueLabel: dueInfo
      ? dueInfo.isExpired
        ? `已過期 ${Math.abs(dueInfo.daysRemaining)} 天`
        : dueInfo.daysRemaining === 0
          ? "今天扣款"
          : `${dueInfo.daysRemaining} 天後扣款`
      : "未設定扣款日",
    dueTone: dueInfo
      ? dueInfo.isExpired
        ? "text-red-600 dark:text-red-400"
        : dueInfo.daysRemaining <= 7
          ? "text-amber-600 dark:text-amber-400"
          : "text-emerald-600 dark:text-emerald-400"
      : "text-gray-500 dark:text-gray-400",
  };
}

function normalizeSubscriptionValue(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function shiftDateByDays(dateValue: string | undefined, offsetDays: number) {
  const baseDate = dateValue ? new Date(dateValue) : new Date();
  if (Number.isNaN(baseDate.getTime())) return dateValue || "";
  baseDate.setDate(baseDate.getDate() + offsetDays);
  return baseDate.toISOString().slice(0, 10);
}

function getSubscriptionSiteHref(site?: string | null) {
  const trimmed = site?.trim();
  if (!trimmed) return null;

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function SubscriptionFormCard({
  title,
  form,
  onChange,
  onSave,
  onCancel,
  existingAccounts,
  tone,
  saveLabel,
}: {
  title: string;
  form: SubscriptionFormData;
  onChange: (next: SubscriptionFormData) => void;
  onSave: () => void;
  onCancel: () => void;
  existingAccounts: string[];
  tone: "green" | "blue";
  saveLabel: string;
}) {
  const summary = getDraftSummary(form);
  const toneClass = tone === "green"
    ? "border-green-200 bg-green-50/70 dark:border-green-800 dark:bg-green-900/10"
    : "border-blue-200 bg-blue-50/70 dark:border-blue-800 dark:bg-blue-900/10";
  const [selectedBank, setSelectedBank] = useState(BANK_OPTIONS[0]);
  const [selectedPaymentPlatform, setSelectedPaymentPlatform] = useState(PAYMENT_PLATFORM_OPTIONS[0]);

  const handleAddBank = () => {
    const lastLine = (form.note ?? "").split("\n").pop()?.trim() ?? "";
    // 若最後一行已是該銀行名稱（含舊的「銀行: 」前綴寫法）則不重複加入
    if (lastLine === selectedBank || lastLine === `銀行: ${selectedBank}`) return;
    const note = (form.note ?? "").trim();
    onChange({ ...form, note: note ? `${note}\n${selectedBank}` : selectedBank });
  };

  const handleAddPaymentPlatform = () => {
    const lastLine = (form.note ?? "").split("\n").pop()?.trim() ?? "";
    if (lastLine === selectedPaymentPlatform) return;
    const note = (form.note ?? "").trim();
    onChange({ ...form, note: note ? `${note}\n${selectedPaymentPlatform}` : selectedPaymentPlatform });
  };

  return (
    <DataCard className={`p-4 sm:p-5 ${toneClass}`}>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">只保留目前 subscription 表長期使用的 8 個欄位。</p>
        </div>
        <div className="w-full rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900/50 lg:w-auto lg:min-w-[220px]">
          <div className="text-xs text-gray-500 dark:text-gray-400">AI 提示</div>
          <div className="mt-1 font-semibold text-gray-900 dark:text-gray-100">{summary.amountLabel}</div>
          <div className={`text-xs ${summary.dueTone}`}>{summary.dueLabel}</div>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        <Input
          placeholder="服務名稱"
          value={form.name}
          onChange={(event) => onChange({ ...form, name: event.target.value })}
        />
        <Input
          placeholder="網站 URL"
          value={form.site || ""}
          onChange={(event) => onChange({ ...form, site: event.target.value })}
        />
        <Input
          type="number"
          min="0"
          placeholder="價格"
          value={form.price ?? 0}
          onChange={(event) => onChange({ ...form, price: Number(event.target.value) || 0 })}
        />
        <Input
          type="date"
          value={form.nextdate || ""}
          onChange={(event) => onChange({ ...form, nextdate: event.target.value })}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={() => onChange({ ...form, nextdate: shiftDateByDays(form.nextdate, -15) })}
          >
            -15 天
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={() => onChange({ ...form, nextdate: shiftDateByDays(form.nextdate, 15) })}
          >
            +15 天
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={() => onChange({ ...form, nextdate: shiftDateByDays(form.nextdate, -28) })}
          >
            -28 天
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={() => onChange({ ...form, nextdate: shiftDateByDays(form.nextdate, 28) })}
          >
            +28 天
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={() => onChange({ ...form, nextdate: shiftDateByDays(form.nextdate, -30) })}
          >
            -30 天
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={() => onChange({ ...form, nextdate: shiftDateByDays(form.nextdate, 30) })}
          >
            +30 天
          </Button>
        </div>
        <AccountComboBox
          value={form.account || ""}
          onChange={(value) => onChange({ ...form, account: value })}
          accounts={existingAccounts}
        />
        <Select
          value={form.currency || "TWD"}
          onValueChange={(value) => onChange({ ...form, currency: value })}
        >
          <SelectTrigger aria-label="幣別">
            <SelectValue placeholder="選擇幣別" />
          </SelectTrigger>
          <SelectContent>
            {CURRENCY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
            {/* 保留 CSV/舊資料中未列在選單內的幣別 */}
            {form.currency &&
              !CURRENCY_OPTIONS.some((option) => option.value === form.currency) && (
                <SelectItem value={form.currency}>{form.currency}</SelectItem>
              )}
          </SelectContent>
        </Select>
        <Select
          value={form.continue === false ? "false" : "true"}
          onValueChange={(value) => onChange({ ...form, continue: value !== "false" })}
        >
          <SelectTrigger>
            <SelectValue placeholder="是否續訂" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">續訂中</SelectItem>
            <SelectItem value="false">不續訂</SelectItem>
          </SelectContent>
        </Select>
        <div className="md:col-span-2 xl:col-span-4">
          <Textarea
            placeholder="備註"
            value={form.note || ""}
            onChange={(event) => onChange({ ...form, note: event.target.value })}
            rows={3}
          />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button onClick={onSave}>{saveLabel}</Button>
        <Button variant="outline" onClick={onCancel}>取消</Button>
        <Button variant="outline" onClick={handleAddBank}>加入銀行</Button>
        <Select value={selectedBank} onValueChange={setSelectedBank}>
          <SelectTrigger aria-label="銀行" className="w-[140px]">
            <SelectValue placeholder="選擇銀行" />
          </SelectTrigger>
          <SelectContent>
            {BANK_OPTIONS.map((bank) => (
              <SelectItem key={bank} value={bank}>
                {bank}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={handleAddPaymentPlatform}>加入付款平台</Button>
        <Select value={selectedPaymentPlatform} onValueChange={setSelectedPaymentPlatform}>
          <SelectTrigger aria-label="付款平台" className="w-[140px]">
            <SelectValue placeholder="選擇付款平台" />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_PLATFORM_OPTIONS.map((platform) => (
              <SelectItem key={platform} value={platform}>
                {platform}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </DataCard>
  );
}

export default function SubscriptionManagement() {
  const {
    subscriptions,
    loading,
    error,
    stats,
    createSubscription,
    updateSubscription,
    deleteSubscription,
    loadSubscriptions,
  } = useSubscriptions();
  const [initializingTable, setInitializingTable] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchScope, setSearchScope] = useState<SubscriptionSearchScope>("all");
  const [renewalFilter, setRenewalFilter] = useState<"all" | "renewing" | "stopped">("all");
  const [dueFilter, setDueFilter] = useState<"all" | "expired" | "7days" | "30days" | "nodate">("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [activeSimilarityView, setActiveSimilarityView] = useState<ActiveSubscriptionSimilarityView | null>(null);
  const NO_MONTH_FILTER = "no-month";
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineEditForm, setInlineEditForm] = useState<SubscriptionFormData>(INITIAL_FORM);
  const [isInlineAdding, setIsInlineAdding] = useState(false);
  const [inlineAddForm, setInlineAddForm] = useState<SubscriptionFormData>(INITIAL_FORM);
  const [shiftingId, setShiftingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [duplicatesCollapsed, setDuplicatesCollapsed] = useState(true);
  const [trashedSubscriptions, setTrashedSubscriptions] = useState<TrashedSubscription[]>([]);
  const [bulkDeleteInput, setBulkDeleteInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [deleteTotal, setDeleteTotal] = useState(0);
  const [deleteDebugMessages, setDeleteDebugMessages] = useState<string[]>([]);
  const [importPreview, setImportPreview] = useState<{ data: SubscriptionFormData[]; errors: string[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importDebugMessages, setImportDebugMessages] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<{ successCount: number; failCount: number; failureSummary: string } | null>(null);
  const importAutoCloseRef = useRef<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });
  const [exportDebugMessages, setExportDebugMessages] = useState<string[]>([]);
  const [voiceFeedback, setVoiceFeedback] = useState(SUBSCRIPTION_VOICE_HELP);
  const [pendingVoiceCommand, setPendingVoiceCommand] = useState<VoiceCommand | null>(null);
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
  const importInputRef = useRef<HTMLInputElement>(null);
  const bulkDeleteInputRef = useRef<HTMLInputElement>(null);

  const handleSearchChange = useCallback((value: string) => {
    setActiveSimilarityView(null);
    setSearchScope("all");
    setSearchQuery(value);
  }, []);

  const clearSearchQuery = useCallback(() => {
    setActiveSimilarityView(null);
    setSearchScope("all");
    setSearchQuery("");
  }, []);

  const saveTrash = useCallback((items: TrashedSubscription[]) => {
    setTrashedSubscriptions(items);
    window.localStorage.setItem(SUBSCRIPTION_TRASH_KEY, JSON.stringify(items));
  }, []);

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(window.localStorage.getItem(SUBSCRIPTION_TRASH_KEY) || "[]");
      if (Array.isArray(saved)) {
        setTrashedSubscriptions(saved.filter((item): item is TrashedSubscription =>
          Boolean(item && typeof item === "object" && "subscription" in item && "deletedAt" in item)
        ));
      }
    } catch {
      setTrashedSubscriptions([]);
    }
  }, []);

  const CSV_HEADERS = [...SUBSCRIPTION_CSV_HEADERS];

  useEffect(() => {
    if (!bulkDeleteOpen || isDeleting) return;
    const focusTimer = window.setTimeout(() => {
      bulkDeleteInputRef.current?.focus();
      bulkDeleteInputRef.current?.select();
    }, 80);
    return () => window.clearTimeout(focusTimer);
  }, [bulkDeleteOpen, isDeleting]);

  const scopedSubscriptions = subscriptions;

  const monthOptions = useMemo(() => {
    const counts = new Map<string, number>();
    scopedSubscriptions.forEach((sub) => {
      if (!sub.nextdate) return;
      const date = new Date(sub.nextdate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      counts.set(monthKey, (counts.get(monthKey) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([value, count]) => ({ value, count }));
  }, [scopedSubscriptions]);

  const existingAccounts = useMemo(() => {
    const values = subscriptions
      .map((sub) => sub.account)
      .filter((value): value is string => !!value && value.trim() !== "");
    return [...new Set(values)].sort();
  }, [subscriptions]);

  const expiredSubscriptions = useMemo(() => scopedSubscriptions.filter((sub) => {
    if (!sub.nextdate) return false;
    return getSubscriptionExpiryInfo(sub).daysRemaining < 0;
  }), [scopedSubscriptions]);

  const dueSoonSubscriptions = useMemo(() => scopedSubscriptions.filter((sub) => {
    if (!sub.nextdate) return false;
    const { daysRemaining } = getSubscriptionExpiryInfo(sub);
    return daysRemaining >= 0 && daysRemaining <= 7;
  }), [scopedSubscriptions]);

  const noDateSubscriptions = useMemo(
    () => scopedSubscriptions.filter((sub) => !sub.nextdate),
    [scopedSubscriptions]
  );

  const stoppedSubscriptions = useMemo(
    () => scopedSubscriptions.filter((sub) => sub.continue === false),
    [scopedSubscriptions]
  );

  const renewingSubscriptions = useMemo(
    () => scopedSubscriptions.filter((sub) => sub.continue !== false),
    [scopedSubscriptions]
  );

  const duplicateGroups = useMemo(() => {
    const groups = new Map<string, Subscription[]>();

    scopedSubscriptions.forEach((sub) => {
      const normalizedName = normalizeSubscriptionValue(sub.name);
      const normalizedAccount = normalizeSubscriptionValue(sub.account);
      const normalizedSite = normalizeSubscriptionValue(sub.site);
      const key = [normalizedName, normalizedAccount || normalizedSite].join("::");

      if (!normalizedName || !key.replace(/:/g, "")) return;

      const current = groups.get(key) || [];
      current.push(sub);
      groups.set(key, current);
    });

    return Array.from(groups.values())
      .filter((group) => group.length > 1)
      .sort((left, right) => right.length - left.length);
  }, [scopedSubscriptions]);

  const similarServiceMatches = useMemo(() => {
    return buildSimilarSubscriptionMatches(scopedSubscriptions);
  }, [scopedSubscriptions]);

  const filteredSubscriptions = useMemo(() => {
    let result = scopedSubscriptions;

    if (renewalFilter === "renewing") {
      result = result.filter((sub) => sub.continue !== false);
    } else if (renewalFilter === "stopped") {
      result = result.filter((sub) => sub.continue === false);
    }

    if (dueFilter !== "all") {
      result = result.filter((sub) => {
        if (!sub.nextdate) return dueFilter === "nodate";
        const days = getSubscriptionExpiryInfo(sub).daysRemaining;
        if (dueFilter === "expired") return days < 0;
        if (dueFilter === "7days") return days >= 0 && days <= 7;
        if (dueFilter === "30days") return days >= 0 && days <= 30;
        return true;
      });
    }

    if (monthFilter !== "all") {
      result = result.filter((sub) => {
        if (!sub.nextdate) return monthFilter === NO_MONTH_FILTER;
        const date = new Date(sub.nextdate);
        const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        return ym === monthFilter;
      });
    }

    if (!searchQuery.trim()) return result;
    return result.filter((sub) => subscriptionMatchesSearch(sub, searchQuery, searchScope));
  }, [scopedSubscriptions, renewalFilter, dueFilter, monthFilter, searchQuery, searchScope]);

  const isAllSelected = filteredSubscriptions.length > 0 && filteredSubscriptions.every((sub) => selectedIds.has(sub.$id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(filteredSubscriptions.map((sub) => sub.$id)));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const appendDeleteDebug = (message: string) => {
    console.log(`[Subscription delete] ${message}`);
    setDeleteDebugMessages((prev) => [...prev.slice(-79), message]);
  };

  const resetInlineStates = () => {
    setInlineEditingId(null);
    setInlineEditForm(INITIAL_FORM);
    setIsInlineAdding(false);
    setInlineAddForm(INITIAL_FORM);
  };

  const applyQuickFilter = (type: "all" | "dueSoon" | "noDate" | "stopped" | "duplicates") => {
    if (type === "all") {
      setDueFilter("all");
      setRenewalFilter("all");
      setMonthFilter("all");
      clearSearchQuery();
      return;
    }

    setMonthFilter("all");

    if (type === "dueSoon") {
      setDueFilter("7days");
      setRenewalFilter("all");
      clearSearchQuery();
      return;
    }

    if (type === "noDate") {
      setDueFilter("nodate");
      setRenewalFilter("all");
      clearSearchQuery();
      return;
    }

    if (type === "stopped") {
      setDueFilter("all");
      setRenewalFilter("stopped");
      clearSearchQuery();
      return;
    }

    const topDuplicate = duplicateGroups[0];
    setDueFilter("all");
    setRenewalFilter("all");
    handleSearchChange(topDuplicate?.[0]?.name || "");
  };

  const applySimilarityViewState = useCallback((state: SubscriptionSimilarityViewState) => {
    setSearchQuery(state.searchQuery);
    setSearchScope(state.searchScope);
    setRenewalFilter(state.renewalFilter);
    setDueFilter(state.dueFilter);
    setMonthFilter(state.monthFilter);
    setSelectedIds(new Set(state.selectedIds));
  }, []);

  const handleToggleSimilarServices = useCallback((sourceSubscriptionId: string, term: string) => {
    if (activeSimilarityView?.sourceSubscriptionId === sourceSubscriptionId) {
      applySimilarityViewState(restoreSubscriptionSimilarityView(activeSimilarityView));
      setActiveSimilarityView(null);
      return;
    }

    const transition = activateSubscriptionSimilarityView(
      {
        searchQuery,
        searchScope,
        renewalFilter,
        dueFilter,
        monthFilter,
        selectedIds: Array.from(selectedIds),
      },
      sourceSubscriptionId,
      term,
      activeSimilarityView,
    );

    applySimilarityViewState(transition.nextState);
    setActiveSimilarityView(transition.activeView);
  }, [
    activeSimilarityView,
    applySimilarityViewState,
    dueFilter,
    monthFilter,
    renewalFilter,
    searchQuery,
    searchScope,
    selectedIds,
  ]);

  const findVoiceTarget = (text: string) => {
    if (filteredSubscriptions.length === 0) return null;
    if (text.includes("第一筆") || text.includes("第一個") || text.includes("第1筆") || text.includes("第1個")) {
      return filteredSubscriptions[0];
    }

    const normalizedText = normalizeSubscriptionValue(text);
    return filteredSubscriptions.find((sub) => {
      const values = [sub.name, sub.site, sub.account, sub.note].map(normalizeSubscriptionValue).filter(Boolean);
      return values.some((value) => normalizedText.includes(value) || value.includes(normalizedText));
    }) || filteredSubscriptions[0];
  };

  const formatVoiceDate = (year: number, month: number, day: number) => {
    if (!year || !month || !day) return "";
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };

  const extractVoiceDate = (text: string) => {
    const slashDate = text.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s*(?:上午|早上|下午|晚上|中午))?/);
    if (slashDate) {
      return {
        date: formatVoiceDate(Number(slashDate[1]), Number(slashDate[2]), Number(slashDate[3])),
        raw: slashDate[0],
      };
    }

    const zhDate = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*(?:日|號|号)?(?:\s*(?:上午|早上|下午|晚上|中午))?/);
    if (zhDate) {
      return {
        date: formatVoiceDate(Number(zhDate[1]), Number(zhDate[2]), Number(zhDate[3])),
        raw: zhDate[0],
      };
    }

    const monthDay = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*(?:日|號|号)?(?:\s*(?:上午|早上|下午|晚上|中午))?/);
    if (monthDay) {
      return {
        date: formatVoiceDate(new Date().getFullYear(), Number(monthDay[1]), Number(monthDay[2])),
        raw: monthDay[0],
      };
    }

    return { date: "", raw: "" };
  };

  const extractVoicePrice = (text: string) => {
    const explicitPrice = text.match(/(?:價格|金額|月費|費用|付費|收費)\s*(?:是|為|:|：)?\s*(\d+(?:\.\d+)?)/i);
    if (explicitPrice) return Number(explicitPrice[1]);

    const currencyPrice = text.match(/(?:nt\$|twd|台幣|臺幣|新台幣|美金|美元|usd)?\s*(\d+(?:\.\d+)?)\s*(?:元|塊|twd|usd|美元|美金)/i);
    return currencyPrice ? Number(currencyPrice[1]) : 0;
  };

  const extractVoiceTimeNote = (text: string) => {
    const timeLabel = text.match(/上午|早上|下午|晚上|中午/)?.[0];
    if (!timeLabel) return "";
    return `鋒兄語音 ${timeLabel === "早上" ? "上午" : timeLabel}`;
  };

  const extractVoiceName = (text: string, dateRaw: string) => {
    const quoted = text.match(/[「『"']([^」』"']+)[」』"']/);
    if (quoted?.[1]) return quoted[1].trim();

    const named = text.match(/(?:叫做|名稱(?:是|為)?|名為)\s*(.+?)(?=\s*(?:日期|時間|扣款日|價格|金額|月費|費用|付費|收費|備註|帳號|網站|$))/);
    if (named?.[1]) return named[1].trim();

    return text
      .replace(dateRaw, " ")
      .replace(/新增訂閱|新增一筆資料|新增一筆|新增資料|新增|建立訂閱|建立|在鋒兄訂閱|鋒兄訂閱|訂閱/gi, " ")
      .replace(/叫做|名稱是|名稱為|名為|日期為|日期是|時間為|時間是|扣款日為|扣款日是|上午|早上|下午|晚上|中午/gi, " ")
      .replace(/(?:價格|金額|月費|費用|付費|收費)\s*(?:是|為|:|：)?\s*\d+(?:\.\d+)?/gi, " ")
      .replace(/(?:nt\$|twd|台幣|臺幣|新台幣|美金|美元|usd)?\s*\d+(?:\.\d+)?\s*(?:元|塊|twd|usd|美元|美金)/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  };

  const buildVoiceDraft = (text: string): SubscriptionFormData => {
    const voiceDate = extractVoiceDate(text);
    const currency = /usd|美金|美元/i.test(text) ? "USD" : "TWD";
    const name = extractVoiceName(text, voiceDate.raw);
    const note = extractVoiceTimeNote(text);

    return {
      ...INITIAL_FORM,
      name,
      price: extractVoicePrice(text),
      nextdate: voiceDate.date,
      note,
      currency,
    };
  };

  const extractVoiceSearchQuery = (text: string) => {
    return text
      .replace(/搜尋|查詢|找|查看|search|find/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  };

  const parseVoiceCommand = (text: string): VoiceCommand | null => {
    const normalized = text.trim().toLowerCase();
    if (!normalized) return null;

    if (/匯入|import/.test(normalized) && /csv/.test(normalized)) {
      return { action: "importCsv", summary: "開啟 CSV 檔案選擇器，選檔後仍會顯示匯入預覽。", risk: "review" };
    }
    if (/匯出|export/.test(normalized) && /csv/.test(normalized)) {
      return { action: "exportCsv", summary: `匯出目前 ${subscriptions.length} 筆訂閱為 CSV。`, risk: "safe" };
    }
    if (/重新整理|刷新|refresh|reload/.test(normalized)) {
      return { action: "refresh", summary: "重新向 Appwrite 載入訂閱資料。", risk: "safe" };
    }
    if (/取消全選|清除選取|取消選取|unselect/.test(normalized)) {
      return { action: "clearSelection", summary: `取消目前 ${selectedIds.size} 筆選取。`, risk: "safe" };
    }
    if (/全選|select all/.test(normalized)) {
      return { action: "selectAll", summary: `選取目前篩選結果 ${filteredSubscriptions.length} 筆訂閱。`, risk: "review" };
    }
    if (/清除篩選|全部|顯示全部/.test(normalized)) {
      return { action: "filterAll", summary: "清除搜尋與篩選，回到全部訂閱。", risk: "safe" };
    }
    if (/7 天內|七天內|快到期|即將扣款|due/.test(normalized)) {
      return { action: "filterDueSoon", summary: `切換到 7 天內扣款清單，目前 ${dueSoonSubscriptions.length} 筆。`, risk: "safe" };
    }
    if (/已過期|過期|逾期|expired|overdue/.test(normalized)) {
      return { action: "filterExpired", summary: `切換到已過期清單，目前 ${expiredSubscriptions.length} 筆。`, risk: "safe" };
    }
    if (/30 天內|三十天內|一個月內|30天內/.test(normalized)) {
      return { action: "filter30Days", summary: "切換到 30 天內扣款清單。", risk: "safe" };
    }
    if (/未設定|未排扣款|沒日期|無日期/.test(normalized)) {
      return { action: "filterNoDate", summary: `切換到未設定扣款日清單，目前 ${noDateSubscriptions.length} 筆。`, risk: "safe" };
    }
    if (/不續訂|停止續訂|停用/.test(normalized)) {
      return { action: "filterStopped", summary: `切換到不續訂清單，目前 ${stoppedSubscriptions.length} 筆。`, risk: "safe" };
    }
    if (/重複|duplicate/.test(normalized)) {
      return { action: "filterDuplicates", summary: `查看重複訂閱提醒，目前 ${duplicateGroups.length} 組。`, risk: "safe" };
    }
    if (/搜尋|查詢|找|search|find/.test(normalized)) {
      const query = extractVoiceSearchQuery(text);
      return query
        ? { action: "search", summary: `搜尋訂閱關鍵字「${query}」。`, risk: "safe" }
        : { action: "noop", summary: "請在搜尋指令後面加上關鍵字，例如：搜尋 Netflix。", risk: "safe" };
    }
    if (/新增|建立|add|create/.test(normalized)) {
      const draft = buildVoiceDraft(text);
      return {
        action: "add",
        summary: draft.name
          ? `開啟新增訂閱表單，預填「${draft.name}」${draft.price ? `、金額 ${draft.price}` : ""}${draft.nextdate ? `、扣款日 ${draft.nextdate}` : ""}。`
          : "開啟新增訂閱表單，請再手動確認欄位。",
        risk: "review",
      };
    }
    if (/編輯|修改|edit|update/.test(normalized)) {
      const target = findVoiceTarget(text);
      return target
        ? { action: "edit", summary: `開啟「${target.name}」編輯表單，儲存前還要再按一次。`, risk: "review" }
        : { action: "noop", summary: "目前找不到可編輯的訂閱。", risk: "safe" };
    }
    if (/標記|設為|改成|mark/.test(normalized) && /不續訂|停止續訂|停用/.test(normalized)) {
      const target = findVoiceTarget(text);
      return target
        ? { action: "markStopped", summary: `開啟「${target.name}」編輯表單，預先改成不續訂；仍需按儲存。`, risk: "review" }
        : { action: "noop", summary: "目前找不到可標記的訂閱。", risk: "safe" };
    }
    if (/標記|設為|改成|mark/.test(normalized) && /續訂|繼續訂|啟用/.test(normalized)) {
      const target = findVoiceTarget(text);
      return target
        ? { action: "markRenewing", summary: `開啟「${target.name}」編輯表單，預先改成續訂；仍需按儲存。`, risk: "review" }
        : { action: "noop", summary: "目前找不到可標記的訂閱。", risk: "safe" };
    }
    if (/刪除選取|刪除已選|delete selected/.test(normalized)) {
      return { action: "deleteSelected", summary: `開啟批次刪除確認，対象為目前選取 ${selectedIds.size} 筆；仍需輸入 ${SUBSCRIPTION_DELETE_CONFIRMATION}。`, risk: "danger" };
    }
    if (/刪除|delete|remove/.test(normalized)) {
      const target = findVoiceTarget(text);
      return target
        ? { action: "deleteOne", summary: `選取「${target.name}」並開啟刪除確認；仍需輸入 ${SUBSCRIPTION_DELETE_CONFIRMATION}。`, risk: "danger" }
        : { action: "noop", summary: "目前找不到可刪除的訂閱。", risk: "safe" };
    }

    return null;
  };

  const openBulkDeleteModalForIds = (ids: string[]) => {
    if (ids.length === 0) {
      setVoiceFeedback("沒有可刪除的選取項目。");
      return;
    }
    setSelectedIds(new Set(ids));
    setBulkDeleteOpen(true);
    setBulkDeleteInput("");
    setDeleteProgress(0);
    setDeleteTotal(ids.length);
    setDeleteDebugMessages([]);
  };

  const executeVoiceCommand = async (commandOverride?: VoiceCommand | null) => {
    const command = commandOverride ?? pendingVoiceCommand;
    if (!command) return;
    setPendingVoiceCommand(null);

    if (command.action === "importCsv") {
      importInputRef.current?.click();
      setVoiceFeedback("已開啟 CSV 選擇器，選檔後請在匯入預覽再次確認。");
      return;
    }
    if (command.action === "exportCsv") {
      await exportToCSV();
      setVoiceFeedback("已執行匯出 CSV。");
      return;
    }
    if (command.action === "refresh") {
      await loadSubscriptions(true);
      setVoiceFeedback("已重新整理訂閱資料。");
      return;
    }
    if (command.action === "selectAll") {
      setSelectedIds(new Set(filteredSubscriptions.map((sub) => sub.$id)));
      setVoiceFeedback(`已選取 ${filteredSubscriptions.length} 筆。`);
      return;
    }
    if (command.action === "clearSelection") {
      setSelectedIds(new Set());
      setVoiceFeedback("已取消選取。");
      return;
    }
    if (command.action === "filterAll") {
      applyQuickFilter("all");
      setVoiceFeedback("已切回全部訂閱。");
      return;
    }
    if (command.action === "filterDueSoon") {
      applyQuickFilter("dueSoon");
      setVoiceFeedback("已篩選 7 天內扣款。");
      return;
    }
    if (command.action === "filterExpired") {
      setDueFilter("expired");
      setRenewalFilter("all");
      setMonthFilter("all");
      clearSearchQuery();
      setVoiceFeedback("已篩選已過期訂閱。");
      return;
    }
    if (command.action === "filter30Days") {
      setDueFilter("30days");
      setRenewalFilter("all");
      setMonthFilter("all");
      clearSearchQuery();
      setVoiceFeedback("已篩選 30 天內扣款。");
      return;
    }
    if (command.action === "filterNoDate") {
      applyQuickFilter("noDate");
      setVoiceFeedback("已篩選未設定扣款日。");
      return;
    }
    if (command.action === "filterStopped") {
      applyQuickFilter("stopped");
      setVoiceFeedback("已篩選不續訂。");
      return;
    }
    if (command.action === "filterDuplicates") {
      applyQuickFilter("duplicates");
      setVoiceFeedback("已切到重複訂閱提醒。");
      return;
    }
    if (command.action === "search") {
      const query = extractVoiceSearchQuery(voiceTranscript);
      handleSearchChange(query);
      setVoiceFeedback(`已搜尋：${query}`);
      return;
    }
    if (command.action === "add") {
      const draft = buildVoiceDraft(voiceTranscript);
      resetInlineStates();
      setInlineAddForm(draft);
      setIsInlineAdding(true);
      setVoiceFeedback("已開啟新增表單，請檢查欄位後再按建立訂閱。");
      return;
    }
    if (command.action === "edit") {
      const target = findVoiceTarget(voiceTranscript);
      if (target) {
        handleInlineEdit(target);
        setVoiceFeedback(`已開啟 ${target.name} 編輯表單，請檢查後再儲存。`);
      }
      return;
    }
    if (command.action === "markStopped" || command.action === "markRenewing") {
      const target = findVoiceTarget(voiceTranscript);
      if (target) {
        handleInlineEdit(target);
        setInlineEditForm({
          ...toSubscriptionForm(target),
          continue: command.action === "markRenewing",
        });
        setVoiceFeedback(`已預填 ${target.name} 為${command.action === "markRenewing" ? "續訂" : "不續訂"}，請檢查後再儲存。`);
      }
      return;
    }
    if (command.action === "deleteSelected") {
      openBulkDeleteModalForIds(Array.from(selectedIds));
      setVoiceFeedback("已開啟批次刪除確認，仍需輸入口令。");
      return;
    }
    if (command.action === "deleteOne") {
      const target = findVoiceTarget(voiceTranscript);
      if (target) {
        openBulkDeleteModalForIds([target.$id]);
        setVoiceFeedback(`已選取 ${target.name} 並開啟刪除確認，仍需輸入口令。`);
      }
    }
  };

  const handleVoiceText = (text: string) => {
    const cleaned = text.trim();
    if (!cleaned) {
      setPendingVoiceCommand(null);
      setVoiceFeedback("請先輸入或說出指令。");
      return;
    }
    setVoiceTranscript(cleaned);
    const command = parseVoiceCommand(cleaned);
    if (!command) {
      setPendingVoiceCommand(null);
      setVoiceFeedback("聽到了，但還無法判斷指令。可試：匯出 CSV、重新整理、全選、新增訂閱 Netflix 100 元。");
      return;
    }
    if (shouldAutoExecuteVoiceRisk(command.risk)) {
      setPendingVoiceCommand(null);
      playVoiceSuccessTone();
      void executeVoiceCommand(command);
      return;
    }
    setPendingVoiceCommand(command);
    setVoiceFeedback(
      command.risk === "danger"
        ? "這是危險操作，請確認後再執行；刪除口令仍會再問一次。"
        : "已理解指令，請確認後再執行。"
    );
  };
  handleVoiceTextRef.current = handleVoiceText;

  const handleInitializeSubscriptionTable = async () => {
    const confirmed = confirm("確定要立即初始化 subscription 表嗎？");
    if (!confirmed) return;

    setInitializingTable(true);
    try {
      const config = getAppwriteConfig();
      const params = new URLSearchParams({ table: "subscription" });
      if (config.endpoint) params.set("_endpoint", config.endpoint);
      if (config.projectId) params.set("_project", config.projectId);
      if (config.databaseId) params.set("_database", config.databaseId);
      if (config.apiKey) params.set("_key", config.apiKey);

      await new Promise<void>((resolve, reject) => {
        const eventSource = new EventSource(`/api/create-table?${params.toString()}`);
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "complete") {
              eventSource.close();
              resolve();
            } else if (data.type === "error") {
              eventSource.close();
              reject(new Error(data.message || "初始化失敗"));
            }
          } catch (error) {
            eventSource.close();
            reject(error);
          }
        };
        eventSource.onerror = () => {
          eventSource.close();
          reject(new Error("初始化連線中斷"));
        };
      });

      await loadSubscriptions();
      alert("subscription 表初始化完成");
    } catch (initError) {
      alert(`初始化失敗：${initError instanceof Error ? initError.message : "未知錯誤"}`);
    } finally {
      setInitializingTable(false);
    }
  };

  const handleInlineAddSave = async () => {
    if (!inlineAddForm.name?.trim()) {
      alert("請輸入服務名稱");
      return;
    }
    try {
      await createSubscription({
        ...inlineAddForm,
        price: Number(inlineAddForm.price || 0),
        currency: inlineAddForm.currency || "TWD",
        continue: inlineAddForm.continue !== false,
      });
      setIsInlineAdding(false);
      setInlineAddForm(INITIAL_FORM);
    } catch (saveError) {
      alert(saveError instanceof Error ? saveError.message : "新增失敗");
    }
  };

  const handleInlineEdit = (sub: Subscription) => {
    setInlineEditingId(sub.$id);
    setInlineEditForm(toSubscriptionForm(sub));
    setIsInlineAdding(false);
  };

  const handleInlineSave = async () => {
    if (!inlineEditingId) return;
    if (!inlineEditForm.name?.trim()) {
      alert("請輸入服務名稱");
      return;
    }
    try {
      await updateSubscription(inlineEditingId, {
        ...inlineEditForm,
        price: Number(inlineEditForm.price || 0),
        currency: inlineEditForm.currency || "TWD",
        continue: inlineEditForm.continue !== false,
      });
      setInlineEditingId(null);
      setInlineEditForm(INITIAL_FORM);
    } catch (saveError) {
      alert(saveError instanceof Error ? saveError.message : "更新失敗");
    }
  };

  /** 列表一鍵延長下次扣款日（+28 / +30 天），直接儲存 */
  const handleShiftNextDate = async (sub: Subscription, offsetDays: number) => {
    if (shiftingId) return;
    setShiftingId(sub.$id);
    try {
      const baseDate = sub.nextdate ? formatDate(sub.nextdate) : "";
      await updateSubscription(sub.$id, {
        ...toSubscriptionForm(sub),
        nextdate: shiftDateByDays(baseDate, offsetDays),
      });
      // 若正在編輯同一筆，同步表單日期
      if (inlineEditingId === sub.$id) {
        setInlineEditForm((prev) => ({
          ...prev,
          nextdate: shiftDateByDays(baseDate, offsetDays),
        }));
      }
    } catch (saveError) {
      alert(saveError instanceof Error ? saveError.message : "更新扣款日失敗");
    } finally {
      setShiftingId(null);
    }
  };

  const moveToTrash = async (subscription: Subscription) => {
    await deleteSubscription(subscription.$id);
    setTrashedSubscriptions((previous) => {
      const next = [{ subscription, deletedAt: new Date().toISOString() }, ...previous.filter((item) => item.subscription.$id !== subscription.$id)];
      window.localStorage.setItem(SUBSCRIPTION_TRASH_KEY, JSON.stringify(next));
      return next;
    });
  };

  const handleDelete = async (id: string) => {
    const subscription = subscriptions.find((item) => item.$id === id);
    if (!subscription || !confirm("確定將這筆訂閱移到垃圾桶嗎？可在垃圾桶中還原。")) return;
    try {
      await moveToTrash(subscription);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (deleteError) {
      alert(deleteError instanceof Error ? deleteError.message : "移入垃圾桶失敗");
    }
  };

  const restoreFromTrash = async (item: TrashedSubscription) => {
    try {
      const subscription = item.subscription;
      await createSubscription(toSubscriptionForm(subscription));
      saveTrash(trashedSubscriptions.filter((candidate) => candidate.subscription.$id !== subscription.$id));
    } catch (restoreError) {
      alert(restoreError instanceof Error ? restoreError.message : "還原訂閱失敗");
    }
  };

  const clearTrash = () => {
    if (!confirm(`確定永久清空垃圾桶中的 ${trashedSubscriptions.length} 筆訂閱嗎？此操作無法復原。`)) return;
    saveTrash([]);
  };

  const openBulkDeleteModal = () => {
    if (selectedIds.size === 0) return;
    setBulkDeleteOpen(true);
    setBulkDeleteInput("");
    setDeleteProgress(0);
    setDeleteTotal(selectedIds.size);
    setDeleteDebugMessages([]);
  };

  const handleDeleteSelected = async () => {
    const ids = Array.from(selectedIds).filter((id) => !!id);
    if (ids.length === 0) return;

    setIsDeleting(true);
    setDeleteProgress(0);
    setDeleteTotal(ids.length);
    setDeleteDebugMessages([]);
    appendDeleteDebug(`開始批次移入垃圾桶，共 ${ids.length} 筆訂閱。`);

    let failedCount = 0;

    for (let index = 0; index < ids.length; index++) {
      const id = ids[index];
      const target = subscriptions.find((sub) => sub.$id === id);
      const label = target?.name || id;

      appendDeleteDebug(`[${index + 1}/${ids.length}] 準備移入垃圾桶 ${label}`);

      try {
        await fetchApi(`${API_ENDPOINTS.SUBSCRIPTION}/${id}`, { method: "DELETE" });
        if (target) {
          setTrashedSubscriptions((previous) => {
            const next = [{ subscription: target, deletedAt: new Date().toISOString() }, ...previous.filter((item) => item.subscription.$id !== target.$id)];
            window.localStorage.setItem(SUBSCRIPTION_TRASH_KEY, JSON.stringify(next));
            return next;
          });
        }
        appendDeleteDebug(`[${index + 1}/${ids.length}] 已移入垃圾桶 ${label}`);
      } catch (deleteError) {
        failedCount += 1;
        console.error(`Delete subscription failed: ${label}`, deleteError);
        appendDeleteDebug(
          `[${index + 1}/${ids.length}] 刪除失敗 ${label}: ${deleteError instanceof Error ? deleteError.message : "未知錯誤"}`
        );
      } finally {
        setDeleteProgress(index + 1);
      }
    }

    appendDeleteDebug(`批次移入垃圾桶完成，成功 ${ids.length - failedCount} 筆，失敗 ${failedCount} 筆。`);

    setIsDeleting(false);
    setBulkDeleteOpen(false);
    setBulkDeleteInput("");
    setSelectedIds(new Set());
    await loadSubscriptions(true);

    if (failedCount > 0) {
      alert(`批次移入垃圾桶完成，但有 ${failedCount} 筆失敗，請查看 console 與 debug 訊息。`);
    }
  };

  const exportToCSV = async () => {
    const escapeCSV = (value: string | number | boolean | null | undefined) => {
      if (value === null || value === undefined) return "";
      const stringValue = String(value);
      if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    setExporting(true);
    setExportProgress({ current: 0, total: subscriptions.length });
    setExportDebugMessages([`Export started: ${subscriptions.length} rows`]);

    try {
      const rows = [CSV_HEADERS.join(",")];
      for (let i = 0; i < subscriptions.length; i++) {
        const sub = subscriptions[i];
        rows.push(subscriptionFormToCsvValues(toSubscriptionForm(sub)).map(escapeCSV).join(","));
        setExportProgress({ current: i + 1, total: subscriptions.length });
        setExportDebugMessages((prev) => [...prev.slice(-79), `${i + 1}/${subscriptions.length} Exported ${sub.name}`]);
        if (i % 25 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      const blob = new Blob([`﻿${rows.join("\n")}`], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = getExportFilename("subscription");
      link.click();
      URL.revokeObjectURL(link.href);
      setExportDebugMessages((prev) => [...prev.slice(-79), `Export finished: ${subscriptions.length} rows`]);
      setTimeout(() => {
        setExporting(false);
        setExportProgress({ current: 0, total: 0 });
      }, 1200);
    } catch (error) {
      console.error("Export CSV failed:", error);
      setExportDebugMessages((prev) => [...prev.slice(-79), "Export failed"]);
      setExporting(false);
      setExportProgress({ current: 0, total: 0 });
      throw error;
    }
  };

  const parseFullCSV = (text: string): string[][] => {
    const rows: string[][] = [];
    const cleanText = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    let currentRow: string[] = [];
    let currentField = "";
    let inQuotes = false;

    for (let i = 0; i < cleanText.length; i++) {
      const char = cleanText[i];
      if (inQuotes) {
        if (char === '"') {
          if (cleanText[i + 1] === '"') {
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
        } else if (char === ",") {
          currentRow.push(currentField);
          currentField = "";
        } else if (char === "\n") {
          currentRow.push(currentField);
          if (currentRow.some((field) => field.trim())) rows.push(currentRow);
          currentRow = [];
          currentField = "";
        } else {
          currentField += char;
        }
      }
    }

    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField);
      if (currentRow.some((field) => field.trim())) rows.push(currentRow);
    }

    return rows;
  };

  const parseCSV = (text: string): { data: SubscriptionFormData[]; errors: string[] } => {
    const errors: string[] = [];
    const data: SubscriptionFormData[] = [];
    const rows = parseFullCSV(text);

    if (rows.length < 2) {
      errors.push("CSV 檔案至少需要表頭和一行資料");
      return { data, errors };
    }

    const headerValues = rows[0].map((value) => value.trim());
    const csvMode = detectSubscriptionCsvMode(headerValues);
    if (!csvMode) {
      errors.push(`表頭無法辨識：請使用 8 欄舊格式或 ${CSV_HEADERS.length} 欄完整格式`);
      return { data, errors };
    }

    const expectedCount = csvMode === "full" ? CSV_HEADERS.length : 8;
    for (let i = 1; i < rows.length; i++) {
      const values = rows[i];
      const lineNum = i + 1;
      if (values.length !== expectedCount) {
        errors.push(`第 ${lineNum} 行: 欄位數量錯誤`);
        continue;
      }
      if (!values[0]?.trim()) {
        errors.push(`第 ${lineNum} 行: name 欄位不能為空`);
        continue;
      }
      data.push(parseSubscriptionCsvRow(values));
    }

    return { data, errors };
  };

  const handleCsvFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      alert("請選擇 CSV 檔案");
      return;
    }
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      if (importAutoCloseRef.current) {
        clearTimeout(importAutoCloseRef.current);
        importAutoCloseRef.current = null;
      }
      setImportResult(null);
      setImportPreview(parseCSV(loadEvent.target?.result as string));
    };
    reader.readAsText(file, "UTF-8");
    event.target.value = "";
  };

  const getImportExactKey = (item: SubscriptionFormData) => [
    normalizeSubscriptionValue(item.name),
    normalizeSubscriptionValue(item.account),
    normalizeSubscriptionValue(item.site),
    String(Number(item.price || 0)),
    item.nextdate || "",
    normalizeSubscriptionValue(item.currency || "TWD"),
  ].join("::");

  const getImportNameAccountKey = (item: Pick<SubscriptionFormData, "name" | "account">) =>
    `${normalizeSubscriptionValue(item.name)}::${normalizeSubscriptionValue(item.account)}`;

  const executeImport = async () => {
    if (!importPreview || importPreview.data.length === 0) return;

    setImporting(true);
    setImportResult(null);
    if (importAutoCloseRef.current) {
      clearTimeout(importAutoCloseRef.current);
      importAutoCloseRef.current = null;
    }
    setImportProgress({ current: 0, total: importPreview.data.length });
    setImportDebugMessages([`Import started: ${importPreview.data.length} rows`]);

    let successCount = 0;
    let failCount = 0;
    const failureReasons = new Map<string, number>();
    const exactImportIndex = new Map<string, Subscription>();
    const nameAccountIndex = new Map<string, Subscription>();
    const nameIndex = new Map<string, Subscription>();

    subscriptions.forEach((sub) => {
      const formLike: SubscriptionFormData = toSubscriptionForm(sub);
      exactImportIndex.set(getImportExactKey(formLike), sub);
      nameAccountIndex.set(getImportNameAccountKey(formLike), sub);
      nameIndex.set(normalizeSubscriptionValue(sub.name), sub);
    });

    for (let i = 0; i < importPreview.data.length; i++) {
      const formData = importPreview.data[i];
      setImportProgress({ current: i + 1, total: importPreview.data.length });
      setImportDebugMessages((prev) => [...prev.slice(-79), `${i + 1}/${importPreview.data.length} Processing ${formData.name}`]);
      try {
        const exactKey = getImportExactKey(formData);
        const nameAccountKey = getImportNameAccountKey(formData);
        const nameKey = normalizeSubscriptionValue(formData.name);
        const existing = exactImportIndex.get(exactKey) || nameAccountIndex.get(nameAccountKey) || nameIndex.get(nameKey);

        if (existing) {
          const updated = await fetchApi<Subscription>(`${API_ENDPOINTS.SUBSCRIPTION}/${existing.$id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          });
          exactImportIndex.set(exactKey, updated);
          nameAccountIndex.set(nameAccountKey, updated);
          nameIndex.set(nameKey, updated);
        } else {
          const created = await fetchApi<Subscription>(API_ENDPOINTS.SUBSCRIPTION, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          });
          exactImportIndex.set(exactKey, created);
          nameAccountIndex.set(nameAccountKey, created);
          nameIndex.set(nameKey, created);
        }
        successCount++;
        setImportDebugMessages((prev) => [...prev.slice(-79), `${i + 1}/${importPreview.data.length} Success ${formData.name}`]);
      } catch (error) {
        failCount++;
        const reason = error instanceof Error ? error.message : "未知錯誤";
        failureReasons.set(reason, (failureReasons.get(reason) || 0) + 1);
        setImportDebugMessages((prev) => [...prev.slice(-79), `${i + 1}/${importPreview.data.length} Failed ${formData.name}: ${reason}`]);
      }
    }

    setImporting(false);
    setImportProgress({ current: importPreview.data.length, total: importPreview.data.length });
    await loadSubscriptions();
    const failureSummary = Array.from(failureReasons.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([reason, count]) => `- ${count} 筆：${reason}`)
      .join("\n");
    setImportResult({ successCount, failCount, failureSummary });
    if (failCount === 0) {
      importAutoCloseRef.current = window.setTimeout(() => {
        setImportPreview(null);
        setImportResult(null);
        setImportDebugMessages([]);
        importAutoCloseRef.current = null;
      }, 1200);
    }
  };

  const handleCopy = (sub: Subscription) => {
    setIsInlineAdding(true);
    setInlineEditingId(null);
    setInlineAddForm({ ...toSubscriptionForm(sub), name: `${sub.name} (複製)` });
  };

  const renderSubscriptionRow = (sub: Subscription) => {
    const expiry = getSubscriptionExpiryInfo(sub);
    const isEditing = inlineEditingId === sub.$id;
    const siteHref = getSubscriptionSiteHref(sub.site);
    const similarServices = similarServiceMatches.get(sub.$id);
    const renewalLabel = sub.continue === false ? "不續訂" : "續訂中";
    const dueLabel = !sub.nextdate
      ? "未設定"
      : expiry.isExpired
        ? `已過期 ${Math.abs(expiry.daysRemaining)} 天`
        : expiry.daysRemaining === 0
          ? "今天扣款"
          : `${expiry.daysRemaining} 天後`;

    if (isEditing) {
      return (
        <TableRow key={sub.$id} className="bg-blue-50/60 dark:bg-blue-900/10">
          <TableCell colSpan={SUBSCRIPTION_TABLE_COL_SPAN}>
            <SubscriptionFormCard
              title={`編輯 ${sub.name}`}
              form={inlineEditForm}
              onChange={setInlineEditForm}
              onSave={handleInlineSave}
              onCancel={() => {
                setInlineEditingId(null);
                setInlineEditForm(INITIAL_FORM);
              }}
              existingAccounts={existingAccounts}
              tone="blue"
              saveLabel="儲存修改"
            />
          </TableCell>
        </TableRow>
      );
    }

    return (
      <TableRow key={sub.$id}>
        <TableCell className="w-10">
          <button type="button" onClick={() => toggleSelect(sub.$id)} className="text-gray-500 hover:text-blue-600">
            {selectedIds.has(sub.$id) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
          </button>
        </TableCell>
        <TableCell className="whitespace-normal align-top">
          <div className="flex items-start gap-2">
            <FaviconImage siteUrl={sub.site || ""} siteName={sub.name} size={18} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {siteHref ? (
                  <a
                    href={siteHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-full items-center gap-1 break-words font-semibold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {sub.name}
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  </a>
                ) : (
                  <div className="break-words font-semibold text-gray-900 dark:text-gray-100">{sub.name}</div>
                )}
                {similarServices ? (
                  <SimilarServicesButton
                    match={similarServices}
                    isActive={activeSimilarityView?.sourceSubscriptionId === sub.$id}
                    onToggle={(term) => handleToggleSimilarServices(sub.$id, term)}
                  />
                ) : null}
              </div>
              {sub.note ? (
                <div className="mt-0.5 whitespace-pre-wrap break-words text-xs text-gray-500 dark:text-gray-400">
                  {sub.note}
                </div>
              ) : null}
            </div>
          </div>
        </TableCell>
        <TableCell className="whitespace-normal align-top">
          <div className="text-sm text-gray-900 dark:text-gray-100">
            {sub.nextdate ? formatDate(sub.nextdate) : "-"}
          </div>
          <div
            className={`text-xs ${
              !sub.nextdate
                ? "text-gray-400"
                : expiry.isExpired
                  ? "text-red-600 dark:text-red-400"
                  : expiry.daysRemaining <= 7
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {dueLabel}
          </div>
          <div className="mt-1 break-all text-xs text-gray-500 dark:text-gray-400">
            {sub.account || "無帳號"}
          </div>
          <div className="mt-1">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                sub.continue === false
                  ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
              }`}
            >
              {renewalLabel}
            </span>
          </div>
        </TableCell>
        <TableCell className="whitespace-normal align-top">
          <SubscriptionPriceDisplay price={sub.price} currency={sub.currency} />
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={shiftingId === sub.$id}
              onClick={() => handleShiftNextDate(sub, 28)}
              className="rounded-lg border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/30"
              title="下次扣款日 +28 天並儲存"
            >
              +28天
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={shiftingId === sub.$id}
              onClick={() => handleShiftNextDate(sub, 30)}
              className="rounded-lg border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/30"
              title="下次扣款日 +30 天並儲存"
            >
              +30天
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => handleInlineEdit(sub)}
              className="rounded-lg"
              title="編輯"
              aria-label={`編輯訂閱 ${sub.name}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => handleCopy(sub)}
              className="rounded-lg"
              title="複製"
              aria-label={`複製訂閱 ${sub.name}`}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => handleDelete(sub.$id)} className="rounded-lg text-red-600">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  if (loading) return <FullPageLoading text="載入訂閱資料中..." />;

  return (
    <div className="space-y-3 lg:space-y-4">
      {error && (
        <DataCard className="border-red-200 bg-red-50 p-4 text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5" />
              <div>{error}</div>
            </div>
            {error.includes("Table subscription 不存在") && (
              <Button onClick={handleInitializeSubscriptionTable} disabled={initializingTable}>
                {initializingTable ? "初始化中..." : "立即初始化 subscription 表"}
              </Button>
            )}
          </div>
        </DataCard>
      )}

      <FriendlyAiCrudShell
        title="鋒兄訂閱"
        description="以 subscription 表長期使用的欄位為準：服務名稱、網站、價格、下次扣款、備註、帳號、幣別與是否續訂。"
        searchPlaceholder="搜尋服務名稱、網站、帳號或備註..."
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onClearSearch={clearSearchQuery}
        recentSearchKey="subscription-management"
        legacyRecentSearchKeys={LEGACY_SUBSCRIPTION_RECENT_SEARCH_KEYS}
        showRecentSearches
        density="compact"
        intro={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="font-display text-xl font-semibold tracking-tight text-[var(--foreground)] sm:text-2xl">
              鋒兄訂閱
            </h1>
            <span className="text-sm text-[var(--muted-foreground)]">
              共 {subscriptions.length} 項
            </span>
            <span className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--accent-strong)]">
              {getCurrentAccountLabel()}
            </span>
            <span className="surface-inset inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-[var(--muted-foreground)]">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              即時同步
            </span>
          </div>
        }
        activeMode={dueFilter}
        onModeChange={(mode) => setDueFilter(mode as typeof dueFilter)}
        modeItems={[
          { key: "all", label: "全部", count: subscriptions.length },
          { key: "expired", label: "已過期", count: expiredSubscriptions.length },
          { key: "7days", label: "7 天內", count: dueSoonSubscriptions.length },
          { key: "nodate", label: "未排扣款", count: noDateSubscriptions.length },
        ]}
        summaries={[
          { label: "本月月費", value: formatCurrency(stats.totalMonthlyFee), tone: "green" },
          { label: "下月月費", value: formatCurrency(stats.nextMonthFee), tone: "neutral" },
          { label: "不續訂", value: stoppedSubscriptions.length, tone: stoppedSubscriptions.length > 0 ? "amber" : "neutral" },
          { label: "訂閱總數", value: stats.total, tone: "blue" },
          { label: "續訂數量", value: renewingSubscriptions.length, detail: "目前標記為續訂中", tone: "blue" },
        ]}
        suggestions={[
          expiredSubscriptions.length > 0
            ? { title: "先處理已過期", body: `目前有 ${expiredSubscriptions.length} 筆已過期訂閱，先確認是否已停用或只是還沒更新下次扣款日。`, tone: "red" }
            : { title: "到期狀態正常", body: "目前沒有已過期訂閱，重點可放在 7 天內的項目。", tone: "green" },
          duplicateGroups.length > 0
            ? { title: "重複訂閱提醒", body: `目前有 ${duplicateGroups.length} 組可能重複的訂閱，先確認是否為不同方案，避免以為取消了其實還有別筆。`, tone: "amber" }
            : dueSoonSubscriptions.length > 0
              ? { title: "短期決策區", body: `有 ${dueSoonSubscriptions.length} 筆 7 天內要扣款，最適合先做續訂或停用決策。`, tone: "amber" }
              : { title: "短期壓力低", body: "接下來 7 天沒有即將扣款的壓力，可先補帳號與備註。", tone: "blue" },
          noDateSubscriptions.length > 0
            ? { title: "資料待補", body: `有 ${noDateSubscriptions.length} 筆沒有下次扣款日期，提醒與排序都會不準。`, tone: "neutral" }
            : stoppedSubscriptions.length > 0
              ? { title: "待清理不續訂", body: `目前有 ${stoppedSubscriptions.length} 筆標成不續訂，適合再確認是否仍要保留備註與帳號資料。`, tone: "blue" }
              : { title: "日期完整度", body: "扣款日期完整度不錯，之後最值得強化的是搜尋與批次整理。", tone: "green" },
        ]}
        toolbar={
          <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 xl:w-auto xl:flex-nowrap">
            <input ref={importInputRef} type="file" accept=".csv" onChange={handleCsvFileSelect} className="hidden" />
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button variant="outline" onClick={() => importInputRef.current?.click()} className="min-w-[9.25rem] rounded-xl">
                <Upload className="mr-1 h-4 w-4" />
                匯入 CSV
              </Button>
              <Button variant="outline" onClick={() => void exportToCSV()} className="min-w-[9.25rem] rounded-xl">
                <Download className="mr-1 h-4 w-4" />
                匯出 CSV
              </Button>
              <Button variant="outline" onClick={() => loadSubscriptions(true)} className="min-w-[8.5rem] rounded-xl" disabled={loading}>
                <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                重新整理
              </Button>
              <Button variant="outline" onClick={() => setTrashOpen(true)} className="min-w-[8.5rem] rounded-xl">
                <Trash2 className="mr-1 h-4 w-4" />
                垃圾桶 {trashedSubscriptions.length > 0 ? `(${trashedSubscriptions.length})` : ""}
              </Button>
            </div>
            <div className="contents">
              <Button variant="outline" onClick={toggleSelectAll} className="min-w-[7.5rem] rounded-xl">
                {isAllSelected ? "取消全選" : "全選"}
              </Button>
              {selectedIds.size > 0 && (
                <Button onClick={openBulkDeleteModal} className="min-w-[8.75rem] rounded-xl bg-red-600 text-white hover:bg-red-700">
                  移入垃圾桶 ({selectedIds.size})
                </Button>
              )}
              <Button
                onClick={() => {
                  resetInlineStates();
                  setIsInlineAdding(true);
                }}
                className="min-w-[12rem] rounded-xl bg-blue-600 px-6 hover:bg-blue-700"
              >
                <Plus className="mr-1 h-4 w-4" />
                新增訂閱
              </Button>
            </div>
          </div>
        }
        voicePanel={
          <VoiceCommandBar
            title="AI 語音指令"
            description="說完會自動結束 · 安全操作直接執行 · 新增／刪除仍需確認"
            helpText={SUBSCRIPTION_VOICE_HELP}
            accent="sky"
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
            placeholder="也可以打字：匯出 CSV / 搜尋 Netflix / 新增訂閱 Netflix 100 元 / 刪除選取"
            samples={["重新整理", "已過期", "7 天內", "匯出 CSV"]}
            pending={pendingVoiceCommand}
            onToggleListen={toggleVoiceInput}
            onSubmit={handleVoiceText}
            onConfirm={() => void executeVoiceCommand()}
            onCancelPending={() => setPendingVoiceCommand(null)}
          />
        }
      />

      <DataCard className="p-3">
        <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3 dark:border-gray-800">
          <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => applyQuickFilter("all")}>
            全部
          </Button>
          <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => applyQuickFilter("dueSoon")}>
            7 天內 ({dueSoonSubscriptions.length})
          </Button>
          <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => applyQuickFilter("noDate")}>
            未設定扣款日 ({noDateSubscriptions.length})
          </Button>
          <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => applyQuickFilter("stopped")}>
            不續訂 ({stoppedSubscriptions.length})
          </Button>
          {duplicateGroups.length > 0 && (
            <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => applyQuickFilter("duplicates")}>
              重複提醒 ({duplicateGroups.length})
            </Button>
          )}
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-4">
          <Select value={renewalFilter} onValueChange={(value: "all" | "renewing" | "stopped") => setRenewalFilter(value)}>
            <SelectTrigger>
              <SelectValue placeholder="續訂狀態" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部續訂狀態</SelectItem>
              <SelectItem value="renewing">續訂中</SelectItem>
              <SelectItem value="stopped">不續訂</SelectItem>
            </SelectContent>
          </Select>
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger>
              <SelectValue placeholder="扣款月份" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部月份</SelectItem>
              <SelectItem value={NO_MONTH_FILTER}>無月份 ({noDateSubscriptions.length})</SelectItem>
              {monthOptions.map((month) => (
                <SelectItem key={month.value} value={month.value}>{month.value} ({month.count})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => {
            setRenewalFilter("all");
            setDueFilter("all");
            setMonthFilter("all");
            clearSearchQuery();
          }}>
            清除篩選
          </Button>
        </div>
      </DataCard>

      {duplicateGroups.length > 0 && (
        <DataCard className="border-amber-200 bg-amber-50/80 p-3 dark:border-amber-900 dark:bg-amber-950/20">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <button
              type="button"
              onClick={() => setDuplicatesCollapsed((collapsed) => !collapsed)}
              className="flex items-center gap-2 text-left"
              aria-expanded={!duplicatesCollapsed}
              aria-controls="duplicate-reminder-content"
            >
              <ChevronUp className={`h-4 w-4 shrink-0 text-amber-700 transition-transform dark:text-amber-300 ${duplicatesCollapsed ? "rotate-180" : ""}`} />
              <span className="text-sm font-semibold text-amber-900 dark:text-amber-200">AI 重複訂閱提醒</span>
              <span className="rounded-full bg-amber-200/70 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-800/60 dark:text-amber-100">
                {duplicateGroups.length} 組
              </span>
            </button>
            {!duplicatesCollapsed && (
              <Button type="button" variant="outline" size="sm" className="border-amber-300 bg-white/80 text-amber-900 hover:bg-white dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200" onClick={() => applyQuickFilter("duplicates")}>
                查看第一組重複
              </Button>
            )}
          </div>
          {!duplicatesCollapsed && (
            <div id="duplicate-reminder-content">
              <p className="mt-1 text-sm text-amber-800/90 dark:text-amber-300/90">
                這裡只做提醒，不直接幫你刪。先確認是不是不同方案、不同帳號，避免誤清理。
              </p>
              {duplicateGroups.some((group) => group.some((sub) => sub.$id === inlineEditingId)) && (
            <div className="mt-4">
              <SubscriptionFormCard
                title={`編輯 ${inlineEditForm.name || "訂閱"}`}
                form={inlineEditForm}
                onChange={setInlineEditForm}
                onSave={handleInlineSave}
                onCancel={() => {
                  setInlineEditingId(null);
                  setInlineEditForm(INITIAL_FORM);
                }}
                existingAccounts={existingAccounts}
                tone="blue"
                saveLabel="儲存修改"
              />
            </div>
          )}
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {duplicateGroups.slice(0, 3).map((group) => {
              return (
                <div key={group.map((sub) => sub.$id).join("-")} className="rounded-2xl border border-amber-200 bg-white/80 p-4 shadow-sm dark:border-amber-900 dark:bg-gray-900/40">
                  <div className="font-semibold text-gray-900 dark:text-gray-100">{group[0]?.name}</div>
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {group.length} 筆 / {group.map((sub) => sub.account || "無帳號").join("、")}
                  </div>
                  <div className="mt-3 space-y-2">
                    {group.map((sub) => (
                      <div key={sub.$id} className="flex items-center justify-between gap-3 rounded-xl bg-amber-50/60 px-3 py-2 text-sm dark:bg-amber-950/10">
                        <div className="min-w-0">
                          <div className="truncate text-gray-900 dark:text-gray-100">{sub.account || sub.site || "無帳號"}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {formatCurrencyWithExchange(sub.price || 0, sub.currency || "TWD")}
                            {sub.nextdate ? ` / ${formatDate(sub.nextdate)}` : " / 未設定日期"}
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="shrink-0 rounded-lg"
                          onClick={() => handleInlineEdit(sub)}
                          title="編輯"
                          aria-label={`編輯訂閱 ${sub.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
            </div>
          )}
        </DataCard>
      )}

      {exporting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Export CSV</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">subscription.csv</p>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
            <div className="border-b border-gray-200 p-6 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">匯入預覽</h3>
              <p className="mt-1 text-sm text-gray-500">請確認 subscription CSV 內容是否正確</p>
            </div>
            <div className="max-h-[50vh] overflow-y-auto p-6">
              {importResult && (
                <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100">
                  <div className="font-semibold">匯入完成</div>
                  <div className="mt-1">成功：{importResult.successCount} 筆</div>
                  <div>失敗：{importResult.failCount} 筆</div>
                  {importResult.failureSummary && (
                    <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white/70 p-3 text-xs leading-5 text-blue-900 dark:bg-black/20 dark:text-blue-100">
                      {`失敗原因摘要:\n${importResult.failureSummary}`}
                    </pre>
                  )}
                </div>
              )}
              {importPreview.errors.length > 0 && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
                  <h4 className="mb-2 font-semibold text-red-600 dark:text-red-400">格式錯誤</h4>
                  <ul className="space-y-1 text-sm text-red-600 dark:text-red-400">
                    {importPreview.errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
              {importPreview.data.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-gray-700 dark:text-gray-300">將匯入 {importPreview.data.length} 筆資料</h4>
                  {importPreview.data.map((item, index) => {
                    const existing = subscriptions.find((sub) =>
                      sub.name === item.name && (sub.account || "") === (item.account || "")
                    ) || subscriptions.find((sub) => sub.name === item.name);
                    return (
                      <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">{item.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {item.account || "無帳號"} / {formatCurrencyWithExchange(item.price || 0, item.currency || "TWD")}
                          </div>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${existing ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"}`}>
                          {existing ? "更新" : "新增"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-3 border-t border-gray-200 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] dark:border-gray-700 sm:flex-row sm:justify-end">
              {importing || importResult ? (
                <div className="flex w-full flex-col gap-3 sm:max-w-xl">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-48 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                      <div
                        className="h-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      匯入中 {importProgress.current}/{importProgress.total}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm font-semibold text-gray-800 dark:text-gray-100">
                      <span>Import Debug Console Output</span>
                      <span className="text-xs font-normal text-gray-500 dark:text-gray-400">{importDebugMessages.length} entries</span>
                    </div>
                    <div className="max-h-48 overflow-y-auto rounded-xl bg-gray-900 px-3 py-2 text-xs leading-5 text-green-200">
                      {importDebugMessages.length > 0 ? (
                        importDebugMessages.map((message, index) => (
                          <div key={`${index}-${message}`} className="border-b border-white/5 py-1 last:border-b-0">
                            {message}
                          </div>
                        ))
                      ) : (
                        <div className="text-gray-400">Waiting for import logs...</div>
                      )}
                    </div>
                  </div>
                  {importResult && (
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (importAutoCloseRef.current) {
                            clearTimeout(importAutoCloseRef.current);
                            importAutoCloseRef.current = null;
                          }
                          setImportPreview(null);
                          setImportResult(null);
                          setImportDebugMessages([]);
                        }}
                      >
                        完成
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (importAutoCloseRef.current) {
                        clearTimeout(importAutoCloseRef.current);
                        importAutoCloseRef.current = null;
                      }
                      setImportPreview(null);
                      setImportResult(null);
                      setImportDebugMessages([]);
                    }}
                  >
                    取消
                  </Button>
                  <Button onClick={executeImport} disabled={importPreview.data.length === 0 || importPreview.errors.length > 0}>
                    確認匯入 ({importPreview.data.length} 筆)
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {trashOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-5 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">訂閱垃圾桶</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">移入的訂閱可在此還原；清空後無法復原。</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setTrashOpen(false)}>關閉</Button>
            </div>
            <div className="max-h-[52vh] space-y-2 overflow-y-auto p-5">
              {trashedSubscriptions.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">垃圾桶目前是空的。</p>
              ) : trashedSubscriptions.map((item) => (
                <div key={item.subscription.$id} className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-gray-900 dark:text-gray-100">{item.subscription.name}</div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">移入時間：{new Date(item.deletedAt).toLocaleString("zh-TW")}</div>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => void restoreFromTrash(item)}>
                    <ArchiveRestore className="mr-1 h-4 w-4" />
                    還原
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex justify-end border-t border-gray-200 p-4 dark:border-gray-700">
              <Button variant="outline" disabled={trashedSubscriptions.length === 0} onClick={clearTrash} className="text-red-600 hover:text-red-700">
                <Trash2 className="mr-1 h-4 w-4" />
                清空垃圾桶
              </Button>
            </div>
          </div>
        </div>
      )}

      {bulkDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-w-2xl w-full rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
            <div className="border-b border-gray-200 p-6 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-red-500" />
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">批次刪除訂閱</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    將刪除 <span className="font-semibold text-red-600">{selectedIds.size}</span> 筆訂閱資料，此操作無法復原。
                  </p>
                </div>
              </div>
            </div>

            {isDeleting ? (
              <div className="space-y-4 p-6">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 shrink-0 animate-spin rounded-full border-b-2 border-red-600" />
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    正在刪除中... ({deleteProgress} / {deleteTotal} 筆)
                  </p>
                </div>
                <div className="h-2.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-2.5 rounded-full bg-red-500 transition-all duration-300"
                    style={{ width: `${deleteTotal > 0 ? (deleteProgress / deleteTotal) * 100 : 0}%` }}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm font-semibold text-gray-800 dark:text-gray-100">
                    <span>Debug console output</span>
                    <span className="text-xs font-normal text-gray-500 dark:text-gray-400">{deleteDebugMessages.length} 筆</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto rounded-xl bg-gray-900 px-3 py-2 text-xs leading-5 text-green-200">
                    {deleteDebugMessages.map((message, index) => (
                      <div key={`${index}-${message}`} className="border-b border-white/5 py-1 last:border-b-0">
                        {message}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 p-6">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  請先輸入下面的刪除口令，確認你要將選取訂閱移入垃圾桶。
                </p>
                <code className="block rounded-lg bg-gray-100 px-3 py-2 text-sm font-mono text-red-600 dark:bg-gray-800">
                  {SUBSCRIPTION_DELETE_CONFIRMATION}
                </code>
                <Input
                  ref={bulkDeleteInputRef}
                  autoFocus
                  value={bulkDeleteInput}
                  onChange={(event) => setBulkDeleteInput(event.target.value)}
                  placeholder={`輸入 ${SUBSCRIPTION_DELETE_CONFIRMATION}`}
                  className="font-mono"
                />
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm font-semibold text-gray-800 dark:text-gray-100">
                    <span>Debug console output</span>
                    <span className="text-xs font-normal text-gray-500 dark:text-gray-400">{deleteDebugMessages.length} 筆</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto rounded-xl bg-gray-900 px-3 py-2 text-xs leading-5 text-green-200">
                    {deleteDebugMessages.length > 0 ? (
                      deleteDebugMessages.map((message, index) => (
                        <div key={`${index}-${message}`} className="border-b border-white/5 py-1 last:border-b-0">
                          {message}
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-400">刪除尚未開始，送出後會顯示每筆刪除結果。</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-gray-200 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] dark:border-gray-700 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setBulkDeleteOpen(false);
                  setBulkDeleteInput("");
                  setDeleteDebugMessages([]);
                }}
                disabled={isDeleting}
              >
                取消
              </Button>
              <Button
                onClick={handleDeleteSelected}
                disabled={bulkDeleteInput !== SUBSCRIPTION_DELETE_CONFIRMATION || isDeleting}
                className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? "移入中..." : `移入垃圾桶 (${selectedIds.size} 筆)`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {isInlineAdding && (
        <SubscriptionFormCard
          title="快速新增"
          form={inlineAddForm}
          onChange={setInlineAddForm}
          onSave={handleInlineAddSave}
          onCancel={() => {
            setIsInlineAdding(false);
            setInlineAddForm(INITIAL_FORM);
          }}
          existingAccounts={existingAccounts}
          tone="green"
          saveLabel="建立訂閱"
        />
      )}

      {filteredSubscriptions.length === 0 ? (
        <EmptyState
          icon={<Search className="h-10 w-10" />}
          title={subscriptions.length === 0 ? "尚無訂閱資料" : "無搜尋結果"}
          description={
            subscriptions.length === 0
              ? "從上方快速新增第一筆訂閱資料。"
              : searchScope === "service-note"
                ? `找不到服務名稱或備註包含「${searchQuery}」的訂閱。`
                : `找不到符合「${searchQuery}」與目前篩選條件的訂閱。`
          }
        />
      ) : (
        <>
          <div className="hidden lg:block">
            <DataCard className="overflow-hidden">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">選取</TableHead>
                    <TableHead className="w-[34%]">服務 / 備註</TableHead>
                    <TableHead className="w-[28%]">下次扣款 / 帳號 / 續訂</TableHead>
                    <TableHead className="w-[18%]">價格</TableHead>
                    <TableHead className="w-[14%]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubscriptions.map(renderSubscriptionRow)}
                </TableBody>
              </Table>
            </DataCard>
          </div>

          <div className="space-y-2 lg:hidden">
            {filteredSubscriptions.map((sub) => {
              const expiry = getSubscriptionExpiryInfo(sub);
              const isEditing = inlineEditingId === sub.$id;
              const siteHref = getSubscriptionSiteHref(sub.site);
              const similarServices = similarServiceMatches.get(sub.$id);

              if (isEditing) {
                return (
                  <SubscriptionFormCard
                    key={sub.$id}
                    title={`編輯 ${sub.name}`}
                    form={inlineEditForm}
                    onChange={setInlineEditForm}
                    onSave={handleInlineSave}
                    onCancel={() => {
                      setInlineEditingId(null);
                      setInlineEditForm(INITIAL_FORM);
                    }}
                    existingAccounts={existingAccounts}
                    tone="blue"
                    saveLabel="儲存修改"
                  />
                );
              }

              return (
                <DataCard key={sub.$id} className="p-3">
                  <div className="flex items-start gap-3">
                    <button type="button" onClick={() => toggleSelect(sub.$id)} className="mt-1 text-gray-500 hover:text-blue-600">
                      {selectedIds.has(sub.$id) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                    </button>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <FaviconImage siteUrl={sub.site || ""} siteName={sub.name} size={18} />
                        {siteHref ? (
                          <a
                            href={siteHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline dark:text-blue-400"
                          >
                            {sub.name}
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <div className="font-semibold text-gray-900 dark:text-gray-100">{sub.name}</div>
                        )}
                        {similarServices ? (
                          <SimilarServicesButton
                            match={similarServices}
                            isActive={activeSimilarityView?.sourceSubscriptionId === sub.$id}
                            onToggle={(term) => handleToggleSimilarServices(sub.$id, term)}
                          />
                        ) : null}
                      </div>
                      {sub.note ? (
                        <div className="mt-1 whitespace-pre-wrap break-words text-xs text-gray-500 dark:text-gray-400">
                          {sub.note}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-2.5 space-y-1.5 text-sm">
                    <div>
                      <div className="text-gray-900 dark:text-gray-100">
                        {sub.nextdate ? formatDate(sub.nextdate) : "未設定扣款日"}
                      </div>
                      <div
                        className={`text-xs ${
                          !sub.nextdate
                            ? "text-gray-400"
                            : expiry.isExpired
                              ? "text-red-600 dark:text-red-400"
                              : expiry.daysRemaining <= 7
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {!sub.nextdate
                          ? "未設定"
                          : expiry.isExpired
                            ? `已過期 ${Math.abs(expiry.daysRemaining)} 天`
                            : expiry.daysRemaining === 0
                              ? "今天扣款"
                              : `${expiry.daysRemaining} 天後`}
                      </div>
                      <div className="mt-1 break-all text-xs text-gray-500 dark:text-gray-400">
                        {sub.account || "無帳號"}
                      </div>
                      <div className="mt-1">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            sub.continue === false
                              ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                          }`}
                        >
                          {sub.continue === false ? "不續訂" : "續訂中"}
                        </span>
                      </div>
                    </div>
                    <SubscriptionPriceDisplay price={sub.price} currency={sub.currency} />
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={shiftingId === sub.$id}
                      onClick={() => handleShiftNextDate(sub, 28)}
                      className="rounded-lg border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/30"
                      title="下次扣款日 +28 天並儲存"
                    >
                      +28天
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={shiftingId === sub.$id}
                      onClick={() => handleShiftNextDate(sub, 30)}
                      className="rounded-lg border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/30"
                      title="下次扣款日 +30 天並儲存"
                    >
                      +30天
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => handleInlineEdit(sub)} className="rounded-lg">
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      編輯
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopy(sub)}
                      className="rounded-lg"
                      title="複製"
                      aria-label={`複製訂閱 ${sub.name}`}
                    >
                      <Copy className="mr-1 h-3.5 w-3.5" />
                      複製
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => handleDelete(sub.$id)} className="rounded-lg text-red-600">
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      刪除
                    </Button>
                  </div>
                </DataCard>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
