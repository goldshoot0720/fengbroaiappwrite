# 鋒兄管理資訊系統 - 系統架構文檔

> **現況**：選單、模組數與 13 張資料表以 [INDEX.md](./INDEX.md) 為準。程式碼行數以 `config/codebase-stats.json` 為準（2026-08-26 核心原始碼 95,027 行）。下文部分規模數字仍是舊快照。

## 🏗️ 系統概況

### 專案規模統計
- **總程式碼行數**: 約 45,277 行原始碼
- **主要語言**: TypeScript / TSX 為主，搭配部分 JavaScript
- **檔案總數**: 126 個原始碼檔案
- **開發框架**: Next.js 16.0.10 + React 19

### 技術堆疊架構
```
前端層 (Frontend Layer)
├── Next.js 16.0.10 (React 19)
├── TypeScript 5.9.3
├── Tailwind CSS 4.1.18
├── Radix UI Components
└── Lucide React Icons

後端層 (Backend Layer)
├── Next.js App Router API
├── Appwrite Backend Services
├── Node.js Runtime
└── TypeScript Support

儲存層 (Storage Layer)
├── Appwrite Database
├── Appwrite Storage
├── Appwrite Authentication
└── Appwrite Real-time

部署層 (Deployment Layer)
├── Vercel Platform
├── Docker Support
├── Environment Variables
└── CI/CD Pipeline
```

---

## 🎯 系統功能模組

### 核心管理模組 (8個)

#### 1. 鋒兄食品管理 (Food Management)
- **檔案**: `components/modules/FoodManagement.tsx`
- **API端點**: `/api/food`, `/api/food/[id]`
- **資料表**: `food` (7個欄位)
- **功能**: 食品庫存、分類、過期管理

#### 2. 鋒兄訂閱管理 (Subscription Management)
- **檔案**: `components/modules/SubscriptionManagement.tsx`
- **API端點**: `/api/subscription`, `/api/subscription/[id]`
- **資料表**: `subscription` (8個欄位)
- **功能**: 定期支出、訂閱服務管理

#### 3. 鋒兄筆記系統 (Notes System)
- **檔案**: `components/modules/NotesManagement.tsx`
- **API端點**: `/api/article`, `/api/article/[id]`
- **資料表**: `article` (17個欄位)
- **功能**: 多功能筆記、附件支援、預覽功能

#### 4. 鋒兄常用管理 (Common Accounts)
- **檔案**: `components/modules/CommonAccountManagement.tsx`
- **API端點**: `/api/commonaccount`, `/api/commonaccount/[id]`
- **資料表**: `commonaccount` (75個欄位)
- **功能**: 帳號、網站、連結管理

#### 5. 鋒兄銀行管理 (Bank Management)
- **檔案**: `components/modules/BankManagement.tsx`
- **API端點**: `/api/bank`, `/api/bank/[id]`
- **資料表**: `bank` (9個欄位)
- **功能**: 銀行帳戶、餘額、財務記錄

#### 6. 鋒兄圖片管理 (Image Management)
- **檔案**: `components/modules/ImageGallery.tsx`
- **API端點**: `/api/image`, `/api/image/[id]`, `/api/images`
- **資料表**: `image` (8個欄位)
- **功能**: 圖片上傳、瀏覽、藝廊管理

#### 7. 鋒兄影片管理 (Video Management)
- **檔案**: `components/modules/VideoIntroduction.tsx`
- **API端點**: `/api/video`, `/api/video/[id]`, `/api/videos/[filename]`
- **資料表**: `video` (8個欄位)
- **功能**: 影片串流、播放佇列、快取管理

#### 8. 鋒兄音樂管理 (Music Management)
- **檔案**: `components/modules/MusicManagement.tsx`
- **API端點**: `/api/music`, `/api/music/[id]`
- **資料表**: `music` (10個欄位)
- **功能**: 音樂播放、歌詞顯示、專輯管理

### 輔助功能模組 (3個)

#### 1. 鋒兄播客管理 (Podcast Management)
- **檔案**: `components/modules/PodcastManagement.tsx`
- **API端點**: `/api/podcast`, `/api/podcast/[id]`
- **資料表**: `podcast` (8個欄位)

