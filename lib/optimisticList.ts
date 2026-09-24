/**
 * Optimistic UI 清單工具：寫入前先改畫面，伺服器回應後再校正，失敗則回滾。
 *
 * 同一筆連續快速修改時，用 WriteTracker 記住「最新一次寫入」，
 * 較早那次的回應或失敗不會蓋掉較新的樂觀狀態。
 */

export type WithId = { $id: string };

/** 把 patch 合併進指定項目；回傳新清單與原本版本（供失敗時回滾）。 */
export function patchItem<T extends WithId>(
  list: T[],
  id: string,
  patch: Partial<T>,
): { list: T[]; previous?: T } {
  const index = list.findIndex((item) => item.$id === id);
  if (index === -1) return { list };
  const previous = list[index];
  const next = list.slice();
  next[index] = { ...previous, ...patch, $id: id } as T;
  return { list: next, previous };
}

/** 以 id 取代項目；清單中已不存在（例如期間被刪除）就不動。 */
export function replaceItem<T extends WithId>(list: T[], id: string, item: T | undefined): T[] {
  if (!item) return list;
  const index = list.findIndex((candidate) => candidate.$id === id);
  if (index === -1) return list;
  const next = list.slice();
  next[index] = item;
  return next;
}

/** 樂觀移除：回傳被移除的項目與原位置，失敗時可放回原處。 */
export function removeItem<T extends WithId>(list: T[], id: string): { list: T[]; removed?: T; index: number } {
  const index = list.findIndex((item) => item.$id === id);
  if (index === -1) return { list, index };
  const next = list.slice();
  const [removed] = next.splice(index, 1);
  return { list: next, removed, index };
}

/** 刪除失敗時放回原位置；若清單中已存在同 id（例如被重新載入）就不重複插入。 */
export function restoreItem<T extends WithId>(list: T[], removed: T | undefined, index: number): T[] {
  if (!removed || list.some((item) => item.$id === removed.$id)) return list;
  const next = list.slice();
  next.splice(Math.min(Math.max(index, 0), next.length), 0, removed);
  return next;
}

/** 新增或取代同 id 項目（伺服器回傳新資料時使用，避免重複）。 */
export function upsertItem<T extends WithId>(list: T[], item: T): T[] {
  const index = list.findIndex((candidate) => candidate.$id === item.$id);
  if (index === -1) return [...list, item];
  const next = list.slice();
  next[index] = item;
  return next;
}

export type WriteTracker = {
  /** 開始一次寫入，回傳這次的序號。 */
  begin(id: string): number;
  /** 這次寫入是否仍是該 id 最新的一次；只有最新的回應才能改畫面。 */
  isLatest(id: string, token: number): boolean;
  /** 寫入結束；最新那次結束後清掉紀錄。 */
  finish(id: string, token: number): void;
};

export function createWriteTracker(): WriteTracker {
  const latest = new Map<string, number>();
  let sequence = 0;
  return {
    begin(id) {
      const token = ++sequence;
      latest.set(id, token);
      return token;
    },
    isLatest(id, token) {
      return latest.get(id) === token;
    },
    finish(id, token) {
      if (latest.get(id) === token) latest.delete(id);
    },
  };
}
