/**
 * 記住「每個上層選單分類，各自最後一次點進去的子選單」。
 *
 * 跟 app/page.tsx 的 fengbro:last-module 不是同一件事：那個記的是整個網站
 * 最後停在哪一頁，重新整理才用得到；這裡記的是「鋒兄管理」「鋒兄工具」等
 * 分類各自的最後一個子選單，讓切換分類分頁時（不重新整理）也能回到上次那頁，
 * 而不是每次都跳回分類裡的第一個子選單。
 */

const STORAGE_KEY = "fengbro:last-submenu";

type SubmenuMap = Record<string, string>;

function readMap(): SubmenuMap {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as SubmenuMap) : {};
  } catch {
    return {};
  }
}

/** 記下「這個分類最後點的子選單是 leafId」。 */
export function rememberLastSubmenu(groupId: string, leafId: string): void {
  try {
    const map = readMap();
    map[groupId] = leafId;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage 不可用時（例如隱私模式），僅本次瀏覽期間有效，忽略即可。
  }
}

/** 取這個分類上次點的子選單；沒記過就回傳 undefined。 */
export function getLastSubmenu(groupId: string): string | undefined {
  const value = readMap()[groupId];
  return typeof value === "string" && value ? value : undefined;
}
