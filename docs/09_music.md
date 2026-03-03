# 鋒兄音樂 (Music)

## 功能概述

音樂管理與播放系統，支援歌詞顯示、專輯封面、播放佇列、多語言標記與離線快取。

## 主要特點

- **專輯封面**：上傳專輯封面圖片。
- **歌詞顯示**：支援歌詞文字顯示，可搭配播放同步查看。
- **播放佇列**：加入佇列 / 立即播放 / 排序管理，自動播放下一首。
- **語言標記**：為歌曲標記語言分類。
- **分類管理**：依音樂類型或專輯分類。
- **離線快取**：音樂快取至 IndexedDB，離線播放。
- **多格式支援**：MP3、M4A、WAV、OGG、FLAC、AAC、WEBA。
- **批次 ZIP 操作**：ZIP 匯入匯出音樂。
- **CSV 匯入/匯出**：批次音樂資料管理。

## 資料表結構 (Appwrite Collection: `music`)

| 欄位名稱 | 類型 | 長度 | 必填 | 說明 |
|----------|------|------|------|------|
| name | string | 100 | ✅ | 歌曲名稱 |
| file | string | 150 | ❌ | Storage 檔案 ID |
| filetype | string | 20 | ❌ | 檔案類型 (mp3/m4a/wav/ogg/flac/aac/weba) |
| lyrics | string | 3337 | ❌ | 歌詞文字 |
| note | string | 100 | ❌ | 備註 |
| ref | string | 100 | ❌ | 參考資料 |
| category | string | 100 | ❌ | 分類 |
| hash | string | 300 | ❌ | 檔案雜湊 |
| language | string | 100 | ❌ | 語言標記 |
| cover | string | 150 | ❌ | 封面圖 Storage File ID |

## 支援的音訊格式

| 格式 | 說明 |
|------|------|
| MP3 | MPEG Audio Layer 3 |
| M4A | MPEG-4 Audio |
| WAV | Waveform Audio |
| OGG | Ogg Vorbis |
| FLAC | Free Lossless Audio Codec |
| AAC | Advanced Audio Coding |
| WEBA | WebM Audio |

## CSV 格式

| # | 欄位 | 說明 |
|---|------|------|
| 1 | name | 歌曲名稱 |
| 2 | category | 分類 |
| 3 | language | 語言 |
| 4 | lyrics | 歌詞 |
| 5 | note | 備註 |
| 6 | ref | 參考 |

## 離線快取

- 快取儲存：IndexedDB
- 快取上限：**500MB**
- 離線模式可播放已快取的音樂

## API 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/music` | 取得所有音樂 |
| POST | `/api/music` | 新增音樂 |
| GET | `/api/music/[id]` | 取得單筆音樂 |
| PUT | `/api/music/[id]` | 更新音樂 |
| DELETE | `/api/music/[id]` | 刪除音樂 |
| POST | `/api/upload-music` | 上傳音樂至 Storage |

## 技術規格

- **元件路徑**：`components/modules/MusicManagement.tsx`
- **歌詞元件**：`components/modules/MusicLyrics.tsx`
- **佇列面板**：`components/ui/music-queue-panel.tsx`
- **快取 Hook**：`hooks/useMusicCache.ts`
- **API 路徑**：`app/api/music/`
- **常數定義**：`lib/constants.ts` → `API_ENDPOINTS.MUSIC`

---

## 相關文件

- [選單索引](./INDEX.md) - 返回文件總覽
- [影片管理](./08_videos.md) - 影片播放與佇列功能
- [播客管理](./11_podcast.md) - 音訊/視訊播客管理
- [系統設定](./14_settings.md) - 快取與儲存空間管理
- [使用手冊](./USER_GUIDE.md) - 第十章：音樂管理詳細教學
