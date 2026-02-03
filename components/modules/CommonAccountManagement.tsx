"use client";

import { useState, useMemo, useEffect } from "react";
import { Star, Link as LinkIcon, FileText as NoteIcon, Plus, Trash2, Edit2, X, Save, ChevronDown, ChevronUp, Filter, Search, AlertTriangle, Copy, Download, Upload } from "lucide-react";
import { CommonAccount, CommonAccountFormData } from "@/types";
import { Input, Textarea, DataCard, Button, SectionHeader, FormCard, FormActions } from "@/components/ui";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useCrud } from "@/hooks/useApi";
import { API_ENDPOINTS } from "@/lib/constants";
import { FullPageLoading } from "@/components/ui/loading-spinner";
import { FaviconImage } from "@/components/ui/favicon-image";

// 常見網站名稱到 URL 的映射（用於 favicon 顯示）
const SITE_URL_MAP: Record<string, string> = {
  'Github': 'https://github.com',
  'GitHub': 'https://github.com',
  'github': 'https://github.com',
  'Gmail': 'https://gmail.com',
  'gmail': 'https://gmail.com',
  'MindVideo': 'https://www.mindvideo.ai',
  'mindvideo': 'https://www.mindvideo.ai',
  'Outlook': 'https://outlook.com',
  'outlook': 'https://outlook.com',
  'Qoder': 'https://qoder.com',
  'qoder': 'https://qoder.com',
  'Sora': 'https://sora.com',
  'sora': 'https://sora.com',
  'Suno': 'https://suno.com',
  'suno': 'https://suno.com',
};

