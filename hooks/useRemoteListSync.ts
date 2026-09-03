"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchApi } from "@/hooks/useApi";
import { APPWRITE_CONFIG_CHANGED_EVENT } from "@/hooks/useAppwriteSetup";
import { getAppwriteConfig } from "@/lib/utils";

export type RemoteListSyncOptions<T> = {
  /** Appwrite 端點（/api/...），讀取與寫入同一 baseUrl */
  endpoint: string;
  /** 本機離線快取讀取器（畫面先行顯示用；回 [] 表示沒有歷史資料） */
  loadLocal: () => T[];
  /** 遠端文件 → 客戶端項目（不含 Appwrite document id） */
  toLocal: (row: unknown) => T | null;
  /** 從遠端文件取出 Appwrite document id（PUT/DELETE 目標） */
  remoteDocId: (row: unknown) => string | undefined;
  /** 客戶端項目 → 寫入 body */
  toBody: (item: T) => Record<string, unknown>;
  /** 穩定本機 key（localStorage / migration / merge 用）；同時作為遠端同名檢查 */
  localId: (item: T) => string;
  /** 內容指紋：內容不變就不重複寫入 */
  signature: (item: T) => string;
  /** 遠端空白時是否把本機舊資料上傳（一次性遷移）；預設 true */
  migrateLocalWhenRemoteEmpty?: boolean;
  /** 是否啟用（false 時不載入也不同步；可傳「目前分頁是否啟用」） */
  enabled?: boolean;
};

export type RemoteListSyncState<T> = {
  items: T[];
  /** 呼叫方式和 setState 相同；會作廢進行中的遠端載入並觸發 debounce 上傳 */
  setItems: React.Dispatch<React.SetStateAction<T[]>>;
  cloudReady: boolean;
  syncState: "idle" | "syncing" | "error";
  /** 每次成功從遠端載入後 +1（供呼叫端偵測「雲端資料已覆蓋本機」） */
  loadVersion: number;
  /** 手動重新讀取遠端 */
  refresh: () => void;
};

/**
 * 單一共享資料表的「雲端為主、本機離線快取」同步 hook。
 *
 * 規則：
 * - 未啟用（enabled=false）→ 不載入也不同步。
 * - Appwrite 未設定 → 只使用本機資料（loadLocal），不上傳。
 * - 首次成功載入：遠端有資料就以遠端覆蓋本機；遠端空白才把本機舊資料遷移上去。
 * - 之後每筆本機變更 debounce 400ms 上傳：新增 POST、既有 PUT、已移除且曾上傳的 DELETE。
 * - 帳號／Appwrite 設定切換時自動重新載入。
 * - 遠端載入失敗（離線／table 未建）→ 保留本機資料與編輯，不阻斷操作。
 */
