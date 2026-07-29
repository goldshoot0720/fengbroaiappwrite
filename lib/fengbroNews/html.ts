/** HTML / text helpers for Fengbro News scraping. */

export function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;/g, " ")
    .trim();
}

export function normalizeSpace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function stripTags(value: string) {
  return normalizeSpace(decodeHtml(value.replace(/<[^>]+>/g, " ")));
}

export function titleMatches(title: string, query: string) {
  const t = normalizeSpace(title).toLowerCase();
  const q = normalizeSpace(query).toLowerCase();
  if (!q) return true;
  // Require all space-separated tokens to appear in title
  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.every((token) => t.includes(token));
}

export function stripNoiseHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ");
}

export function isJunkNewsTitle(title: string): boolean {
  const t = normalizeSpace(title);
  if (!t || t.length < 6 || t.length > 160) return true;
  // Navigation / UI chrome
  if (/^(上一頁|下一頁|最新|看板|所有文章|搜尋|首頁|回目錄|更多|看更多|分享|訂閱|登入|註冊)$/i.test(t)) {
    return true;
  }
  // Ad / tracker / DFP / prebid noise (UDN etc.)
  if (
    /DFP|prebid|googletag|gpt-ad|ads-|bidder|openx|rubicon|taboola|bridgewell|criteo|pbjs|pubads|defineSlot|sizeMapping|adUnits|clientId|eruId|stickyAds|billboard|superBanner/i.test(
      t
    )
  ) {
    return true;
  }
  // Looks like JavaScript / code, not a headline
  if (/[{};=]|function\s*\(|console\.log|var\s+\w+|const\s+\w+|=>/.test(t)) return true;
  if ((t.match(/[a-zA-Z]{3,}/g) || []).length >= 8 && !/[\u4e00-\u9fff]{4,}/.test(t)) return true;
  // Must contain some CJK or enough letters for a real title
  const cjk = (t.match(/[\u4e00-\u9fff]/g) || []).length;
  const letters = (t.match(/[A-Za-z0-9\u4e00-\u9fff]/g) || []).length;
  if (cjk < 2 && letters < 12) return true;
  if (letters / Math.max(t.length, 1) < 0.35) return true;
  return false;
}

export function decodeXml(value: string) {
  return decodeHtml(
    value
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<[^>]+>/g, "")
  );
}

export function pickXml(text: string, pattern: RegExp) {
  return decodeXml(pattern.exec(text)?.[1] || "");
}

