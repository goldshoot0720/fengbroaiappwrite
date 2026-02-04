# 鋒兄筆記 (Notes)

## 功能概述

多功能筆記與文章管理系統，支援文字記錄、檔案附件上傳（最多 3 個）與多種媒體即時預覽。

## 主要特點

- **豐富內容**：支援標題、正文、分類、日期與多個附件連結。
- **檔案附件**：每篇筆記最多 3 個附件，支援圖片、PDF、音訊、影片、Office 檔案等。
- **即時預覽**：內建 TXT、PDF、圖片、音訊、影片預覽，Office 檔案透過線上服務查看。
- **ZIP 結構預覽**：瀏覽 ZIP 檔案內部結構與大小，無需解壓。
- **全文檢索**：快速搜尋筆記標題與內容。
- **內容折疊**：長篇內容支援展開/折疊，保持介面整潔。
- **一鍵複製**：快速複製筆記內容。
- **快速日期調整**：±7 天按鈕快速調整日期。
- **CSV 匯入/匯出**：批次資料匯入匯出。

## 資料表結構 (Appwrite Collection: `article`)

| 欄位名稱 | 類型 | 長度 | 必填 | 說明 |
|----------|------|------|------|------|
| title | string | 100 | ❌ | 筆記標題 |
| content | string | 1000 | ❌ | 筆記內容 |
| category | string | 100 | ❌ | 分類 |
| ref | string | 100 | ❌ | 參考資料 |
| newDate | datetime | - | ❌ | 建立日期 |
| url1 | url | - | ❌ | 附件連結 1 |
| url2 | url | - | ❌ | 附件連結 2 |
| url3 | url | - | ❌ | 附件連結 3 |
| file1 | string | 150 | ❌ | 附件檔案 1 (Storage File ID) |
| file1name | string | 100 | ❌ | 附件 1 檔名 |
| file1type | string | 20 | ❌ | 附件 1 檔案類型 |
| file2 | string | 150 | ❌ | 附件檔案 2 (Storage File ID) |
| file2name | string | 100 | ❌ | 附件 2 檔名 |
| file2type | string | 20 | ❌ | 附件 2 檔案類型 |
| file3 | string | 150 | ❌ | 附件檔案 3 (Storage File ID) |
| file3name | string | 100 | ❌ | 附件 3 檔名 |
| file3type | string | 20 | ❌ | 附件 3 檔案類型 |

## TypeScript 類型定義

```typescript
interface Article {
  $id: string;
  title: string;
  content: string;
  newDate: string;
  url1?: string;
  url2?: string;
  url3?: string;
  file1?: string;
  file1name?: string;
  file1type?: string;
  file2?: string;
  file2name?: string;
  file2type?: string;
  file3?: string;
  file3name?: string;
  file3type?: string;
  $createdAt: string;
  $updatedAt: string;
}
```

## CSV 格式

| # | 欄位 | 說明 |
|---|------|------|
| 1 | title | 標題 |
| 2 | content | 內容 |
| 3 | newDate | 日期 |
| 4 | url1 | 附件連結 1 |
| 5 | url2 | 附件連結 2 |
| 6 | url3 | 附件連結 3 |

> 檔案附件 (file1-3) 透過 Appwrite Storage 管理，不包含在 CSV 中。

## API 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/article` | 取得所有筆記 |
| POST | `/api/article` | 新增筆記 |
| GET | `/api/article/[id]` | 取得單筆筆記 |
| PUT | `/api/article/[id]` | 更新筆記 |
| DELETE | `/api/article/[id]` | 刪除筆記 |

## 技術規格

- **元件路徑**：`components/modules/NotesManagement.tsx`
- **API 路徑**：`app/api/article/`
- **常數定義**：`lib/constants.ts` → `API_ENDPOINTS.ARTICLE`
