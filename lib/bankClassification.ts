import { Bank } from "@/types";

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

export function isTaiwanBankAccount(bank: Bank): boolean {
  const haystack = [bank.name, bank.site, bank.card, bank.account, bank.address]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!haystack.trim()) return false;

  return (
    TAIWAN_BANK_KEYWORDS.some((keyword) => haystack.includes(keyword.toLowerCase())) ||
    TAIWAN_BANK_DOMAINS.some((domain) => haystack.includes(domain))
  );
}
