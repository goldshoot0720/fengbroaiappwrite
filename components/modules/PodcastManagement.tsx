"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Podcast as PodcastIcon, Plus, Edit, Trash2, X, Upload, Calendar, Play, Pause, Search, ChevronDown, Repeat, HardDrive, Check } from "lucide-react";
import { usePodcast, PodcastData } from "@/hooks/usePodcast";
import { usePodcastCache } from "@/hooks/usePodcastCache";
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
import { API_ENDPOINTS } from "@/lib/constants";
import { formatLocalDate } from "@/lib/formatters";
import { getAppwriteHeaders, getProxiedMediaUrl } from "@/lib/utils";
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

// Helper function to detect if a file is a video
function isVideoFile(fileUrlOrName: string): boolean {
  if (!fileUrlOrName) return false;
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.m4v'];
  const lowercase = fileUrlOrName.toLowerCase();
  return videoExtensions.some(ext => lowercase.endsWith(ext) || lowercase.includes(`mime=video/`) || lowercase.includes('video%2F'));
}

export default function PodcastManagement() {
  const { podcast, loading, error, stats, loadPodcast } = usePodcast();
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingPodcast, setEditingPodcast] = useState<PodcastData | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedPodcastId, setExpandedPodcastId] = useState<string | null>(null);

  // 播客快取管理
  const {
    cacheStatus,
    cacheStats,
    downloadAndCachePodcast,
    deletePodcastCache,
    clearAllCache,
    updateCacheStats,
    formatFileSize,
    maxCacheSize,
  } = usePodcastCache();

  useEffect(() => {
    updateCacheStats();
  }, [updateCacheStats]);

  // 搜尋過濾
  const filteredPodcast = useMemo(() => {
    if (!searchQuery.trim()) return podcast;
    const query = searchQuery.toLowerCase();
    return podcast.filter(item => 
      item.name?.toLowerCase().includes(query)
    );
  }, [podcast, searchQuery]);

  const handleAdd = () => {
    setEditingPodcast(null);
    setShowFormModal(true);
  };

  const handleEdit = (podcastItem: PodcastData) => {
    setEditingPodcast(podcastItem);
    setShowFormModal(true);
  };

  const handleDelete = async (podcastItem: PodcastData) => {
    const confirmText = `DELETE ${podcastItem.name}`;
    const userInput = prompt(`確定要刪除播客「${podcastItem.name}」嗎？\n\n請輸入以下文字以確認刪除：\n${confirmText}`);
    
    if (userInput !== confirmText) {
      if (userInput !== null) {
        alert('輸入不正確，刪除已取消');
      }
      return;
    }

    try {
      const url = addAppwriteConfigToUrl(`${API_ENDPOINTS.PODCAST}/${podcastItem.$id}`);
      const response = await fetch(url, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('刪除失敗');
      loadPodcast(true);
    } catch (error) {
      alert(error instanceof Error ? error.message : '刪除失敗');
    }
  };

  const handleFormSuccess = () => {
    setShowFormModal(false);
    setEditingPodcast(null);
    loadPodcast(true);
  };

  const togglePlay = (id: string) => {
    setPlayingId(playingId === id ? null : id);
  };

  if (loading) {
    return (
      <div className="space-y-4 lg:space-y-6">
        <SectionHeader title="鋒兄播客" subtitle="播客管理" showAccountLabel={true} />
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
        title="鋒兄播客"
        subtitle="管理播客收藏"
        showAccountLabel={true}
        action={
          <Button onClick={handleAdd} className="gap-2 bg-blue-500 hover:bg-blue-600 rounded-xl">
            <Plus size={16} />
            新增播客
          </Button>
        }
      />

      {/* 統計卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="播客總數" value={stats.total} icon={PodcastIcon} />
        <StatCard title="已快取" value={cacheStats.cachedPodcasts} icon={Check} />
        <StatCard title="快取大小" value={formatFileSize(cacheStats.totalSize)} icon={HardDrive} />
      </div>

      {/* 搜尋欄位 */}
      {podcast.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            placeholder="搜尋播客名稱..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 rounded-xl"
          />
        </div>
      )}

      {/* 播客列表 */}
      {podcast.length === 0 ? (
        <EmptyState
          icon={<PodcastIcon className="w-12 h-12" />}
          title="尚無播客"
          description="點擊上方「新增播客」按鈕新增第一首播客"
        />
      ) : filteredPodcast.length === 0 ? (
        <EmptyState
          icon={<Search className="w-12 h-12" />}
          title="無搜尋結果"
          description={`找不到「${searchQuery}」相關的播客`}
        />
      ) : (
        <div className="space-y-3">
          {/* 操作提示 */}
          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 px-1">
            <PodcastIcon className="w-3.5 h-3.5" />
            <span>點擊封面圖或卡片顯示詳情</span>
          </div>
          {filteredPodcast.map((podcastItem) => (
            <PodcastCard
              key={podcastItem.$id}
              podcast={podcastItem}
              isPlaying={playingId === podcastItem.$id}
              isExpanded={expandedPodcastId === podcastItem.$id}
              onPlay={() => togglePlay(podcastItem.$id)}
              onToggleExpand={() => setExpandedPodcastId(expandedPodcastId === podcastItem.$id ? null : podcastItem.$id)}
              onEdit={() => handleEdit(podcastItem)}
              onDelete={() => handleDelete(podcastItem)}
              cacheStatus={cacheStatus}
              downloadAndCachePodcast={downloadAndCachePodcast}
            />
          ))}
        </div>
      )}

      {/* 快取管理 */}
      {podcast.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">快取管理</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                已使用 {formatFileSize(cacheStats.totalSize)} / {formatFileSize(maxCacheSize)}
              </p>
            </div>
            <Button onClick={clearAllCache} variant="outline" className="rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" disabled={cacheStats.cachedPodcasts === 0}>
              清空快取
            </Button>
          </div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-cyan-500 to-cyan-600 transition-all duration-300" style={{ width: `${Math.min((cacheStats.totalSize / maxCacheSize) * 100, 100)}%` }} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">已快取播客：</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">{cacheStats.cachedPodcasts} / {podcast.length}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">下載中：</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">{cacheStats.downloadingPodcasts}</span>
            </div>
          </div>
        </div>
      )}

      {/* 表單模態框 */}
      {showFormModal && (
        <PodcastFormModal
          podcast={editingPodcast}
          existingPodcast={podcast}
          onClose={() => {
            setShowFormModal(false);
            setEditingPodcast(null);
          }}
          onSuccess={handleFormSuccess}
        />
      )}
    </div>
  );
}

