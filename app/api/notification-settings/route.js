import { NextResponse } from "next/server";
import {
  clearCollectionCache,
  createAppwrite,
  getCollection,
  sdk,
} from "../_lib/appwriteClient";
import {
  NOTIFICATION_SETTINGS_COLLECTION,
  NOTIFICATION_SETTINGS_DOCUMENT_ID,
  NOTIFICATION_SETTINGS_SCHEMA,
  NOTIFICATION_SETTINGS_MAX_SLOTS,
} from "../../../lib/notifications/notificationSettings";
import {
  hashNotificationPassword,
  verifyNotificationPassword,
} from "../../../lib/notifications/passwordHash";

export const dynamic = "force-dynamic";

const COLLECTION_NAME = NOTIFICATION_SETTINGS_COLLECTION;
const DOC_ID = NOTIFICATION_SETTINGS_DOCUMENT_ID;

/**
 * 建立 notificationsettings Table（private collection，僅 server API key 可存取），
 * 並等待屬性可用。重試不刪資料。
 */
async function ensureCollection(databases, databaseId) {
  const existing = await getCollection(databases, databaseId, COLLECTION_NAME, {
    required: false,
  });
  let collectionId = existing?.$id;

  if (!collectionId) {
    const created = await databases.createCollection(databaseId, sdk.ID.unique(), COLLECTION_NAME);
    clearCollectionCache(databaseId);
    collectionId = created.$id;
  }

  const attrs = await databases.listAttributes(databaseId, collectionId);
  const existingKeys = new Set(attrs.attributes.map((attr) => attr.key));
  for (const attr of NOTIFICATION_SETTINGS_SCHEMA.attributes) {
    if (existingKeys.has(attr.key)) continue;
    try {
      await databases.createStringAttribute(databaseId, collectionId, attr.key, attr.size, attr.required);
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
          (actual) => actual.key === expected.key && (actual.status === "available" || !actual.status)
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

function json(data, status = 200) {
  return NextResponse.json(data, { status });
}

function failure(error) {
  console.error("notification-settings error:", error);
  const message = error instanceof Error ? error.message : "操作失敗";
  return json({ error: message }, 500);
}

async function readDocument(databases, databaseId, collectionId) {
  try {
    const doc = await databases.getDocument({ databaseId, collectionId, documentId: DOC_ID });
    return doc;
  } catch {
    return null;
  }
}

function parseSlots(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (slot) =>
          slot && typeof slot === "object" &&
          typeof slot.apiKey === "string" &&
          typeof slot.toEmail === "string"
      )
      .slice(0, NOTIFICATION_SETTINGS_MAX_SLOTS);
  } catch {
    return [];
  }
}

/** 對外回傳形狀：apiKey 一律遮蔽，除非 includeSecretKeys */
function toPublicPayload(doc, includeSecretKeys = false) {
  const slots = parseSlots(doc?.slotsJson);
  return {
    hasPassword: Boolean(doc?.passwordHash),
    fromEmail: doc?.fromEmail || "",
    slots: slots.map((slot) => ({
      apiKey: includeSecretKeys ? slot.apiKey : maskSecret(slot.apiKey),
      toEmail: slot.toEmail,
    })),
  };
}

function maskSecret(value) {
  if (!value) return "";
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 3)}••••••••${value.slice(-4)}`;
}

// GET /api/notification-settings — 讀取設定（key 遮蔽）
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, databaseId } = createAppwrite(searchParams);
    const collectionId = await ensureCollection(databases, databaseId);
    const doc = await readDocument(databases, databaseId, collectionId);
    return json(toPublicPayload(doc));
  } catch (error) {
    return failure(error);
  }
}

// POST /api/notification-settings/verify — 驗證密碼，成功才回傳完整設定（含明文 key）
export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const { databases, databaseId } = createAppwrite(searchParams, body);
    const collectionId = await ensureCollection(databases, databaseId);
    const doc = await readDocument(databases, databaseId, collectionId);

    const password = String(body.password || "");
    const storedHash = doc?.passwordHash || "";

    if (!storedHash) {
      return json(
        { error: "尚未設定通知密碼，請先在設定頁建立密碼。" },
        400
      );
    }
    if (!verifyNotificationPassword(password, storedHash)) {
      return json({ error: "通知密碼不正確" }, 401);
    }

    return json(toPublicPayload(doc, true));
  } catch (error) {
    return failure(error);
  }
}

// PUT /api/notification-settings — 儲存設定（首次可一併設定密碼；之後需驗證原密碼）
export async function PUT(request) {
  try {
    const { searchParams } = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const { databases, databaseId } = createAppwrite(searchParams, body);
    const collectionId = await ensureCollection(databases, databaseId);
    const doc = await readDocument(databases, databaseId, collectionId);

    const storedHash = doc?.passwordHash || "";
    const password = String(body.password || "");
    const newPassword = String(body.newPassword || "");

    // 尚未建立密碼：必須帶 newPassword 初始化（不允許無密碼保護直接存 key）
    if (!storedHash) {
      if (newPassword.length < 4) {
        return json({ error: "首次使用請設定至少 4 碼的通知密碼（之後顯示或變更 API Key 都需要）。" }, 400);
      }
    } else {
      if (!verifyNotificationPassword(password, storedHash)) {
        return json({ error: "通知密碼不正確，無法儲存。" }, 401);
      }
    }

    const fromEmail = String(body.fromEmail || "").trim();
    const rawSlots = Array.isArray(body.slots) ? body.slots : [];
    const slots = rawSlots
      .map((slot) => ({
        apiKey: String(slot?.apiKey || "").trim(),
        toEmail: String(slot?.toEmail || "").trim(),
      }))
      .filter((slot) => slot.apiKey && slot.toEmail)
      .slice(0, NOTIFICATION_SETTINGS_MAX_SLOTS);

    const data = {
      fromEmail,
      slotsJson: JSON.stringify(slots),
    };
    if (storedHash) {
      // 已有密碼時可一併更換密碼（需驗證過原密碼）
      if (newPassword) {
        if (newPassword.length < 4) {
          return json({ error: "新密碼至少 4 碼。" }, 400);
        }
        data.passwordHash = hashNotificationPassword(newPassword);
      }
    } else {
      data.passwordHash = hashNotificationPassword(newPassword);
    }

    if (doc) {
      await databases.updateDocument({ databaseId, collectionId, documentId: DOC_ID, data });
    } else {
      await databases.createDocument({
        databaseId,
        collectionId,
        documentId: DOC_ID,
        data,
      });
    }

    return json({ success: true, ...toPublicPayload({ ...doc, ...data }) });
  } catch (error) {
    return failure(error);
  }
}
