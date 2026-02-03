"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Play, Download, CheckCircle, AlertCircle, Loader, Trash2, HardDrive, Plus, Edit, X, Upload, Calendar, Search, ListPlus, Camera } from "lucide-react";
import SimpleVideoPlayer from "@/components/ui/simple-video-player";
import { PlyrPlayer } from "@/components/ui/plyr-player";
import { useVideoCache } from "@/hooks/useVideoCache";
import { useVideos, VideoData } from "@/hooks/useVideos";
import { SectionHeader } from "@/components/ui/section-header";
import { DataCard } from "@/components/ui/data-card";
import { SimpleStatCard, StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { VideoItem } from "@/types";
import { API_ENDPOINTS } from "@/lib/constants";
import { formatLocalDate } from "@/lib/formatters";
import { getAppwriteHeaders, getProxiedMediaUrl, getAppwriteDownloadUrl } from "@/lib/utils";
import { uploadToAppwriteStorage } from "@/lib/appwriteStorage";
import { useVideoQueue, VideoQueueItem } from "@/hooks/useVideoQueue";
import { VideoQueuePanel } from "@/components/ui/video-queue-panel";
import { VideoScreenshotButton } from "@/components/ui/video-screenshot-button";

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



export default function VideoIntroduction() {
  const { videos, loading, error, stats, loadVideos } = useVideos();
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingVideo, setEditingVideo] = useState<VideoData | null>(null);
  const [currentVideo, setCurrentVideo] = useState<string | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [importPreview, setImportPreview] = useState<{ data: VideoFormData[]; errors: string[] } | null>(null);
    const [importing, setImporting] = useState(false);
    const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const videoRef = useRef<HTMLVideoElement>(null);
  const { addToQueue, isInQueue } = useVideoQueue();

  // 接下來播放 - 加入佇列
  const handleAddToQueue = useCallback((video: VideoData) => {
    if (!video.file) {
      alert('此影片尚未上傳影片檔案');
      return;
    }
    const queueItem: VideoQueueItem = {
      id: video.$id,
      name: video.name,
      category: video.category || '',
      file: video.file,
      cover: typeof video.cover === 'string' ? video.cover : '',
    };
    const added = addToQueue(queueItem);
    if (!added) {
      alert('此影片已在播放佇列中');
    }
  }, [addToQueue]);

  // CSV 匹出/匯入
  const CSV_HEADERS = ['name', 'category', 'note', 'ref'];
  const EXPECTED_COLUMN_COUNT = CSV_HEADERS.length;

  interface VideoFormData {
    name: string;
    category: string;
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
    videos.forEach(item => {
      rows.push([
        escapeCSV(item.name),
        escapeCSV(item.category || ''),
        escapeCSV(item.note || ''),
        escapeCSV(item.ref || '')
      ].join(','));
    });
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'appwrite-Video.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const parseCSV = (text: string): { data: VideoFormData[]; errors: string[] } => {
    const errors: string[] = [];
    const data: VideoFormData[] = [];
    const cleanText = text.replace(/^\uFEFF/, '');
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;
    
    for (let i = 0; i < cleanText.length; i++) {
      const char = cleanText[i];
      const nextChar = cleanText[i + 1];
      if (inQuotes) {
        if (char === '"') {
          if (nextChar === '"') { currentField += '"'; i++; }
          else { inQuotes = false; }
        } else { currentField += char; }
      } else {
        if (char === '"') { inQuotes = true; }
        else if (char === ',') { currentRow.push(currentField); currentField = ''; }
        else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
          currentRow.push(currentField); currentField = '';
          if (currentRow.length > 0 && currentRow.some(f => f.trim())) { rows.push(currentRow); }
          currentRow = [];
          if (char === '\r') i++;
        } else if (char !== '\r') { currentField += char; }
      }
    }
    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField);
      if (currentRow.some(f => f.trim())) { rows.push(currentRow); }
    }
    
    if (rows.length < 2) { errors.push('CSV 檔案至少需要表頭和一行資料'); return { data, errors }; }
    const headerValues = rows[0];
    if (headerValues.length !== EXPECTED_COLUMN_COUNT) {
      errors.push(`表頭欄位數量錯誤: 預期 ${EXPECTED_COLUMN_COUNT} 欄，實際 ${headerValues.length} 欄`);
      return { data, errors };
    }
    for (let i = 0; i < CSV_HEADERS.length; i++) {
      if (headerValues[i]?.trim() !== CSV_HEADERS[i]) {
        errors.push(`表頭第 ${i + 1} 欄錯誤: 預期 "${CSV_HEADERS[i]}"，實際 "${headerValues[i]?.trim()}"`);
      }
    }
    if (errors.length > 0) return { data, errors };
    
    for (let i = 1; i < rows.length; i++) {
      const values = rows[i];
      if (values.length !== EXPECTED_COLUMN_COUNT) { errors.push(`第 ${i + 1} 行: 欄位數量錯誤`); continue; }
      if (!values[0]?.trim()) { errors.push(`第 ${i + 1} 行: name 欄位不能為空`); continue; }
      data.push({ name: values[0].trim(), category: values[1]?.trim() || '', note: values[2]?.trim() || '', ref: values[3]?.trim() || '' });
    }
    return { data, errors };
  };

  const handleCsvFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) { alert('請選擇 CSV 檔案'); return; }
    const reader = new FileReader();
    reader.onload = (event) => { setImportPreview(parseCSV(event.target?.result as string)); };
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
        const existing = videos.find(v => v.name === formData.name);
        const apiUrl = existing
          ? addAppwriteConfigToUrl(`${API_ENDPOINTS.VIDEO}/${existing.$id}`)
          : addAppwriteConfigToUrl(API_ENDPOINTS.VIDEO);
        const method = existing ? 'PUT' : 'POST';
        const submitData = {
          name: formData.name, category: formData.category, note: formData.note, ref: formData.ref,
          ...(existing && { file: existing.file, cover: existing.cover, hash: existing.hash }),
          ...(!existing && { file: '', cover: '', hash: `csv_import_${Date.now()}_${Math.random().toString(36).substring(7)}` })
        };
        const response = await fetch(apiUrl, { method, headers: { 'Content-Type': 'application/json', ...getAppwriteHeaders() }, body: JSON.stringify(submitData) });
        if (response.ok) { successCount++; } else { failCount++; }
      } catch { failCount++; }
    }
    
    // 匯入完成後統一重新載入一次
    await loadVideos(true);
    
    setImporting(false);
    setImportProgress({ current: 0, total: 0 });
    setImportPreview(null);
    alert(`匯入完成！\n成功: ${successCount} 筆\n失敗: ${failCount} 筆`);
  };

  // 搜尋過濾
  const filteredVideos = useMemo(() => {
    if (!searchQuery.trim()) return videos;
    const query = searchQuery.toLowerCase();
    return videos.filter(video => 
      video.name?.toLowerCase().includes(query) ||
      video.note?.toLowerCase().includes(query)
    );
  }, [videos, searchQuery]);
  
  const {
    cacheStatus,
    cacheStats,
    loadVideoFromCache,
    downloadAndCacheVideo,
    deleteVideoCache,
    clearAllCache,
    updateCacheStats,
    formatFileSize,
    maxCacheSize,
  } = useVideoCache();

  useEffect(() => {
    updateCacheStats();
  }, [updateCacheStats]);

  const handleAdd = () => {
    setEditingVideo(null);
    setShowFormModal(true);
  };

  const handleEdit = (video: VideoData) => {
    setEditingVideo(video);
    setShowFormModal(true);
  };

  const handleDelete = async (video: VideoData) => {
    const confirmText = `DELETE ${video.name}`;
    const userInput = prompt(`確定要刪除影片「${video.name}」嗎？\n\n請輸入以下文字以確認刪除：\n${confirmText}`);
    
    if (userInput !== confirmText) {
      if (userInput !== null) {
        alert('輸入不正確，刪除已取消');
      }
      return;
    }

    try {
      const url = addAppwriteConfigToUrl(`${API_ENDPOINTS.VIDEO}/${video.$id}`);
      const response = await fetch(url, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('刪除失敗');
      loadVideos(true);
    } catch (error) {
      alert(error instanceof Error ? error.message : '刪除失敗');
    }
  };

  const handleFormSuccess = () => {
    setShowFormModal(false);
    setEditingVideo(null);
    loadVideos(true);
  };

  const playVideo = useCallback(async (video: VideoData) => {
    setCurrentVideo(video.$id);
    setShowPlayer(true);
    const cachedUrl = await loadVideoFromCache(video.$id);
    
    if (videoRef.current) {
      videoRef.current.src = cachedUrl || video.file || '';
      videoRef.current.load();
    }
  }, [loadVideoFromCache]);

  const handleDownload = useCallback(async (video: VideoData) => {
    const videoItem: VideoItem = {
      id: video.$id,
      title: video.name,
      description: video.note || '',
      filename: video.name,
      url: video.file,
      cover: typeof video.cover === 'string' ? video.cover : '',
    };
    await downloadAndCacheVideo(videoItem);
  }, [downloadAndCacheVideo]);

  const handleDeleteCache = useCallback(async (videoId: string) => {
    if (confirm('確定要刪除此影片的快取嗎？')) {
      await deleteVideoCache(videoId);
    }
  }, [deleteVideoCache]);

  const handleClearAll = useCallback(async () => {
    if (confirm('確定要清空所有影片快取嗎？此操作無法復原。')) {
      await clearAllCache();
    }
  }, [clearAllCache]);

  const currentVideoData = videos.find(v => v.$id === currentVideo);

  if (loading) {
    return (
      <div className="space-y-4 lg:space-y-6">
        <SectionHeader title="鋒兄影片" subtitle="影片管理" showAccountLabel={true} />
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
        title="鋒兄影片"
        subtitle="觀看精彩影片內容，支援本地快取減少流量使用"
        showAccountLabel={true}
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={() => document.getElementById('csv-import-video')?.click()} variant="outline" className="rounded-xl flex items-center gap-2" title="匯入 CSV">
              <Upload size={18} /> 匯入
            </Button>
            <input id="csv-import-video" type="file" accept=".csv" className="hidden" onChange={handleCsvFileSelect} />
            <Button onClick={exportToCSV} variant="outline" className="rounded-xl flex items-center gap-2" title="匯出 CSV">
              <Download size={18} /> 匯出
            </Button>
            <Button onClick={handleAdd} className="gap-2 bg-blue-500 hover:bg-blue-600 rounded-xl">
              <Plus size={16} />
              新增影片
            </Button>
          </div>
        }
      />

      {/* 統計卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="影片總數" value={stats.total} icon={Play} />
        <StatCard title="已快取" value={cacheStats.cachedVideos} icon={CheckCircle} />
        <StatCard title="快取大小" value={formatFileSize(cacheStats.totalSize)} icon={HardDrive} />
      </div>

      {/* 影片播放器 */}
      {showPlayer && currentVideo && currentVideoData && (
        <VideoPlayerModal
          video={currentVideoData}
          videoRef={videoRef}
          onClose={() => setShowPlayer(false)}
        />
      )}

      {/* 搜尋欄位 */}
      {videos.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            placeholder="搜尋影片名稱、備註..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 rounded-xl"
          />
        </div>
      )}

      {/* 影片列表 */}
      {videos.length === 0 ? (
        <EmptyState
          icon={<Play className="w-12 h-12" />}
          title="尚無影片"
          description="點擊上方「新增影片」按鈕新增第一個影片"
        />
      ) : filteredVideos.length === 0 ? (
        <EmptyState
          icon={<Search className="w-12 h-12" />}
          title="無搜尋結果"
          description={`找不到「${searchQuery}」相關的影片`}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
          {filteredVideos.map((video) => (
            <VideoManagementCard
              key={video.$id}
              video={video}
              cacheStatus={cacheStatus[video.$id]}
              onPlay={() => playVideo(video)}
              onEdit={() => handleEdit(video)}
              onDelete={() => handleDelete(video)}
              onDownload={() => handleDownload(video)}
              onDeleteCache={() => handleDeleteCache(video.$id)}
              onAddToQueue={() => handleAddToQueue(video)}
              isInQueue={isInQueue(video.$id)}
            />
          ))}
        </div>
      )}

      {/* 快取管理 */}
      <CacheManager
        cacheStats={cacheStats}
        maxCacheSize={maxCacheSize}
        formatFileSize={formatFileSize}
        onClearAll={handleClearAll}
        videoCount={videos.length}
      />

      {/* 表單模態框 */}
      {showFormModal && (
        <VideoFormModal
          video={editingVideo}
          existingVideos={videos}
          onClose={() => {
            setShowFormModal(false);
            setEditingVideo(null);
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
                      ⚠️ <strong>注意：</strong>匯入不包含影片檔案和封面圖，這些需要另行上傳。
                    </p>
                  </div>
                  <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">將匯入 {importPreview.data.length} 筆資料:</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100 dark:bg-gray-700">
                          <th className="px-3 py-2 text-left">名稱</th>
                          <th className="px-3 py-2 text-left">分類</th>
                          <th className="px-3 py-2 text-left">備註</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.data.slice(0, 10).map((item, i) => (
                          <tr key={i} className="border-b border-gray-200 dark:border-gray-700">
                            <td className="px-3 py-2 font-medium">{item.name}</td>
                            <td className="px-3 py-2">{item.category || '-'}</td>
                            <td className="px-3 py-2 max-w-[200px] truncate">{item.note || '-'}</td>
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

      {/* 影片播放佇列面板 */}
      <VideoQueuePanel />
    </div>
  );
}

// 影片播放器模態框 - 終極重構版（完全模仿 Sora/YouTube 設計）
function VideoPlayerModal({ video, videoRef, onClose }: { video: VideoData; videoRef: React.RefObject<HTMLVideoElement | null>; onClose: () => void }) {
  const { videos } = useVideos();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const [repeatMode, setRepeatMode] = useState(false);
  const [currentVideo, setCurrentVideo] = useState<VideoData>(video);
  const [playedIds, setPlayedIds] = useState<Set<string>>(new Set([video.$id]));
  const modalRef = useRef<HTMLDivElement>(null);

  // 所有有影片的列表（按順序）
  const allVideosWithFile = useMemo(() => {
    return videos.filter(v => v.file);
  }, [videos]);

  // 推薦影片列表（排除當前影片，按播放順序排列，未播放的在前面）
  const recommendedVideos = useMemo(() => {
    const currentIndex = allVideosWithFile.findIndex(v => v.$id === currentVideo.$id);
    const result: VideoData[] = [];
    
    // 從當前位置往後排序，未播放的先顯示
    for (let i = 1; i < allVideosWithFile.length; i++) {
      const nextIndex = (currentIndex + i) % allVideosWithFile.length;
      const video = allVideosWithFile[nextIndex];
      if (!playedIds.has(video.$id)) {
        result.push(video);
      }
    }
    
    // 已播放的放後面
    for (let i = 1; i < allVideosWithFile.length; i++) {
      const nextIndex = (currentIndex + i) % allVideosWithFile.length;
      const video = allVideosWithFile[nextIndex];
      if (playedIds.has(video.$id)) {
        result.push(video);
      }
    }
    
    return result.slice(0, 10);
  }, [allVideosWithFile, currentVideo.$id, playedIds]);

  const toggleFullscreen = () => setIsFullscreen(!isFullscreen);

  // 監聽影片播放結束事件 - 支援重複播放和自動播放下一個
  useEffect(() => {
    const handleVideoEnded = () => {
      // 如果開啟重複播放，重播當前影片
      if (repeatMode) {
        const plyrVideo = document.querySelector('.plyr video') as HTMLVideoElement;
        if (plyrVideo) {
          plyrVideo.currentTime = 0;
          plyrVideo.play();
        }
        return;
      }
      
      // 自動播放下一個（順序播放，不重複）
      if (!autoPlay) return;
      
      // 找到當前影片在列表中的位置
      const currentIndex = allVideosWithFile.findIndex(v => v.$id === currentVideo.$id);
      
      // 從當前位置往後找下一個未播放的影片
      let nextVideo: VideoData | null = null;
      for (let i = 1; i < allVideosWithFile.length; i++) {
        const nextIndex = (currentIndex + i) % allVideosWithFile.length;
        const candidate = allVideosWithFile[nextIndex];
        if (!playedIds.has(candidate.$id)) {
          nextVideo = candidate;
          break;
        }
      }
      
      // 如果所有影片都播放過了，重置並從下一個開始
      if (!nextVideo && allVideosWithFile.length > 1) {
        const nextIndex = (currentIndex + 1) % allVideosWithFile.length;
        nextVideo = allVideosWithFile[nextIndex];
        setPlayedIds(new Set([nextVideo.$id])); // 重置播放記錄
        console.log('所有影片已播放完畢，重新開始:', nextVideo.name);
      } else if (nextVideo) {
        setPlayedIds(prev => new Set([...prev, nextVideo!.$id]));
        console.log('自動播放下一個:', nextVideo.name);
      }
      
      if (nextVideo) {
        setCurrentVideo(nextVideo);
      }
    };

    // 監聽 Plyr 播放器的 ended 事件
    const checkForPlyr = () => {
      const plyrVideo = document.querySelector('.plyr video') as HTMLVideoElement;
      if (plyrVideo) {
        plyrVideo.addEventListener('ended', handleVideoEnded);
        return () => plyrVideo.removeEventListener('ended', handleVideoEnded);
      }
    };

    const timer = setTimeout(checkForPlyr, 500);
    const cleanup = checkForPlyr();

    return () => {
      clearTimeout(timer);
      if (cleanup) cleanup();
    };
  }, [autoPlay, repeatMode, allVideosWithFile, currentVideo, playedIds]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') isFullscreen ? setIsFullscreen(false) : onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isFullscreen, onClose]);

  // 全螢幕模式
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 bg-black z-[100] flex items-center justify-center">
        <button onClick={toggleFullscreen} className="absolute top-6 right-6 z-10 p-3 bg-black/40 hover:bg-black/60 rounded-full text-white transition-all">
          <X className="w-6 h-6" />
        </button>
        <div className="w-full h-full">
          <PlyrPlayer 
            key={currentVideo.$id}
            type="video" 
            src={getProxiedMediaUrl(currentVideo.file || '')} 
            poster={currentVideo.cover} 
            autoplay={true}
            className="w-full h-full" 
          />
        </div>
      </div>
    );
  }

  // 統一橫式影片布局（標準 YouTube 風格）
  return (
    <div className="fixed inset-0 bg-white dark:bg-[#0f0f0f] z-50 overflow-y-auto animate-in fade-in duration-200">
      {/* 頂部極簡導航 */}
      <div className="sticky top-0 z-20 bg-white/80 dark:bg-[#0f0f0f]/80 backdrop-blur-md border-b dark:border-gray-800">
        <div className="max-w-[1800px] mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
              <Play className="w-5 h-5 text-white fill-current" />
            </div>
            <span className="font-bold text-lg hidden sm:block dark:text-white">鋒兄影片</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors dark:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      <main className="max-w-[1700px] mx-auto p-4 lg:p-6 xl:p-8">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          
          {/* 左側：主播放區 + 影片資訊 */}
          <div className="flex-1 lg:max-w-[calc(100%-420px)] space-y-4">
            {/* 播放器容器 - 固定 16:9，影片用 contain 完整顯示，確保時間軸可見 */}
            <div className="bg-black rounded-xl shadow-2xl aspect-video ring-1 dark:ring-white/10 [&_.plyr]:!h-full [&_.plyr]:!w-full [&_.plyr]:rounded-xl">
              <PlyrPlayer
                key={currentVideo.$id}
                type="video"
                src={getProxiedMediaUrl(currentVideo.file || '')}
                poster={currentVideo.cover}
                autoplay={true}
                className="w-full h-full"
              />
            </div>

            {/* 影片標題 */}
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white leading-tight">
              {currentVideo.name}
            </h1>

            {/* 作者與互動區 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2 border-b dark:border-gray-800 pb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                  FX
                </div>
                <div>
                  <div className="font-bold dark:text-white">鋒兄 (Feng Xiong)</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">系統管理員</div>
                </div>
                <button className="ml-4 px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-full text-sm font-medium hover:opacity-90 transition-opacity">
                  訂閱
                </button>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                <Button variant="secondary" className="rounded-full gap-2 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 border-none dark:text-white">
                  <Play className="w-4 h-4" /> 點讚
                </Button>
                <VideoScreenshotButton videoTitle={currentVideo.name} />
                <Button variant="secondary" onClick={toggleFullscreen} className="rounded-full gap-2 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 border-none dark:text-white">
                  <Plus className="w-4 h-4" /> 全螢幕
                </Button>
                <Button variant="secondary" className="rounded-full gap-2 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 border-none dark:text-white">
                  <Download className="w-4 h-4" /> 分享
                </Button>
              </div>
            </div>

            {/* 影片描述區 (YouTube 樣式) */}
            <div className="bg-gray-100 dark:bg-white/5 rounded-xl p-4 space-y-2 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
              <div className="flex gap-3 text-sm font-bold dark:text-white">
                <span>{formatLocalDate(currentVideo.$createdAt)}</span>
                {currentVideo.category && <span className="text-blue-600 dark:text-blue-400">#{currentVideo.category}</span>}
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {currentVideo.note || "暫無詳細描述。"}
              </p>
              {currentVideo.ref && (
                <div className="pt-2">
                  <a href={currentVideo.ref} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all">
                    {currentVideo.ref}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* 右側：推薦影片側邊欄 */}
          <aside className="w-full lg:w-[400px] space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-gray-900 dark:text-white">接下來播放</h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setRepeatMode(!repeatMode)}
                  className={`text-xs font-medium cursor-pointer px-3 py-1 rounded-full transition-colors ${
                    repeatMode 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                  title="重複播放同一影片"
                >
                  重複 {repeatMode ? '開' : '關'}
                </button>
                <button 
                  onClick={() => setAutoPlay(!autoPlay)}
                  className={`text-xs font-medium cursor-pointer px-3 py-1 rounded-full transition-colors ${
                    autoPlay 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                  disabled={repeatMode}
                  style={{ opacity: repeatMode ? 0.5 : 1 }}
                  title={repeatMode ? '重複模式下自動播放已停用' : '自動播放下一個影片'}
                >
                  自動播放 {autoPlay ? '開' : '關'}
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {recommendedVideos.map((recVideo) => (
                <RecommendedVideoCard
                  key={recVideo.$id}
                  video={recVideo}
                  onClick={() => {
                    setPlayedIds(prev => new Set([...prev, recVideo.$id]));
                    setCurrentVideo(recVideo);
                  }}
                />
              ))}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

// 推薦影片卡片 (極簡 YouTube 風格)
function RecommendedVideoCard({ video, onClick }: { video: VideoData; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex gap-3 group text-left transition-colors">
      <div className="relative w-[168px] aspect-video flex-shrink-0 bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden">
        {video.cover ? (
          <img src={video.cover} alt={video.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
            <Play className="w-6 h-6 text-white/20" />
          </div>
        )}
        <div className="absolute bottom-1 right-1 bg-black/80 text-[10px] text-white px-1 rounded font-bold">
          4:05
        </div>
      </div>
      <div className="flex-1 min-w-0 py-0.5">
        <h4 className="font-bold text-gray-900 dark:text-white text-sm line-clamp-2 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors">
          {video.name}
        </h4>
        <div className="mt-1 flex flex-col text-[12px] text-gray-500 dark:text-gray-400">
          <span>鋒兄 (Feng Xiong)</span>
          <span>{formatLocalDate(video.$createdAt)}</span>
        </div>
      </div>
    </button>
  );
}

// 影片管理卡片屬性
interface VideoManagementCardProps {
  video: VideoData;
  cacheStatus?: { cached: boolean; downloading: boolean; progress: number; error?: string };
  onPlay: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onDeleteCache: () => void;
  onAddToQueue?: () => void;
  isInQueue?: boolean;
}

// 影片管理卡片 (模仿首頁瀑布流)
function VideoManagementCard({ video, cacheStatus, onPlay, onEdit, onDelete, onDownload, onDeleteCache, onAddToQueue, isInQueue }: VideoManagementCardProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!video.cover && video.file) {
      const videoElement = document.createElement('video');
      videoElement.src = video.file;
      videoElement.crossOrigin = 'anonymous';
      videoElement.currentTime = 1;
      videoElement.addEventListener('seeked', () => {
        const canvas = canvasRef.current || document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
          setThumbnailUrl(canvas.toDataURL('image/jpeg', 0.8));
        }
      });
      videoElement.load();
    }
  }, [video.cover, video.file]);

  return (
    <div className="flex flex-col gap-3 group animate-in zoom-in-95 duration-300">
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      {/* 縮圖容器 */}
      <div 
        className={`relative aspect-video bg-gray-100 dark:bg-[#1e1e1e] rounded-xl overflow-hidden shadow-sm group-hover:shadow-md transition-all border dark:border-white/5 ${video.file ? 'cursor-pointer' : ''}`} 
        onClick={video.file ? onPlay : undefined}
      >
        <img 
          src={video.cover || thumbnailUrl || ''} 
          alt={video.name} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
        />
        {!video.cover && !thumbnailUrl && (
          <div className="absolute inset-0 bg-gradient-to-br from-[#2b2b2b] to-[#000] flex items-center justify-center">
            <Play className="w-12 h-12 text-white/10" />
          </div>
        )}
        
        {/* 播放按鈕 Overlay - 只在有影片時顯示 */}
        {video.file ? (
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center scale-90 group-hover:scale-100 transition-transform">
              <Play className="w-6 h-6 text-white fill-current" />
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="text-center space-y-2">
              <Upload className="w-8 h-8 text-white/60 mx-auto" />
              <p className="text-white/80 text-sm font-medium">尚未上傳影片</p>
            </div>
          </div>
        )}

        {/* 分類標籤 */}
        {video.category && (
          <div className="absolute top-2 left-2 px-2 py-1 text-[10px] font-bold bg-black/60 text-white rounded backdrop-blur-sm">
            {video.category.toUpperCase()}
          </div>
        )}

        {/* 快取狀態 - 只在有影片時顯示 */}
        {video.file && (
          <div className="absolute top-2 right-2">
            <CacheStatusIcon status={cacheStatus} />
          </div>
        )}
      </div>

      {/* 影片資訊 */}
      <div className="flex gap-3 px-1">
        <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-white/10 flex-shrink-0 flex items-center justify-center font-bold text-xs dark:text-white">
          FX
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <h3 
            className={`font-bold text-gray-900 dark:text-white text-sm md:text-base line-clamp-2 leading-snug transition-colors ${video.file ? 'cursor-pointer hover:text-blue-600' : ''}`} 
            onClick={video.file ? onPlay : undefined}
          >
            {video.name}
          </h3>
          <div className="flex flex-col text-xs text-gray-500 dark:text-gray-400 font-medium">
            <span>鋒兄影片 • 管理員</span>
            <div className="flex items-center gap-1">
              <span>{formatLocalDate(video.$createdAt)}</span>
              <span>•</span>
              {video.file ? (
                <span className="text-green-600 dark:text-green-400">已發佈</span>
              ) : (
                <span className="text-orange-600 dark:text-orange-400">尚未上傳</span>
              )}
            </div>
          </div>

          {/* 管理按鈕列 */}
          <div className="flex items-center gap-2 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* 接下來播放按鈕 */}
            {video.file && onAddToQueue && (
              <button 
                onClick={(e) => { e.stopPropagation(); onAddToQueue(); }}
                className={`p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors ${
                  isInQueue ? 'text-green-600 dark:text-green-400' : 'text-purple-600 dark:text-purple-400'
                }`}
                title={isInQueue ? '已在佇列中' : '接下來播放'}
              >
                <ListPlus className="w-4 h-4" />
              </button>
            )}
            {/* 直接下載按鈕 */}
            {video.file && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const downloadUrl = getAppwriteDownloadUrl(video.file);
                  const link = document.createElement('a');
                  link.href = downloadUrl;
                  link.download = `${video.name}.mp4`;
                  link.target = '_blank';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors text-green-600 dark:text-green-400"
                title="下載影片"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
            <button onClick={onEdit} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors text-blue-600 dark:text-blue-400">
              <Edit className="w-4 h-4" />
            </button>
            <button onClick={onDelete} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors text-red-600 dark:text-red-400">
              <Trash2 className="w-4 h-4" />
            </button>
            {video.file && (
              cacheStatus?.cached ? (
                <button onClick={onDeleteCache} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors text-orange-600">
                  <HardDrive className="w-4 h-4" />
                </button>
              ) : (
                <button onClick={onDownload} disabled={cacheStatus?.downloading} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors text-gray-600 dark:text-gray-400" title="快取到本地">
                  <HardDrive className="w-4 h-4" />
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// 影片表單模態框
function VideoFormModal({ video, existingVideos, onClose, onSuccess }: { video: VideoData | null; existingVideos: VideoData[]; onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: video?.name || '',
    file: video?.file || '',
    note: video?.note || '',
    ref: video?.ref || '',
    category: video?.category || '',
    hash: video?.hash || '',
    cover: typeof video?.cover === 'string' ? video.cover : '',
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
  const [useCategorySelect, setUseCategorySelect] = useState(true); // 是否使用選擇框

  // 獲取所有已存在的分類
  const existingCategories = Array.from(new Set(existingVideos.map(v => v.category).filter(Boolean)));

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

  // 從影片第 1 秒生成縮圖
  const generateThumbnailFromVideo = (videoUrl: string, videoFileName?: string) => {
    const video = document.createElement('video');
    video.src = videoUrl;
    video.crossOrigin = 'anonymous';
    video.currentTime = 1; // 設定到第 1 秒

    video.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // 轉換為 Blob
          canvas.toBlob((blob) => {
            if (blob) {
              // 使用影片名稱生成縮圖檔名
              const baseFileName = videoFileName || 'video';
              const nameWithoutExt = baseFileName.substring(0, baseFileName.lastIndexOf('.')) || baseFileName;
              const thumbnailName = `${nameWithoutExt}-thumbnail.jpg`;
              
              const file = new File([blob], thumbnailName, { type: 'image/jpeg' });
              setSelectedCoverFile(file);
              const thumbnailUrl = URL.createObjectURL(blob);
              setCoverPreviewUrl(thumbnailUrl);
            }
          }, 'image/jpeg', 0.9);
        }
      } catch (error) {
        console.error('Thumbnail generation error:', error);
      } finally {
        URL.revokeObjectURL(videoUrl);
      }
    });

    video.addEventListener('error', (e) => {
      console.error('Video load error:', e);
    });

    video.load();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 檢查檔案大小 (50MB = 50 * 1024 * 1024 bytes)
    // Note: Direct upload to Appwrite Storage, no Next.js 4MB limit!
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('影片檔案大小不能超過 50MB');
      return;
    }

    // 檢查檔案類型
    const validTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
    if (!validTypes.includes(file.type)) {
      alert('只支援 MP4, WebM, OGG, MOV 格式的影片');
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

    // 如果沒有封面圖，從影片第 1 秒生成縮圖
    if (!formData.cover && !selectedCoverFile) {
      generateThumbnailFromVideo(objectUrl, file.name);
    }

    // 檢查是否與現有影片重複
    setFileHash(hash);
    setFormData({ ...formData, hash });
    
    // 檢查是否有重複的 hash
    const duplicateVideo = existingVideos.find(vid => 
      vid.hash === hash && (!video || vid.$id !== video.$id)
    );
    
    if (duplicateVideo) {
      setDuplicateWarning(`警告：此影片與「${duplicateVideo.name}」相同，請勿重複上傳！`);
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
    
    // 儲存檔案並產生預覽 URL
    setSelectedCoverFile(file);
    const objectUrl = URL.createObjectURL(file);
    setCoverPreviewUrl(objectUrl);
    
    // 模擬預覽載入完成
    setTimeout(() => setCoverPreviewLoading(false), 300);
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
      alert('請輸入影片名稱');
      return;
    }

    // 檢查是否有重複
    if (duplicateWarning) {
      alert('此影片與既有影片重複，無法上傳！請選擇其他影片。');
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
          throw new Error(`影片上傳失敗: ${uploadError instanceof Error ? uploadError.message : '未知錯誤'}`);
        }
      } else if (!video && !formData.hash) {
        // 新增且沒有檔案也沒有 hash 的情況，生成一個備用 hash
        finalFormData.hash = `no_file_${Date.now()}`;
      }

      // 如果有選擇封面圖檔案，上傳到 Appwrite
      if (selectedCoverFile) {
        try {
          const { url } = await uploadCoverFileToAppwrite(selectedCoverFile);
          finalFormData.cover = url;
        } catch (coverError) {
          throw new Error(`封面圖上傳失敗: ${coverError instanceof Error ? coverError.message : '未知錯誤'}`);
        }
      }

      const apiUrl = video 
        ? addAppwriteConfigToUrl(`${API_ENDPOINTS.VIDEO}/${video.$id}`) 
        : addAppwriteConfigToUrl(API_ENDPOINTS.VIDEO);
      const method = video ? 'PUT' : 'POST';
      
      const response = await fetch(apiUrl, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalFormData),
      });

      if (!response.ok) throw new Error(video ? '更新失敗' : '新增失敗');
      
      onSuccess();
      onClose();
    } catch (error) {
      alert(error instanceof Error ? error.message : '操作失敗');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {video ? '編輯影片' : '新增影片'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              影片名稱 / Video Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="請輸入影片名稱 / Video Name"
              required
              className="h-12 rounded-xl"
            />
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
              影片檔案 / Video File (URL or Upload)
            </label>
            <div className="space-y-3">
              <Input
                value={formData.file}
                onChange={(e) => setFormData({ ...formData, file: e.target.value })}
                placeholder="https://example.com/video.mp4"
                disabled={submitting}
                className="h-12 rounded-xl"
              />
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">或 / OR</span>
                <label className="flex-1">
                  <div className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg cursor-pointer transition-colors">
                    <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      {previewLoading ? '載入中...' : selectedFile ? `已選擇: ${selectedFile.name}` : '上傳影片 (最大 50MB) / Upload (Max 50MB)'}
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/ogg,video/quicktime"
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
                  <video src={previewUrl} controls className="max-h-48 rounded-lg border border-gray-200 dark:border-gray-700" />
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
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
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
              備註 / Note
            </label>
            <Textarea
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              placeholder="影片備註說明 / Video Note"
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
                  <div className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg cursor-pointer transition-colors">
                    <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
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
              {coverUploadStatus === 'uploading' && (
                <div className="mt-2">
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <span>上傳封面圖至 Appwrite...</span>
                    <span>{coverUploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
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

          <div className="flex gap-3 pt-4">
            <Button type="button" onClick={onClose} className="flex-1 bg-gray-500 hover:bg-gray-600 rounded-xl">
              取消
            </Button>
            <Button 
              type="submit" 
              disabled={submitting || !!duplicateWarning} 
              className="flex-1 bg-blue-500 hover:bg-blue-600 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? '處理中...' : (video ? '更新' : '新增')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 影片播放器
function VideoPlayer({ video, videoRef }: { video: VideoItem; videoRef: React.RefObject<HTMLVideoElement | null> }) {
  return (
    <DataCard className="overflow-hidden">
      <div className="p-2 sm:p-4">
        <PlyrPlayer
          type="video"
          src={getProxiedMediaUrl(videoRef.current?.src || video.url || `/videos/${video.filename}`)}
          className="w-full"
        />
      </div>
      <div className="p-4 pt-0">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">{video.title}</h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">{video.description}</p>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
          <div className="flex items-start gap-2">
            <span className="text-blue-500">💡</span>
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <p className="font-medium mb-1">播放控制提示：</p>
              <ul className="text-xs space-y-0.5 text-blue-600 dark:text-blue-400">
                <li>• 點擊影片或播放按鈕開始/暫停播放</li>
                <li>• 點擊時間軸任意位置快速跳轉</li>
                <li>• 雙擊影片進入全螢幕模式</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </DataCard>
  );
}

// 影片卡片
interface VideoCardProps {
  video: VideoItem;
  cacheStatus?: { cached: boolean; downloading: boolean; progress: number; error?: string };
  onPlay: () => void;
  onDownload: () => void;
  onDeleteCache: () => void;
}

function VideoCard({ video, cacheStatus, onPlay, onDownload, onDeleteCache }: VideoCardProps) {
  return (
    <DataCard className="overflow-hidden hover:shadow-md transition-all duration-200 group">
      {/* 縮圖 */}
      <div className="relative aspect-video bg-gray-100 dark:bg-gray-700 overflow-hidden cursor-pointer" onClick={onPlay}>
        {typeof video.cover === 'string' && video.cover ? (
          <img 
            src={video.cover} 
            alt={video.title} 
            className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500" 
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center group-hover:from-blue-600 group-hover:to-purple-700 transition-all duration-300">
            <Play className="text-white group-hover:scale-110 transition-transform duration-300 w-12 h-12" />
          </div>
        )}
        
        {typeof video.cover === 'string' && video.cover && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Play className="text-white w-12 h-12 drop-shadow-lg opacity-80" />
          </div>
        )}
        
        {video.duration && (
          <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm text-white text-xs px-2 py-1 rounded font-medium">
            {video.duration}
          </div>
        )}
        
        <div className="absolute top-2 right-2 flex gap-2 bg-white/90 backdrop-blur-sm rounded-full p-1.5 shadow-sm">
          {typeof video.cover === 'string' && video.cover && (
            <div className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center">
              THUMBNAIL
            </div>
          )}
          <CacheStatusIcon status={cacheStatus} />
        </div>
      </div>
      
      {/* 資訊 */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 line-clamp-1">{video.title}</h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">{video.description}</p>
        
        <div className="flex gap-2">
          <Button onClick={onPlay} className="flex-1 gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-xl text-sm">
            <Play size={14} />
            <span className="hidden xs:inline">播放影片</span>
            <span className="xs:hidden">播放</span>
          </Button>
          
          {cacheStatus?.cached ? (
            <Button onClick={onDeleteCache} variant="outline" className="gap-1 text-red-600 hover:bg-red-50 rounded-xl text-sm">
              <Trash2 size={14} />
              <span className="hidden sm:inline">刪除快取</span>
            </Button>
          ) : (
            <Button onClick={onDownload} variant="outline" disabled={cacheStatus?.downloading} className="gap-1 rounded-xl text-sm">
              {cacheStatus?.downloading ? (
                <>
                  <Loader className="animate-spin" size={14} />
                  <span className="hidden sm:inline">{Math.round(cacheStatus?.progress || 0)}%</span>
                </>
              ) : (
                <>
                  <Download size={14} />
                  <span className="hidden sm:inline">快取</span>
                </>
              )}
            </Button>
          )}
        </div>
        
        {cacheStatus?.error && (
          <div className="mt-2 text-red-600 text-xs bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2">
            {cacheStatus.error}
          </div>
        )}
      </div>
    </DataCard>
  );
}

// 快取狀態圖示
function CacheStatusIcon({ status }: { status?: { cached: boolean; downloading: boolean; error?: string } }) {
  if (!status) return null;
  if (status.downloading) return <Loader className="animate-spin text-blue-500" size={16} />;
  if (status.cached) return <CheckCircle className="text-green-500" size={16} />;
  if (status.error) return <AlertCircle className="text-red-500" size={16} />;
  return null;
}

// 快取管理
interface CacheManagerProps {
  cacheStats: { totalSize: number; cachedVideos: number; downloadingVideos: number };
  maxCacheSize: number;
  formatFileSize: (bytes: number) => string;
  onClearAll: () => void;
  videoCount: number;
}

function CacheManager({ cacheStats, maxCacheSize, formatFileSize, onClearAll, videoCount }: CacheManagerProps) {
  const usagePercent = Math.round((cacheStats.totalSize / maxCacheSize) * 100);

  return (
    <DataCard className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">快取管理</h2>
        <Button onClick={onClearAll} variant="ghost" className="gap-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
          <Trash2 size={16} />
          清空快取
        </Button>
      </div>
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <SimpleStatCard title="已快取影片" value={cacheStats.cachedVideos} bgColor="bg-blue-50 dark:bg-blue-900/20" textColor="text-blue-600 dark:text-blue-400" />
        <SimpleStatCard title="下載中" value={cacheStats.downloadingVideos} bgColor="bg-green-50 dark:bg-green-900/20" textColor="text-green-600 dark:text-green-400" />
        <SimpleStatCard title="總影片數" value={videoCount} bgColor="bg-purple-50 dark:bg-purple-900/20" textColor="text-purple-600 dark:text-purple-400" />
        <SimpleStatCard title="快取大小" value={formatFileSize(cacheStats.totalSize)} icon={<HardDrive size={14} />} bgColor="bg-orange-50 dark:bg-orange-900/20" textColor="text-orange-600 dark:text-orange-400" />
      </div>

      {/* 進度條 */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
          <span>快取使用量</span>
          <span className="font-medium">{formatFileSize(cacheStats.totalSize)} / {formatFileSize(maxCacheSize)}</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(usagePercent, 100)}%` }} />
        </div>
        <div className="text-right text-xs text-gray-500 dark:text-gray-400 mt-1">{usagePercent}% 已使用</div>
      </div>
      
      <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
        💡 <span className="font-medium">提示：</span>快取影片到本地可以減少網路流量使用，提升播放體驗。當快取超過限制時，系統會自動清理最舊的影片。
      </div>
    </DataCard>
  );
}
