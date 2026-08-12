# 鋒兄AI Appwrite 管理系統 — 使用者教學手冊

> **版本**: v2.0.0  
> **技術框架**: Next.js 16 / React 19 / Appwrite  
> **最後更新**: 2026-02-07  
> **現況**: 選單、工具／子工具與 13 張資料表以 [INDEX.md](./INDEX.md) 為準。本手冊仍完整說明日常 CRUD。

---

## 目錄

1. [系統簡介](#1-系統簡介)
2. [快速開始](#2-快速開始)
3. [首頁與儀表板](#3-首頁與儀表板)
4. [食品管理](#4-食品管理)
5. [訂閱管理](#5-訂閱管理)
6. [筆記管理](#6-筆記管理)
7. [常用帳號](#7-常用帳號)
8. [圖片管理](#8-圖片管理)
9. [影片管理](#9-影片管理)
10. [音樂管理](#10-音樂管理)
11. [播客管理](#11-播客管理)
12. [文件管理](#12-文件管理)
13. [銀行管理](#13-銀行管理)
14. [例行管理](#14-例行管理)
15. [系統設定](#15-系統設定)
16. [常見問題](#16-常見問題)

---

## 1. 系統簡介

**鋒兄AI Appwrite** 是一套個人資訊管理系統，幫助您集中管理日常生活中的各種資料：

| 功能模組 | 用途 |
|---------|------|
| 食品管理 | 追蹤食品庫存與到期日，避免浪費 |
| 訂閱管理 | 管理各種訂閱服務與付費週期 |
| 筆記管理 | 撰寫、整理個人筆記與文章 |
| 常用帳號 | 收藏常用網站連結與備忘 |
| 圖片管理 | 瀏覽與管理圖片庫 |
| 影片管理 | 管理與播放影片收藏 |
| 音樂管理 | 音樂庫管理與播放 |
| 播客管理 | 管理 Podcast 內容 |
| 文件管理 | 上傳與管理各類文件 |
| 銀行管理 | 記錄銀行帳戶與存款資訊 |
| 例行管理 | 管理日常例行事務與日期遞移 |

系統支援 **亮色 / 暗色 / 跟隨系統** 三種主題模式，並提供 **手機、平板、桌面** 三種裝置的響應式佈局。

---

## 2. 快速開始

### 2.1 環境需求

- **Node.js**: 18 以上版本
- **瀏覽器**: Chrome、Firefox、Safari、Edge（現代瀏覽器）
- **Appwrite**: 需要一個 Appwrite 雲端或自架帳號

### 2.2 安裝步驟

**方法一：直接執行**

```bash
# 1. 安裝套件
npm install

# 2. 複製環境設定檔
cp .env.example .env.local

# 3. 編輯 .env.local，填入你的 Appwrite 設定
#    NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
#    NEXT_PUBLIC_APPWRITE_PROJECT_ID=你的專案ID
#    NEXT_PUBLIC_APPWRITE_DATABASE_ID=你的資料庫ID
#    NEXT_PUBLIC_APPWRITE_BUCKET_ID=你的儲存桶ID
#    NEXT_PUBLIC_APPWRITE_API_KEY=你的API金鑰

# 4. 啟動開發伺服器
npm run dev
```

啟動後在瀏覽器開啟 `http://localhost:3000` 即可使用。

**方法二：Docker 部署**

```bash
# 建構映像
docker build -t fengbro-appwrite .

# 執行容器
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1 \
  -e NEXT_PUBLIC_APPWRITE_PROJECT_ID=你的專案ID \
  -e NEXT_PUBLIC_APPWRITE_DATABASE_ID=你的資料庫ID \
  -e NEXT_PUBLIC_APPWRITE_BUCKET_ID=你的儲存桶ID \
  -e NEXT_PUBLIC_APPWRITE_API_KEY=你的API金鑰 \
  fengbro-appwrite
```

### 2.3 首次使用：初始化資料庫

首次啟動系統後，資料庫表格尚未建立，需要到 **「鋒兄設定」** 進行初始化：

1. 點擊左側選單的 **「鋒兄設定」**
2. 找到 **「資料庫欄位統計」** 區塊
3. 紅色標示的表格代表尚未建立
4. 點擊 **「一鍵建立所有缺失 Table」** 按鈕
5. 等待所有表格建立完成（會顯示 SSE 串流進度）
6. 建立完成後，回到其他模組即可開始使用

---

## 3. 首頁與儀表板

### 3.1 首頁（鋒兄首頁）

首頁顯示系統標題資訊，是進入系統後的預設畫面。

### 3.2 儀表板（鋒兄儀表）

儀表板彙整了所有模組的關鍵統計數據，讓你一眼掌握重要資訊。

**食品區塊**：
- 食品總數 — 庫存中的食品項目總數
- 正常項目 — 離到期日還有一段時間的食品
- 7 天內到期 — 即將過期的食品清單（黃色警示）
- 30 天內到期 — 較近期到期的食品清單
- 已過期 — 已經超過到期日的食品（紅色警示）

**訂閱區塊**：
- 訂閱總數 — 所有追蹤中的訂閱服務
- 3 天內到期 — 即將需要續費的訂閱（紅色警示）
- 7 天內到期 — 近期需注意的訂閱
- 已逾期 — 已超過續費日期的訂閱

**財務概覽**：
- 年費總計 — 所有訂閱的年度費用（換算為台幣）
- 月費總計 — 所有訂閱的月度費用
- 下月預估費 — 下個月的預估支出
- 銀行帳戶數 — 已登記的銀行帳戶數量
- 總存款 — 所有銀行帳戶的存款總額

**多媒體儲存**：
- 各類媒體（圖片、影片、音樂、文件、播客）的數量與佔用空間
- 儲存空間使用進度條（綠色 <50%、橘色 50-80%、紅色 >80%）

**到期提醒**：
- 系統會自動檢查食品與訂閱的到期狀況
- 支援瀏覽器桌面通知（每日提醒一次，不會重複打擾）

---

## 4. 食品管理

食品管理模組幫助你追蹤家中食品的庫存與到期日期。

### 4.1 新增食品

1. 點擊 **「新增」** 按鈕
2. 填寫以下資訊：
   - **名稱**（必填）— 食品名稱
   - **數量** — 庫存數量（±1 / ±10 快速調整）
   - **到期日** — 食品的最佳賞味期限
   - **照片** — 可上傳食品照片（50MB 限制）
   - **價格** — 購買金額（±1000 快速調整）
   - **商店** — 購買地點
3. 點擊 **「儲存」**

### 4.2 資料表結構

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| name | string(100) | ✅ | 食品名稱 |
| amount | integer | ❌ | 庫存數量 |
| price | integer | ❌ | 購買價格 |
| shop | string(100) | ❌ | 購買商店 |
| todate | datetime | ❌ | 到期日期 |
| photo | url | ❌ | 照片連結 |
| photohash | string(256) | ❌ | 照片雜湊 |

### 4.3 到期狀態說明

| 狀態 | 顏色 | 說明 |
|------|------|------|
| 正常 | 綠色 | 距離到期日超過 7 天 |
| 即將到期 | 黃色 | 距離到期日在 3-7 天內 |
| 緊急 | 橘色 | 距離到期日在 3 天內 |
| 已過期 | 紅色 | 已超過到期日 |

---

## 5. 訂閱管理

管理你的各種付費訂閱服務，追蹤續費日期與費用。

### 5.1 新增訂閱

填寫以下資訊：
- **名稱**（必填）— 訂閱服務名稱（如 Netflix、Spotify）
- **網站** — 服務的網址
- **費用** — 每期的費用金額
- **幣別** — 支援 TWD、USD、EUR、JPY、CNY、HKD
- **下次續費日** — 下一次需要付款的日期（±30 天快速調整）
- **帳號** — 登入帳號
- **備註** — 其他備忘資訊
- **持續訂閱** — 是否為持續性訂閱

### 5.2 資料表結構

| 欄位 | 類型 | 必填 | 預設值 | 說明 |
|------|------|------|--------|------|
| name | string(100) | ✅ | - | 服務名稱 |
| site | url | ❌ | - | 服務網站 |
| price | integer | ❌ | - | 費用金額 |
| nextdate | datetime | ❌ | - | 下次續費日 |
| note | string(100) | ❌ | - | 備註 |
| account | string(100) | ❌ | - | 帳號 |
| currency | string(100) | ❌ | - | 幣別代碼 |
| continue | boolean | ❌ | true | 持續訂閱 |

### 5.3 幣別換算

| 幣別 | 對台幣匯率 |
|------|-----------|
| USD（美元）| 1 USD = 35 TWD |
| EUR（歐元）| 1 EUR = 40 TWD |
| JPY（日圓）| 1 JPY = 0.35 TWD |
| CNY（人民幣）| 1 CNY = 4.5 TWD |
| HKD（港幣）| 1 HKD = 4 TWD |

> 注意：匯率為固定值，非即時匯率，僅供預估參考。

---

## 6. 筆記管理

筆記管理模組讓你撰寫與整理個人筆記和文章。

### 6.1 新增筆記

- **標題** — 筆記標題
- **內容** — 筆記內容（最大 1000 字元）
- **分類** — 分類標籤
- **日期** — 建立日期（±7 天快速調整）
- **附件連結** — 最多可附加 3 個外部網址 (url1-3)
- **附件檔案** — 最多可附加 3 個檔案 (file1-3)

### 6.2 資料表結構

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| title | string(100) | ❌ | 標題 |
| content | string(1000) | ❌ | 內容 |
| category | string(100) | ❌ | 分類 |
| ref | string(100) | ❌ | 參考 |
| newDate | datetime | ❌ | 日期 |
| url1-3 | url | ❌ | 附件連結 (3 個) |
| file1-3 | string(150) | ❌ | 附件檔案 ID (3 組) |
| file1name-3name | string(100) | ❌ | 附件檔名 (3 個) |
| file1type-3type | string(20) | ❌ | 附件類型 (3 個) |

### 6.3 附件預覽

筆記支援即時預覽以下格式：圖片、PDF、音訊、影片、Office 文件、ZIP 結構、程式碼。

---

## 7. 常用帳號

儲存你常用的網站帳號資訊，方便快速存取。

### 7.1 功能說明

每個常用帳號可以儲存：
- **名稱** — 帳號群組名稱
- **網站連結** — 最多 37 個常用網站連結 (site01-37)
- **備忘筆記** — 最多 37 則相關備忘 (note01-37)

### 7.2 資料表結構

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| name | string(100) | ✅ | 群組名稱 |
| site01 ~ site37 | string(100) | ❌ | 網站連結 (37 個) |
| note01 ~ note37 | string(100) | ❌ | 備忘筆記 (37 個) |

> 總共 75 個欄位：1 name + 37 site + 37 note

### 7.3 Favicon 顯示

系統會自動嘗試載入每個網站的圖示（Favicon），讓你更容易辨識。已內建常見網站（如 GitHub、Gmail、Netflix、YouTube 等）的圖示路徑。

### 7.4 行內編輯

支援直接在列表中編輯各網站項目，無需開啟表單。支援 A-Z 排序與一鍵複製。

---

## 8. 圖片管理

瀏覽與管理上傳到 Appwrite Storage 的圖片。

### 8.1 資料表結構

| 欄位 | 類型 | 必填 | 預設值 | 說明 |
|------|------|------|--------|------|
| name | string(100) | ✅ | - | 圖片名稱 |
| file | string(150) | ❌ | - | Storage 檔案 ID |
| filetype | string(20) | ❌ | - | 檔案類型 |
| note | string(100) | ❌ | - | 備註 |
| ref | string(100) | ❌ | - | 參考 |
| category | string(100) | ❌ | - | 分類 |
| hash | string(300) | ❌ | - | 雜湊 |
| cover | boolean | ❌ | false | 封面圖 |

### 8.2 功能

- 瀏覽所有上傳的圖片（網格藝廊）
- 依分類篩選
- 全螢幕圖片預覽
- 批次 ZIP 匯入匯出
- 支援 JPG、PNG、GIF、WEBP

### 8.3 離線快取

- 快取上限 **500MB**（IndexedDB）
- 超過上限時自動清除最舊快取
- 離線時可瀏覽已快取的圖片

---

## 9. 影片管理

管理與播放影片收藏。

### 9.1 資料表結構

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| name | string(100) | ✅ | 影片名稱 |
| file | string(150) | ❌ | Storage 檔案 ID |
| filetype | string(20) | ❌ | 檔案類型 |
| note | string(100) | ❌ | 備註 |
| ref | string(100) | ❌ | 參考 |
| category | string(100) | ❌ | 分類 |
| hash | string(300) | ❌ | 雜湊 |
| cover | string(150) | ❌ | 封面圖 File ID |

### 9.2 播放佇列

- 可將影片加入播放佇列
- 支援 **立即播放 / 加入佇列 / 移除 / 排序**
- 影片播放結束後自動播放下一部

### 9.3 影片快取

- 快取上限 **500MB**（IndexedDB）
- 下載時顯示進度百分比
- 超過上限自動清除最舊影片

### 9.4 串流播放

影片播放支援 HTTP Range 請求，透過 Media Proxy 確保播放流暢。

---

## 10. 音樂管理

管理與播放音樂庫。

### 10.1 資料表結構

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| name | string(100) | ✅ | 歌曲名稱 |
| file | string(150) | ❌ | Storage 檔案 ID |
| filetype | string(20) | ❌ | 檔案類型 |
| lyrics | string(3337) | ❌ | 歌詞文字 |
| note | string(100) | ❌ | 備註 |
| ref | string(100) | ❌ | 參考 |
| category | string(100) | ❌ | 分類 |
| hash | string(300) | ❌ | 雜湊 |
| language | string(100) | ❌ | 語言 |
| cover | string(150) | ❌ | 封面圖 File ID |

### 10.2 播放佇列

- 加入佇列 / 立即播放 / 排序管理
- 自動播放下一首

### 10.3 音樂快取

- 快取上限 **500MB**（IndexedDB）
- 支援格式：MP3、M4A、WAV、OGG、FLAC、AAC、WEBA
- 離線模式可播放已快取的音樂

### 10.4 歌詞功能

音樂項目可以附帶歌詞文字（最大 3337 字元），在播放時同步顯示歌詞內容。

---

## 11. 播客管理

管理 Podcast 節目與集數。

### 11.1 資料表結構

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| name | string(100) | ✅ | 播客名稱 |
| file | string(150) | ❌ | Storage 檔案 ID |
| filetype | string(20) | ❌ | 檔案類型 |
| note | string(100) | ❌ | 備註 |
| ref | string(100) | ❌ | 參考 |
| category | string(100) | ❌ | 分類 |
| hash | string(300) | ❌ | 雜湊 |
| cover | string(150) | ❌ | 封面圖 File ID |

### 11.2 播客快取

- 快取上限 **500MB**（IndexedDB）
- 同時支援音訊與視訊格式的 Podcast
- 音訊格式：MP3、M4A、WAV、OGG、FLAC、AAC、WEBA
- 視訊格式：MP4、WEBM、MOV

### 11.3 刪除確認

刪除播客前需輸入確認文字「DELETE [播客名稱]」，防止誤刪。

---

## 12. 文件管理

上傳與管理各類文件。

### 12.1 資料表結構

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| name | string(100) | ✅ | 文件名稱 |
| file | string(150) | ❌ | Storage 檔案 ID |
| filetype | string(20) | ❌ | 檔案類型 |
| note | string(100) | ❌ | 備註 |
| ref | string(100) | ❌ | 參考 |
| category | string(100) | ❌ | 分類 |
| hash | string(300) | ❌ | 雜湊 |
| cover | string(150) | ❌ | 封面圖 File ID |

### 12.2 支援的檔案格式

| 類型 | 格式 | 預覽方式 |
|------|------|---------|
| 文件 | PDF | 內建 PDF Viewer |
| 文件 | DOC、DOCX | Office Web Viewer |
| 試算表 | XLS、XLSX | Office Web Viewer |
| 試算表 | CSV | 表格預覽 + 純文字編輯 |
| 簡報 | PPT、PPTX | Office Web Viewer |
| 文字 | TXT、MD | 文字預覽 + 編輯 |
| 程式碼 | JS、TS、HTML、CSS、JSON、XML | 語法高亮 + 編輯 |
| 壓縮 | ZIP | 結構預覽 |
| 圖片 | JPG、PNG、GIF、WEBP | 圖片預覽 |

### 12.3 離線快取

- 快取上限 **500MB**（IndexedDB）
- 下載過的文件暫存在瀏覽器中
- 再次開啟時無需重新下載

---

## 13. 銀行管理

記錄與追蹤銀行帳戶資訊。

### 13.1 資料表結構

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| name | string(100) | ✅ | 銀行名稱 |
| deposit | integer | ❌ | 存款金額 |
| site | url | ❌ | 網路銀行連結 |
| address | string(100) | ❌ | 分行地址 |
| withdrawals | integer | ❌ | 提款資訊 |
| transfer | integer | ❌ | 轉帳資訊 |
| activity | url | ❌ | 活動連結 |
| card | string(100) | ❌ | 卡片資訊 |
| account | string(100) | ❌ | 銀行帳號 |

### 13.2 統計

儀表板會自動統計銀行帳戶總數與所有帳戶的存款總額。

### 13.3 刪除確認

刪除帳戶前需輸入「DELETE [銀行名稱]」確認，防止誤刪。

---

## 14. 例行管理

管理日常的例行事務與定期任務。

### 14.1 資料表結構

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| name | string(100) | ✅ | 事項名稱 |
| note | string(100) | ❌ | 備註 |
| lastdate1 | datetime | ❌ | 最近完成日期 1 |
| lastdate2 | datetime | ❌ | 最近完成日期 2 |
| lastdate3 | datetime | ❌ | 最近完成日期 3 |
| link | url | ❌ | 相關連結 |
| photo | url | ❌ | 照片連結 |

### 14.2 日期遞移操作

例行模組的核心功能，一鍵將日期向後遞移：

```
操作前：lastdate1=01/15, lastdate2=01/01, lastdate3=12/15
操作後：lastdate1=NULL,  lastdate2=01/15, lastdate3=01/01
```

- lastdate1 → lastdate2
- lastdate2 → lastdate3
- lastdate1 清空（設為 NULL），等待下次記錄

### 14.3 清除日期

每個日期欄位旁有 X 按鈕，可單獨將該日期設為 NULL。API 的 PATCH 方法支援將日期欄位設為 NULL。

### 14.4 天數差計算

系統自動計算每個日期距今的天數，直覺呈現上次完成距今多久。

---

## 15. 系統設定

### 15.1 Appwrite 帳號切換

系統支援動態切換不同的 Appwrite 後端，無需重新部署：

1. 進入 **「鋒兄設定」**
2. 在 **「Appwrite 帳號切換」** 區塊填入：
   - **帳號暱稱** — 方便辨識不同帳號
   - **Endpoint** — Appwrite 伺服器位址
   - **Project ID** — 專案 ID
   - **Database ID** — 資料庫 ID
   - **Bucket ID** — 儲存桶 ID
   - **API Key** — API 金鑰
3. 儲存後系統會自動清除快取並重新載入資料

> 要切回 .env 的預設帳號，點擊 **「重設為 .env 預設」** 按鈕即可。

### 15.2 資料庫管理

**表格狀態**：
- 🟢 **綠色** — 表格存在且有資料
- 🟡 **黃色** — 表格存在但無資料
- 🔴 **紅色** — 表格不存在

**資料庫表格一覽 (13 個 Collection)**：

| # | 表格名稱 | 欄位數 | 用途 |
|---|----------|--------|------|
| 1 | food | 7 | 食品庫存 |
| 2 | subscription | 15 | 訂閱服務 |
| 3 | article | 17 | 筆記文章 |
| 4 | commonaccount | 75 | 常用帳號 |
| 5 | bank | 9 | 銀行帳戶 |
| 6 | routine | 7 | 例行事務 |
| 7 | image | 8 | 圖片 |
| 8 | video | 9 | 影片 |
| 9 | music | 10 | 音樂 |
| 10 | podcast | 8 | 播客 |
| 11 | commondocument | 8 | 文件 |
| 12 | landtophistory | 9 | 手機比價歷史 |
| 13 | manualprice | 4 | 鋒兄比價紀錄 |

**表格操作**：
- **一鍵建立** — 建立所有缺失的資料表（SSE 串流顯示進度）
- **個別重建** — 重建單一資料表（⚠ 會清除該表所有資料）
- **結構修正** — 當欄位數量不符預期時，可重建表格結構

### 15.3 儲存空間管理

- **孤立檔案檢測** — 找出沒有被任何記錄引用的檔案
- **批次清除** — 一次刪除所有孤立檔案，釋放儲存空間
- **分類統計** — 查看各類媒體檔案的數量

### 15.4 主題切換

三種主題模式可選：
- **亮色模式** — 白色背景，適合白天使用
- **暗色模式** — 深色背景，適合夜間使用
- **跟隨系統** — 自動跟隨作業系統的深淺色設定

主題設定會儲存在瀏覽器中，下次開啟時自動套用。

---

## 16. 常見問題

### Q1: 開啟模組時顯示「Table xxx 不存在」

**解決方式**：到 **「鋒兄設定」** → **「資料庫欄位統計」**，點擊 **「一鍵建立所有缺失 Table」** 建立缺失的資料表。

### Q2: 資料沒有更新 / 顯示舊資料

**解決方式**：
1. 嘗試重新整理瀏覽器頁面（Ctrl+F5 / Cmd+Shift+R）
2. 如果仍有問題，到 **「鋒兄設定」** 切換帳號再切回來，會強制清除快取

### Q3: 影片/音樂無法播放

**可能原因與解決方式**：
1. 確認檔案已上傳到 Appwrite Storage
2. 確認 Appwrite Bucket 的權限設定為公開讀取
3. 嘗試清除瀏覽器快取後重新載入
4. 確認網路連線正常

### Q4: 檔案上傳失敗

**可能原因**：
- Appwrite 免費方案有 **頻寬限制**，超過後會暫時無法上傳
- 確認 API Key 有正確的寫入權限
- 確認 Bucket ID 設定正確
- 單檔限制 50MB

### Q5: 如何備份資料？

目前資料儲存在 Appwrite 雲端，可透過 Appwrite Console 進行資料備份。各模組支援 CSV 匯出與 ZIP 匯出功能。

### Q6: 支援哪些瀏覽器？

支援所有現代瀏覽器：
- Google Chrome 90+
- Mozilla Firefox 90+
- Apple Safari 14+
- Microsoft Edge 90+

### Q7: 可以安裝為手機 App 嗎？

系統為 PWA（漸進式網頁應用），可以透過瀏覽器的「加到主畫面」功能安裝到手機（需支援 HTTPS）：
- **iOS**: Safari → 分享 → 加入主畫面
- **Android**: Chrome → 選單 → 安裝應用程式

### Q8: 離線可以使用嗎？

部分功能支援離線使用：
- 已快取的影片、音樂、圖片、文件、播客可離線瀏覽/播放
- 每種媒體類型快取上限 500MB（IndexedDB）
- 新增/修改/刪除等操作需要網路連線

### Q9: 匯率不正確怎麼辦？

系統使用固定匯率作為預估參考。如需精確匯率，請以實際銀行匯率為準。目前匯率設定為硬編碼，需修改程式碼才能更新。

### Q10: 儲存空間滿了怎麼辦？

1. 到 **「鋒兄設定」** 檢查 **「孤立檔案」** 並清除
2. 刪除不需要的影片、音樂、圖片等媒體檔案
3. 清除瀏覽器的離線快取（每種媒體類型上限 500MB）
4. 考慮升級 Appwrite 方案以獲得更多儲存空間

---

## 附錄 A：鍵盤快捷鍵

| 操作 | 快捷鍵 |
|------|--------|
| 重新整理 | Ctrl + F5 (Windows) / Cmd + Shift + R (Mac) |
| 返回頂部 | 點擊右下角的滾動導航按鈕 |

---

## 附錄 B：系統架構簡圖

```
┌────────────────────────────────────────────────────┐
│                    瀏覽器前端                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ 模組頁面  │  │ UI 元件   │  │ React Hooks     │  │
│  │ (24 葉)   │  │ (51 個)   │  │ (17 個)         │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
│                       │                              │
│              ┌────────┴────────┐                     │
│              │  IndexedDB 快取  │                     │
│              │  (離線瀏覽支援)   │                    │
│              │  500MB/類型      │                    │
│              └─────────────────┘                     │
└────────────────────────┬───────────────────────────┘
                         │ HTTP API
┌────────────────────────┴───────────────────────────┐
│                  Next.js API 路由                    │
│              (38 個 API 端點)                        │
└────────────────────────┬───────────────────────────┘
                         │ Appwrite SDK
┌────────────────────────┴───────────────────────────┐
│                 Appwrite 後端服務                    │
│  ┌──────────┐  ┌──────────────┐                     │
│  │ Database │  │   Storage    │                     │
│  │ (13 表)   │  │ (檔案儲存)   │                    │
│  └──────────┘  └──────────────┘                     │
└────────────────────────────────────────────────────┘
```

---

## 附錄 C：資料表完整結構一覽

### food (7 欄位)

| 欄位 | 類型 | 長度 | 必填 | 說明 |
|------|------|------|------|------|
| name | string | 100 | ✅ | 食品名稱 |
| amount | integer | - | ❌ | 數量 |
| price | integer | - | ❌ | 價格 |
| shop | string | 100 | ❌ | 商店 |
| todate | datetime | - | ❌ | 到期日 |
| photo | url | - | ❌ | 照片 |
| photohash | string | 256 | ❌ | 照片雜湊 |

### subscription (8 欄位)

| 欄位 | 類型 | 長度 | 必填 | 預設 | 說明 |
|------|------|------|------|------|------|
| name | string | 100 | ✅ | - | 名稱 |
| site | url | - | ❌ | - | 網站 |
| price | integer | - | ❌ | - | 費用 |
| nextdate | datetime | - | ❌ | - | 續費日 |
| note | string | 100 | ❌ | - | 備註 |
| account | string | 100 | ❌ | - | 帳號 |
| currency | string | 100 | ❌ | - | 幣別 |
| continue | boolean | - | ❌ | true | 持續 |

### article (17 欄位)

| 欄位 | 類型 | 長度 | 必填 | 說明 |
|------|------|------|------|------|
| title | string | 100 | ❌ | 標題 |
| content | string | 1000 | ❌ | 內容 |
| category | string | 100 | ❌ | 分類 |
| ref | string | 100 | ❌ | 參考 |
| newDate | datetime | - | ❌ | 日期 |
| url1 | url | - | ❌ | 連結 1 |
| url2 | url | - | ❌ | 連結 2 |
| url3 | url | - | ❌ | 連結 3 |
| file1 | string | 150 | ❌ | 檔案 1 ID |
| file1name | string | 100 | ❌ | 檔案 1 名稱 |
| file1type | string | 20 | ❌ | 檔案 1 類型 |
| file2 | string | 150 | ❌ | 檔案 2 ID |
| file2name | string | 100 | ❌ | 檔案 2 名稱 |
| file2type | string | 20 | ❌ | 檔案 2 類型 |
| file3 | string | 150 | ❌ | 檔案 3 ID |
| file3name | string | 100 | ❌ | 檔案 3 名稱 |
| file3type | string | 20 | ❌ | 檔案 3 類型 |

### commonaccount (75 欄位)

| 欄位 | 類型 | 長度 | 必填 | 說明 |
|------|------|------|------|------|
| name | string | 100 | ✅ | 群組名稱 |
| site01~37 | string | 100 | ❌ | 網站連結 x37 |
| note01~37 | string | 100 | ❌ | 備忘筆記 x37 |

### bank (9 欄位)

| 欄位 | 類型 | 長度 | 必填 | 說明 |
|------|------|------|------|------|
| name | string | 100 | ✅ | 銀行名稱 |
| deposit | integer | - | ❌ | 存款 |
| site | url | - | ❌ | 網銀連結 |
| address | string | 100 | ❌ | 地址 |
| withdrawals | integer | - | ❌ | 提款 |
| transfer | integer | - | ❌ | 轉帳 |
| activity | url | - | ❌ | 活動連結 |
| card | string | 100 | ❌ | 卡片 |
| account | string | 100 | ❌ | 帳號 |

### routine (7 欄位)

| 欄位 | 類型 | 長度 | 必填 | 說明 |
|------|------|------|------|------|
| name | string | 100 | ✅ | 事項名稱 |
| note | string | 100 | ❌ | 備註 |
| lastdate1 | datetime | - | ❌ | 最近日期 1 |
| lastdate2 | datetime | - | ❌ | 最近日期 2 |
| lastdate3 | datetime | - | ❌ | 最近日期 3 |
| link | url | - | ❌ | 相關連結 |
| photo | url | - | ❌ | 照片 |

### image (8 欄位)

| 欄位 | 類型 | 長度 | 必填 | 預設 | 說明 |
|------|------|------|------|------|------|
| name | string | 100 | ✅ | - | 名稱 |
| file | string | 150 | ❌ | - | 檔案 ID |
| filetype | string | 20 | ❌ | - | 類型 |
| note | string | 100 | ❌ | - | 備註 |
| ref | string | 100 | ❌ | - | 參考 |
| category | string | 100 | ❌ | - | 分類 |
| hash | string | 300 | ❌ | - | 雜湊 |
| cover | boolean | - | ❌ | false | 封面 |

### video (8 欄位)

| 欄位 | 類型 | 長度 | 必填 | 說明 |
|------|------|------|------|------|
| name | string | 100 | ✅ | 名稱 |
| file | string | 150 | ❌ | 檔案 ID |
| filetype | string | 20 | ❌ | 類型 |
| note | string | 100 | ❌ | 備註 |
| ref | string | 100 | ❌ | 參考 |
| category | string | 100 | ❌ | 分類 |
| hash | string | 300 | ❌ | 雜湊 |
| cover | string | 150 | ❌ | 封面 ID |

### music (10 欄位)

| 欄位 | 類型 | 長度 | 必填 | 說明 |
|------|------|------|------|------|
| name | string | 100 | ✅ | 名稱 |
| file | string | 150 | ❌ | 檔案 ID |
| filetype | string | 20 | ❌ | 類型 |
| lyrics | string | 3337 | ❌ | 歌詞 |
| note | string | 100 | ❌ | 備註 |
| ref | string | 100 | ❌ | 參考 |
| category | string | 100 | ❌ | 分類 |
| hash | string | 300 | ❌ | 雜湊 |
| language | string | 100 | ❌ | 語言 |
| cover | string | 150 | ❌ | 封面 ID |

### podcast (8 欄位)

| 欄位 | 類型 | 長度 | 必填 | 說明 |
|------|------|------|------|------|
| name | string | 100 | ✅ | 名稱 |
| file | string | 150 | ❌ | 檔案 ID |
| filetype | string | 20 | ❌ | 類型 |
| note | string | 100 | ❌ | 備註 |
| ref | string | 100 | ❌ | 參考 |
| category | string | 100 | ❌ | 分類 |
| hash | string | 300 | ❌ | 雜湊 |
| cover | string | 150 | ❌ | 封面 ID |

### commondocument (8 欄位)

| 欄位 | 類型 | 長度 | 必填 | 說明 |
|------|------|------|------|------|
| name | string | 100 | ✅ | 名稱 |
| file | string | 150 | ❌ | 檔案 ID |
| filetype | string | 20 | ❌ | 類型 |
| note | string | 100 | ❌ | 備註 |
| ref | string | 100 | ❌ | 參考 |
| category | string | 100 | ❌ | 分類 |
| hash | string | 300 | ❌ | 雜湊 |
| cover | string | 150 | ❌ | 封面 ID |

---

## 附錄 D：環境變數說明

| 變數名稱 | 說明 | 範例 |
|----------|------|------|
| `NEXT_PUBLIC_APPWRITE_ENDPOINT` | Appwrite 伺服器位址 | `https://cloud.appwrite.io/v1` |
| `NEXT_PUBLIC_APPWRITE_PROJECT_ID` | Appwrite 專案 ID | `64a1b2c3d4e5f6` |
| `NEXT_PUBLIC_APPWRITE_DATABASE_ID` | Appwrite 資料庫 ID | `main_db` |
| `NEXT_PUBLIC_APPWRITE_BUCKET_ID` | Appwrite 儲存桶 ID | `media_bucket` |
| `NEXT_PUBLIC_APPWRITE_API_KEY` | Appwrite API 金鑰 | `abc123...` |

> 所有變數以 `NEXT_PUBLIC_` 開頭，代表在瀏覽器端也可存取。系統支援在「鋒兄設定」中動態覆蓋這些設定，免重新部署。

---

## 附錄 E：API 端點總覽

| 模組 | 端點前綴 | CRUD |
|------|---------|------|
| 食品 | `/api/food` | GET, POST, GET/PUT/DELETE [id] |
| 訂閱 | `/api/subscription` | GET, POST, GET/PUT/DELETE [id] |
| 筆記 | `/api/article` | GET, POST, GET/PUT/DELETE [id] |
| 常用帳號 | `/api/commonaccount` | GET, POST, GET/PUT/DELETE [id] |
| 銀行 | `/api/bank` | GET, POST, GET/PUT/DELETE [id] |
| 例行 | `/api/routine` | GET, POST, GET/PUT/PATCH/DELETE [id] |
| 圖片 | `/api/image` | GET, POST, GET/PUT/DELETE [id] |
| 影片 | `/api/video` | GET, POST, GET/PUT/DELETE [id] |
| 音樂 | `/api/music` | GET, POST, GET/PUT/DELETE [id] |
| 播客 | `/api/podcast` | GET, POST, GET/PUT/DELETE [id] |
| 文件 | `/api/commondocument` | GET, POST, GET/PUT/DELETE [id] |
| 上傳 | `/api/upload-image`, `/api/upload-music`, `/api/upload-podcast`, `/api/upload-video` | POST |
| 影片串流 | `/api/videos/[filename]` | GET |
| 媒體代理 | `/api/media-proxy` | GET |
| 資料庫管理 | `/api/create-table`, `/api/update-schema`, `/api/fix-permissions` | GET/POST |
| 統計 | `/api/database-stats`, `/api/storage-stats` | GET |
| 圖片列表 | `/api/images` | GET |
