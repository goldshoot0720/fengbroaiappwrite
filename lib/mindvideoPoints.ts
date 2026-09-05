/**
 * MindVideo 的 GPT Image 2 專屬點數，做法照抄 LitMedia（見 lib/litmediaPoints.ts）：
 *
 * AutoSignMindVideo 的每日簽到 workflow 跑完後，會把 `streaks.json` 推到 `results` 分支，
 * 逐一列出每個帳號的一般點數（totalCredits/remainingCredits/usedCredits）與
 * GPT Image 2 專屬點數（`gptImage2.remaining`）、`finishedAt`（讀到那個數字的時刻）。
 * 這份檔案在公開分支上，raw.githubusercontent.com 免認證就能讀，不必保管 GitHub token，
 * 也不會遇到 artifact 下載一律要認證、PAT 過期之類的問題（同一套理由見 litmediaPoints.ts 開頭）。
 *
 * GPT Image 2 的額度跟 MindVideo 一般點數是分開的池子，這裡只取 `gptImage2.remaining`。
 */

export interface MindvideoAccountPoints {
  /** streaks.json 裡的帳號槽位編號（1–33） */
  account: number | null;
  /** 槽位標籤，例如 `goldshoot0720` */
  label: string;
  /** 這次簽到的狀態；只有成功簽到／已簽到才採信點數 */
  status: string | null;
  /** GPT Image 2 專屬剩餘點數；這次沒讀到就是 null */
  gptImage2Remaining: number | null;
  /** 讀到這個點數的時刻（ISO） */
  finishedAt: string | null;
}

export interface MindvideoReport {
  /** 整份報告產生的時間，供沒有 finishedAt 的帳號退而求其次 */
  generatedAt: string | null;
  accounts: MindvideoAccountPoints[];
}

/** 點數的保鮮期：33 分鐘內沿用既有數字，不重複跟 GitHub 要檔案。跟 LitMedia 同一個理由。 */
export const MINDVIDEO_FRESH_WINDOW_MS = 33 * 60 * 1000;

/** 只有這些狀態代表「這次簽到讀到的點數可信」；其餘（如 skipped/failed）就當沒讀到。 */
const MINDVIDEO_ACTIVE_STATUSES = new Set(["checked_in", "already_done"]);

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

/** 解析 `results` 分支上的 streaks.json。格式不符就回空報告，不丟例外。 */
export function parseMindvideoStreaksReport(payload: unknown): MindvideoReport {
  const bag = isBag(payload) ? payload : {};
  const rawAccounts = Array.isArray(bag.accounts) ? bag.accounts : [];

  const accounts: MindvideoAccountPoints[] = [];
  for (const entry of rawAccounts) {
    if (!isBag(entry)) continue;
    const gptImage2 = isBag(entry.gptImage2) ? entry.gptImage2 : null;
    const remaining = gptImage2 ? toNumberOrNull(gptImage2.remaining) : null;
    accounts.push({
      account: toNumberOrNull(entry.account),
      label: typeof entry.label === "string" ? entry.label : "",
      status: typeof entry.status === "string" ? entry.status : null,
      gptImage2Remaining: remaining !== null && remaining >= 0 ? remaining : null,
      finishedAt: toIsoOrNull(entry.finishedAt),
    });
  }

  return { generatedAt: toIsoOrNull(bag.generatedAt), accounts };
}

/** 比對用的正規化：去掉大小寫與前後空白，槽位標籤本身就是乾淨的帳號名（不像 LitMedia 有 `-checkin (19)` 尾巴）。 */
export function normalizeMindvideoKey(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase();
}

/**
 * 找出額度列對應的帳號。
 * `key` 可以是槽位編號（`30`）或槽位標籤（`goldshoot0720`）。
 */
export function findMindvideoAccount(
  report: MindvideoReport,
  key: string | null | undefined
): MindvideoAccountPoints | null {
  const raw = String(key || "").trim();
  if (!raw) return null;

  if (/^\d+$/.test(raw)) {
    const wanted = Number(raw);
    return report.accounts.find((entry) => entry.account === wanted) || null;
  }

  const normalized = normalizeMindvideoKey(raw);
  if (!normalized) return null;
  return report.accounts.find((entry) => normalizeMindvideoKey(entry.label) === normalized) || null;
}

/** GPT Image 2 的點數是獨立的池子，跟一般 MindVideo 點數分開。 */
export function isMindvideoImageService(name?: string | null): boolean {
  return /^mindvideo\s*[/／]\s*gpt\s*image\s*2$/i.test((name || "").trim());
}

export interface MindvideoPointsFields {
  quotaPoints: number;
  /** 讀到這個點數的時刻，寫進 Appwrite 的 pointsSyncedAt */
  pointsSyncedAt: string;
}

/**
 * 轉成要寫回額度列的欄位。
 * 沒有讀到點數、簽到沒成功，就回 null——寧可留著舊數字，也不要覆蓋成 0。
 */
export function toMindvideoPointsFields(
  entry: MindvideoAccountPoints | null,
  report: MindvideoReport
): MindvideoPointsFields | null {
  if (!entry) return null;
  if (!entry.status || !MINDVIDEO_ACTIVE_STATUSES.has(entry.status)) return null;
  if (entry.gptImage2Remaining === null) return null;
  const measuredAt = entry.finishedAt || report.generatedAt;
  if (!measuredAt) return null;
  return {
    quotaPoints: Math.max(0, Math.round(entry.gptImage2Remaining)),
    pointsSyncedAt: measuredAt,
  };
}
