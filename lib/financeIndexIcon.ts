/**
 * 指數的可愛圖示。
 *
 * 只在「指數」上出現（名稱含「指數」或 Index，或代號是已知指數），個股不加圖示，
 * 免得每張卡片都掛一個沒有辨識度的符號。比對優先用代號，因為使用者自訂標的的
 * 名稱常常是英文或自己取的代稱。
 */

type IndexIconInput = {
  symbol?: string | null;
  name?: string | null;
  displayName?: string | null;
};

/** 代號 → 圖示。CNBC 用前導點、Yahoo 用 ^，兩種都收。 */
const SYMBOL_ICONS: Record<string, string> = {
  ".SOX": "💾", // 費城半導體
  "^SOX": "💾",
  ".KS11": "🐯", // KOSPI
  "^KS11": "🐯",
  ".N225": "🗻", // 日經 225
  "^N225": "🗻",
  "998407.O": "🗻",
  ".TWII": "🧋", // 台灣加權
  "^TWII": "🧋",
  ".SPX": "🦅", // 標普 500
  "^GSPC": "🦅",
  ".IXIC": "🚀", // 納斯達克
  "^IXIC": "🚀",
  ".DJI": "🏭", // 道瓊
  "^DJI": "🏭",
  ".HSI": "🌃", // 恒生
  "^HSI": "🌃",
  ".VIX": "😱", // 恐慌指數
  "^VIX": "😱",
};

/** 名稱關鍵字 → 圖示，代號沒對到時才用。 */
const NAME_ICONS: Array<{ pattern: RegExp; emoji: string }> = [
  { pattern: /半導體|semiconductor/i, emoji: "💾" },
  { pattern: /kospi|韓國|korea/i, emoji: "🐯" },
  { pattern: /日經|nikkei|日本|japan/i, emoji: "🗻" },
  { pattern: /加權|台灣|taiwan|櫃買|tpex/i, emoji: "🧋" },
  { pattern: /納斯達克|nasdaq/i, emoji: "🚀" },
  { pattern: /道瓊|dow/i, emoji: "🏭" },
  { pattern: /標普|s&p|sp500/i, emoji: "🦅" },
  { pattern: /恒生|hang seng/i, emoji: "🌃" },
  { pattern: /恐慌|vix/i, emoji: "😱" },
];

/**
 * 名稱看得出是指數的關鍵字。
 *
 * 不能只認「指數／Index」：Yahoo 對 ^IXIC 給的 displayName 是「NASDAQ Composite」，
 * 沒有 Index 這個字，只認那兩個字會漏掉它。
 */
export const FINANCE_INDEX_NAME_PATTERN =
  /指數|index|composite|加權|平均股價|kospi|nasdaq|道瓊|dow jones|s&p|恒生|vix/i;

/** 名稱含指數關鍵字，或代號是已知指數。 */
export function isFinanceIndex(input: IndexIconInput): boolean {
  const symbol = String(input.symbol || "").trim().toUpperCase();
  if (SYMBOL_ICONS[symbol]) return true;
  const name = `${input.displayName || ""} ${input.name || ""}`;
  return FINANCE_INDEX_NAME_PATTERN.test(name);
}

/**
 * 回傳圖示；不是指數就回空字串（呼叫端直接不渲染）。
 * 已知指數但沒有專屬圖示時給 📈，至少看得出來是指數。
 */
export function getFinanceIndexEmoji(input: IndexIconInput): string {
  if (!isFinanceIndex(input)) return "";
  const symbol = String(input.symbol || "").trim().toUpperCase();
  const direct = SYMBOL_ICONS[symbol];
  if (direct) return direct;

  const name = `${input.displayName || ""} ${input.name || ""}`;
  for (const rule of NAME_ICONS) {
    if (rule.pattern.test(name)) return rule.emoji;
  }
  return "📈";
}
