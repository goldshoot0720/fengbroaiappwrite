# 鋒兄管理資訊系統 - 選單結構索引

本文件對齊 `app/page.tsx` 的真實選單與 `app/api/create-table/route.js` 的建表清單。

> **文件位置**: `docs/INDEX.md`  
> **最後更新**: 2026-08-13  
> **來源**: 主頁選單 + 設定頁可建立的 collection

日常 CRUD 的操作細節仍見各模組文件與 [USER_GUIDE.md](./USER_GUIDE.md)。工具／子工具尚未拆成獨立說明檔時，以程式入口為準。

---

## 日常工作台

| # | 模組名稱 | 說明 | 說明文件 |
|---|---------|------|---------|
| 1 | [鋒兄首頁](./01_home.md) | 系統概覽與快速入口 | [01_home.md](./01_home.md) |
| 2 | [鋒兄儀表](./02_dashboard.md) | 跨模組統計、到期與媒體流量 | [02_dashboard.md](./02_dashboard.md) |
| 3 | [鋒兄訂閱](./03_subscription.md) | 訂閱、扣款日、CSV、本機垃圾桶 | [03_subscription.md](./03_subscription.md) |
| 4 | [鋒兄食品](./04_food.md) | 食品／商品庫存與過期管理 | [04_food.md](./04_food.md) |
| 5 | [鋒兄筆記](./05_notes.md) | 筆記、附件預覽、本機垃圾桶 | [05_notes.md](./05_notes.md) |
| 6 | [鋒兄文件](./10_documents.md) | PDF、Office、程式碼、ZIP | [10_documents.md](./10_documents.md) |
| 7 | [鋒兄常用](./06_common_accounts.md) | 常用帳號、網站與連結 | [06_common_accounts.md](./06_common_accounts.md) |
| 8 | [鋒兄圖片](./07_images.md) | 圖片上傳、藝廊與快取 | [07_images.md](./07_images.md) |
| 9 | [鋒兄影片](./08_videos.md) | 串流播放、佇列與快取 | [08_videos.md](./08_videos.md) |
| 10 | [鋒兄音樂](./09_music.md) | 播放、歌詞、佇列與快取 | [09_music.md](./09_music.md) |
| 11 | [鋒兄播客](./11_podcast.md) | 播客播放、批次上傳與快取 | [11_podcast.md](./11_podcast.md) |
| 12 | [鋒兄銀行](./12_bank.md) | 銀行帳戶、電子票證與餘額 | [12_bank.md](./12_bank.md) |
| 13 | [鋒兄例行](./13_routine.md) | 例行公事與日期遞移 | [13_routine.md](./13_routine.md) |
| 14 | [鋒兄設定](./14_settings.md) | Appwrite、建表、儲存與主題 | [14_settings.md](./14_settings.md) |
| 15 | [鋒兄關於](./15_about.md) | 更新內容、架構與文件中心 | [15_about.md](./15_about.md) |

桌面主選單是水平 Top Nav：第一列為鋒兄首頁、鋒兄管理、工具、設定；第二列依目前選取的主選單顯示葉模組。鋒兄首頁包含首頁、儀表、訂閱；鋒兄管理包含食品、常用、銀行、筆記、音樂、圖片、影片、文件、播客、例行。上表列出可點進的葉模組。手機維持底欄快捷 + 全部模組選單。

---

## 鋒兄工具

| # | 模組名稱 | 說明 | 程式入口 |
|---|---------|------|---------|
| 16 | 鋒兄比價 | 手動商品與價格紀錄 | `ManualPriceTracker.tsx` · `/api/manualprice` |
| 17 | 手機比價 | 地標網通 + 傑昇通信，週期歷史 | `ToolsManagement.tsx` · `/api/landtop` |
| 18 | 圖片 + 語音 = 影片 | FFmpeg 合成 | `ImageVoiceVideoTool.tsx` · `/api/image-voice-video` |
| 19 | PNG / JPEG 轉換 | 圖片格式轉換 | `ImageFormatConvertTool.tsx` |
| 20 | 影片合併 | 多段影片合併 | `VideoMergeTool.tsx` |
| 21 | YT / B站轉 MP3/MP4 | 下載轉檔 | `YoutubeBilibiliConvertTool.tsx` · `/api/youtube-bilibili-convert` |

