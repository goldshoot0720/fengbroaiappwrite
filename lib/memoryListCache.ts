/**
 * 切換選單時用的記憶體清單快取：模組重新掛載時先直接上畫，不再顯示整頁載入。
 *
 * 只存在這個分頁的 JS 記憶體（不寫 sessionStorage／localStorage），
 * 含帳號、卡號等資料的清單也不會留在瀏覽器儲存空間；重新整理頁面即清空。
 * 以 Appwrite 帳戶（endpoint + project + database）分區，切換帳戶自然不會讀到別人的資料。
 */

type Entry = { scope: string; savedAt: number; data: unknown[] };

const store = new Map<string, Entry>();

/** 超過這個時間回到模組時，先顯示快取再在背景靜默更新。 */
export const MEMORY_LIST_FRESH_MS = 60_000;

function readLocal(key: string): string {
  try {
    return window.localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function accountScope(): string {
  if (typeof window === "undefined") return "ssr";
  return [
    readLocal("NEXT_PUBLIC_APPWRITE_ENDPOINT"),
    readLocal("NEXT_PUBLIC_APPWRITE_PROJECT_ID"),
    readLocal("APPWRITE_DATABASE_ID"),
  ].join("|");
}

/** localStorage 裡的時間戳（refresh key／帳戶切換），不是數字時當作 0。 */
function storedTimestamp(key: string): number {
  if (typeof window === "undefined") return 0;
  const value = Number(readLocal(key));
  return Number.isFinite(value) ? value : 0;
}

export type MemoryListHit<T> = { data: T[]; fresh: boolean };

/**
 * 讀取快取。帳戶不同、帳戶切換過就視為沒有快取；
 * 其他分頁寫入過（refresh key 比快取新）或超過 MEMORY_LIST_FRESH_MS 則標記為不新鮮。
 */
export function readMemoryList<T>(name: string, refreshKey?: string, now: number = Date.now()): MemoryListHit<T> | null {
  if (typeof window === "undefined") return null;
  const entry = store.get(name);
  if (!entry || entry.scope !== accountScope()) return null;
  if (storedTimestamp("appwrite_account_switched") > entry.savedAt) {
    store.delete(name);
    return null;
  }
  const changedElsewhere = refreshKey ? storedTimestamp(refreshKey) > entry.savedAt : false;
  const fresh = !changedElsewhere && now - entry.savedAt < MEMORY_LIST_FRESH_MS;
  return { data: entry.data as T[], fresh };
}

export function writeMemoryList<T>(name: string, data: T[], now: number = Date.now()): void {
  if (typeof window === "undefined") return;
  store.set(name, { scope: accountScope(), savedAt: now, data });
}

export function clearMemoryLists(): void {
  store.clear();
}
