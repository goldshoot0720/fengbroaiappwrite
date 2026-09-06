import { normalizeCommandCodeUsage } from "../../../lib/commandCodeUsage";

/** Command Code CLI 所用的帳號與用量 API。 */
const API_BASE = "https://api.commandcode.ai";

function buildHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

async function fetchJson(path, apiKey) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: buildHeaders(apiKey),
    cache: "no-store",
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { ok: response.ok, status: response.status, data };
}

function unavailable(status) {
  if (status === 401 || status === 403) {
    return "Command Code API key 無效或權限不足，請重新登入 CLI 後貼上 ~/.commandcode/auth.json。";
  }
  if (status === 429) return "Command Code 用量查詢被限流，稍後再試。";
  return "無法取得 Command Code 用量資料（非公開 API 格式可能已變動）。";
}

/**
 * 取 Command Code 的三個額度維度；API key 只停留在伺服器端，快照不會含憑證。
 * @param {{ apiKey: string }} credential
 */
export async function loadCommandCodeSnapshot(credential) {
  if (!credential?.apiKey) {
    return { ok: false, status: 400, error: "沒有可用的 Command Code API key。" };
  }

  let whoami;
  try {
    whoami = await fetchJson("/alpha/whoami?limits=1", credential.apiKey);
  } catch {
    return { ok: false, status: 502, error: unavailable(502) };
  }
  if (!whoami.ok) return { ok: false, status: whoami.status || 502, error: unavailable(whoami.status) };

  const orgId = typeof whoami.data?.org?.id === "string" ? whoami.data.org.id : "";
  const suffix = orgId ? `?orgId=${encodeURIComponent(orgId)}` : "";
  let credits;
  let subscription;
  try {
    [credits, subscription] = await Promise.all([
      fetchJson(`/alpha/billing/credits${suffix}`, credential.apiKey),
      fetchJson(`/alpha/billing/subscriptions${suffix}`, credential.apiKey),
    ]);
  } catch {
    return { ok: false, status: 502, error: unavailable(502) };
  }
  if (!credits.ok) return { ok: false, status: credits.status || 502, error: unavailable(credits.status) };
  if (!subscription.ok) return { ok: false, status: subscription.status || 502, error: unavailable(subscription.status) };

  return {
    ok: true,
    snapshot: normalizeCommandCodeUsage(
      { whoami: whoami.data, credits: credits.data, subscription: subscription.data },
      `${API_BASE}/alpha`,
    ),
  };
}
