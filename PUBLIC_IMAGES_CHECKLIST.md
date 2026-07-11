# Public 目錄圖片清單

## 📋 必要圖片清單

### ✅ 網站基礎圖示 (已有)
- **`favicon.ico`** - 網站圖示
- **`apple-touch-icon.png`** - iOS/Safari 圖示 (180x180px)
- **`apple-touch-icon.jpg`** - iOS/Safari 圖示備用

### ✅ 核心人物圖片 (已有)
- **`fengbro-profile.png`** - 鋒兄人物圖 (首頁 ASCII 藝術區塊使用)

### ⚠️ 需要新增的圖片

#### 1. 執行長照片
- **`ceo-profile.jpg`** - 人工智慧水電行執行長照片
  - 位置: `public/ceo-profile.jpg`
  - 用途: CEOProfile 元件 (執行長簡介區塊)
  - 建議尺寸: 至少 400x400px
  - 來源: 你剛才提供的照片 (戴眼鏡、穿深藍色 "Relax" T恤的男士)

#### 1.5. 費城半導體貓咪分析師
- **`sox-cats.jpg`** - 喵白白與喵布布費半分析圖片
  - 位置: `public/finance/sox-cats.jpg`
  - 用途: ToolsManagement 元件 (精選焦點 費城半導體區塊)
  - 來源: 你剛才提供的照片 (雙貓看好 SOX 上看一萬五千點)

#### 2. 水電大亨照片
- **`plumber-tycoon.png`** - 水電大亨本人照片 ✅
  - 位置: `public/plumber-tycoon.png`
  - 用途: PlumberTycoon 元件 (水電大亨事業版圖區塊)
  - 建議尺寸: 至少 400x400px

#### 3. 貓咪照片
- **`cats2.25fimage1.png`** - 喵布布 (三花貓) ✅
  - 位置: `public/cats2.25fimage1.png`
  - 用途: CatShowcase 元件 (鋒兄的貓咪家族區塊)
  - 描述: 三花貓,白色、橘色、黑色毛色,舉起小手
  
- **`cats2.25fimage2.png`** - 喵白白 (白貓) ✅
  - 位置: `public/cats2.25fimage2.png`
  - 用途: CatShowcase 元件 (鋒兄的貓咪家族區塊)
  - 描述: 白貓,頭上有黑色斑紋,穿著貓咪裝

### ✅ 金融圖表 (已有)

#### `public/finance/` 子目錄
- **`nikkei-225-index.png`** - 日經225指數圖表
- **`kospi-index.png`** - KOSPI指數圖表
- **`dow-jones-doac.png`** - 道瓊工業指數圖表

---

## 📁 完整目錄結構

```
public/
├── favicon.ico                    ✅
├── apple-touch-icon.png           ✅
├── apple-touch-icon.jpg           ✅
├── fengbro-profile.png            ✅
├── ceo-profile.jpg                ⚠️ 需要新增
├── plumber-tycoon.png             ✅
├── cats2.25fimage1.png            ✅
├── cats2.25fimage2.png            ✅
├── finance/
│   ├── nikkei-225-index.png       ✅
│   ├── kospi-index.png            ✅
│   └── dow-jones-doac.png         ✅
├── manifest.json                  ✅
├── sw.js                          ✅
├── offline.html                   ✅
├── file.svg                       ✅
├── globe.svg                      ✅
├── next.svg                       ✅
├── vercel.svg                     ✅
└── window.svg                     ✅
```

---

## 🎯 立即行動項目

1. **保存執行長照片**:
   - 將你剛才提供的照片保存為 `public/ceo-profile.jpg`
   - 確保檔案大小合理 (建議 < 500KB)

---

## 🖼️ 圖片使用說明

### 執行長照片用途
- **元件**: `components/modules/CEOProfile.tsx`
- **顯示位置**: 鋒兄首頁 > 人工智慧水電行執行長區塊
- **顯示樣式**: 圓角矩形 (288x288px),帶有藍色漸層邊框
- **持股資訊**: 顯示 37% 以上持股比例

### 水電大亨照片用途
- **元件**: `components/modules/PlumberTycoon.tsx`
- **顯示位置**: 鋒兄首頁 > 水電大亨事業版圖區塊
- **顯示樣式**: 圓角矩形 (264x264px),帶有藍紫漸層邊框

### 貓咪照片用途
- **元件**: `components/modules/CatShowcase.tsx`
- **顯示位置**: 鋒兄首頁 > 鋒兄的貓咪家族區塊
- **顯示樣式**: 卡片式布局,兩隻貓並排顯示

---

## ✅ 檢查清單

- [ ] `public/ceo-profile.jpg` 已新增
- [x] `public/plumber-tycoon.png` 已確認
- [x] `public/cats2.25fimage1.png` 已確認
- [x] `public/cats2.25fimage2.png` 已確認
- [ ] 所有圖片檔案大小合理 (< 1MB)
- [ ] 圖片解析度適當 (至少 400x400px)

---

**最後更新**: 2026年7月10日
