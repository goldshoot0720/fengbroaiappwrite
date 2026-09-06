import { NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { createAppwrite } from "../_lib/appwriteClient";
import { findManagementTable } from "../_lib/managementTables";
import { listAllDocuments } from "../_lib/listAllDocuments";
import { loadCodexSnapshot } from "../_lib/codexClient";
import { loadClaudeSnapshot } from "../_lib/claudeClient";
import { loadLitmediaReport } from "../_lib/litmediaClient";
import { loadMindvideoReport } from "../_lib/mindvideoClient";
import {
  findMindvideoAccount,
  isMindvideoImageService,
  MINDVIDEO_FRESH_WINDOW_MS,
  toMindvideoPointsFields,
} from "../../../lib/mindvideoPoints";
import { sanitizeQuotaRow } from "../_lib/quotaSanitize";
import { readStoredCredential } from "../../../lib/chatgptSession";
import { readStoredClaudeCredential, serializeClaudeCredential } from "../../../lib/claudeSession";
import {
  isUsageStale,
  QUOTA_TIME_ZONE,
  toQuotaFields,
  USAGE_FRESH_WINDOW_MS,
} from "../../../lib/codexUsage";
import { CLAUDE_USAGE_FRESH_WINDOW_MS, toClaudeQuotaFields } from "../../../lib/claudeUsage";
import {
  findLitmediaAccount,
  LITMEDIA_FRESH_WINDOW_MS,
  resolveLitmediaKey,
  toLitmediaPointsFields,
} from "../../../lib/litmediaPoints";

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

function outcomeFor(row, status, extra = {}) {
  return { quotaId: row.$id, account: row.account || "", status, ...extra };
}

/**
 * 即使數字沒變也照寫，讓 $updatedAt 成為可信的「最後一次嘗試」時間。
 * 「最後一次量到用量」是另一回事，記在 usageSyncedAt——這裡也會寫別的東西
 * （換新的 accessToken、點數），那些不代表比例有更新過。
 */
async function writeRow(databases, databaseId, collectionId, row, data, updatedRows, extra = {}) {
  try {
    const updated = await databases.updateDocument({
      databaseId,
      collectionId,
      documentId: row.$id,
      data,
    });
    updatedRows.push(updated);
    return outcomeFor(row, "updated", { ...data, ...extra });
  } catch (err) {
    return outcomeFor(row, "error", {
      error: err instanceof Error ? err.message : "寫回額度失敗",
    });
  }
}

/**
 * LitMedia 的點數來自每日簽到 workflow 的結果，不是即時查詢，
 * 所以連同「那次簽到的時刻」一起寫回；畫面要標的是這個時間，不是寫入時間。
 */
async function refreshLitmediaRow(databases, databaseId, collectionId, row, snapshot, updatedRows) {
  const key = resolveLitmediaKey(row);
  const entry = findLitmediaAccount(snapshot.report, key);
  if (!entry) {
    return outcomeFor(row, "skipped", { reason: "litmedia-account-not-found", litmediaAccount: key });
  }

  const fields = toLitmediaPointsFields(entry, snapshot.report);
  // 這次沒讀到點數就別動——留著舊數字，好過覆蓋成 0
  if (!fields) return outcomeFor(row, "skipped", { reason: "no-points", label: entry.label });

  return writeRow(
    databases,
    databaseId,
    collectionId,
    row,
    { quotaPoints: fields.quotaPoints, pointsSyncedAt: fields.pointsSyncedAt },
    updatedRows,
    { pointsSource: snapshot.source }
  );
}

/**
 * MindVideo/GPT Image 2 跟 LitMedia 一樣，點數來自每日簽到 workflow 的結果（見 lib/mindvideoPoints.ts），
 * 所以流程照抄 refreshLitmediaRow：對不上帳號、沒讀到點數、或報告比已存資料舊，都不覆蓋原數字。
 */
async function refreshMindvideoRow(databases, databaseId, collectionId, row, snapshot, updatedRows) {
  const key = String(row.account || "").trim();
  const entry = findMindvideoAccount(snapshot.report, key);
  if (!entry) {
    return outcomeFor(row, "skipped", { reason: "mindvideo-account-not-found", account: key });
  }

  const fields = toMindvideoPointsFields(entry, snapshot.report);
  if (!fields) return outcomeFor(row, "skipped", { reason: "no-points", label: entry.label });

  // 33 個帳號共用同一份報告；報告比已存資料舊就別動，免得用舊數字蓋掉新數字
  if (row.pointsSyncedAt && Date.parse(fields.pointsSyncedAt) < Date.parse(row.pointsSyncedAt)) {
    return outcomeFor(row, "skipped", { reason: "older-report" });
  }

  return writeRow(
    databases,
    databaseId,
    collectionId,
    row,
    { quotaPoints: fields.quotaPoints, pointsSyncedAt: fields.pointsSyncedAt },
    updatedRows,
    { pointsSource: snapshot.source }
  );
}

/**
 * 用量欄位的量測時刻。$updatedAt 是寫入時間，換 token、同步點數、手動存檔都會動到它，
 * 拿它當「這組比例是什麼時候量到的」會把舊數字說成剛更新的（見 usageSyncedAt 欄位註解）。
 * 欄位還沒補上去的資料表就跳過這個鍵，免得整筆寫回被 Appwrite 擋下來。
 */
function withUsageSyncedAt(data, snapshot, supported) {
  if (!supported) return data;
  return { ...data, usageSyncedAt: snapshot.fetchedAt };
}

async function refreshCodexRow(databases, databaseId, collectionId, row, updatedRows, supportsUsageSyncedAt) {
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
  // 重置機會沒有手動維護的必要，但一樣別在 API 沒回報時洗成 0
  if (outcome.snapshot.resetCredits !== null) {
    data.resetCreditsBalance = fields.resetCreditsBalance;
    data.resetCreditsExpiry = fields.resetCreditsExpiry;
  }

  return writeRow(
    databases,
    databaseId,
    collectionId,
    row,
    withUsageSyncedAt(data, outcome.snapshot, supportsUsageSyncedAt),
    updatedRows
  );
}

/**
 * Claude 跟 Codex 一樣是即時查詢，差別是 access token 只活 ~60 分鐘、
 * 但配了 refresh token 可以自動換新——換到新的就把整組憑證寫回 accessToken 欄位，
 * 不然下次 refresh token 已經輪替過、舊的那顆會直接失敗。
 */
async function refreshClaudeRow(databases, databaseId, collectionId, row, updatedRows, supportsUsageSyncedAt) {
  const credential = readStoredClaudeCredential(row.accessToken);
  if (!credential) {
    return { quotaId: row.$id, account: row.account || "", status: "skipped", reason: "bad-token" };
  }

  let outcome;
  try {
    outcome = await loadClaudeSnapshot(credential);
  } catch (err) {
    return {
      quotaId: row.$id,
      account: row.account || "",
      status: "error",
      error: err instanceof Error ? err.message : "查詢用量失敗",
    };
  }

  if (!outcome.ok) {
    // 就算這次查詢失敗，只要有換到新 access token 還是要寫回去，不然它就白換了
    if (outcome.rotatedCredential) {
      await writeRow(
        databases,
        databaseId,
        collectionId,
        row,
        { accessToken: serializeClaudeCredential(outcome.rotatedCredential) },
        updatedRows
      );
    }
    return {
      quotaId: row.$id,
      account: row.account || "",
      status: "error",
      error: outcome.error,
      tokenExpiry: outcome.tokenExpiry,
    };
  }

  const fields = toClaudeQuotaFields(outcome.snapshot, QUOTA_TIME_ZONE);
  // 這次回應沒有的視窗一律不動：寫 0 會被畫面讀成「已達使用上限」，
  // 一個查不到週視窗的帳號不該長得像額度用光了
  const data = {};
  if (fields.ratio5h !== null) {
    data.ratio5h = fields.ratio5h;
    data.expiry5h = fields.expiry5h;
  }
  if (fields.ratioWeek !== null) {
    data.ratioWeek = fields.ratioWeek;
    data.expiryWeek = fields.expiryWeek;
  }
  if (outcome.rotatedCredential) {
    data.accessToken = serializeClaudeCredential(outcome.rotatedCredential);
  }
  // 一個視窗都沒解析出來就不算量到用量：新換的 token 該寫還是要寫（不然它就白換了），
  // 但別蓋上量測時刻，也別讓這一輪看起來像成功
  if (fields.ratio5h === null && fields.ratioWeek === null) {
    if (outcome.rotatedCredential) {
      await writeRow(databases, databaseId, collectionId, row, data, updatedRows);
    }
    return outcomeFor(row, "error", {
      error: "用量回應裡沒有可用的視窗（非公開 API 可能已變動）",
    });
  }

  return writeRow(
    databases,
    databaseId,
    collectionId,
    row,
    withUsageSyncedAt(data, outcome.snapshot, supportsUsageSyncedAt),
    updatedRows
  );
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
  // usageSyncedAt 是後來才加的欄位；資料表還沒補上就照舊只寫比例，不要整筆寫回被擋下
  const supportsUsageSyncedAt = (collection.attributes || []).some(
    (attribute) =>
      attribute.key === "usageSyncedAt" && (!attribute.status || attribute.status === "available")
  );
  const wanted = options.quotaIds?.length ? new Set(options.quotaIds) : null;
  const maxAgeMs = Number.isFinite(options.maxAgeMs)
    ? Math.max(0, options.maxAgeMs)
    : USAGE_FRESH_WINDOW_MS;
  const now = Date.now();

  // LitMedia 的數字本來就是幾小時前簽到時量到的，保鮮期不必跟 ChatGPT 一樣短
  const litmediaMaxAgeMs = Number.isFinite(options.maxAgeMs)
    ? Math.max(0, options.maxAgeMs)
    : LITMEDIA_FRESH_WINDOW_MS;
  // MindVideo/GPT Image 2 跟 LitMedia 同一套來源、同一個保鮮期理由
  const mindvideoMaxAgeMs = Number.isFinite(options.maxAgeMs)
    ? Math.max(0, options.maxAgeMs)
    : MINDVIDEO_FRESH_WINDOW_MS;
  // Claude 官方端點對頻繁查詢很敏感，保鮮期比 Codex 長一點
  const claudeMaxAgeMs = Number.isFinite(options.maxAgeMs)
    ? Math.max(0, options.maxAgeMs)
    : CLAUDE_USAGE_FRESH_WINDOW_MS;

  const targets = [];
  const results = [];
  for (const row of rows) {
    if (wanted && !wanted.has(row.$id)) continue;

    const isMindvideo = isMindvideoImageService(row.name);
    // 兩種 AI 憑證共用同一個 accessToken 欄位，先試 Claude 的 JSON/sk-ant- 格式，
    // 對不上再當作 ChatGPT（JWT 或 session.json）——順序不能反過來，
    // 否則 Claude 的 JSON 憑證會被 ChatGPT 那邊誤判成壞掉的 session.json。
    const isClaude = !isMindvideo && row.serviceType === "ai" && Boolean(readStoredClaudeCredential(row.accessToken));
    const isCodex = !isMindvideo && !isClaude && row.serviceType === "ai" && Boolean(row.accessToken);
    const isLitmedia = !isMindvideo && !isClaude && !isCodex && Boolean(resolveLitmediaKey(row));
    if (!isClaude && !isCodex && !isLitmedia && !isMindvideo) {
      if (row.serviceType === "ai") {
        results.push({ quotaId: row.$id, account: row.account || "", status: "skipped", reason: "no-token" });
      }
      continue;
    }

    // 保鮮期要看「上次量到用量的時刻」。$updatedAt 連換 token、手動存檔都算進去，
    // 拿它當基準會讓一筆從沒同步成功的資料看起來很新鮮，然後永遠輪不到它更新。
    // 還沒有 usageSyncedAt 的舊資料（或欄位還沒補上）退回 $updatedAt，維持原本的節奏。
    const measuredAt =
      isClaude || isCodex ? row.usageSyncedAt || row.$updatedAt : row.$updatedAt;
    const freshWindow = isClaude
      ? claudeMaxAgeMs
      : isCodex
        ? maxAgeMs
        : isMindvideo
          ? mindvideoMaxAgeMs
          : litmediaMaxAgeMs;
    if (!options.force && !isUsageStale(measuredAt, now, freshWindow)) {
      results.push({ quotaId: row.$id, account: row.account || "", status: "fresh", usageSyncedAt: measuredAt || null });
      continue;
    }
    targets.push({
      row,
      kind: isMindvideo ? "mindvideo" : isClaude ? "claude" : isCodex ? "codex" : "litmedia",
    });
  }

  // 33 個帳號共用同一份簽到結果，所以只跟 GitHub 要一次
  let litmedia = null;
  let litmediaError = null;
  if (targets.some((target) => target.kind === "litmedia")) {
    try {
      litmedia = await loadLitmediaReport({ force: options.force === true, now });
    } catch (err) {
      litmediaError = err instanceof Error ? err.message : "讀取 LitMedia 簽到結果失敗";
    }
  }

  let mindvideo = null;
  let mindvideoError = null;
  if (targets.some((target) => target.kind === "mindvideo")) {
    try {
      mindvideo = await loadMindvideoReport({ force: options.force === true, now });
    } catch (err) {
      mindvideoError = err instanceof Error ? err.message : "讀取 MindVideo 點數失敗";
    }
  }

  const updatedRows = [];
  let cursor = 0;
  const worker = async () => {
    while (cursor < targets.length) {
      const { row, kind } = targets[cursor];
      cursor += 1;

      if (kind === "mindvideo") {
        results.push(
          mindvideo
            ? await refreshMindvideoRow(databases, databaseId, collection.$id, row, mindvideo, updatedRows)
            : { quotaId: row.$id, account: row.account || "", status: "error", error: mindvideoError }
        );
        continue;
      }

      if (kind === "litmedia") {
        results.push(
          litmedia
            ? await refreshLitmediaRow(databases, databaseId, collection.$id, row, litmedia, updatedRows)
            : { quotaId: row.$id, account: row.account || "", status: "error", error: litmediaError }
        );
        continue;
      }

      if (kind === "claude") {
        results.push(
          await refreshClaudeRow(
            databases,
            databaseId,
            collection.$id,
            row,
            updatedRows,
            supportsUsageSyncedAt
          )
        );
        continue;
      }

      results.push(
        await refreshCodexRow(
          databases,
          databaseId,
          collection.$id,
          row,
          updatedRows,
          supportsUsageSyncedAt
        )
      );
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
