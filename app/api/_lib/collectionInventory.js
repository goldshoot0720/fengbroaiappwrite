import { userAttributes } from "../../../lib/collectionStats.js";

/**
 * Delete every collection with this name, including ones past Appwrite's
 * default 25-row page. A stuck column can reject the first delete; drop the
 * columns and try once more before reporting failure.
 * A failed delete must stop the create. Continuing used to leave another
 * empty sitevisit behind the one the console still shows with no columns.
 */
export function createBlockedByCleanup(cleanup) {
  const failures = cleanup?.failures || [];
  if (failures.length === 0) return null;
  const detail = failures
    .map((item) => `${item.id || "unknown"}：${item.message || "刪除失敗"}`)
    .join("；");
  return `還有 ${failures.length} 個同名表刪不掉，已停止建立，避免再多一張空表。${detail}`;
}

export async function discardCollection(databases, databaseId, collection) {
  try {
    await deleteOne(databases, databaseId, collection);
    return null;
  } catch (err) {
    return err?.message || String(err);
  }
}

export async function deleteNamedCollections(databases, databaseId, tableName, options = {}) {
  const collections = Array.isArray(options.collections)
    ? options.collections
    : await collectionsForDelete(databases, databaseId, tableName);
  const matches = collections.filter((col) => col?.name === tableName);
  const failures = [];
  let removed = 0;

  for (const col of matches) {
    try {
      await deleteOne(databases, databaseId, col);
      removed += 1;
    } catch (err) {
      failures.push({ id: col.$id, message: err?.message || String(err) });
    }
  }

  return { removed, failures, matched: matches.length };
}

async function collectionsForDelete(databases, databaseId, tableName) {
  const client = await import("./appwriteClient.js");
  try {
    const named = await client.listCollectionsNamed(databases, databaseId, [tableName]);
    if (named.length > 0) return named;
  } catch {
    // The name filter can be rejected by an older SDK. The full list is the fallback.
  }
  try {
    const tables = await client.listTablesNamed(databases, databaseId, [tableName]);
    if (tables.length > 0) return tables;
  } catch {
    // TablesDB is unavailable on this SDK. The collections list is the fallback.
  }
  return client.listEveryCollection(databases, databaseId);
}

/**
 * 新版 Appwrite 把 database 標成 TablesDB 之後，舊的 collections API 只能「建」不能「刪」：
 *
 *   Database 'xxx' is a TablesDB database, so the deprecated collections API cannot
 *   delete its tables. Use DELETE /v1/tablesdb/{database}/tables/{table} instead.
 *
 * 沒處理的話，任何「重建」都會卡在刪不掉同名表 —— 2026-10-30 建 cron 表就是這樣失敗的。
 */
function isTablesDbOnlyDatabase(error) {
  const message = String(error?.message || "");
  return /TablesDB database/i.test(message) && /collections API/i.test(message);
}

function clientCredentials(databases) {
  const attached = databases?.$credentials || {};
  const config = databases?.client?.config || {};
  return {
    endpoint: attached.endpoint || config.endpoint || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT,
    projectId: attached.projectId || config.project || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID,
    apiKey: attached.apiKey || config.key || process.env.NEXT_PUBLIC_APPWRITE_API_KEY,
  };
}

/** 走 TablesDB REST 刪表；404 視為已經刪掉。 */
async function deleteTableViaTablesDb(databases, databaseId, tableId) {
  const { endpoint, projectId, apiKey } = clientCredentials(databases);
  if (!endpoint || !projectId || !apiKey) {
    throw new Error("缺少 Appwrite 連線設定，無法用 TablesDB 刪表");
  }
  const response = await fetch(`${endpoint}/tablesdb/${databaseId}/tables/${tableId}`, {
    method: "DELETE",
    headers: {
      "X-Appwrite-Project": projectId,
      "X-Appwrite-Key": apiKey,
      "X-Appwrite-Response-Format": "1.7.0",
    },
    cache: "no-store",
  });
  if (response.ok || response.status === 404) return;
  const body = await response.text().catch(() => "");
  throw new Error(`TablesDB 刪表失敗（HTTP ${response.status}）${body.slice(0, 200)}`);
}

/**
 * 刪掉一張表：先走舊的 collections API，遇到 TablesDB 專用資料庫再改用 REST 端點。
 * 其他錯誤原樣往上丟，呼叫端才知道要清欄位重試。
 */
export async function deleteTableOrCollection(databases, databaseId, collectionId) {
  try {
    await databases.deleteCollection(databaseId, collectionId);
    return;
  } catch (error) {
    if (!isTablesDbOnlyDatabase(error)) throw error;
  }
  await deleteTableViaTablesDb(databases, databaseId, collectionId);
}

async function deleteOne(databases, databaseId, col) {
  try {
    await deleteTableOrCollection(databases, databaseId, col.$id);
  } catch {
    for (const attr of userAttributes(col)) {
      try {
        await databases.deleteAttribute(databaseId, col.$id, attr.key);
      } catch {
        // The column may already be gone. The collection delete below is the check.
      }
    }
    await deleteTableOrCollection(databases, databaseId, col.$id);
  }
}

/**
 * Attribute creation returns before Appwrite marks the column available.
 * listDocuments throws until then, which the settings page used to treat as
 * "table missing".
 */
export async function waitUntilAttributesReady(databases, databaseId, collectionId, expectedKeys, options = {}) {
  const timeoutMs = options.timeoutMs ?? 20000;
  const intervalMs = options.intervalMs ?? 400;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const started = Date.now();
  const keys = expectedKeys || [];
  let last = null;

  while (true) {
    try {
      last = await databases.getCollection(databaseId, collectionId);
    } catch (err) {
      return { ok: false, collection: last, error: err?.message || "無法讀取新建的 Table" };
    }

    const byKey = new Map(userAttributes(last).map((attr) => [attr.key, attr]));
    const failed = keys.filter((key) => {
      const status = byKey.get(key)?.status;
      return status === "failed" || status === "stuck";
    });
    if (failed.length > 0) {
      return { ok: false, collection: last, error: `欄位建立失敗：${failed.join("、")}` };
    }

    const ready = keys.every((key) => {
      const attr = byKey.get(key);
      if (!attr) return false;
      return !attr.status || attr.status === "available";
    });
    if (ready) return { ok: true, collection: last };
    options.onTick?.({ elapsed: Date.now() - started });

    if (Date.now() - started >= timeoutMs) {
      return { ok: false, collection: last, error: "欄位尚未就緒。請稍後重新整理；若這列仍顯示重建，再按一次。" };
    }
    await sleep(intervalMs);
  }
}
