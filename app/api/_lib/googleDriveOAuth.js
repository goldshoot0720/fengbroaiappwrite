/**
 * Server-side Google Drive OAuth for the daily CSV backup cron.
 *
 * The browser flow (lib/googleDrive.ts) gets a short-lived token from a popup,
 * which a cron job cannot open. Here a refresh token, granted once through
 * /api/google-drive/authorize, is traded for an access token on every run.
 * The client secret and refresh token stay in server-only env vars — never in
 * Appwrite, whose API key the browser can read.
 */
import { createAppwrite } from "./appwriteClient";
import { ensureNotificationSettingsCollection, readSettingsDocument } from "./notificationSettingsTable";
import { GOOGLE_DRIVE_SETTINGS_DOCUMENT_ID } from "../../../lib/notifications/notificationSettings";

export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

/**
 * The refresh token only works with the client that granted it, and drive.file
 * only shows folders that same client created, so this must resolve to the
 * client ID the browser uses: env first, then the one saved in 鋒兄設定.
 */
export async function resolveGoogleClientId() {
  const fromEnv = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (fromEnv) return fromEnv.trim();
  try {
    const { databases, databaseId } = createAppwrite(null);
    const collectionId = await ensureNotificationSettingsCollection(databases, databaseId);
    const doc = await readSettingsDocument(databases, databaseId, collectionId, GOOGLE_DRIVE_SETTINGS_DOCUMENT_ID);
    return String(doc?.googleClientId || "").trim();
  } catch {
    return "";
  }
}

export function getGoogleClientSecret() {
  return (process.env.GOOGLE_CLIENT_SECRET || "").trim();
}

export function getDriveRefreshToken() {
  return (process.env.GOOGLE_DRIVE_REFRESH_TOKEN || "").trim();
}

export function driveCallbackUrl(origin) {
  return `${origin}/api/google-drive/callback`;
}

async function tokenRequest(params) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error_description || data?.error || `Google token 請求失敗（HTTP ${response.status}）`);
  }
  return data;
}

/** Trades the stored refresh token for a fresh access token. */
export async function getDriveAccessToken() {
  const clientId = await resolveGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  const refreshToken = getDriveRefreshToken();
  const missing = [
    !clientId && "Google Client ID",
    !clientSecret && "GOOGLE_CLIENT_SECRET",
    !refreshToken && "GOOGLE_DRIVE_REFRESH_TOKEN",
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(`尚未設定 ${missing.join("、")}，無法排程上傳到 Google 雲端硬碟。`);
  }
  const data = await tokenRequest({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  return data.access_token;
}

/** Exchanges the authorization code from the consent screen. */
export async function exchangeAuthorizationCode(code, redirectUri) {
  const clientId = await resolveGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error("尚未設定 Google Client ID 或 GOOGLE_CLIENT_SECRET。");
  }
  return tokenRequest({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
}
