import { NextResponse } from "next/server";
import { createAppwrite } from "../_lib/appwriteClient";
import {
  ensureNotificationSettingsCollection,
  readSettingsDocument,
} from "../_lib/notificationSettingsTable";
import {
  NOTIFICATION_SETTINGS_DOCUMENT_ID,
  NOTIFICATION_SETTINGS_MAX_SLOTS,
} from "../../../lib/notifications/notificationSettings";
import {
  hashNotificationPassword,
  verifyNotificationPassword,
} from "../../../lib/notifications/passwordHash";

export const dynamic = "force-dynamic";


const DOC_ID = NOTIFICATION_SETTINGS_DOCUMENT_ID;

function json(data, status = 200) {
  return NextResponse.json(data, { status });
}

function failure(error) {
  console.error("notification-settings error:", error);
  const message = error instanceof Error ? error.message : "操作失敗";
  return json({ error: message }, 500);
}

const readDocument = (databases, databaseId, collectionId) =>
  readSettingsDocument(databases, databaseId, collectionId, DOC_ID);

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
    const collectionId = await ensureNotificationSettingsCollection(databases, databaseId);
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
    const collectionId = await ensureNotificationSettingsCollection(databases, databaseId);
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
    const collectionId = await ensureNotificationSettingsCollection(databases, databaseId);
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
    if (slots.some((slot) => /[^\x21-\x7E]/.test(slot.apiKey))) {
      return json({ error: "API Key 含遮蔽符號或無效字元，請重新解鎖載入金鑰；若已儲存遮蔽值，請重新貼上完整 Resend API Key。" }, 400);
    }
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

    // Password was verified (or initialized) above. The unlocked form applies
    // these returned slots, so masking here would replace its usable keys.
    return json({ success: true, ...toPublicPayload({ ...doc, ...data }, true) });
  } catch (error) {
    return failure(error);
  }
}
