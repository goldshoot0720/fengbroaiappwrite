# 鋒兄例行 (Routine)

## 功能概述

例行公事與週期性任務管理系統，追蹤日常重複事項的完成日期，支援日期遞移操作與照片記錄。

## 主要特點

- **例行記錄**：記錄例行事項名稱、備註、相關連結與照片。
- **三組日期追蹤**：提供 lastdate1、lastdate2、lastdate3 三個日期欄位，記錄最近三次完成時間。
- **日期遞移操作**：一鍵將 lastdate1 → lastdate2、lastdate2 → lastdate3，並清空 lastdate1（設為 NULL）。
- **清除日期按鈕**：每個日期欄位旁有 X 按鈕，可單獨清除（設為 NULL）。
- **天數差計算**：自動計算距今的天數差，顯示上次完成距今多久。
- **列表/卡片切換**：支援列表檢視與卡片檢視切換。
- **照片上傳**：支援 URL 或檔案上傳（50MB 限制）。
- **CSV 匯入/匯出**：批次資料匯入匯出。

## 資料表結構 (Appwrite Collection: `routine`)

| 欄位名稱 | 類型 | 長度 | 必填 | 說明 |
|----------|------|------|------|------|
| name | string | 100 | ✅ | 例行事項名稱 |
| note | string | 100 | ❌ | 備註 |
| lastdate1 | datetime | - | ❌ | 最近完成日期 1 |
| lastdate2 | datetime | - | ❌ | 最近完成日期 2 |
| lastdate3 | datetime | - | ❌ | 最近完成日期 3 |
| link | url | - | ❌ | 相關連結 |
| photo | url | - | ❌ | 照片連結 |

## TypeScript 類型定義

```typescript
interface Routine {
  $id: string;
  name: string;
  note?: string;
  lastdate1?: string | null;
  lastdate2?: string | null;
  lastdate3?: string | null;
  link?: string;
  photo?: string;
}
```

## 日期遞移操作

日期遞移是例行模組的核心功能，操作流程如下：

```
操作前：
  lastdate1 = 2026-01-15
  lastdate2 = 2026-01-01
  lastdate3 = 2025-12-15

操作後：
  lastdate1 = NULL (清空，等待下次記錄)
  lastdate2 = 2026-01-15 (原 lastdate1)
  lastdate3 = 2026-01-01 (原 lastdate2)
```

- 點擊「日期遞移」按鈕觸發
- 操作前會顯示確認對話框，包含清空 lastdate1 的提示
- API 支援將日期欄位設為 NULL

## CSV 格式

| # | 欄位 | 說明 |
|---|------|------|
| 1 | name | 事項名稱 |
| 2 | note | 備註 |
| 3 | lastdate1 | 最近日期 1 |
| 4 | lastdate2 | 最近日期 2 |
| 5 | lastdate3 | 最近日期 3 |
| 6 | link | 相關連結 |
| 7 | photo | 照片 URL |

## API 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/routine` | 取得所有例行事項 |
| POST | `/api/routine` | 新增例行事項 |
| GET | `/api/routine/[id]` | 取得單筆例行事項 |
| PUT | `/api/routine/[id]` | 更新例行事項 |
| PATCH | `/api/routine/[id]` | 部分更新（支援 NULL 值，用於日期遞移） |
| DELETE | `/api/routine/[id]` | 刪除例行事項 |

> PATCH 方法專門用於日期遞移操作，允許將日期欄位設為 NULL。PUT 方法在值為空字串時會跳過該欄位。

## 技術規格

- **元件路徑**：`components/modules/RoutineManagement.tsx`
- **API 路徑**：`app/api/routine/`
- **常數定義**：`lib/constants.ts` → `API_ENDPOINTS.ROUTINE`
