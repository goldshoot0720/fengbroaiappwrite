# 鋒兄管理資訊系統 - 選單結構索引

本文件列出了「鋒兄管理資訊系統」的所有功能選單結構及其對應的說明文件。

> **文件位置**: `docs/INDEX.md`  
> **最後更新**: 2026-03-12

---

## 選單列表

| # | 模組名稱 | 說明 | 說明文件 |
|---|---------|------|---------|
| 1 | [鋒兄首頁](./01_home.md) | 系統概覽與快速入口 | [01_home.md](./01_home.md) |
| 2 | [鋒兄儀表](./02_dashboard.md) | 詳細數據統計與分析圖表 | [02_dashboard.md](./02_dashboard.md) |
| 3 | [鋒兄訂閱](./03_subscription.md) | 訂閱服務與定期支出管理 | [03_subscription.md](./03_subscription.md) |
| 4 | [鋒兄食品](./04_food.md) | 食品庫存、分類與過期管理 | [04_food.md](./04_food.md) |
| 5 | [鋒兄筆記](./05_notes.md) | 多功能筆記系統，支援附件與預覽 | [05_notes.md](./05_notes.md) |
| 6 | [鋒兄常用](./06_common_accounts.md) | 常用帳號、網站與連結管理 | [06_common_accounts.md](./06_common_accounts.md) |
| 7 | [鋒兄圖片](./07_images.md) | 圖片上傳、瀏覽與藝廊管理 | [07_images.md](./07_images.md) |
| 8 | [鋒兄影片](./08_videos.md) | 影片串流播放、佇列與快取管理 | [08_videos.md](./08_videos.md) |
| 9 | [鋒兄音樂](./09_music.md) | 音樂播放、歌詞顯示與專輯管理 | [09_music.md](./09_music.md) |
| 10 | [鋒兄文件](./10_documents.md) | 綜合文件管理（PDF、Office、程式碼、ZIP） | [10_documents.md](./10_documents.md) |
| 11 | [鋒兄播客](./11_podcast.md) | 播客音訊/視訊播放與快取管理 | [11_podcast.md](./11_podcast.md) |
| 12 | [鋒兄銀行](./12_bank.md) | 銀行帳戶、餘額與財務記錄 | [12_bank.md](./12_bank.md) |
| 13 | [鋒兄例行](./13_routine.md) | 例行公事、日期遞移與週期性任務管理 | [13_routine.md](./13_routine.md) |
| 14 | [鋒兄設定](./14_settings.md) | 系統配置、資料庫管理、儲存空間與主題切換 | [14_settings.md](./14_settings.md) |
| 15 | [鋒兄關於](./15_about.md) | 更新內容、系統架構與文件中心 | [15_about.md](./15_about.md) |

---

## 資料庫 Table 結構總覽

| # | Collection 名稱 | 欄位數 | 對應模組 | 說明文件 |
|---|----------------|--------|---------|---------|
| 1 | food | 7 | 鋒兄食品 | [04_food.md](./04_food.md) |
| 2 | subscription | 8 | 鋒兄訂閱 | [03_subscription.md](./03_subscription.md) |
| 3 | article | 17 | 鋒兄筆記 | [05_notes.md](./05_notes.md) |
| 4 | commonaccount | 75 | 鋒兄常用 | [06_common_accounts.md](./06_common_accounts.md) |
| 5 | bank | 9 | 鋒兄銀行 | [12_bank.md](./12_bank.md) |
| 6 | routine | 7 | 鋒兄例行 | [13_routine.md](./13_routine.md) |
| 7 | image | 8 | 鋒兄圖片 | [07_images.md](./07_images.md) |
| 8 | video | 8 | 鋒兄影片 | [08_videos.md](./08_videos.md) |
| 9 | music | 10 | 鋒兄音樂 | [09_music.md](./09_music.md) |
| 10 | podcast | 8 | 鋒兄播客 | [11_podcast.md](./11_podcast.md) |
| 11 | commondocument | 8 | 鋒兄文件 | [10_documents.md](./10_documents.md) |

---

## 其他文件

| 文件名稱 | 說明 |
|---------|------|
| [公司簡介](./00_company_introduction.md) | 鋒兄塗哥公關資訊公司介紹 |
| [使用手冊](./USER_GUIDE.md) | 完整使用者教學手冊（詳細操作說明） |

---

## 文件導航

```
docs/
├── INDEX.md              # 本文件：選單結構索引
├── USER_GUIDE.md         # 完整使用手冊
├── 00_company_introduction.md  # 公司簡介
├── 01_home.md            # 鋒兄首頁
├── 02_dashboard.md       # 鋒兄儀表
├── 03_subscription.md    # 鋒兄訂閱
├── 04_food.md            # 鋒兄食品
├── 05_notes.md           # 鋒兄筆記
├── 06_common_accounts.md # 鋒兄常用
├── 07_images.md          # 鋒兄圖片
├── 08_videos.md          # 鋒兄影片
├── 09_music.md           # 鋒兄音樂
├── 10_documents.md       # 鋒兄文件
├── 11_podcast.md         # 鋒兄播客
├── 12_bank.md            # 鋒兄銀行
├── 13_routine.md         # 鋒兄例行
├── 14_settings.md        # 鋒兄設定
└── 15_about.md           # 鋒兄關於
```

---

**文件版本**: v1.2.0  
**維護者**: 鋒兄塗哥公關資訊
