"use client";

import { useCallback, useEffect, useState } from "react";

const MAX_RECENT_SEARCHES = 37;
const NO_LEGACY_STORAGE_KEYS: readonly string[] = [];

/**
 * Hook to manage recent searches using localStorage.
 * Each module gets its own isolated storage key.
 *
 * @param storageKey – unique key per module (e.g. "food", "music").
 *                     The actual localStorage key is `recentSearches_${storageKey}`.
 */
export function useRecentSearches(storageKey: string, legacyStorageKeys = NO_LEGACY_STORAGE_KEYS) {
  const fullKey = `recentSearches_${storageKey}`;

  const [items, setItems] = useState<string[]>([]);

  // Hydrate from localStorage on mount (runs only client-side)
  useEffect(() => {
    try {
      const parseItems = (raw: string | null) => {
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed)
          ? (parsed as unknown[]).filter((v): v is string => typeof v === "string")
          : [];
      };
      const currentItems = parseItems(window.localStorage.getItem(fullKey));
      const legacyItems = legacyStorageKeys.flatMap((key) => parseItems(window.localStorage.getItem(key)));
      const mergedItems = [...currentItems, ...legacyItems.filter((item) => !currentItems.includes(item))]
        .slice(0, MAX_RECENT_SEARCHES);

      setItems(mergedItems);

      if (legacyItems.length > 0) {
        window.localStorage.setItem(fullKey, JSON.stringify(mergedItems));
        legacyStorageKeys.forEach((key) => window.localStorage.removeItem(key));
      }
    } catch {
      // corrupted – ignore
    }
  }, [fullKey, legacyStorageKeys]);

  // Persist whenever items change (skip initial mount with empty array guard)
  const persist = useCallback(
    (next: string[]) => {
      try {
        window.localStorage.setItem(fullKey, JSON.stringify(next));
      } catch {
        // storage full – silently ignore
      }
    },
    [fullKey],
  );

  /**
   * Add a search term to the top of the list.
   * Duplicates are moved to the top instead of inserted twice.
   * Empty / whitespace-only strings are ignored.
   */
  const addSearch = useCallback(
    (term: string) => {
      const trimmed = term.trim();
      if (!trimmed) return;

      setItems((prev) => {
        const next = [trimmed, ...prev.filter((t) => t !== trimmed)].slice(
          0,
          MAX_RECENT_SEARCHES,
        );
        persist(next);
        return next;
      });
    },
    [persist],
  );

  /** Remove a single entry by value. */
  const removeSearch = useCallback(
    (term: string) => {
      setItems((prev) => {
        const next = prev.filter((t) => t !== term);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  /** Clear every entry. */
  const clearAll = useCallback(() => {
    setItems([]);
    persist([]);
  }, [persist]);

  return { items, addSearch, removeSearch, clearAll } as const;
}
