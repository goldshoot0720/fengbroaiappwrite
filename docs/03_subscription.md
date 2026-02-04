# 鋒兄訂閱 (Subscription)

## 功能概述

管理各類訂閱服務（串流媒體、軟體授權等），追蹤續費日期與費用，支援多幣別換算與到期通知。

## 主要特點

- **訂閱列表**：管理所有進行中與已取消的訂閱項目。
- **多幣別支援**：支援 TWD、USD、EUR、JPY、CNY、HKD，自動換算台幣顯示。
- **續費追蹤**：監控下次付款日期，快速 ±30 天調整。
- **狀態監控**：標記訂閱是否持續，Favicon 顯示服務圖示。
- **到期通知**：每日自動檢查 3 天內到期的訂閱，推播瀏覽器通知。
- **CSV 匯入/匯出**：支援批次資料匯入匯出。

## 資料表結構 (Appwrite Collection: `subscription`)

| 欄位名稱 | 類型 | 長度 | 必填 | 預設值 | 說明 |
|----------|------|------|------|--------|------|
| name | string | 100 | ✅ | - | 訂閱服務名稱 |
| site | url | - | ❌ | - | 服務網站連結 |
| price | integer | - | ❌ | - | 費用金額 |
| nextdate | datetime | - | ❌ | - | 下次續費日期 |
| note | string | 100 | ❌ | - | 備註 |
| account | string | 100 | ❌ | - | 登入帳號 |
| currency | string | 100 | ❌ | - | 幣別代碼 (TWD/USD/EUR/JPY/CNY/HKD) |
| continue | boolean | - | ❌ | true | 是否持續訂閱 |

## TypeScript 類型定義

```typescript
interface Subscription {
  $id: string;
  name: string;
  site?: string;
  price: number;
  nextdate?: string;
  note?: string;
  account?: string;
  currency?: string;
  continue?: boolean;
}
```

## 幣別換算表

| 幣別 | 對台幣匯率 |
|------|-----------|
| TWD（台幣） | 1 |
| USD（美元） | 1 USD = 35 TWD |
| EUR（歐元） | 1 EUR = 40 TWD |
| JPY（日圓） | 1 JPY = 0.35 TWD |
| CNY（人民幣） | 1 CNY = 4.5 TWD |
| HKD（港幣） | 1 HKD = 4 TWD |

> 匯率為固定值，非即時匯率，僅供預估參考。

## CSV 格式

匯入/匯出 CSV 欄位順序：

| # | 欄位 | 說明 |
|---|------|------|
| 1 | name | 訂閱名稱 |
| 2 | site | 網站 URL |
| 3 | price | 費用金額 |
| 4 | nextdate | 下次續費日期 |
| 5 | note | 備註 |
| 6 | account | 帳號 |
| 7 | currency | 幣別 |
| 8 | continue | 是否持續 (true/false) |

## API 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/subscription` | 取得所有訂閱 |
| POST | `/api/subscription` | 新增訂閱 |
| GET | `/api/subscription/[id]` | 取得單筆訂閱 |
| PUT | `/api/subscription/[id]` | 更新訂閱 |
| DELETE | `/api/subscription/[id]` | 刪除訂閱 |

## 技術規格

- **元件路徑**：`components/modules/SubscriptionManagement.tsx`
- **API 路徑**：`app/api/subscription/`
- **常數定義**：`lib/constants.ts` → `API_ENDPOINTS.SUBSCRIPTION`
