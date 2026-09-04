"use client";

import { useCallback, useMemo, useState } from "react";
import {
  isAllVisibleSelected,
  nextSelectAllState,
  setManySelected,
  toggleSelectedId,
} from "@/lib/bulkSelection";

export function useBulkSelection(visibleIds: readonly string[]) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const isAllSelected = useMemo(
    () => isAllVisibleSelected(selectedIds, visibleIds),
    [selectedIds, visibleIds],
  );

  const selectAll = useCallback(() => {
    const next = nextSelectAllState(selectionMode, selectedIds, visibleIds);
    setSelectionMode(next.selectionMode);
    setSelectedIds(next.selectedIds);
  }, [selectionMode, selectedIds, visibleIds]);

  const toggle = useCallback((id: string) => {
    if (!id) return;
    setSelectedIds((current) => toggleSelectedId(current, id));
    setSelectionMode(true);
  }, []);

  const toggleMany = useCallback((ids: readonly string[], selected: boolean) => {
    setSelectedIds((current) => setManySelected(current, ids, selected));
    if (selected) setSelectionMode(true);
  }, []);

  const clear = useCallback(() => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, []);

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  return {
    selectionMode,
    selectedIds,
    selectedCount: selectedIds.size,
    isAllSelected,
    selectAll,
    toggle,
    toggleMany,
    clear,
    isSelected,
  };
}
