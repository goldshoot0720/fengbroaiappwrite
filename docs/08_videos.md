# 鋒兄影片 (Videos)

## 功能概述

影片管理與播放系統，支援串流播放（HTTP Range）、播放佇列、離線快取與批次 ZIP 匯入匯出。

## 主要特點

- **內建播放器**：使用 Plyr 播放器，支援跳轉、進度控制與全螢幕。
- **三皮播放介面**：Netflix / YouTube / Bilibili 皆為極簡控制（上一則、下一則、自動播放、重複、關閉）；無假社交按鈕；列表模式決定開啟哪套播放器。
- **列表三皮外殼**：Netflix（分類橫列 + 精選 hero）、YouTube（首頁網格）、Bilibili（密網格）；管理操作（佇列 / 快取 / 編輯 / 刪除）改為懸停或聚焦顯示，預設畫面保持瀏覽感。
- **播放佇列面板**：固定 dock 中性色（非藍）、進度與列表操作保留；收合迷你卡 + 展開「接下來播放」。
- **串流播放**：透過 HTTP Range 請求快速跳轉，無需等待完整下載。
- **媒體代理**：透過 Media Proxy 確保播放流暢。
- **播放佇列**：立即播放 / 加入佇列 / 移除 / 排序，自動播放下一部。
- **離線快取**：影片快取至 IndexedDB，離線播放。
- **封面圖設定**：上傳或設定影片封面縮圖。
- **分類管理**：依分類組織影片。
- **批次 ZIP 操作**：ZIP 匯入匯出影片。

## 資料表結構 (Appwrite Collection: `video`)

| 欄位名稱 | 類型 | 長度 | 必填 | 說明 |
|----------|------|------|------|------|
| name | string | 100 | ✅ | 影片名稱 |
| file | string | 150 | ❌ | Storage 檔案 ID |
| filetype | string | 20 | ❌ | 檔案類型 (mp4/webm/mov) |
| note | string | 100 | ❌ | 備註說明 |
| ref | string | 100 | ❌ | 參考資料 |
| category | string | 100 | ❌ | 分類 |
| hash | string | 300 | ❌ | 檔案雜湊 |
| cover | string | 150 | ❌ | 封面圖 Storage File ID |

## 播放佇列功能

| 操作 | 說明 |
|------|------|
| 立即播放 | 直接播放選定影片 |
| 加入佇列 | 將影片加入播放清單末端 |
| 移除 | 從佇列中移除影片 |
| 排序 | 調整佇列中的播放順序 |
| 自動播放 | 影片播放結束後自動播放下一部 |

## 離線快取

- 快取儲存：IndexedDB
- 快取上限：**500MB**
- 下載時顯示進度百分比
- 超過上限自動清除最舊影片

## API 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/video` | 取得所有影片記錄 |
| POST | `/api/video` | 新增影片記錄 |
| GET | `/api/video/[id]` | 取得單筆影片 |
| PUT | `/api/video/[id]` | 更新影片 |
| DELETE | `/api/video/[id]` | 刪除影片 |
| GET | `/api/videos/[filename]` | 串流播放影片檔案 |
| POST | `/api/upload-video` | 上傳影片至 Storage |
| GET | `/api/media-proxy` | 媒體代理 (解決跨域與 Range 問題) |

## 技術規格

- **元件路徑**：`components/modules/VideoIntroduction.tsx`
- **播放器元件**：`components/ui/enhanced-video-player.tsx`、`components/ui/plyr-player.tsx`
- **佇列面板**：`components/ui/video-queue-panel.tsx`
- **快取 Hook**：`hooks/useVideoCache.ts`
- **API 路徑**：`app/api/video/`、`app/api/videos/`
- **常數定義**：`lib/constants.ts` → `API_ENDPOINTS.VIDEO`

---

## 相關文件

- [選單索引](./INDEX.md) - 返回文件總覽
- [音樂管理](./09_music.md) - 音樂播放與佇列功能
- [播客管理](./11_podcast.md) - 音訊/視訊播客管理
- [系統設定](./14_settings.md) - 快取與儲存空間管理
- [使用手冊](./USER_GUIDE.md) - 第九章：影片管理詳細教學
