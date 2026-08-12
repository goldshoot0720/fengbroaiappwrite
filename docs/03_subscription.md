# 鋒兄訂閱 (Subscription)

## 功能概述

管理各類訂閱服務（串流媒體、軟體授權等），追蹤續費日期與費用，支援多幣別換算與到期通知。

## 主要特點

- **訂閱列表**：管理所有進行中與已取消的訂閱項目。
- **多幣別支援**：支援 TWD、USD、EUR、JPY、CNY、HKD，自動換算台幣顯示。
- **續費追蹤**：監控下次付款日期，快速 ±30 天調整。
- **狀態監控**：標記訂閱是否持續，Favicon 顯示服務圖示。
- **到期通知**：每日自動檢查 3 天內到期的訂閱，推播瀏覽器通知。
- **CSV 匯入/匯出**：完整 15 欄；仍可匯入舊的 8 欄 CSV。
- **封存**：`archived` 會藏進「已封存」篩選，資料仍在 Appwrite。
- **本機垃圾桶**：刪除後可還原；資料存在瀏覽器 `fengbro.subscription.trash`，不是 `archived` 欄位。

## 資料表結構 (Appwrite Collection: `subscription`)

建表 15 欄，表單與 API 都會讀寫。既有 8 欄資料表請到「鋒兄設定」按 **補欄位**（不會刪資料）。

| 欄位名稱 | 類型 | 長度 | 必填 | 預設值 | 說明 |
|----------|------|------|------|--------|------|
| name | string | 100 | ✅ | - | 訂閱服務名稱 |
| site | url | - | ❌ | - | 服務網站連結 |
| price | integer | - | ❌ | - | 費用金額 |
| nextdate | datetime | - | ❌ | - | 下次續費日期 |
| note | string | 3337 | ❌ | - | 備註 |
| account | string | 100 | ❌ | - | 登入帳號 |
| currency | string | 100 | ❌ | - | 幣別代碼 (TWD/USD/EUR/JPY/CNY/HKD) |
| continue | boolean | - | ❌ | true | 是否持續訂閱 |
| category | string | 100 | ❌ | - | 分類 |
| purpose | string | 100 | ❌ | - | 用途 |
| usageFrequency | string | 50 | ❌ | - | 使用頻率 |
| friendliness | string | 50 | ❌ | - | 友善度 |
| alternative | string | 200 | ❌ | - | 替代方案 |
| retentionRecommendation | string | 50 | ❌ | - | 去留建議 |
| archived | boolean | - | ❌ | false | 封存 |

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
  category?: string;
  purpose?: string;
  usageFrequency?: string;
  friendliness?: string;
  alternative?: string;
  retentionRecommendation?: string;
  archived?: boolean;
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
| 9–15 | category … archived | 完整格式才有；舊 8 欄仍可匯入 |

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

---

## 相關文件

- [選單索引](./INDEX.md) - 返回文件總覽
- [儀表板說明](./02_dashboard.md) - 查看訂閱統計與財務概覽
- [銀行管理](./12_bank.md) - 銀行帳戶與存款管理
- [使用手冊](./USER_GUIDE.md) - 第五章：訂閱管理詳細教學