工具殼層：`components/modules/ToolsManagement.tsx`。

---

## 鋒兄子工具

| # | 模組名稱 | 說明 | 程式入口 |
|---|---------|------|---------|
| 22 | 鋒兄Tube | 頻道最新影片與倒台指數 | `ToolsManagement.tsx` · `/api/fengbro-tube` |
| 23 | 鋒兄金融 | CNBC / Yahoo 報價、自訂標的 CSV | `ToolsManagement.tsx` · `/api/fengbro-finance` |
| 24 | 鋒兄新聞 | 鎖定網站焦點、人口與便當等面板 | `FengbroNewsTool.tsx` · `/api/fengbro-news` |

---

## 關於頁子頁

這些入口只在「鋒兄關於」內顯示，不在主選單。

| 子頁 | 說明 |
|------|------|
| Bilibili 資訊 | 平台說明 |
| MindVideo / LitVideo / Musicful / Digen / OiiOii | 對應 AutoSign 服務的固定 GitHub Actions 快照 |

---

## 資料庫 Table 結構總覽

設定頁可建立 **13** 個 collection。欄位數以 `TABLE_SCHEMAS` 為準。

| # | Collection 名稱 | 欄位數 | 對應模組 | 說明文件 |
|---|----------------|--------|---------|---------|
| 1 | food | 7 | 鋒兄食品 | [04_food.md](./04_food.md) |
| 2 | subscription | 15 | 鋒兄訂閱 | [03_subscription.md](./03_subscription.md) |
| 3 | article | 17 | 鋒兄筆記 | [05_notes.md](./05_notes.md) |
| 4 | commonaccount | 75 | 鋒兄常用 | [06_common_accounts.md](./06_common_accounts.md) |
| 5 | bank | 9 | 鋒兄銀行 | [12_bank.md](./12_bank.md) |
| 6 | routine | 7 | 鋒兄例行 | [13_routine.md](./13_routine.md) |
| 7 | image | 8 | 鋒兄圖片 | [07_images.md](./07_images.md) |
| 8 | video | 9 | 鋒兄影片 | [08_videos.md](./08_videos.md) |
| 9 | music | 10 | 鋒兄音樂 | [09_music.md](./09_music.md) |
| 10 | podcast | 8 | 鋒兄播客 | [11_podcast.md](./11_podcast.md) |
| 11 | commondocument | 8 | 鋒兄文件 | [10_documents.md](./10_documents.md) |
| 12 | landtophistory | 9 | 手機比價 | `app/api/_lib/landtopHistory.js` |
| 13 | manualprice | 4 | 鋒兄比價 | `/api/manualprice` |

另有 Web Push 訂閱 collection，由 `/api/push-subscribe` 動態建立，不在一鍵建表清單裡。

---

## 其他文件

| 文件名稱 | 說明 |
|---------|------|
| [公司簡介](./00_company_introduction.md) | 鋒兄塗哥公關資訊公司介紹 |
| [使用手冊](./USER_GUIDE.md) | 日常 CRUD 操作；選單與表數以本 INDEX 為準 |
| [系統架構](./SYSTEM_ARCHITECTURE.md) | 分層說明；規模數字以 `config/codebase-stats.json` 為準 |
| [產品定位](../PRODUCT.md) | 使用者、品牌與設計原則 |

---

## 文件導航

```
docs/
├── INDEX.md              # 本文件：選單與資料表現況
├── USER_GUIDE.md         # 日常 CRUD 使用手冊
├── SYSTEM_ARCHITECTURE.md
├── 00_company_introduction.md
├── 01_home.md … 15_about.md
├── agents/               # 代理協作規則
├── design/               # UI/UX 設計稿
└── research/             # 外部服務考證
```

---

**文件版本**: v1.3.0  
**維護者**: 鋒兄塗哥公關資訊