#### 2. 鋒兄文件管理 (Document Management)
- **檔案**: `components/modules/CommonDocumentManagement.tsx`
- **API端點**: `/api/commondocument`, `/api/commondocument/[id]`
- **資料表**: `commondocument` (8個欄位)

#### 3. 鋒兄例行管理 (Routine Management)
- **檔案**: `components/modules/RoutineManagement.tsx`
- **API端點**: `/api/routine`, `/api/routine/[id]`
- **資料表**: `routine` (7個欄位)

---

## 🔄 API 架構設計

### RESTful API 端點統計
- **總API端點**: 30+ 個
- **資源類型**: 11 種主要資源
- **操作類型**: CRUD (Create, Read, Update, Delete)

### API 設計模式
```
標準CRUD端點
├── GET    /api/[resource]           # 列表查詢
├── POST   /api/[resource]           # 新建資源
├── GET    /api/[resource]/[id]      # 單一查詢
├── PUT    /api/[resource]/[id]      # 更新資源
└── DELETE /api/[resource]/[id]      # 刪除資源

特殊功能端點
├── POST   /api/upload-[type]        # 檔案上傳
├── GET    /api/database-stats       # 資料庫統計
├── POST   /api/create-table         # 資料表建立
└── POST   /api/fix-permissions      # 權限修復
```

### 媒體處理端點
- `/api/upload-image` - 圖片上傳
- `/api/upload-music` - 音樂上傳
- `/api/upload-podcast` - 播客上傳
- `/api/upload-video` - 影片上傳
- `/api/media-proxy` - 媒體代理服務

---

## 🎨 前端架構設計

### 元件架構分層
```
components/
├── layout/           # 佈局元件層
│   └── DashboardLayout.tsx
├── modules/          # 功能模組層 (11個)
│   ├── BankManagement.tsx
│   ├── CommonAccountManagement.tsx
│   ├── CommonDocumentManagement.tsx
│   ├── EnhancedDashboard.tsx
│   ├── FoodManagement.tsx
│   ├── ImageGallery.tsx
│   ├── MusicLyrics.tsx
│   ├── MusicManagement.tsx
│   ├── NotesManagement.tsx
│   ├── PodcastManagement.tsx
│   ├── RoutineManagement.tsx
│   ├── SettingsManagement.tsx
│   ├── SubscriptionManagement.tsx
│   └── VideoIntroduction.tsx
├── providers/        # 狀態管理層
│   └── theme-provider.tsx
└── ui/               # UI元件庫 (30+個)
    ├── accordion.tsx
    ├── avatar.tsx
    ├── button.tsx
    ├── card.tsx
    ├── dialog.tsx
    ├── enhanced-video-player.tsx
    ├── form-card.tsx
    ├── image-editor.tsx
    ├── music-queue-panel.tsx
    ├── pdf-viewer.tsx
    ├── plyr-player.tsx
    ├── stat-card.tsx
    ├── table.tsx
    ├── tabs.tsx
    ├── video-player.tsx
    └── [更多UI元件...]
```

### 狀態管理架構
```typescript
// 自定義Hooks架構
hooks/
├── useApi.ts              # API請求管理
├── useArticles.ts         # 文章資料管理
├── useBanks.ts            # 銀行資料管理
├── useCommonDocument.ts   # 文件資料管理
├── useDashboardStats.ts   # 儀表板統計
├── useDocumentCache.ts    # 文件快取管理
├── useFoods.ts            # 食品資料管理
├── useImages.ts           # 圖片資料管理
├── useMediaStats.ts       # 媒體統計管理
├── useMusic.ts            # 音樂資料管理
├── useMusicCache.ts       # 音樂快取管理
├── useMusicQueue.ts       # 音樂播放佇列
├── usePodcast.ts          # 播客資料管理
├── usePodcastCache.ts     # 播客快取管理
├── useSubscriptions.ts    # 訂閱資料管理
├── useVideoCache.ts       # 影片快取管理
├── useVideoQueue.ts       # 影片播放佇列
└── useVideos.ts           # 影片資料管理
```

---

## 📊 資料架構設計

