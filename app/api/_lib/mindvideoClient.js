import JSZip from "jszip";

const REPO = "huang1988pioneer/AutoSignMindVideo";
let cache = null;

/** Read the latest published report, never account tokens or general credits. */
export async function loadMindvideoReport({ force = false, now = Date.now() } = {}) {
  if (!force && cache && now - cache.at < 33 * 60 * 1000) return cache.value;
  const token = process.env.MINDVIDEO_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) throw new Error("MindVideo 點數同步需要設定 MINDVIDEO_GITHUB_TOKEN（Actions 唯讀權限）。");
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "fengbro-ai-appwrite",
  };
  const response = await fetch(`https://api.github.com/repos/${REPO}/actions/artifacts?name=mindvideo-checkin-report&per_page=20`, {
    headers, cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`讀取 MindVideo 報告清單失敗（${response.status}）。`);
  const listing = await response.json();
  const artifact = (listing.artifacts || [])
    .filter((item) => item.name === "mindvideo-checkin-report" && !item.expired)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
  if (!artifact || !Number.isSafeInteger(artifact.id)) throw new Error("沒有可下載的 MindVideo 簽到報告。");
  if (artifact.size_in_bytes > 5_000_000) throw new Error("MindVideo 報告超過大小限制。");
  const archive = await fetch(`https://api.github.com/repos/${REPO}/actions/artifacts/${artifact.id}/zip`, {
    headers, cache: "no-store", signal: AbortSignal.timeout(20000),
  });
  if (!archive.ok) throw new Error(`下載 MindVideo 報告失敗（${archive.status}）。`);
  const zip = await JSZip.loadAsync(await archive.arrayBuffer());
  const file = zip.file("checkin-daily-summary.json");
  if (!file) throw new Error("MindVideo 報告缺少點數摘要。");
  const report = JSON.parse(await file.async("string"));
  if (!Array.isArray(report.rows)) throw new Error("MindVideo 點數摘要格式不符。");
  const value = { report, source: `https://github.com/${REPO}/actions/runs/${artifact.workflow_run.id}` };
  cache = { at: now, value };
  return value;
}
