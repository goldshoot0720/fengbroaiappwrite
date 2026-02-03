# 訂閱項目 Favicon 顯示功能

## 功能說明

此功能為訂閱管理系統添加了 favicon 顯示功能，當訂閱項目有網站 URL 且該網站的 favicon 可用時，會在項目名稱旁邊顯示對應的 favicon 圖示。

## 實現內容

### 1. 新增文件

- `lib/faviconUtils.ts` - Favicon 工具函數
- `components/ui/favicon-image.tsx` - Favicon 顯示組件

### 2. 更新文件

- `next.config.ts` - 添加外部圖片域名支持
- `types/index.ts` - 更新 SubscriptionDetail 類型
- `hooks/useDashboardStats.ts` - 添加 site 字段到統計數據
- `components/modules/SubscriptionManagement.tsx` - 在訂閱列表中顯示 favicon
- `components/modules/EnhancedDashboard.tsx` - 在儀表板統計中顯示 favicon

### 3. 功能特點

- **自動獲取**: 使用 Google Favicon 服務自動獲取網站 favicon
- **錯誤處理**: 當 favicon 無法加載時顯示預設圖示 🌐
- **響應式設計**: 支持桌面版和手機版顯示
- **性能優化**: 使用 Next.js Image 組件優化圖片加載

## 使用方式

1. 在訂閱管理頁面，favicon 會自動顯示在服務名稱旁邊
2. 在儀表板統計中，即將到期的訂閱也會顯示 favicon
3. 如果網站沒有 favicon 或無法加載，會顯示預設的地球圖示

## 技術實現

### Favicon 獲取策略

```typescript
// 使用 Google Favicon 服務
const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
```

### 錯誤處理

- 圖片加載失敗時自動切換到預設圖示
- 無效 URL 時顯示預設圖示
- 網路錯誤時優雅降級

### 性能考量

- 使用 `unoptimized` 屬性處理外部圖片
- 配置 `remotePatterns` 允許外部域名
- 小尺寸圖片減少載入時間

## 測試

可以使用 `test-favicon.html` 文件測試不同網站的 favicon 顯示效果。

## 未來改進

1. 添加 favicon 緩存機制
2. 支持自定義 favicon 上傳
3. 添加 favicon 品質檢測
4. 支持多種 favicon 格式