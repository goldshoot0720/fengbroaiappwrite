/**
 * 指數每日記錄的 Appwrite Table（financedaily）。
 *
 * 一天一筆文件，documentId 用 YYYYMMDD，內容是當天所有指數的 52 週高低（JSON）。
 * 一天一筆而不是一檔一筆，是因為一次只會查「今天」和「上一次」，文件數也少一個量級。
 *
 * 這張表跟 notificationsettings 一樣是 private collection，只有 server API key 能存取。
 */
import { clearCollectionCache, getCollection, sdk } from "./appwriteClient";

export const FINANCE_DAILY_COLLECTION = "financedaily";

/** itemsJson 約 16 檔 × 90 字元，15000 足夠放 100 檔以上。 */
export const FINANCE_DAILY_SCHEMA = {
  name: FINANCE_DAILY_COLLECTION,
  attributes: [
    { key: "dateKey", size: 10, required: false },
    { key: "itemsJson", size: 15000, required: false },
  ],
};

/** 台北日期字串（YYYY-MM-DD）→ 文件 id（YYYYMMDD）。 */
export function documentIdForDate(dateKey) {
  return String(dateKey || "").replace(/-/g, "");
}

/** 建立缺少的 collection / 欄位，重試不刪資料。 */
export async function ensureFinanceDailyCollection(databases, databaseId) {
  const existing = await getCollection(databases, databaseId, FINANCE_DAILY_COLLECTION, {
    required: false,
  });
  let collectionId = existing?.$id;

  if (!collectionId) {
    const created = await databases.createCollection(
      databaseId,
      sdk.ID.unique(),
      FINANCE_DAILY_COLLECTION
    );
    clearCollectionCache(databaseId);
    collectionId = created.$id;
  }

  const attrs = await databases.listAttributes(databaseId, collectionId);
  const existingKeys = new Set(attrs.attributes.map((attr) => attr.key));
  for (const attr of FINANCE_DAILY_SCHEMA.attributes) {
    if (existingKeys.has(attr.key)) continue;
    try {
      await databases.createStringAttribute(
        databaseId,
        collectionId,
        attr.key,
        attr.size,
        attr.required
      );
    } catch (err) {
      if (err?.code !== 409) throw err;
    }
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const latest = await databases.getCollection({ databaseId, collectionId });
    const pending = FINANCE_DAILY_SCHEMA.attributes.filter(
      (expected) =>
        !latest.attributes.some(
          (actual) =>
            actual.key === expected.key && (actual.status === "available" || !actual.status)
        )
    );
    if (pending.length === 0) {
      clearCollectionCache(databaseId);
      return collectionId;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("financedaily attributes are not ready yet. Please try again shortly.");
}

/** 文件 → { dateKey, items }；壞掉的 JSON 一律當作沒有記錄。 */
export function parseSnapshot(doc) {
  if (!doc) return null;
  const dateKey = String(doc.dateKey || "");
  if (!dateKey) return null;
  try {
    const items = JSON.parse(doc.itemsJson || "[]");
    if (!Array.isArray(items)) return null;
    return { dateKey, items };
  } catch {
    return null;
  }
}

/** 取最近幾天的快照，新的在前。 */
export async function readRecentSnapshots(databases, databaseId, collectionId, limit = 3) {
  const result = await databases.listDocuments({
    databaseId,
    collectionId,
    queries: [sdk.Query.orderDesc("dateKey"), sdk.Query.limit(limit)],
  });
  return result.documents.map(parseSnapshot).filter(Boolean);
}

/** 寫入（或覆蓋）某一天的快照。 */
export async function writeSnapshot(databases, databaseId, collectionId, snapshot) {
  const documentId = documentIdForDate(snapshot.dateKey);
  const data = {
    dateKey: snapshot.dateKey,
    itemsJson: JSON.stringify(snapshot.items),
  };
  try {
    await databases.updateDocument({ databaseId, collectionId, documentId, data });
  } catch (error) {
    if (error?.code !== 404) throw error;
    await databases.createDocument({ databaseId, collectionId, documentId, data });
  }
}
