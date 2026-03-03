# 鋒兄圖片 (Images)

## 功能概述

圖片管理與藝廊系統，支援上傳、分類、預覽、批次 ZIP 匯入匯出與離線快取。

## 主要特點

- **圖片藝廊**：卡片式網格佈局展示所有圖片。
- **全螢幕預覽**：點擊圖片開啟全螢幕檢視。
- **分類管理**：依分類組織圖片，支援快速篩選。
- **批次 ZIP 操作**：ZIP 匯出所有圖片（含分類前綴命名）、ZIP 匯入批次上傳。
- **雜湊重複檢測**：透過 hash 防止重複上傳。
- **離線快取**：下載後儲存在 IndexedDB，離線可瀏覽。
- **響應式網格**：自動適應不同螢幕尺寸。

## 資料表結構 (Appwrite Collection: `image`)

| 欄位名稱 | 類型 | 長度 | 必填 | 預設值 | 說明 |
|----------|------|------|------|--------|------|
| name | string | 100 | ✅ | - | 圖片名稱 |
| file | string | 150 | ❌ | - | Storage 檔案 ID |
| filetype | string | 20 | ❌ | - | 檔案類型 (jpg/png/gif/webp) |
| note | string | 100 | ❌ | - | 備註 |
| ref | string | 100 | ❌ | - | 參考資料 |
| category | string | 100 | ❌ | - | 分類 |
| hash | string | 300 | ❌ | - | 檔案雜湊 (重複檢測) |
| cover | boolean | - | ❌ | false | 是否為封面圖 |

## 支援的圖片格式

| 格式 | MIME 類型 |
|------|----------|
| JPG/JPEG | image/jpeg |
| PNG | image/png |
| GIF | image/gif |
| WEBP | image/webp |

## 離線快取

- 快取儲存：IndexedDB
- 快取上限：**500MB**
- 超過上限時自動清除最舊快取
- 離線時可瀏覽已快取的圖片

## API 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/image` | 取得所有圖片記錄 |
| POST | `/api/image` | 新增圖片記錄 |
| GET | `/api/image/[id]` | 取得單筆圖片 |
| PUT | `/api/image/[id]` | 更新圖片 |
| DELETE | `/api/image/[id]` | 刪除圖片 |
| GET | `/api/images` | 列出 Storage 中的所有圖片檔案 |
| POST | `/api/upload-image` | 上傳圖片至 Storage |

## 技術規格

- **元件路徑**：`components/modules/ImageGallery.tsx`
- **API 路徑**：`app/api/image/`、`app/api/images/`、`app/api/upload-image/`
- **檔案限制**：50MB
- **常數定義**：`lib/constants.ts` → `API_ENDPOINTS.IMAGE`

---

## 相關文件

- [選單索引](./INDEX.md) - 返回文件總覽
- [影片管理](./08_videos.md) - 影片播放與佇列功能
- [音樂管理](./09_music.md) - 音樂播放與歌詞顯示
- [系統設定](./14_settings.md) - 快取與儲存空間管理
- [使用手冊](./USER_GUIDE.md) - 第八章：圖片管理詳細教學
