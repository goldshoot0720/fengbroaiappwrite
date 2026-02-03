"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Music as MusicIcon, Plus, Edit, Trash2, X, Upload, Calendar, Search, ChevronDown, Repeat, FileText, Download, ListPlus, HardDrive, Check } from "lucide-react";
import { useMusic, MusicData } from "@/hooks/useMusic";
import { useMusicQueue, QueueItem } from "@/hooks/useMusicQueue";
import { useMusicCache } from "@/hooks/useMusicCache";
import { SectionHeader } from "@/components/ui/section-header";
import { DataCard } from "@/components/ui/data-card";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { PlyrPlayer } from "@/components/ui/plyr-player";
import { MusicQueuePanel } from "@/components/ui/music-queue-panel";
import { API_ENDPOINTS } from "@/lib/constants";
import { formatLocalDate } from "@/lib/formatters";
import { getAppwriteHeaders, getProxiedMediaUrl, getAppwriteDownloadUrl } from "@/lib/utils";
import { uploadToAppwriteStorage } from "@/lib/appwriteStorage";

// Helper function to add Appwrite config to URL
function addAppwriteConfigToUrl(url: string): string {
  if (typeof window === 'undefined') return url;
  
  const endpoint = localStorage.getItem('NEXT_PUBLIC_APPWRITE_ENDPOINT');
  const projectId = localStorage.getItem('NEXT_PUBLIC_APPWRITE_PROJECT_ID');
  const databaseId = localStorage.getItem('APPWRITE_DATABASE_ID');
  const apiKey = localStorage.getItem('APPWRITE_API_KEY');
  const bucketId = localStorage.getItem('APPWRITE_BUCKET_ID');
  
  if (!endpoint && !projectId && !databaseId) {
    return url;
  }
  
  const separator = url.includes('?') ? '&' : '?';
  const params = new URLSearchParams();
  
  if (endpoint) params.set('_endpoint', endpoint);
  if (projectId) params.set('_project', projectId);
  if (databaseId) params.set('_database', databaseId);
  if (apiKey) params.set('_key', apiKey);
  if (bucketId) params.set('_bucket', bucketId);
  
  const paramString = params.toString();
  return paramString ? `${url}${separator}${paramString}` : url;
}