// Helper function to check if string is a valid URL
const isValidUrl = (str: string): boolean => {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

// 獲取網站的 URL（如果是已知名稱則返回映射 URL，否則檢查是否為有效 URL）
const getSiteUrl = (siteName: string): string | null => {
  // 先檢查映射表
  if (SITE_URL_MAP[siteName]) {
    return SITE_URL_MAP[siteName];
  }
  // 再檢查是否為有效 URL
  if (isValidUrl(siteName)) {
    return siteName;
  }
  return null;
};

const INITIAL_FORM: CommonAccountFormData = {
  name: "",
  ...Object.fromEntries([...Array(37)].map((_, i) => [`site${(i + 1).toString().padStart(2, '0')}`, ""])),
  ...Object.fromEntries([...Array(37)].map((_, i) => [`note${(i + 1).toString().padStart(2, '0')}`, ""]))
} as CommonAccountFormData;

export default function CommonAccountManagement() {
  const { items: accounts, loading, fetchAll, create, update, remove, error } = useCrud<CommonAccount>(API_ENDPOINTS.COMMON_ACCOUNT);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CommonAccountFormData>(INITIAL_FORM);
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [expandedAccounts, setExpandedAccounts] = useState<Record<string, boolean>>({});
  // Inline edit state: { accountId, idx, siteName, note }
  const [inlineEdit, setInlineEdit] = useState<{ accountId: string; idx: string; siteName: string; note: string } | null>(null);
  // Site filter state
  const [siteFilter, setSiteFilter] = useState<string | null>(null);
  // Name search state
  const [searchQuery, setSearchQuery] = useState("");
  // Sort order state
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  // Error state for duplicate name
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  // Copy success message state
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Collect all unique site names from all accounts
  const allSiteNames = useMemo(() => {
    const siteSet = new Set<string>();
    accounts.forEach(account => {
      [...Array(37)].forEach((_, i) => {
        const siteKey = `site${(i + 1).toString().padStart(2, '0')}` as keyof CommonAccount;
        const siteName = account[siteKey] as string;
        if (siteName) siteSet.add(siteName.trim());
      });
    });
    // Sort alphabetically a~z A~Z
    return Array.from(siteSet).sort((a, b) => a.localeCompare(b));
  }, [accounts]);

  // Filter accounts based on selected site filter and search query
  const filteredAccounts = useMemo(() => {
    let filtered = accounts.filter(account => {
      // Filter by search query (name)
      const matchesSearch = account.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      // Filter by site selection
      if (!siteFilter) return true;
      return [...Array(37)].some((_, i) => {
        const siteKey = `site${(i + 1).toString().padStart(2, '0')}` as keyof CommonAccount;
        const siteName = account[siteKey] as string;
        return siteName?.trim() === siteFilter.trim();
      });
    });

    // Sort alphabetically by name
    filtered = filtered.sort((a, b) => {
      const comparison = a.name.localeCompare(b.name);
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [accounts, siteFilter, searchQuery, sortOrder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;

    // 檢查名稱格式 (必須包含 @ 和 .)
    const nameRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!nameRegex.test(form.name.trim())) {
      setDuplicateError("帳號名稱格式不正確，必須符合 example@domain.com 格式");
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // 檢查名稱是否重複 (僅限新增模式)
    if (!editingId) {
      const isExisting = accounts.some(a => a.name.trim().toLowerCase() === form.name.trim().toLowerCase());
      if (isExisting) {
        setDuplicateError(`帳號名稱「${form.name}」已存在，請勿重複新增`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    } else {
      // 編輯模式：如果名稱被修改且新名稱已存在（且不是原本編輯的這個）
      const editingAccount = accounts.find(a => a.$id === editingId);
      if (editingAccount && form.name.trim().toLowerCase() !== editingAccount.name.trim().toLowerCase()) {
        const isExisting = accounts.some(a => a.name.trim().toLowerCase() === form.name.trim().toLowerCase());
        if (isExisting) {
          setDuplicateError(`帳號名稱「${form.name}」已存在，請使用其他名稱`);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
      }
    }

    // 檢查站點名稱是否重複
    const siteNames = Object.keys(form)
      .filter(key => key.startsWith('site') && key !== 'name')
      .map(key => (form as any)[key]?.trim())
      .filter(name => name && name !== "");
    
    // 找出重複的名稱
    const duplicates = siteNames.filter((name, index) => siteNames.indexOf(name) !== index);
    if (duplicates.length > 0) {
      setDuplicateError(`常用網站名稱重複: 「${duplicates[0]}」，請檢查 01~37 欄位`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setDuplicateError(null);

    // 根據字母排序站點與備註 (不包含空值)
    const sortedPairs = [...Array(37)].map((_, i) => {
      const idx = (i + 1).toString().padStart(2, '0');
      return {
        site: (form as any)[`site${idx}`] || "",
        note: (form as any)[`note${idx}`] || ""
      };
    }).filter(pair => pair.site.trim() !== "");

    // 排序
    sortedPairs.sort((a, b) => a.site.localeCompare(b.site, 'zh-TW', { sensitivity: 'base' }));

    // 建立新的表單物件，將排序後的內容填入前段，後段清空
    const sortedForm = { ...form };
    [...Array(37)].forEach((_, i) => {
      const idx = (i + 1).toString().padStart(2, '0');
      if (i < sortedPairs.length) {
        (sortedForm as any)[`site${idx}`] = sortedPairs[i].site;
        (sortedForm as any)[`note${idx}`] = sortedPairs[i].note;
      } else {
        (sortedForm as any)[`site${idx}`] = "";
        (sortedForm as any)[`note${idx}`] = "";
      }
    });

    // 清理 payload，移除後端 metadata，並根據操作決定是否保留空值
    const getPayload = (data: any, isUpdate: boolean) => {
      const payload = { ...data };
      // 移除 metadata
      delete payload.$id;
      delete payload.$createdAt;
      delete payload.$updatedAt;
      
      // 對於建立操作，移除空值以避免驗證錯誤
      // 對於更新操作，保留空值以利於清除資料庫中的欄位 (Appwrite String 欄位接受 "")
      if (!isUpdate) {
        Object.keys(payload).forEach(key => {
          if (payload[key] === "" || payload[key] === null || payload[key] === undefined) {
            delete payload[key];
          }
        });
      }
      return payload;
    };

    const isUpdate = !!editingId;
    const payload = getPayload(sortedForm, isUpdate);

    try {
      if (editingId) {
        await update(editingId, payload);
      } else {
        await create(payload);
      }
      resetForm();
      fetchAll();
    } catch (err) {
      console.error("Save failed:", err);
      alert("儲存失敗");
    }
  };

  const handleEdit = (account: CommonAccount) => {
    const formData = { ...INITIAL_FORM };
    Object.keys(formData).forEach(key => {
      if (key in account) {
        (formData as any)[key] = (account as any)[key] || "";
      }
    });
    setForm(formData);
    setEditingId(account.$id);
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Copy note (account info) to clipboard
  const handleCopyNote = async (text: string, accountId?: string) => {
    try {
      // Try modern Clipboard API first
      try {
        await navigator.clipboard.writeText(text);
      } catch (clipboardError) {
        // Fallback method for non-secure contexts or blocked Clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          const successful = document.execCommand('copy');
          if (!successful) {
            throw new Error('execCommand copy failed');
          }
        } finally {
          textArea.remove();
        }
      }
      
      // Check if it looks like an email (simple check)
      const isEmail = text.includes('@') && text.includes('.');
      const message = isEmail ? '✅ 已複製帳號！' : '✅ 已複製備註！';
      
      // Show message temporarily
      if (accountId) {
        setCopySuccess(accountId);
        setTimeout(() => setCopySuccess(null), 2000);
      } else {
        alert(message);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('❌ 複製失敗：' + (err instanceof Error ? err.message : '未知錯誤'));
    }
  };

  // 匯出 CSV
  const exportToCSV = () => {
    if (accounts.length === 0) {
      alert('沒有資料可匯出');
      return;
    }

    // 建立 CSV 表頭
    const headers = ['name'];
    for (let i = 1; i <= 37; i++) {
      const idx = i.toString().padStart(2, '0');
      headers.push(`site${idx}`, `note${idx}`);
    }

    // 建立 CSV 內容
    const rows = accounts.map(account => {
      const row: string[] = [account.name || ''];
      for (let i = 1; i <= 37; i++) {
        const idx = i.toString().padStart(2, '0');
        const siteKey = `site${idx}` as keyof CommonAccount;
        const noteKey = `note${idx}` as keyof CommonAccount;
        const site = (account[siteKey] as string) || '';
        const note = (account[noteKey] as string) || '';
        // CSV 處理：如果包含逗號、換行或雙引號，需要用雙引號包起並轉義
        row.push(
          site.includes(',') || site.includes('\n') || site.includes('"') 
            ? `"${site.replace(/"/g, '""')}"` 
            : site
        );
        row.push(
          note.includes(',') || note.includes('\n') || note.includes('"') 
            ? `"${note.replace(/"/g, '""')}"` 
            : note
        );
      }
      return row.join(',');
    });

    // 組合 CSV
    const csvContent = [headers.join(','), ...rows].join('\n');
    
    // 加入 BOM 以支援 Excel 開啟中文
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // 下載
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'appwrite-CommonAccount.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // 匯入狀態
  const [importPreview, setImportPreview] = useState<{data: CommonAccountFormData[], errors: string[]} | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useState<HTMLInputElement | null>(null);

  // 解析單行 CSV（處理引號內的逗號）
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
      
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
        
      if (inQuotes) {
        if (char === '"') {
          if (line[i + 1] === '"') {
            current += '"';
            i++; // 跳過轉義的引號
          } else {
            inQuotes = false;
          }
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          result.push(current);
          current = '';
        } else {
          current += char;
        }
      }
    }
    result.push(current);
      
    return result;
  };
  
  // 解析完整 CSV（處理多行欄位）
  const parseFullCSV = (text: string): string[][] => {
    const rows: string[][] = [];
    const cleanText = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    let currentRow: string[] = []; let currentField = ''; let inQuotes = false;
    for (let i = 0; i < cleanText.length; i++) {
      const char = cleanText[i];
      if (inQuotes) {
        if (char === '"') { if (cleanText[i + 1] === '"') { currentField += '"'; i++; } else { inQuotes = false; } }
        else { currentField += char; }
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
  
  // 解析 CSV
  const parseCSV = (text: string): {data: CommonAccountFormData[], errors: string[]} => {
    const errors: string[] = [];
    const data: CommonAccountFormData[] = [];
      
    const rows = parseFullCSV(text);
      
    if (rows.length < 2) {
      errors.push('CSV 檔案至少需要表頭和一行資料');
      return { data, errors };
    }
      
    // 建立預期的表頭
    const expectedHeaders = ['name'];
    for (let i = 1; i <= 37; i++) {
      const idx = i.toString().padStart(2, '0');
      expectedHeaders.push(`site${idx}`, `note${idx}`);
    }
    const EXPECTED_COLUMN_COUNT = expectedHeaders.length; // 75 欄
      
    // 解析表頭
    const headerValues = rows[0].map(h => h.trim());
      
    // 嚴格檢查表頭欄位數量
    if (headerValues.length !== EXPECTED_COLUMN_COUNT) {
      errors.push(`表頭欄位數量錯誤: 預期 ${EXPECTED_COLUMN_COUNT} 欄，實際 ${headerValues.length} 欄`);
      if (headerValues.length > EXPECTED_COLUMN_COUNT) {
        errors.push(`→ 多了 ${headerValues.length - EXPECTED_COLUMN_COUNT} 欄（可能有多餘的逗號）`);
      } else {
        errors.push(`→ 少了 ${EXPECTED_COLUMN_COUNT - headerValues.length} 欄（可能缺少逗號）`);
      }
      return { data, errors };
    }
      
    // 檢查第一欄是否為 "name"
    if (headerValues[0] !== 'name') {
      errors.push(`第一欄必須是 "name"，實際為 "${headerValues[0]}"`);
      return { data, errors };
    }
      
    // 嚴格檢查表頭名稱
    for (let i = 0; i < expectedHeaders.length; i++) {
      const expected = expectedHeaders[i];
      const actual = headerValues[i] || '';
      if (actual !== expected) {
        errors.push(`表頭第 ${i + 1} 欄錯誤: 預期 "${expected}"，實際 "${actual}"`);
        // 只顯示前 5 個錯誤
        if (errors.length >= 5) {
          errors.push('...更多表頭錯誤已省略');
          break;
        }
      }
    }
      
    if (errors.length > 0) {
      return { data, errors };
    }
      
    // 解析資料行
    for (let i = 1; i < rows.length; i++) {
      const values = rows[i];
      const lineNum = i + 1;
        
      // 嚴格檢查欄位數量
      if (values.length !== EXPECTED_COLUMN_COUNT) {
        if (values.length > EXPECTED_COLUMN_COUNT) {
          errors.push(`第 ${lineNum} 行: 欄位過多 (預期 ${EXPECTED_COLUMN_COUNT}，實際 ${values.length})，多了 ${values.length - EXPECTED_COLUMN_COUNT} 欄`);
        } else {
          errors.push(`第 ${lineNum} 行: 欄位不足 (預期 ${EXPECTED_COLUMN_COUNT}，實際 ${values.length})，少了 ${EXPECTED_COLUMN_COUNT - values.length} 欄`);
        }
        continue;
      }
        
      // 檢查 name 欄位
      if (!values[0] || !values[0].trim()) {
        errors.push(`第 ${lineNum} 行: name 欄位不能為空`);
        continue;
      }
        
      const formData: CommonAccountFormData = { name: values[0].trim() };
        
      // 填充 site/note 欄位
      for (let j = 1; j <= 37; j++) {
        const idx = j.toString().padStart(2, '0');
        const siteIndex = j * 2 - 1; // 1, 3, 5, ...
        const noteIndex = j * 2;     // 2, 4, 6, ...
          
        (formData as any)[`site${idx}`] = values[siteIndex]?.trim() || '';
        (formData as any)[`note${idx}`] = values[noteIndex]?.trim() || '';
      }
        
      data.push(formData);
    }
      
    return { data, errors };
  };

  // 處理檔案選擇
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.name.endsWith('.csv')) {
      alert('請選擇 CSV 檔案');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const result = parseCSV(text);
      setImportPreview(result);
    };
    reader.readAsText(file, 'UTF-8');
    
    // 清除 input 以便可以重複選擇同一檔案
    e.target.value = '';
  };

  // 執行匯入
  const executeImport = async () => {
    if (!importPreview || importPreview.data.length === 0) return;
    
    setImporting(true);
    setImportProgress({ current: 0, total: importPreview.data.length });
    
    try {
      let successCount = 0;
      let failCount = 0;
      
      for (let i = 0; i < importPreview.data.length; i++) {
        const formData = importPreview.data[i];
        setImportProgress({ current: i + 1, total: importPreview.data.length });
        try {
          // 檢查是否已存在同名帳號
          const existing = accounts.find(a => a.name === formData.name);
          if (existing) {
            // 更新現有
            await update(existing.$id, formData);
          } else {
            // 新增
            await create(formData);
          }
          successCount++;
        } catch (err) {
          console.error(`匯入 ${formData.name} 失敗:`, err);
          failCount++;
        }
      }
      
      await fetchAll();
      setImporting(false);
      setImportProgress({ current: 0, total: 0 });
      setImportPreview(null);
      alert(`匯入完成！\n成功: ${successCount} 筆\n失敗: ${failCount} 筆`);
    } catch (err) {
      console.error('匯入失敗:', err);
      setImporting(false);
      setImportProgress({ current: 0, total: 0 });
      alert('匯入過程中發生錯誤');
    }
  };

  const handleDelete = async (account: CommonAccount) => {
    if (!confirm(`確定要刪除「${account.name}」嗎？`)) return;

    try {
      await remove(account.$id);
      fetchAll();
    } catch (err) {
      console.error("Delete failed:", err);
      alert("刪除失敗");
    }
  };

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setExpandedNotes({});
    setEditingId(null);
    setDuplicateError(null);
    setIsFormOpen(false);
  };

  const toggleNote = (idx: string) => {
    setExpandedNotes(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const toggleAccountExpand = (accountId: string) => {
    setExpandedAccounts(prev => ({ ...prev, [accountId]: !prev[accountId] }));
  };

  // Start inline editing for a single item
  const startInlineEdit = (accountId: string, idx: string, siteName: string, note: string) => {
    setInlineEdit({ accountId, idx, siteName, note });
  };

  // Cancel inline edit
  const cancelInlineEdit = () => {
    setInlineEdit(null);
  };

  // Save inline edit
  const saveInlineEdit = async () => {
    if (!inlineEdit) return;
    
    const account = accounts.find(a => a.$id === inlineEdit.accountId);
    if (!account) return;

    const siteKey = `site${inlineEdit.idx}`;
    const noteKey = `note${inlineEdit.idx}`;

    // 檢查站點名稱是否與該帳號其他站點重複
    if (inlineEdit.siteName.trim() !== "") {
      const otherSites = Object.entries(account)
        .filter(([key, val]) => key.startsWith('site') && key !== siteKey && key !== 'name' && val)
        .map(([_, val]) => (val as string).trim());
      
      if (otherSites.includes(inlineEdit.siteName.trim())) {
        alert(`此帳號已有重複的站點名稱: 「${inlineEdit.siteName.trim()}」，請修改名稱後再儲存`);
        return;
      }
    }

    try {
      const payload = { [siteKey]: inlineEdit.siteName, [noteKey]: inlineEdit.note };
      await update(account.$id, payload);
      setInlineEdit(null);
      fetchAll();
    } catch (err) {
      console.error("Inline save failed:", err);
      alert("儲存失敗");
    }
  };

  if (loading) return <FullPageLoading text="載入常用帳號中..." />;

  return (
    <div className="space-y-4 lg:space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <SectionHeader 
        title="鋒兄常用" 
        subtitle={`共 ${accounts.length} 組帳號設定`}
        showAccountLabel={true}
        action={
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
              id="csv-import-input"
            />
            <Button 
              onClick={() => document.getElementById('csv-import-input')?.click()}
              variant="outline"
              className="rounded-xl flex items-center gap-2"
              title="匯入 CSV"
            >
              <Upload size={18} />
              匯入
            </Button>
            <Button 
              onClick={exportToCSV}
              variant="outline"
              className="rounded-xl flex items-center gap-2"
              title="匯出 CSV"
            >
              <Download size={18} />
              匯出
            </Button>
            <Button 
              onClick={() => setIsFormOpen(!isFormOpen)} 
              className="rounded-xl flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg"
            >
              {isFormOpen ? <X size={18} /> : <Plus size={18} />}
              {isFormOpen ? "取消" : "新增帳號組"}
            </Button>
          </div>
        }
      />

      {/* 匯入預覽對話框 */}
      {importPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">匯入預覽</h3>
              <p className="text-sm text-gray-500 mt-1">請確認以下資料是否正確</p>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[50vh]">
              {/* 錯誤訊息 */}
              {importPreview.errors.length > 0 && (
                <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                  <h4 className="font-semibold text-red-600 dark:text-red-400 mb-2">格式錯誤:</h4>
                  <ul className="text-sm text-red-600 dark:text-red-400 space-y-1">
                    {importPreview.errors.map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* 資料預覽 */}
              {importPreview.data.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-700 dark:text-gray-300">
                    將匯入 {importPreview.data.length} 筆資料:
                  </h4>
                  <div className="space-y-2">
                    {importPreview.data.map((item, i) => {
                      const existing = accounts.find(a => a.name === item.name);
                      const siteCount = Object.keys(item).filter(k => k.startsWith('site') && (item as any)[k]).length;
                      return (
                        <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <span className="font-medium text-gray-900 dark:text-gray-100">{item.name}</span>
                          <span className="text-xs text-gray-500">{siteCount} 個網站</span>
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
                  <Button
                    variant="outline"
                    onClick={() => setImportPreview(null)}
                    className="rounded-xl"
                  >
                    取消
                  </Button>
                  <Button
                    onClick={executeImport}
                    disabled={importPreview.data.length === 0 || importPreview.errors.length > 0}
                    className="rounded-xl bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    確認匯入 ({importPreview.data.length} 筆)
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {isFormOpen && (
        <div className="space-y-4">
          {duplicateError && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
              <AlertTriangle className="text-red-500 shrink-0" size={20} />
              <p className="text-red-700 font-medium">{duplicateError}</p>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setDuplicateError(null)}
                className="ml-auto h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-lg"
              >
                <X size={16} />
              </Button>
            </div>
          )}
          <FormCard title={editingId ? `編輯帳號` : "新增帳號組合"} accentColor="from-blue-500 to-blue-600">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">帳號名稱</label>
                <Input
                  placeholder="輸入帳號名稱 (例如: example@example.com)"
                  value={form.name}
                  onChange={(e) => {
                    setForm({ ...form, name: e.target.value });
                    if (duplicateError) setDuplicateError(null);
                  }}
                  required
                  className="h-12 rounded-xl text-lg font-medium"
                />
              </div>

            <FormActions>
              <Button type="submit" className="h-12 px-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 font-bold shadow-xl">
                <Save size={20} />
                儲存帳號組合
              </Button>
              <Button type="button" variant="outline" onClick={resetForm} className="h-12 px-8 rounded-xl border-gray-200 dark:border-gray-700">
                取消
              </Button>
            </FormActions>

            <div className="space-y-4">
              <h3 className="text-md font-bold flex items-center gap-2 text-blue-600">
                <LinkIcon size={18} /> 常用網站與備註 (最多 37 個)
              </h3>
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin">
                {[...Array(37)].map((_, i) => {
                  const idx = (i + 1).toString().padStart(2, '0');
                  const siteKey = `site${idx}` as keyof CommonAccountFormData;
                  const noteKey = `note${idx}` as keyof CommonAccountFormData;
                  const isExpanded = expandedNotes[idx];

                  return (
                    <div key={idx} className="space-y-2 pb-2 border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                      <div className="space-y-1">
                        <div className="flex gap-2 items-center">
                          <span className="w-8 h-10 flex items-center justify-center text-xs text-gray-400 font-mono shrink-0">{idx}</span>
                          <div className="flex-1 flex gap-2">
                            <Input
                              placeholder={`網站名稱 / Site Name (${idx})`}
                              value={(form as any)[siteKey] || ""}
                              onChange={(e) => setForm({ ...form, [siteKey]: e.target.value } as any)}
                              className="rounded-xl flex-1 h-12"
                              maxLength={100}
                            />
                            <Select
                              value=""
                              onValueChange={(val) => setForm({ ...form, [siteKey]: val } as any)}
                            >
                              <SelectTrigger className="h-12 w-12 rounded-xl px-0 justify-center shrink-0">
                                <ChevronDown className="h-4 w-4" />
                              </SelectTrigger>
                              <SelectContent>
                                {allSiteNames.map(site => (
                                  <SelectItem key={site} value={site}>{site}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleNote(idx)}
                            className={`shrink-0 rounded-xl h-12 w-12 ${isExpanded ? 'bg-purple-100 text-purple-600 hover:bg-purple-200' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
                            title="顯示/隱藏備註"
                          >
                            <NoteIcon size={18} />
                          </Button>
                        </div>
                        <div className="pl-10 px-1 h-4">
                          {(form as any)[siteKey] ? (
                            <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">已輸入 / Entered</span>
                          ) : (
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請輸入名稱 / (Optional) Please enter name</span>
                          )}
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="pl-10 pr-2 pb-2 space-y-1">
                          <Textarea
                            placeholder={`備註內容 / Note Content (Max 100 chars)`}
                            value={(form as any)[noteKey] || ""}
                            onChange={(e) => setForm({ ...form, [noteKey]: e.target.value } as any)}
                            className="rounded-xl border-purple-100 dark:border-purple-900/30 min-h-[80px] resize-y py-2 text-sm shadow-inner"
                            maxLength={100}
                          />
                          <div className="px-1 h-4">
                            {(form as any)[noteKey] ? (
                              <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">已輸入 / Entered</span>
                            ) : (
                              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請輸入備註 / (Optional) Please enter note</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </form>
        </FormCard>
      </div>
      )}

      {/* Search and Site Filter */}
      <div className="space-y-4">
        {/* Search Input and Sort */}
        <div className="flex gap-3">
          <div className="relative group flex-1">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
            <Input
              placeholder="搜尋帳號名稱 (例如: activist949...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-12 rounded-xl border-gray-200 dark:border-gray-800 focus:ring-2 focus:ring-blue-500/20 transition-all text-lg"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            )}
          </div>
          <Button
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            variant="outline"
            className="h-12 px-4 rounded-xl flex items-center gap-2 shrink-0"
            title={sortOrder === 'asc' ? '依字母順序 (A-Z)' : '依字母倒序 (Z-A)'}
          >
            {sortOrder === 'asc' ? (
              <>
                <ChevronUp size={18} />
                A-Z
              </>
            ) : (
              <>
                <ChevronDown size={18} />
                Z-A
              </>
            )}
          </Button>
        </div>

        {allSiteNames.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center overflow-x-auto pb-1 scrollbar-hide sm:flex-wrap">
            <span className="text-sm text-gray-500 flex items-center gap-1 shrink-0">
              <Filter size={14} />
              篩選:
            </span>
            <Button
              size="sm"
              variant={siteFilter === null ? "default" : "outline"}
              onClick={() => setSiteFilter(null)}
              className={`h-8 px-3 rounded-lg text-sm shrink-0 ${siteFilter === null ? 'bg-blue-600 text-white' : ''}`}
            >
              全部 ({accounts.length})
            </Button>
            {allSiteNames.map(siteName => {
              const count = accounts.filter(account => {
                return [...Array(37)].some((_, i) => {
                  const siteKey = `site${(i + 1).toString().padStart(2, '0')}` as keyof CommonAccount;
                  const name = account[siteKey] as string;
                  return name?.trim() === siteName.trim();
                });
              }).length;
              const siteUrl = getSiteUrl(siteName);
              return (
                <Button
                  key={siteName}
                  size="sm"
                  variant={siteFilter === siteName ? "default" : "outline"}
                  onClick={() => setSiteFilter(siteFilter === siteName ? null : siteName)}
                  className={`h-8 px-3 rounded-lg text-sm flex items-center gap-1.5 shrink-0 ${siteFilter === siteName ? 'bg-blue-600 text-white' : ''}`}
                >
                  {siteUrl && <FaviconImage siteUrl={siteUrl} siteName={siteName} size={14} />}
                  {siteName} ({count})
                </Button>
              );
            })}
          </div>
        )}
      </div>

      {filteredAccounts.length === 0 ? (
        <DataCard className="p-12 text-center">
          <Star size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">
            {siteFilter || searchQuery
              ? `沒有符合「${searchQuery || siteFilter}」的帳號` 
              : "尚無常用帳號資料，請點擊右上方「新增」按鈕"
            }
          </p>
        </DataCard>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredAccounts.map((account) => (
            <DataCard key={account.$id} className="flex flex-col h-full hover:shadow-lg transition-all duration-300 border-t-4 border-t-blue-500 overflow-hidden group">
              <div className="p-4 pr-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <NoteIcon size={20} className="text-blue-500 shrink-0" />
                  <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 truncate">
                    {account.name}
                  </h3>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => handleCopyNote(account.name, account.$id)}
                    className="h-7 w-7 p-0 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                    title="複製帳號"
                  >
                    <Copy size={14} />
                  </Button>
                  {copySuccess === account.$id && (
                    <span className="text-sm text-green-600 dark:text-green-400 font-medium animate-fade-in">
                      ✅ 已複製帳號！
                    </span>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => handleEdit(account)} className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg shadow-sm bg-white/50 dark:bg-gray-800/50">
                    <Edit2 size={16} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(account)} className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg shadow-sm bg-white/50 dark:bg-gray-800/50">
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
              
              <div className="p-4 flex-1 space-y-4">
                {(() => {
                  // Collect all non-empty site/note pairs
                  const items = [...Array(37)].map((_, i) => {
                    const idx = (i + 1).toString().padStart(2, '0');
                    const siteKey = `site${idx}` as keyof CommonAccount;
                    const noteKey = `note${idx}` as keyof CommonAccount;
                    const siteName = account[siteKey] as string;
                    const note = account[noteKey] as string;
                    if (!siteName && !note) return null;
                    return { idx, siteName, note };
                  }).filter(Boolean) as { idx: string; siteName: string; note: string }[];

                  const isExpanded = expandedAccounts[account.$id];
                  
                  // 篩選時且未展開時，將符合篩選條件的項目移到第一位
                  let displayItems = [...items];
                  if (!isExpanded && siteFilter) {
                    const matchIdx = displayItems.findIndex(item => item.siteName === siteFilter);
                    if (matchIdx > -1) {
                      const [matchItem] = displayItems.splice(matchIdx, 1);
                      displayItems.unshift(matchItem);
                    }
                  }

                  const visibleItems = isExpanded ? items : displayItems.slice(0, 3);
                  const hasMore = items.length > 3;

                  return (
                    <>
                      {visibleItems.map(({ idx, siteName, note }) => {
                        const isInlineEditing = inlineEdit?.accountId === account.$id && inlineEdit?.idx === idx;
                        
                        return (
                          <div key={idx} className="group/item relative bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800/50 transition-colors">
                            {isInlineEditing ? (
                              // Inline Edit Mode
                              <div className="space-y-3">
                                <div className="flex gap-2 items-center">
                            <div className="flex-1 flex gap-2">
                              <Input
                                placeholder={`網站名稱/${idx}`}
                                value={inlineEdit.siteName}
                                onChange={(e) => setInlineEdit({ ...inlineEdit, siteName: e.target.value })}
                                className="rounded-lg flex-1 h-9 text-sm"
                                autoFocus
                                maxLength={100}
                              />
                              <Select
                                value=""
                                onValueChange={(val) => setInlineEdit({ ...inlineEdit, siteName: val })}
                              >
                                <SelectTrigger className="h-9 w-9 rounded-lg px-0 justify-center shrink-0">
                                  <ChevronDown className="h-4 w-4" />
                                </SelectTrigger>
                                <SelectContent>
                                  {allSiteNames.map(site => (
                                    <SelectItem key={site} value={site}>{site}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                                </div>
                                <Textarea
                                  placeholder={`備註內容 (上限100個字)`}
                                  value={inlineEdit.note}
                                  onChange={(e) => setInlineEdit({ ...inlineEdit, note: e.target.value })}
                                  className="rounded-lg text-sm min-h-[120px] resize-y"
                                  rows={5}
                                  maxLength={100}
                                />
                                <div className="flex gap-2 justify-end">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={cancelInlineEdit}
                                    className="h-8 px-3 text-gray-500 hover:text-gray-700"
                                  >
                                    <X size={14} className="mr-1" />
                                    取消
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={saveInlineEdit}
                                    className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white"
                                  >
                                    <Save size={14} className="mr-1" />
                                    儲存
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              // Display Mode
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                {siteName && (() => {
                                  const siteUrl = getSiteUrl(siteName);
                                  return (
                                    <span className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 shrink-0">
                                      {siteUrl ? (
                                        <>
                                          <FaviconImage siteUrl={siteUrl} siteName={siteName} size={16} />
                                          <a 
                                            href={siteUrl} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="truncate max-w-[150px] sm:max-w-[200px] text-blue-600 dark:text-blue-400 hover:underline"
                                          >
                                            {siteName}
                                          </a>
                                        </>
                                      ) : (
                                        <>
                                          <LinkIcon size={16} className="text-gray-400" />
                                          <span className="truncate max-w-[150px] sm:max-w-[200px]">{siteName}</span>
                                        </>
                                      )}
                                    </span>
                                  );
                                })()}
                                <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
                                  {note && (
                                    <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-pre-wrap break-words line-clamp-2 sm:line-clamp-none">
                                      {note}
                                    </span>
                                  )}
                                  <div className="flex items-center gap-1 shrink-0">
                                    {note && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleCopyNote(note)}
                                        className="h-7 w-7 p-0 opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100 transition-opacity text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg"
                                        title="複製備註"
                                      >
                                        <Copy size={14} />
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => startInlineEdit(account.$id, idx, siteName || '', note || '')}
                                      className="h-7 w-7 p-0 opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100 transition-opacity text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                                      title="編輯此項目"
                                    >
                                      <Edit2 size={14} />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {hasMore && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleAccountExpand(account.$id)}
                          className="w-full h-10 text-sm text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl flex items-center justify-center gap-2"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp size={16} />
                              收起 (共{items.length}項)
                            </>
                          ) : (
                            <>
                              <ChevronDown size={16} />
                              查看更多 (共{items.length}項)
                            </>
                          )}
                        </Button>
                      )}
                    </>
                  );
                })()}
              </div>
            </DataCard>
          ))}
        </div>
      )}
    </div>
  );
}
