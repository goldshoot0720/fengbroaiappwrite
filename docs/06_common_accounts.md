# 鋒兄常用 (Common Accounts)

## 功能概述

集中管理常用網站帳號資訊，每個帳號群組最多可儲存 37 組網站連結與備忘筆記，支援 Favicon 自動顯示與行內編輯。

## 主要特點

- **37 組配對**：每個帳號群組可儲存最多 37 個網站連結與對應備忘。
- **行內編輯**：直接在列表中編輯各網站項目，無需開啟表單。
- **字母排序**：支援 A-Z / Z-A 自動排序切換。
- **Favicon 顯示**：自動載入網站圖示，內建常見網站的圖示路徑。
- **一鍵複製**：快速複製帳號與備忘內容到剪貼簿。
- **站點篩選**：依站點名稱快速過濾。
- **重複檢測**：驗證防止重複站點名稱。
- **CSV 匯入/匯出**：完整帳號備份與還原。

## 資料表結構 (Appwrite Collection: `commonaccount`)

| 欄位名稱 | 類型 | 長度 | 必填 | 說明 |
|----------|------|------|------|------|
| name | string | 100 | ✅ | 帳號群組名稱 |
| site01 ~ site37 | string | 100 | ❌ | 網站連結 (共 37 個) |
| note01 ~ note37 | string | 100 | ❌ | 備忘筆記 (共 37 個) |

> 總共 75 個欄位：1 個 name + 37 個 site + 37 個 note

## TypeScript 類型定義

```typescript
interface CommonAccount {
  $id: string;
  name: string;
  site01?: string; site02?: string; ... site37?: string;
  note01?: string; note02?: string; ... note37?: string;
  $createdAt?: string;
  $updatedAt?: string;
}
```

## CSV 格式

| # | 欄位 | 說明 |
|---|------|------|
| 1 | name | 群組名稱 |
| 2-38 | site01-site37 | 37 個網站連結 |
| 39-75 | note01-note37 | 37 個備忘筆記 |

## API 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/commonaccount` | 取得所有帳號群組 |
| POST | `/api/commonaccount` | 新增帳號群組 |
| GET | `/api/commonaccount/[id]` | 取得單筆帳號 |
| PUT | `/api/commonaccount/[id]` | 更新帳號群組 |
| DELETE | `/api/commonaccount/[id]` | 刪除帳號群組 |
| PUT | `/api/commonaccount/note/[id]` | 更新備忘筆記 |
| PUT | `/api/commonaccount/site/[id]` | 更新網站連結 |

## 技術規格

- **元件路徑**：`components/modules/CommonAccountManagement.tsx`
- **API 路徑**：`app/api/commonaccount/`
- **常數定義**：`lib/constants.ts` → `API_ENDPOINTS.COMMON_ACCOUNT`
- **Favicon 工具**：`lib/faviconUtils.ts`
