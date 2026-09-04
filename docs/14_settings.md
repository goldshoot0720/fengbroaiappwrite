# 鋒兄設定 (Settings)

## 功能概述

系統全域配置中心，管理 Appwrite 連線設定、資料庫表格建立與維護、選單 CSV／ZIP 一鍵備份還原、儲存空間管理、主題切換等功能。

## 主要特點

- **Appwrite 帳號切換**：動態切換不同 Appwrite 後端，免重新部署。
- **資料庫管理**：檢視表格狀態、一鍵建立缺失表格、個別重建表格。
- **Schema 驗證**：檢測欄位數量是否符合預期，識別結構異常。
- **選單備份／還原**：一鍵匯出／匯入所有 CSV 選單，或連同媒體 ZIP 一次打包。
- **儲存空間管理**：掃描孤立檔案並批次清除。
- **主題切換**：亮色 / 暗色 / 跟隨系統三種模式。

## Appwrite 帳號配置

| 設定項目 | 說明 | 環境變數 |
|----------|------|---------|
| Endpoint | Appwrite 伺服器位址 | `NEXT_PUBLIC_APPWRITE_ENDPOINT` |
| Project ID | 專案 ID | `NEXT_PUBLIC_APPWRITE_PROJECT_ID` |
| Database ID | 資料庫 ID | `NEXT_PUBLIC_APPWRITE_DATABASE_ID` |
| Bucket ID | 儲存桶 ID | `NEXT_PUBLIC_APPWRITE_BUCKET_ID` |
| API Key | API 金鑰 | `NEXT_PUBLIC_APPWRITE_API_KEY` |

- 支援動態覆蓋 .env 設定，透過 URL 參數傳遞
- 切換帳號時自動清除所有本地快取並重新載入
- 可點擊「重設為 .env 預設」按鈕還原

## 資料庫管理

### 表格狀態指示

| 顏色 | 狀態 | 說明 |
|------|------|------|
| 🟢 綠色 | 正常 | 表格存在且有資料 |
| 🟡 黃色 | 空表 | 表格存在但無資料 |
| 🔴 紅色 | 不存在 | 表格尚未建立 |

### 資料庫表格一覽 (17 個 Collection)

欄位數以 `app/api/create-table/route.js` 的 `TABLE_SCHEMAS` 為準。`trialpurchase` 與 `reinstall` 採非破壞性初始化：只新增資料表或補齊缺少欄位，重試不刪除紀錄。

| # | 表格名稱 | 欄位數 | 用途 |
|---|----------|--------|------|
| 1 | food | 7 | 食品庫存管理 |
| 2 | subscription | 15 | 訂閱服務管理（含整理欄位與 archived） |
| 3 | article | 17 | 筆記文章管理 |
| 4 | commonaccount | 75 | 常用帳號管理 |
| 5 | bank | 9 | 銀行帳戶管理 |
| 6 | routine | 7 | 例行事務管理 |
| 7 | image | 8 | 圖片管理 |
| 8 | video | 9 | 影片管理（含 fileSize） |
| 9 | music | 10 | 音樂管理 |
| 10 | podcast | 8 | 播客管理 |
| 11 | commondocument | 8 | 文件管理 |
| 12 | landtophistory | 9 | 手機比價歷史快照 |
| 13 | manualprice | 4 | 鋒兄比價手動紀錄 |
| 14 | sitevisit | 4 | 進站人次與連續進站天數 |
| 15 | menuusage | 3 | 選單使用統計 |
| 16 | trialpurchase | 8 | 試用／首購（服務 × 帳號） |
| 17 | reinstall | 12 | 重灌軟體（Win／Mac，含查看密碼與訂閱制） |

### 表格操作

| 操作 | 說明 |
|------|------|
| 一鍵建立所有缺失 Table | 建立所有紅色狀態的表格 |
| 個別重建 | 重建單一表格（⚠ 會清除該表所有資料） |
| 補欄位 | 只補缺少欄位，不刪現有資料（呼叫 `/api/update-schema`） |
| 結構修正 / 重建 | 當欄位無法自動補上時重建表格（⚠ 會清除該表所有資料） |

## 選單備份／還原

在「鋒兄設定」可一次匯出或匯入多個選單，不必逐頁操作。

| 操作 | 說明 |
|------|------|
| 一鍵匯出 CSV | 把所有有 CSV 的選單打成一個 ZIP（`csv/*.csv`）。不含圖片／影片等媒體檔。 |
| 一鍵匯入 CSV | 選擇上述 ZIP（或單一 `.csv`）。相同鍵會更新、其餘新增；不會刪除備份裡沒有的紀錄。 |
| 一鍵匯出全部 | CSV 選單加上圖片、影片、音樂、播客、文件、筆記的 ZIP（`zip/*.zip`）。 |
| 一鍵匯入全部 | 還原 CSV 與媒體 ZIP。媒體檔會重新上傳，可能需要較長時間。 |

CSV 選單包含：訂閱、試用／首購、重灌、額度、食品、購物清單、常用、銀行、例行、比價、手機比價歷史、Tube、金融、新聞，以及音樂／影片的中繼資料。ZIP 選單包含：圖片、影片、音樂、播客、文件、筆記。

匯出檔名格式：`appwrite-{暱稱}-all-csv-{YYYYMMDD}.zip` 或 `appwrite-{暱稱}-all-menus-{YYYYMMDD}.zip`。

## 儲存空間管理

| 功能 | 說明 |
|------|------|
| 孤立檔案檢測 | 找出沒有被任何記錄引用的 Storage 檔案 |
| 批次清除 | 一次刪除所有孤立檔案，釋放空間 |
| 分類統計 | 查看各類媒體檔案的數量與空間佔用 |

## 主題設定

| 模式 | 說明 |
|------|------|
| 亮色模式 | 白色背景，適合白天 |
| 暗色模式 | 深色背景，適合夜間 |
| 跟隨系統 | 自動跟隨作業系統設定 |

主題設定儲存在瀏覽器 localStorage，下次開啟自動套用。

## API 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/create-table?table={name}` | SSE 串流建立表格 |
| POST | `/api/create-table` | 建立表格（傳統方式） |
| GET | `/api/database-stats` | 資料庫統計 |
| GET | `/api/storage-stats` | 儲存空間統計 |
| POST | `/api/update-schema` | 更新表格結構 |
| POST | `/api/fix-permissions` | 修復 Appwrite 權限 |

## 技術規格

- **元件路徑**：`components/modules/SettingsManagement.tsx`
- **主題元件**：`components/providers/theme-provider.tsx`、`components/ui/theme-toggle.tsx`
- **Table Schema 定義**：`app/api/create-table/route.js` → `TABLE_SCHEMAS`

---

## 相關文件

- [選單索引](./INDEX.md) - 返回文件總覽
- [首頁說明](./01_home.md) - 系統入口介紹
- [關於系統](./15_about.md) - 系統版本與架構資訊
- [使用手冊](./USER_GUIDE.md) - 第十五章：系統設定詳細教學

---

> **文件版本**: v1.2.0  
> **最後更新**: 2026-09-04
