# 鋒兄首頁 (Home)

## 功能概述

鋒兄首頁是系統的入口點，為使用者提供整個管理系統的即時概覽與快速導航。

## 主要特點

- **系統標題**：顯示「鋒兄資訊管理系統」品牌標識與版本資訊。
- **快速入口**：跳到日常工作台、工具與子工具（完整清單見 [INDEX.md](./INDEX.md)）。
- **動態顯示**：根據系統狀態動態更新提示資訊。
- **響應式佈局**：自動適應桌面、平板與手機裝置。

## 導航選單

| # | 選單 ID | 選單名稱 | 圖示 | 說明 |
|---|---------|---------|------|------|
| 1 | home | 鋒兄首頁 | Home | 系統概覽與快速入口 |
| 2 | dashboard | 鋒兄儀表 | BarChart3 | 詳細數據統計與分析 |
| 3 | subscription | 鋒兄訂閱 | CreditCard | 訂閱服務與支出管理 |
| 4 | food | 鋒兄食品 | Package | 食品庫存與過期管理 |
| 5 | notes | 鋒兄筆記 | FileText | 筆記與文章管理 |
| 6 | common | 鋒兄常用 | Star | 常用帳號與連結管理 |
| 7 | images | 鋒兄圖片 | Image | 圖片藝廊管理 |
| 8 | videos | 鋒兄影片 | Play | 影片播放與管理 |
| 9 | music | 鋒兄音樂 | Music | 音樂播放與歌詞管理 |
| 10 | documents | 鋒兄文件 | File | 綜合文件管理 |
| 11 | podcast | 鋒兄播客 | Podcast | 播客音訊管理 |
| 12 | bank-stats | 鋒兄銀行 | BarChart3 | 銀行帳戶與財務記錄 |
| 13 | routine | 鋒兄例行 | CheckSquare | 例行公事管理 |
| 14 | settings | 鋒兄設定 | Settings | 系統配置管理 |
| 15 | about | 鋒兄關於 | Info | 系統版本與專案資訊 |

工具（比價、轉檔等）與子工具（Tube、金融、新聞）見 [INDEX.md](./INDEX.md)。

## 技術規格

- **元件路徑**：`app/page.tsx`
- **佈局元件**：`components/layout/DashboardLayout.tsx`
- **導航方式**：透過 `currentModule` 狀態切換動態元件渲染

---

## 相關文件

- [選單索引](./INDEX.md) - 返回文件總覽
- [儀表板說明](./02_dashboard.md) - 查看詳細數據統計
- [系統設定](./14_settings.md) - 配置系統參數
- [使用手冊](./USER_GUIDE.md) - 完整操作教學
