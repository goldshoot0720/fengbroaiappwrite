import { LITMEDIA_FRESH_WINDOW_MS, parseStreaksReport } from "../../../lib/litmediaPoints";

/**
 * 取回 LitMedia 點數。
 *
 * 為什麼是讀一個公開檔案：LitMedia 的用量 API 要求請求簽章，光有 token 進不去
 * （見 lib/litmediaPoints.ts 開頭）。點數只存在於每日簽到 workflow 跑完的結果裡，
 * 而 GitHub 的 artifact 下載一律需要認證——public repo 也一樣（實測無 token 回 401）。
 *
 * 所以 AutoSignLitVideo 每次跑完會把 streaks.json 推到 `results` 分支，
 * 這裡直接讀 raw.githubusercontent.com：免認證、沒有金鑰要保管、也沒有過期問題。
 */

const DEFAULT_STREAKS_URL =
  "https://raw.githubusercontent.com/huang1988pioneer/AutoSignLitVideo/results/streaks.json";

/** 同一次 refresh 會問到 33 個帳號，靠這份快取讓來源只被讀一次。 */
let cache = null;

function readStreaksUrl() {
  const configured = String(process.env.LITMEDIA_STREAKS_URL || "").trim();
  return configured || DEFAULT_STREAKS_URL;
}

/**
 * 取一份 LitMedia 點數報告（含快取）。
 *
 * @param {{ force?: boolean, maxAgeMs?: number, now?: number }} options
 * @returns {Promise<{ report: import("../../../lib/litmediaPoints").LitmediaReport, source: string, fetchedAt: string }>}
 */
export async function loadLitmediaReport(options = {}) {
  const now = options.now ?? Date.now();
  const maxAgeMs = Number.isFinite(options.maxAgeMs) ? options.maxAgeMs : LITMEDIA_FRESH_WINDOW_MS;
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
        "簽到結果還沒發佈（results 分支上沒有 streaks.json）。等 AutoSignLitVideo 跑完一次就會有。"
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
    report: parseStreaksReport(payload),
    source: url,
    fetchedAt: new Date(now).toISOString(),
  };
  cache = { at: now, value };
  return value;
}

/** 測試與手動更新用：清掉快取，下次一定重讀。 */
export function clearLitmediaCache() {
  cache = null;
}
