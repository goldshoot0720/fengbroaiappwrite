"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Minus, ChevronDown, ChevronUp, Search, Download, Upload, X, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionHeader } from "@/components/ui/section-header";
import { FormCard, FormGrid, FormActions } from "@/components/ui/form-card";
import { DataCard, DataCardList, DataCardItem } from "@/components/ui/data-card";
import { EmptyState } from "@/components/ui/empty-state";
import { FullPageLoading } from "@/components/ui/loading-spinner";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatCard } from "@/components/ui/stat-card";
import { useSubscriptions, getSubscriptionExpiryInfo } from "@/hooks/useSubscriptions";
import { SubscriptionFormData, Subscription } from "@/types";
import { FaviconImage } from "@/components/ui/favicon-image";
import { formatDate, formatDaysRemaining, formatCurrency, formatCurrencyWithExchange, convertToTWD } from "@/lib/formatters";

const INITIAL_FORM: SubscriptionFormData = { name: "", site: "", price: 0, nextdate: "", note: "", account: "", currency: "TWD", continue: true };

export default function SubscriptionManagement() {
  const { subscriptions, loading, error, stats, createSubscription, createSubscriptionSilent, updateSubscription, updateSubscriptionSilent, deleteSubscription, loadSubscriptions } = useSubscriptions();
  const [form, setForm] = useState<SubscriptionFormData>(INITIAL_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [canAskNotification, setCanAskNotification] = useState(false);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [expandedNames, setExpandedNames] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  // Inline editing state
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineEditForm, setInlineEditForm] = useState<SubscriptionFormData>(INITIAL_FORM);

  // 取得已存在的不重複服務名稱
  const existingNames = useMemo(() => {
    const names = subscriptions.map(s => s.name).filter(Boolean);
    return Array.from(new Set(names)).sort();
  }, [subscriptions]);

  // 取得已存在的不重複網站 URL
  const existingSites = useMemo(() => {
    const sites = subscriptions.map(s => s.site).filter(Boolean) as string[];
    return Array.from(new Set(sites)).sort();
  }, [subscriptions]);

  // 取得已存在的不重複帳號
  const existingAccounts = useMemo(() => {
    const accounts = subscriptions.map(s => s.account).filter(Boolean) as string[];
    return Array.from(new Set(accounts)).sort();
  }, [subscriptions]);

  // 搜尋過濾
  const filteredSubscriptions = useMemo(() => {
    if (!searchQuery.trim()) return subscriptions;
    const query = searchQuery.toLowerCase();
    return subscriptions.filter(sub =>
      sub.name?.toLowerCase().includes(query) ||
      sub.site?.toLowerCase().includes(query) ||
      sub.account?.toLowerCase().includes(query) ||
      sub.note?.toLowerCase().includes(query)
    );
  }, [subscriptions, searchQuery]);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    if (!subscriptions.length) return;

    const now = new Date();
    const hour = now.getHours();
    if (hour < 6) return;

    const today = now.toISOString().slice(0, 10);

    const items = subscriptions
      .map((sub) => {
        const info = getSubscriptionExpiryInfo(sub);
        return { sub, daysRemaining: info.daysRemaining };
      })
      .filter(({ daysRemaining }) => daysRemaining >= 0 && daysRemaining <= 3);

    if (items.length === 0) return;

    const storageKey = "subscriptionNotificationDaily";
    let notified: Record<string, string> = {};

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        notified = JSON.parse(raw) as Record<string, string>;
      }
    } catch {
    }

    const toNotify = items.filter(({ sub }) => {
      const key = `${sub.$id}-${sub.nextdate}-${today}`;
      return notified[key] !== "shown";
    });

    if (toNotify.length === 0) return;

    const updated = { ...notified };

    toNotify.forEach(({ sub, daysRemaining }) => {
      const key = `${sub.$id}-${sub.nextdate}-${today}`;

      try {
        new Notification("訂閱即將到期提醒", {
          body: `${sub.name} 將在 ${daysRemaining} 天內到期`,
          icon: "/favicon.ico",
        });
        updated[key] = "shown";
      } catch {
      }
    });

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {
    }
  }, [subscriptions]);

  const handleEnableNotification = () => {
    if (typeof Notification === "undefined") {
      alert("此瀏覽器不支援通知功能");
      return;
    }

    if (Notification.permission === "granted") {
      setNotificationEnabled(true);
      alert("已啟用通知");
      return;
    }

    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        setNotificationEnabled(true);
        try {
          new Notification("通知已啟用", {
            body: "之後訂閱到期會顯示提醒",
            icon: "/favicon.ico",
          });
        } catch {
        }
      } else if (permission === "denied") {
        alert("瀏覽器已拒絕通知權限");
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Prepare form data ensuring price is properly handled
      const formDataToSend = {
        ...form,
        price: form.price !== undefined && form.price !== null ? form.price : 0
      };

      if (editingId) {
        await updateSubscription(editingId, formDataToSend);
      } else {
        await createSubscription(formDataToSend);
      }
      resetForm();
    } catch (error) {
      console.error('Subscription operation failed:', error);
      const errorMessage = error instanceof Error ? error.message : '操作失敗，請稍後再試';
      alert(errorMessage);
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

  const handleEdit = (sub: Subscription) => {
    setForm({
      name: sub.name,
      site: sub.site,
      price: sub.price !== undefined && sub.price !== null && sub.price !== 0 ? sub.price : 0,
      nextdate: sub.nextdate ? formatDate(sub.nextdate) : "",
      note: sub.note || "",
      account: sub.account || "",
      currency: sub.currency || "TWD",
      continue: sub.continue !== false
    });
    setEditingId(sub.$id);
    setIsFormOpen(true);
    // 滾動到頁面頂部讓用戶看到編輯表單
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  const handleCopy = (sub: Subscription) => {
    setForm({
      name: `${sub.name} (複製)`,
      site: sub.site,
      price: sub.price !== undefined && sub.price !== null && sub.price !== 0 ? sub.price : 0,
      nextdate: sub.nextdate ? formatDate(sub.nextdate) : "",
      note: sub.note || "",
      account: sub.account || "",
      currency: sub.currency || "TWD",
      continue: sub.continue !== false
    });
    setEditingId(null);
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExtend30Days = () => {
    if (!editingId) return;
    if (!form.nextdate) return; // 如果沒有日期，不執行操作

    // 計算新日期 (+30天)
    const currentDate = new Date(form.nextdate);
    currentDate.setDate(currentDate.getDate() + 30);
    const newDate = currentDate.toISOString().split('T')[0];

    // 更新表單中的日期
    setForm(prev => ({ ...prev, nextdate: newDate }));
  };

  const handleReduce30Days = () => {
    if (!editingId) return;
    if (!form.nextdate) return; // 如果沒有日期，不執行操作

    // 計算新日期 (-30天)
    const currentDate = new Date(form.nextdate);
    currentDate.setDate(currentDate.getDate() - 30);
    const newDate = currentDate.toISOString().split('T')[0];

    // 更新表單中的日期
    setForm(prev => ({ ...prev, nextdate: newDate }));
  };

  const handleDeleteFromForm = async () => {
    if (!editingId) return;
    if (!confirm(`確定刪除 ${form.name}？`)) return;
    try {
      await deleteSubscription(editingId);
      resetForm();
    } catch (error) {
      console.error('Delete subscription from form failed:', error);
      const errorMessage = error instanceof Error ? error.message : '刪除失敗，請稍後再試';
      alert(errorMessage);
    }
  };

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setEditingId(null);
    setIsFormOpen(false);
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
        <Button
          onClick={() => setIsFormOpen(!isFormOpen)}
          variant="outline"
          className="rounded-xl flex items-center gap-2 border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700 h-10 px-4"
        >
          {isFormOpen ? <ChevronUp size={18} /> : <Plus size={18} />}
          {isFormOpen ? "收起表單" : "新增訂閱"}
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

      {isFormOpen && (
        <FormCard title={editingId ? "編輯訂閱" : "新增訂閱"} accentColor="from-green-500 to-green-600">
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormGrid>
              {/* 服務名稱：可輸入或從下拉選單選擇 */}
              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <Input
                    placeholder="服務名稱 / Service Name"
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
                  <Select
                    value=""
                    onValueChange={(value) => {
                      if (value) {
                        setForm({ ...form, name: value });
                      }
                    }}
                  >
                    <SelectTrigger className="h-12 w-12 rounded-xl px-0 justify-center">
                      <ChevronDown className="h-4 w-4" />
                    </SelectTrigger>
                    <SelectContent>
                      {existingNames.map((name) => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              {/* 網站 URL：可輸入或從下拉選單選擇 */}
              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <Input
                    placeholder="網站 URL / Website URL"
                    type="url"
                    value={form.site || ""}
                    onChange={(e) => setForm({ ...form, site: e.target.value })}
                    className="h-12 rounded-xl w-full"
                  />
                  <div className="px-1 h-4">
                    {form.site ? (
                      <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">已輸入 / Entered</span>
                    ) : (
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請輸入 URL / (Optional) Please enter URL</span>
                    )}
                  </div>
                </div>
                {existingSites.length > 0 && (
                  <Select
                    value=""
                    onValueChange={(value) => {
                      if (value) {
                        setForm({ ...form, site: value });
                      }
                    }}
                  >
                    <SelectTrigger className="h-12 w-12 rounded-xl px-0 justify-center">
                      <ChevronDown className="h-4 w-4" />
                    </SelectTrigger>
                    <SelectContent>
                      {existingSites.map((site) => (
                        <SelectItem key={site} value={site}>{site}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-1">
                <Input
                  placeholder="價錢 / Price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price ?? ""}
                  onChange={(e) => setForm({ ...form, price: e.target.value === "" ? 0 : parseFloat(e.target.value) || 0 })}
                  className="h-12 rounded-xl"
                />
                <div className="px-1 h-4">
                  {(form.price !== undefined && form.price !== null && form.price > 0) ? (
                    <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">已輸入 / Entered</span>
                  ) : (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請輸入價格 / (Optional) Please enter price</span>
                  )}
                </div>
              </div>
              <Select value={form.currency || "TWD"} onValueChange={(value) => setForm({ ...form, currency: value })}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder="選擇幣別" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TWD">新台幣 (TWD)</SelectItem>
                  <SelectItem value="USD">美元 (USD)</SelectItem>
                  <SelectItem value="EUR">歐元 (EUR)</SelectItem>
                  <SelectItem value="JPY">日圓 (JPY)</SelectItem>
                  <SelectItem value="CNY">人民幣 (CNY)</SelectItem>
                  <SelectItem value="HKD">港幣 (HKD)</SelectItem>
                </SelectContent>
              </Select>
              <div className="space-y-1">
                <div className="flex gap-1 items-center">
                  <Input
                    placeholder="下次付款日期 / Next Payment Date"
                    type="date"
                    value={form.nextdate || ""}
                    onChange={(e) => setForm({ ...form, nextdate: e.target.value })}
                    className="h-12 rounded-xl flex-1"
                  />
                  {form.nextdate && (
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (!form.nextdate) return;
                          const d = new Date(form.nextdate);
                          d.setDate(d.getDate() + 30);
                          setForm({ ...form, nextdate: d.toISOString().split('T')[0] });
                        }}
                        className="p-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 rounded transition-colors"
                        title="+30天"
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!form.nextdate) return;
                          const d = new Date(form.nextdate);
                          d.setDate(d.getDate() - 30);
                          setForm({ ...form, nextdate: d.toISOString().split('T')[0] });
                        }}
                        className="p-1 hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-600 rounded transition-colors"
                        title="-30天"
                      >
                        <Minus size={14} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="px-1 h-4">
                  {form.nextdate ? (
                    <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">可以 + 或 - (30天) / Can use + or - (30 Days)</span>
                  ) : (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請選擇日期 / (Optional) Please select a date</span>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <Input
                    placeholder="帳號 / Account"
                    value={form.account || ""}
                    onChange={(e) => setForm({ ...form, account: e.target.value })}
                    className="h-12 rounded-xl w-full"
                  />
                  <div className="px-1 h-4">
                    {form.account ? (
                      <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">已輸入 / Entered</span>
                    ) : (
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請輸入帳號 / (Optional) Please enter account</span>
                    )}
                  </div>
                </div>
                {existingAccounts.length > 0 && (
                  <Select
                    value=""
                    onValueChange={(value) => {
                      if (value) {
                        setForm({ ...form, account: value });
                      }
                    }}
                  >
                    <SelectTrigger className="h-12 w-12 rounded-xl px-0 justify-center">
                      <ChevronDown className="h-4 w-4" />
                    </SelectTrigger>
                    <SelectContent>
                      {existingAccounts.map((account) => (
                        <SelectItem key={account} value={account}>{account}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <label className="flex items-center gap-2 h-12 px-3 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                <input
                  type="checkbox"
                  checked={form.continue !== false}
                  onChange={(e) => setForm({ ...form, continue: e.target.checked })}
                  className="w-5 h-5 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">續訂</span>
              </label>
            </FormGrid>
            <div className="space-y-1">
              <Textarea
                placeholder="備註 / Note"
                value={form.note || ""}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                className="rounded-xl min-h-[100px] resize-y w-full"
                rows={3}
              />
              <div className="px-1 h-4">
                {form.note ? (
                  <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">已輸入 / Entered</span>
                ) : (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請輸入備註 / (Optional) Please enter note</span>
                )}
              </div>
            </div>
            <FormActions>
              <Button type="submit" className="h-12 px-6 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 rounded-xl font-medium shadow-lg shadow-green-500/25">
                {editingId ? "更新訂閱" : "新增訂閱"}
              </Button>
              {editingId && (
                <Button type="button" variant="default" onClick={handleExtend30Days} className="h-12 px-6 rounded-xl bg-blue-500 hover:bg-blue-600">
                  +30天
                </Button>
              )}
              {editingId && (
                <Button type="button" variant="default" onClick={handleReduce30Days} className="h-12 px-6 rounded-xl bg-orange-500 hover:bg-orange-600">
                  -30天
                </Button>
              )}
              {editingId && <Button type="button" variant="outline" onClick={resetForm} className="h-12 px-6 rounded-xl">取消編輯</Button>}
              {!editingId && <Button type="button" variant="outline" onClick={resetForm} className="h-12 px-6 rounded-xl">取消</Button>}
              {editingId && <Button type="button" variant="destructive" onClick={handleDeleteFromForm} className="h-12 px-6 rounded-xl">刪除</Button>}
            </FormActions>
          </form>
        </FormCard>
      )}

      {/* 搜尋欄位 */}
      {subscriptions.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            placeholder="搜尋服務名稱、網站、帳號、備註..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 rounded-xl"
          />
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
                    <TableHead className="font-semibold">服務名稱</TableHead>
                    <TableHead className="font-semibold">下次付款日期</TableHead>
                    <TableHead className="font-semibold">月費</TableHead>
                    <TableHead className="font-semibold">續訂</TableHead>
                    <TableHead className="font-semibold">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
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
                                <Input
                                  placeholder="帳號"
                                  value={inlineEditForm.account || ""}
                                  onChange={(e) => setInlineEditForm({ ...inlineEditForm, account: e.target.value })}
                                  className="h-9 rounded-lg text-sm"
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
                          <TableCell>
                            <div className="flex gap-2">
                              <Button type="button" size="sm" onClick={handleInlineSave} className="rounded-xl bg-green-500 hover:bg-green-600 text-white">儲存</Button>
                              <Button type="button" size="sm" variant="outline" onClick={cancelInlineEdit} className="rounded-xl">取消</Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    }

                    // 一般顯示模式
                    return (
                      <TableRow key={sub.$id} className={`hover:bg-gray-50/50 dark:hover:bg-gray-700/50 ${rowClass}`}>
                        <TableCell className="font-medium">
                          <div className="flex items-start gap-2">
                            {sub.site && <FaviconImage siteUrl={sub.site} siteName={sub.name} size={20} />}
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                {sub.site ? (
                                  <a href={sub.site} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline">
                                    {truncateName(sub.name, sub.$id)}
                                  </a>
                                ) : (
                                  <span className="text-gray-900 dark:text-gray-100">{truncateName(sub.name, sub.$id)}</span>
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
                        <TableCell>
                          <div className="flex gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => handleCopy(sub)} className="rounded-xl" title="複製"><Copy size={14} /></Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => handleInlineEdit(sub)} className="rounded-xl">編輯</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="lg:hidden">
              <DataCardList>
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
                          <Input
                            placeholder="帳號"
                            value={inlineEditForm.account || ""}
                            onChange={(e) => setInlineEditForm({ ...inlineEditForm, account: e.target.value })}
                            className="h-10 rounded-lg"
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
                            <Button type="button" size="sm" onClick={handleInlineSave} className="flex-1 rounded-xl bg-green-500 hover:bg-green-600 text-white">儲存</Button>
                            <Button type="button" size="sm" variant="outline" onClick={cancelInlineEdit} className="flex-1 rounded-xl">取消</Button>
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
                            {sub.site && <FaviconImage siteUrl={sub.site} siteName={sub.name} size={20} />}
                            <div className="flex flex-col gap-1 flex-1">
                              {sub.site ? (
                                <a href={sub.site} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline font-semibold">
                                  {truncateName(sub.name, sub.$id)}
                                </a>
                              ) : (
                                <span className="text-gray-900 dark:text-gray-100 font-semibold">{truncateName(sub.name, sub.$id)}</span>
                              )}
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
                        <div className="flex gap-2 pt-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => handleCopy(sub)} className="rounded-xl" title="複製"><Copy size={14} /></Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => handleInlineEdit(sub)} className="flex-1 rounded-xl">編輯</Button>
                        </div>
                      </div>
                    </DataCardItem>
                  );
                })}
              </DataCardList>
            </div>
          </>
        )}
      </DataCard>
    </div>
  );
}
