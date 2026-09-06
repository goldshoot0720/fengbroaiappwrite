# Command Code 自動帶入

在「鋒兄額度」新增或編輯資料時，服務類型選 **AI**，直接貼上 Command Code **API key** 即可。
也可貼整份 CLI `~/.commandcode/auth.json`；兩種方式都會帶入 5 小時、每週與每月的剩餘比例及重設時間。

Command Code 的方案本身有 rolling 5 小時、每週用量，以及每月 credits；官方的說明可見
[Pricing & Limits](https://commandcode.ai/docs/resources/pricing-limits)。

## 資料如何對應

| Command Code Usage | 鋒兄額度欄位 | 呈現規則 |
|---|---|---|
| 5-hour limit | `ratio5h` / `expiry5h` | `used ÷ cap` 換成剩餘百分比；重設時間以台北 `HH:mm` 顯示 |
| Weekly limit | `ratioWeek` / `expiryWeek` | `used ÷ cap` 換成剩餘百分比；重設日以台北 `YYYY-MM-DD` 顯示 |
| Monthly limit | `ratioMonth` / `expiryMonth` | 月 credits 剩餘量對照方案月額度；重設日取訂閱週期結束日 |

因此畫面若顯示「5-hour 0% used、Weekly 100%、Monthly 50%」，三張圖表會分別呈現
**100% 剩餘、0% 剩餘、50% 剩餘**。這些是同一個「剩餘比例」語意，並非把不同時間窗混在一起。

## 憑證與安全

- API key 或原始 `auth.json` 只在使用者貼入表單後由伺服器端使用；瀏覽器只收到比例、重設時間和末 4 碼提示。
- 寫入資料庫時會變成 `{ "commandCode": { ... } }` 的精簡格式，只保留 API key 與可用的帳號識別欄位，避免與 ChatGPT session JSON 混淆。
- 已儲存憑證的手動查詢需要全站四位數密碼；直接貼上的新檔案可先查詢、確認數字後再儲存。
- API key 不會出現在 `/api/quota`、圖表或自動更新的回應中。

## 更新時機與限制

- **保鮮期 10 分鐘**（`COMMAND_CODE_USAGE_FRESH_WINDOW_MS`）：自動更新會重用尚新的快照；按「更新用量」會強制讀取。
- 帳號與用量端點是 Command Code CLI 使用的非公開介面。若服務端欄位改動，該次會保留舊值並顯示解析錯誤，不會寫成 0%。
- 月額度需能識別方案與月 credits。未知方案或不完整回應只略過月卡資料，5 小時／每週若仍可讀取則照常更新。

## 技術位置

- 憑證解析：`lib/commandCodeSession.ts`
- 用量正規化／欄位轉換：`lib/commandCodeUsage.ts`
- 伺服器端讀取：`app/api/_lib/commandCodeClient.js`
- 手動查詢：`app/api/command-code-usage/route.js`
- 自動寫回：`app/api/quota-refresh/route.js`（`refreshCommandCodeRow`）
- 單元測試：`tests/unit/command-code-usage.test.mjs`、`tests/unit/command-code-client.test.mjs`、`tests/unit/command-code-refresh.test.mjs`
