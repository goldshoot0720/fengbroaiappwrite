import { NextResponse } from "next/server";
import { createAppwrite } from "../_lib/appwriteClient";
import {
  ensureNotificationSettingsCollection,
  readSettingsDocument,
} from "../_lib/notificationSettingsTable";
import {
  ACCESS_PIN_NOT_SET_MESSAGE,
  readAccessPinState,
  verifyAccessPin,
} from "../_lib/accessPin";
import { GOOGLE_DRIVE_SETTINGS_DOCUMENT_ID } from "../../../lib/notifications/notificationSettings";

export const dynamic = "force-dynamic";

const DOC_ID = GOOGLE_DRIVE_SETTINGS_DOCUMENT_ID;

function json(data, status = 200) {
  return NextResponse.json(data, { status });
}

function failure(error) {
  console.error("google-drive-settings error:", error);
  const message = error instanceof Error ? error.message : "操作失敗";
  return json({ error: message }, 500);
}

/**
 * A Google web client ID ends in a fixed suffix and a browser API key starts
 * with "AIza"; masking the middle keeps the value recognisable at a glance
 * without putting the whole string on screen.
 */
function mask(value) {
  if (!value) return "";
  if (value.length <= 10) return "••••••••";
  return `${value.slice(0, 6)}••••••••${value.slice(-6)}`;
}

/**
 * createAppwrite() also mines the request body for Appwrite config, and its
 * alias list includes bare `apiKey` / `key`. This body carries Google
 * credentials, so hand the resolver a copy with those stripped — otherwise the
 * Google API key would be used as the Appwrite key and every write would come
 * back "not authorized".
 */
const APPWRITE_CONFIG_KEYS = [
  "endpoint",
  "_endpoint",
  "projectId",
  "project",
  "_project",
  "databaseId",
  "database",
  "_database",
  "bucketId",
  "bucket",
  "_bucket",
];

function appwriteConfigFrom(body) {
  if (!body || typeof body !== "object") return {};
  const config = {};
  for (const key of APPWRITE_CONFIG_KEYS) {
    if (body[key] != null && body[key] !== "") config[key] = body[key];
  }
  return config;
}

async function load(searchParams, body) {
  const { databases, databaseId } = createAppwrite(searchParams, appwriteConfigFrom(body));
  const collectionId = await ensureNotificationSettingsCollection(databases, databaseId);
  const doc = await readSettingsDocument(databases, databaseId, collectionId, DOC_ID);
  return { databases, databaseId, collectionId, doc };
}

function pinFailure(reason) {
  return reason === "not_set"
    ? json({ error: ACCESS_PIN_NOT_SET_MESSAGE, pinNotSet: true }, 428)
    : json({ error: "四位數密碼錯誤" }, 403);
}

// GET /api/google-drive-settings — 只回報有沒有設定過與遮蔽後的值，不需要密碼
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { databases, databaseId, doc } = await load(searchParams);
    const { hasPin } = await readAccessPinState(databases, databaseId);
    const clientId = doc?.googleClientId || "";
    const apiKey = doc?.googleApiKey || "";
    return json({
      hasPin,
      configured: Boolean(clientId && apiKey),
      clientIdMasked: mask(clientId),
      apiKeyMasked: mask(apiKey),
    });
  } catch (error) {
    return failure(error);
  }
}

/**
 * POST /api/google-drive-settings — 驗證四位數密碼後回傳明文。
 * 用 POST 是為了讓 PIN 走 body，不落在 URL 或伺服器存取紀錄。
 */
export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const { databases, databaseId, doc } = await load(searchParams, body);

    const pinCheck = await verifyAccessPin(databases, databaseId, body?.pin);
    if (!pinCheck.ok) return pinFailure(pinCheck.reason);

    return json({
      googleClientId: doc?.googleClientId || "",
      googleApiKey: doc?.googleApiKey || "",
    });
  } catch (error) {
    return failure(error);
  }
}

// PUT /api/google-drive-settings — 驗證四位數密碼後儲存
export async function PUT(request) {
  try {
    const { searchParams } = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const { databases, databaseId, collectionId, doc } = await load(searchParams, body);

    const pinCheck = await verifyAccessPin(databases, databaseId, body?.pin);
    if (!pinCheck.ok) return pinFailure(pinCheck.reason);

    const clientId = String(body?.googleClientId || "").trim();
    const apiKey = String(body?.googleApiKey || "").trim();

    // The masked form is what GET hands out; saving it back would overwrite the
    // real value with bullets, so refuse instead of silently destroying it.
    if (/[•]/.test(clientId) || /[•]/.test(apiKey)) {
      return json({ error: "欄位仍是遮蔽值，請先解鎖載入原始內容再儲存。" }, 400);
    }
    if (clientId.length > 300 || apiKey.length > 300) {
      return json({ error: "Client ID 或 API Key 過長（上限 300 字元）。" }, 400);
    }

    const data = { googleClientId: clientId, googleApiKey: apiKey };
    if (doc) {
      await databases.updateDocument({ databaseId, collectionId, documentId: DOC_ID, data });
    } else {
      await databases.createDocument({ databaseId, collectionId, documentId: DOC_ID, data });
    }

    return json({
      success: true,
      configured: Boolean(clientId && apiKey),
      googleClientId: clientId,
      googleApiKey: apiKey,
      clientIdMasked: mask(clientId),
      apiKeyMasked: mask(apiKey),
    });
  } catch (error) {
    return failure(error);
  }
}
