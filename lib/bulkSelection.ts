/** Toggle 全選：未進入選取 → 全選可見項目；已全選 → 退出；部分選取 → 補齊全選。 */
export function nextSelectAllState(
  selectionMode: boolean,
  selectedIds: ReadonlySet<string>,
  visibleIds: readonly string[],
): { selectionMode: boolean; selectedIds: Set<string> } {
  const visible = visibleIds.filter(Boolean);
  const allSelected = visible.length > 0 && visible.every((id) => selectedIds.has(id));
  if (!selectionMode) {
    return { selectionMode: true, selectedIds: new Set(visible) };
  }
  if (allSelected) {
    return { selectionMode: false, selectedIds: new Set() };
  }
  return { selectionMode: true, selectedIds: new Set(visible) };
}

export function toggleSelectedId(selectedIds: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selectedIds);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function setManySelected(
  selectedIds: ReadonlySet<string>,
  ids: readonly string[],
  selected: boolean,
): Set<string> {
  const next = new Set(selectedIds);
  for (const id of ids) {
    if (!id) continue;
    if (selected) next.add(id);
    else next.delete(id);
  }
  return next;
}

export function isAllVisibleSelected(
  selectedIds: ReadonlySet<string>,
  visibleIds: readonly string[],
): boolean {
  return visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
}

export async function deleteByIds(
  ids: readonly string[],
  deleteOne: (id: string) => Promise<unknown>,
  onProgress?: (done: number) => void,
): Promise<{ failCount: number }> {
  let done = 0;
  let failCount = 0;
  await Promise.all(
    ids.map(async (id) => {
      try {
        await deleteOne(id);
      } catch {
        failCount += 1;
      } finally {
        done += 1;
        onProgress?.(done);
      }
    }),
  );
  return { failCount };
}
