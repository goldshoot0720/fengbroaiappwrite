# OiiOii 剩餘點數

「鋒兄額度」的服務名稱填 `OiiOii`（也接受 `OiiOii.ai`），帳號填 AutoSignOiiOii 報告中的帳號名稱或槽位編號。進入額度頁會沿用現有自動更新流程，也可以使用手動更新。

## 部署設定

伺服器環境變數 `OIIOII_GITHUB_TOKEN` 必填。使用可讀取 `huang1988pioneer/AutoSignOiiOii` 的 GitHub token；fine-grained token 需該 repository 的 **Actions: Read-only** 權限。僅設定在部署伺服器，勿放入 `NEXT_PUBLIC_*` 或額度列的 accessToken 欄位。設定後重新部署。

目前上游沒有公開 results 分支，GitHub artifact 下載需要驗證。未設定 Token 時，更新會回報設定需求並保留舊點數。

## 資料規則

- 查詢 `claim-oiioii-lunch.yml` 最近 10 次已完成執行，選第一份未過期的 `oiioii-claim-report` artifact，讀取根目錄的 `oiioii-daily-summary.json`。不固定 run ID。
- `rows[].name` 比對帳號名稱（忽略大小寫及前後空白），純數字比對 `rows[].account`。重複或找不到帳號時不寫入。
- 只採用 `checked_in` 且 `currentPoints` 為有限非負數的資料，寫入 `quotaPoints`；真實 0 點也顯示。
- `pointsSyncedAt` 採 `finishedAt`，缺少時才使用報告 `generatedAt`。資料比已存點數更舊時不覆蓋。
- 缺值、簽到失敗或來源錯誤均保留原值。這是簽到時的快照，不是 OiiOii 即時餘額。
- 報告快取 33 分鐘；同一輪多帳號只下載一次，手動強制更新會略過快取。

來源格式、驗證結果及原始碼連結見 [研究筆記](research/oiioii-quota.md)。
