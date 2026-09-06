/** AutoSignOiiOii 的 result/streaks.json（相容舊 daily summary），詳見 docs/research/oiioii-quota.md。 */
export const OIIOII_FRESH_WINDOW_MS = 33 * 60 * 1000;

export interface OiioiiAccountPoints {
  account: number | null;
  name: string;
  status: string | null;
  currentPoints: number | null;
  finishedAt: string | null;
}

export interface OiioiiReport {
  generatedAt: string | null;
  accounts: OiioiiAccountPoints[];
}

function iso(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

export function parseOiioiiReport(payload: unknown): OiioiiReport {
  const bag = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const rows = Array.isArray(bag.accounts) ? bag.accounts : Array.isArray(bag.rows) ? bag.rows : [];
  return {
    generatedAt: iso(bag.generatedAt),
    accounts: rows.filter((row) => row && typeof row === "object" && !Array.isArray(row)).map((row) => ({
      account: Number.isInteger(row.account) && row.account > 0 ? row.account : null,
      name: typeof row.name === "string" ? row.name : "",
      status: typeof row.status === "string" ? row.status : null,
      currentPoints: typeof (row.currentPoints ?? row.remainingCredits) === "number" && Number.isFinite(row.currentPoints ?? row.remainingCredits) && (row.currentPoints ?? row.remainingCredits) >= 0
        ? (row.currentPoints ?? row.remainingCredits) : null,
      finishedAt: iso(row.finishedAt),
    })),
  };
}

export function isOiioiiService(name?: string | null): boolean {
  return /^oiioii(?:\.ai)?$/i.test((name || "").trim());
}

/** 帳號欄填報告中的 name 或槽位編號；不模糊比對，避免更新錯帳號。 */
export function findOiioiiAccount(report: OiioiiReport, key?: string | null): OiioiiAccountPoints | null {
  const normalized = (key || "").trim().toLowerCase();
  if (!normalized) return null;
  const matches = report.accounts.filter((row) => /^\d+$/.test(normalized)
    ? row.account === Number(normalized)
    : row.name.trim().toLowerCase() === normalized);
  return matches.length === 1 ? matches[0] : null;
}

export function toOiioiiPointsFields(entry: OiioiiAccountPoints | null, report: OiioiiReport) {
  if (!entry || entry.status !== "checked_in" || entry.currentPoints === null) return null;
  const measuredAt = entry.finishedAt || report.generatedAt;
  if (!measuredAt) return null;
  return { quotaPoints: Math.round(entry.currentPoints), pointsSyncedAt: measuredAt };
}
