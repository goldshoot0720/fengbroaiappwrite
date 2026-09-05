# MindVideo / GPT Image 2 專屬點數

在鋒兄額度新增或編輯資料，服務名稱填 `MindVideo/GPT Image 2`，帳號填簽到報告的完整標籤（如 `goldshoot0720`）或槽位（如 `30`）。點數會由既有「更新用量」及自動更新取得，資料寫入 `quotaPoints`、`pointsSyncedAt`；無須新增資料庫欄位。

## 資料來源（跟 LitMedia 同一套做法）

MindVideo 的做法完全照抄 LitMedia（見 [`19_quota.md`](./19_quota.md#litmedia-剩餘點數)）：
[AutoSignMindVideo](https://github.com/huang1988pioneer/AutoSignMindVideo) 每日簽到 workflow 跑完後，
會把 `streaks.json` 推到 `results` 分支，逐一列出每個帳號的一般點數（`totalCredits`/`remainingCredits`/`usedCredits`）
與 GPT Image 2 專屬點數（`gptImage2.remaining`）、`finishedAt`（讀到那個數字的時刻）。

伺服器端直接讀 `https://raw.githubusercontent.com/huang1988pioneer/AutoSignMindVideo/results/streaks.json`：
**免認證、不需要任何 GitHub Token**（不再像早期版本要設定 `MINDVIDEO_GITHUB_TOKEN` 去下載 Actions artifact——
artifact 下載一律要認證，public repo 也一樣；改推公開分支後就不必保管金鑰，也沒有 PAT 過期的問題）。

換 repo 或分支時可設定 `MINDVIDEO_STREAKS_URL`（選填），格式與預設值同上。

## 對帳號與寫回規則

| 步驟 | 做法 |
|------|------|
| 對帳號 | `帳號` 欄位可填槽位編號（`30`）或槽位標籤（`goldshoot0720`），比對簽到報告的 `account`／`label` |
| 只採信成功簽到的列 | 狀態須是 `checked_in` 或 `already_done`；`skipped`／`failed` 等一律當沒讀到 |
| 寫回 | `quotaPoints` 寫 `gptImage2.remaining`，`pointsSyncedAt` 寫 `finishedAt`（沒有就退而求其次用整份報告的 `generatedAt`） |
| 不覆蓋 | 帳號無法唯一比對、沒讀到值、或報告比已存資料舊時，保留原有點數，不洗成 0 |

畫面顯示的是**簽到時的數字**，不是即時餘額；當天若又生成圖片消耗點數，這個數字會偏高。

## 更新時機

- **保鮮期 33 分鐘**（`MINDVIDEO_FRESH_WINDOW_MS`）：跟 LitMedia 同一個理由——這個數字本來就來自幾小時前的簽到，給短了只是白跑。
- **手動更新**：按「更新用量」會 `force` 重讀（同一次更新多個帳號只讀一次來源，有模組內快取）。
- 真要拿到新數字，得回 AutoSignMindVideo 觸發一次 workflow。

## 技術規格

- **解析與正規化**：`lib/mindvideoPoints.ts`（`parseMindvideoStreaksReport`、`findMindvideoAccount`、`toMindvideoPointsFields`）
- **讀取與快取**：`app/api/_lib/mindvideoClient.js`
- **寫回流程**：`app/api/quota-refresh/route.js`（`refreshMindvideoRow`）
- **單元測試**：`tests/unit/mindvideo-points.test.mjs`

參考紀錄：<https://github.com/huang1988pioneer/AutoSignMindVideo/actions/runs/33988351792>
該次 goldshoot0720 為 93、abuhg17 為 98、chbondg2 為 95 點；這些數字僅供驗證，不是寫死的預設值。
