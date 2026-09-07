"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, CloudUpload, Loader2, Lock } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { fetchApi } from "@/hooks/useApi";
import { API_ENDPOINTS } from "@/lib/constants";
import { BACKUP_FOLDER_LABEL, setGoogleApiKey, setGoogleClientId } from "@/lib/googleDrive";

type SettingsState = {
  hasPin: boolean;
  configured: boolean;
  clientIdMasked: string;
  apiKeyMasked: string;
};

type UnlockedSecrets = { clientId: string; apiKey: string };

interface GoogleDriveConnectionSettingsProps {
  /** Lets the parent re-check whether the Drive buttons can be used. */
  onCredentialsChange?: (credentials: UnlockedSecrets) => void;
}

/**
 * Google Drive 連接設定。
 *
 * The Client ID and API Key live in Appwrite rather than only in this browser,
 * so a second device does not have to be set up by hand — but reading or
 * changing them costs the site-wide four-digit PIN, the same one that guards
 * 鋒兄額度's access tokens. Unlocking also mirrors the pair into localStorage,
 * because the Drive helpers read them synchronously when a button is pressed.
 *
 * Collapsed by default: this is a once-per-install panel sitting inside a page
 * people open to run backups.
 */
export function GoogleDriveConnectionSettings({
  onCredentialsChange,
}: GoogleDriveConnectionSettingsProps) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<SettingsState | null>(null);
  const [loading, setLoading] = useState(false);
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [clientId, setClientId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState<"unlock" | "save" | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const loadState = useCallback(async () => {
    setLoading(true);
    try {
      setState(await fetchApi<SettingsState>(API_ENDPOINTS.GOOGLE_DRIVE_SETTINGS));
    } catch (error) {
      setState(null);
      setStatus(error instanceof Error ? error.message : "讀取設定失敗");
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Only ask the server once the panel is actually opened.
  useEffect(() => {
    if (open && !state && !loading) void loadState();
  }, [open, state, loading, loadState]);

  const applyLocally = (secrets: UnlockedSecrets) => {
    setGoogleClientId(secrets.clientId);
    setGoogleApiKey(secrets.apiKey);
    onCredentialsChange?.(secrets);
  };

  const handleUnlock = async () => {
    if (!/^\d{4}$/.test(pin)) {
      setStatus("請輸入四位數密碼");
      setFailed(true);
      return;
    }
    setBusy("unlock");
    setStatus(null);
    setFailed(false);
    try {
      const secrets = await fetchApi<UnlockedSecrets>(API_ENDPOINTS.GOOGLE_DRIVE_SETTINGS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      setClientId(secrets.clientId);
      setApiKey(secrets.apiKey);
      setUnlocked(true);
      applyLocally(secrets);
      setStatus(
        secrets.clientId || secrets.apiKey
          ? "已解鎖，並同步到這台裝置。"
          : "已解鎖，Appwrite 上還沒有存過任何值。"
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "解鎖失敗");
      setFailed(true);
    } finally {
      setBusy(null);
    }
  };

  const handleSave = async () => {
    if (!/^\d{4}$/.test(pin)) {
      setStatus("請輸入四位數密碼");
      setFailed(true);
      return;
    }
    setBusy("save");
    setStatus(null);
    setFailed(false);
    try {
      const saved = await fetchApi<{ clientId: string; apiKey: string; configured: boolean }>(
        API_ENDPOINTS.GOOGLE_DRIVE_SETTINGS,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin, clientId, apiKey }),
        }
      );
      applyLocally({ clientId: saved.clientId, apiKey: saved.apiKey });
      setStatus("已儲存到 Appwrite，並同步到這台裝置。");
      await loadState();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "儲存失敗");
      setFailed(true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/40">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 p-4 text-left"
      >
        <CloudUpload size={16} className="shrink-0 text-sky-700 dark:text-sky-300" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-sky-900 dark:text-sky-100">
            Google 雲端硬碟連接設定
          </span>
          <span className="mt-0.5 block text-xs text-sky-700 dark:text-sky-300">
            Client ID 與 API Key 存在 Appwrite，讀取或修改需要四位數密碼
          </span>
        </span>
        {open ? (
          <ChevronDown size={18} className="shrink-0 text-sky-600 dark:text-sky-400" />
        ) : (
          <ChevronRight size={18} className="shrink-0 text-sky-600 dark:text-sky-400" />
        )}
      </button>

      {open ? (
        <div className="border-t border-sky-200 px-4 pb-4 pt-3 dark:border-sky-800">
          <p className="text-xs text-sky-700 dark:text-sky-300">
            需先在 Google Cloud Console 建立 OAuth 用戶端 ID（網頁應用程式）與 API 金鑰，並啟用 Google Drive
            API，將目前網域加入「已授權的 JavaScript 來源」。設定完成後，「匯出到雲端硬碟」會把備份放進
            {` ${BACKUP_FOLDER_LABEL} `}
            資料夾。
          </p>

          {loading ? (
            <p className="mt-3 flex items-center gap-2 text-xs text-sky-700 dark:text-sky-300">
              <Loader2 size={14} className="animate-spin" /> 讀取設定中…
            </p>
          ) : null}

          {state && !state.hasPin ? (
            <p className="mt-3 rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
              還沒建立全站共用的四位數密碼。請先到「鋒兄設定」→「四位數密碼」建立，才能讀取或儲存這裡的欄位。
            </p>
          ) : null}

          {state ? (
            <dl className="mt-3 space-y-1 text-xs text-sky-800 dark:text-sky-200">
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-sky-600 dark:text-sky-400">Appwrite 狀態</dt>
                <dd>{state.configured ? "已儲存 Client ID 與 API Key" : "尚未儲存"}</dd>
              </div>
              {state.configured ? (
                <>
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-sky-600 dark:text-sky-400">Client ID</dt>
                    <dd className="break-all font-mono">{state.clientIdMasked}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-sky-600 dark:text-sky-400">API Key</dt>
                    <dd className="break-all font-mono">{state.apiKeyMasked}</dd>
                  </div>
                </>
              ) : null}
            </dl>
          ) : null}

          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="space-y-1">
              <span className="block text-xs text-sky-700 dark:text-sky-300">四位數密碼</span>
              <Input
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                placeholder="••••"
                aria-label="四位數密碼"
                className="w-28 text-center font-mono tracking-[0.4em]"
              />
            </label>
            <Button
              type="button"
              variant="outline"
              onClick={handleUnlock}
              disabled={busy !== null || (state ? !state.hasPin : false)}
            >
              {busy === "unlock" ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
              解鎖並載入
            </Button>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="block text-xs text-sky-700 dark:text-sky-300">Google Client ID</span>
              <Input
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
                placeholder={unlocked ? "xxxxx.apps.googleusercontent.com" : "解鎖後才能編輯"}
                disabled={!unlocked}
                className="font-mono text-xs"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-sky-700 dark:text-sky-300">Google API Key</span>
              <Input
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={unlocked ? "AIza…" : "解鎖後才能編輯"}
                disabled={!unlocked}
                className="font-mono text-xs"
              />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="button" onClick={handleSave} disabled={!unlocked || busy !== null}>
              {busy === "save" ? <Loader2 size={16} className="animate-spin" /> : null}
              儲存至 Appwrite
            </Button>
            {status ? (
              <span
                className={
                  failed
                    ? "text-xs text-destructive"
                    : "text-xs text-sky-700 dark:text-sky-300"
                }
              >
                {status}
              </span>
            ) : null}
          </div>

          <p className="mt-3 text-[11px] text-sky-600 dark:text-sky-400">
            授權只要求 drive.file 範圍，只能存取本 App 建立或你透過選取視窗開啟的檔案，不會讀取雲端硬碟其他資料。
            解鎖後這兩個值也會存到這台裝置的瀏覽器，換裝置時再解鎖一次即可。
          </p>
        </div>
      ) : null}
    </div>
  );
}
