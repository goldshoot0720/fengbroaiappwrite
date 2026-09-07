/**
 * Client-side Google Drive integration for 鋒兄設定 一鍵匯出／匯入.
 *
 * Uses Google Identity Services (OAuth token client) + Google Picker, loaded
 * lazily via <script> tags — no extra npm dependency. Requests the narrow
 * `drive.file` scope only: the app can only see files it created itself, or
 * files the user explicitly opened through the Picker built with the same
 * OAuth client. This avoids Google's sensitive-scope verification review.
 */

const GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const GAPI_SCRIPT_SRC = "https://apis.google.com/js/api.js";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
/**
 * Backups live under OAuth/fengbroaiappwrite. Two levels, so the OAuth folder
 * can hold one subfolder per app instead of every app dropping files loose at
 * the Drive root.
 */
const BACKUP_FOLDER_PATH = ["OAuth", "fengbroaiappwrite"] as const;

/** Human-readable form for messages, e.g. "OAuth／fengbroaiappwrite". */
export const BACKUP_FOLDER_LABEL = BACKUP_FOLDER_PATH.join("／");
const CLIENT_ID_STORAGE_KEY = "NEXT_PUBLIC_GOOGLE_CLIENT_ID";
const API_KEY_STORAGE_KEY = "NEXT_PUBLIC_GOOGLE_API_KEY";

type GoogleTokenResponse = { access_token?: string; error?: string };
type GoogleTokenError = { type?: string; message?: string };
type GoogleTokenClient = { requestAccessToken: (options?: { prompt?: string }) => void };
type GoogleAccountsNamespace = {
  oauth2: {
    initTokenClient: (config: {
      client_id: string;
      scope: string;
      callback: (response: GoogleTokenResponse) => void;
      error_callback?: (error: GoogleTokenError) => void;
    }) => GoogleTokenClient;
    revoke?: (token: string, done?: () => void) => void;
  };
};

declare global {
  interface Window {
    google?: {
      accounts?: GoogleAccountsNamespace;
      picker?: unknown;
    };
    gapi?: {
      load: (api: string, options: { callback?: () => void; onerror?: () => void }) => void;
    };
  }
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function getGoogleClientId(envFallback?: string): string {
  const fallback = envFallback ?? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
  if (!isBrowser()) return fallback;
  try {
    return localStorage.getItem(CLIENT_ID_STORAGE_KEY) || fallback || "";
  } catch {
    return fallback;
  }
}

export function getGoogleApiKey(envFallback?: string): string {
  const fallback = envFallback ?? process.env.NEXT_PUBLIC_GOOGLE_API_KEY ?? "";
  if (!isBrowser()) return fallback;
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY) || fallback || "";
  } catch {
    return fallback;
  }
}

export function isGoogleDriveConfigured(): boolean {
  return Boolean(getGoogleClientId() && getGoogleApiKey());
}

export function setGoogleClientId(value: string): void {
  if (!isBrowser()) return;
  try {
    const trimmed = value.trim();
    if (trimmed) localStorage.setItem(CLIENT_ID_STORAGE_KEY, trimmed);
    else localStorage.removeItem(CLIENT_ID_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function setGoogleApiKey(value: string): void {
  if (!isBrowser()) return;
  try {
    const trimmed = value.trim();
    if (trimmed) localStorage.setItem(API_KEY_STORAGE_KEY, trimmed);
    else localStorage.removeItem(API_KEY_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`無法載入 ${src}`));
    document.head.appendChild(script);
  });
}

let gisLoadPromise: Promise<void> | null = null;

/**
 * Fetches the Google Identity Services script ahead of time.
 *
 * Browsers only let a popup open while a click is still "active", and that
 * window does not survive a script download plus a backup being zipped. Call
 * this when the page settles so the token request itself is instant.
 */
export function preloadGoogleIdentityServices(): void {
  if (!isBrowser() || window.google?.accounts?.oauth2) return;
  void loadGoogleIdentityServices().catch(() => {
    // A failed preload is not worth surfacing; the real request will report it.
  });
}

function loadGoogleIdentityServices(): Promise<void> {
  if (!isBrowser()) return Promise.reject(new Error("僅支援瀏覽器環境"));
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!gisLoadPromise) gisLoadPromise = loadScript(GIS_SCRIPT_SRC);
  return gisLoadPromise;
}

