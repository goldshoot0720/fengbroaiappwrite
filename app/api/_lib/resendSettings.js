import { getCollectionId } from "./appwriteClient";
import { NOTIFICATION_SETTINGS_COLLECTION, NOTIFICATION_SETTINGS_DOCUMENT_ID } from "../../../lib/notifications/notificationSettings";
import { resolveResendConfig } from "../../../lib/notifications/resolveResendConfig.mjs";

export function loadResendConfig(databases, databaseId, options = {}) {
  return resolveResendConfig({
    ...options,
    readSettings: async () => {
      const collectionId = await getCollectionId(databases, databaseId, NOTIFICATION_SETTINGS_COLLECTION, { required: false });
      if (!collectionId) return null;
      try {
        return await databases.getDocument({ databaseId, collectionId, documentId: NOTIFICATION_SETTINGS_DOCUMENT_ID });
      } catch (error) {
        if (error?.code === 404) return null;
        throw new Error("無法讀取 notificationsettings，請檢查伺服器 Appwrite 權限");
      }
    },
  });
}
