# 程式碼統計報告

> 下文是 2026-03-03 的完整掃描快照。現況行數以 `config/codebase-stats.json` 為準（2026-08-26 核心原始碼 95,027 行）；模組清單以 [docs/INDEX.md](docs/INDEX.md) 為準。

## 專案概況
- **專案名稱**: fengbroaiappwrite-main
- **最新統計日期**: 2026年3月3日（下午更新）
- **統計工具**: PowerShell (Get-ChildItem + Get-Content)
- **統計範圍**: 排除 node_modules、.next、.git、.claude、.kiro、lock 檔

## 程式碼規模統計（專案原始碼）

### 各語言分布

| 語言類型 | 副檔名 | 檔案數 | 程式碼行數 |
|---------|--------|--------|------------|
| React TSX | .tsx | 108 | 57,245 |
| TypeScript | .ts | 74 | 11,157 |
| CSS | .css | 2 | 806 |
| ES Module Config | .mjs | 6 | 120 |
| JSON | .json | 18 | 505 |
| Markdown | .md | 61 | 6,671 |
| **總計** | | **269** | **76,504** |

### 核心程式碼分析

#### TypeScript / TSX 原始碼（合計 182 檔 / 68,402 行）
- **功能模組** (`components/modules/`): 15 個大型 TSX 模組
  - MusicManagement.tsx — 音樂管理（2,953 行）★ 最大模組
  - CommonDocumentManagement.tsx — 鋒兄文件管理（2,854 行）
  - VideoIntroduction.tsx — 影片介紹（2,737 行）
  - MusicLyrics.tsx — 音樂歌詞（2,125 行）
  - FoodManagement.tsx — 食物管理（1,825 行）
  - SubscriptionManagement.tsx — 訂閱管理（1,767 行）
  - NotesManagement.tsx — 鋒兄筆記（1,736 行）★ 最新更新（分類功能）
  - PodcastManagement.tsx — 播客管理（1,613 行）
  - CommonAccountManagement.tsx — 共同帳戶（1,447 行）
  - ImageGallery.tsx — 圖片管理（1,220 行）
  - SettingsManagement.tsx — 設定管理（1,211 行）
  - RoutineManagement.tsx — 例行公事（1,142 行）
  - BankManagement.tsx — 銀行管理（960 行）
  - AboutUs.tsx — 關於我們（662 行）
  - EnhancedDashboard.tsx — 儀表板（640 行）
- **UI 元件庫** (`components/ui/`): 35+ 個元件
- **自定義 Hooks** (`hooks/`): 19 個自定義 React Hooks
- **API 路由** (`app/api/`): 40 個 API 端點

#### API 端點統計（40 個）
- **文件管理**: `/api/commondocument`, `/api/commondocument/[id]`
- **銀行管理**: `/api/bank`, `/api/bank/[id]`
- **共同帳戶**: `/api/commonaccount`, `/api/commonaccount/[id]`
- **食物管理**: `/api/food`, `/api/food/[id]`
- **圖片管理**: `/api/image`, `/api/image/[id]`, `/api/images`
- **音樂管理**: `/api/music`, `/api/music/[id]`
- **播客管理**: `/api/podcast`, `/api/podcast/[id]`
- **例行公事**: `/api/routine`, `/api/routine/[id]`
- **筆記管理**: `/api/commonaccount/note`, `/api/commonaccount/note/[id]`
- **訂閱管理**: `/api/subscription`, `/api/subscription/[id]`
- **影片管理**: `/api/video`, `/api/video/[id]`, `/api/videos/[filename]`
- **系統功能**: `/api/create-table`, `/api/database-stats`, `/api/fix-permissions`
- **媒體處理**: `/api/upload-image`, `/api/upload-music`, `/api/upload-podcast`, `/api/upload-video`

### 專案結構
```
app/                    # Next.js App Router
├── api/               # API 路由 (40 個端點)
├── lyrics-test/       # 測試頁面
components/            # React 元件
├── layout/           # 佈局元件
├── modules/          # 功能模組 (15 個管理模組)
├── providers/        # 狀態管理提供者
├── ui/               # UI 元件庫 (35+ 元件)
hooks/                 # 自定義 React Hooks (19 個)
lib/                   # 工具函數和設定
types/                 # TypeScript 類型定義
```

### 功能模組統計（15 個）

1. **AboutUs** - 關於我們
2. **BankManagement** - 銀行管理
3. **CommonAccountManagement** - 共同帳戶管理
4. **CommonDocumentManagement** - 鋒兄文件管理 ⭐ 主要模組
5. **EnhancedDashboard** - 儀表板
6. **FoodManagement** - 食物管理
7. **ImageGallery** - 圖片管理
8. **MusicLyrics** - 音樂歌詞
9. **MusicManagement** - 音樂管理
10. **NotesManagement** - 筆記管理 ⭐ 最新更新（分類功能）
11. **PodcastManagement** - 播客管理
12. **RoutineManagement** - 例行公事管理
13. **SettingsManagement** - 設定管理
14. **SubscriptionManagement** - 訂閱管理
15. **VideoIntroduction** - 影片介紹

### 技術堆疊
- **前端框架**: Next.js (React 19)
- **樣式**: Tailwind CSS
- **UI 元件**: Radix UI + 自定義元件
- **後端**: App Router API Routes
- **資料儲存**: Appwrite
- **類型檢查**: TypeScript 5

### 程式碼品質指標
- **TypeScript 覆蓋率**: 100%（全 TypeScript 專案）
- **模組化程度**: 高（功能模組分離）
- **可維護性**: 良好（清晰的專案結構）

## 版本歷史更新

| 日期 | 總行數 | 功能更新 |
|------|--------|---------|
| 2025-02-07 | ~6,140,940（含dependencies） | 初版統計 |
| 2026-02-22 (一) | 39,299 | 行內編輯補齊欄位（file/filetype/hash）|
| 2026-02-22 (二) | 39,419 | 行內編輯新增上傳文件功能（進度條/自動hash/filetype）|
| 2026-03-03 (一) | **37,500** | 鋒兄筆記新增分類（category）功能：搜尋篩選、輸入欄、卡片標籤 |
| 2026-03-03 (二) | **76,504** | 重新完整計算所有原始碼（含全部元件、API、Hooks、設定檔）|