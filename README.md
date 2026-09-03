# 鋒兄AI管理系統

家庭數位中控台（zh-TW）：訂閱、食品／商品庫存、銀行／電子票證、筆記與文件、常用連結、影音播客、例行事項，以及比價、金融報價、新聞與 FFmpeg 媒體工具。

日常入口是 `/` 的單頁模組切換，不是每個模組一條獨立路由。現況以 `app/page.tsx` 與 `docs/INDEX.md` 為準。

## 功能

### 日常工作台（需 Appwrite）

- **鋒兄首頁 / 儀表** — 到期、餘額、媒體流量與容量摘要
- **鋒兄訂閱** — 扣款日、多幣別、CSV、本機垃圾桶
- **鋒兄試用/首購** — 依服務展開多帳號、試用／首購狀態、價格與試用／首購／到期日（扣款日）
- **鋒兄重灌** — Windows／Mac 軟體、授權序號（預設隱藏，可設查看密碼）、網站與備註
- **鋒兄食品** — 庫存、到期、商品庫存
- **鋒兄筆記 / 文件** — 筆記附件預覽；PDF／Office／程式碼／ZIP
- **鋒兄常用** — 網站群組、favicon、行內編輯
- **鋒兄圖片 / 影片 / 音樂 / 播客** — 上傳、佇列、歌詞、IndexedDB 快取
- **鋒兄銀行** — 帳戶與電子票證餘額
- **鋒兄例行** — 日期遞移與天數差
- **鋒兄設定 / 關於** — 帳號切換、建表、文件中心

### 鋒兄工具

- 鋒兄比價（手動價格紀錄）
- 手機比價（地標網通 + 傑昇通信，週期歷史）
- 圖片 + 語音 = 影片
- PNG / JPEG 轉換
- 影片合併
- YouTube / Bilibili 轉 MP3／MP4

### 鋒兄子工具

- 鋒兄Tube（頻道與倒台指數）
- 鋒兄金融（CNBC / Yahoo 報價、自訂標的）
- 鋒兄新聞（鎖定網站焦點）

### 跨模組

- 亮色 / 暗色 / 跟隨系統，舒適 / 緊湊密度
- PWA、語音導覽、到期 Web Push
- 媒體佇列與離線快取（每類約 500MB）

## 技術棧

- **框架**: Next.js 16（App Router + Turbopack）、React 19、TypeScript 5.9
- **樣式**: Tailwind CSS 4、Radix / shadcn 風格、Lucide、Geist
- **後端**: Next.js API routes + Appwrite 21（Database、Storage）
- **部署**: Vercel（含 cron）與 Docker

## 資料表

設定頁可初始化 **17** 個 collection（見 `app/api/create-table/route.js`）：

`food` · `subscription` · `trialpurchase` · `reinstall` · `article` · `commonaccount` · `bank` · `routine` · `image` · `video` · `music` · `podcast` · `commondocument` · `landtophistory` · `manualprice` · `sitevisit` · `menuusage`

新增的 `trialpurchase`（8 欄位）與 `reinstall`（8 欄位）採獨立資料表，不變更既有訂閱／食品資料。初始化只新增資料表或補齊缺少欄位，重試不刪除紀錄；新表不授予公開存取權限，沿用伺服器 API key 操作。序號遮罩與查看密碼只是畫面隱藏，不是加密保管庫。

另有 Web Push 訂閱表由 `/api/push-subscribe` 動態建立。

## 快速開始

1. 安裝依賴：`npm install`
2. 複製環境變數並填入 Appwrite：

```
NEXT_PUBLIC_APPWRITE_ENDPOINT=
NEXT_PUBLIC_APPWRITE_PROJECT_ID=
NEXT_PUBLIC_APPWRITE_DATABASE_ID=
NEXT_PUBLIC_APPWRITE_BUCKET_ID=
NEXT_PUBLIC_APPWRITE_API_KEY=
```

3. `npm run dev`，開啟 [http://localhost:3000](http://localhost:3000)
4. 第一次使用：進 **鋒兄設定** → 一鍵建立缺失 Table

也可在設定頁用 localStorage 覆寫連線，不必重部署。

## 專案結構

```
app/                    # App Router：主頁、少量獨立路由、API
app/api/                # CRUD、上傳、比價、金融、新聞、轉檔
components/layout/      # DashboardLayout（頂欄、手機底欄、佇列、語音）
components/modules/     # 各功能模組
components/ui/          # 共用元件與播放器
hooks/                  # 資料、快取、通知、語音
lib/                    # Appwrite 設定、比價／新聞／金融邏輯
docs/INDEX.md           # 選單與資料表現況索引
```

## 排程（Vercel cron）

- 每日推播到期、補送到期通知
- 每週一抓地標網通歷史價格

## 文件

- 選單與資料表現況：[docs/INDEX.md](docs/INDEX.md)
- 試用／首購：[docs/16_trial_purchase.md](docs/16_trial_purchase.md)
- 重灌軟體：[docs/17_reinstall.md](docs/17_reinstall.md)
- 產品定位：[PRODUCT.md](PRODUCT.md)
- 使用手冊：[docs/USER_GUIDE.md](docs/USER_GUIDE.md)（日常 CRUD 仍可用；工具／子工具與資料表清單以 INDEX 為準）

## 功能驗證

`npm run test:unit` 執行欄位與既有功能單元測試。先啟動 `npm run dev`，再執行 `npm run test:management`，會以只綁定 loopback 的記憶體 Appwrite fixture 驗證新功能 CRUD、33／133 帳號分頁、欄位驗證、權限錯誤與非破壞性建表，不連接正式 Appwrite。若伺服器不在 3000 port，可設定 `MANAGEMENT_TEST_URL`。

## 授權

MIT License
