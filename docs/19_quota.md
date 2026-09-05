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

## LitMedia 剩餘點數

LitMedia 的點數**不是即時查來的**。它的用量 API
(`litvideo-api.litmedia.ai/lit-video/get-user-info`) 要求請求簽章，
不論帶不帶 token 都回 `{"code":4011,"msg":"The sign failed"}`，簽章檢查排在認證之前。

所以點數改成取自 [AutoSignLitVideo](https://github.com/huang1988pioneer/AutoSignLitVideo)：
那支每日簽到 workflow 每次成功都會上傳 `litmedia-streaks-<runId>` artifact，
裡面 `streaks.json` 逐一列出每個帳號的 `creditBalance`（剩餘點數）與 `finishedAt`（讀到的時刻）。

| 步驟 | 做法 |
|------|------|
| 找資料 | GitHub API 取最近 5 次成功 run，挑第一個還留著 `litmedia-streaks-*` artifact 的 |
| 取資料 | 下載 artifact zip，用 jszip 解出 `streaks.json` |
| 對帳號 | **服務名稱含 LitMedia 的列，直接用「帳號」對槽位名**（`abuhg17` ↔ `abuhg17-checkin (20)`）；對不上時才需要 `litmediaAccount` 明確指定槽位 |
| 寫回 | `quotaPoints` 寫點數，`pointsSyncedAt` 寫 `finishedAt` |

### 為什麼要另存 pointsSyncedAt

`$updatedAt` 是**我們寫進 Appwrite 的時間**，不是點數被量到的時間。
兩者可能差好幾個小時（13:03 簽到讀到的數字，21:30 才同步進來），
沿用 `$updatedAt` 會讓畫面顯示「更新於 剛剛」，等於謊報新鮮度。
所以清單顯示的是 `pointsSyncedAt`：**`09/05 20:56 簽到時的數字（3 小時前）`**。

當天若又生成影片消耗點數，這個數字會偏高——文案標明是「那次簽到當下」，差距由使用者自行判斷。

### 更新時機

- **保鮮期 33 分鐘**（`LITMEDIA_FRESH_WINDOW_MS`）：33 分鐘內沿用現有數字，不重複跟 GitHub 要 artifact。
  ChatGPT 是即時查詢所以只給 5 分鐘，LitMedia 的數字本來就來自幾小時前的簽到，給短了只是白跑。
- **手動更新**：按「更新用量」會 `force` 重抓（同一次更新 33 個帳號只跟 GitHub 要一次，有模組內快取）。
- 真要拿到新數字，得回 AutoSignLitVideo 觸發一次 workflow，約 8 分鐘後才有結果。

### 需要的設定

- `LITMEDIA_GITHUB_TOKEN`：有 `actions:read` 權限的 GitHub PAT（public repo 下載 artifact 一樣要認證）。沒設定就不帶入，其他功能不受影響。
- `LITMEDIA_SIGN_REPO`：選填，預設 `huang1988pioneer/AutoSignLitVideo`。
- 額度列的**服務名稱要含「LitMedia」**，帳號填簽到用的名稱（`goldshoot0720`）就會自動對上；
  名稱對不起來時，才在「LitMedia 簽到帳號」填槽位編號（`19`）覆蓋。
  兩者都沒有的列完全不碰。

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

共 17 欄。`litmediaAccount` 與 `pointsSyncedAt` 是新加的第 16、17 欄。

| 欄位名稱 | 類型 | 長度 | 說明 |
|----------|------|------|------|
| name | string | 100 | 服務名稱（必填） |
| serviceType | string | 20 | `general` / `ai` |
| account | string | 200 | 帳號 |
| quotaRemaining | integer | - | 額度剩餘次數（ChatGPT 帶入時放剩餘積分） |
| quotaPoints | integer | - | 額度剩餘點數（LitMedia 會自動帶入） |
| litmediaAccount | string | 100 | LitMedia 每日簽到的帳號槽位（`19` 或 `goldshoot0720-checkin`），見上 |
| pointsSyncedAt | datetime | - | 點數量測時刻＝上次簽到成功的時間，**不是**寫入時間 |
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

既有的 15 欄資料表**不必重建**：到「鋒兄設定」重跑 `quota` 初始化即可，
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
