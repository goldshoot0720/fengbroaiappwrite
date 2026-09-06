import JSZip from "jszip";
import { OIIOII_FRESH_WINDOW_MS, parseOiioiiReport } from "../../../lib/oiioiiPoints";

const REPO = "huang1988pioneer/AutoSignOiiOii";
const API = `https://api.github.com/repos/${REPO}`;
let cache = null;

function failure(message, status = 502) {
  return Object.assign(new Error(message), { status });
}

async function github(path, token) {
  const response = await fetch(`${API}${path}`, {
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "User-Agent": "fengbro-ai-appwrite/1.0" },
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw failure(`讀取 OiiOii GitHub 報告失敗（${response.status}），請確認 Token 有 Actions 讀取權限。`);
  return response;
}

/** 最新完整工作流的報告；不把使用者範例 run ID 寫死。 */
export async function loadOiioiiReport(options = {}) {
  const now = options.now ?? Date.now();
  if (!options.force && cache && now - cache.at < OIIOII_FRESH_WINDOW_MS) return cache.value;
  const token = String(process.env.OIIOII_GITHUB_TOKEN || "").trim();
  if (!token) throw failure("OiiOii 報告需要 GitHub Actions 讀取權限，請在部署環境設定 OIIOII_GITHUB_TOKEN。", 503);

  const { workflow_runs: runs = [] } = await (await github(
    "/actions/workflows/claim-oiioii-lunch.yml/runs?status=completed&per_page=10", token
  )).json();
  let artifact;
  let run;
  // 失敗的工作流也可能有其他帳號的有效點數；採逐帳號狀態判斷。
  for (const candidate of runs) {
    const { artifacts = [] } = await (await github(`/actions/runs/${candidate.id}/artifacts?per_page=100`, token)).json();
    artifact = artifacts.find((item) => item.name === "oiioii-claim-report" && !item.expired);
    if (artifact) { run = candidate; break; }
  }
  if (!artifact) throw failure("最近 10 次 OiiOii 工作流沒有可下載的點數報告，請確認簽到工作流已產生報告。", 404);
  const response = await github(`/actions/artifacts/${artifact.id}/zip`, token);
  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  const file = zip.file("oiioii-daily-summary.json");
  if (!file) throw failure("OiiOii 報告缺少 oiioii-daily-summary.json。");
  let payload;
  try { payload = JSON.parse(await file.async("string")); }
  catch { throw failure("OiiOii 點數報告不是合法的 JSON。"); }
  if (!payload || !Array.isArray(payload.rows)) throw failure("OiiOii 點數報告缺少 rows。");
  const value = {
    report: parseOiioiiReport(payload),
    source: `https://github.com/${REPO}/actions/runs/${run.id}`,
    fetchedAt: new Date(now).toISOString(),
  };
  cache = { at: now, value };
  return value;
}

export function clearOiioiiCache() { cache = null; }
