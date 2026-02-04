# 鋒兄文件 (Documents)

## 功能概述

綜合文件管理系統，支援 20+ 種檔案格式的上傳、預覽、下載與分類管理，包含程式碼編輯器與 ZIP 結構預覽。

## 主要特點

- **廣泛格式支援**：PDF、Office、文字、程式碼、壓縮檔、圖片、音訊、影片。
- **程式碼編輯**：支援 TXT、MD、JSON、XML、HTML、CSS、JS、TS 等檔案的語法高亮編輯。
- **Office 預覽**：透過 Microsoft Office Web Viewer 線上瀏覽 Word、Excel、PowerPoint。
- **ZIP 結構預覽**：瀏覽 ZIP 內部檔案結構與大小，無需解壓。
- **離線快取**：文件快取至 IndexedDB，離線存取。
- **分類管理**：自訂分類，快速過濾與組織文件。
- **批次 ZIP 操作**：ZIP 匯入匯出文件。

## 資料表結構 (Appwrite Collection: `commondocument`)

| 欄位名稱 | 類型 | 長度 | 必填 | 說明 |
|----------|------|------|------|------|
| name | string | 100 | ✅ | 文件名稱 |
| file | string | 150 | ❌ | Storage 檔案 ID |
| filetype | string | 20 | ❌ | 檔案類型 |
| note | string | 100 | ❌ | 備註 |
| ref | string | 100 | ❌ | 參考資料 |
| category | string | 100 | ❌ | 分類 |
| hash | string | 300 | ❌ | 檔案雜湊 |
| cover | string | 150 | ❌ | 封面圖 Storage File ID |

## 支援的檔案格式

| 類型 | 格式 | 預覽方式 |
|------|------|---------|
| 文件 | PDF | 內建 PDF Viewer |
| 文件 | DOC、DOCX | Office Web Viewer |
| 試算表 | XLS、XLSX | Office Web Viewer |
| 簡報 | PPT、PPTX | Office Web Viewer |
| 文字 | TXT、MD | 內建文字預覽 + 編輯 |
| 程式碼 | JS、TS、HTML、CSS、JSON、XML、Python、Java | 語法高亮 + 編輯 |
| 壓縮 | ZIP | 結構預覽 |
| 圖片 | JPG、PNG、GIF、WEBP | 圖片預覽 |
| 音訊 | MP3、M4A、WAV | 音訊播放 |
| 影片 | MP4、WEBM | 影片播放 |

## 離線快取

- 快取儲存：IndexedDB
- 快取上限：**500MB**
- 下載過的文件暫存在瀏覽器中
- 再次開啟時無需重新下載

## API 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/commondocument` | 取得所有文件 |
| POST | `/api/commondocument` | 新增文件 |
| GET | `/api/commondocument/[id]` | 取得單筆文件 |
| PUT | `/api/commondocument/[id]` | 更新文件 |
| DELETE | `/api/commondocument/[id]` | 刪除文件 |

## 技術規格

- **元件路徑**：`components/modules/CommonDocumentManagement.tsx`
- **程式碼編輯器**：`components/ui/code-editor.tsx` (Monaco Editor)
- **PDF 預覽**：`components/ui/pdf-viewer.tsx` (pdfjs-dist)
- **快取 Hook**：`hooks/useDocumentCache.ts`
- **API 路徑**：`app/api/commondocument/`
- **常數定義**：`lib/constants.ts` → `API_ENDPOINTS.COMMONDOCUMENT`
