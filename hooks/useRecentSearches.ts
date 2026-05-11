"use client";

import { useCallback, useEffect, useState } from "react";

const MAX_RECENT_SEARCHES = 37;

/**
 * Hook to manage recent searches using localStorage.
 * Each module gets its own isolated storage key.
 *
 * @param storageKey – unique key per module (e.g. "food", "music").
 *                     The actual localStorage key is `recentSearches_${storageKey}`.
 */
export function useRecentSearches(storageKey: string) {
  const fullKey = `recentSearches_${storageKey}`;

  const [items, setItems] = useState<string[]>([]);

  // Hydrate from localStorage on mount (runs only client-side)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(fullKey);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setItems(
            (parsed as unknown[])
              .filter((v): v is string => typeof v === "string")
              .slice(0, MAX_RECENT_SEARCHES),
          );
        }
      }
    } catch {
      // corrupted – ignore
    }
  }, [fullKey]);

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
