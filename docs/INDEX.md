# 鋒兄管理資訊系統 - 選單結構索引

本文件對齊 `app/page.tsx` 的真實選單與 `app/api/create-table/route.js` 的建表清單。

> **文件位置**: `docs/INDEX.md`  
> **最後更新**: 2026-09-03  
> **來源**: 主頁選單 + 設定頁可建立的 collection

日常 CRUD 的操作細節仍見各模組文件與 [USER_GUIDE.md](./USER_GUIDE.md)。工具／子工具尚未拆成獨立說明檔時，以程式入口為準。

---

## 日常工作台

| # | 模組名稱 | 說明 | 說明文件 |
|---|---------|------|---------|
| 1 | [鋒兄首頁](./01_home.md) | 系統總覽、快速入口與完整儀表（同頁切換） | [01_home.md](./01_home.md) |
| 2 | [鋒兄訂閱](./03_subscription.md) | 訂閱、扣款日、CSV、本機垃圾桶 | [03_subscription.md](./03_subscription.md) |
| 3 | [鋒兄食品](./04_food.md) | 食品／商品庫存與過期管理 | [04_food.md](./04_food.md) |
| 4 | [鋒兄筆記](./05_notes.md) | 筆記、附件預覽、本機垃圾桶 | [05_notes.md](./05_notes.md) |
| 5 | [鋒兄文件](./10_documents.md) | PDF、Office、程式碼、ZIP | [10_documents.md](./10_documents.md) |
| 6 | [鋒兄常用](./06_common_accounts.md) | 常用帳號、網站與連結 | [06_common_accounts.md](./06_common_accounts.md) |
| 7 | [鋒兄圖片](./07_images.md) | 圖片上傳、藝廊與快取 | [07_images.md](./07_images.md) |
| 8 | [鋒兄影片](./08_videos.md) | 串流播放、佇列與快取 | [08_videos.md](./08_videos.md) |
| 9 | [鋒兄音樂](./09_music.md) | 播放、歌詞、佇列與快取 | [09_music.md](./09_music.md) |
| 10 | [鋒兄播客](./11_podcast.md) | 播客播放、批次上傳與快取 | [11_podcast.md](./11_podcast.md) |
| 11 | [鋒兄銀行](./12_bank.md) | 銀行帳戶、電子票證與餘額 | [12_bank.md](./12_bank.md) |
| 12 | [鋒兄例行](./13_routine.md) | 例行公事與日期遞移 | [13_routine.md](./13_routine.md) |
| 13 | [鋒兄設定](./14_settings.md) | Appwrite、建表、儲存與主題 | [14_settings.md](./14_settings.md) |
| 14 | [鋒兄關於](./15_about.md) | 更新內容、架構與文件中心 | [15_about.md](./15_about.md) |
| 15 | [鋒兄試用/首購](./16_trial_purchase.md) | 服務下多帳號、試用／首購狀態與試用／首購／到期日（扣款日） | [16_trial_purchase.md](./16_trial_purchase.md) |
| 16 | [鋒兄重灌](./17_reinstall.md) | Windows／Mac 軟體、隱藏序號、查看密碼、訂閱週期與費用 | [17_reinstall.md](./17_reinstall.md) |
| 17 | 鋒兄額度 | 依服務追蹤剩餘額度、比例與到期日（AI／非 AI） | 見 `QuotaManagement.tsx` |
| 18 | [鋒兄購物清單](./18_shopping_list.md) | 商品、預定購買日、價格（多幣別）、商店與取貨方式 | [18_shopping_list.md](./18_shopping_list.md) |

桌面主選單是水平 Top Nav：第一列為鋒兄首頁、鋒兄管理、鋒兄工具、設定；第二列依目前選取的主選單顯示葉模組。鋒兄首頁包含首頁（同一頁可切精簡待辦與完整儀表）；鋒兄管理包含訂閱、試用/首購、重灌、額度、食品、購物清單、常用、銀行、筆記、音樂、圖片、影片、文件、播客、例行；鋒兄工具包含金融、新聞、比價、手機、Tube、圖片+語音=影片、PNG/JPEG、影片合併、YouTube/Bilibili。上表列出可點進的葉模組。手機維持底欄快捷 + 全部模組選單。

