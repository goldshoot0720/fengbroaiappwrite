"use client";

import { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Building2,
  Plus,
  Minus,
  ChevronDown,
  ChevronUp,
  Link as LinkIcon,
  MapPin,
  CreditCard,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Activity,
  User,
  Search,
  Download,
  Upload,
  RefreshCw,
  X,
  Trash2,
  Edit2,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormCard, FormGrid, FormActions } from "@/components/ui/form-card";
import { DataCard, DataCardList, DataCardItem } from "@/components/ui/data-card";
import { EmptyState } from "@/components/ui/empty-state";
import { FullPageLoading } from "@/components/ui/loading-spinner";
import { useBanks } from "@/hooks/useBanks";
import { BankFormData, Bank } from "@/types";
import { FaviconImage } from "@/components/ui/favicon-image";
import { formatCurrency } from "@/lib/formatters";
import { fetchApi } from "@/hooks/useApi";
import { API_ENDPOINTS } from "@/lib/constants";
import { getExportFilename } from "@/lib/utils";
import { FriendlyAiCrudShell } from "@/components/ui/friendly-ai-crud-shell";

const INITIAL_FORM: BankFormData = {
  name: "",
  deposit: 0,
  site: "",
  address: "",
  withdrawals: 0,
  transfer: 0,
  activity: "",
  card: "",
  account: ""
};