export function useRemoteListSync<T>(
  options: RemoteListSyncOptions<T>
): RemoteListSyncState<T> {
  const {
    endpoint,
    loadLocal,
    toLocal,
    remoteDocId,
    toBody,
    localId,
    signature,
  } = options;
  const migrateLocalWhenRemoteEmpty = options.migrateLocalWhenRemoteEmpty ?? true;
  const enabled = options.enabled ?? true;

  // 本機快取先行顯示（SSR 安全），雲端載入成功後再覆蓋。
  const [items, setItemsState] = useState<T[]>(() =>
    typeof window === "undefined" ? [] : loadLocal()
  );
  const [cloudReady, setCloudReady] = useState(false);
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "error">("idle");
  const [loadVersion, setLoadVersion] = useState(0);
  const [cloudKey, setCloudKey] = useState("");

  const cloudReadyRef = useRef(false);
  cloudReadyRef.current = cloudReady;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const itemsRef = useRef<T[]>([]);
  itemsRef.current = items;
  const loadRevision = useRef(0);
  /** 首次遠端載入是否已完成（成功或「空→遷移」）；完成後才允許上傳 */
  const loadedRemoteOnce = useRef(false);
  const syncChain = useRef<Promise<void>>(Promise.resolve());
  /** localId → Appwrite document id（已成功寫入遠端） */
  const remoteIdMap = useRef(new Map<string, string>());
  /** localId → signature（上次成功同步的內容） */
  const syncedSignatureMap = useRef(new Map<string, string>());

  const refreshCloud = useCallback(() => {
    const config = getAppwriteConfig();
    const ready = Boolean(
      config.endpoint && config.projectId && config.databaseId && config.apiKey
    );
    setCloudReady(ready);
    setCloudKey(
      ready ? `${config.endpoint}|${config.projectId}|${config.databaseId}|${config.apiKey}` : ""
    );
  }, []);

  useEffect(() => {
    refreshCloud();
    window.addEventListener(APPWRITE_CONFIG_CHANGED_EVENT, refreshCloud);
    window.addEventListener("storage", refreshCloud);
    return () => {
      window.removeEventListener(APPWRITE_CONFIG_CHANGED_EVENT, refreshCloud);
      window.removeEventListener("storage", refreshCloud);
    };
  }, [refreshCloud]);

  const loadRemote = useCallback(() => {
    if (!cloudReadyRef.current || !enabledRef.current) return;
    const revision = ++loadRevision.current;
    void (async () => {
      try {
        const remote = await fetchApi<unknown[]>(endpoint, { cache: "no-store" });
        if (revision !== loadRevision.current) return;
        const rows = Array.isArray(remote) ? remote : [];
        const remoteItems: T[] = [];
        const seen = new Set<string>();
        const nextRemoteIds = new Map<string, string>();
        for (const row of rows) {
          const item = toLocal(row);
          if (!item) continue;
          const key = localId(item);
          if (seen.has(key)) continue;
          seen.add(key);
          remoteItems.push(item);
          const docId = remoteDocId(row);
          if (docId) nextRemoteIds.set(key, docId);
        }

        if (migrateLocalWhenRemoteEmpty && remoteItems.length === 0) {
          // 首次雲端啟用：保留本機資料，由同步引擎上傳。
          const local = loadLocal();
          if (local.length > 0) {
            remoteIdMap.current = new Map();
            syncedSignatureMap.current = new Map();
            loadedRemoteOnce.current = true;
            setItemsState(local);
            setSyncState("idle");
            setLoadVersion((value) => value + 1);
            return;
          }
        }

        const nextSignatures = new Map<string, string>();
        for (const item of remoteItems) {
          nextSignatures.set(localId(item), signature(item));
        }
        remoteIdMap.current = nextRemoteIds;
        syncedSignatureMap.current = nextSignatures;
        loadedRemoteOnce.current = true;
        setItemsState(remoteItems);
        setSyncState("idle");
        setLoadVersion((value) => value + 1);
      } catch (err) {
        if (revision !== loadRevision.current) return;
        // Table 尚未建立或離線：保留本機資料繼續編輯，不阻斷操作。
        setSyncState("error");
        throw err;
      }
    })();
  }, [endpoint, loadLocal, localId, migrateLocalWhenRemoteEmpty, remoteDocId, signature, toLocal]);

  // 啟用或設定就緒時載入遠端；每次從停用切回啟用也重新整理。
  useEffect(() => {
    if (!enabled || !cloudReady || !cloudKey) return;
    loadRemote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudKey, cloudReady, enabled]);

  const syncToRemote = useCallback(
    async (current: T[]) => {
      if (!cloudReadyRef.current || !enabledRef.current) return;
      setSyncState("syncing");
      const nextRemoteIds = new Map(remoteIdMap.current);
      const nextSignatures = new Map(syncedSignatureMap.current);
      try {
        for (const item of current) {
          const key = localId(item);
          const currentSignature = signature(item);
          const remoteId = nextRemoteIds.get(key);
          if (remoteId && nextSignatures.get(key) === currentSignature) continue;

          const body = toBody(item);
          const saved = remoteId
            ? await fetchApi<unknown>(`${endpoint}/${encodeURIComponent(remoteId)}`, {
                method: "PUT",
                body: JSON.stringify(body),
              })
            : await fetchApi<unknown>(endpoint, {
                method: "POST",
                body: JSON.stringify(body),
              });
          const savedRow = saved as { $id?: string; id?: string };
          if (savedRow?.$id || savedRow?.id) {
            nextRemoteIds.set(key, String(savedRow.$id || savedRow.id));
          }
          nextSignatures.set(key, currentSignature);
        }
        // 只刪「這台裝置曾載入、且已從清單移除」的遠端文件。
        for (const [key, remoteId] of remoteIdMap.current) {
          if (remoteId && !current.some((item) => localId(item) === key)) {
            await fetchApi(`${endpoint}/${encodeURIComponent(remoteId)}`, {
              method: "DELETE",
            });
            nextRemoteIds.delete(key);
            nextSignatures.delete(key);
          }
        }
        remoteIdMap.current = nextRemoteIds;
        syncedSignatureMap.current = nextSignatures;
        setSyncState("idle");
      } catch (err) {
        setSyncState("error");
        throw err;
      }
    },
    [endpoint, localId, signature, toBody]
  );

  // 內容變動即同步（無 debounce：本機編輯都是離散操作，避免離開頁面時遺失未上傳變更）。
  useEffect(() => {
    if (!enabled || !cloudReadyRef.current || !loadedRemoteOnce.current) return;
    const current = itemsRef.current;
    syncChain.current = syncChain.current
      .then(() => syncToRemote(current))
      .catch(() => {
        // 單次同步失敗不中斷後續佇列；快照未更新，下次變動會重試。
      });
  }, [enabled, items, syncToRemote]);

  const setItems = useCallback(
    (next: React.SetStateAction<T[]>) => {
      // 使用者在本機編輯時，作廢進行中的遠端載入，避免覆蓋剛輸入的資料。
      loadRevision.current += 1;
      setItemsState(next);
    },
    []
  );

  return { items, setItems, cloudReady, syncState, loadVersion, refresh: loadRemote };
}
