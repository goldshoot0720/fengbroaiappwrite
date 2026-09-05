import JSZip from "jszip";
import { LITMEDIA_FRESH_WINDOW_MS, parseStreaksReport } from "../../../lib/litmediaPoints";

/**
 * 從 AutoSignLitVideo 的 GitHub Actions 取回 LitMedia 點數。
 *
 * 為什麼繞這一圈：LitMedia 的用量 API 要求請求簽章，光有 token 進不去
 * （見 lib/litmediaPoints.ts 開頭）。而每日簽到的 workflow 本來就會登入、
 * 讀到點數並寫進 `litmedia-streaks-<runId>` artifact，所以直接取用那份結果，
 * 不必破解簽章，也不必跟使用者要 LitMedia 的憑證。
 */

const DEFAULT_REPO = "huang1988pioneer/AutoSignLitVideo";
const ARTIFACT_PREFIX = "litmedia-streaks-";
/** 最新的成功 run 未必留著 artifact（會過期），往回多看幾次。 */
const RUNS_TO_SCAN = 5;

/** 同一次 refresh 會問到 33 個帳號，靠這份快取讓 GitHub 只被打一次。 */
let cache = null;

function readConfig() {
  const token = process.env.LITMEDIA_GITHUB_TOKEN || process.env.GITHUB_TOKEN || "";
  const repo = process.env.LITMEDIA_SIGN_REPO || DEFAULT_REPO;
  return { token: token.trim(), repo: repo.trim() };
}

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "fengbro-ai-appwrite/1.0",
  };
}

async function githubJson(url, token) {
  const response = await fetch(url, { headers: githubHeaders(token), cache: "no-store" });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw Object.assign(
      new Error(`GitHub API ${response.status}：${text ? text.slice(0, 160) : url}`),
      { status: response.status === 401 || response.status === 403 ? 401 : 502 }
    );
  }
  return response.json();
}

/** 找出最近一次「成功且還留著 streaks artifact」的 run。 */
async function findLatestStreaksArtifact(repo, token) {
  const runs = await githubJson(
    `https://api.github.com/repos/${repo}/actions/runs?status=success&per_page=${RUNS_TO_SCAN}&exclude_pull_requests=true`,
    token
  );

  for (const run of runs.workflow_runs || []) {
    const artifacts = await githubJson(
      `https://api.github.com/repos/${repo}/actions/runs/${run.id}/artifacts`,
      token
    );
    const artifact = (artifacts.artifacts || []).find(
      (entry) => !entry.expired && String(entry.name || "").startsWith(ARTIFACT_PREFIX)
    );
    if (artifact) return { run, artifact };
  }

  return null;
}

async function downloadStreaksJson(artifact, token) {
  const response = await fetch(artifact.archive_download_url, {
    headers: githubHeaders(token),
    cache: "no-store",
  });
  if (!response.ok) {
    throw Object.assign(new Error(`下載 artifact 失敗（${response.status}）。`), { status: 502 });
  }

  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  const file = zip.file("streaks.json") || zip.file(/streaks\.json$/)[0];
  if (!file) {
    throw Object.assign(new Error("artifact 裡沒有 streaks.json。"), { status: 502 });
  }
  return JSON.parse(await file.async("string"));
}

/**
 * 取一份 LitMedia 點數報告（含快取）。
 *
 * @param {{ force?: boolean, maxAgeMs?: number, now?: number }} options
 * @returns {Promise<{ report: import("../../../lib/litmediaPoints").LitmediaReport, runId: number, runUrl: string, fetchedAt: string }>}
 */
export async function loadLitmediaReport(options = {}) {
  const now = options.now ?? Date.now();
  const maxAgeMs = Number.isFinite(options.maxAgeMs) ? options.maxAgeMs : LITMEDIA_FRESH_WINDOW_MS;
  if (!options.force && cache && now - cache.at < maxAgeMs) return cache.value;

  const { token, repo } = readConfig();
  if (!token) {
    throw Object.assign(
      new Error("未設定 LITMEDIA_GITHUB_TOKEN，無法讀取簽到結果。"),
      { status: 503 }
    );
  }

  const found = await findLatestStreaksArtifact(repo, token);
  if (!found) {
    throw Object.assign(
      new Error(`${repo} 最近的成功執行都沒有留下 ${ARTIFACT_PREFIX}* artifact。`),
      { status: 404 }
    );
  }

  const value = {
    report: parseStreaksReport(await downloadStreaksJson(found.artifact, token)),
    runId: found.run.id,
    runUrl: found.run.html_url || "",
    fetchedAt: new Date(now).toISOString(),
  };
  cache = { at: now, value };
  return value;
}

/** 測試與手動更新用：清掉快取，下次一定重抓。 */
export function clearLitmediaCache() {
  cache = null;
}
