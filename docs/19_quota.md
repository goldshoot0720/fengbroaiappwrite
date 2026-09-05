# 鋒兄額度 (Quota)

## 功能概述

依「服務 × 帳號」追蹤剩餘額度、比例與到期日。AI 服務可再分 5 小時／一週／一月三段。
有 ChatGPT Plus 的帳號可填 `accessToken`，直接從 Codex 帶入最新用量，
不必手抄 <https://chatgpt.com/codex/cloud/settings/analytics#usage>。

## ChatGPT Plus 自動帶入

### accessToken 從哪裡來

1. 瀏覽器登入 ChatGPT 後開 <https://chatgpt.com/api/auth/session>。
2. 整份 JSON 存成 `session.json`（或直接複製內容）。
3. 編輯該筆額度紀錄（服務類型選 **AI**），把整份 JSON 貼進 **accessToken** 欄位。

貼整份 session.json 時只取出 `accessToken` 與 `account.id` 存進資料庫，**不會**寫入 `sessionToken`。
也可以只貼純 token（`eyJ...`）。Token 有效期約數小時到數天，過期時會提示重新取得。

### 帶入的欄位

按 **從 ChatGPT 帶入用量** 後，會依 Codex 回傳填好表單（仍需按儲存）：

| 畫面欄位 | 來源 | 範例 |
|----------|------|------|
| 5 小時比例（%） | 5 小時視窗剩餘百分比 | `0`（已達使用上限） |
| 5 小時到期 | 5 小時視窗重設時間（本地 HH:mm） | `17:28` |
| 一週比例（%） | 每週視窗剩餘百分比 | `53` |
| 一週到期 | 每週視窗重設時間（本地 YYYY-MM-DD） | `2026-09-11` |
| 額度剩餘次數 | 剩餘積分（可讓用量超出方案限制） | `0` |

一月比例／到期不在 Codex 回傳範圍，維持手動填寫。

### 清單顯示

- 比例為 `0%` 且有填重設時間 → 顯示 `0% 剩餘`；**只有設定過 accessToken 的紀錄**才會再加上紅色的
  **「已達使用上限」**警告 —— 手動填的數字不保證是最新的，不該拿來示警。
  只有 0 而沒填重設時間視為「還沒填」，整段不顯示。
- 同一服務底下的帳號依**下次重設時間由近到遠**排序；5 小時只存 `HH:mm`，
  所以取「從現在算起的下一次」——今天還沒到就是今天，已經過了就是明天。
  沒有任何重設時間的排最後。

## 四位數密碼

`accessToken` **預設隱藏**：

| 情境 | 行為 |
|------|------|
| 清單顯示 | 只有 `••••••••` + 末 4 碼 |
| 看明文 | 按「顯示」→ 輸入四位數密碼 → 30 秒後自動遮回 |
| 用已存的 token 帶入用量 | 需輸入四位數密碼 |
| 剛貼上新 token 就帶入 | 不需密碼（本來就是自己剛輸入的） |

四位數密碼是**全站共用**的一組，比照 Resend 通知密碼：**沒有預設值，第一次使用時自己建立。**

| 項目 | 說明 |
|------|------|
| 設定位置 | **鋒兄設定 →「四位數密碼」** |
| 適用範圍 | 全站共用；目前用於顯示 accessToken 明文與帶入 ChatGPT 用量 |
| 儲存位置 | Appwrite `notificationsettings` 表（documentId `pin`），以 scrypt hash 存放 |
| 未設定時 | 「顯示」與「從 ChatGPT 帶入用量」回 `428`；額度頁會出現前往鋒兄設定的按鈕 |
| 格式 | 必須是四位數字 |
| 驗證位置 | API route，密碼不會進前端 bundle，也不會回傳給瀏覽器 |