let gapiPickerLoadPromise: Promise<void> | null = null;
function loadGooglePicker(): Promise<void> {
  if (!isBrowser()) return Promise.reject(new Error("僅支援瀏覽器環境"));
  if (window.google?.picker) return Promise.resolve();
  if (!gapiPickerLoadPromise) {
    gapiPickerLoadPromise = loadScript(GAPI_SCRIPT_SRC).then(
      () =>
        new Promise<void>((resolve, reject) => {
          window.gapi?.load("picker", {
            callback: () => resolve(),
            onerror: () => reject(new Error("無法載入 Google Picker")),
          });
        })
    );
  }
  return gapiPickerLoadPromise;
}

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

export function isGoogleDriveConnected(): boolean {
  return Boolean(cachedToken && cachedToken.expiresAt > Date.now());
}

export function disconnectGoogleDrive(): void {
  cachedToken = null;
}

/** Requests (or reuses a cached) OAuth access token scoped to drive.file. */
export async function requestGoogleDriveAccessToken(options?: { forcePrompt?: boolean }): Promise<string> {
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error("尚未設定 Google Client ID，請先在鋒兄設定填入 NEXT_PUBLIC_GOOGLE_CLIENT_ID");
  }
  if (!options?.forcePrompt && cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.accessToken;
  }

  await loadGoogleIdentityServices();

  return new Promise((resolve, reject) => {
    try {
      const tokenClient = window.google!.accounts!.oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_SCOPE,
        callback: (response) => {
          if (response.error || !response.access_token) {
            reject(new Error(response.error || "取得 Google 授權失敗"));
            return;
          }
          cachedToken = { accessToken: response.access_token, expiresAt: Date.now() + 55 * 60 * 1000 };
          resolve(response.access_token);
        },
        // Without this, a popup the browser refuses to open never calls back at
        // all and the caller waits forever.
        error_callback: (error) => {
          if (error?.type === "popup_failed_to_open") {
            reject(
              new Error(
                "瀏覽器擋下了 Google 授權視窗。請允許這個網站顯示彈出式視窗後再試一次。"
              )
            );
            return;
          }
          if (error?.type === "popup_closed") {
            reject(new Error("Google 授權視窗被關閉，尚未完成授權。"));
            return;
          }
          reject(new Error(error?.message || "取得 Google 授權失敗"));
        },
      });
      tokenClient.requestAccessToken({ prompt: options?.forcePrompt ? "consent" : "" });
    } catch (error) {
      reject(error instanceof Error ? error : new Error("取得 Google 授權失敗"));
    }
  });
}

/** Finds or creates one folder inside `parentId` ("root" for the Drive root). */
async function ensureFolder(accessToken: string, name: string, parentId: string): Promise<string> {
  // Drive query strings are single-quoted, so a quote in the name would end
  // the literal early; these names have none, but escape anyway.
  const escapedName = name.replace(/'/g, "\\'");
  const query = encodeURIComponent(
    `name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false and '${parentId}' in parents`
  );
  const listRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (listRes.ok) {
    const listData = await listRes.json();
    const existingId = listData?.files?.[0]?.id;
    if (existingId) return existingId;
  }

  const createRes = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  });
  if (!createRes.ok) throw new Error(`建立 Google Drive「${name}」資料夾失敗`);
  const created = await createRes.json();
  return created.id;
}

