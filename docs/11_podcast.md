# 鋒兄播客 (Podcast)

## 功能概述

播客管理與播放系統，同時支援音訊與視訊格式的 Podcast 內容，提供離線快取與批次管理。

## 主要特點

- **音訊/視訊播放**：Plyr 播放器同時支援音訊與視訊格式的 Podcast。
- **進度控制**：支援播放進度條跳轉。
- **離線快取**：快取至 IndexedDB，離線收聽/觀看。
- **分類管理**：依播客系列組織內容。
- **封面圖設定**：上傳播客封面圖片。
- **刪除確認**：刪除前需輸入確認文字「DELETE [播客名稱]」，防止誤刪。
- **批次 ZIP 操作**：ZIP 匯入匯出播客。

## 資料表結構 (Appwrite Collection: `podcast`)

| 欄位名稱 | 類型 | 長度 | 必填 | 說明 |
|----------|------|------|------|------|
| name | string | 100 | ✅ | 播客名稱 |
| file | string | 150 | ❌ | Storage 檔案 ID |
| filetype | string | 20 | ❌ | 檔案類型 |
| note | string | 100 | ❌ | 備註 |
| ref | string | 100 | ❌ | 參考資料 |
| category | string | 100 | ❌ | 分類 |
| hash | string | 300 | ❌ | 檔案雜湊 |
| cover | string | 150 | ❌ | 封面圖 Storage File ID |

## 支援的媒體格式

| 類型 | 格式 |
|------|------|
| 音訊 | MP3、M4A、WAV、OGG、FLAC、AAC、WEBA |
| 視訊 | MP4、WEBM、MOV |

## 離線快取

- 快取儲存：IndexedDB
- 快取上限：**500MB**
- 同時支援音訊與視訊格式的離線播放

## API 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/podcast` | 取得所有播客 |
| POST | `/api/podcast` | 新增播客 |
| GET | `/api/podcast/[id]` | 取得單筆播客 |
| PUT | `/api/podcast/[id]` | 更新播客 |
| DELETE | `/api/podcast/[id]` | 刪除播客 |
| POST | `/api/upload-podcast` | 上傳播客至 Storage |

## 技術規格

- **元件路徑**：`components/modules/PodcastManagement.tsx`
- **播放器元件**：`components/ui/plyr-player.tsx`
- **快取 Hook**：`hooks/usePodcastCache.ts`
- **API 路徑**：`app/api/podcast/`
- **常數定義**：`lib/constants.ts` → `API_ENDPOINTS.PODCAST`