### 資料庫Schema統計
| 資料表名稱 | 欄位數 | 主要功能 | 索引設計 |
|-----------|--------|----------|----------|
| food | 7 | 食品管理 | 名稱、分類、到期日 |
| subscription | 8 | 訂閱管理 | 名稱、週期、金額 |
| article | 17 | 文章管理 | 標題、分類、日期 |
| commonaccount | 75 | 常用帳號 | 平台、類型、重要性 |
| bank | 9 | 銀行管理 | 名稱、類型、餘額 |
| routine | 7 | 例行公事 | 標題、週期、狀態 |
| image | 8 | 圖片管理 | 檔名、大小、標籤 |
| video | 8 | 影片管理 | 標題、時長、分類 |
| music | 10 | 音樂管理 | 標題、演出者、專輯 |
| podcast | 8 | 播客管理 | 標題、時長、分類 |
| commondocument | 8 | 文件管理 | 標題、類型、大小 |

### 資料關聯設計
- **一對多關係**: 使用者 → 各類資源
- **多對一關係**: 資源 → 分類標籤
- **多對多關係**: 資源 ↔ 標籤系統

---

## 🔧 技術實現細節

### 核心技術依賴
```json
{
  "dependencies": {
    "next": "^16.0.10",
    "react": "^19.2.3",
    "react-dom": "^19.2.3",
    "typescript": "^5.9.3",
    "appwrite": "^21.5.0",
    "@radix-ui/react-*": "^1.2.3",
    "tailwindcss": "^4.1.18",
    "lucide-react": "^0.561.0"
  }
}
```

### 效能優化策略
1. **快取機制**: 客戶端快取 + 服務端快取
2. **分頁載入**: 大數據集分頁處理
3. **圖片優化**: 自動壓縮、格式轉換
4. **程式碼分割**: 動態載入、路由分割
5. **資料壓縮**: 傳輸層壓縮

### 安全性設計
1. **認證授權**: Appwrite Auth 整合
2. **輸入驗證**: 客戶端 + 服務端雙重驗證
3. **檔案上傳**: 類型檢查、大小限制
4. **資料加密**: 傳輸加密、儲存加密
5. **權限控制**: 細粒度權限管理

---

## 🚀 部署架構

### 開發環境
```bash
# 開發伺服器啟動
npm run dev
# 服務位址: http://localhost:3000
```

### 生產環境
```bash
# 建置生產版本
npm run build
npm run start
```

### Docker支援
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

---

## 📈 系統性能指標

### 載入性能
- **首次載入時間**: < 3秒
- **互動時間**: < 1.5秒
- **資源大小**: 優化壓縮

### 運行時性能
- **API響應時間**: < 200ms
- **資料載入時間**: < 500ms
- **客戶端渲染**: 服務端渲染 + 客戶端水合

### 擴展性指標
- **並發用戶**: 1000+ 同時在線
- **資料容量**: 無限擴展 (Appwrite)
- **檔案儲存**: 無限擴展 (Appwrite Storage)

---

## 🔮 未來發展藍圖

### 短期目標 (2025 Q1-Q2)
- [ ] PWA 支援 (離線功能)
- [ ] 即時通知系統
- [ ] 資料匯出/匯入功能
- [ ] 多語言介面支援

### 中期目標 (2025 Q3-Q4)
- [ ] AI 智慧分類
- [ ] 語音搜尋功能
- [ ] 協作編輯支援
- [ ] 行動應用程式

### 長期願景 (2026+)
- [ ] 企業版功能
- [ ] 區塊鏈整合
- [ ] 邊緣運算支援
- [ ] 全球CDN部署

---

## 📞 技術支援

**系統版本**: v2.0.0  
**技術堆疊**: Next.js + TypeScript + Appwrite  
**部署平台**: Vercel + Docker  
**更新日期**: 2025年2月7日  

**聯絡資訊**:
- GitHub: https://github.com/goldshoot0720/fengbroaiappwrite
- 技術支援: Next.js 16 + React 19 架構
- 後端服務: Appwrite Backend-as-a-Service

---

*最後更新：2025年2月7日 - 新增系統架構完整說明、技術實現細節、性能指標分析*
