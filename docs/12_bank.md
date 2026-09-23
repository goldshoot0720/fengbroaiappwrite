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
- **三分頁**：銀行／電子票證／點數，依名稱自動判斷，也可在 `category` 手動指定。
- **多行備註**：備註為 textarea，可換行；列表以原樣多行顯示。
- **有效期限提醒**：填了 `expiry` 後，剩 0–7 天會進首頁待辦、完整儀表警示與 OS／推播通知。

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
| note | string | 500 | ❌ | 備註（可多行） |
| category | string | 20 | ❌ | `bank`／`ticket`／`points`；留空＝依名稱自動判斷 |
| expiry | datetime | - | ❌ | 有效期限（表單為 `YYYY-MM-DD`） |

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
  note?: string;
  category?: string;
  expiry?: string;
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
| 10 | note | 備註（多行會以雙引號包起來） |
| 11 | category | 分類，留空＝自動判斷 |
| 12 | expiry | 有效期限 `YYYY-MM-DD` |

> 舊備份欄位較少也能匯入：只要表頭是上表的前綴，缺的尾欄視為空值。

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
- **分類判斷**：`lib/bankClassification.ts`（`category` 優先，其次關鍵字推斷）
- **到期提醒窗口**：`lib/constants.ts` → `NOTIFY_WINDOW_DAYS.BANK_EXPIRY`（7 天）
- **到期收集（API）**：`app/api/_lib/expiryCollector.js` → `banks`
- **Email 到期通知**：`/api/resend-expiry-notify` 在有效期限 **剛好前 7 天** 寄出（`NOTIFICATION_POLICY.email.bankExactDays`）

---

## 相關文件

- [選單索引](./INDEX.md) - 返回文件總覽
- [儀表板說明](./02_dashboard.md) - 查看財務概覽與存款統計
- [訂閱管理](./03_subscription.md) - 訂閱服務與支出管理
- [常用帳號](./06_common_accounts.md) - 常用網站與連結管理
- [使用手冊](./USER_GUIDE.md) - 第十三章：銀行管理詳細教學
