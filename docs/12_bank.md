# 鋒兄銀行 (Bank)

## 功能概述

銀行帳戶與財務資訊管理系統，記錄多個帳戶的存款、提款、轉帳限額與相關資訊。

## 主要特點

- **多帳戶管理**：支援記錄多個銀行帳戶。
- **餘額統計**：自動匯總所有帳戶的總存款。
- **快速金額調整**：±1000 按鈕快速調整金額。
- **網路銀行連結**：儲存網路銀行網址，Favicon 顯示。
- **活動追蹤**：帳戶活動記錄連結。
- **分行地址**：記錄銀行分行地址。
- **卡片資訊**：關聯的金融卡/信用卡資訊。
- **刪除確認**：刪除前需輸入「DELETE [銀行名稱]」防止誤刪。
- **CSV 匯入/匯出**：批次帳戶資料管理。

## 資料表結構 (Appwrite Collection: `bank`)

| 欄位名稱 | 類型 | 長度 | 必填 | 說明 |
|----------|------|------|------|------|
| name | string | 100 | ✅ | 銀行名稱 |
| deposit | integer | - | ❌ | 存款金額 |
| site | url | - | ❌ | 網路銀行連結 |
| address | string | 100 | ❌ | 分行地址 |
| withdrawals | integer | - | ❌ | 提款資訊 |
| transfer | integer | - | ❌ | 轉帳資訊 |
| activity | url | - | ❌ | 帳戶活動連結 |
| card | string | 100 | ❌ | 金融卡/信用卡資訊 |
| account | string | 100 | ❌ | 銀行帳號 |

## TypeScript 類型定義

```typescript
interface Bank {
  $id: string;
  name: string;
  deposit?: number;
  site?: string;
  address?: string;
  withdrawals?: number;
  transfer?: number;
  activity?: string;
  card?: string;
  account?: string;
  $createdAt: string;
  $updatedAt: string;
}
```

## CSV 格式

| # | 欄位 | 說明 |
|---|------|------|
| 1 | name | 銀行名稱 |
| 2 | deposit | 存款 |
| 3 | site | 網路銀行 URL |
| 4 | address | 分行地址 |
| 5 | withdrawals | 提款 |
| 6 | transfer | 轉帳 |
| 7 | activity | 活動連結 |
| 8 | card | 卡片資訊 |
| 9 | account | 帳號 |

## API 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/bank` | 取得所有銀行帳戶 |
| POST | `/api/bank` | 新增銀行帳戶 |
| GET | `/api/bank/[id]` | 取得單筆帳戶 |
| PUT | `/api/bank/[id]` | 更新帳戶 |
| DELETE | `/api/bank/[id]` | 刪除帳戶 |

## 技術規格

- **元件路徑**：`components/modules/BankManagement.tsx`
- **API 路徑**：`app/api/bank/`
- **常數定義**：`lib/constants.ts` → `API_ENDPOINTS.BANK`
