import { NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { createAppwrite } from "../_lib/appwriteClient";
import { findManagementTable } from "../_lib/managementTables";
import { listAllDocuments } from "../_lib/listAllDocuments";
import { loadCodexSnapshot } from "../_lib/codexClient";
import { sanitizeQuotaRow } from "../_lib/quotaSanitize";
import { readStoredCredential } from "../../../lib/chatgptSession";
import {
  isUsageStale,
  QUOTA_TIME_ZONE,
  toQuotaFields,
  USAGE_FRESH_WINDOW_MS,
} from "../../../lib/codexUsage";

export const dynamic = "force-dynamic";

/**
 * 額度用量自動更新。
 *
 * 存進 Appwrite 的 5 小時／一週比例是「當下的快照」，時間一過就跟現況脫節，
 * 使用者會看到早該重設的視窗還標著「已達使用上限」。這支端點用伺服器端已存的
 * accessToken 重抓一次並寫回，讓畫面上的數字有人負責更新。
 *
 * 不需要四位數密碼：回應只有百分比與重設時間，永遠不會回傳 token 明文，
 * 密碼仍然守著「顯示 accessToken」那條路徑（/api/quota/[id]/access-token）。
 */

/** 同時最多打幾個帳號；對非公開 API 保守一點，避免突發流量。 */
const CONCURRENCY = 3;


function json(data, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

async function refreshOne(databases, databaseId, collectionId, row, updatedRows) {
  const credential = readStoredCredential(row.accessToken);
  if (!credential) {
    return { quotaId: row.$id, account: row.account || "", status: "skipped", reason: "bad-token" };
  }

  let outcome;
  try {
    outcome = await loadCodexSnapshot(credential);
  } catch (err) {
    return {
      quotaId: row.$id,
      account: row.account || "",
      status: "error",
      error: err instanceof Error ? err.message : "查詢用量失敗",
    };
  }

  if (!outcome.ok) {
    return {
      quotaId: row.$id,
      account: row.account || "",
      status: "error",
      error: outcome.error,
      tokenExpiry: outcome.tokenExpiry,
    };
  }

  // expiry5h／expiryWeek 是沒帶時區的牆上時鐘字串；這支端點跑在 UTC 的伺服器上，
  // 一律用台北時間換算，才不會寫成 UTC 的 17:02（＝台北的 01:02）。
  const fields = toQuotaFields(outcome.snapshot, QUOTA_TIME_ZONE);
  const data = {
    ratio5h: fields.ratio5h,
    expiry5h: fields.expiry5h,
    ratioWeek: fields.ratioWeek,
    expiryWeek: fields.expiryWeek,
  };
  // 剩餘積分手動也會維護，API 這次沒回報就別把它洗成 0
  if (outcome.snapshot.credits !== null) data.quotaRemaining = fields.quotaRemaining;

  try {
    // 即使數字沒變也照寫，讓 $updatedAt 成為可信的「最後一次成功同步」時間
    const updated = await databases.updateDocument({
      databaseId,
      collectionId,
      documentId: row.$id,
      data,
    });
    updatedRows.push(updated);
    return { quotaId: row.$id, account: row.account || "", status: "updated", ...data };
  } catch (err) {
    return {
      quotaId: row.$id,
      account: row.account || "",
      status: "error",
      error: err instanceof Error ? err.message : "寫回額度失敗",
    };
  }
}

/**
 * @param {URLSearchParams} searchParams
 * @param {{ quotaIds?: string[] | null, force?: boolean, maxAgeMs?: number }} options
 */
async function runRefresh(searchParams, options = {}) {
  const { databases, databaseId } = createAppwrite(searchParams);
  const collection = await findManagementTable(databases, databaseId, "quota");
  if (!collection) {
    throw Object.assign(new Error("Table quota 不存在，請至「鋒兄設定」中建立缺失 Table。"), {
      status: 404,
    });
  }

  const rows = await listAllDocuments(databases, databaseId, collection.$id, { Query });
  const wanted = options.quotaIds?.length ? new Set(options.quotaIds) : null;
  const maxAgeMs = Number.isFinite(options.maxAgeMs)
    ? Math.max(0, options.maxAgeMs)
    : USAGE_FRESH_WINDOW_MS;
  const now = Date.now();

  const targets = [];
  const results = [];
  for (const row of rows) {
    if (wanted && !wanted.has(row.$id)) continue;
    if (row.serviceType !== "ai") continue;
    if (!row.accessToken) {
      results.push({ quotaId: row.$id, account: row.account || "", status: "skipped", reason: "no-token" });
      continue;
    }
    if (!options.force && !isUsageStale(row.$updatedAt, now, maxAgeMs)) {
      results.push({ quotaId: row.$id, account: row.account || "", status: "fresh", updatedAt: row.$updatedAt || null });
      continue;
    }
    targets.push(row);
  }

  const updatedRows = [];
  let cursor = 0;
  const worker = async () => {
    while (cursor < targets.length) {
      const row = targets[cursor];
      cursor += 1;
      results.push(await refreshOne(databases, databaseId, collection.$id, row, updatedRows));
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, targets.length) }, () => worker())
  );

  return {
    refreshedAt: new Date().toISOString(),
    timeZone: QUOTA_TIME_ZONE,
    maxAgeMs,
    checked: targets.length,
    updated: updatedRows.length,
    failed: results.filter((entry) => entry.status === "error").length,
    results,
    // 回傳更新後的列，前端可以直接套用，不必再多打一次 GET
    rows: updatedRows.map(sanitizeQuotaRow),
  };
}

function failure(err, label) {
  console.error(`${label} /quota-refresh error:`, err);
  const status = Number(err?.status);
  return json(
    { error: err instanceof Error ? err.message : "更新用量失敗" },
    status >= 400 && status < 600 ? status : 500
  );
}

export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);

    let body = {};
    try {
      body = (await request.json()) || {};
    } catch {
      body = {};
    }

    const result = await runRefresh(searchParams, {
      quotaIds: Array.isArray(body.quotaIds)
        ? body.quotaIds.filter((id) => typeof id === "string" && id)
        : null,
      force: body.force === true,
      maxAgeMs: typeof body.maxAgeMs === "number" ? body.maxAgeMs : undefined,
    });
    return json(result);
  } catch (err) {
    return failure(err, "POST");
  }
}

/**
 * 排程用（Vercel cron）。必須設定 CRON_SECRET，否則這條路徑一律關閉——
 * 沒有密鑰的 GET 等於讓任何人都能觸發對 ChatGPT 的請求。
 */
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return json({ error: "未設定 CRON_SECRET，排程更新已停用。" }, 503);
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return json({ error: "unauthorized" }, 401);
  }

  try {
    const { searchParams } = new URL(request.url);
    return json(await runRefresh(searchParams, {}));
  } catch (err) {
    return failure(err, "GET");
  }
}
