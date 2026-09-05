# MindVideo / GPT Image 2 專屬點數

在鋒兄額度新增或編輯資料，服務名稱填 `MindVideo/GPT Image 2`，帳號填簽到報告的完整 label（如 `goldshoot0720`）或槽位（如 `30`）。點數會由既有「更新用量」及自動更新取得，資料寫入 `quotaPoints`、`pointsSyncedAt`；無須新增資料庫欄位。

部署環境需設定伺服器端 `MINDVIDEO_GITHUB_TOKEN`（也接受既有 `GITHUB_TOKEN`），Token 必須可讀取 `huang1988pioneer/AutoSignMindVideo` 的 Actions artifacts。建議 fine-grained Token 僅授予該 repository 的 Actions read。不要把 Token 放進 NEXT_PUBLIC 變數、額度列的 accessToken 或程式碼。設定後重新部署。

資料來源為最新未過期的 `mindvideo-checkin-report` artifact 中 `checkin-daily-summary.json` 的 `rows[].gptImage2.remaining`，與一般 MindVideo 點數分開。畫面顯示來源簽到時間，並非即時餘額。每 33 分鐘檢查更新；手動更新會略過快取。帳號無法唯一比對、簽到失敗、缺值或舊於已儲存資料時，不覆蓋原點數。

參考紀錄：https://github.com/huang1988pioneer/AutoSignMindVideo/actions/runs/33987465305
該次 goldshoot0720 為 93、abuhg17 為 98、chbondg2 為 95 點；這些數字僅供驗證，不是寫死的預設值。