---

## 鋒兄工具

| # | 模組名稱 | 說明 | 程式入口 |
|---|---------|------|---------|
| 17 | 鋒兄比價 | 手動商品與價格紀錄 | `ManualPriceTracker.tsx` · `/api/manualprice` |
| 18 | 手機比價 | 地標網通 + 傑昇通信，週期歷史 | `ToolsManagement.tsx` · `/api/landtop` |
| 19 | 圖片 + 語音 = 影片 | FFmpeg 合成 | `ImageVoiceVideoTool.tsx` · `/api/image-voice-video` |
| 20 | PNG / JPEG 轉換 | 圖片格式轉換 | `ImageFormatConvertTool.tsx` |
| 21 | 影片合併 | 多段影片合併 | `VideoMergeTool.tsx` |
| 22 | YT / B站轉 MP3/MP4 | 下載轉檔 | `YoutubeBilibiliConvertTool.tsx` · `/api/youtube-bilibili-convert` |

工具殼層：`components/modules/ToolsManagement.tsx`。

---

## 鋒兄子工具

| # | 模組名稱 | 說明 | 程式入口 |
|---|---------|------|---------|
| 23 | 鋒兄Tube | 頻道最新影片與倒台指數 | `ToolsManagement.tsx` · `/api/fengbro-tube` |
| 24 | 鋒兄金融 | CNBC / Yahoo 報價、自訂標的 CSV | `ToolsManagement.tsx` · `/api/fengbro-finance` |
| 25 | 鋒兄新聞 | 鎖定網站焦點、人口與便當等面板 | `FengbroNewsTool.tsx` · `/api/fengbro-news` |

---

## 關於頁子頁

這些入口只在「鋒兄關於」內顯示，不在主選單。

| 子頁 | 說明 |
|------|------|
| Bilibili 資訊 | 平台說明 |
| MindVideo / LitVideo / Musicful / Digen / OiiOii | 對應 AutoSign 服務的固定 GitHub Actions 快照 |

---

## 資料庫 Table 結構總覽

設定頁可建立 **19** 個 collection。欄位數以 `TABLE_SCHEMAS` 為準。新增的 `trialpurchase`／`reinstall`／`quota`／`shoppinglist` 使用非破壞性初始化，重試會保留已有資料。

| # | Collection 名稱 | 欄位數 | 對應模組 | 說明文件 |
|---|----------------|--------|---------|---------|
| 1 | food | 7 | 鋒兄食品 | [04_food.md](./04_food.md) |
| 2 | subscription | 8 | 鋒兄訂閱 | [03_subscription.md](./03_subscription.md) |
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
| 14 | sitevisit | 4 | 進站人次與連續進站天數 | `/api/site-visit` |
| 15 | menuusage | 3 | 選單使用統計 | `/api/menu-usage` |
| 16 | trialpurchase | 8 | 鋒兄試用/首購 | [16_trial_purchase.md](./16_trial_purchase.md) |
| 17 | reinstall | 12 | 鋒兄重灌 | [17_reinstall.md](./17_reinstall.md) |
| 18 | quota | 13 | 鋒兄額度 | 見 `QuotaManagement.tsx` |
| 19 | shoppinglist | 9 | 鋒兄購物清單 | [18_shopping_list.md](./18_shopping_list.md) |

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
├── 16_trial_purchase.md  # 服務／帳號試用與首購
├── 17_reinstall.md       # Win／Mac 重灌軟體與序號
├── 18_shopping_list.md   # 購物清單與預定購買日
├── agents/               # 代理協作規則
├── design/               # UI/UX 設計稿
└── research/             # 外部服務考證
```

---

**文件版本**: v1.4.0  
**維護者**: 鋒兄塗哥公關資訊