export default function BankManagement() {
  const { banks, loading, error, stats, loadBanks, createBank, updateBank, deleteBank } = useBanks();
  const [form, setForm] = useState<BankFormData>(INITIAL_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [workbenchMode, setWorkbenchMode] = useState<"all" | "active" | "missingInfo" | "zeroBalance">("all");
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<"income" | "expense">("income");
  const [transactionBankId, setTransactionBankId] = useState("");
  const [transactionAmount, setTransactionAmount] = useState("");
  const [transactionSaving, setTransactionSaving] = useState(false);

  // Inline editing state
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineEditForm, setInlineEditForm] = useState<BankFormData>(INITIAL_FORM);

  // Bulk selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteInput, setBulkDeleteInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [deleteTotal, setDeleteTotal] = useState(0);

  // 取得已存在的不重複資料用於下拉選單
  const existingNames = useMemo(() => {
    const names = banks.map(b => b.name).filter(Boolean);
    return Array.from(new Set(names)).sort();
  }, [banks]);

  const existingSites = useMemo(() => {
    const sites = banks.map(b => b.site).filter(Boolean) as string[];
    return Array.from(new Set(sites)).sort();
  }, [banks]);

  const existingAddresses = useMemo(() => {
    const addresses = banks.map(b => b.address).filter(Boolean) as string[];
    return Array.from(new Set(addresses)).sort();
  }, [banks]);

  const existingCards = useMemo(() => {
    const cards = banks.map(b => b.card).filter(Boolean) as string[];
    return Array.from(new Set(cards)).sort();
  }, [banks]);

  const existingAccounts = useMemo(() => {
    const accounts = banks.map(b => b.account).filter(Boolean) as string[];
    return Array.from(new Set(accounts)).sort();
  }, [banks]);

  // 搜尋過濾
  const filteredBanks = useMemo(() => {
    const modeFiltered = banks.filter((bank) => {
      if (workbenchMode === "active") return (bank.deposit || 0) > 0;
      if (workbenchMode === "missingInfo") return !bank.site || !bank.account;
      if (workbenchMode === "zeroBalance") return (bank.deposit || 0) === 0;
      return true;
    });

    if (!searchQuery.trim()) return modeFiltered;
    const query = searchQuery.toLowerCase();
    return modeFiltered.filter(bank =>
      bank.name?.toLowerCase().includes(query) ||
      bank.site?.toLowerCase().includes(query) ||
      bank.address?.toLowerCase().includes(query) ||
      bank.card?.toLowerCase().includes(query) ||
      bank.account?.toLowerCase().includes(query)
    );
  }, [banks, searchQuery, workbenchMode]);

  const banksMissingInfo = useMemo(
    () => banks.filter((bank) => !bank.site || !bank.account),
    [banks]
  );

  const zeroBalanceBanks = useMemo(
    () => banks.filter((bank) => (bank.deposit || 0) === 0),
    [banks]
  );

  const topBank = banks[0];

  const selectedTransactionBank = useMemo(
    () => banks.find((bank) => bank.$id === transactionBankId) || null,
    [banks, transactionBankId]
  );

  const transactionAmountNumber = Number(transactionAmount) || 0;
  const transactionNextDeposit = selectedTransactionBank
    ? (Number(selectedTransactionBank.deposit) || 0) + (transactionType === "income" ? transactionAmountNumber : -transactionAmountNumber)
    : 0;

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (!selectionMode) {
      setSelectionMode(true);
      setSelectedIds(new Set(filteredBanks.map(b => b.$id).filter(Boolean)));
    } else if (filteredBanks.length > 0 && filteredBanks.every(b => selectedIds.has(b.$id))) {
      setSelectedIds(new Set());
      setSelectionMode(false);
    } else {
      setSelectedIds(new Set(filteredBanks.map(b => b.$id).filter(Boolean)));
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds).filter(id => !!id);
    setDeleteTotal(ids.length);
    setDeleteProgress(0);
    setIsDeleting(true);
    await Promise.all(ids.map(id =>
      fetchApi(`${API_ENDPOINTS.BANK}/${id}`, { method: 'DELETE' })
        .catch(err => console.error("Delete failed:", err))
        .finally(() => setDeleteProgress(prev => prev + 1))
    ));
    setIsDeleting(false);
    setSelectedIds(new Set());
    setSelectionMode(false);
    setBulkDeleteOpen(false);
    setBulkDeleteInput("");
    loadBanks();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateBank(editingId, form);
      } else {
        await createBank(form);
      }
      resetForm();
    } catch {
      alert("操作失敗，請稍後再試");
    }
  };

  const handleEdit = (bank: Bank) => {
    setForm({
      name: bank.name,
      deposit: bank.deposit || 0,
      site: bank.site || "",
      address: bank.address || "",
      withdrawals: bank.withdrawals || 0,
      transfer: bank.transfer || 0,
      activity: bank.activity || "",
      card: bank.card || "",
      account: bank.account || ""
    });
    setEditingId(bank.$id);
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setEditingId(null);
    setIsFormOpen(false);
  };

  const resetTransactionForm = () => {
    setTransactionOpen(false);
    setTransactionType("income");
    setTransactionBankId("");
    setTransactionAmount("");
    setTransactionSaving(false);
  };

  const openTransactionModal = (type: "income" | "expense") => {
    setTransactionType(type);
    setTransactionBankId("");
    setTransactionAmount("");
    setTransactionOpen(true);
  };

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTransactionBank) {
      alert("請先選擇銀行");
      return;
    }

    if (!Number.isFinite(transactionAmountNumber) || transactionAmountNumber <= 0) {
      alert("請輸入正確金額");
      return;
    }

    const currentDeposit = Number(selectedTransactionBank.deposit) || 0;
    const nextDeposit = transactionType === "income"
      ? currentDeposit + transactionAmountNumber
      : currentDeposit - transactionAmountNumber;

    setTransactionSaving(true);

    try {
      await updateBank(selectedTransactionBank.$id, {
        name: selectedTransactionBank.name,
        deposit: nextDeposit,
        site: selectedTransactionBank.site || "",
        address: selectedTransactionBank.address || "",
        withdrawals: selectedTransactionBank.withdrawals || 0,
        transfer: selectedTransactionBank.transfer || 0,
        activity: selectedTransactionBank.activity || "",
        card: selectedTransactionBank.card || "",
        account: selectedTransactionBank.account || "",
      });
      resetTransactionForm();
    } catch {
      setTransactionSaving(false);
      alert("更新銀行金額失敗，請稍後再試");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const userInput = prompt(`請輸入 "DELETE ${name}" 來確認刪除「${name}」的資料：`);
    if (!userInput || userInput !== `DELETE ${name}`) {
      if (userInput !== null) { // User didn't cancel
        alert("輸入不正確，取消刪除操作");
      }
      return;
    }
    try {
      await deleteBank(id);
    } catch {
      alert("刪除失敗");
    }
  };

  // 開始行內編輯
  const handleInlineEdit = (bank: Bank) => {
    setInlineEditForm({
      name: bank.name || '',
      deposit: bank.deposit || 0,
      site: bank.site || '',
      address: bank.address || '',
      withdrawals: bank.withdrawals || 0,
      transfer: bank.transfer || 0,
      activity: bank.activity || '',
      card: bank.card || '',
      account: bank.account || '',
    });
    setInlineEditingId(bank.$id);
  };

  // 儲存行內編輯
  const handleInlineSave = async (bankId: string) => {
    if (!inlineEditingId) return;
    try {
      await updateBank(bankId, inlineEditForm);
      setInlineEditingId(null);
      setInlineEditForm(INITIAL_FORM);
    } catch (error) {
      console.error('Inline edit failed:', error);
      alert('更新失敗，請稍後再試');
    }
  };

  // 取消行內編輯
  const cancelInlineEdit = () => {
    setInlineEditingId(null);
    setInlineEditForm(INITIAL_FORM);
  };

  // CSV 匯入/匯出功能
  const [importPreview, setImportPreview] = useState<{ data: BankFormData[], errors: string[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const CSV_HEADERS = ['name', 'deposit', 'site', 'address', 'withdrawals', 'transfer', 'activity', 'card', 'account'];
  const EXPECTED_COLUMN_COUNT = CSV_HEADERS.length; // 9 欄

  const exportToCSV = () => {
    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`;
      return str;
    };
    const rows = [CSV_HEADERS.join(',')];
    banks.forEach(bank => {
      rows.push([escapeCSV(bank.name), escapeCSV(bank.deposit || 0), escapeCSV(bank.site || ''), escapeCSV(bank.address || ''), escapeCSV(bank.withdrawals || 0), escapeCSV(bank.transfer || 0), escapeCSV(bank.activity || ''), escapeCSV(bank.card || ''), escapeCSV(bank.account || '')].join(','));
    });
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = getExportFilename('bank');
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = []; let current = ''; let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuotes) { if (char === '"') { if (line[i + 1] === '"') { current += '"'; i++; } else { inQuotes = false; } } else { current += char; } }
      else { if (char === '"') { inQuotes = true; } else if (char === ',') { result.push(current); current = ''; } else { current += char; } }
    }
    result.push(current); return result;
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
          if (cleanText[i + 1] === '"') { currentField += '"'; i++; }
          else { inQuotes = false; }
        } else { currentField += char; }
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

  const parseCSV = (text: string): { data: BankFormData[], errors: string[] } => {
    const errors: string[] = []; const data: BankFormData[] = [];
    const rows = parseFullCSV(text);
    if (rows.length < 2) { errors.push('CSV 檔案至少需要表頭和一行資料'); return { data, errors }; }
    const headerValues = rows[0].map(h => h.trim());
    if (headerValues.length !== EXPECTED_COLUMN_COUNT) {
      errors.push(`表頭欄位數量錯誤: 預期 ${EXPECTED_COLUMN_COUNT} 欄，實際 ${headerValues.length} 欄`);
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
      const values = rows[i]; const lineNum = i + 1;
      if (values.length !== EXPECTED_COLUMN_COUNT) { errors.push(`第 ${lineNum} 行: 欄位數量錯誤`); continue; }
      if (!values[0]?.trim()) { errors.push(`第 ${lineNum} 行: name 欄位不能為空`); continue; }
      data.push({ name: values[0].trim(), deposit: parseFloat(values[1]) || 0, site: values[2]?.trim() || '', address: values[3]?.trim() || '', withdrawals: parseFloat(values[4]) || 0, transfer: parseFloat(values[5]) || 0, activity: values[6]?.trim() || '', card: values[7]?.trim() || '', account: values[8]?.trim() || '' });
    }
    return { data, errors };
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!file.name.endsWith('.csv')) { alert('請選擇 CSV 檔案'); return; }
    const reader = new FileReader();
    reader.onload = (event) => { setImportPreview(parseCSV(event.target?.result as string)); };
    reader.readAsText(file, 'UTF-8'); e.target.value = '';
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
        const existing = banks.find(b => b.name === formData.name);
        // 直接呼叫 API，避免每筆都觸發 loadBanks 導致頁面重新整理
        if (existing) {
          const sanitizedData = { ...formData };
          if (sanitizedData.activity && sanitizedData.activity.trim() === '') sanitizedData.activity = '';
          if (sanitizedData.site === undefined || sanitizedData.site === null) sanitizedData.site = '';
          await fetchApi(`${API_ENDPOINTS.BANK}/${existing.$id}`, { method: "PUT", body: JSON.stringify(sanitizedData) });
        } else {
          const sanitizedData = { ...formData };
          if (!sanitizedData.activity || sanitizedData.activity.trim() === '') delete (sanitizedData as any).activity;
          if (!sanitizedData.site || sanitizedData.site.trim() === '') delete (sanitizedData as any).site;
          await fetchApi(API_ENDPOINTS.BANK, { method: "POST", body: JSON.stringify(sanitizedData) });
        }
        successCount++;
      } catch { failCount++; }
    }

    setImporting(false);
    setImportProgress({ current: 0, total: 0 });
    setImportPreview(null);
    // 匯入完成後才重新載入一次
    await loadBanks();
    alert(`匯入完成！\n成功: ${successCount} 筆\n失敗: ${failCount} 筆`);
  };

  if (loading) return <FullPageLoading text="載入銀行資料中..." />;

  return (
    <div className="space-y-4 lg:space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <FriendlyAiCrudShell
        title="鋒兄銀行"
        description="資產總覽、帳戶工作台與異常整理入口都集中在同一頁，先找得到，再快速更新餘額與資訊。"
        searchPlaceholder="搜尋名稱、網站、地址、卡號、帳號..."
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeMode={workbenchMode}
        onModeChange={(mode) => setWorkbenchMode(mode as typeof workbenchMode)}
        modeItems={[
          { key: "all", label: "全部帳戶", count: banks.length },
          { key: "active", label: "有餘額", count: banks.filter((bank) => (bank.deposit || 0) > 0).length },
          { key: "missingInfo", label: "待補資訊", count: banksMissingInfo.length },
          { key: "zeroBalance", label: "零餘額", count: zeroBalanceBanks.length },
        ]}
        summaries={[
          { label: "總資產", value: formatCurrency(stats.totalDeposit), tone: "blue" },
          { label: "帳戶數", value: stats.total, tone: "green" },
          { label: "待補欄位", value: banksMissingInfo.length, detail: "缺網站或帳號", tone: banksMissingInfo.length > 0 ? "amber" : "neutral" },
          { label: "零餘額", value: zeroBalanceBanks.length, detail: "可考慮封存或隱藏", tone: zeroBalanceBanks.length > 0 ? "red" : "neutral" },
        ]}
        suggestions={[
          topBank
            ? { title: "資產重心", body: `目前最高餘額是「${topBank.name}」，可優先確認是否仍是主要資金帳戶。`, tone: "blue" }
            : { title: "開始建立", body: "先建立主要帳戶，之後再補卡號、地址與網站。", tone: "green" },
          banksMissingInfo.length > 0
            ? { title: "欄位待補", body: `有 ${banksMissingInfo.length} 筆帳戶缺網站或帳號，之後搜尋與辨識會不夠快。`, tone: "amber" }
            : { title: "資料完整度", body: "主要欄位已齊，後續可把常用帳戶再做釘選或命名統一。", tone: "green" },
          zeroBalanceBanks.length > 0
            ? { title: "清理建議", body: `有 ${zeroBalanceBanks.length} 筆零餘額帳戶，可以考慮封存，避免列表越來越雜。`, tone: "red" }
            : { title: "維護節奏", body: "目前沒有零餘額帳戶，下一步可固定更新活存與交割戶金額。", tone: "neutral" },
        ]}
        toolbar={
          <>
            <input type="file" accept=".csv" onChange={handleFileSelect} className="hidden" id="csv-import-bank" />
            <Button onClick={() => loadBanks()} variant="outline" className="rounded-xl flex items-center gap-2" title="重新整理" disabled={loading}>
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} /> 重新整理
            </Button>
            <Button onClick={() => document.getElementById('csv-import-bank')?.click()} variant="outline" className="rounded-xl flex items-center gap-2" title="匯入 CSV">
              <Upload size={18} /> 匯入
            </Button>
            <Button onClick={exportToCSV} variant="outline" className="rounded-xl flex items-center gap-2" title="匯出 CSV">
              <Download size={18} /> 匯出
            </Button>
            <Button
              onClick={() => openTransactionModal("income")}
              variant="outline"
              className="rounded-xl flex items-center gap-2 border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700 h-10 px-4"
            >
              <Plus size={18} />
              新增收入
            </Button>
            <Button
              onClick={() => openTransactionModal("expense")}
              variant="outline"
              className="rounded-xl flex items-center gap-2 border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700 h-10 px-4"
            >
              <Minus size={18} />
              新增支出
            </Button>
            <Button
              onClick={handleSelectAll}
              variant="outline"
              className="rounded-xl flex items-center gap-2 h-10 px-4"
            >
              {selectionMode && filteredBanks.length > 0 && filteredBanks.every((bank) => selectedIds.has(bank.$id)) ? "取消全選" : "全選"}
            </Button>
            {selectedIds.size > 0 && (
              <Button onClick={() => setBulkDeleteOpen(true)} className="rounded-xl flex items-center gap-2 h-10 px-4 bg-red-600 hover:bg-red-700 text-white">
                <Trash2 size={18} />
                刪除選取 ({selectedIds.size})
              </Button>
            )}
            <Button
              onClick={() => setIsFormOpen(!isFormOpen)}
              variant="outline"
              className="rounded-xl flex items-center gap-2 border-blue-500 text-blue-600 hover:bg-blue-50 hover:text-blue-700 h-10 px-4"
            >
              {isFormOpen ? <ChevronUp size={18} /> : <Plus size={18} />}
              {isFormOpen ? "收起表單" : "新增銀行資料"}
            </Button>
          </>
        }
      />

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
                      const existing = banks.find(b => b.name === item.name);
                      return (
                        <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <span className="font-medium text-gray-900 dark:text-gray-100">{item.name}</span>
                          <span className="text-xs text-gray-500">{formatCurrency(item.deposit || 0)}</span>
                          {existing ? <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded">更新</span> : <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded">新增</span>}
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

      {transactionOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {transactionType === "income" ? "新增收入" : "新增支出"}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    先選擇銀行，再確認收入或支出，最後輸入金額並更新實際餘額。
                  </p>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={resetTransactionForm} className="rounded-xl shrink-0">
                  <X size={18} />
                </Button>
              </div>
            </div>

            <form onSubmit={handleTransactionSubmit} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">選擇銀行</label>
                <Select value={transactionBankId} onValueChange={setTransactionBankId}>
                  <SelectTrigger className="h-12 rounded-xl">
                    <SelectValue placeholder="請選擇銀行" />
                  </SelectTrigger>
                  <SelectContent>
                    {banks.map((bank) => (
                      <SelectItem key={bank.$id} value={bank.$id}>
                        {bank.name} ({formatCurrency(bank.deposit || 0)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">收入 / 支出</label>
                <Select value={transactionType} onValueChange={(value) => setTransactionType(value as "income" | "expense")}>
                  <SelectTrigger className="h-12 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">收入</SelectItem>
                    <SelectItem value="expense">支出</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">金額</label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="請輸入金額"
                  value={transactionAmount}
                  onChange={(e) => setTransactionAmount(e.target.value)}
                  className="h-12 rounded-xl"
                  required
                />
              </div>

              {selectedTransactionBank && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">目前餘額</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {formatCurrency(selectedTransactionBank.deposit || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">本次{transactionType === "income" ? "收入" : "支出"}</span>
                    <span className={transactionType === "income" ? "font-semibold text-green-600" : "font-semibold text-red-600"}>
                      {transactionType === "income" ? "+" : "-"}{formatCurrency(transactionAmountNumber)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-gray-200 dark:border-gray-700 pt-2">
                    <span className="text-gray-500">更新後餘額</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(transactionNextDeposit)}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={resetTransactionForm} className="rounded-xl w-full sm:w-auto" disabled={transactionSaving}>
                  取消
                </Button>
                <Button
                  type="submit"
                  className="rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white w-full sm:w-auto"
                  disabled={transactionSaving}
                >
                  {transactionSaving ? "更新中..." : "完成"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isFormOpen && (
        <FormCard title={editingId ? "編輯銀行資料" : "新增銀行資料"} accentColor="from-blue-500 to-blue-600">
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormGrid>
              <div className="space-y-1">
                <label className="text-sm font-medium">銀行名稱 / Bank Name</label>
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <Input placeholder="例如: 台北富邦 / e.g. Taipei Fubon" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="h-12 rounded-xl w-full" />
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
                <label className="text-sm font-medium">存款金額 / Deposit Amount</label>
                <div className="flex gap-1 items-center">
                  <Input type="number" placeholder="0" value={form.deposit || ""} onChange={(e) => setForm({ ...form, deposit: parseInt(e.target.value) || 0 })} className="h-12 rounded-xl flex-1" />
                  {(form.deposit || 0) > 0 && (
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, deposit: (form.deposit || 0) + 1000 })}
                        className="p-1 hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 rounded transition-colors"
                        title="+1000"
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, deposit: Math.max(0, (form.deposit || 0) - 1000) })}
                        className="p-1 hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-600 rounded transition-colors"
                        title="-1000"
                      >
                        <Minus size={14} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="px-1 h-4">
                  {(form.deposit || 0) > 0 ? (
                    <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">可以 + 或 - / Can use + or -</span>
                  ) : (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請輸入金額 / (Optional) Please enter amount</span>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">官方網站 URL / Official Website URL</label>
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <Input type="url" placeholder="https://..." value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })} className="h-12 rounded-xl w-full" />
                    <div className="px-1 h-4">
                      {form.site ? (
                        <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">已輸入 / Entered</span>
                      ) : (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請輸入 URL / (Optional) Please enter URL</span>
                      )}
                    </div>
                  </div>
                  {existingSites.length > 0 && (
                    <Select value="" onValueChange={(val) => val && setForm({ ...form, site: val })}>
                      <SelectTrigger className="h-12 w-12 rounded-xl px-0 justify-center">
                        <ChevronDown className="h-4 w-4" />
                      </SelectTrigger>
                      <SelectContent>
                        {existingSites.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">分行地址 / Branch Address</label>
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <Input placeholder="分行名稱或地址 / Branch name or address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="h-12 rounded-xl w-full" />
                    <div className="px-1 h-4">
                      {form.address ? (
                        <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">已輸入 / Entered</span>
                      ) : (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請輸入地址 / (Optional) Please enter address</span>
                      )}
                    </div>
                  </div>
                  {existingAddresses.length > 0 && (
                    <Select value="" onValueChange={(val) => val && setForm({ ...form, address: val })}>
                      <SelectTrigger className="h-12 w-12 rounded-xl px-0 justify-center">
                        <ChevronDown className="h-4 w-4" />
                      </SelectTrigger>
                      <SelectContent>
                        {existingAddresses.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">提款額度 / Withdrawal Limit</label>
                <div className="flex gap-1 items-center">
                  <Input type="number" placeholder="0" value={form.withdrawals || ""} onChange={(e) => setForm({ ...form, withdrawals: parseInt(e.target.value) || 0 })} className="h-12 rounded-xl flex-1" />
                  {(form.withdrawals || 0) > 0 && (
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, withdrawals: (form.withdrawals || 0) + 1000 })}
                        className="p-1 hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 rounded transition-colors"
                        title="+1000"
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, withdrawals: Math.max(0, (form.withdrawals || 0) - 1000) })}
                        className="p-1 hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-600 rounded transition-colors"
                        title="-1000"
                      >
                        <Minus size={14} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="px-1 h-4">
                  {(form.withdrawals || 0) > 0 ? (
                    <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">可以 + 或 - / Can use + or -</span>
                  ) : (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請輸入金額 / (Optional) Please enter amount</span>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">轉帳額度 / Transfer Limit</label>
                <div className="flex gap-1 items-center">
                  <Input type="number" placeholder="0" value={form.transfer || ""} onChange={(e) => setForm({ ...form, transfer: parseInt(e.target.value) || 0 })} className="h-12 rounded-xl flex-1" />
                  {(form.transfer || 0) > 0 && (
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, transfer: (form.transfer || 0) + 1000 })}
                        className="p-1 hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 rounded transition-colors"
                        title="+1000"
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, transfer: Math.max(0, (form.transfer || 0) - 1000) })}
                        className="p-1 hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-600 rounded transition-colors"
                        title="-1000"
                      >
                        <Minus size={14} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="px-1 h-4">
                  {(form.transfer || 0) > 0 ? (
                    <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">可以 + 或 - / Can use + or -</span>
                  ) : (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請輸入金額 / (Optional) Please enter amount</span>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">優惠活動 URL / Activity URL</label>
                <Input type="url" placeholder="https://..." value={form.activity} onChange={(e) => setForm({ ...form, activity: e.target.value })} className="h-12 rounded-xl" />
                <div className="px-1 h-4">
                  {form.activity ? (
                    <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">已輸入 / Entered</span>
                  ) : (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請輸入 URL / (Optional) Please enter URL</span>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">卡片資訊 / Card Info</label>
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <Input placeholder="卡片類型或後四碼 / Card type or last 4 digits" value={form.card} onChange={(e) => setForm({ ...form, card: e.target.value })} className="h-12 rounded-xl w-full" />
                    <div className="px-1 h-4">
                      {form.card ? (
                        <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">已輸入 / Entered</span>
                      ) : (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請輸入卡片資訊 / (Optional) Please enter card info</span>
                      )}
                    </div>
                  </div>
                  {existingCards.length > 0 && (
                    <Select value="" onValueChange={(val) => val && setForm({ ...form, card: val })}>
                      <SelectTrigger className="h-12 w-12 rounded-xl px-0 justify-center">
                        <ChevronDown className="h-4 w-4" />
                      </SelectTrigger>
                      <SelectContent>
                        {existingCards.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">帳號/用戶名 / Account/Username</label>
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <Input placeholder="網銀帳號或登入 ID / Online banking or login ID" value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })} className="h-12 rounded-xl w-full" />
                    <div className="px-1 h-4">
                      {form.account ? (
                        <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">已輸入 / Entered</span>
                      ) : (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請輸入帳號 / (Optional) Please enter account</span>
                      )}
                    </div>
                  </div>
                  {existingAccounts.length > 0 && (
                    <Select value="" onValueChange={(val) => val && setForm({ ...form, account: val })}>
                      <SelectTrigger className="h-12 w-12 rounded-xl px-0 justify-center">
                        <ChevronDown className="h-4 w-4" />
                      </SelectTrigger>
                      <SelectContent>
                        {existingAccounts.map(acc => <SelectItem key={acc} value={acc}>{acc}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </FormGrid>
            <FormActions>
              <Button type="submit" className="h-12 px-6 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-xl font-medium shadow-lg shadow-blue-500/25">
                {editingId ? "更新資料" : "新增資料"}
              </Button>
              <Button type="button" variant="outline" onClick={resetForm} className="h-12 px-6 rounded-xl">取消</Button>
              {editingId && (
                <Button type="button" variant="destructive" onClick={() => handleDelete(editingId, form.name)} className="h-12 px-6 rounded-xl ml-auto">
                  刪除
                </Button>
              )}
            </FormActions>
          </form>
        </FormCard>
      )}

      <DataCard>
        {banks.length === 0 ? (
          <EmptyState icon={<Building2 className="w-12 h-12" />} title="暫無銀行資料" description="點擊上方按鈕新增您的第一筆銀行資料" />
        ) : filteredBanks.length === 0 ? (
          <EmptyState icon={<Search className="w-12 h-12" />} title="無搜尋結果" description={`找不到「${searchQuery}」相關的銀行`} />
        ) : (
          <DataCardList>
            {filteredBanks.map((bank) => (
              <DataCardItem key={bank.$id}>
                {inlineEditingId === bank.$id ? (
                  // 行內編輯模式
                  <div className="space-y-3 border-2 border-orange-500 rounded-lg p-4 -m-4">
                    <div className="text-sm font-semibold text-orange-600 dark:text-orange-400 mb-2">編輯中</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      <Input
                        placeholder="銀行名稱"
                        value={inlineEditForm.name}
                        onChange={(e) => setInlineEditForm({ ...inlineEditForm, name: e.target.value })}
                        className="h-9 rounded-lg text-sm"
                      />
                      <Input
                        placeholder="資產餘額"
                        type="number"
                        value={inlineEditForm.deposit}
                        onChange={(e) => setInlineEditForm({ ...inlineEditForm, deposit: Number(e.target.value) })}
                        className="h-9 rounded-lg text-sm"
                      />
                      <Input
                        placeholder="網站連結"
                        value={inlineEditForm.site}
                        onChange={(e) => setInlineEditForm({ ...inlineEditForm, site: e.target.value })}
                        className="h-9 rounded-lg text-sm"
                      />
                      <Input
                        placeholder="地址"
                        value={inlineEditForm.address}
                        onChange={(e) => setInlineEditForm({ ...inlineEditForm, address: e.target.value })}
                        className="h-9 rounded-lg text-sm"
                      />
                      <Input
                        placeholder="提款額度"
                        type="number"
                        value={inlineEditForm.withdrawals}
                        onChange={(e) => setInlineEditForm({ ...inlineEditForm, withdrawals: Number(e.target.value) })}
                        className="h-9 rounded-lg text-sm"
                      />
                      <Input
                        placeholder="轉帳額度"
                        type="number"
                        value={inlineEditForm.transfer}
                        onChange={(e) => setInlineEditForm({ ...inlineEditForm, transfer: Number(e.target.value) })}
                        className="h-9 rounded-lg text-sm"
                      />
                      <Input
                        placeholder="活動連結"
                        value={inlineEditForm.activity}
                        onChange={(e) => setInlineEditForm({ ...inlineEditForm, activity: e.target.value })}
                        className="h-9 rounded-lg text-sm"
                      />
                      <Input
                        placeholder="卡片"
                        value={inlineEditForm.card}
                        onChange={(e) => setInlineEditForm({ ...inlineEditForm, card: e.target.value })}
                        className="h-9 rounded-lg text-sm"
                      />
                      <Input
                        placeholder="帳號"
                        value={inlineEditForm.account}
                        onChange={(e) => setInlineEditForm({ ...inlineEditForm, account: e.target.value })}
                        className="h-9 rounded-lg text-sm md:col-span-2 xl:col-span-3"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleInlineSave(bank.$id)} className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-lg">
                        儲存
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelInlineEdit} className="flex-1 rounded-lg">
                        取消
                      </Button>
                    </div>
                  </div>
                ) : (
                  // 正常顯示模式
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {selectionMode && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(bank.$id)}
                            onChange={() => handleToggleSelect(bank.$id)}
                            className="h-4 w-4 rounded border-gray-300 text-red-600 cursor-pointer shrink-0"
                          />
                        )}
                        {bank.site && <FaviconImage siteUrl={bank.site} siteName={bank.name} size={24} />}
                        <div>
                          {bank.site ? (
                            <a
                              href={bank.site}
                              target="_blank"
                              rel="noreferrer"
                              className="text-lg font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                            >
                              {bank.name}
                              <LinkIcon size={14} />
                            </a>
                          ) : (
                            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{bank.name}</h3>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          {Number(bank.deposit) > 0 && (
                            <>
                              <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                                {formatCurrency(bank.deposit)}
                              </div>
                              <span className="text-xs text-gray-400">資產餘額</span>
                            </>
                          )}
                        </div>
                        <button
                          onClick={() => handleInlineEdit(bank)}
                          className="p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-colors"
                          title="編輯"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(bank.$id, bank.name)}
                          className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                          title="刪除"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
                      {/* 地址 */}
                      {bank.address && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                          <MapPin size={16} className="text-gray-400" />
                          <span className="truncate">{bank.address}</span>
                        </div>
                      )}

                      {/* 卡片 */}
                      {bank.card && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                          <CreditCard size={16} className="text-gray-400" />
                          <span>{bank.card}</span>
                        </div>
                      )}

                      {/* 帳號 */}
                      {bank.account && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                          <User size={16} className="text-gray-400" />
                          <span>{bank.account}</span>
                        </div>
                      )}

                      {/* 額度資訊 - 只顯示大於 0 的值 */}
                      {(Number(bank.withdrawals) > 0 || Number(bank.transfer) > 0) && (
                        <div className="flex items-center gap-4 text-xs">
                          {Number(bank.withdrawals) > 0 && (
                            <div className="flex items-center gap-1 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 px-2 py-1 rounded">
                              <ArrowDownLeft size={12} />
                              <span>提款: {formatCurrency(bank.withdrawals)}</span>
                            </div>
                          )}
                          {Number(bank.transfer) > 0 && (
                            <div className="flex items-center gap-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-2 py-1 rounded">
                              <ArrowUpRight size={12} />
                              <span>轉帳: {formatCurrency(bank.transfer)}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 活動連結 */}
                      {bank.activity && (
                        <a href={bank.activity} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-purple-500 hover:underline">
                          <Activity size={16} />
                          <span>最新活動優惠</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </DataCardItem>
            ))}
          </DataCardList>
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
                即將刪除 <span className="font-bold text-red-600">{selectedIds.size}</span> 筆銀行資料，此操作無法復原
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
                <code className="block bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg text-sm font-mono text-red-600">DELETE bank</code>
                <input
                  type="text"
                  value={bulkDeleteInput}
                  onChange={(e) => setBulkDeleteInput(e.target.value)}
                  placeholder="輸入 DELETE bank"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                />
              </div>
            )}
            <div className="p-6 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setBulkDeleteOpen(false); setBulkDeleteInput(""); }} disabled={isDeleting}>取消</Button>
              <Button
                onClick={handleBulkDelete}
                disabled={bulkDeleteInput !== "DELETE bank" || isDeleting}
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