不寫死在程式碼、也不放環境變數 —— 跟 Resend API Key 一樣，密碼是資料而不是設定檔。
忘記只能重設，無法查回。

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/access-pin` | 回報有沒有設定過（`{ hasPin }`） |
| PUT | `/api/access-pin` | 首次建立（`newPin`）或變更（`pin` + `newPin`） |

`GET /api/quota` **永遠不回傳** `accessToken` 明文，只給 `hasAccessToken` 與 `accessTokenHint`。

## 資料表結構 (Appwrite Collection: `quota`)

共 15 欄。`quotaPoints` 是新加的第 15 欄。

| 欄位名稱 | 類型 | 長度 | 說明 |
|----------|------|------|------|
| name | string | 100 | 服務名稱（必填） |
| serviceType | string | 20 | `general` / `ai` |
| account | string | 200 | 帳號 |
| quotaRemaining | integer | - | 額度剩餘次數（ChatGPT 帶入時放剩餘積分） |
| quotaPoints | integer | - | 額度剩餘點數（點數／積分制方案，手動填寫） |
| quotaRatio | integer | - | 額度剩餘比例 % |
| quotaExpiry | datetime | - | 額度到期日 |
| ratio5h | integer | - | 5 小時剩餘比例 %（AI） |
| expiry5h | string | 10 | 5 小時重設時間 `HH:mm`（AI） |
| ratioWeek | integer | - | 一週剩餘比例 %（AI） |
| expiryWeek | string | 10 | 一週重設日 `YYYY-MM-DD`（AI） |
| ratioMonth | integer | - | 一月剩餘比例 %（AI） |
| expiryMonth | string | 10 | 一月重設日 `YYYY-MM-DD`（AI） |
| note | string | 3337 | 備註 |
| accessToken | string | 5000 | ChatGPT / Codex 憑證，見上 |

既有的 14 欄資料表**不必重建**：到「鋒兄設定」重跑 `quota` 初始化即可，
`initializeManagementTable` 是非破壞性的，只補缺少的欄位、不刪資料。

服務類型改成非 AI 時，`accessToken` 會連同 5 小時／一週／一月欄位一起清空。

## API 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/quota` | 取得全部額度紀錄（不含 accessToken 明文） |
| POST | `/api/quota` | 新增 |
| PUT | `/api/quota/[id]` | 更新（accessToken 留空＝不變更） |
| DELETE | `/api/quota/[id]` | 刪除 |
| POST | `/api/quota/[id]/access-token` | 通過四位數密碼後回傳明文 token |
| POST | `/api/chatgpt-usage` | 查 Codex 用量（`quotaId` + `pin`，或直接給 `accessToken`） |

共用密碼的 `/api/access-pin` 見上方「四位數密碼」。

## 上游端點

ChatGPT 用量 API 未公開，欄位名稱會隨版本變動，因此依序嘗試並做欄位容錯：

1. `https://chatgpt.com/backend-api/wham/usage`
2. `https://chatgpt.com/backend-api/codex/usage`
3. `https://chatgpt.com/backend-api/wham/rate-limit-reset-credits`（重設點數）

送出標頭 `Authorization: Bearer <accessToken>` 與 `ChatGPT-Account-Id`（由 JWT claim 或 session.json 取得）。
`used_percent` / `usedPercent`、`resets_at` / `resetsInSeconds`、`window_minutes` / `limit_window_seconds`
等寫法都吃得下；兩個端點都失敗時會顯示錯誤，請改看官方用量頁。

## 技術規格

- **元件路徑**：`components/modules/QuotaManagement.tsx`
- **共用元件**：`components/ui/access-token-reveal.tsx`
- **憑證解析**：`lib/chatgptSession.ts`
- **用量正規化／欄位轉換**：`lib/codexUsage.ts`
- **共用密碼**：`app/api/_lib/accessPin.js` · `components/modules/SettingsManagement.tsx`（AccessPinSettings）
- **表單與 Schema**：`lib/managementRecords.ts`
- **單元測試**：`tests/unit/codex-usage.test.mjs`

---

## 相關文件

- [選單索引](./INDEX.md) - 返回文件總覽
- [訂閱說明](./03_subscription.md) - 訂閱費用與扣款日
- [鋒兄設定](./14_settings.md) - 建表與補欄位
