"use client";

import { useState, useMemo, useRef } from "react";
import { Image as ImageIcon, Plus, Edit, Trash2, RefreshCw, X, Calendar, Upload, Search, ChevronDown, Download, FolderUp } from "lucide-react";
import { SectionHeader } from "@/components/ui/section-header";
import { StatCard } from "@/components/ui/stat-card";
import { DataCard } from "@/components/ui/data-card";
import { FullPageLoading } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useImages, ImageData } from "@/hooks";
import { API_ENDPOINTS } from "@/lib/constants";
import { formatLocalDate } from "@/lib/formatters";
import { getAppwriteHeaders } from "@/lib/utils";
import JSZip from "jszip";

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

export default function ImageGallery() {
  const { images, loading, error, loadImages } = useImages();
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingImage, setEditingImage] = useState<ImageData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0, status: '' });
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, status: '', success: 0, skipped: 0, failed: 0 });
  const importInputRef = useRef<HTMLInputElement>(null);

  // 搜尋過濾
  const filteredImages = useMemo(() => {
    if (!searchQuery.trim()) return images;
    const query = searchQuery.toLowerCase();
    return images.filter(image => 
      image.name?.toLowerCase().includes(query) ||
      image.note?.toLowerCase().includes(query) ||
      image.category?.toLowerCase().includes(query)
    );
  }, [images, searchQuery]);

  const handleEdit = (image: ImageData) => {
    setEditingImage(image);
    setShowForm(true);
  };

  const handleAdd = () => {
    setEditingImage(null);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingImage(null);
  };

  // Export all images as ZIP
  const handleExportZip = async () => {
    if (images.length === 0) {
      alert('沒有圖片可以匯出');
      return;
    }

    if (exporting) return;

    const confirm = window.confirm(`準備匯出 ${images.length} 張圖片至 ZIP 檔案，是否繼續？`);
    if (!confirm) return;

    setExporting(true);
    setExportProgress({ current: 0, total: images.length, status: '準備中...' });

    try {
      const zip = new JSZip();
      const imageFolder = zip.folder('images');
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        setExportProgress({ current: i + 1, total: images.length, status: `正在下載: ${image.name}` });

        if (!image.file) {
          console.warn(`跳過無圖片 URL: ${image.name}`);
          failCount++;
          continue;
        }

        try {
          // Fetch image as blob
          const response = await fetch(image.file);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          
          const blob = await response.blob();
          
          // Generate filename with category
          // Use filetype field if available, otherwise extract from URL
          const fileExtension = image.filetype || image.file.split('.').pop()?.split('?')[0] || 'jpg';
          const sanitizedName = image.name.replace(/[/\\?%*:|"<>]/g, '-');
          const categoryPrefix = image.category ? `[${image.category}]_` : '';
          
          // Check if name already has the correct extension to avoid double extension
          const nameHasExtension = sanitizedName.toLowerCase().endsWith(`.${fileExtension.toLowerCase()}`);
          const filename = nameHasExtension 
            ? `${categoryPrefix}${sanitizedName}`
            : `${categoryPrefix}${sanitizedName}.${fileExtension}`;
          
          // Add to zip
          imageFolder?.file(filename, blob);
          successCount++;
        } catch (error) {
          console.error(`下載失敗: ${image.name}`, error);
          failCount++;
        }
      }

      setExportProgress({ current: images.length, total: images.length, status: '正在壓縮...' });

      // Generate ZIP file
      const zipBlob = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      // Download ZIP
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      const timestamp = new Date().toISOString().split('T')[0];
      link.download = `appwrite-image.zip`;
      link.click();
      URL.revokeObjectURL(link.href);

      setExportProgress({ current: 0, total: 0, status: '' });
      alert(`匯出完成！\n成功: ${successCount} 張\n失敗: ${failCount} 張`);
    } catch (error) {
      console.error('ZIP export error:', error);
      alert('匯出失敗，請再試一次');
    } finally {
      setExporting(false);
      setExportProgress({ current: 0, total: 0, status: '' });
    }
  };

  // 計算檔案 SHA-256 hash
  const calculateFileHash = async (arrayBuffer: ArrayBuffer): Promise<string> => {
    try {
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.error('Hash calculation error:', error);
      return `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  };

  // Import images from ZIP
  const handleImportZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input
    if (importInputRef.current) {
      importInputRef.current.value = '';
    }

    if (!file.name.toLowerCase().endsWith('.zip')) {
      alert('請選擇 ZIP 檔案');
      return;
    }

    setImporting(true);
    setImportProgress({ current: 0, total: 0, status: '正在解壓縮 ZIP...', success: 0, skipped: 0, failed: 0 });

    try {
      const zip = await JSZip.loadAsync(file);
      
      // Find all image files in ZIP
      const imageFiles: { name: string; file: JSZip.JSZipObject }[] = [];
      const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
      
      zip.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir) {
          const ext = relativePath.split('.').pop()?.toLowerCase() || '';
          if (validExtensions.includes(ext)) {
            imageFiles.push({ name: relativePath, file: zipEntry });
          }
        }
      });

      if (imageFiles.length === 0) {
        alert('ZIP 檔案中沒有找到圖片檔案 (JPG, PNG, GIF, WEBP)');
        setImporting(false);
        return;
      }

      const confirmImport = window.confirm(`找到 ${imageFiles.length} 張圖片，是否開始匯入？`);
      if (!confirmImport) {
        setImporting(false);
        return;
      }

      let successCount = 0;
      let skippedCount = 0;
      let failedCount = 0;

      for (let i = 0; i < imageFiles.length; i++) {
        const imageFile = imageFiles[i];
        const fileName = imageFile.name.split('/').pop() || imageFile.name;
        
        setImportProgress({
          current: i + 1,
          total: imageFiles.length,
          status: `正在處理: ${fileName}`,
          success: successCount,
          skipped: skippedCount,
          failed: failedCount
        });

        try {
          // Extract image data
          const arrayBuffer = await imageFile.file.async('arraybuffer');

          // Create blob and file
          const ext = fileName.split('.').pop()?.toLowerCase() || 'jpg';
          const mimeType = ext === 'png' ? 'image/png' : 
                          ext === 'gif' ? 'image/gif' : 
                          ext === 'webp' ? 'image/webp' : 'image/jpeg';
          const blob = new Blob([arrayBuffer], { type: mimeType });
          const imageFileObj = new File([blob], fileName, { type: mimeType });

          // Upload to Appwrite Storage
          const formDataUpload = new FormData();
          formDataUpload.append('file', imageFileObj);

          const uploadResponse = await fetch('/api/upload-image', {
            method: 'POST',
            headers: getAppwriteHeaders(),
            body: formDataUpload,
          });

          if (!uploadResponse.ok) {
            throw new Error('上傳失敗');
          }

          const uploadData = await uploadResponse.json();

          // Create database record with simple fields
          const createUrl = addAppwriteConfigToUrl(API_ENDPOINTS.IMAGE);
          const createResponse = await fetch(createUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: fileName,        // 完整檔名（包含副檔名）
              file: uploadData.url,  // Appwrite Storage URL
              filetype: ext,         // 檔案格式
              note: '',              // 空
              ref: '',               // 空
              category: '',          // 空
              hash: '',              // 空
              cover: false           // false
            }),
          });

          if (!createResponse.ok) {
            throw new Error('建立記錄失敗');
          }

          successCount++;
        } catch (error) {
          console.error(`匯入失敗: ${fileName}`, error);
          failedCount++;
        }
      }

      setImportProgress({
        current: imageFiles.length,
        total: imageFiles.length,
        status: '完成',
        success: successCount,
        skipped: skippedCount,
        failed: failedCount
      });

      alert(`匯入完成！\n成功: ${successCount} 張\n失敗: ${failedCount} 張`);
      
      if (successCount > 0) {
        loadImages(true);
      }
    } catch (error) {
      console.error('ZIP import error:', error);
      alert('匯入失敗，請確認 ZIP 檔案格式正確');
    } finally {
      setImporting(false);
      setImportProgress({ current: 0, total: 0, status: '', success: 0, skipped: 0, failed: 0 });
    }
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <SectionHeader
        title="鋒兄圖片"
        subtitle={loading ? "載入中..." : `共 ${images.length} 張圖片`}
        showAccountLabel={true}
        action={
          <div className="flex gap-2 flex-wrap">
            <Button 
              onClick={handleExportZip} 
              disabled={loading || exporting || importing || images.length === 0}
              className="gap-2 bg-purple-500 hover:bg-purple-600 rounded-xl disabled:opacity-50"
              title="匯出所有圖片為 ZIP"
            >
              <Download size={16} className={exporting ? "animate-bounce" : ""} />
              <span className="hidden sm:inline">{exporting ? '匯出中...' : '匯出 ZIP'}</span>
            </Button>
            <Button 
              onClick={() => importInputRef.current?.click()} 
              disabled={loading || exporting || importing}
              className="gap-2 bg-orange-500 hover:bg-orange-600 rounded-xl disabled:opacity-50"
              title="從 ZIP 匯入圖片"
            >
              <FolderUp size={16} className={importing ? "animate-bounce" : ""} />
              <span className="hidden sm:inline">{importing ? '匯入中...' : '匯入 ZIP'}</span>
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept=".zip"
              onChange={handleImportZip}
              className="hidden"
            />
            <Button onClick={handleAdd} className="gap-2 bg-green-500 hover:bg-green-600 rounded-xl">
              <Plus size={16} />
              <span className="hidden sm:inline">新增圖片</span>
            </Button>
            <Button onClick={() => loadImages(true)} disabled={loading} className="gap-2 bg-blue-500 hover:bg-blue-600 rounded-xl">
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              <span className="hidden sm:inline">重新載入</span>
            </Button>
          </div>
        }
      />

      <ImageStats images={images} />

      {/* Export Progress Modal */}
      {exporting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">匯出圖片中...</h3>
            <div className="space-y-3">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {exportProgress.status}
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>進度</span>
                  <span>{exportProgress.current} / {exportProgress.total}</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div 
                    className="bg-purple-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${exportProgress.total > 0 ? (exportProgress.current / exportProgress.total) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Progress Modal */}
      {importing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">匯入圖片中...</h3>
            <div className="space-y-3">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {importProgress.status}
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>進度</span>
                  <span>{importProgress.current} / {importProgress.total}</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div 
                    className="bg-orange-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 text-xs text-center">
                <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-2">
                  <div className="font-bold text-green-600 dark:text-green-400">{importProgress.success}</div>
                  <div className="text-green-600/70 dark:text-green-400/70">成功</div>
                </div>
                <div className="bg-yellow-100 dark:bg-yellow-900/30 rounded-lg p-2">
                  <div className="font-bold text-yellow-600 dark:text-yellow-400">{importProgress.skipped}</div>
                  <div className="text-yellow-600/70 dark:text-yellow-400/70">跳過</div>
                </div>
                <div className="bg-red-100 dark:bg-red-900/30 rounded-lg p-2">
                  <div className="font-bold text-red-600 dark:text-red-400">{importProgress.failed}</div>
                  <div className="text-red-600/70 dark:text-red-400/70">失敗</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 搜尋欄位 */}
      {images.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            placeholder="搜尋圖片名稱、備註、分類..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 rounded-xl"
          />
        </div>
      )}

      {filteredImages.length === 0 && images.length > 0 ? (
        <EmptyState icon={<Search className="text-gray-400" size={32} />} title="無搜尋結果" description={`找不到「${searchQuery}」相關的圖片`} />
      ) : (
        <ImageGrid images={filteredImages} loading={loading} onSelectImage={setSelectedImage} onEdit={handleEdit} onRefresh={() => loadImages(true)} />
      )}
      
      {selectedImage && (
        <ImagePreviewModal image={selectedImage} onClose={() => setSelectedImage(null)} />
      )}

      {showForm && (
        <ImageFormModal image={editingImage} existingImages={images} onClose={handleCloseForm} onSuccess={() => loadImages(true)} />
      )}
    </div>
  );
}

// 統計卡片
function ImageStats({ images }: { images: ImageData[] }) {
  const totalImages = images.length;

  return (
    <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 sm:gap-4">
      <StatCard title="總圖片數" value={totalImages} icon={ImageIcon} gradient="from-blue-500 to-blue-600" />
      <StatCard title="Appwrite 儲存" value={totalImages} iconElement={<span className="text-2xl">☁️</span>} gradient="from-purple-500 to-purple-600" />
    </div>
  );
}

// 圖片網格
function ImageGrid({ images, loading, onSelectImage, onEdit, onRefresh }: { images: ImageData[]; loading: boolean; onSelectImage: (img: ImageData) => void; onEdit: (img: ImageData) => void; onRefresh: () => void }) {
  if (loading) return <FullPageLoading text="載入圖片中..." />;
  if (images.length === 0) return <EmptyState icon={<ImageIcon className="text-gray-400" size={32} />} title="沒有找到圖片" />;

  return (
    <DataCard className="p-3 sm:p-4 lg:p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {images.map((image) => (
          <ImageCard key={image.$id} image={image} onSelect={() => onSelectImage(image)} onEdit={() => onEdit(image)} onRefresh={onRefresh} />
        ))}
      </div>
    </DataCard>
  );
}

// 單張圖片卡片
function ImageCard({ image, onSelect, onEdit, onRefresh }: { image: ImageData; onSelect: () => void; onEdit: () => void; onRefresh: () => void }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`確定要刪除圖片 "${image.name}" 嗎?`)) return;

    setDeleting(true);
    try {
      const url = addAppwriteConfigToUrl(`${API_ENDPOINTS.IMAGE}/${image.$id}`);
      const response = await fetch(url, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('刪除失敗');
      onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : '刪除失敗');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="group relative bg-white dark:bg-gray-800 rounded-xl overflow-hidden hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700">
      {/* 圖片預覽區 */}
      <div 
        className="relative aspect-video bg-gray-100 dark:bg-gray-700 overflow-hidden cursor-pointer" 
        onClick={onSelect}
      >
        {image.file ? (
          <img 
            src={image.file} 
            alt={image.name} 
            className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500" 
            loading="lazy" 
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4 text-center">
            <div className="bg-white/80 dark:bg-gray-800/80 p-3 rounded-full shadow-sm">
              <ImageIcon className="text-gray-400 w-6 h-6" />
            </div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">無圖片</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* 分類標籤 */}
        {image.category && (
          <div className="absolute top-2 left-2">
            <span className="px-2 py-1 text-xs font-medium bg-blue-500/90 text-white rounded-md backdrop-blur-sm">
              {image.category}
            </span>
          </div>
        )}
      </div>
      
      {/* 資訊區 */}
      <div className="p-3 sm:p-4">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base truncate mb-2" title={image.name}>
          {image.name}
        </h3>
        
        {image.note && (
          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">{image.note}</p>
        )}
        
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-3">
          <Calendar className="w-3 h-3" />
          <span>{formatLocalDate(image.$createdAt)}</span>
        </div>

        {/* 操作按鈕 */}
        <div className="flex gap-2">
          <Button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="flex-1 gap-1 bg-blue-500 hover:bg-blue-600 rounded-lg text-xs py-1.5"
          >
            <Edit size={14} />
            編輯
          </Button>
          <Button
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 gap-1 bg-red-500 hover:bg-red-600 rounded-lg text-xs py-1.5"
          >
            <Trash2 size={14} />
            {deleting ? '刪除中...' : '刪除'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// 圖片預覽模態框
function ImagePreviewModal({ image, onClose }: { image: ImageData; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div className="relative w-full h-full max-w-7xl max-h-screen flex flex-col">
        {/* 頂部控制欄 */}
        <div className="absolute top-2 sm:top-4 right-2 sm:right-4 z-10">
          <button onClick={onClose} className="p-2.5 bg-black/80 backdrop-blur-sm rounded-lg text-white hover:bg-black/95 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* 圖片 - 置中顯示 */}
        <div className="flex-1 flex items-center justify-center p-12 sm:p-16">
          {image.file ? (
            <img 
              src={image.file} 
              alt={image.name} 
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" 
              onClick={(e) => e.stopPropagation()} 
            />
          ) : (
            <div className="text-white text-center">
              <ImageIcon className="mx-auto mb-4 w-24 h-24" />
              <p>沒有圖片 URL</p>
            </div>
          )}
        </div>
        
        {/* 底部資訊欄 */}
        <div className="absolute bottom-2 sm:bottom-4 left-2 sm:left-4 right-2 sm:right-4">
          <div className="bg-black/80 backdrop-blur-sm rounded-xl p-3 sm:p-4 text-white">
            <h3 className="font-medium mb-2">{image.name}</h3>
            {image.note && <p className="text-sm opacity-90 mb-2">{image.note}</p>}
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formatLocalDate(image.$createdAt)}
              </span>
              {image.category && <span>分類: {image.category}</span>}
              {image.ref && <span>參考: {image.ref}</span>}
              <span className="ml-auto text-xs opacity-75">點擊空白處關閉</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 圖片表單模態框
function ImageFormModal({ image, existingImages, onClose, onSuccess }: { image: ImageData | null; existingImages: ImageData[]; onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: image?.name || '',
    file: image?.file || '',
    filetype: image?.filetype || '',
    note: image?.note || '',
    ref: image?.ref || '',
    category: image?.category || '',
    hash: image?.hash || '',
    cover: false, // 一律為 false
  });
  const [submitting, setSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [fileHash, setFileHash] = useState<string>(''); // 儲存檔案 hash
  const [duplicateWarning, setDuplicateWarning] = useState<string>(''); // 重複警告
  const [useCategorySelect, setUseCategorySelect] = useState(true); // 是否使用選擇框

  // 獲取所有已存在的分類
  const existingCategories = Array.from(new Set(existingImages.map(img => img.category).filter(Boolean)));

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
      alert('檔案大小不能超過 50MB');
      return;
    }

    // 檢查檔案類型
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('只支援 JPG, PNG, GIF, WEBP 格式的圖片');
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
    
    // 取得檔案類型（副檔名）
    const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
    const filetype = fileExt; // e.g., 'png', 'jpg', 'gif', 'webp'
    
    // 一次性更新 formData（包含名稱、hash 和 filetype）
    // 使用完整檔案名稱（包含副檔名）作為預設名稱
    setFormData(prev => ({
      ...prev,
      name: prev.name.trim() ? prev.name : file.name, // 如果當前名稱為空才自動填入完整檔名
      hash: hash,
      filetype: filetype
    }));
    
    // 檢查是否有重複的 hash
    const duplicateImage = existingImages.find(img => 
      img.hash === hash && (!image || img.$id !== image.$id)
    );
    
    if (duplicateImage) {
      setDuplicateWarning(`警告：此圖片與「${duplicateImage.name}」相同，請勿重複上傳！`);
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
      const response = await fetch('/api/upload-image', {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('請輸入圖片名稱');
      return;
    }

    // 檢查是否有重複
    if (duplicateWarning) {
      alert('此圖片與既有圖片重複，無法上傳！請選擇其他圖片。');
      return;
    }

    setSubmitting(true);
    try {
      let finalFormData = { ...formData };

      // 如果有選擇新檔案，先上傳到 Appwrite
      if (selectedFile) {
        const { url, fileId } = await uploadFileToAppwrite(selectedFile);
        finalFormData.file = url;
        // 使用已計算的 hash，如果沒有則使用 fileId
        finalFormData.hash = fileHash || fileId;
      } else if (!image && !formData.hash) {
        // 新增且沒有檔案也沒有 hash 的情況，生成一個備用 hash
        finalFormData.hash = `no_file_${Date.now()}`;
      }

      const url = image 
        ? addAppwriteConfigToUrl(`${API_ENDPOINTS.IMAGE}/${image.$id}`) 
        : addAppwriteConfigToUrl(API_ENDPOINTS.IMAGE);
      const method = image ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalFormData),
      });

      if (!response.ok) throw new Error(image ? '更新失敗' : '新增失敗');
      
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
            {image ? '編輯圖片' : '新增圖片'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              圖片名稱 <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="請輸入圖片名稱"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              圖片 URL 或上傳檔案
            </label>
            <div className="space-y-3">
              <Input
                value={formData.file}
                onChange={(e) => setFormData({ ...formData, file: e.target.value })}
                placeholder="https://example.com/image.jpg"
                disabled={submitting}
              />
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">或</span>
                <label className="flex-1">
                  <div className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg cursor-pointer transition-colors">
                    <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      {previewLoading ? '載入中...' : selectedFile ? `已選擇: ${selectedFile.name}` : '上傳圖片 (最大 50MB)'}
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    onChange={handleFileSelect}
                    disabled={submitting || previewLoading}
                    className="hidden"
                  />
                </label>
              </div>
              {previewUrl && (
                <div className="mt-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">預覽：</p>
                  <img src={previewUrl} alt="Preview" className="max-h-48 rounded-lg border border-gray-200 dark:border-gray-700" />
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

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              備註
            </label>
            <Textarea
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              placeholder="圖片備註說明"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                分類
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
                    <SelectTrigger>
                      <SelectValue placeholder="選擇分類" />
                    </SelectTrigger>
                    <SelectContent>
                      {existingCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                      <SelectItem value="__custom__">自行輸入...</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="輸入新分類"
                  />
                  {existingCategories.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setUseCategorySelect(true)}
                      className="text-xs h-7"
                    >
                      從現有分類中選擇
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                參考
              </label>
              <Input
                value={formData.ref}
                onChange={(e) => setFormData({ ...formData, ref: e.target.value })}
                placeholder="參考資訊"
              />
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

          <div className="flex gap-3 pt-4">
            <Button type="button" onClick={onClose} className="flex-1 bg-gray-500 hover:bg-gray-600 rounded-xl">
              取消
            </Button>
            <Button 
              type="submit" 
              disabled={submitting || !!duplicateWarning} 
              className="flex-1 bg-blue-500 hover:bg-blue-600 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? '處理中...' : (image ? '更新' : '新增')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
