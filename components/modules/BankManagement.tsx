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
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/ui/section-header";
import { FormCard, FormGrid, FormActions } from "@/components/ui/form-card";
import { DataCard, DataCardList, DataCardItem } from "@/components/ui/data-card";
import { EmptyState } from "@/components/ui/empty-state";
import { FullPageLoading } from "@/components/ui/loading-spinner";
import { StatCard } from "@/components/ui/stat-card";
import { useBanks } from "@/hooks/useBanks";
import { BankFormData, Bank } from "@/types";
import { FaviconImage } from "@/components/ui/favicon-image";
import { formatCurrency } from "@/lib/formatters";

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
  const { banks, loading, error, stats, createBank, updateBank, deleteBank } = useBanks();
  const [form, setForm] = useState<BankFormData>(INITIAL_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
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
    if (!searchQuery.trim()) return banks;
    const query = searchQuery.toLowerCase();
    return banks.filter(bank => 
      bank.name?.toLowerCase().includes(query) ||
      bank.site?.toLowerCase().includes(query) ||
      bank.address?.toLowerCase().includes(query) ||
      bank.card?.toLowerCase().includes(query) ||
      bank.account?.toLowerCase().includes(query)
    );
  }, [banks, searchQuery]);

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

  // CSV 匯入/匯出功能
  const [importPreview, setImportPreview] = useState<{data: BankFormData[], errors: string[]} | null>(null);
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
    link.download = 'appwrite-Bank.csv';
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

  const parseCSV = (text: string): {data: BankFormData[], errors: string[]} => {
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
        if (existing) {
          await updateBank(existing.$id, formData);
        } else {
          await createBank(formData);
        }
        successCount++;
      } catch { failCount++; }
    }
    
    setImporting(false);
    setImportProgress({ current: 0, total: 0 });
    setImportPreview(null);
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

      <SectionHeader
        title="鋒兄銀行"
        subtitle={`管理您的銀行帳戶、資產與相關資訊`}
        showAccountLabel={true}
        action={
          <div className="flex gap-4">
            <StatCard title="總資產" value={formatCurrency(stats.totalDeposit)} gradient="from-blue-500 to-blue-600" className="min-w-[160px]" />
            <StatCard title="帳戶數" value={stats.total} gradient="from-purple-500 to-purple-600" className="min-w-[160px]" />
          </div>
        }
      />

      <div className="flex justify-end gap-2">
        <input type="file" accept=".csv" onChange={handleFileSelect} className="hidden" id="csv-import-bank" />
        <Button onClick={() => document.getElementById('csv-import-bank')?.click()} variant="outline" className="rounded-xl flex items-center gap-2" title="匯入 CSV">
          <Upload size={18} /> 匯入
        </Button>
        <Button onClick={exportToCSV} variant="outline" className="rounded-xl flex items-center gap-2" title="匯出 CSV">
          <Download size={18} /> 匯出
        </Button>
        <Button
          onClick={() => setIsFormOpen(!isFormOpen)}
          variant="outline"
          className="rounded-xl flex items-center gap-2 border-blue-500 text-blue-600 hover:bg-blue-50 hover:text-blue-700 h-10 px-4"
        >
          {isFormOpen ? <ChevronUp size={18} /> : <Plus size={18} />}
          {isFormOpen ? "收起表單" : "新增銀行資料"}
        </Button>
      </div>

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

      {/* 搜尋欄位 */}
      {banks.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            placeholder="搜尋名稱、網站、地址、卡號、帳號..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 rounded-xl"
          />
        </div>
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
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
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
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

                  <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <Button type="button" size="sm" variant="outline" onClick={() => handleEdit(bank)} className="flex-1 rounded-xl">
                      編輯詳細資料
                    </Button>
                  </div>
                </div>
              </DataCardItem>
            ))}
          </DataCardList>
        )}
      </DataCard>
    </div>
  );
}