export default function MusicManagement() {
  const { music, loading, error, stats, loadMusic } = useMusic();
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingMusic, setEditingMusic] = useState<MusicData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedMusicId, setExpandedMusicId] = useState<string | null>(null);

  // 音樂快取管理
  const {
    cacheStatus,
    cacheStats,
    downloadAndCacheMusic,
    deleteMusicCache,
    clearAllCache,
    updateCacheStats,
    formatFileSize,
    maxCacheSize,
  } = useMusicCache();

  useEffect(() => {
    updateCacheStats();
  }, [updateCacheStats]);

  // CSV 匯入/匯出功能
  const [importPreview, setImportPreview] = useState<{data: MusicFormData[], errors: string[]} | null>(null);
    const [importing, setImporting] = useState(false);
    const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const CSV_HEADERS = ['name', 'category', 'language', 'lyrics', 'note', 'ref'];
  const EXPECTED_COLUMN_COUNT = CSV_HEADERS.length;

  interface MusicFormData {
    name: string;
    category: string;
    language: string;
    lyrics: string;
    note: string;
    ref: string;
  }

  const exportToCSV = () => {
    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`;
      return str;
    };
    const rows = [CSV_HEADERS.join(',')];
    music.forEach(item => {
      rows.push([
        escapeCSV(item.name),
        escapeCSV(item.category || ''),
        escapeCSV(item.language || ''),
        escapeCSV(item.lyrics || ''),
        escapeCSV(item.note || ''),
        escapeCSV(item.ref || '')
      ].join(','));
    });
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'appwrite-Music.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = []; let current = ''; let inQuotes = false;
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

  // RFC 4180 compliant CSV parser that handles multi-line quoted fields (for lyrics)
  const parseCSV = (text: string): {data: MusicFormData[], errors: string[]} => {
    const errors: string[] = []; 
    const data: MusicFormData[] = [];
    const cleanText = text.replace(/^\uFEFF/, '');
    
    // Parse CSV properly handling multi-line quoted fields
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;
    
    for (let i = 0; i < cleanText.length; i++) {
      const char = cleanText[i];
      const nextChar = cleanText[i + 1];
      
      if (inQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            // Escaped quote
            currentField += '"';
            i++;
          } else {
            // End of quoted field
            inQuotes = false;
          }
        } else {
          // Character inside quotes (including newlines)
          currentField += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          currentRow.push(currentField);
          currentField = '';
        } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
          currentRow.push(currentField);
          currentField = '';
          if (currentRow.length > 0 && currentRow.some(f => f.trim())) {
            rows.push(currentRow);
          }
          currentRow = [];
          if (char === '\r') i++; // Skip \n after \r
        } else if (char !== '\r') {
          currentField += char;
        }
      }
    }
    // Push last field and row
    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField);
      if (currentRow.some(f => f.trim())) {
        rows.push(currentRow);
      }
    }
    
    if (rows.length < 2) { 
      errors.push('CSV 檔案至少需要表頭和一行資料'); 
      return { data, errors }; 
    }
    
    const headerValues = rows[0];
    if (headerValues.length !== EXPECTED_COLUMN_COUNT) {
      errors.push(`表頭欄位數量錯誤: 預期 ${EXPECTED_COLUMN_COUNT} 欄，實際 ${headerValues.length} 欄`);
      return { data, errors };
    }
    for (let i = 0; i < CSV_HEADERS.length; i++) {
      if (headerValues[i]?.trim() !== CSV_HEADERS[i]) {
        errors.push(`表頭第 ${i + 1} 欄錯誤: 預期 "${CSV_HEADERS[i]}"，實際 "${headerValues[i]?.trim()}"`);
        if (errors.length >= 5) { errors.push('...更多錯誤已省略'); break; }
      }
    }
    if (errors.length > 0) return { data, errors };
    
    for (let i = 1; i < rows.length; i++) {
      const values = rows[i]; 
      const lineNum = i + 1;
      if (values.length !== EXPECTED_COLUMN_COUNT) { 
        errors.push(`第 ${lineNum} 行: 欄位數量錯誤 (預期 ${EXPECTED_COLUMN_COUNT} 欄，實際 ${values.length} 欄)`); 
        continue; 
      }
      if (!values[0]?.trim()) { 
        errors.push(`第 ${lineNum} 行: name 欄位不能為空`); 
        continue; 
      }
      data.push({ 
        name: values[0].trim(), 
        category: values[1]?.trim() || '', 
        language: values[2]?.trim() || '', 
        lyrics: values[3]?.trim() || '',
        note: values[4]?.trim() || '',
        ref: values[5]?.trim() || ''
      });
    }
    return { data, errors };
  };

  const handleCsvFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; 
    if (!file) return;
    if (!file.name.endsWith('.csv')) { 
      alert('請選擇 CSV 檔案'); 
      return; 
    }
    const reader = new FileReader();
    reader.onload = (event) => { 
      setImportPreview(parseCSV(event.target?.result as string)); 
    };
    reader.readAsText(file, 'UTF-8'); 
    e.target.value = '';
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
        // 查找是否已存在相同 name + language 的記錄
        const existing = music.find(m => m.name === formData.name && m.language === formData.language);
        const apiUrl = existing 
          ? addAppwriteConfigToUrl(`${API_ENDPOINTS.MUSIC}/${existing.$id}`)
          : addAppwriteConfigToUrl(API_ENDPOINTS.MUSIC);
        const method = existing ? 'PUT' : 'POST';
        
        // 準備資料，不包含 file, cover, hash（因為 Appwrite Storage 綁定帳號）
        const submitData = {
          name: formData.name,
          category: formData.category,
          language: formData.language,
          lyrics: formData.lyrics,
          note: formData.note,
          ref: formData.ref,
          // 如果是更新，保留原有的 file, cover, hash
          ...(existing && {
            file: existing.file,
            cover: existing.cover,
            hash: existing.hash
          }),
          // 如果是新增，設定空值
          ...(!existing && {
            file: '',
            cover: '',
            hash: `csv_import_${Date.now()}_${Math.random().toString(36).substring(7)}`
          })
        };
        
        const response = await fetch(apiUrl, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...getAppwriteHeaders(),
          },
          body: JSON.stringify(submitData),
        });
        
        if (response.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch { 
        failCount++; 
      }
    }
    
    // 匯入完成後統一重新載入一次
    await loadMusic();
    
    setImporting(false);
    setImportProgress({ current: 0, total: 0 });
    setImportPreview(null);
    alert(`匯入完成！
成功: ${successCount} 筆
失敗: ${failCount} 筆

注意：音樂檔案和封面圖需要另行上傳（因為 Appwrite Storage 綁定帳號）`);
  };

  // 搜尋過濾 + Lyrics Fallback
  const filteredMusic = useMemo(() => {
    // 首先添加 computedLyrics 到所有音樂
    const musicWithComputedLyrics = music.map(item => {
      // 如果已經有歌詞，直接使用
      if (item.lyrics) {
        return { ...item, computedLyrics: item.lyrics };
      }
      
      // 如果沒有歌詞，找基礎語言版本（去除括號）
      const baseLanguage = item.language?.replace(/[\(\uff08].*?[\)\uff09]/g, '').trim();
      const baseVersion = music.find(m => 
        m.name === item.name && 
        m.language === baseLanguage
      );
      
      return { 
        ...item, 
        computedLyrics: baseVersion?.lyrics || '' 
      };
    });
    
    // 然後進行搜尋過濾
    if (!searchQuery.trim()) return musicWithComputedLyrics;
    const query = searchQuery.toLowerCase();
    return musicWithComputedLyrics.filter(item => 
      item.name?.toLowerCase().includes(query) ||
      item.lyrics?.toLowerCase().includes(query) ||
      item.computedLyrics?.toLowerCase().includes(query)
    );
  }, [music, searchQuery]);

  // 按名稱分組音樂
  const groupedMusic = useMemo(() => {
    const groups: { [key: string]: MusicData[] } = {};
    filteredMusic.forEach(item => {
      const name = item.name || '未命名';
      if (!groups[name]) {
        groups[name] = [];
      }
      groups[name].push(item);
    });
    // 轉換為陣列並按名稱排序
    return Object.entries(groups)
      .map(([name, items]) => ({ name, items }))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-TW'));
  }, [filteredMusic]);

  const handleAdd = () => {
    setEditingMusic(null);
    setShowFormModal(true);
  };

  const handleEdit = (musicItem: MusicData) => {
    setEditingMusic(musicItem);
    setShowFormModal(true);
  };

  const handleDelete = async (musicItem: MusicData) => {
    const confirmText = `DELETE ${musicItem.name}`;
    const userInput = prompt(`確定要刪除音樂「${musicItem.name}」嗎？\n\n請輸入以下文字以確認刪除：\n${confirmText}`);
    
    if (userInput !== confirmText) {
      if (userInput !== null) {
        alert('輸入不正確，刪除已取消');
      }
      return;
    }

    try {
      const url = addAppwriteConfigToUrl(`${API_ENDPOINTS.MUSIC}/${musicItem.$id}`);
      const response = await fetch(url, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('刪除失敗');
      loadMusic(true);
    } catch (error) {
      alert(error instanceof Error ? error.message : '刪除失敗');
    }
  };

  const handleFormSuccess = () => {
    setShowFormModal(false);
    setEditingMusic(null);
    loadMusic(true);
  };

  if (loading) {
    return (
      <div className="space-y-4 lg:space-y-6">
        <SectionHeader title="鋒兄音樂" subtitle="音樂管理" showAccountLabel={true} />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <SectionHeader
        title="鋒兄音樂"
        subtitle="管理音樂收藏，支援歌詞和多語言"
        showAccountLabel={true}
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={() => document.getElementById('csv-import-music')?.click()} variant="outline" className="rounded-xl flex items-center gap-2" title="匯入 CSV">
              <Upload size={18} /> 匯入
            </Button>
            <input id="csv-import-music" type="file" accept=".csv" className="hidden" onChange={handleCsvFileSelect} />
            <Button onClick={exportToCSV} variant="outline" className="rounded-xl flex items-center gap-2" title="匯出 CSV">
              <Download size={18} /> 匯出
            </Button>
            <Button onClick={handleAdd} className="gap-2 bg-blue-500 hover:bg-blue-600 rounded-xl">
              <Plus size={16} />
              新增音樂
            </Button>
          </div>
        }
      />

      {/* 統計卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="音樂總數" value={stats.total} icon={MusicIcon} />
        <StatCard title="已快取" value={cacheStats.cachedMusic} icon={Check} />
        <StatCard title="快取大小" value={formatFileSize(cacheStats.totalSize)} icon={HardDrive} />
      </div>

      {/* 搜尋欄位 */}
      {music.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            placeholder="搜尋音樂名稱、歌詞..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 rounded-xl"
          />
        </div>
      )}

      {/* 音樂列表 */}
      {music.length === 0 ? (
        <EmptyState
          icon={<MusicIcon className="w-12 h-12" />}
          title="尚無音樂"
          description="點擊上方「新增音樂」按鈕新增第一首音樂"
        />
      ) : filteredMusic.length === 0 ? (
        <EmptyState
          icon={<Search className="w-12 h-12" />}
          title="無搜尋結果"
          description={`找不到「${searchQuery}」相關的音樂`}
        />
      ) : (
        <div className="space-y-3">
          {groupedMusic.map((group) => (
            <GroupedMusicCard
              key={group.name}
              name={group.name}
              items={group.items}
              expandedMusicId={expandedMusicId}
              onToggleExpand={(id) => setExpandedMusicId(expandedMusicId === id ? null : id)}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* 表單模態框 */}
      {showFormModal && (
        <MusicFormModal
          music={editingMusic}
          existingMusic={music}
          onClose={() => {
            setShowFormModal(false);
            setEditingMusic(null);
          }}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* CSV 匯入預覽模態框 */}
      {importPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">匯入預覽</h3>
              <button onClick={() => setImportPreview(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1">
              {importPreview.errors.length > 0 ? (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <h4 className="font-semibold text-red-700 dark:text-red-400 mb-2">錯誤</h4>
                  <ul className="list-disc list-inside text-sm text-red-600 dark:text-red-300 space-y-1">
                    {importPreview.errors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              ) : (
                <>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
                    <p className="text-sm text-yellow-700 dark:text-yellow-400">
                      ⚠️ <strong>注意：</strong>匯入不包含音樂檔案和封面圖（因為 Appwrite Storage 綁定帳號），這些需要另行上傳。
                    </p>
                  </div>
                  <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">將匯入 {importPreview.data.length} 筆資料:</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100 dark:bg-gray-700">
                          <th className="px-3 py-2 text-left">名稱</th>
                          <th className="px-3 py-2 text-left">分類</th>
                          <th className="px-3 py-2 text-left">語言</th>
                          <th className="px-3 py-2 text-left">歌詞</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.data.slice(0, 10).map((item, i) => (
                          <tr key={i} className="border-b border-gray-200 dark:border-gray-700">
                            <td className="px-3 py-2 font-medium">{item.name}</td>
                            <td className="px-3 py-2">{item.category || '-'}</td>
                            <td className="px-3 py-2">{item.language || '-'}</td>
                            <td className="px-3 py-2 max-w-[200px] truncate">{item.lyrics ? '有' : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {importPreview.data.length > 10 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">...還有 {importPreview.data.length - 10} 筆</p>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
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
                  <Button variant="outline" onClick={() => setImportPreview(null)}>取消</Button>
                  <Button 
                    onClick={executeImport} 
                    disabled={importPreview.errors.length > 0 || importPreview.data.length === 0}
                    className="bg-blue-500 hover:bg-blue-600"
                  >
                    確認匯入 ({importPreview.data.length} 筆)
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 快取管理 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">快取管理</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              已使用 {formatFileSize(cacheStats.totalSize)} / {formatFileSize(maxCacheSize)}
            </p>
          </div>
          <Button 
            onClick={clearAllCache} 
            variant="outline" 
            className="rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            disabled={cacheStats.cachedMusic === 0}
          >
            清空快取
          </Button>
        </div>
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-cyan-500 to-cyan-600 transition-all duration-300" 
            style={{ width: `${Math.min((cacheStats.totalSize / maxCacheSize) * 100, 100)}%` }}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">已快取音樂：</span>
            <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">{cacheStats.cachedMusic} / {music.length}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">下載中：</span>
            <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">{cacheStats.downloadingMusic}</span>
          </div>
        </div>
      </div>

      {/* 音樂佇列面板 */}
      <MusicQueuePanel />
    </div>
  );
}

// 分組音樂卡片
interface GroupedMusicCardProps {
  name: string;
  items: MusicData[];
  expandedMusicId: string | null;
  onToggleExpand: (id: string) => void;
  onEdit: (music: MusicData) => void;
  onDelete: (music: MusicData) => void;
}

function GroupedMusicCard({ name, items, expandedMusicId, onToggleExpand, onEdit, onDelete }: GroupedMusicCardProps) {
  const [isLooping, setIsLooping] = useState(false);
  const [expandedLyricsId, setExpandedLyricsId] = useState<string | null>(null);
  const [selectedBaseLanguage, setSelectedBaseLanguage] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const { addToQueue, isInQueue } = useMusicQueue();
  const { cacheStatus, downloadAndCacheMusic, checkMusicCache, loadMusicFromCache } = useMusicCache();
  const [cachedItems, setCachedItems] = useState<Set<string>>(new Set());

  // 檢查所有項目的快取狀態
  useEffect(() => {
    const checkAllCache = async () => {
      const cached = new Set<string>();
      for (const item of items) {
        const isCached = await checkMusicCache(item.$id);
        if (isCached) {
          cached.add(item.$id);
        }
      }
      setCachedItems(cached);
    };
    checkAllCache();
  }, [items, checkMusicCache]);
  
  // 第一層：基礎語言類別
  const BASE_LANGUAGES = ['中文', '英語', '日語', '韓語', '粵語', '其他'];
  
  // 提取基礎語言（例如：從 "中文(女聲)" 提取 "中文"）
  const getBaseLanguage = (language: string | undefined) => {
    if (!language) return '其他';
    const base = language.replace(/\(.*?\)/g, '').trim();
    // 檢查是否屬於已知的基礎語言
    const knownBases = ['中文', '英文', '英語', '日文', '日語', '韓文', '韓語', '粵語', '粵文'];
    if (knownBases.some(kb => base.includes(kb.charAt(0)))) {
      if (base.includes('中')) return '中文';
      if (base.includes('英')) return '英語';
      if (base.includes('日')) return '日語';
      if (base.includes('韓')) return '韓語';
      if (base.includes('粵')) return '粵語';
    }
    return '其他';
  };
  
  // 按基礎語言分組
  const groupedByBaseLanguage = useMemo(() => {
    const groups: { [key: string]: MusicData[] } = {};
    BASE_LANGUAGES.forEach(lang => {
      groups[lang] = [];
    });
    
    items.forEach(item => {
      const baseLang = getBaseLanguage(item.language);
      if (groups[baseLang]) {
        groups[baseLang].push(item);
      } else {
        groups['其他'].push(item);
      }
    });
    
    return groups;
  }, [items]);
  
  // 獲取封面（根據語言優先順序：中文 > 英語 > 日語 > 韓語 > 粵語 > 其他）
  const getDefaultCover = () => {
    for (const lang of BASE_LANGUAGES) {
      const versionWithCover = items.find(item => getBaseLanguage(item.language) === lang && item.cover);
      if (versionWithCover?.cover) return versionWithCover.cover;
    }
    return null;
  };
  
  // 當前選中的版本
  const selectedItem = selectedVersionId ? items.find(item => item.$id === selectedVersionId) : null;
  
  // 當選中特定版本時，顯示該版本的封面；否則顯示預設封面
  const displayCover = selectedItem?.cover || getDefaultCover();
  
  const category = items[0]?.category;
  const createdAt = items[0]?.$createdAt;
  
  // 單個項目直接顯示原本的卡片樣式
  if (items.length === 1) {
    const music = items[0];
    return (
      <MusicCard
        music={music}
        isExpanded={expandedMusicId === music.$id}
        onToggleExpand={() => onToggleExpand(music.$id)}
        onEdit={() => onEdit(music)}
        onDelete={() => onDelete(music)}
      />
    );
  }
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 border border-gray-200 dark:border-gray-700">
      {/* 標題區 */}
      <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-start gap-3 sm:gap-4">
          {/* 封面 */}
          <div className="relative w-14 h-14 sm:w-20 sm:h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500">
            {displayCover ? (
              <img src={displayCover} alt={name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <MusicIcon className="text-white w-7 h-7 sm:w-10 sm:h-10 drop-shadow-lg" />
              </div>
            )}
          </div>

          {/* 資訊區 */}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm sm:text-base text-gray-900 dark:text-gray-100">{name}</h3>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {category && (
                <span className="px-1.5 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full">
                  {category}
                </span>
              )}
              <span className="px-1.5 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                共 {items.length} 個版本
              </span>
              <span className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500">
                {formatLocalDate(createdAt)}
              </span>
            </div>
          </div>

          {/* 循環播放按鈕 */}
          <button
            onClick={() => setIsLooping(!isLooping)}
            className={`p-1.5 sm:p-2 rounded-lg transition-all duration-200 flex-shrink-0 ${
              isLooping 
                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
            title={isLooping ? '重複播放' : '單次播放'}
          >
            <Repeat className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </div>

      {/* 版本選擇區 */}
      <div className="p-3 sm:p-4">
        {/* 第一層：基礎語言選擇 */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">版本:</span>
          </div>
          <div className="grid grid-cols-6 gap-1 sm:gap-2">
            {BASE_LANGUAGES.map((lang) => {
              const versionsInLang = groupedByBaseLanguage[lang] || [];
              const hasVersions = versionsInLang.length > 0;
              const isSelected = selectedBaseLanguage === lang;
              
              return (
                <button
                  key={lang}
                  onClick={() => {
                    if (hasVersions) {
                      if (isSelected) {
                        // 點擊已選中的語言，取消選擇
                        setSelectedBaseLanguage(null);
                        setSelectedVersionId(null);
                      } else {
                        setSelectedBaseLanguage(lang);
                        // 如果該語言只有一個版本，自動選擇
                        if (versionsInLang.length === 1) {
                          setSelectedVersionId(versionsInLang[0].$id);
                        } else {
                          setSelectedVersionId(null);
                        }
                      }
                    }
                  }}
                  disabled={!hasVersions}
                  className={`px-1 sm:px-2 py-1.5 sm:py-2 text-[10px] sm:text-xs font-medium rounded-lg transition-all text-center ${
                    isSelected
                      ? 'bg-purple-600 text-white'
                      : hasVersions
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-300 dark:text-gray-600 cursor-not-allowed'
                  }`}
                >
                  <div>{lang}</div>
                  {hasVersions && (
                    <div className={`text-[8px] sm:text-[10px] mt-0.5 ${
                      isSelected ? 'text-purple-200' : 'text-gray-400 dark:text-gray-500'
                    }`}>
                      {versionsInLang.length}個
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 第二層：子版本選擇（只有多個版本時才顯示） */}
        {selectedBaseLanguage && groupedByBaseLanguage[selectedBaseLanguage]?.length > 1 && (
          <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-purple-600 dark:text-purple-400">{selectedBaseLanguage} 版本:</span>
            </div>
            <div className="flex flex-wrap gap-1 sm:gap-2">
              {groupedByBaseLanguage[selectedBaseLanguage].map((item) => {
                const isVersionSelected = selectedVersionId === item.$id;
                
                return (
                  <button
                    key={item.$id}
                    onClick={() => setSelectedVersionId(isVersionSelected ? null : item.$id)}
                    className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium rounded-lg transition-all ${
                      isVersionSelected
                        ? 'bg-purple-600 text-white'
                        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 border border-gray-200 dark:border-gray-600'
                    }`}
                  >
                    {item.language || '未指定'}
                    {item.file && <span className="ml-1 opacity-70">♫</span>}
                    {item.lyrics && <span className="ml-0.5 opacity-70">♬</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 選中版本的播放器和操作 */}
        {selectedItem && (
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 sm:p-4 border border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                {selectedItem.language || '未指定'}
              </span>
              <div className="flex items-center gap-1">
                {selectedItem.computedLyrics && (
                  <button
                    onClick={() => setExpandedLyricsId(expandedLyricsId === selectedItem.$id ? null : selectedItem.$id)}
                    className={`p-1.5 rounded-lg transition-all ${
                      expandedLyricsId === selectedItem.$id
                        ? 'bg-purple-600 text-white'
                        : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-200'
                    }`}
                    title="歌詞"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                )}
                {selectedItem.file && (
                  <button
                    onClick={() => {
                      const downloadUrl = getAppwriteDownloadUrl(selectedItem.file);
                      const link = document.createElement('a');
                      link.href = downloadUrl;
                      link.download = `${selectedItem.name}-${selectedItem.language}.mp3`;
                      link.target = '_blank';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="p-1.5 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 transition-all"
                    title="下載"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                )}
                {selectedItem.file && (
                  <button
                    onClick={async () => {
                      await downloadAndCacheMusic({
                        $id: selectedItem.$id,
                        name: selectedItem.name,
                        file: getProxiedMediaUrl(selectedItem.file),
                        cover: selectedItem.cover || displayCover || undefined,
                        category: selectedItem.category,
                        language: selectedItem.language
                      });
                      setCachedItems(prev => new Set([...prev, selectedItem.$id]));
                    }}
                    disabled={cachedItems.has(selectedItem.$id) || cacheStatus[selectedItem.$id]?.downloading}
                    className={`p-1.5 rounded-lg transition-all relative ${
                      cachedItems.has(selectedItem.$id) || cacheStatus[selectedItem.$id]?.cached
                        ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 cursor-default'
                        : cacheStatus[selectedItem.$id]?.downloading
                        ? 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-500 cursor-wait'
                        : 'bg-gray-100 dark:bg-gray-700 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20'
                    }`}
                    title={
                      cachedItems.has(selectedItem.$id) || cacheStatus[selectedItem.$id]?.cached
                        ? '已快取'
                        : cacheStatus[selectedItem.$id]?.downloading
                        ? `下載中 ${Math.round(cacheStatus[selectedItem.$id].progress)}%`
                        : '快取到本地'
                    }
                  >
                    {cachedItems.has(selectedItem.$id) || cacheStatus[selectedItem.$id]?.cached ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <HardDrive className="w-4 h-4" />
                    )}
                    {cacheStatus[selectedItem.$id]?.downloading && (
                      <span className="absolute -bottom-1 -right-1 text-[8px] bg-cyan-600 text-white rounded-full px-1">
                        {Math.round(cacheStatus[selectedItem.$id].progress)}%
                      </span>
                    )}
                  </button>
                )}
                {selectedItem.file && (
                  <button
                    onClick={async () => {
                      // Check if music is cached first
                      const cachedUrl = await loadMusicFromCache(selectedItem.$id);
                      const fileUrl = cachedUrl || getProxiedMediaUrl(selectedItem.file);
                                        
                      const added = addToQueue({
                        id: selectedItem.$id,
                        name: selectedItem.name,
                        language: selectedItem.language,
                        file: fileUrl,
                        cover: selectedItem.cover || displayCover || undefined,
                      });
                      if (!added) {
                        alert('該歌曲已在播放佇列中');
                      } else if (cachedUrl) {
                        console.log('已加入佇列（使用快取）:', selectedItem.name);
                      }
                    }}
                    disabled={isInQueue(selectedItem.$id)}
                    className={`p-1.5 rounded-lg transition-all ${
                      isInQueue(selectedItem.$id)
                        ? 'bg-gray-200 dark:bg-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                        : 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 hover:bg-orange-200'
                    }`}
                    title={isInQueue(selectedItem.$id) ? '已在佇列中' : '接下來播放'}
                  >
                    <ListPlus className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => onEdit(selectedItem)}
                  className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 transition-all"
                  title="編輯"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(selectedItem)}
                  className="p-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 transition-all"
                  title="刪除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {selectedItem.file ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-2">
                <PlyrPlayer 
                  type="audio"
                  src={getProxiedMediaUrl(selectedItem.file)}
                  loop={isLooping}
                  className="w-full"
                />
              </div>
            ) : (
              <div className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">
                尚未上傳音樂檔案
              </div>
            )}
          </div>
        )}

        {/* 未選擇版本時的提示 */}
        {!selectedVersionId && !selectedBaseLanguage && (
          <div className="text-xs text-gray-400 dark:text-gray-500 text-center py-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
            請選擇語言版本
          </div>
        )}
        
        {selectedBaseLanguage && !selectedVersionId && groupedByBaseLanguage[selectedBaseLanguage]?.length > 1 && (
          <div className="text-xs text-gray-400 dark:text-gray-500 text-center py-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
            請選擇具體版本
          </div>
        )}
      </div>

      {/* 展開的歌詞 */}
      {expandedLyricsId && (() => {
        const lyricsItem = items.find(item => item.$id === expandedLyricsId);
        if (!lyricsItem?.computedLyrics) return null;
        
        return (
          <div className="px-3 sm:px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
            <div className="pt-4">
              <div className="flex justify-center mb-4">
                <div className="relative w-full max-w-sm aspect-square rounded-xl overflow-hidden bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 shadow-xl">
                  {lyricsItem.cover || displayCover ? (
                    <img src={lyricsItem.cover || displayCover!} alt={lyricsItem.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <MusicIcon className="text-white w-32 h-32 drop-shadow-2xl" />
                    </div>
                  )}
                </div>
              </div>
              <div className="text-center mb-4">
                <h3 className="font-bold text-xl text-gray-900 dark:text-gray-100">{lyricsItem.name}</h3>
                {lyricsItem.language && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">{lyricsItem.language}</span>
                )}
              </div>
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4">
                <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">
                  {lyricsItem.computedLyrics}
                </pre>
              </div>
              <div className="flex justify-center mt-4">
                <button
                  onClick={() => setExpandedLyricsId(null)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors duration-200 flex items-center gap-2"
                >
                  <ChevronDown className="w-4 h-4 rotate-180" />
                  收起
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// 音樂卡片
interface MusicCardProps {
  music: MusicData;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function MusicCard({ music, isExpanded, onToggleExpand, onEdit, onDelete }: MusicCardProps) {
  const [isLooping, setIsLooping] = useState(false);
  const { addToQueue, isInQueue } = useMusicQueue();
  const { cacheStatus, downloadAndCacheMusic, checkMusicCache, loadMusicFromCache } = useMusicCache();
  const [isCached, setIsCached] = useState(false);

  // 檢查快取狀態
  useEffect(() => {
    const checkCache = async () => {
      const cached = await checkMusicCache(music.$id);
      setIsCached(cached);
    };
    checkCache();
  }, [music.$id, checkMusicCache]);

  // 處理快取下載
  const handleCacheDownload = async () => {
    await downloadAndCacheMusic({
      $id: music.$id,
      name: music.name,
      file: getProxiedMediaUrl(music.file),
      cover: music.cover,
      category: music.category,
      language: music.language
    });
    setIsCached(true);
  };

  const musicCacheStatus = cacheStatus[music.$id];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 group border border-gray-200 dark:border-gray-700">
      {/* 主要內容區 - 手機垂直排列，桌面水平排列 */}
      <div className="p-3 sm:p-4">
        {/* 頂部：封面 + 資訊 + 操作按鈕 */}
        <div className="flex items-start gap-3 sm:gap-4">
          {/* 封面 - 手機較小 */}
          <div className="relative w-14 h-14 sm:w-20 sm:h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500">
            {music.cover ? (
              <img src={music.cover} alt={music.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <MusicIcon className="text-white w-7 h-7 sm:w-10 sm:h-10 drop-shadow-lg" />
              </div>
            )}
          </div>

          {/* 資訊區 */}
          <div className="flex-1 min-w-0">
            {/* 標題行：名稱 + 歌詞按鈕 */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <h3 className="font-bold text-sm sm:text-base text-gray-900 dark:text-gray-100 truncate max-w-[120px] sm:max-w-none">{music.name}</h3>
              {/* 歌詞按鈕 */}
              {music.computedLyrics && (
                <button
                  onClick={onToggleExpand}
                  className={`px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium rounded transition-all duration-200 flex items-center gap-0.5 sm:gap-1 flex-shrink-0 ${
                    isExpanded 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50'
                  }`}
                  title="顯示歌詞"
                >
                  <FileText className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  <span>歌詞</span>
                </button>
              )}
            </div>
            
            {/* 標籤 - 手機顯示在標題下方 */}
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {music.category && (
                <span className="px-1.5 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full">
                  {music.category}
                </span>
              )}
              {music.language && (
                <span className="px-1.5 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
                  {music.language}
                </span>
              )}
              <span className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500">
                {formatLocalDate(music.$createdAt)}
              </span>
            </div>
          </div>

          {/* 操作按鈕 - 手機更緊湊 */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {music.file && (
              <>
                <button
                  onClick={() => setIsLooping(!isLooping)}
                  className={`p-1.5 sm:p-2 rounded-lg transition-all duration-200 ${
                    isLooping 
                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                  title={isLooping ? '重複播放' : '單次播放'}
                >
                  <Repeat className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                <button
                  onClick={async () => {
                    // Check if music is cached first
                    const cachedUrl = await loadMusicFromCache(music.$id);
                    const fileUrl = cachedUrl || getProxiedMediaUrl(music.file);
                    
                    const added = addToQueue({
                      id: music.$id,
                      name: music.name,
                      language: music.language,
                      file: fileUrl,
                      cover: music.cover,
                    });
                    if (!added) {
                      alert('該歌曲已在播放佇列中');
                    } else if (cachedUrl) {
                      console.log('已加入佇列（使用快取）:', music.name);
                    }
                  }}
                  disabled={isInQueue(music.$id)}
                  className={`p-1.5 sm:p-2 rounded-lg transition-all duration-200 ${
                    isInQueue(music.$id)
                      ? 'bg-gray-200 dark:bg-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                      : 'bg-gray-100 dark:bg-gray-700 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20'
                  }`}
                  title={isInQueue(music.$id) ? '已在佇列中' : '接下來播放'}
                >
                  <ListPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                <button
                  onClick={() => {
                    const downloadUrl = getAppwriteDownloadUrl(music.file);
                    const link = document.createElement('a');
                    link.href = downloadUrl;
                    link.download = `${music.name}${music.language ? `-${music.language}` : ''}.mp3`;
                    link.target = '_blank';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="p-1.5 sm:p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all duration-200"
                  title="下載"
                >
                  <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                {/* 快取按鈕 */}
                <button
                  onClick={handleCacheDownload}
                  disabled={isCached || musicCacheStatus?.downloading}
                  className={`p-1.5 sm:p-2 rounded-lg transition-all duration-200 relative ${
                    isCached || musicCacheStatus?.cached
                      ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 cursor-default'
                      : musicCacheStatus?.downloading
                      ? 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-500 cursor-wait'
                      : 'bg-gray-100 dark:bg-gray-700 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20'
                  }`}
                  title={
                    isCached || musicCacheStatus?.cached
                      ? '已快取'
                      : musicCacheStatus?.downloading
                      ? `下載中 ${Math.round(musicCacheStatus.progress)}%`
                      : '快取到本地'
                  }
                >
                  {isCached || musicCacheStatus?.cached ? (
                    <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  ) : (
                    <HardDrive className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  )}
                  {musicCacheStatus?.downloading && (
                    <span className="absolute -bottom-1 -right-1 text-[8px] bg-cyan-600 text-white rounded-full px-1">
                      {Math.round(musicCacheStatus.progress)}%
                    </span>
                  )}
                </button>
              </>
            )}
            <button
              onClick={onEdit}
              className="p-1.5 sm:p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200"
              title="編輯"
            >
              <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 sm:p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
              title="刪除"
            >
              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>

        {/* 播放器 - 獨立一行 */}
        {music.file ? (
          <div className="mt-2 sm:mt-3">
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-1.5 sm:p-2">
              <PlyrPlayer 
                type="audio"
                src={getProxiedMediaUrl(music.file)}
                loop={isLooping}
                className="w-full"
              />
            </div>
          </div>
        ) : (
          <div className="mt-2 text-[10px] sm:text-xs text-gray-400 dark:text-gray-500">
            尚未上傳音樂檔案
          </div>
        )}
      </div>

      {/* 展開的詳細資訊 */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
          {/* 大封面 */}
          <div className="flex justify-center">
            <div className="relative w-full max-w-sm aspect-square rounded-xl overflow-hidden bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 shadow-xl">
              {music.cover ? (
                <img src={music.cover} alt={music.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <MusicIcon className="text-white w-32 h-32 drop-shadow-2xl" />
                </div>
              )}
            </div>
          </div>

          {/* 標題和標籤 */}
          <div className="text-center space-y-2">
            <h3 className="font-bold text-xl text-gray-900 dark:text-gray-100">{music.name}</h3>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {music.category && (
                <span className="px-3 py-1 text-xs font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full">
                  {music.category}
                </span>
              )}
              {music.language && (
                <span className="px-3 py-1 text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
                  {music.language}
                </span>
              )}
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <Calendar className="w-3 h-3" />
                {formatLocalDate(music.$createdAt)}
              </div>
            </div>
          </div>

          {/* 歌詞 */}
          <div className="space-y-3">
            <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <MusicIcon className="w-4 h-4" />
              歌詞
            </h4>
            {music.computedLyrics ? (
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 max-h-96 overflow-y-auto">
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {music.computedLyrics}
                </p>
              </div>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-8 text-center">
                <p className="text-sm text-gray-400 dark:text-gray-500">沒有歌詞</p>
              </div>
            )}
          </div>

          {/* 備註 */}
          {music.note && (
            <div>
              <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2">備註</h4>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                <p className="text-sm text-gray-700 dark:text-gray-300">{music.note}</p>
              </div>
            </div>
          )}

          {/* 關閉按鈕 */}
          <div className="flex justify-center">
            <button
              onClick={onToggleExpand}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors duration-200 flex items-center gap-2"
            >
              <ChevronDown className="w-4 h-4 rotate-180" />
              收起
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// 音樂表單模態框
function MusicFormModal({ music, existingMusic, onClose, onSuccess }: { music: MusicData | null; existingMusic: MusicData[]; onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: music?.name || '',
    file: music?.file || '',
    lyrics: music?.lyrics || '',
    note: music?.note || '',
    ref: music?.ref || '',
    category: music?.category || '',
    hash: music?.hash || '',
    language: music?.language || '中文',
    cover: music?.cover || '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [fileHash, setFileHash] = useState<string>(''); // 儲存檔案 hash
  const [duplicateWarning, setDuplicateWarning] = useState<string>(''); // 重複警告
  const [selectedCoverFile, setSelectedCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string>('');
  const [coverPreviewLoading, setCoverPreviewLoading] = useState(false);
  const [coverUploadProgress, setCoverUploadProgress] = useState(0);
  const [coverUploadStatus, setCoverUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [coverFileHash, setCoverFileHash] = useState<string>(''); // 封面圖 hash
  const [coverDuplicateInfo, setCoverDuplicateInfo] = useState<{ found: boolean; existingUrl: string; musicName: string } | null>(null); // 重複封面資訊
  const [useCategorySelect, setUseCategorySelect] = useState(true); // 是否使用選擇框
  const [useNameSelect, setUseNameSelect] = useState(!music); // 新增時預設顯示選擇框，編輯時顯示輸入框
  const [useLanguageSelect, setUseLanguageSelect] = useState(true); // 語言選擇框

  // 預設語言選項
  const defaultLanguages = ['中文', '英語', '日語', '粵語', '韓語'];
  
  // 獲取所有已存在的語言（包括自訂的）
  const existingLanguages = Array.from(new Set([
    ...defaultLanguages,
    ...existingMusic.map(m => m.language).filter(Boolean)
  ]));

  // 獲取所有已存在的分類
  const existingCategories = Array.from(new Set(existingMusic.map(m => m.category).filter(Boolean)));
  
  // 獲取所有已存在的音樂名稱
  const existingNames = Array.from(new Set(existingMusic.map(m => m.name).filter(Boolean)));

  // 計算檔案 SHA-256 hash
  const calculateFileHash = async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    } catch (error) {
      console.error('Hash calculation error:', error);
      // 如果計算失敗，使用備用方案
      return `fallback_${file.name}_${file.size}_${file.lastModified}`;
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 檢查檔案大小 (50MB = 50 * 1024 * 1024 bytes)
    // Note: Direct upload to Appwrite Storage, no Next.js 4MB limit!
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('音樂檔案大小不能超過 50MB');
      return;
    }

    // 檢查檔案類型
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/flac', 'audio/m4a'];
    if (!validTypes.includes(file.type)) {
      alert('只支援 MP3, WAV, OGG, AAC, FLAC, M4A 格式的音樂');
      return;
    }

    // 顯示預覽載入狀態
    setPreviewLoading(true);
    setUploadStatus('idle');
    setUploadProgress(0);
    setDuplicateWarning(''); // 清除之前的警告
    
    // 儲存檔案並產生預覽 URL
    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    
    // 計算檔案 hash
    const hash = await calculateFileHash(file);
    setFileHash(hash);
    setFormData({ ...formData, hash });
    
    // 檢查是否有重複的 hash
    const duplicateMusic = existingMusic.find(m => 
      m.hash === hash && (!music || m.$id !== music.$id)
    );
    
    if (duplicateMusic) {
      setDuplicateWarning(`警告：此音樂與「${duplicateMusic.name}」相同，請勿重複上傳！`);
    }
    
    // 模擬預覽載入完成
    setTimeout(() => setPreviewLoading(false), 300);
  };

  const uploadFileToAppwrite = async (file: File): Promise<{ url: string; fileId: string }> => {
    setUploadStatus('uploading');
    setUploadProgress(0);

    try {
      // Direct upload to Appwrite Storage (bypasses Next.js API route)
      const result = await uploadToAppwriteStorage(file, (progress) => {
        setUploadProgress(progress);
      });

      setUploadStatus('success');
      return result;
    } catch (error) {
      setUploadStatus('error');
      throw error;
    }
  };

  const handleCoverFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 檢查檔案大小 (50MB for cover images via direct Appwrite Storage upload)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('封面圖大小不能超過 50MB');
      return;
    }

    // 檢查檔案類型
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('只支援 JPG, PNG, GIF, WEBP 格式的圖片');
      return;
    }

    // 顯示預覽載入狀態
    setCoverPreviewLoading(true);
    setCoverUploadStatus('idle');
    setCoverUploadProgress(0);
    setCoverDuplicateInfo(null);
    
    // 儲存檔案並產生預覽 URL
    setSelectedCoverFile(file);
    const objectUrl = URL.createObjectURL(file);
    setCoverPreviewUrl(objectUrl);
    
    // 計算封面圖 hash
    const hash = await calculateFileHash(file);
    setCoverFileHash(hash);
    
    // 檢查是否有重複的封面圖（從 localStorage 取得已上傳封面圖的 hash map）
    const coverHashMap = JSON.parse(localStorage.getItem('coverHashMap') || '{}');
    if (coverHashMap[hash]) {
      // 找到重複的封面圖，先檢查是否可訪問
      const existingUrl = coverHashMap[hash].url;
      const musicName = coverHashMap[hash].musicName || '其他音樂';
      
      try {
        // 使用代理 URL 來檢查圖片是否可訪問
        const proxiedUrl = getProxiedMediaUrl(existingUrl);
        const response = await fetch(proxiedUrl, { method: 'HEAD' });
        if (response.ok) {
          // 圖片可訪問，顯示重複警告
          setCoverDuplicateInfo({ found: true, existingUrl, musicName });
        } else {
          // 圖片不可訪問，允許重新上傳
          setCoverDuplicateInfo(null);
        }
      } catch {
        // 無法檢查，假設圖片不存在，允許重新上傳
        setCoverDuplicateInfo(null);
      }
    } else {
      // 也檢查現有音樂的封面是否相同（基於檔案名稱和大小的簡單比較）
      const existingWithSameCover = existingMusic.find(m => {
        if (!m.cover) return false;
        // 簡單比較：如果 URL 包含相同的檔案名
        const fileName = file.name.replace(/[^a-zA-Z0-9]/g, '');
        return m.cover.includes(fileName);
      });
      
      if (existingWithSameCover) {
        // 檢查現有封面是否可訪問
        try {
          // 使用代理 URL 來檢查圖片是否可訪問
          const proxiedUrl = getProxiedMediaUrl(existingWithSameCover.cover);
          const response = await fetch(proxiedUrl, { method: 'HEAD' });
          if (response.ok) {
            // 圖片可訪問，顯示重複警告
            setCoverDuplicateInfo({ 
              found: true, 
              existingUrl: existingWithSameCover.cover, 
              musicName: existingWithSameCover.name 
            });
          } else {
            // 圖片不可訪問，允許重新上傳
            setCoverDuplicateInfo(null);
          }
        } catch {
          // 無法檢查，假設圖片不存在，允許重新上傳
          setCoverDuplicateInfo(null);
        }
      }
    }
    
    setCoverPreviewLoading(false);
  };

  const uploadCoverFileToAppwrite = async (file: File): Promise<{ url: string; fileId: string }> => {
    setCoverUploadStatus('uploading');
    setCoverUploadProgress(0);

    try {
      // Direct upload to Appwrite Storage (bypasses Next.js API route)
      const result = await uploadToAppwriteStorage(file, (progress) => {
        setCoverUploadProgress(progress);
      });

      setCoverUploadStatus('success');
      return result;
    } catch (error) {
      setCoverUploadStatus('error');
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('請輸入音樂名稱');
      return;
    }

    // 檢查是否有重複
    if (duplicateWarning) {
      alert('此音樂與既有音樂重複，無法上傳！請選擇其他音樂。');
      return;
    }

    setSubmitting(true);
    try {
      let finalFormData = { ...formData };

      // 如果有選擇新檔案，先上傳到 Appwrite
      if (selectedFile) {
        try {
          const { url, fileId } = await uploadFileToAppwrite(selectedFile);
          finalFormData.file = url;
          // 使用已計算的 hash，如果沒有則使用 fileId
          finalFormData.hash = fileHash || fileId;
        } catch (uploadError) {
          throw new Error(`音樂上傳失敗: ${uploadError instanceof Error ? uploadError.message : '未知錯誤'}`);
        }
      } else if (!music && !formData.hash) {
        // 新增且沒有檔案也沒有 hash 的情況，生成一個備用 hash
        finalFormData.hash = `no_file_${Date.now()}`;
      }

      // 如果有選擇封面圖檔案，上傳到 Appwrite（或使用已存在的）
      if (selectedCoverFile) {
        // 如果發現重複且用戶選擇使用已存在的封面
        if (coverDuplicateInfo?.found && coverDuplicateInfo.existingUrl && formData.cover === coverDuplicateInfo.existingUrl) {
          // 已經設定為使用現有封面，不需要上傳
          finalFormData.cover = coverDuplicateInfo.existingUrl;
        } else if (coverDuplicateInfo?.found) {
          // 發現重複但用戶沒有選擇使用已存在的，阻止上傳
          throw new Error(`此封面圖已被「${coverDuplicateInfo.musicName}」使用，請使用現有封面或選擇其他圖片`);
        } else {
          // 沒有重複，正常上傳
          try {
            const { url } = await uploadCoverFileToAppwrite(selectedCoverFile);
            finalFormData.cover = url;
            
            // 儲存封面圖 hash 到 localStorage
            if (coverFileHash) {
              const coverHashMap = JSON.parse(localStorage.getItem('coverHashMap') || '{}');
              coverHashMap[coverFileHash] = { url, musicName: finalFormData.name };
              localStorage.setItem('coverHashMap', JSON.stringify(coverHashMap));
            }
          } catch (coverError) {
            throw new Error(`封面圖上傳失敗: ${coverError instanceof Error ? coverError.message : '未知錯誤'}`);
          }
        }
      }

      const apiUrl = music 
        ? addAppwriteConfigToUrl(`${API_ENDPOINTS.MUSIC}/${music.$id}`) 
        : addAppwriteConfigToUrl(API_ENDPOINTS.MUSIC);
      const method = music ? 'PUT' : 'POST';

      const response = await fetch(apiUrl, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalFormData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || (music ? '更新失敗' : '新增失敗');
        throw new Error(errorMsg);
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Music form error:', error);
      alert(error instanceof Error ? error.message : '操作失敗');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {music ? '編輯音樂' : '新增音樂'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              音樂名稱 / Music Name <span className="text-red-500">*</span>
            </label>
            {useNameSelect && existingNames.length > 0 ? (
              <div className="space-y-2">
                <Select
                  value={formData.name}
                  onValueChange={(value) => {
                    if (value === '__custom__') {
                      setUseNameSelect(false);
                      setFormData({ ...formData, name: '' });
                    } else {
                      setFormData({ ...formData, name: value });
                    }
                  }}
                >
                  <SelectTrigger className="h-12 rounded-xl">
                    <SelectValue placeholder="選擇已有音樂名稱 / Select existing name" />
                  </SelectTrigger>
                  <SelectContent>
                    {existingNames.map((name) => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                    <SelectItem value="__custom__">自行輸入新名稱... / Enter new name...</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="請輸入音樂名稱 / Music Name"
                  required
                  className="h-12 rounded-xl"
                />
                {existingNames.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setUseNameSelect(true)}
                    className="text-xs h-7"
                  >
                    從已有名稱中選擇 / Select from existing
                  </Button>
                )}
              </div>
            )}
            <div className="px-1 h-4">
              {formData.name ? (
                <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">已輸入 / Entered</span>
              ) : (
                <span className="text-[10px] text-orange-600 dark:text-orange-400 font-medium">請輸入名稱 / Please enter name</span>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              音樂檔案 / Music File (URL or Upload)
            </label>
            <div className="space-y-3">
              <Input
                value={formData.file}
                onChange={(e) => setFormData({ ...formData, file: e.target.value })}
                placeholder="https://example.com/audio.mp3"
                disabled={submitting}
                className="h-12 rounded-xl"
              />
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">或 / OR</span>
                <label className="flex-1">
                  <div className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg cursor-pointer transition-colors">
                    <Upload className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                      {previewLoading ? '載入中...' : selectedFile ? `已選擇: ${selectedFile.name}` : '上傳音樂 (最大 50MB) / Upload (Max 50MB)'}
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/aac,audio/flac,audio/m4a"
                    onChange={handleFileSelect}
                    disabled={submitting || previewLoading}
                    className="hidden"
                  />
                </label>
              </div>
              <div className="px-1 h-4">
                {formData.file || selectedFile ? (
                  <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">已備妥 / Ready</span>
                ) : (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請提供 URL 或上傳檔案 / (Optional) Please provide URL or upload</span>
                )}
              </div>
              {previewUrl && (
                <div className="mt-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">預覽：</p>
                  <audio src={previewUrl} controls className="w-full" />
                </div>
              )}
              {duplicateWarning && (
                <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">
                    {duplicateWarning}
                  </p>
                </div>
              )}
              {uploadStatus === 'uploading' && (
                <div className="mt-2">
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <span>上傳至 Appwrite...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
              {uploadStatus === 'success' && (
                <p className="text-sm text-green-600 dark:text-green-400">✓ 上傳成功</p>
              )}
              {uploadStatus === 'error' && (
                <p className="text-sm text-red-600 dark:text-red-400">✗ 上傳失敗</p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              歌詞 / Lyrics
            </label>
            <Textarea
              value={formData.lyrics}
              onChange={(e) => setFormData({ ...formData, lyrics: e.target.value })}
              placeholder="輸入歌詞內容 / Lyrics Content"
              rows={6}
              className="rounded-xl"
            />
            <div className="px-1 h-4">
              {formData.lyrics ? (
                <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">已輸入 / Entered</span>
              ) : (
                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請輸入歌詞 / (Optional) Please enter lyrics</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                語言 / Language
              </label>
              {useLanguageSelect ? (
                <div className="space-y-2">
                  <Select
                    value={formData.language}
                    onValueChange={(value) => {
                      if (value === '__custom__') {
                        setUseLanguageSelect(false);
                        setFormData({ ...formData, language: '' });
                      } else {
                        setFormData({ ...formData, language: value });
                      }
                    }}
                  >
                    <SelectTrigger className="h-12 rounded-xl">
                      <SelectValue placeholder="選擇語言 / Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      {existingLanguages.map((lang) => (
                        <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                      ))}
                      <SelectItem value="__custom__">自行輸入... / Custom input...</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    value={formData.language}
                    onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                    placeholder="輸入語言 / Enter language"
                    className="h-12 rounded-xl"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setUseLanguageSelect(true)}
                    className="text-xs h-7"
                  >
                    從預設選項中選擇 / Select from options
                  </Button>
                </div>
              )}
              <div className="px-1 h-4">
                {formData.language ? (
                  <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">已選擇 / Selected</span>
                ) : (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請選擇語言 / (Optional) Please select language</span>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                分類 / Category
              </label>
              {useCategorySelect && existingCategories.length > 0 ? (
                <div className="space-y-2">
                  <Select
                    value={formData.category}
                    onValueChange={(value) => {
                      if (value === '__custom__') {
                        setUseCategorySelect(false);
                        setFormData({ ...formData, category: '' });
                      } else {
                        setFormData({ ...formData, category: value });
                      }
                    }}
                  >
                    <SelectTrigger className="h-12 rounded-xl">
                      <SelectValue placeholder="選擇分類 / Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {existingCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                      <SelectItem value="__custom__">自行輸入... / Custom input...</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="輸入新分類 / Enter new category"
                    className="h-12 rounded-xl"
                  />
                  {existingCategories.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setUseCategorySelect(true)}
                      className="text-xs h-7"
                    >
                      從現有分類中選擇 / Select from existing
                    </Button>
                  )}
                </div>
              )}
              <div className="px-1 h-4">
                {formData.category ? (
                  <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">已輸入 / Entered</span>
                ) : (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請輸入分類 / (Optional) Please enter category</span>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              封面圖 URL 或上傳檔案
            </label>
            <div className="space-y-3">
              <Input
                value={formData.cover}
                onChange={(e) => setFormData({ ...formData, cover: e.target.value })}
                placeholder="https://example.com/cover.jpg"
                disabled={submitting}
                maxLength={150}
              />
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">或</span>
                <label className="flex-1">
                  <div className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg cursor-pointer transition-colors">
                    <Upload className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                      {coverPreviewLoading ? '載入中...' : selectedCoverFile ? `已選擇: ${selectedCoverFile.name}` : '上傳封面圖 (最大 50MB)'}
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    onChange={handleCoverFileSelect}
                    disabled={submitting || coverPreviewLoading}
                    className="hidden"
                  />
                </label>
              </div>
              {coverPreviewUrl && (
                <div className="mt-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">封面圖預覽：</p>
                  <img src={coverPreviewUrl} alt="Cover Preview" className="max-h-32 rounded-lg border border-gray-200 dark:border-gray-700" />
                </div>
              )}
              {/* 重複封面圖警告 */}
              {coverDuplicateInfo?.found && (
                <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-sm text-yellow-700 dark:text-yellow-400 font-medium mb-2">
                    ⚠️ 此封面圖已被「{coverDuplicateInfo.musicName}」使用
                  </p>
                  <p className="text-xs text-yellow-600 dark:text-yellow-500 mb-2">
                    為避免重複上傳，建議使用已存在的封面圖
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, cover: coverDuplicateInfo.existingUrl });
                      setSelectedCoverFile(null);
                      setCoverPreviewUrl('');
                      setCoverDuplicateInfo(null);
                    }}
                    className="px-3 py-1.5 text-xs font-medium bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-800/30 dark:hover:bg-yellow-800/50 text-yellow-700 dark:text-yellow-400 rounded-lg transition-colors"
                  >
                    使用已存在的封面圖
                  </button>
                </div>
              )}
              {coverUploadStatus === 'uploading' && (
                <div className="mt-2">
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <span>上傳封面圖至 Appwrite...</span>
                    <span>{coverUploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${coverUploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
              {coverUploadStatus === 'success' && (
                <p className="text-sm text-green-600 dark:text-green-400">✓ 封面圖上傳成功</p>
              )}
              {coverUploadStatus === 'error' && (
                <p className="text-sm text-red-600 dark:text-red-400">✗ 封面圖上傳失敗</p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              備註 / Note
            </label>
            <Textarea
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              placeholder="音樂備註說明 / Music Note"
              rows={3}
              className="rounded-xl"
            />
            <div className="px-1 h-4">
              {formData.note ? (
                <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">已輸入 / Entered</span>
              ) : (
                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請輸入備註 / (Optional) Please enter note</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                參考 / Reference
              </label>
              <Input
                value={formData.ref}
                onChange={(e) => setFormData({ ...formData, ref: e.target.value })}
                placeholder="參考資訊 / Reference Info"
                className="h-12 rounded-xl"
              />
              <div className="px-1 h-4">
                {formData.ref ? (
                  <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">已輸入 / Entered</span>
                ) : (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(選填) 請輸入參考 / (Optional) Please enter reference</span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Hash (程式自動生成)
              </label>
              <Input
                value={formData.hash}
                disabled
                placeholder="上傳檔案後自動生成"
                className="bg-gray-100 dark:bg-gray-700 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" onClick={onClose} className="flex-1 bg-gray-500 hover:bg-gray-600 rounded-xl">
              取消
            </Button>
            <Button 
              type="submit" 
              disabled={submitting || !!duplicateWarning} 
              className="flex-1 bg-purple-500 hover:bg-purple-600 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? '處理中...' : (music ? '更新' : '新增')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