// 播客卡片
interface MusicCardProps {
  podcast: PodcastData;
  isPlaying: boolean;
  isExpanded: boolean;
  onPlay: () => void;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  cacheStatus: any;
  downloadAndCachePodcast: (podcast: any, onProgress?: (progress: number) => void) => Promise<void>;
}

function PodcastCard({ podcast, isPlaying, isExpanded, onPlay, onToggleExpand, onEdit, onDelete, cacheStatus, downloadAndCachePodcast }: MusicCardProps) {
  const [isLooping, setIsLooping] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const { checkPodcastCache } = usePodcastCache();

  // 檢查快取狀態
  useEffect(() => {
    const checkCache = async () => {
      const cached = await checkPodcastCache(podcast.$id);
      setIsCached(cached);
    };
    checkCache();
  }, [podcast.$id, checkPodcastCache]);

  const podcastCacheStatus = cacheStatus[podcast.$id];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 group border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={onToggleExpand}>
        {/* 封面 */}
        <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 group/cover">
          {podcast.cover ? (
            <img src={podcast.cover} alt={podcast.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <PodcastIcon className="text-white w-10 h-10 drop-shadow-lg" />
            </div>
          )}
          {/* 點擊提示 */}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/cover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="text-center text-white text-[10px] font-medium px-1">
              <ChevronDown className={`w-4 h-4 mx-auto mb-0.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              <span>詳情</span>
            </div>
          </div>
        </div>

        {/* 資訊區 */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-base text-gray-900 dark:text-gray-100 truncate">{podcast.name}</h3>
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                <Calendar className="w-3 h-3" />
                {formatLocalDate(podcast.$createdAt)}
              </div>
            </div>
            
            {/* 標籤 */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {podcast.category && (
                <span className="px-2.5 py-1 text-xs font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full">
                  {podcast.category}
                </span>
              )}
            </div>
          </div>

          {/* 播放器或占位 */}
          {podcast.file ? (
            <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2">
                <PlyrPlayer 
                  type={isVideoFile(podcast.file) ? "video" : "audio"}
                  src={getProxiedMediaUrl(podcast.file)}
                  loop={isLooping}
                  className="w-full"
                />
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-400 dark:text-gray-500">
              尚未上傳播客檔案
            </div>
          )}
        </div>

        {/* 操作按鈕 */}
        <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {podcast.file && (
            <>
              <button
                onClick={() => setIsLooping(!isLooping)}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  isLooping 
                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                title={isLooping ? '重複播放' : '單次播放'}
              >
                <Repeat className="w-4 h-4" />
              </button>
              <button
                onClick={async () => {
                  await downloadAndCachePodcast({
                    $id: podcast.$id,
                    name: podcast.name,
                    file: getProxiedMediaUrl(podcast.file),
                    cover: podcast.cover,
                    category: podcast.category
                  });
                  setIsCached(true);
                }}
                disabled={isCached || podcastCacheStatus?.downloading}
                className={`p-2 rounded-lg transition-all duration-200 relative ${
                  isCached || podcastCacheStatus?.cached
                    ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 cursor-default'
                    : podcastCacheStatus?.downloading
                    ? 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-500 cursor-wait'
                    : 'bg-gray-100 dark:bg-gray-700 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20'
                }`}
                title={
                  isCached || podcastCacheStatus?.cached
                    ? '已快取'
                    : podcastCacheStatus?.downloading
                    ? `下載中 ${Math.round(podcastCacheStatus.progress)}%`
                    : '快取到本地'
                }
              >
                {isCached || podcastCacheStatus?.cached ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <HardDrive className="w-4 h-4" />
                )}
                {podcastCacheStatus?.downloading && (
                  <span className="absolute -bottom-1 -right-1 text-[8px] bg-cyan-600 text-white rounded-full px-1">
                    {Math.round(podcastCacheStatus.progress)}%
                  </span>
                )}
              </button>
            </>
          )}
          <button
            onClick={onEdit}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200"
            title="編輯"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
            title="刪除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 展開的詳細資訊 */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
          {/* 大封面 */}
          <div className="flex justify-center">
            <div className="relative w-full max-w-sm aspect-square rounded-xl overflow-hidden bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 shadow-xl">
              {podcast.cover ? (
                <img src={podcast.cover} alt={podcast.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <PodcastIcon className="text-white w-32 h-32 drop-shadow-2xl" />
                </div>
              )}
            </div>
          </div>

          {/* 標題和標籤 */}
          <div className="text-center space-y-2">
            <h3 className="font-bold text-xl text-gray-900 dark:text-gray-100">{podcast.name}</h3>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {podcast.category && (
                <span className="px-3 py-1 text-xs font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full">
                  {podcast.category}
                </span>
              )}
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <Calendar className="w-3 h-3" />
                {formatLocalDate(podcast.$createdAt)}
              </div>
            </div>
          </div>

          {/* 備註 */}
          {podcast.note && (
            <div>
              <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2">備註</h4>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                <p className="text-sm text-gray-700 dark:text-gray-300">{podcast.note}</p>
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

// 播客表單模態框
function PodcastFormModal({ podcast, existingPodcast, onClose, onSuccess }: { podcast: PodcastData | null; existingPodcast: PodcastData[]; onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: podcast?.name || '',
    file: podcast?.file || '',
    note: podcast?.note || '',
    ref: podcast?.ref || '',
    category: podcast?.category || '',
    hash: podcast?.hash || '',
    cover: podcast?.cover || '',
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
  const existingCategories = Array.from(new Set(existingPodcast.map(m => m.category).filter(Boolean)));

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
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('播客檔案大小不能超過 50MB');
      return;
    }

    // 檢查檔案類型
    const validAudioTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/flac', 'audio/m4a', 'audio/x-m4a', 'audio/mp4'];
    const validVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
    const validTypes = [...validAudioTypes, ...validVideoTypes];
    
    if (!validTypes.includes(file.type)) {
      alert('只支援 MP3, WAV, OGG, AAC, FLAC, M4A 格式的音訊，或 MP4, WebM, MOV 格式的影片');
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
    const duplicatePodcast = existingPodcast.find(m => 
      m.hash === hash && (!podcast || m.$id !== podcast.$id)
    );
    
    if (duplicatePodcast) {
      setDuplicateWarning(`警告：此播客與「${duplicatePodcast.name}」相同，請勿重複上傳！`);
    }
    
    // 模擬預覽載入完成
    setTimeout(() => setPreviewLoading(false), 300);
  };

  const uploadFileToAppwrite = async (file: File): Promise<{ url: string; fileId: string }> => {
    setUploadStatus('uploading');
    setUploadProgress(0);

    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    // 模擬上傳進度
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) return prev;
        return prev + 10;
      });
    }, 200);

    try {
      const response = await fetch('/api/upload-podcast', {
        method: 'POST',
        headers: getAppwriteHeaders(),
        body: formDataUpload,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        let errorMessage = '上傳失敗';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch (parseError) {
          // If response is not JSON, use status text
          errorMessage = `${errorMessage} (${response.status}: ${response.statusText})`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setUploadStatus('success');
      return { url: data.url, fileId: data.fileId || '' };
    } catch (error) {
      clearInterval(progressInterval);
      setUploadStatus('error');
      throw error;
    }
  };

  const handleCoverFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 檢查檔案大小 (50MB for cover images)
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

    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    // 模擬上傳進度
    const progressInterval = setInterval(() => {
      setCoverUploadProgress(prev => {
        if (prev >= 90) return prev;
        return prev + 10;
      });
    }, 200);

    try {
      const response = await fetch('/api/upload-image', {
        method: 'POST',
        headers: getAppwriteHeaders(),
        body: formDataUpload,
      });

      clearInterval(progressInterval);
      setCoverUploadProgress(100);

      if (!response.ok) {
        let errorMessage = '封面圖上傳失敗';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch (parseError) {
          // If response is not JSON, use status text
          errorMessage = `${errorMessage} (${response.status}: ${response.statusText})`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setCoverUploadStatus('success');
      return { url: data.url, fileId: data.fileId || '' };
    } catch (error) {
      clearInterval(progressInterval);
      setCoverUploadStatus('error');
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('請輸入播客名稱');
      return;
    }

    // 檢查是否有重複
    if (duplicateWarning) {
      alert('此播客與既有播客重複，無法上傳！請選擇其他播客。');
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
          throw new Error(`播客上傳失敗: ${uploadError instanceof Error ? uploadError.message : '未知錯誤'}`);
        }
      } else if (!podcast && !formData.hash) {
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

      const apiUrl = podcast 
        ? addAppwriteConfigToUrl(`${API_ENDPOINTS.PODCAST}/${podcast.$id}`) 
        : addAppwriteConfigToUrl(API_ENDPOINTS.PODCAST);
      const method = podcast ? 'PUT' : 'POST';

      const response = await fetch(apiUrl, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalFormData),
      });

      if (!response.ok) throw new Error(podcast ? '更新失敗' : '新增失敗');

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
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {podcast ? '編輯播客' : '新增播客'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              播客名稱 / Podcast Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="請輸入播客名稱 / Podcast Name"
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
              播客檔案 / Podcast File (URL or Upload)
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
                      {previewLoading ? '載入中...' : selectedFile ? `已選擇: ${selectedFile.name}` : '上傳播客 (最大 50MB) / Upload (Max 50MB)'}
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="audio/*,video/mp4,video/webm,video/quicktime,.m4a"
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
                  {isVideoFile(selectedFile?.name || formData.file) ? (
                    <video src={previewUrl} controls className="w-full rounded-lg" />
                  ) : (
                    <audio src={previewUrl} controls className="w-full" />
                  )}
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
                      {coverPreviewLoading ? '載入中...' : selectedCoverFile ? `已選擇: ${selectedCoverFile.name}` : '上傳封面圖 (最大 50MB) / Upload Cover (Max 50MB)'}
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
              placeholder="播客備註說明 / Podcast Note"
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
              {submitting ? '處理中...' : (podcast ? '更新' : '新增')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
