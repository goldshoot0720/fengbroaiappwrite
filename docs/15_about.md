# 鋒兄關於

## 定位

「鋒兄關於」不再只是靜態介紹頁，而是專案的文件中心與現況入口。

它的用途是：

- 顯示最近更新了什麼
- 說明目前系統架構
- 整理日常工作台、工具與子工具的角色
- 指向重要技術文件與程式碼入口
- 提供交接時最短的閱讀路徑

## 五個分頁

| # | 分頁 | 目的 |
|---|---|---|
| 1 | 更新內容 | 快速看最近改版、重點變更與目前方向 |
| 2 | 系統架構 | 了解前端、API、Appwrite 與共用 UI 骨架 |
| 3 | 功能模組 | 看 25 個可導覽葉模組各自負責什麼 |
| 4 | 技術文件 | 找 docs 與重點實作檔案 |
| 5 | 完整文件 | 看接手順序、維護流程與閱讀路線 |

## 目前重點更新

### 2026-09-04

- 鋒兄比價手動價格、鋒兄Tube 頻道與鋒兄金融自選標的／精選改以 Appwrite Table 為主（`manualprice`／`tubechannel`／`financeinstrument2`），開啟雲端同步與多裝置共用
- 首次啟用自動把既有瀏覽器本機資料遷移上傳（localId 冪等合併）；未設定 Appwrite 或資料表尚未建立時引導前往鋒兄設定
- 設定頁可建立的 collection 新增 `tubechannel`、`financeinstrument2`（仍為純加欄位、不刪既有資料）
- `tubechannel2` 已作廢（改用 `tubechannel`）：不再提供 API route、設定頁建立／補欄位／重建
- `financeinstrument` 已作廢（改用 `financeinstrument2`）：不再提供 API route、設定頁建立／補欄位／重建；Appwrite 上若仍有舊 collection，請在控制台刪除
- Resend 通知設定支援 CSV 匯入／匯出，依收件 Email 合併既有組
- 核心原始碼重新統計為 307 檔、101,901 行，突破十萬行里程碑（以 `config/codebase-stats.json` 為準）

### 2026-09-03

- 鋒兄管理新增「試用/首購」與「重灌」，使用獨立 `trialpurchase`、`reinstall` 資料表
- 重灌「付費序號」可另設「查看密碼」；訂閱制軟體可記下週期（年／月）與費用（台幣／美元／日圓／人民幣）。支援 CSV 匯出／匯入。既有 `reinstall` 表請到鋒兄設定補齊欄位
- 試用／首購支援 CSV 匯出／匯入；相同服務名稱與帳號會更新既有紀錄
- 可導覽葉模組改為 25 個（日常 16 + 工具 6 + 子工具 3）
- 設定頁可建立的 collection 改為 17 個；新表初始化只補欄位、不刪既有資料
- 核心原始碼重新統計為 288 檔、96,191 行（以 `config/codebase-stats.json` 為準）
- 關於頁新增「進站人次」與「連續進站天數」（台北日曆日；中斷一日重新起算）。既有 `sitevisit` 表請到鋒兄設定補齊 `currentStreak`、`lastVisitDate`

### 2026-08-13

- README、`docs/INDEX.md` 與關於頁模組表對齊 `app/page.tsx`
- 可導覽葉模組改為 24 個（日常 15 + 工具 6 + 子工具 3）
- 設定頁可建立的 collection 改為 13 個（含 `landtophistory`、`manualprice`）

### 2026-07-12

- 「手機比價」介面全面升級，導入琉璃質感 (Glassmorphism)、微動畫與專屬品牌配色。

### 2026-03-12

- 「鋒兄關於」改成文件中心版面
- 七個模組完成第一輪友善 AI CRUD 工作台骨架收斂
- 訂閱模組依真實 `subscription` schema 收斂
- 訂閱模組新增 CSV 匯入匯出、ID 搜尋、collection id 顯示、日期 `+30 / -30` 快捷鍵

## 系統架構摘要

### 前端

- Next.js App Router
- React 19
- TypeScript
- `components/modules/` 負責各模組頁
- `components/ui/friendly-ai-crud-shell.tsx` 作為共用工作台骨架

