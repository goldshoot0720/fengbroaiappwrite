import {
  clearCollectionCache,
  getCollection,
  sdk,
} from "./appwriteClient";
import {
  NOTIFICATION_SETTINGS_COLLECTION,
  NOTIFICATION_SETTINGS_SCHEMA,
} from "../../../lib/notifications/notificationSettings";

/**
 * 建立 notificationsettings Table（private collection，僅 server API key 可存取），
 * 並等待屬性可用。重試不刪資料。
 *
 * 通知設定（documentId "main"）與鋒兄額度密碼（documentId "quota"）共用這張表，
 * 因此抽出來給兩邊的 route 使用。
 */
export async function ensureNotificationSettingsCollection(databases, databaseId) {
  const existing = await getCollection(databases, databaseId, NOTIFICATION_SETTINGS_COLLECTION, {
    required: false,
  });
  let collectionId = existing?.$id;

  if (!collectionId) {
    const created = await databases.createCollection(
      databaseId,
      sdk.ID.unique(),
      NOTIFICATION_SETTINGS_COLLECTION
    );
    clearCollectionCache(databaseId);
    collectionId = created.$id;
  }

  const attrs = await databases.listAttributes(databaseId, collectionId);
  const existingKeys = new Set(attrs.attributes.map((attr) => attr.key));
  for (const attr of NOTIFICATION_SETTINGS_SCHEMA.attributes) {
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

  // Appwrite 屬性建立為非同步，等待全部 available
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const latest = await databases.getCollection({ databaseId, collectionId });
    const pending = NOTIFICATION_SETTINGS_SCHEMA.attributes.filter(
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
  throw new Error("notificationsettings attributes are not ready yet. Please try again shortly.");
}

/** 讀取單一設定文件；不存在回傳 null。 */
export async function readSettingsDocument(databases, databaseId, collectionId, documentId) {
  try {
    return await databases.getDocument({ databaseId, collectionId, documentId });
  } catch {
    return null;
  }
}
