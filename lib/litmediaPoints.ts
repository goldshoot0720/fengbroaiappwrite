/**
 * LitMedia 剩餘點數的資料來源與正規化。
 *
 * LitMedia 的用量 API（litvideo-api.litmedia.ai/lit-video/get-user-info）要求請求簽章，
 * 只有 token 打不進去——不論帶不帶 Authorization 都回 `{"code":4011,"msg":"The sign failed"}`。
 * 所以點數不是即時去問來的，而是取自每日自動簽到 AutoSignLitVideo 跑完時記下的數字：
 * 該 workflow 每次成功都會上傳 `litmedia-streaks-<runId>` artifact，裡面 `streaks.json`
 * 逐一列出每個帳號的 `creditBalance`（剩餘點數）與 `finishedAt`（讀到那個數字的時刻）。
 *
 * 因此畫面上的時間必須是 `finishedAt`，不是我們寫進 Appwrite 的時間——
 * 兩者可能差好幾個小時，寫成後者等於謊報新鮮度。
 */

export interface LitmediaAccountPoints {
  /** artifact 裡的帳號槽位編號（1–33） */
  account: number | null;
  /** 槽位標籤，例如 `goldshoot0720-checkin (19)` */
  label: string;
  /** 剩餘點數；該帳號這次沒讀到就是 null */
  creditBalance: number | null;
  /** 讀到這個點數的時刻（ISO） */
  finishedAt: string | null;
}

export interface LitmediaReport {
  /** 整份報告產生的時間，供沒有 finishedAt 的帳號退而求其次 */
  generatedAt: string | null;
  accounts: LitmediaAccountPoints[];
}

/** 點數的保鮮期：33 分鐘內沿用既有數字，不重複跟 GitHub 要 artifact。 */
export const LITMEDIA_FRESH_WINDOW_MS = 33 * 60 * 1000;

type Bag = Record<string, unknown>;

function isBag(value: unknown): value is Bag {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/[,，\s]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toIsoOrNull(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** 解析 artifact 裡的 streaks.json。格式不符就回空報告，不丟例外。 */
export function parseStreaksReport(payload: unknown): LitmediaReport {
  const bag = isBag(payload) ? payload : {};
  const rawAccounts = Array.isArray(bag.accounts) ? bag.accounts : [];

  const accounts: LitmediaAccountPoints[] = [];
  for (const entry of rawAccounts) {
    if (!isBag(entry)) continue;
    const balance = toNumberOrNull(entry.creditBalance);
    accounts.push({
      account: toNumberOrNull(entry.account),
      label: typeof entry.label === "string" ? entry.label : "",
      creditBalance: balance !== null && balance >= 0 ? balance : null,
      finishedAt: toIsoOrNull(entry.finishedAt),
    });
  }

  return { generatedAt: toIsoOrNull(bag.generatedAt), accounts };
}

/**
 * 比對用的正規化：去掉大小寫、括號裡的槽位號、分隔符號與 checkin 後綴。
 * 分隔符號要先收掉再砍後綴——去掉 (19) 會留下尾隨空白，
 * 先砍後綴的話 goldshoot0720-checkin (19) 會停在 goldshoot0720checkin。
 */
export function normalizeLitmediaKey(value: string | null | undefined): string {
  return String(value || "")
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[\s_-]+/g, "")
    .replace(/checkin$/, "");
}

/**
 * 找出額度列對應的帳號。
 * `key` 可以是槽位編號（`19`）或槽位名稱（`goldshoot0720-checkin`）。
 */
export function findLitmediaAccount(
  report: LitmediaReport,
  key: string | null | undefined
): LitmediaAccountPoints | null {
  const raw = String(key || "").trim();
  if (!raw) return null;

  if (/^\d+$/.test(raw)) {
    const wanted = Number(raw);
    return report.accounts.find((entry) => entry.account === wanted) || null;
  }

  const normalized = normalizeLitmediaKey(raw);
  if (!normalized) return null;
  return (
    report.accounts.find((entry) => normalizeLitmediaKey(entry.label) === normalized) ||
    report.accounts.find((entry) => normalizeLitmediaKey(entry.label).includes(normalized)) ||
    null
  );
}

/**
 * 這一列是不是 LitMedia 的額度？看服務名稱就好。
 * 有了這個，服務名稱含 LitMedia 的列只要「帳號」跟簽到槽位名對得上就會自動帶入，
 * 不必再手動填一次槽位編號；對不上的才需要 litmediaAccount 明確指定。
 */
export function isLitmediaServiceName(name: string | null | undefined): boolean {
  return /litmedia/i.test(String(name || ""));
}

/** 額度列要拿哪個值去對槽位：明確指定優先，否則用帳號。 */
export function resolveLitmediaKey(row: {
  name?: string | null;
  account?: string | null;
  litmediaAccount?: string | null;
}): string {
  const explicit = String(row.litmediaAccount || "").trim();
  if (explicit) return explicit;
  return isLitmediaServiceName(row.name) ? String(row.account || "").trim() : "";
}

export interface LitmediaPointsFields {
  quotaPoints: number;
  /** 讀到這個點數的時刻，寫進 Appwrite 的 pointsSyncedAt */
  pointsSyncedAt: string;
}

/**
 * 轉成要寫回額度列的欄位。
 * 沒有讀到點數就回 null——寧可留著舊數字，也不要覆蓋成 0。
 */
export function toLitmediaPointsFields(
  entry: LitmediaAccountPoints | null,
  report: LitmediaReport
): LitmediaPointsFields | null {
  if (!entry || entry.creditBalance === null) return null;
  const measuredAt = entry.finishedAt || report.generatedAt;
  if (!measuredAt) return null;
  return {
    quotaPoints: Math.max(0, Math.round(entry.creditBalance)),
    pointsSyncedAt: measuredAt,
  };
}
