/** GPT Image 2 credits are separate from MindVideo's general credit pool. */
export function isMindvideoImageService(name?: string | null): boolean {
  return /^mindvideo\s*[/／]\s*gpt\s*image\s*2$/i.test((name || "").trim());
}

function accountKey(value: string): string {
  return value.trim().toLowerCase().replace(/^checkin-\d+-/, "");
}

export function mindvideoPointsForAccount(payload: unknown, account: string) {
  if (!payload || typeof payload !== "object" || !account.trim()) return null;
  const report = payload as Record<string, unknown>;
  if (!Array.isArray(report.rows)) return null;
  const matches = report.rows.filter((row) => {
    if (!row || typeof row !== "object") return false;
    return [row.name, row.label, String(row.account ?? "")].some(
      (value) => typeof value === "string" && accountKey(value) === accountKey(account),
    );
  });
  // Never select a different account via partial-name matching.
  if (matches.length !== 1) return null;
  const row = matches[0];
  if (!["checked_in", "already_done"].includes(row.status)) return null;
  const points = row.gptImage2?.remaining;
  if (typeof points !== "number" || !Number.isFinite(points) || points < 0) return null;
  const stamp = row.finishedAt || report.generatedAt;
  if (typeof stamp !== "string" || !Number.isFinite(Date.parse(stamp))) return null;
  return { quotaPoints: points, pointsSyncedAt: new Date(stamp).toISOString() };
}
