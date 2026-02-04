# 鋒兄食品 (Food)

## 功能概述

管理居家食品庫存，追蹤過期日期、數量與購買資訊，透過顏色預警避免食物浪費。

## 主要特點

- **庫存追蹤**：詳細記錄食品名稱、數量、到期日與購買資訊。
- **過期提醒**：四級顏色預警（正常/即將到期/緊急/已過期）。
- **快速調整**：±1 / ±10 數量按鈕，±1000 價格按鈕。
- **照片記錄**：上傳食品照片，支援 URL 或檔案上傳（50MB 限制）。
- **CSV 匯入/匯出**：批次資料匯入匯出。

## 資料表結構 (Appwrite Collection: `food`)

| 欄位名稱 | 類型 | 長度 | 必填 | 說明 |
|----------|------|------|------|------|
| name | string | 100 | ✅ | 食品名稱 |
| amount | integer | - | ❌ | 庫存數量 |
| price | integer | - | ❌ | 購買價格 |
| shop | string | 100 | ❌ | 購買商店 |
| todate | datetime | - | ❌ | 到期日期 |
| photo | url | - | ❌ | 照片連結 |
| photohash | string | 256 | ❌ | 照片快取雜湊 |

## TypeScript 類型定義

```typescript
interface Food {
  $id: string;
  name: string;
  amount: number;
  todate: string;
  photo: string;
  price?: number;
  shop?: string;
  photohash?: string;
}
```

## 到期狀態說明

| 狀態 | 顏色 | 條件 |
|------|------|------|
| 正常 | 綠色 | 距到期日超過 7 天 |
| 即將到期 | 黃色 | 距到期日 3-7 天 |
| 緊急 | 橘色 | 距到期日 3 天內 |
| 已過期 | 紅色 | 已超過到期日 |

## CSV 格式

| # | 欄位 | 說明 |
|---|------|------|
| 1 | name | 食品名稱 |
| 2 | amount | 數量 |
| 3 | todate | 到期日期 |
| 4 | photo | 照片 URL |
| 5 | price | 價格 |
| 6 | shop | 商店 |
| 7 | photohash | 照片雜湊 |

## API 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/food` | 取得所有食品 |
| POST | `/api/food` | 新增食品 |
| GET | `/api/food/[id]` | 取得單筆食品 |
| PUT | `/api/food/[id]` | 更新食品 |
| DELETE | `/api/food/[id]` | 刪除食品 |

## 技術規格

- **元件路徑**：`components/modules/FoodManagement.tsx`
- **API 路徑**：`app/api/food/`
- **常數定義**：`lib/constants.ts` → `API_ENDPOINTS.FOOD`
