import { MINDVIDEO_FRESH_WINDOW_MS, parseMindvideoStreaksReport } from "../../../lib/mindvideoPoints";

/**
 * 取回 MindVideo / GPT Image 2 點數。
 *
 * 做法完全照抄 LitMedia（見 app/api/_lib/litmediaClient.js）：
 * AutoSignMindVideo 的每日簽到 workflow 跑完會把 `streaks.json` 推到 `results` 分支，
 * 直接讀 raw.githubusercontent.com 就有最新點數——免認證、沒有金鑰要保管、也沒有過期問題。
 *
 * 舊版本靠 GitHub Actions Artifacts API + MINDVIDEO_GITHUB_TOKEN 下載 zip 讀
 * checkin-daily-summary.json；現在兩個 repo 用同一套「發佈到公開分支」的方式，
 * 改讀公開檔案更簡單也更穩，不必再保管唯讀 Token。
 */

const DEFAULT_STREAKS_URL =
  "https://raw.githubusercontent.com/huang1988pioneer/AutoSignMindVideo/results/streaks.json";

/** 同一次 refresh 會問到 33 個帳號，靠這份快取讓來源只被讀一次。 */
let cache = null;

function readStreaksUrl() {
  const configured = String(process.env.MINDVIDEO_STREAKS_URL || "").trim();
  return configured || DEFAULT_STREAKS_URL;
}

/**
 * 取一份 MindVideo 點數報告（含快取）。
 *
 * @param {{ force?: boolean, maxAgeMs?: number, now?: number }} options
 * @returns {Promise<{ report: import("../../../lib/mindvideoPoints").MindvideoReport, source: string, fetchedAt: string }>}
 */
export async function loadMindvideoReport(options = {}) {
  const now = options.now ?? Date.now();
  const maxAgeMs = Number.isFinite(options.maxAgeMs) ? options.maxAgeMs : MINDVIDEO_FRESH_WINDOW_MS;
  if (!options.force && cache && now - cache.at < maxAgeMs) return cache.value;

  const url = readStreaksUrl();
  let response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "fengbro-ai-appwrite/1.0" },
      cache: "no-store",
    });
  } catch (err) {
    throw Object.assign(
      new Error(`讀取簽到結果失敗：${err instanceof Error ? err.message : "連線錯誤"}`),
      { status: 502 }
    );
  }

  if (response.status === 404) {
    throw Object.assign(
      new Error(
        "簽到結果還沒發佈（results 分支上沒有 streaks.json）。等 AutoSignMindVideo 跑完一次就會有。"
      ),
      { status: 404 }
    );
  }
  if (!response.ok) {
    throw Object.assign(new Error(`讀取簽到結果失敗（${response.status}）。`), { status: 502 });
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw Object.assign(new Error("簽到結果不是合法的 JSON。"), { status: 502 });
  }

  const value = {
    report: parseMindvideoStreaksReport(payload),
    source: url,
    fetchedAt: new Date(now).toISOString(),
  };
  cache = { at: now, value };
  return value;
}

/** 測試與手動更新用：清掉快取，下次一定重讀。 */
export function clearMindvideoCache() {
  cache = null;
}