/**
 * Walks BACKUP_FOLDER_PATH from the Drive root, creating whatever is missing.
 *
 * The drive.file scope only sees folders this app created, so a folder the
 * user made by hand with the same name stays invisible here and a second one
 * gets created — that is the scope working as intended, not a bug to route
 * around by asking for broader access.
 */
async function ensureBackupFolderId(accessToken: string): Promise<string> {
  let parentId = "root";
  for (const name of BACKUP_FOLDER_PATH) {
    parentId = await ensureFolder(accessToken, name, parentId);
  }
  return parentId;
}

/** Uploads a backup blob into a "鋒兄備份" folder in the user's Drive. */
export async function uploadBackupToGoogleDrive(
  blob: Blob,
  filename: string
): Promise<{ id: string; name: string }> {
  const accessToken = await requestGoogleDriveAccessToken();
  const folderId = await ensureBackupFolderId(accessToken);

  const metadata = { name: filename, parents: [folderId] };
  const boundary = `fengbro-${Date.now()}`;
  const metadataPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
  const mediaHeader = `--${boundary}\r\nContent-Type: ${blob.type || "application/zip"}\r\n\r\n`;
  const closing = `\r\n--${boundary}--`;
  const body = new Blob([metadataPart, mediaHeader, blob, closing]);

  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}) as { error?: { message?: string } });
    throw new Error(errorBody?.error?.message || `上傳到 Google 雲端硬碟失敗（HTTP ${response.status}）`);
  }
  return response.json();
}

export type GooglePickedFile = { id: string; name: string };

/** Opens the Google Picker limited to Drive docs; resolves null if cancelled. */
export async function pickBackupFromGoogleDrive(): Promise<GooglePickedFile | null> {
  const apiKey = getGoogleApiKey();
  if (!apiKey) {
    throw new Error("尚未設定 Google API Key，請先在鋒兄設定填入 NEXT_PUBLIC_GOOGLE_API_KEY");
  }
  const accessToken = await requestGoogleDriveAccessToken();
  await loadGooglePicker();

  return new Promise((resolve, reject) => {
    try {
      type PickerView = { setIncludeFolders: (v: boolean) => PickerView; setSelectFolderEnabled: (v: boolean) => PickerView };
      type PickerCallbackData = { action: string; docs?: Array<{ id: string; name: string }> };
      type PickerBuilderInstance = {
        addView: (view: PickerView) => PickerBuilderInstance;
        setOAuthToken: (token: string) => PickerBuilderInstance;
        setDeveloperKey: (key: string) => PickerBuilderInstance;
        setCallback: (cb: (data: PickerCallbackData) => void) => PickerBuilderInstance;
        build: () => { setVisible: (v: boolean) => void };
      };
      const picker = window.google as unknown as {
        picker: {
          DocsView: new (viewId: unknown) => PickerView;
          ViewId: { DOCS: unknown };
          PickerBuilder: new () => PickerBuilderInstance;
          Action: { PICKED: string; CANCEL: string };
        };
      };
      const view = new picker.picker.DocsView(picker.picker.ViewId.DOCS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(false);
      const instance = new picker.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(accessToken)
        .setDeveloperKey(apiKey)
        .setCallback((data) => {
          if (data.action === picker.picker.Action.PICKED) {
            const doc = data.docs?.[0];
            resolve(doc ? { id: doc.id, name: doc.name } : null);
          } else if (data.action === picker.picker.Action.CANCEL) {
            resolve(null);
          }
        })
        .build();
      instance.setVisible(true);
    } catch (error) {
      reject(error instanceof Error ? error : new Error("開啟 Google Picker 失敗"));
    }
  });
}

/** Downloads a Drive file's raw content as a Blob (used after picking). */
export async function downloadBackupFromGoogleDrive(fileId: string): Promise<Blob> {
  const accessToken = await requestGoogleDriveAccessToken();
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`從 Google 雲端硬碟下載失敗（HTTP ${response.status}）`);
  return response.blob();
}
