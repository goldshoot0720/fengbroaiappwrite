# 鋒兄AI管理系統 🚀

一個現代化的響應式管理系統，專為食品庫存和訂閱服務管理而設計。支援手機、平板和桌面設備，提供優雅的用戶體驗。

## ✨ 主要功能

### 📦 食品管理
- 智能庫存追蹤
- 過期日期提醒
- 數量快速調整
- 圖片支援
- 響應式卡片和表格視圖

### 💳 訂閱管理
- 訂閱服務追蹤
- 付款日期提醒
- 月費統計
- 到期狀態警示
- 快速網站訪問

### 📱 響應式設計
- **手機優先**：專為觸控設備優化
- **平板友好**：充分利用中等螢幕空間
- **桌面完整**：豐富的桌面體驗
- **PWA 支援**：可安裝為原生應用

## 🎨 設計特色

### 現代化 UI
- 漸變色彩方案
- 圓角設計語言
- 微妙陰影效果
- 流暢動畫過渡

### 響應式佈局
- 彈性網格系統
- 自適應導航
- 觸控友好的按鈕尺寸
- 智能內容重排

### 無障礙設計
- 語義化 HTML
- 鍵盤導航支援
- 適當的對比度
- 螢幕閱讀器友好

## 🛠️ 技術棧

- **框架**: Next.js 15 (App Router)
- **樣式**: Tailwind CSS + shadcn/ui
- **語言**: TypeScript
- **字體**: Geist Sans & Geist Mono
- **圖標**: Lucide React
- **後端**: Appwrite

## 📱 響應式斷點

```css
/* 手機 */
@media (max-width: 767px) {
  /* 單欄佈局，大按鈕，簡化導航 */
}

/* 平板 */
@media (min-width: 768px) and (max-width: 1023px) {
  /* 雙欄佈局，中等按鈕 */
}

/* 桌面 */
@media (min-width: 1024px) {
  /* 多欄佈局，完整功能 */
}
```

## 🚀 快速開始

1. **安裝依賴**
```bash
npm install
```

2. **配置環境變數**
確保 `.env` 文件包含正確的 Appwrite 配置

3. **啟動開發服務器**
```bash
npm run dev
```

4. **訪問應用**
打開 [http://localhost:3000](http://localhost:3000)

## 📂 項目結構

```
├── app/                    # Next.js App Router
│   ├── api/               # API 路由
│   │   ├── food/         # 食品 API
│   │   └── subscription/ # 訂閱 API
│   ├── globals.css        # 全局樣式
│   ├── layout.tsx         # 根佈局
│   └── page.tsx          # 主頁面
├── components/            # React 組件
│   ├── layout/           # 佈局組件
│   │   └── DashboardLayout.tsx
│   ├── modules/          # 功能模組
│   │   ├── FoodManagement.tsx
│   │   └── SubscriptionManagement.tsx
│   └── ui/              # shadcn/ui 組件
└── public/               # 靜態資源
    ├── manifest.json     # PWA 配置
    └── *.svg            # 圖標文件
```

## 🎯 響應式優化重點

### 手機體驗 (< 768px)
- ✅ 單欄佈局
- ✅ 大觸控按鈕 (最小 44px)
- ✅ 滑動式側邊欄
- ✅ 卡片式內容展示
- ✅ 簡化操作流程

### 平板體驗 (768px - 1023px)
- ✅ 雙欄佈局
- ✅ 適中的按鈕尺寸
- ✅ 混合導航模式
- ✅ 表格與卡片混合視圖

### 桌面體驗 (≥ 1024px)
- ✅ 多欄佈局
- ✅ 完整表格視圖
- ✅ 固定側邊欄
- ✅ 豐富的交互功能

## 🔧 自定義配置

### 主題色彩
在 `app/globals.css` 中修改 CSS 變數：

```css
:root {
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  /* 更多顏色變數... */
}
```

### 響應式斷點
在 `tailwind.config.js` 中自定義：

```js
module.exports = {
  theme: {
    screens: {
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
    }
  }
}
```

## 📈 性能優化

- ✅ 圖片懶加載
- ✅ 代碼分割
- ✅ CSS 優化
- ✅ 字體優化
- ✅ PWA 緩存策略

## 🌐 瀏覽器支援

- ✅ Chrome (最新版本)
- ✅ Firefox (最新版本)
- ✅ Safari (最新版本)
- ✅ Edge (最新版本)
- ✅ 移動瀏覽器

## 🚀 部署

構建生產版本:
```bash
npm run build
```

啟動生產服務器:
```bash
npm start
```

## 📄 授權

MIT License

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

---

**享受智能管理的便利！** 🎉