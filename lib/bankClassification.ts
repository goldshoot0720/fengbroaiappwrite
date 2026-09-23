import type { Bank } from "@/types";

const TAIWAN_BANK_KEYWORDS = [
  "台灣銀行",
  "臺灣銀行",
  "土地銀行",
  "合作金庫",
  "第一銀行",
  "華南銀行",
  "彰化銀行",
  "上海商銀",
  "台北富邦",
  "富邦銀行",
  "國泰世華",
  "高雄銀行",
  "兆豐",
  "花旗",
  "王道",
  "台企銀",
  "臺企銀",
  "渣打",
  "台中銀行",
  "京城銀行",
  "滙豐",
  "匯豐",
  "瑞興",
  "華泰",
  "新光銀行",
  "中華郵政",
  "郵局",
  "郵政",
  "陽信",
  "板信",
  "三信",
  "聯邦",
  "遠東商銀",
  "元大銀行",
  "永豐",
  "玉山",
  "凱基",
  "星展",
  "台新",
  "安泰",
  "中國信託",
  "中信",
  "將來銀行",
  "樂天銀行",
  "連線銀行",
  "line bank",
  "richart",
  "bank",
];

const TAIWAN_BANK_DOMAINS = [
  "bot.com.tw",
  "landbank.com.tw",
  "tcb-bank.com.tw",
  "firstbank.com.tw",
  "hncb.com.tw",
  "bankchb.com",
  "scsb.com.tw",
  "taipeifubon.com.tw",
  "cathaybk.com.tw",
  "bok.com.tw",
  "megabank.com.tw",
  "citibank.com.tw",
  "obank.com.tw",
  "tbb.com.tw",
  "sc.com",
  "tcbbank.com.tw",
  "kingsbank.com.tw",
  "hsbc.com.tw",
  "taipeistarbank.com.tw",
  "entrustbank.com.tw",
  "skbank.com.tw",
  "post.gov.tw",
  "post.com.tw",
  "sunnybank.com.tw",
  "bop.com.tw",
  "credit.com.tw",
  "ubot.com.tw",
  "feib.com.tw",
  "yuanta.com",
  "sinopac.com",
  "esunbank.com.tw",
  "kgibank.com",
  "dbs.com.tw",
  "taishinbank.com.tw",
  "entiebank.com.tw",
  "ctbcbank.com",
  "nextbank.com.tw",
  "rakuten-bank.com.tw",
  "linebank.com.tw",
];

/**
 * Loyalty points are counted in 點, not money, so they cannot sit in the same
 * total as a bank balance. Matching is deliberately narrow — bare "點" would
 * catch names like "全家點餐" — and a record is only treated as points when it
 * is not already a bank.
 */
const POINTS_KEYWORDS = [
  "點數",
  "紅利",
  "哩程",
  "里程",
  "積點",
  "積分",
  "點回饋",
  "line points",
  "line point",
  "linepoints",
  "line pay point",
  "linepay point",
  "openpoint",
  "open point",
  "happy go",
  "happygo",
  "亞洲萬里通",
  "asia miles",
  "ubear point",
  "全聯福利點",
  "熊贊",
];

function haystackOf(bank: Bank): string {
  return [bank.name, bank.site, bank.card, bank.account, bank.address, bank.note]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function isTaiwanBankAccount(bank: Bank): boolean {
  const haystack = haystackOf(bank);

  if (!haystack.trim()) return false;

  return (
    TAIWAN_BANK_KEYWORDS.some((keyword) => haystack.includes(keyword.toLowerCase())) ||
    TAIWAN_BANK_DOMAINS.some((domain) => haystack.includes(domain))
  );
}

export function isPointsAccount(bank: Bank): boolean {
  const haystack = haystackOf(bank);
  if (!haystack.trim()) return false;
  return POINTS_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

export type BankCategory = "bank" | "ticket" | "points";

/**
 * The one place that decides which section a record belongs to, so the three
 * buckets stay mutually exclusive and nothing is counted twice.
 *
 * Bank wins first: "玉山銀行紅利點數" is still a bank account. 票證 stays the
 * catch-all it always was.
 */
const EXPLICIT_CATEGORIES: readonly BankCategory[] = ["bank", "ticket", "points"];

function readExplicitCategory(bank: Bank): BankCategory | null {
  const stored = (bank.category || "").trim().toLowerCase();
  return EXPLICIT_CATEGORIES.includes(stored as BankCategory) ? (stored as BankCategory) : null;
}

export function classifyBankRecord(bank: Bank): BankCategory {
  // A category someone actually chose beats anything guessed from the name.
  const explicit = readExplicitCategory(bank);
  if (explicit) return explicit;

  if (isTaiwanBankAccount(bank)) return "bank";
  if (isPointsAccount(bank)) return "points";
  return "ticket";
}

/** 這筆是使用者指定的，還是關鍵字推斷出來的？ */
export function hasExplicitCategory(bank: Bank): boolean {
  return readExplicitCategory(bank) !== null;
}
