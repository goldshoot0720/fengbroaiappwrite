import { OIIOII_FRESH_WINDOW_MS, parseOiioiiReport } from "../../../lib/oiioiiPoints";

const SOURCE = "https://raw.githubusercontent.com/huang1988pioneer/AutoSignOiiOii/result/streaks.json";
let cache = null;

function failure(message, status = 502) {
  return Object.assign(new Error(message), { status });
}

/** 公開 result 分支的剩餘點數，不需要 GitHub Actions Token。 */
export async function loadOiioiiReport(options = {}) {
  const now = options.now ?? Date.now();
  if (!options.force && cache && now - cache.at < OIIOII_FRESH_WINDOW_MS) return cache.value;
  const response = await fetch(SOURCE, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw failure(`讀取 OiiOii streaks.json 失敗（${response.status}）。`);
  let payload;
  try { payload = await response.json(); }
  catch { throw failure("OiiOii 點數報告不是合法的 JSON。"); }
  if (!payload || !Array.isArray(payload.accounts)) throw failure("OiiOii 點數報告缺少 accounts。");
  const value = {
    report: parseOiioiiReport(payload),
    source: SOURCE,
    fetchedAt: new Date(now).toISOString(),
  };
  cache = { at: now, value };
  return value;
}

export function clearOiioiiCache() { cache = null; }
