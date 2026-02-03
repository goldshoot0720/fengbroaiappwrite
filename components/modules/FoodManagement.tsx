"use client";

import { useState, useEffect, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Minus, ChevronDown, ChevronUp, Search, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionHeader } from "@/components/ui/section-header";
import { FormCard, FormGrid, FormActions } from "@/components/ui/form-card";
import { DataCard, DataCardList, DataCardItem } from "@/components/ui/data-card";
import { EmptyState } from "@/components/ui/empty-state";
import { FullPageLoading } from "@/components/ui/loading-spinner";
import { StatusBadge } from "@/components/ui/status-badge";
import { useFoods, getFoodExpiryInfo } from "@/hooks/useFoods";
import { FoodFormData, Food } from "@/types";
import { formatDate, formatDaysRemaining } from "@/lib/formatters";

const INITIAL_FORM: FoodFormData = { name: "", amount: 0, todate: "", photo: "", price: 0, shop: "", photohash: "" };

export default function FoodManagement() {
  const { foods, loading, error, createFood, updateFood, deleteFood, updateAmount } = useFoods();
  const [form, setForm] = useState<FoodFormData>(INITIAL_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string>("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // 取得已存在的不重複商店
  const existingShops = useMemo(() => {
    const shops = foods.map(f => f.shop).filter(Boolean) as string[];
    return Array.from(new Set(shops)).sort();
  }, [foods]);

  // 取得已存在的不重複食品名稱
  const existingNames = useMemo(() => {
    const names = foods.map(f => f.name).filter(Boolean);
    return Array.from(new Set(names)).sort();
  }, [foods]);

  // 搜尋過濾
  const filteredFoods = useMemo(() => {
    if (!searchQuery.trim()) return foods;
    const query = searchQuery.toLowerCase();
    return foods.filter(food => 
      food.name?.toLowerCase().includes(query) ||
      food.shop?.toLowerCase().includes(query)
    );
  }, [foods, searchQuery]);

  useEffect(() => {
    // Clean up object URLs on unmount
    return () => {
      if (photoPreviewUrl && photoPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [photoPreviewUrl]);

  const getAppwriteHeaders = () => {
    if (typeof window === 'undefined') return {};
    const endpoint = localStorage.getItem('appwrite_endpoint');
    const project = localStorage.getItem('appwrite_project');
    const database = localStorage.getItem('appwrite_database');
    const apiKey = localStorage.getItem('appwrite_api_key');
    const bucket = localStorage.getItem('appwrite_bucket');
    return {
      ...(endpoint && { 'X-Appwrite-Endpoint': endpoint }),
      ...(project && { 'X-Appwrite-Project': project }),
      ...(database && { 'X-Appwrite-Database': database }),
      ...(apiKey && { 'X-Appwrite-API-Key': apiKey }),
      ...(bucket && { 'X-Appwrite-Bucket-ID': bucket }),
    };
  };

  const handlePhotoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB in bytes
    if (file.size > maxSize) {
      alert(`檔案大小超過限制（${Math.round(file.size / 1024 / 1024)}MB > 50MB）`);
      return;
    }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('只支援 JPG, PNG, GIF, WEBP 格式的圖片');
      return;
    }

    // Store file for later upload, create preview URL
    setSelectedPhotoFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPhotoPreviewUrl(objectUrl);
    // Clear the URL input when file is selected
    setForm({ ...form, photo: "" });
  };

  const uploadPhotoToAppwrite = async (file: File): Promise<string> => {
    setPhotoUploading(true);
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    try {
      const response = await fetch('/api/upload-image', {
        method: 'POST',
        headers: getAppwriteHeaders(),
        body: formDataUpload,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '圖片上傳失敗');
      }

      const data = await response.json();
      return data.url;
    } catch (error) {
      throw error;
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      let finalPhoto = form.photo;

      // If a file is selected, upload it to Appwrite
      if (selectedPhotoFile) {
        finalPhoto = await uploadPhotoToAppwrite(selectedPhotoFile);
      }

      const formData = {
        ...form,
        photo: finalPhoto,
        price: form.price || 0,
        shop: form.shop || '',
        photohash: form.photohash || '',
      };

      if (editingId) {
        await updateFood(editingId, formData);
      } else {
        await createFood(formData);
      }
      resetForm();
    } catch (err) {
      alert("操作失敗：" + (err instanceof Error ? err.message : "請稍後再試"));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("確定刪除？")) return;
    try {
      await deleteFood(id);
    } catch {
      alert("刪除失敗，請稍後再試");
    }
  };

  const handleEdit = (food: Food) => {
    setForm({ 
      name: food.name,
      amount: food.amount,
      todate: formatDate(food.todate),
      photo: food.photo || '',
      price: food.price || 0,
      shop: food.shop || '',
      photohash: food.photohash || '',
    });
    setEditingId(food.$id);
    setIsFormOpen(true);
    // 滾動到頁面頂部讓用戶看到編輯表單
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setEditingId(null);
    setIsFormOpen(false);
    // Reset photo-related states
    setSelectedPhotoFile(null);
    setPhotoPreviewUrl("");
  };

  // CSV 匯入/匯出功能
  const [importPreview, setImportPreview] = useState<{data: FoodFormData[], errors: string[]} | null>(null);
  const [importFormat, setImportFormat] = useState<'appwrite' | 'supabase' | null>(null);
  const [pendingCSVText, setPendingCSVText] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const CSV_HEADERS = ['name', 'amount', 'todate', 'photo', 'price', 'shop', 'photohash'];
  const EXPECTED_COLUMN_COUNT = CSV_HEADERS.length; // 7 欄

  const SUPABASE_FOOD_HEADERS = ['食物名稱', '數量', '價格(NT$)', '購買商店', '到期日期', '照片網址'];

  const convertSupabaseFood = (text: string): string => {
    const rows = parseFullCSV(text);
    if (rows.length < 1) return text;
    const newLines: string[] = [CSV_HEADERS.join(',')];
    for (let i = 1; i < rows.length; i++) {
      const values = rows[i];
      // Supabase: 食物名稱, 數量, 價格(NT$), 購買商店, 到期日期, 照片網址
      // Appwrite: name, amount, todate, photo, price, shop, photohash
      const name = values[0]?.trim() || '';
      const amount = values[1]?.trim() || '0';
      const price = values[2]?.trim() || '0';
      const shop = values[3]?.trim() || '';
      const todate = values[4]?.trim() || '';
      const photo = values[5]?.trim() || '';
      const photohash = '';
      const escapeCSV = (val: string) => {
        if (val.includes(',') || val.includes('"') || val.includes('\n')) return `"${val.replace(/"/g, '""')}"`;
        return val;
      };
      newLines.push([escapeCSV(name), escapeCSV(amount), escapeCSV(todate), escapeCSV(photo), escapeCSV(price), escapeCSV(shop), escapeCSV(photohash)].join(','));
    }
    return newLines.join('\n');
  };

  const exportToCSV = () => {
    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`;
      return str;
    };
    const rows = [CSV_HEADERS.join(',')];
    foods.forEach(food => {
      rows.push([escapeCSV(food.name), escapeCSV(food.amount || 0), escapeCSV(food.todate || ''), escapeCSV(food.photo || ''), escapeCSV(food.price || 0), escapeCSV(food.shop || ''), escapeCSV(food.photohash || '')].join(','));
    });
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'appwrite-Food.csv';
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

  const detectCSVFormat = (text: string): 'appwrite' | 'supabase' | 'unknown' => {
    const rows = parseFullCSV(text);
    if (rows.length === 0) return 'unknown';
    const headers = rows[0].map(h => h.trim());
    if (headers.includes('name')) return 'appwrite';
    if (headers.includes('食物名稱')) return 'supabase';
    return 'unknown';
  };

  const parseCSV = (text: string): {data: FoodFormData[], errors: string[]} => {
    const errors: string[] = []; const data: FoodFormData[] = [];
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
      data.push({ name: values[0].trim(), amount: parseFloat(values[1]) || 0, todate: values[2]?.trim() || '', photo: values[3]?.trim() || '', price: parseFloat(values[4]) || 0, shop: values[5]?.trim() || '', photohash: values[6]?.trim() || '' });
    }
    return { data, errors };
  };

  const handleCSVFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!file.name.endsWith('.csv')) { alert('請選擇 CSV 檔案'); return; }
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const format = detectCSVFormat(text);
      if (format === 'appwrite') { setImportPreview(parseCSV(text)); }
      else if (format === 'supabase') { setImportFormat('supabase'); setPendingCSVText(text); }
      else { alert('無法辨識 CSV 格式：表頭不符合 Appwrite 或 Supabase 格式'); }
    };
    reader.readAsText(file, 'UTF-8'); e.target.value = '';
  };

  const confirmSupabaseFoodImport = () => {
    const converted = convertSupabaseFood(pendingCSVText);
    setImportPreview(parseCSV(converted));
    setImportFormat(null);
    setPendingCSVText('');
  };

  const cancelSupabaseFoodImport = () => {
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
        const existing = foods.find(f => f.name === formData.name);
        if (existing) {
          await updateFood(existing.$id, formData);
        } else {
          await createFood(formData);
        }
        successCount++;
      } catch { failCount++; }
    }
    
    setImporting(false);
    setImportProgress({ current: 0, total: 0 });
    setImportPreview(null);
    alert(`匯入完成！\n成功: ${successCount} 筆\n失敗: ${failCount} 筆`);
  };

  if (loading) return <FullPageLoading text="載入食品資料中..." />;

  return (
    <div className="space-y-4 lg:space-y-6" id="food-management-container">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <SectionHeader
        title="鋒兄食品"
        subtitle={`共 ${foods.length} 項食品`}
        showAccountLabel={true}
        action={
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>即時同步</span>
          </div>
        }
      />

      <div className="flex justify-end gap-2">
        <input type="file" accept=".csv" onChange={handleCSVFileSelect} className="hidden" id="csv-import-food" />
        <Button onClick={() => document.getElementById('csv-import-food')?.click()} variant="outline" className="rounded-xl flex items-center gap-2" title="匯入 CSV">
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
          {isFormOpen ? "收起表單" : "新增食品"}
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
                    <span className="text-gray-700 dark:text-gray-300 font-medium">食物名稱</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono">name</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">數量</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono">amount</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">價格(NT$)</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono">price</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">購買商店</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono">shop</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">到期日期</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono">todate</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">照片網址</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono">photo</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">(無)</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono">photohash (空值)</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <Button variant="outline" onClick={cancelSupabaseFoodImport} className="rounded-xl">取消</Button>
              <Button onClick={confirmSupabaseFoodImport} className="rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white">
                確認轉換並匯入
              </Button>
            </div>
          </div>
        </div>
      )}

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
                      const existing = foods.find(f => f.name === item.name);
                      return (
                        <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <span className="font-medium text-gray-900 dark:text-gray-100">{item.name}</span>
                          <span className="text-xs text-gray-500">{item.amount} 個</span>
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
        <FoodForm
          form={form}
          setForm={setForm}
          editingId={editingId}
          photoPreviewUrl={photoPreviewUrl}
          selectedPhotoFile={selectedPhotoFile}
          photoUploading={photoUploading}
          handlePhotoFileSelect={handlePhotoFileSelect}
          existingShops={existingShops}
          existingNames={existingNames}
          onSubmit={handleSubmit}
          onCancel={resetForm}
        />
      )}

      {/* 搜尋欄位 */}
      {foods.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            placeholder="搜尋食品名稱、商店..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 rounded-xl"
          />
        </div>
      )}

      <DataCard>
        {foods.length === 0 ? (
          <EmptyState emoji="🍔" title="暫無食品資料" description="點擊上方按鈕新增您的第一筆食品資料" />
        ) : filteredFoods.length === 0 ? (
          <EmptyState emoji="🔍" title="無搜尋結果" description={`找不到「${searchQuery}」相關的食品`} />
        ) : (
          <>
            <DesktopTable
              foods={filteredFoods}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onAmountChange={updateAmount}
            />
            <MobileList
              foods={filteredFoods}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onAmountChange={updateAmount}
            />
          </>
        )}
      </DataCard>
    </div>
  );
}

// 表單元件
interface FoodFormProps {
  form: FoodFormData;
  setForm: (form: FoodFormData) => void;
  editingId: string | null;
  photoPreviewUrl: string;
  selectedPhotoFile: File | null;
  photoUploading: boolean;
  handlePhotoFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  existingShops: string[];
  existingNames: string[];
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

function FoodForm({ 
  form, 
  setForm, 
  editingId, 
  photoPreviewUrl, 
  selectedPhotoFile, 
  photoUploading, 
  handlePhotoFileSelect, 
  existingShops,
  existingNames,
  onSubmit, 
  onCancel 
}: FoodFormProps) {
  return (
    <FormCard title={editingId ? "編輯食品" : "新增食品"} accentColor="from-blue-500 to-blue-600">
      <form onSubmit={onSubmit} className="space-y-4">
        <FormGrid>
          <div className="space-y-1">
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Input
                  placeholder="食品名稱 / Food Name"
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
            <div className="flex gap-1 items-center">
              <Input
                placeholder="數量 / Quantity"
                type="number"
                min="0"
                value={form.amount || ""}
                onChange={(e) => setForm({ ...form, amount: e.target.value === "" ? 0 : parseInt(e.target.value) || 0 })}
                className="h-12 rounded-xl flex-1"
              />
              {(form.amount || 0) > 0 && (
                <div className="flex flex-col gap-0.5">
                  <button 
                    type="button"
                    onClick={() => setForm({ ...form, amount: (form.amount || 0) + 1 })}
                    className="p-1 hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 rounded transition-colors"
                    title="+1"
                  >
                    <Plus size={14} />
                  </button>
                  <button 
                    type="button"
                    onClick={() => setForm({ ...form, amount: Math.max(0, (form.amount || 0) - 1) })}
                    className="p-1 hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-600 rounded transition-colors"
                    title="-1"
                  >
                    <Minus size={14} />
                  </button>
                </div>
              )}
            </div>
            <div className="px-1 h-4">
              {(form.amount || 0) > 0 ? (
                <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">可以 + 或 - / Can use + or -</span>
              ) : (
                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請輸入數量 / (Optional) Please enter quantity</span>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex gap-1 items-center">
              <Input
                placeholder="有效期限 / Expiry Date"
                type="date"
                value={form.todate}
                onChange={(e) => setForm({ ...form, todate: e.target.value })}
                className="h-12 rounded-xl flex-1"
              />
              {form.todate && (
                <div className="flex flex-col gap-0.5">
                  <button 
                    type="button"
                    onClick={() => {
                      const d = new Date(form.todate);
                      d.setDate(d.getDate() + 7);
                      setForm({ ...form, todate: d.toISOString().split('T')[0] });
                    }}
                    className="p-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 rounded transition-colors"
                    title="+7天"
                  >
                    <Plus size={14} />
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      const d = new Date(form.todate);
                      d.setDate(d.getDate() - 7);
                      setForm({ ...form, todate: d.toISOString().split('T')[0] });
                    }}
                    className="p-1 hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-600 rounded transition-colors"
                    title="-7天"
                  >
                    <Minus size={14} />
                  </button>
                </div>
              )}
            </div>
                <div className="px-1 h-4">
                  {form.todate ? (
                    <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">可以 + 或 - (7天) / Can use + or - (7 Days)</span>
                  ) : (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請選擇日期 / (Optional) Please select a date</span>
                  )}
                </div>
          </div>
          <div className="space-y-1">
            <div className="flex gap-1 items-center">
              <Input
                placeholder="價格 / Price"
                type="number"
                min="0"
                value={form.price || ''}
                onChange={(e) => setForm({ ...form, price: e.target.value ? parseInt(e.target.value) : 0 })}
                className="h-12 rounded-xl flex-1"
              />
              {(form.price || 0) > 0 && (
                <div className="flex flex-col gap-0.5">
                  <button 
                    type="button"
                    onClick={() => setForm({ ...form, price: (form.price || 0) + 10 })}
                    className="p-1 hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 rounded transition-colors"
                    title="+10"
                  >
                    <Plus size={14} />
                  </button>
                  <button 
                    type="button"
                    onClick={() => setForm({ ...form, price: Math.max(0, (form.price || 0) - 10) })}
                    className="p-1 hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-600 rounded transition-colors"
                    title="-10"
                  >
                    <Minus size={14} />
                  </button>
                </div>
              )}
            </div>
            <div className="px-1 h-4">
              {(form.price || 0) > 0 ? (
                <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">可以 + 或 - / Can use + or -</span>
              ) : (
                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請輸入金額 / (Optional) Please enter amount</span>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Input
                  placeholder="商店/地點 / Shop/Location"
                  value={form.shop || ''}
                  onChange={(e) => setForm({ ...form, shop: e.target.value })}
                  className="h-12 rounded-xl w-full"
                />
                <div className="px-1 h-4">
                  {form.shop ? (
                    <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">已輸入 / Entered</span>
                  ) : (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請輸入商店 / (Optional) Please enter shop</span>
                  )}
                </div>
              </div>
              {existingShops.length > 0 && (
                <Select 
                  value="" 
                  onValueChange={(value) => {
                    if (value) {
                      setForm({ ...form, shop: value });
                    }
                  }}
                >
                  <SelectTrigger className="h-12 w-12 rounded-xl px-0 justify-center">
                    <ChevronDown className="h-4 w-4" />
                  </SelectTrigger>
                  <SelectContent>
                    {existingShops.map((shop) => (
                      <SelectItem key={shop} value={shop}>{shop}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-2">圖片</label>
            <div className="space-y-3">
              {/* URL 輸入 */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">圖片網址</label>
                <Input
                  type="url"
                  value={form.photo}
                  onChange={(e) => {
                    setForm({ ...form, photo: e.target.value });
                    // We don't need to set photo preview here since it's passed as prop
                    // setSelectedPhotoFile(null) equivalent is handled by parent
                  }}
                  placeholder="https://..."
                />
              </div>

              {/* 或者上傳檔案 */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">或上傳圖片檔案（上限 50MB）</label>
                <Input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  onChange={handlePhotoFileSelect}
                />
                {selectedPhotoFile && (
                  <p className="text-xs text-gray-500 mt-1">
                    已選擇: {selectedPhotoFile.name} ({Math.round(selectedPhotoFile.size / 1024)}KB)
                  </p>
                )}
              </div>

              {/* 預覽 */}
              {photoPreviewUrl && (
                <div className="mt-2">
                  <img
                    src={photoPreviewUrl}
                    alt="圖片預覽"
                    className="w-32 h-32 object-contain rounded border"
                  />
                </div>
              )}
            </div>
          </div>
        </FormGrid>
        <FormActions>
          <Button type="submit" disabled={photoUploading} className="h-12 px-6 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-xl font-medium shadow-lg shadow-blue-500/25">
            {photoUploading ? "上傳中..." : editingId ? "更新食品" : "新增食品"}
          </Button>
          {editingId && (
            <Button type="button" variant="outline" onClick={onCancel} className="h-12 px-6 rounded-xl" disabled={photoUploading}>
              取消編輯
            </Button>
          )}
          {!editingId && (
            <Button type="button" variant="outline" onClick={onCancel} className="h-12 px-6 rounded-xl" disabled={photoUploading}>
              取消
            </Button>
          )}
        </FormActions>
      </form>
    </FormCard>
  );
}

// 桌面版表格
interface TableProps {
  foods: Food[];
  onEdit: (food: Food) => void;
  onDelete: (id: string) => void;
  onAmountChange: (food: Food, delta: number) => void;
}

function DesktopTable({ foods, onEdit, onDelete, onAmountChange }: TableProps) {
  if (foods.length === 0) {
    return (
      <div className="hidden lg:block">
        <EmptyState emoji="📦" title="暫無食品資料" description="點擊上方表單新增第一個食品" />
      </div>
    );
  }

  return (
    <div className="hidden lg:block overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50/50 dark:bg-gray-700/50">
            <TableHead className="font-semibold">名稱</TableHead>
            <TableHead className="font-semibold">有效期限</TableHead>
            <TableHead className="font-semibold">數量</TableHead>
            <TableHead className="font-semibold">圖片</TableHead>
            <TableHead className="font-semibold">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {foods.map((food) => (
            <FoodTableRow key={food.$id} food={food} onEdit={onEdit} onDelete={onDelete} onAmountChange={onAmountChange} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function FoodTableRow({ food, onEdit, onDelete, onAmountChange }: { food: Food } & Omit<TableProps, "foods">) {
  const { daysRemaining, status, formattedDate, isExpired, isExpiringSoon } = getFoodExpiryInfo(food);
  const rowClass = isExpired ? "bg-red-50 dark:bg-red-900/20" : isExpiringSoon ? "bg-yellow-50 dark:bg-yellow-900/20" : "";

  return (
    <TableRow className={`hover:bg-gray-50/50 dark:hover:bg-gray-700/50 ${rowClass}`}>
      <TableCell className="font-medium">{food.name}</TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <span>{formattedDate}</span>
          {status !== "normal" && (
            <StatusBadge status={status}>{formatDaysRemaining(daysRemaining)}</StatusBadge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <AmountControl food={food} onAmountChange={onAmountChange} />
      </TableCell>
      <TableCell>
        <FoodImage food={food} />
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => onEdit(food)} className="rounded-lg">編輯</Button>
          <Button type="button" size="sm" variant="destructive" onClick={() => onDelete(food.$id)} className="rounded-lg">刪除</Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// 手機版列表
function MobileList({ foods, onEdit, onDelete, onAmountChange }: TableProps) {
  if (foods.length === 0) {
    return (
      <div className="lg:hidden">
        <EmptyState emoji="📦" title="暫無食品資料" description="點擊上方表單新增第一個食品" />
      </div>
    );
  }

  return (
    <div className="lg:hidden px-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {foods.map((food) => (
          <FoodMobileCard key={food.$id} food={food} onEdit={onEdit} onDelete={onDelete} onAmountChange={onAmountChange} />
        ))}
      </div>
    </div>
  );
}

function FoodMobileCard({ food, onEdit, onDelete, onAmountChange }: { food: Food } & Omit<TableProps, "foods">) {
  const { daysRemaining, status, formattedDate, isExpired, isExpiringSoon } = getFoodExpiryInfo(food);
  const highlight = isExpired ? "expired" : isExpiringSoon ? "warning" : "normal";

  return (
    <div className={`p-4 border-b last:border-0 border-gray-100 dark:border-gray-800 ${isExpired ? "bg-red-50/50" : isExpiringSoon ? "bg-amber-50/50" : ""}`}>
      <div className="flex gap-4 items-start">
        <FoodImage food={food} className="w-20 h-20 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start gap-2">
            <h3 className="font-bold text-gray-900 dark:text-gray-100 text-lg leading-snug break-words line-clamp-2">
              {food.name}
            </h3>
          </div>
          <div className="mt-1 space-y-1">
            <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
              <span className="font-medium">期限:</span>
              <span className={isExpired ? "text-red-600 font-bold" : isExpiringSoon ? "text-amber-600 font-bold" : ""}>
                {formattedDate}
              </span>
            </div>
            {status !== "normal" && (
              <StatusBadge status={status}>{formatDaysRemaining(daysRemaining)}</StatusBadge>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <div className="w-full">
          <AmountControl food={food} onAmountChange={onAmountChange} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onEdit(food)}
            className="h-11 rounded-xl text-blue-600 border-blue-200 hover:bg-blue-50 font-bold"
          >
            編輯
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={() => onDelete(food.$id)}
            className="h-11 rounded-xl font-bold"
          >
            刪除
          </Button>
        </div>
      </div>
    </div>
  );
}

// 數量控制元件
function AmountControl({ food, onAmountChange }: { food: Food; onAmountChange: (food: Food, delta: number) => void }) {
  return (
    <div className="flex items-center justify-between w-full bg-gray-50 dark:bg-gray-900 rounded-xl p-1.5 border border-gray-200 dark:border-gray-700">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => onAmountChange(food, -1)}
        disabled={food.amount <= 0}
        className="w-10 h-10 p-0 rounded-lg text-gray-500 hover:text-red-500 hover:bg-white dark:hover:bg-gray-800"
      >
        -
      </Button>
      <div className="flex flex-col items-center">
        <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">數量</span>
        <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{food.amount}</span>
      </div>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => onAmountChange(food, 1)}
        className="w-10 h-10 p-0 rounded-lg text-gray-500 hover:text-green-500 hover:bg-white dark:hover:bg-gray-800"
      >
        +
      </Button>
    </div>
  );
}

// 食品圖片元件
function FoodImage({ food, className }: { food: Food; className?: string }) {
  const baseClass = "object-cover rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-800";
  const sizeClass = className || "w-16 h-16";
  
  if (food.photo) {
    return (
      <img src={food.photo} alt={food.name} className={`${baseClass} ${sizeClass}`} />
    );
  }
  return (
    <div className={`${baseClass} ${sizeClass} flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 gap-1`}>
      <div className="text-[10px] font-medium opacity-50">NO IMAGE</div>
    </div>
  );
}