### API 與資料層

- Next.js API routes 處理 CRUD、初始化與媒體操作
- Appwrite Database 儲存 collection 資料
- Appwrite Storage 儲存媒體檔案
- `鋒兄設定` 負責 table 初始化、collection 狀態與維運資訊

### 架構原則

- 人先做決策，AI 先做整理
- UI 先統一骨架，再逐模組深化
- 前端欄位必須以真實 schema 為準
- 文件必須和實作同步更新

## 功能模組一覽

與 `app/page.tsx` 可點進的葉模組對齊。完整對照見 [INDEX.md](./INDEX.md)。

| # | 模組 | 說明 |
|---|---|---|
| 1 | 鋒兄首頁 | 系統入口與模組導覽；同一頁可切完整儀表 |
| 2 | 鋒兄訂閱 | 訂閱、扣款日、CSV、本機垃圾桶 |
| 3 | 鋒兄試用／首購 | 服務下多帳號、試用／首購狀態與試用／首購／到期日（扣款日） |
| 4 | 鋒兄重灌 | Windows／Mac 軟體、隱藏序號與安裝資訊 |
| 5 | 鋒兄食品 | 庫存、到期管理與批次清理 |
| 6 | 鋒兄筆記 | 快速筆記、附件與本機垃圾桶 |
| 7 | 鋒兄常用 | 常用入口、置頂與最近使用 |
| 8 | 鋒兄圖片 | 圖片整理與工作台摘要 |
| 9 | 鋒兄影片 | 影片播放與媒體管理 |
| 10 | 鋒兄音樂 | 音樂、歌詞與播放控制 |
| 11 | 鋒兄文件 | 文件預覽、分類與匯入匯出 |
| 12 | 鋒兄播客 | 節目、批次上傳與摘要管理 |
| 13 | 鋒兄銀行 | 帳戶、電子票證與餘額 |
| 14 | 鋒兄例行 | 例行任務與日期遞移 |
| 15 | 鋒兄設定 | Appwrite 設定、初始化與系統維運 |
| 16 | 鋒兄關於 | 文件中心與改版入口 |
| 17 | 鋒兄比價 | 手動商品與價格紀錄 |
| 18 | 手機比價 | 地標網通 + 傑昇通信 |
| 19 | 圖片 + 語音 = 影片 | FFmpeg 合成 |
| 20 | PNG / JPEG 轉換 | 圖片格式轉換 |
| 21 | 影片合併 | 多段影片合併 |
| 22 | YT / B站轉 MP3/MP4 | 下載轉檔 |
| 23 | 鋒兄Tube | 頻道與倒台指數 |
| 24 | 鋒兄金融 | CNBC / Yahoo 報價 |
| 25 | 鋒兄新聞 | 鎖定網站焦點 |

## 技術文件入口

### docs

- `docs/INDEX.md`
- `docs/USER_GUIDE.md`
- `docs/SYSTEM_ARCHITECTURE.md`
- `docs/03_subscription.md`
- `docs/16_trial_purchase.md`
- `docs/17_reinstall.md`
- `docs/14_settings.md`

### 重要實作檔案

- `components/modules/AboutUs.tsx`
- `components/ui/friendly-ai-crud-shell.tsx`
- `components/modules/SubscriptionManagement.tsx`
- `components/modules/SettingsManagement.tsx`
- `hooks/useSubscriptions.ts`

## 完整文件閱讀順序

### 接手專案時

1. 先讀 `docs/INDEX.md`
2. 再讀 `docs/15_about.md`
3. 看 `docs/SYSTEM_ARCHITECTURE.md`
4. 進 `鋒兄設定` 確認 Appwrite 與 table 狀態
5. 最後看對應模組文件與實際程式碼

### 維護時

1. 先確認真實 schema
2. 再改 UI 與 API
3. 跑 lint / type check
4. 同步更新 `鋒兄關於` 與對應 docs

## 文件資訊

- 元件路徑：`components/modules/AboutUs.tsx`
- 文件位置：`docs/15_about.md`
- 最後更新：2026-09-03
- 文件版本：v2.2.0
