# 程式碼統計報告

## 專案概況
- **專案名稱**: fengbroaiappwrite-main
- **統計日期**: 2025年2月7日
- **統計工具**: cloc (Count Lines of Code)

## 程式碼規模統計

### 總體數據
```
總計檔案數: 25,131 個
總計程式碼行數: 6,140,940 行
總計註解行數: 831,410 行
總計空白行數: 238,833 行
```

### 各語言分布

| 語言類型 | 檔案數 | 空白行數 | 註解行數 | 程式碼行數 |
|---------|--------|----------|----------|------------|
| JavaScript | 18,261 | 151,634 | 477,942 | 5,192,793 |
| JSON | 1,160 | 119 | 0 | 440,852 |
| TypeScript | 4,111 | 39,001 | 349,553 | 356,000 |
| Markdown | 1,017 | 38,192 | 553 | 98,257 |
| CSS | 127 | 8,177 | 1,649 | 39,429 |
| C++ | 7 | 299 | 603 | 3,404 |
| YAML | 133 | 185 | 102 | 2,149 |
| SCSS | 37 | 229 | 234 | 1,280 |
| SVG | 105 | 2 | 117 | 1,051 |
| HTML | 25 | 113 | 4 | 862 |
| 其他 | 152 | 1,883 | 1,054 | 4,764 |

### 核心程式碼分析

#### TypeScript/JavaScript 程式碼
- **主要業務邏輯**: 約 356,000 行 TypeScript 程式碼
- **API 路由**: 30+ 個 API 端點
- **React 元件**: 50+ 個功能元件
- **自定義 Hooks**: 15+ 個自定義 React Hooks

#### 專案結構
```
app/                    # Next.js App Router
├── api/               # API 路由 (30+ endpoints)
├── lyrics-test/       # 測試頁面
components/            # React 元件
├── layout/           # 佈局元件
├── modules/          # 功能模組 (8個管理模組)
├── providers/        # 狀態管理提供者
├── ui/               # UI 元件庫 (30+ 元件)
hooks/                 # 自定義 React Hooks (15+)
lib/                   # 工具函數和設定
types/                 # TypeScript 類型定義
```

### 功能模組統計

#### 管理系統模組
1. **BankManagement** - 銀行管理
2. **CommonAccountManagement** - 共同帳戶管理  
3. **CommonDocumentManagement** - 共同文件管理
4. **FoodManagement** - 食物管理
5. **MusicManagement** - 音樂管理
6. **PodcastManagement** - 播客管理
7. **RoutineManagement** - 例行公事管理
8. **SubscriptionManagement** - 訂閱管理

#### API 端點統計
- **文章管理**: `/api/article`, `/api/article/[id]`
- **銀行管理**: `/api/bank`, `/api/bank/[id]`
- **共同帳戶**: `/api/commonaccount`, `/api/commonaccount/[id]`
- **文件管理**: `/api/commondocument`, `/api/commondocument/[id]`
- **食物管理**: `/api/food`, `/api/food/[id]`
- **圖片管理**: `/api/image`, `/api/image/[id]`, `/api/images`
- **音樂管理**: `/api/music`, `/api/music/[id]`
- **播客管理**: `/api/podcast`, `/api/podcast/[id]`
- **例行公事**: `/api/routine`, `/api/routine/[id]`
- **訂閱管理**: `/api/subscription`, `/api/subscription/[id]`
- **影片管理**: `/api/video`, `/api/video/[id]`, `/api/videos/[filename]`
- **系統功能**: `/api/create-table`, `/api/database-stats`, `/api/fix-permissions`
- **媒體處理**: `/api/upload-image`, `/api/upload-music`, `/api/upload-podcast`, `/api/upload-video`

### 技術堆疊
- **前端框架**: Next.js 16.0.10 (React 19)
- **樣式**: Tailwind CSS 4.1.18
- **UI 元件**: Radix UI + 自定義元件
- **後端**: App Router API Routes
- **資料儲存**: Appwrite
- **類型檢查**: TypeScript 5.9.3

### 程式碼品質指標
- **TypeScript 覆蓋率**: 約 6.4% (356K/5.55M 行)
- **註解比例**: 13.5% (831K/6.14M 行)
- **模組化程度**: 高 (功能模組分離)
- **可維護性**: 良好 (清晰的專案結構)

## 總結

這是一個大型的全端應用程式，擁有超過 600 萬行程式碼，主要使用 JavaScript/TypeScript 開發。專案採用現代化的技術架構，具有完整的 CRUD 功能管理系統，支援多媒體內容管理，並且具有良好的模組化設計。