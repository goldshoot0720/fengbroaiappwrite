"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import ReactDOM from "react-dom";
import { Plus, Minus, Search, Download, Upload, X, Copy, Trash2, Pencil, Check, Square, CheckSquare, ChevronDown, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionHeader } from "@/components/ui/section-header";

import { DataCard, DataCardList, DataCardItem } from "@/components/ui/data-card";
import { EmptyState } from "@/components/ui/empty-state";
import { FullPageLoading } from "@/components/ui/loading-spinner";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatCard } from "@/components/ui/stat-card";
import { useSubscriptions, getSubscriptionExpiryInfo } from "@/hooks/useSubscriptions";
import { fetchApi } from "@/hooks/useApi";
import { API_ENDPOINTS } from "@/lib/constants";
import { SubscriptionFormData, Subscription } from "@/types";
import { FaviconImage } from "@/components/ui/favicon-image";
import { formatDate, formatDaysRemaining, formatCurrency, formatCurrencyWithExchange, convertToTWD } from "@/lib/formatters";

// 帳號下拉選單組件：可選擇已有帳號或自行輸入（使用 Portal 避免被父層裁切）
function AccountComboBox({ value, onChange, accounts, className = "" }: {
  value: string;
  onChange: (value: string) => void;
  accounts: string[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  // 同步外部 value
  useEffect(() => { setInputValue(value); }, [value]);

  // 計算下拉選單位置
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

  // 點擊外部關閉
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [open]);

  // 滾動或 resize 時更新位置
  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  const filtered = accounts.filter(a => a.toLowerCase().includes(inputValue.toLowerCase()));

  const handleOpen = () => {
    updatePosition();
    setOpen(true);
  };

  const handleSelect = (a: string) => {
    setInputValue(a);
    onChange(a);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative flex-1 ${className}`}>
      <div className="relative">
        <Input
          ref={inputRef}
          placeholder="帳號（選擇或輸入）"
          value={inputValue}
          onChange={(e) => { setInputValue(e.target.value); onChange(e.target.value); handleOpen(); }}
          onFocus={handleOpen}
          className="pr-8"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => { if (open) { setOpen(false); } else { handleOpen(); } }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
      {open && filtered.length > 0 && typeof document !== "undefined" &&
        ReactDOM.createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="max-h-48 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
          >
            {filtered.map(a => (
              <div
                key={a}
                role="option"
                aria-selected={a === value}
                className={`w-full text-left px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 dark:hover:bg-gray-700 ${a === value ? "bg-blue-50 dark:bg-gray-700 font-medium" : ""}`}
                onClick={() => handleSelect(a)}
                onTouchEnd={(e) => { e.preventDefault(); handleSelect(a); }}
              >
                {a}
              </div>
            ))}
          </div>,
          document.body
        )
      }
    </div>
  );
}

const INITIAL_FORM: SubscriptionFormData = { name: "", site: "", price: 0, nextdate: "", note: "", account: "", currency: "TWD", continue: true };

export default function SubscriptionManagement() {
  const { subscriptions, loading, error, stats, createSubscription, createSubscriptionSilent, updateSubscription, updateSubscriptionSilent, deleteSubscription, loadSubscriptions } = useSubscriptions();
  const [canAskNotification, setCanAskNotification] = useState(false);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [expandedNames, setExpandedNames] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [continueFilter, setContinueFilter] = useState<"all" | "yes" | "no">("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");

  // Inline editing state
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineEditForm, setInlineEditForm] = useState<SubscriptionFormData>(INITIAL_FORM);

  // Inline add state
  const [isInlineAdding, setIsInlineAdding] = useState(false);
  const [inlineAddForm, setInlineAddForm] = useState<SubscriptionFormData>(INITIAL_FORM);

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);

  // Selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteInput, setBulkDeleteInput] = useState("");
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

  // 從訂閱資料中取得可用的年月選項
  const monthOptions = useMemo(() => {
    const months = new Set<string>();
    subscriptions.forEach(sub => {
      if (sub.nextdate) {
        const d = new Date(sub.nextdate);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        months.add(ym);
      }
    });
    return Array.from(months).sort();
  }, [subscriptions]);

  // 搜尋過濾 + 續訂篩選 + 年月篩選
  const filteredSubscriptions = useMemo(() => {
    let result = subscriptions;

    // 續訂篩選
    if (continueFilter === "yes") {
      result = result.filter(sub => sub.continue !== false);
    } else if (continueFilter === "no") {
      result = result.filter(sub => sub.continue === false);
    }

    // 年月篩選
    if (monthFilter !== "all") {
      if (monthFilter === "none") {
        result = result.filter(sub => !sub.nextdate);
      } else {
        result = result.filter(sub => {
          if (!sub.nextdate) return false;
          const d = new Date(sub.nextdate);
          const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          return ym === monthFilter;
        });
      }
    }

    // 搜尋過濾
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(sub =>
        sub.name?.toLowerCase().includes(query) ||
        sub.site?.toLowerCase().includes(query) ||
        sub.account?.toLowerCase().includes(query) ||
        sub.note?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [subscriptions, searchQuery, continueFilter, monthFilter]);

  // 取得所有已存在的帳號（去重）
  const existingAccounts = useMemo(() => {
    const accounts = subscriptions
      .map(sub => sub.account)
      .filter((a): a is string => !!a && a.trim() !== "");
    return [...new Set(accounts)].sort();
  }, [subscriptions]);

  // Selection helpers (after filteredSubscriptions)
  const isAllSelected = filteredSubscriptions.length > 0 && filteredSubscriptions.every(sub => selectedIds.has(sub.$id));
  const handleSelectAll = () => {
    if (!selectionMode) {
      setSelectionMode(true);
      setSelectedIds(new Set(filteredSubscriptions.map(sub => sub.$id).filter(Boolean)));
    } else if (filteredSubscriptions.length > 0 && filteredSubscriptions.every(sub => selectedIds.has(sub.$id))) {
      setSelectedIds(new Set());
      setSelectionMode(false);
    } else {
      setSelectedIds(new Set(filteredSubscriptions.map(sub => sub.$id).filter(Boolean)));
    }
  };

  // 批量刪除選中的項目
  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds).filter(id => !!id);
    setDeleteTotal(ids.length);
    setDeleteProgress(0);
    setIsDeleting(true);
    await Promise.all(ids.map(id =>
      fetchApi(`${API_ENDPOINTS.SUBSCRIPTION}/${id}`, { method: 'DELETE' })
        .catch(err => console.error("Delete failed:", err))
        .finally(() => setDeleteProgress(prev => prev + 1))
    ));
    setIsDeleting(false);
    setSelectedIds(new Set());
    setSelectionMode(false);
    setBulkDeleteOpen(false);
    setBulkDeleteInput("");
    loadSubscriptions();
  };

  // keep old alias for inline usage
  const toggleSelectAll = handleSelectAll;
  const deleteSelected = () => setBulkDeleteOpen(true);

  const truncateName = (name: string, id: string) => {
    const isExpanded = expandedNames.has(id);
    if (name.length <= 37 || isExpanded) {
      return name;
    }
    return name.substring(0, 37);
  };

  const toggleNameExpansion = (id: string) => {
    setExpandedNames(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof Notification === "undefined") return;
    setCanAskNotification(true);
    if (Notification.permission === "granted") {
      setNotificationEnabled(true);
    }
  }, []);

  // 發送 3 天內到期訂閱通知（每個項目一條）
  const sendSubscriptionNotifications = async () => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    if (!subscriptions.length) return;

    const today = new Date().toISOString().slice(0, 10);
    const items = subscriptions
      .map((sub) => {
        const info = getSubscriptionExpiryInfo(sub);
        return { sub, daysRemaining: info.daysRemaining };
      })
      .filter(({ daysRemaining }) => daysRemaining >= 0 && daysRemaining <= 3);

    if (items.length === 0) return;

    const storageKey = "dashboardNotificationDaily";
    let notified: Record<string, string> = {};
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) notified = JSON.parse(raw) as Record<string, string>;
    } catch {}

    const updated = { ...notified };
    let hasNew = false;

    for (const { sub, daysRemaining } of items) {
      const key = `sub-${sub.$id}-${sub.nextdate}-${today}`;
      if (notified[key] === "shown") continue;

      try {
        if ("serviceWorker" in navigator) {
          const reg = await navigator.serviceWorker.ready;
          await reg.showNotification("訂閱即將到期提醒", {
            body: `${sub.name} 將在 ${daysRemaining} 天內到期`,
            icon: "/favicon.ico",
            tag: `sub-${sub.$id}`,
          });
        } else {
          new Notification("訂閱即將到期提醒", {
            body: `${sub.name} 將在 ${daysRemaining} 天內到期`,
            icon: "/favicon.ico",
            tag: `sub-${sub.$id}`,
          });
        }
        updated[key] = "shown";
        hasNew = true;
      } catch {}
    }

    if (hasNew) {
      try { window.localStorage.setItem(storageKey, JSON.stringify(updated)); } catch {}
    }
  };

  // 頁面載入時自動發送通知
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new Date().getHours() < 6) return;
    sendSubscriptionNotifications();
  }, [subscriptions]);

  // 清理過期的 localStorage 通知記錄（保留 7 天內的）
  useEffect(() => {
    try {
      const storageKey = "dashboardNotificationDaily";
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const notified = JSON.parse(raw) as Record<string, string>;
      const now = new Date();
      const cleaned: Record<string, string> = {};
      for (const [key, val] of Object.entries(notified)) {
        const parts = key.split("-");
        const dateStr = parts[parts.length - 1];
        if (dateStr && dateStr.length === 10) {
          const diff = (now.getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
          if (diff <= 7) cleaned[key] = val;
        }
      }
      window.localStorage.setItem(storageKey, JSON.stringify(cleaned));
    } catch {}
  }, [subscriptions]);

  const handleEnableNotification = async () => {
    if (typeof Notification === "undefined") {
      alert("此瀏覽器不支援通知功能");
      return;
    }

    if (Notification.permission === "granted") {
      setNotificationEnabled(true);
      // 直接發送實際到期項目通知
      await sendSubscriptionNotifications();
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setNotificationEnabled(true);
      // 授權後立刻發送實際到期項目通知
      await sendSubscriptionNotifications();
    } else if (permission === "denied") {
      alert("瀏覽器已拒絕通知權限，請至瀏覽器設定開啟");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("確定刪除？")) return;
    try {
      await deleteSubscription(id);
    } catch (error) {
      console.error('Delete subscription failed:', error);
      const errorMessage = error instanceof Error ? error.message : '刪除失敗，請稍後再試';
      alert(errorMessage);
    }
  };

  // 開始行內編輯
  const handleInlineEdit = (sub: Subscription) => {
    setInlineEditForm({
      name: sub.name,
      site: sub.site,
      price: sub.price !== undefined && sub.price !== null && sub.price !== 0 ? sub.price : 0,
      nextdate: sub.nextdate ? formatDate(sub.nextdate) : "",
      note: sub.note || "",
      account: sub.account || "",
      currency: sub.currency || "TWD",
      continue: sub.continue !== false
    });
    setInlineEditingId(sub.$id);
  };

  // 儲存行內編輯
  const handleInlineSave = async () => {
    if (!inlineEditingId) return;
    try {
      const formDataToSend = {
        ...inlineEditForm,
        price: inlineEditForm.price !== undefined && inlineEditForm.price !== null ? inlineEditForm.price : 0
      };
      await updateSubscription(inlineEditingId, formDataToSend);
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
    setInlineEditingId(null);
    setInlineEditForm(INITIAL_FORM);
  };

  // 開始行內新增
  const startInlineAdd = () => {
    setIsInlineAdding(true);
    setInlineAddForm(INITIAL_FORM);
    // 關閉其他編輯狀態
    setInlineEditingId(null);
    setInlineEditForm(INITIAL_FORM);
  };

  // 儲存行內新增
  const handleInlineAddSave = async () => {
    if (!inlineAddForm.name.trim()) {
      alert('請輸入服務名稱');
      return;
    }
    try {
      const formDataToSend = {
        ...inlineAddForm,
        price: inlineAddForm.price !== undefined && inlineAddForm.price !== null ? inlineAddForm.price : 0
      };
      await createSubscription(formDataToSend);
      setIsInlineAdding(false);
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
    setInlineAddForm(INITIAL_FORM);
  };

  const handleCopy = (sub: Subscription) => {
    setInlineAddForm({
      name: `${sub.name} (複製)`,
      site: sub.site,
      price: sub.price !== undefined && sub.price !== null && sub.price !== 0 ? sub.price : 0,
      nextdate: sub.nextdate ? formatDate(sub.nextdate) : "",
      note: sub.note || "",
      account: sub.account || "",
      currency: sub.currency || "TWD",
      continue: sub.continue !== false
    });
    setIsInlineAdding(true);
    setInlineEditingId(null);
    setInlineEditForm(INITIAL_FORM);
    setTimeout(() => {
      document.getElementById("sub-inline-add")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  // CSV 匯入/匯出功能
  const [importPreview, setImportPreview] = useState<{ data: SubscriptionFormData[], errors: string[] } | null>(null);
  const [importFormat, setImportFormat] = useState<'appwrite' | 'supabase' | null>(null);
  const [pendingCSVText, setPendingCSVText] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  const CSV_HEADERS = ['name', 'site', 'price', 'nextdate', 'note', 'account', 'currency', 'continue'];
  const EXPECTED_COLUMN_COUNT = CSV_HEADERS.length; // 8 欄
  const SUPABASE_SUBSCRIPTION_HEADERS = ['服務名稱', '網站網址', '帳號/Email', '月費(NT$)', '下次扣款日期', '備註'];

  // 解析單行 CSV
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuotes) {
        if (char === '"') {
          if (line[i + 1] === '"') { current += '"'; i++; }
          else { inQuotes = false; }
        } else { current += char; }
      } else {
        if (char === '"') { inQuotes = true; }
        else if (char === ',') { result.push(current); current = ''; }
        else { current += char; }
      }
    }
    result.push(current);
    return result;
  };

  // 解析完整 CSV（處理多行欄位）
  const parseFullCSV = (text: string): string[][] => {
    const rows: string[][] = [];
    const cleanText = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < cleanText.length; i++) {
      const char = cleanText[i];

      if (inQuotes) {
        if (char === '"') {
          if (cleanText[i + 1] === '"') {
            // 雙引號跳脫
            currentField += '"';
            i++;
          } else {
            // 結束引號
            inQuotes = false;
          }
        } else {
          // 在引號內，保留所有字元（包含換行）
          currentField += char;
        }
      } else {
        if (char === '"') {
          // 開始引號
          inQuotes = true;
        } else if (char === ',') {
          // 欄位分隔
          currentRow.push(currentField);
          currentField = '';
        } else if (char === '\n') {
          // 行結束
          currentRow.push(currentField);
          if (currentRow.length > 0 && currentRow.some(f => f.trim())) {
            rows.push(currentRow);
          }
          currentRow = [];
          currentField = '';
        } else {
          currentField += char;
        }
      }
    }

    // 處理最後一行
    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField);
      if (currentRow.some(f => f.trim())) {
        rows.push(currentRow);
      }
    }

    return rows;
  };

  const detectCSVFormat = (text: string): 'appwrite' | 'supabase' | 'unknown' => {
    const rows = parseFullCSV(text);
    if (rows.length === 0) return 'unknown';
    const headers = rows[0].map(h => h.trim());
    if (headers.includes('name')) return 'appwrite';
    if (headers.includes('服務名稱')) return 'supabase';
    return 'unknown';
  };

  const convertSupabaseSubscription = (text: string): string => {
    const cleanText = text.replace(/^\uFEFF/, '');
    const lines = cleanText.split('\n').filter(line => line.trim());
    if (lines.length < 1) return text;

    const newLines: string[] = [CSV_HEADERS.join(',')];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      // Supabase: 服務名稱, 網站網址, 帳號/Email, 月費(NT$), 下次扣款日期, 備註
      // Appwrite: name, site, price, nextdate, note, account, currency, continue
      const name = values[0]?.trim() || '';
      const site = values[1]?.trim() || '';
      const account = values[2]?.trim() || '';
      const price = values[3]?.trim() || '0';
      const nextdate = values[4]?.trim() || '';
      const note = values[5]?.trim() || '';
      const currency = 'TWD';
      const continueVal = 'true';

      const escapeCSV = (val: string) => {
        if (val.includes(',') || val.includes('"') || val.includes('\n')) return `"${val.replace(/"/g, '""')}"`;
        return val;
      };
      newLines.push([escapeCSV(name), escapeCSV(site), escapeCSV(price), escapeCSV(nextdate), escapeCSV(note), escapeCSV(account), escapeCSV(currency), escapeCSV(continueVal)].join(','));
    }
    return newLines.join('\n');
  };

  // 匯出 CSV
  const exportToCSV = () => {
    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = [CSV_HEADERS.join(',')];
    subscriptions.forEach(sub => {
      const row = [
        escapeCSV(sub.name),
        escapeCSV(sub.site || ''),
        escapeCSV(sub.price || 0),
        escapeCSV(sub.nextdate || ''),
        escapeCSV(sub.note || ''),
        escapeCSV(sub.account || ''),
        escapeCSV(sub.currency || 'TWD'),
        escapeCSV(sub.continue !== false ? 'true' : 'false'),
      ];
      rows.push(row.join(','));
    });

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'appwrite-Subscription.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // 解析 CSV
  const parseCSV = (text: string): { data: SubscriptionFormData[], errors: string[] } => {
    const errors: string[] = [];
    const data: SubscriptionFormData[] = [];

    const rows = parseFullCSV(text);

    if (rows.length < 2) {
      errors.push('CSV 檔案至少需要表頭和一行資料');
      return { data, errors };
    }

    const headerValues = rows[0].map(h => h.trim());
    if (headerValues.length !== EXPECTED_COLUMN_COUNT) {
      errors.push(`表頭欄位數量錯誤: 預期 ${EXPECTED_COLUMN_COUNT} 欄，實際 ${headerValues.length} 欄`);
      if (headerValues.length > EXPECTED_COLUMN_COUNT) errors.push(`→ 多了 ${headerValues.length - EXPECTED_COLUMN_COUNT} 欄`);
      else errors.push(`→ 少了 ${EXPECTED_COLUMN_COUNT - headerValues.length} 欄`);
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
      const values = rows[i];
      const lineNum = i + 1;
      if (values.length !== EXPECTED_COLUMN_COUNT) {
        errors.push(`第 ${lineNum} 行: 欄位數量錯誤 (預期 ${EXPECTED_COLUMN_COUNT}，實際 ${values.length})`);
        continue;
      }
      if (!values[0]?.trim()) {
        errors.push(`第 ${lineNum} 行: name 欄位不能為空`);
        continue;
      }
      data.push({
        name: values[0].trim(),
        site: values[1]?.trim() || '',
        price: parseFloat(values[2]) || 0,
        nextdate: values[3]?.trim() || '',
        note: values[4]?.trim() || '',
        account: values[5]?.trim() || '',
        currency: values[6]?.trim() || 'TWD',
        continue: values[7]?.trim().toLowerCase() !== 'false',
      });
    }
    return { data, errors };
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) { alert('請選擇 CSV 檔案'); return; }
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const format = detectCSVFormat(text);

      if (format === 'appwrite') {
        setImportPreview(parseCSV(text));
      } else if (format === 'supabase') {
        setImportFormat('supabase');
        setPendingCSVText(text);
      } else {
        alert('無法辨識 CSV 格式：表頭不符合 Appwrite 或 Supabase 格式');
      }
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const confirmSupabaseSubscriptionImport = () => {
    const converted = convertSupabaseSubscription(pendingCSVText);
    setImportPreview(parseCSV(converted));
    setImportFormat(null);
    setPendingCSVText('');
  };

  const cancelSupabaseSubscriptionImport = () => {
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
        const existing = subscriptions.find(s => s.name === formData.name && s.site === formData.site);
        if (existing) {
          await updateSubscriptionSilent(existing.$id, formData);
        } else {
          await createSubscriptionSilent(formData);
        }
        successCount++;
      } catch { failCount++; }
    }

    // 匯入完成後統一重新載入一次
    await loadSubscriptions();

    setImporting(false);
    setImportProgress({ current: 0, total: 0 });
    setImportPreview(null);
    alert(`匯入完成！\n成功: ${successCount} 筆\n失敗: ${failCount} 筆`);
  };

  if (loading) return <FullPageLoading text="載入訂閱資料中..." />;

  return (
    <div className="space-y-4 lg:space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <SectionHeader
        title="鋒兄訂閱"
        subtitle={`共 ${stats.total} 個訂閱服務`}
        showAccountLabel={true}
        action={
          <div className="flex gap-4">
            <StatCard title="本月月費" value={formatCurrency(stats.totalMonthlyFee)} gradient="from-blue-500 to-blue-600" className="min-w-[160px]" />
            <StatCard title="下月月費" value={formatCurrency(stats.nextMonthFee)} gradient="from-purple-500 to-purple-600" className="min-w-[160px]" />
          </div>
        }
      />

      {canAskNotification && !notificationEnabled && (
        <div className="flex items-center justify-between rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          <span>可以在此裝置啟用訂閱到期通知</span>
          <Button type="button" size="sm" variant="outline" onClick={handleEnableNotification} className="rounded-lg">
            啟用通知
          </Button>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <input type="file" accept=".csv" onChange={handleFileSelect} className="hidden" id="csv-import-subscription" />
        <Button onClick={() => document.getElementById('csv-import-subscription')?.click()} variant="outline" className="rounded-xl flex items-center gap-2" title="匯入 CSV">
          <Upload size={18} /> 匯入
        </Button>
        <Button onClick={exportToCSV} variant="outline" className="rounded-xl flex items-center gap-2" title="匯出 CSV">
          <Download size={18} /> 匯出
        </Button>
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
                    <span className="text-gray-700 dark:text-gray-300 font-medium">服務名稱</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono">name</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">網站網址</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono">site</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">帳號/Email</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono">account</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">月費(NT$)</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono">price</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">下次扣款日期</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono">nextdate</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">備註</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono">note</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">(無)</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono">currency (預設 TWD)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">(無)</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono">continue (預設 true)</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <Button variant="outline" onClick={cancelSupabaseSubscriptionImport} className="rounded-xl">取消</Button>
              <Button onClick={confirmSupabaseSubscriptionImport} className="rounded-xl bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white">
                確認轉換並匯入
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 匯入預覽對話框 */}
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
                      const existing = subscriptions.find(s => s.name === item.name && s.site === item.site);
                      return (
                        <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <span className="font-medium text-gray-900 dark:text-gray-100">{item.name}</span>
                          <span className="text-xs text-gray-500">{item.price} {item.currency}</span>
                          {existing ? (
                            <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded">更新</span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded">新增</span>
                          )}
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
                  <Button onClick={executeImport} disabled={importPreview.data.length === 0 || importPreview.errors.length > 0} className="rounded-xl bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed">
                    確認匯入 ({importPreview.data.length} 筆)
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 搜尋欄位 + 續訂篩選 */}
      {subscriptions.length > 0 && (
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              placeholder="搜尋服務名稱、網站、帳號、備註..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 rounded-xl"
            />
          </div>
          <Button onClick={handleSelectAll} variant="outline" className="h-12 px-4 rounded-xl flex items-center gap-2 shrink-0">
            {selectionMode && filteredSubscriptions.length > 0 && filteredSubscriptions.every(sub => selectedIds.has(sub.$id)) ? "取消全選" : "全選"}
          </Button>
          {selectedIds.size > 0 && (
            <Button onClick={() => setBulkDeleteOpen(true)} className="h-12 px-4 rounded-xl flex items-center gap-2 shrink-0 bg-red-600 hover:bg-red-700 text-white">
              <Trash2 size={18} />
              刪除選取 ({selectedIds.size})
            </Button>
          )}
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="h-12 rounded-xl w-32 shrink-0">
              <SelectValue placeholder="年月" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部月份</SelectItem>
              {monthOptions.map(ym => (
                <SelectItem key={ym} value={ym}>{ym}</SelectItem>
              ))}
              <SelectItem value="none">無日期</SelectItem>
            </SelectContent>
          </Select>
          <Select value={continueFilter} onValueChange={(value: "all" | "yes" | "no") => setContinueFilter(value)}>
            <SelectTrigger className="h-12 rounded-xl w-28 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="yes">續訂</SelectItem>
              <SelectItem value="no">不續</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <DataCard>
        {error ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="text-6xl mb-4">⚠️</div>
            <h3 className="text-lg font-semibold text-yellow-600 dark:text-yellow-400 mb-2">
              {error}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              請至「鋒兄設定」頁面初始化資料庫
            </p>
          </div>
        ) : subscriptions.length === 0 ? (
          <EmptyState emoji="💳" title="暫無訂閱資料" description="點擊上方表單新增第一個訂閱" />
        ) : filteredSubscriptions.length === 0 ? (
          <EmptyState emoji="🔍" title="無搜尋結果" description={`找不到「${searchQuery}」相關的訂閱`} />
        ) : (
          <>
            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50 dark:bg-gray-700/50">
                    <TableHead className="font-semibold">
                      <div className="flex items-center gap-2">
                        服務名稱
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            if (isInlineAdding) {
                              cancelInlineAdd();
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
                              // 關閉編輯模式時，取消正在編輯的項目
                              setInlineEditingId(null);
                              setInlineEditForm(INITIAL_FORM);
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
                    <TableHead className="font-semibold">下次付款日期</TableHead>
                    <TableHead className="font-semibold">月費</TableHead>
                    <TableHead className="font-semibold">續訂</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* 行內新增列 (桌面版) */}
                  {isInlineAdding && (
                    <TableRow id="sub-inline-add" className="bg-green-50 dark:bg-green-900/20">
                      <TableCell className="font-medium">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-14 shrink-0">名稱</span>
                            <Input
                              placeholder="服務名稱"
                              value={inlineAddForm.name}
                              onChange={(e) => setInlineAddForm({ ...inlineAddForm, name: e.target.value })}
                              className="h-9 rounded-lg text-sm"
                              required
                              autoFocus
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-14 shrink-0">網站</span>
                            <Input
                              placeholder="網站 URL"
                              type="url"
                              value={inlineAddForm.site || ""}
                              onChange={(e) => setInlineAddForm({ ...inlineAddForm, site: e.target.value })}
                              className="h-9 rounded-lg text-sm"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-14 shrink-0">帳號</span>
                            <AccountComboBox
                              value={inlineAddForm.account || ""}
                              onChange={(v) => setInlineAddForm({ ...inlineAddForm, account: v })}
                              accounts={existingAccounts}
                              className="[&_input]:h-9 [&_input]:rounded-lg [&_input]:text-sm"
                            />
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-xs text-gray-500 w-14 shrink-0 pt-2">備註</span>
                            <Textarea
                              placeholder="備註"
                              value={inlineAddForm.note || ""}
                              onChange={(e) => setInlineAddForm({ ...inlineAddForm, note: e.target.value })}
                              className="rounded-lg text-sm min-h-[60px] resize-y"
                              rows={2}
                            />
                          </div>
                          <div className="flex items-center gap-2 pt-2">
                            <Button type="button" size="sm" onClick={handleInlineAddSave} className="rounded-xl bg-green-500 hover:bg-green-600 text-white">新增</Button>
                            <Button type="button" size="sm" variant="outline" onClick={cancelInlineAdd} className="rounded-xl">取消</Button>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Input
                            type="date"
                            value={inlineAddForm.nextdate || ""}
                            onChange={(e) => setInlineAddForm({ ...inlineAddForm, nextdate: e.target.value })}
                            className="h-9 rounded-lg text-sm"
                          />
                          {inlineAddForm.nextdate && (
                            <div className="flex flex-col gap-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  if (!inlineAddForm.nextdate) return;
                                  const d = new Date(inlineAddForm.nextdate);
                                  d.setDate(d.getDate() + 30);
                                  setInlineAddForm({ ...inlineAddForm, nextdate: d.toISOString().split('T')[0] });
                                }}
                                className="p-1 hover:bg-blue-100 dark:hover:bg-blue-800 text-blue-600 rounded transition-colors"
                                title="+30天"
                              >
                                <Plus size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!inlineAddForm.nextdate) return;
                                  const d = new Date(inlineAddForm.nextdate);
                                  d.setDate(d.getDate() - 30);
                                  setInlineAddForm({ ...inlineAddForm, nextdate: d.toISOString().split('T')[0] });
                                }}
                                className="p-1 hover:bg-orange-100 dark:hover:bg-orange-800 text-orange-600 rounded transition-colors"
                                title="-30天"
                              >
                                <Minus size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="價錢"
                            value={inlineAddForm.price ?? ""}
                            onChange={(e) => setInlineAddForm({ ...inlineAddForm, price: e.target.value === "" ? 0 : parseFloat(e.target.value) || 0 })}
                            className="h-9 rounded-lg text-sm w-24"
                          />
                          <Select value={inlineAddForm.currency || "TWD"} onValueChange={(value) => setInlineAddForm({ ...inlineAddForm, currency: value })}>
                            <SelectTrigger className="h-9 rounded-lg text-sm w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="TWD">TWD</SelectItem>
                              <SelectItem value="USD">USD</SelectItem>
                              <SelectItem value="EUR">EUR</SelectItem>
                              <SelectItem value="JPY">JPY</SelectItem>
                              <SelectItem value="CNY">CNY</SelectItem>
                              <SelectItem value="HKD">HKD</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                      <TableCell>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={inlineAddForm.continue !== false}
                            onChange={(e) => setInlineAddForm({ ...inlineAddForm, continue: e.target.checked })}
                            className="w-4 h-4 rounded"
                          />
                          <span className="text-sm">{inlineAddForm.continue !== false ? "續訂" : "不續"}</span>
                        </label>
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredSubscriptions.map((sub) => {
                    const { daysRemaining, status, formattedDate, isExpired, isExpiringSoon } = getSubscriptionExpiryInfo(sub);
                    const rowClass = isExpired ? "bg-red-50 dark:bg-red-900/20" : isExpiringSoon ? "bg-yellow-50 dark:bg-yellow-900/20" : "";
                    const isEditing = inlineEditingId === sub.$id;

                    if (isEditing) {
                      // 行內編輯模式
                      return (
                        <TableRow key={sub.$id} className="bg-blue-50 dark:bg-blue-900/20">
                          <TableCell className="font-medium">
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 w-14 shrink-0">名稱</span>
                                <Input
                                  placeholder="服務名稱"
                                  value={inlineEditForm.name}
                                  onChange={(e) => setInlineEditForm({ ...inlineEditForm, name: e.target.value })}
                                  className="h-9 rounded-lg text-sm"
                                  required
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 w-14 shrink-0">網站</span>
                                <Input
                                  placeholder="網站 URL"
                                  type="url"
                                  value={inlineEditForm.site || ""}
                                  onChange={(e) => setInlineEditForm({ ...inlineEditForm, site: e.target.value })}
                                  className="h-9 rounded-lg text-sm"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 w-14 shrink-0">帳號</span>
                                <AccountComboBox
                                  value={inlineEditForm.account || ""}
                                  onChange={(v) => setInlineEditForm({ ...inlineEditForm, account: v })}
                                  accounts={existingAccounts}
                                  className="[&_input]:h-9 [&_input]:rounded-lg [&_input]:text-sm"
                                />
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="text-xs text-gray-500 w-14 shrink-0 pt-2">備註</span>
                                <Textarea
                                  placeholder="備註"
                                  value={inlineEditForm.note || ""}
                                  onChange={(e) => setInlineEditForm({ ...inlineEditForm, note: e.target.value })}
                                  className="rounded-lg text-sm min-h-[60px] resize-y"
                                  rows={2}
                                />
                              </div>
                              <div className="flex items-center gap-2 pt-2">
                                <Button type="button" size="sm" variant="outline" onClick={() => handleCopy(sub)} className="rounded-xl" title="複製"><Copy size={14} /></Button>
                                <Button type="button" size="sm" onClick={handleInlineSave} className="rounded-xl bg-green-500 hover:bg-green-600 text-white" title="儲存"><Check size={14} /></Button>
                                <Button type="button" size="sm" variant="outline" onClick={cancelInlineEdit} className="rounded-xl" title="取消"><X size={14} /></Button>
                                <Button type="button" size="sm" variant="outline" onClick={() => handleDelete(sub.$id)} className="rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50" title="刪除"><Trash2 size={14} /></Button>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Input
                                type="date"
                                value={inlineEditForm.nextdate || ""}
                                onChange={(e) => setInlineEditForm({ ...inlineEditForm, nextdate: e.target.value })}
                                className="h-9 rounded-lg text-sm"
                              />
                              <div className="flex flex-col gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!inlineEditForm.nextdate) return;
                                    const d = new Date(inlineEditForm.nextdate);
                                    d.setDate(d.getDate() + 30);
                                    setInlineEditForm({ ...inlineEditForm, nextdate: d.toISOString().split('T')[0] });
                                  }}
                                  className="p-1 hover:bg-blue-100 dark:hover:bg-blue-800 text-blue-600 rounded transition-colors"
                                  title="+30天"
                                >
                                  <Plus size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!inlineEditForm.nextdate) return;
                                    const d = new Date(inlineEditForm.nextdate);
                                    d.setDate(d.getDate() - 30);
                                    setInlineEditForm({ ...inlineEditForm, nextdate: d.toISOString().split('T')[0] });
                                  }}
                                  className="p-1 hover:bg-orange-100 dark:hover:bg-orange-800 text-orange-600 rounded transition-colors"
                                  title="-30天"
                                >
                                  <Minus size={12} />
                                </button>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-2">
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="價錢"
                                value={inlineEditForm.price ?? ""}
                                onChange={(e) => setInlineEditForm({ ...inlineEditForm, price: e.target.value === "" ? 0 : parseFloat(e.target.value) || 0 })}
                                className="h-9 rounded-lg text-sm w-24"
                              />
                              <Select value={inlineEditForm.currency || "TWD"} onValueChange={(value) => setInlineEditForm({ ...inlineEditForm, currency: value })}>
                                <SelectTrigger className="h-9 rounded-lg text-sm w-24">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="TWD">TWD</SelectItem>
                                  <SelectItem value="USD">USD</SelectItem>
                                  <SelectItem value="EUR">EUR</SelectItem>
                                  <SelectItem value="JPY">JPY</SelectItem>
                                  <SelectItem value="CNY">CNY</SelectItem>
                                  <SelectItem value="HKD">HKD</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </TableCell>
                          <TableCell>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={inlineEditForm.continue !== false}
                                onChange={(e) => setInlineEditForm({ ...inlineEditForm, continue: e.target.checked })}
                                className="w-4 h-4 rounded"
                              />
                              <span className="text-sm">{inlineEditForm.continue !== false ? "續訂" : "不續"}</span>
                            </label>
                          </TableCell>
                        </TableRow>
                      );
                    }

                    // 一般顯示模式
                    return (
                      <TableRow key={sub.$id} className={`hover:bg-gray-50/50 dark:hover:bg-gray-700/50 ${rowClass}`}>
                        <TableCell className="font-medium">
                          <div className="flex items-start gap-2">
                            {(isEditMode || selectionMode) && (
                              <button
                                type="button"
                                onClick={() => toggleSelect(sub.$id)}
                                className="mt-0.5 text-gray-400 hover:text-purple-600 transition-colors"
                              >
                                {selectedIds.has(sub.$id) ? <CheckSquare size={18} className="text-purple-600" /> : <Square size={18} />}
                              </button>
                            )}
                            {sub.site && <FaviconImage siteUrl={sub.site} siteName={sub.name} size={20} />}
                            <div className="flex flex-col gap-1 flex-1">
                              <div className="flex items-center gap-2">
                                {sub.site ? (
                                  <a href={sub.site} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline">
                                    {truncateName(sub.name, sub.$id)}
                                  </a>
                                ) : (
                                  <span className="text-gray-900 dark:text-gray-100">{truncateName(sub.name, sub.$id)}</span>
                                )}
                                {isEditMode && (
                                  <>
                                    <Button type="button" size="sm" variant="outline" onClick={() => handleInlineEdit(sub)} className="rounded-lg h-7 px-2" title="編輯"><Pencil size={14} /></Button>
                                    <Button type="button" size="sm" variant="outline" onClick={() => handleCopy(sub)} className="rounded-lg h-7 px-2" title="複製"><Copy size={14} /></Button>
                                  </>
                                )}
                                {sub.name.length > 37 && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => toggleNameExpansion(sub.$id)}
                                    className="h-6 px-2 text-xs rounded-lg"
                                  >
                                    {expandedNames.has(sub.$id) ? "收起" : "詳細"}
                                  </Button>
                                )}
                              </div>
                              {sub.account && (
                                <span className="text-sm text-gray-500 dark:text-gray-400">{sub.account}</span>
                              )}
                              {sub.note && (
                                <span className="text-xs text-gray-500 dark:text-gray-400 italic whitespace-pre-wrap">📝 {sub.note}</span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {formattedDate ? (
                            <div className="flex flex-col gap-1">
                              <span>{formattedDate}</span>
                              {status !== "normal" && <StatusBadge status={status}>{formatDaysRemaining(daysRemaining)}</StatusBadge>}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400 dark:text-gray-500">無日期</span>
                          )}
                        </TableCell>
                        <TableCell><span className="font-semibold text-green-600 dark:text-green-400">{formatCurrencyWithExchange(sub.price, sub.currency)}</span></TableCell>
                        <TableCell>
                          {formattedDate ? (
                            sub.continue !== false ? (
                              <span className="text-green-600 dark:text-green-400">✓ 續訂</span>
                            ) : (
                              <span className="text-red-500 dark:text-red-400">✗ 不續</span>
                            )
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="lg:hidden">
              <div className="flex items-center gap-2 mb-3">
                <span className="font-semibold text-gray-700 dark:text-gray-300">服務名稱</span>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (isInlineAdding) {
                      cancelInlineAdd();
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
                      setInlineEditingId(null);
                      setInlineEditForm(INITIAL_FORM);
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
              <DataCardList>
                {/* 行內新增卡片 (手機版) */}
                {isInlineAdding && (
                  <DataCardItem highlight="normal">
                    <div id="sub-inline-add" className="space-y-3 border-2 border-green-500 rounded-lg p-4 -m-4">
                      <div className="text-sm font-semibold text-green-600 dark:text-green-400 mb-2">新增訂閱</div>
                      <Input
                        placeholder="服務名稱"
                        value={inlineAddForm.name}
                        onChange={(e) => setInlineAddForm({ ...inlineAddForm, name: e.target.value })}
                        className="h-10 rounded-lg"
                        required
                        autoFocus
                      />
                      <Input
                        placeholder="網站 URL"
                        type="url"
                        value={inlineAddForm.site || ""}
                        onChange={(e) => setInlineAddForm({ ...inlineAddForm, site: e.target.value })}
                        className="h-10 rounded-lg"
                      />
                      <AccountComboBox
                        value={inlineAddForm.account || ""}
                        onChange={(v) => setInlineAddForm({ ...inlineAddForm, account: v })}
                        accounts={existingAccounts}
                        className="[&_input]:h-10 [&_input]:rounded-lg"
                      />
                      <div className="flex gap-2">
                        <div className="flex-1 flex items-center gap-1">
                          <Input
                            type="date"
                            value={inlineAddForm.nextdate || ""}
                            onChange={(e) => setInlineAddForm({ ...inlineAddForm, nextdate: e.target.value })}
                            className="h-10 rounded-lg flex-1"
                          />
                          {inlineAddForm.nextdate && (
                            <div className="flex flex-col gap-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  if (!inlineAddForm.nextdate) return;
                                  const d = new Date(inlineAddForm.nextdate);
                                  d.setDate(d.getDate() + 30);
                                  setInlineAddForm({ ...inlineAddForm, nextdate: d.toISOString().split('T')[0] });
                                }}
                                className="p-1 hover:bg-blue-100 dark:hover:bg-blue-800 text-blue-600 rounded transition-colors"
                                title="+30天"
                              >
                                <Plus size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!inlineAddForm.nextdate) return;
                                  const d = new Date(inlineAddForm.nextdate);
                                  d.setDate(d.getDate() - 30);
                                  setInlineAddForm({ ...inlineAddForm, nextdate: d.toISOString().split('T')[0] });
                                }}
                                className="p-1 hover:bg-orange-100 dark:hover:bg-orange-800 text-orange-600 rounded transition-colors"
                                title="-30天"
                              >
                                <Minus size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="價錢"
                          value={inlineAddForm.price ?? ""}
                          onChange={(e) => setInlineAddForm({ ...inlineAddForm, price: e.target.value === "" ? 0 : parseFloat(e.target.value) || 0 })}
                          className="h-10 rounded-lg flex-1"
                        />
                        <Select value={inlineAddForm.currency || "TWD"} onValueChange={(value) => setInlineAddForm({ ...inlineAddForm, currency: value })}>
                          <SelectTrigger className="h-10 rounded-lg w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="TWD">TWD</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="JPY">JPY</SelectItem>
                            <SelectItem value="CNY">CNY</SelectItem>
                            <SelectItem value="HKD">HKD</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Textarea
                        placeholder="備註"
                        value={inlineAddForm.note || ""}
                        onChange={(e) => setInlineAddForm({ ...inlineAddForm, note: e.target.value })}
                        className="rounded-lg min-h-[60px] resize-y"
                        rows={2}
                      />
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={inlineAddForm.continue !== false}
                          onChange={(e) => setInlineAddForm({ ...inlineAddForm, continue: e.target.checked })}
                          className="w-4 h-4 rounded"
                        />
                        <span className="text-sm">{inlineAddForm.continue !== false ? "續訂" : "不續"}</span>
                      </label>
                      <div className="flex gap-2 pt-2">
                        <Button type="button" size="sm" onClick={handleInlineAddSave} className="flex-1 rounded-xl bg-green-500 hover:bg-green-600 text-white">新增</Button>
                        <Button type="button" size="sm" variant="outline" onClick={cancelInlineAdd} className="flex-1 rounded-xl">取消</Button>
                      </div>
                    </div>
                  </DataCardItem>
                )}
                {filteredSubscriptions.map((sub) => {
                  const { daysRemaining, status, formattedDate, isExpired, isExpiringSoon } = getSubscriptionExpiryInfo(sub);
                  const highlight = isExpired ? "expired" : isExpiringSoon ? "warning" : "normal";
                  const isEditing = inlineEditingId === sub.$id;

                  if (isEditing) {
                    // 行內編輯模式 (手機版)
                    return (
                      <DataCardItem key={sub.$id} highlight="normal">
                        <div className="space-y-3">
                          <Input
                            placeholder="服務名稱"
                            value={inlineEditForm.name}
                            onChange={(e) => setInlineEditForm({ ...inlineEditForm, name: e.target.value })}
                            className="h-10 rounded-lg"
                            required
                          />
                          <Input
                            placeholder="網站 URL"
                            type="url"
                            value={inlineEditForm.site || ""}
                            onChange={(e) => setInlineEditForm({ ...inlineEditForm, site: e.target.value })}
                            className="h-10 rounded-lg"
                          />
                          <AccountComboBox
                            value={inlineEditForm.account || ""}
                            onChange={(v) => setInlineEditForm({ ...inlineEditForm, account: v })}
                            accounts={existingAccounts}
                            className="[&_input]:h-10 [&_input]:rounded-lg"
                          />
                          <div className="flex gap-2">
                            <div className="flex-1 flex items-center gap-1">
                              <Input
                                type="date"
                                value={inlineEditForm.nextdate || ""}
                                onChange={(e) => setInlineEditForm({ ...inlineEditForm, nextdate: e.target.value })}
                                className="h-10 rounded-lg flex-1"
                              />
                              <div className="flex flex-col gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!inlineEditForm.nextdate) return;
                                    const d = new Date(inlineEditForm.nextdate);
                                    d.setDate(d.getDate() + 30);
                                    setInlineEditForm({ ...inlineEditForm, nextdate: d.toISOString().split('T')[0] });
                                  }}
                                  className="p-1 hover:bg-blue-100 dark:hover:bg-blue-800 text-blue-600 rounded transition-colors"
                                  title="+30天"
                                >
                                  <Plus size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!inlineEditForm.nextdate) return;
                                    const d = new Date(inlineEditForm.nextdate);
                                    d.setDate(d.getDate() - 30);
                                    setInlineEditForm({ ...inlineEditForm, nextdate: d.toISOString().split('T')[0] });
                                  }}
                                  className="p-1 hover:bg-orange-100 dark:hover:bg-orange-800 text-orange-600 rounded transition-colors"
                                  title="-30天"
                                >
                                  <Minus size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="價錢"
                              value={inlineEditForm.price ?? ""}
                              onChange={(e) => setInlineEditForm({ ...inlineEditForm, price: e.target.value === "" ? 0 : parseFloat(e.target.value) || 0 })}
                              className="h-10 rounded-lg flex-1"
                            />
                            <Select value={inlineEditForm.currency || "TWD"} onValueChange={(value) => setInlineEditForm({ ...inlineEditForm, currency: value })}>
                              <SelectTrigger className="h-10 rounded-lg w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="TWD">TWD</SelectItem>
                                <SelectItem value="USD">USD</SelectItem>
                                <SelectItem value="EUR">EUR</SelectItem>
                                <SelectItem value="JPY">JPY</SelectItem>
                                <SelectItem value="CNY">CNY</SelectItem>
                                <SelectItem value="HKD">HKD</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Textarea
                            placeholder="備註"
                            value={inlineEditForm.note || ""}
                            onChange={(e) => setInlineEditForm({ ...inlineEditForm, note: e.target.value })}
                            className="rounded-lg min-h-[60px] resize-y"
                            rows={2}
                          />
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={inlineEditForm.continue !== false}
                              onChange={(e) => setInlineEditForm({ ...inlineEditForm, continue: e.target.checked })}
                              className="w-4 h-4 rounded"
                            />
                            <span className="text-sm">{inlineEditForm.continue !== false ? "續訂" : "不續"}</span>
                          </label>
                          <div className="flex gap-2 pt-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => handleCopy(sub)} className="rounded-xl" title="複製"><Copy size={14} /></Button>
                            <Button type="button" size="sm" onClick={handleInlineSave} className="rounded-xl bg-green-500 hover:bg-green-600 text-white" title="儲存"><Check size={14} /></Button>
                            <Button type="button" size="sm" variant="outline" onClick={cancelInlineEdit} className="rounded-xl" title="取消"><X size={14} /></Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => handleDelete(sub.$id)} className="rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50" title="刪除"><Trash2 size={14} /></Button>
                          </div>
                        </div>
                      </DataCardItem>
                    );
                  }

                  // 一般顯示模式
                  return (
                    <DataCardItem key={sub.$id} highlight={highlight}>
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2 flex-1">
                            {(isEditMode || selectionMode) && (
                              <button
                                type="button"
                                onClick={() => toggleSelect(sub.$id)}
                                className="text-gray-400 hover:text-purple-600 transition-colors"
                              >
                                {selectedIds.has(sub.$id) ? <CheckSquare size={18} className="text-purple-600" /> : <Square size={18} />}
                              </button>
                            )}
                            {sub.site && <FaviconImage siteUrl={sub.site} siteName={sub.name} size={20} />}
                            <div className="flex flex-col gap-1 flex-1">
                              <div className="flex items-center gap-2">
                                {sub.site ? (
                                  <a href={sub.site} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline font-semibold">
                                    {truncateName(sub.name, sub.$id)}
                                  </a>
                                ) : (
                                  <span className="text-gray-900 dark:text-gray-100 font-semibold">{truncateName(sub.name, sub.$id)}</span>
                                )}
                              </div>
                              {sub.account && (
                                <span className="text-sm text-gray-500 dark:text-gray-400">{sub.account}</span>
                              )}
                              {sub.note && (
                                <span className="text-xs text-gray-500 dark:text-gray-400 italic whitespace-pre-wrap">📝 {sub.note}</span>
                              )}
                              {sub.name.length > 37 && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => toggleNameExpansion(sub.$id)}
                                  className="h-6 px-2 text-xs rounded-lg self-start"
                                >
                                  {expandedNames.has(sub.$id) ? "收起" : "詳細服務名稱"}
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="font-bold text-green-600 dark:text-green-400">{formatCurrencyWithExchange(sub.price, sub.currency)}</span>
                            {formattedDate && (
                              sub.continue !== false ? (
                                <span className="text-xs text-green-600 dark:text-green-400">✓ 續訂</span>
                              ) : (
                                <span className="text-xs text-red-500 dark:text-red-400">✗ 不續</span>
                              )
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          {formattedDate && (
                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                              <span className="font-medium">下次付款:</span><span>{formattedDate}</span>
                            </div>
                          )}
                        </div>
                        {isEditMode && (
                          <div className="flex gap-2 pt-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => handleInlineEdit(sub)} className="rounded-xl" title="編輯"><Pencil size={14} /></Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => handleCopy(sub)} className="rounded-xl" title="複製"><Copy size={14} /></Button>
                          </div>
                        )}
                      </div>
                    </DataCardItem>
                  );
                })}
              </DataCardList>
            </div>
          </>
        )}
      </DataCard>

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
                即將刪除 <span className="font-bold text-red-600">{selectedIds.size}</span> 筆資料，此操作無法復原
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
                <code className="block bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg text-sm font-mono text-red-600">DELETE subscription</code>
                <input
                  type="text"
                  value={bulkDeleteInput}
                  onChange={(e) => setBulkDeleteInput(e.target.value)}
                  placeholder="輸入 DELETE subscription"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                />
              </div>
            )}
            <div className="p-6 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setBulkDeleteOpen(false); setBulkDeleteInput(""); }} disabled={isDeleting}>取消</Button>
              <Button
                onClick={handleBulkDelete}
                disabled={bulkDeleteInput !== "DELETE subscription" || isDeleting}
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
