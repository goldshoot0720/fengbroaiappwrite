# Claude（Claude Code OAuth）自動帶入

在鋒兄額度新增或編輯資料，服務類型選 **AI**，`accessToken` 欄位貼上 Claude 憑證，
即可自動帶入 5 小時／一週的剩餘比例與重設時間，做法跟 [ChatGPT/Codex](./19_quota.md#chatgpt-plus-自動帶入)
對稱，差異只在憑證形狀與 token 生命週期。

## 憑證從哪裡來

Claude Code CLI 登入後會把憑證存在：

- **Windows/Linux**：`~/.claude/.credentials.json`
- **macOS**：Keychain（`security find-generic-password -s "Claude Code-credentials" -w`）

把該檔案（或 Keychain 匯出）的內容整份貼進 **accessToken** 欄位即可，格式不拘：

- 整份 `.credentials.json`（帶 `claudeAiOauth` 外殼）
- 只有 `claudeAiOauth` 那個子物件
- 精簡格式 `{"accessToken":"...","refreshToken":"...","expiresAt":...}`
- 純 access token 字串（`sk-ant-oat01-...`）——能查詢，但過期後沒有 refresh token 可以自動換新，需要手動重貼

貼進去後系統一律轉成精簡格式存回去（`lib/claudeSession.ts` 的 `serializeClaudeCredential`），
不會保留 `scopes`／`subscriptionType`／`rateLimitTier` 等不需要的欄位。

## 跟 ChatGPT 最大的差異：access token 只活 ~60 分鐘

ChatGPT 的 accessToken 是 JWT，有效期數小時到數天，過期了系統只能提示「請重新取得」。
Claude 的 access token 短命很多，但配了一顆 refresh token，所以 `app/api/_lib/claudeClient.js`
在查詢前會先檢查是否過期（留 60 秒緩衝），過期就先用 refresh token 換一顆新的：

1. 查詢用量前，`expiresAt` 顯示已過期（或快過期）→ 先呼叫 refresh 端點換新
2. 查詢時收到 `401` → 視為 access token 提前失效，補一次 refresh 再重試一次
3. 只要換到新的 access token（無論查詢本身成功與否），新憑證（含**新的** refresh token）
   都會整組序列化寫回 `accessToken` 欄位——Anthropic 這條端點的 refresh token 是一次性的，
   舊的用過一次就作廢，沒寫回去下次就會失敗

也因此不像 ChatGPT 需要使用者每隔幾天手動重貼一次；只要 refresh token 沒被撤銷
（例如手動登出、或太久沒用被伺服器端清掉），這條額度就能一直自動續下去。

## 上游端點

非公開端點，欄位命名與行為隨時可能變動。做法取自社群逆向：
<https://github.com/Maciek-roboblog/Claude-Code-Usage-Monitor/issues/202>

```
GET https://api.anthropic.com/api/oauth/usage
Authorization: Bearer <accessToken>
anthropic-beta: oauth-2025-04-20
User-Agent: claude-code/<version>
Content-Type: application/json
```

**`User-Agent` 缺這個格式會被丟進限流特別嚴的桶子、持續收到 `429`**——這是我們一開始手動測試時
撞到的坑，補上正確格式的 UA 之後才打得通。可用 `CLAUDE_CODE_USER_AGENT` 環境變數覆寫版本號，
真的被限流時不用改程式碼重部署。

換新 access token 的端點：

```
POST https://console.anthropic.com/v1/oauth/token
Content-Type: application/json

{"grant_type":"refresh_token","refresh_token":"<refreshToken>","client_id":"9d1c250a-e61b-44d9-88ed-5944d1962f5e"}
```

`client_id` 是 Claude Code CLI 對外公開、固定不變的 OAuth client id，不是帳號密鑰。
這條端點本身也會限流（`429`），跟查詢用量共用同一套「稍後再試」的錯誤處理。

### 回應形狀（實測）

```json
{
    "five_hour":  { "utilization": 33.0, "resets_at": "2026-04-11T07:00:00.528743+00:00" },
    "seven_day":  { "utilization": 13.0, "resets_at": "2026-04-17T00:59:59.951713+00:00" },
    "seven_day_opus": null,
    "seven_day_sonnet": { "utilization": 1.0, "resets_at": "2026-04-16T03:00:00.951719+00:00" },
    "extra_usage": { "is_enabled": false, "monthly_limit": null, "used_credits": null, "utilization": null }
}
```

`utilization` 是**已用**百分比（跟鋒兄額度存「剩餘比例」相反，換算要 `100 - utilization`）。
`ratio5h`/`expiry5h` 取 `five_hour`；`ratioWeek`/`expiryWeek` 優先取 `seven_day`（全模型合計），
只有分模型的 `seven_day_opus`/`seven_day_sonnet` 時，取用量較高（剩餘較少）的那個當代表，
確保畫面顯示的是「最快會撞到的那道牆」。

## 更新時機

- **保鮮期 10 分鐘**（`CLAUDE_USAGE_FRESH_WINDOW_MS`）：官方端點對頻繁查詢敏感，社群回報安全下限
  是 180 秒一次，這裡給得寬鬆很多，避免自動更新把多帳號的請求疊起來觸發限流。
- **手動更新**：額度表單的「從 Claude 帶入用量」會 `force` 重讀一次（貼上未儲存的憑證也能直接測）。
- 遇到 `429` 兩條端點（查詢用量／換新 token）都一樣：稍後再試，不會自動重試到成功為止。

## 技術規格

- **憑證解析**：`lib/claudeSession.ts`（`readStoredClaudeCredential`、`serializeClaudeCredential`）
- **用量正規化／欄位轉換**：`lib/claudeUsage.ts`（`normalizeClaudeUsage`、`toClaudeQuotaFields`）
- **查詢與 refresh**：`app/api/_lib/claudeClient.js`（`loadClaudeSnapshot`）
- **手動查詢**：`app/api/claude-usage/route.js`
- **自動更新寫回**：`app/api/quota-refresh/route.js`（`refreshClaudeRow`）
- **單元測試**：`tests/unit/claude-usage.test.mjs`

## 已知限制 / 待辦

- 額度表單目前還沒有像 ChatGPT 那樣的專屬「貼上→帶入」UI（`components/modules/QuotaManagement.tsx`
  的 `CodexAccessTokenField`）；`/api/claude-usage` 已經可以直接呼叫測試，介面整合是後續工作。
- `client_id` 與 `User-Agent` 都是靠社群逆向得到，Anthropic 隨時可能調整或直接擋掉非官方 CLI 的呼叫，
  失敗時應該安靜降級（沿用舊數字），不要讓整個 `/api/quota-refresh` 掛掉——`refreshClaudeRow` 已經
  照這個原則寫，單一帳號出錯不影響其他帳號。
