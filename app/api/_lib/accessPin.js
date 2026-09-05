import {
  ensureNotificationSettingsCollection,
  readSettingsDocument,
} from "./notificationSettingsTable";
import {
  hashNotificationPassword,
  verifyNotificationPassword,
} from "../../../lib/notifications/passwordHash";

/**
 * 全站共用的四位數密碼。
 *
 * 目前用於「顯示鋒兄額度的 accessToken 明文」與「用已存的 token 帶入用量」，
 * 之後任何需要四位數解鎖的功能都共用這一組。
 *
 * 比照 Resend 通知密碼：**沒有預設值**，第一次使用時由使用者在鋒兄設定自行建立，
 * 以 scrypt hash 存在 notificationsettings 表（documentId "pin"），
 * 不寫死在程式碼、也不放環境變數。
 */

export const ACCESS_PIN_DOCUMENT_ID = "pin";
export const ACCESS_PIN_LENGTH = 4;

export const ACCESS_PIN_NOT_SET_MESSAGE =
  "尚未設定四位數密碼。請到「鋒兄設定」→「四位數密碼」建立後再試。";

export function isAccessPinFormatValid(pin) {
  return typeof pin === "string" && new RegExp(`^\\d{${ACCESS_PIN_LENGTH}}$`).test(pin);
}

async function loadPinContext(databases, databaseId) {
  const collectionId = await ensureNotificationSettingsCollection(databases, databaseId);
  const doc = await readSettingsDocument(
    databases,
    databaseId,
    collectionId,
    ACCESS_PIN_DOCUMENT_ID
  );
  return { collectionId, doc, storedHash: doc?.passwordHash || "" };
}

export async function readAccessPinState(databases, databaseId) {
  const { storedHash } = await loadPinContext(databases, databaseId);
  return { hasPin: Boolean(storedHash) };
}

/**
 * 驗證四位數密碼。
 * @returns {Promise<{ ok: boolean, reason?: "not_set" | "wrong" }>}
 */
export async function verifyAccessPin(databases, databaseId, pin) {
  const { storedHash } = await loadPinContext(databases, databaseId);
  if (!storedHash) return { ok: false, reason: "not_set" };
  if (!isAccessPinFormatValid(pin)) return { ok: false, reason: "wrong" };
  return verifyNotificationPassword(pin, storedHash)
    ? { ok: true }
    : { ok: false, reason: "wrong" };
}

/**
 * 設定或更換密碼。首次設定只需 newPin；之後必須帶對舊的 pin。
 * @returns {Promise<{ ok: boolean, error?: string, status?: number }>}
 */
export async function setAccessPin(databases, databaseId, { pin, newPin }) {
  if (!isAccessPinFormatValid(newPin)) {
    return { ok: false, error: "密碼必須是四位數字。", status: 400 };
  }

  const { collectionId, doc, storedHash } = await loadPinContext(databases, databaseId);

  if (storedHash && !verifyNotificationPassword(String(pin || ""), storedHash)) {
    return { ok: false, error: "原本的四位數密碼不正確，無法變更。", status: 401 };
  }

  const data = { passwordHash: hashNotificationPassword(newPin) };
  if (doc) {
    await databases.updateDocument({
      databaseId,
      collectionId,
      documentId: ACCESS_PIN_DOCUMENT_ID,
      data,
    });
  } else {
    await databases.createDocument({
      databaseId,
      collectionId,
      documentId: ACCESS_PIN_DOCUMENT_ID,
      data,
    });
  }

  return { ok: true };
}
