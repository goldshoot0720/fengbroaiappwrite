"use client";

import { useCallback, useRef, useState } from "react";
import { Clock, Search, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useRecentSearches } from "@/hooks/useRecentSearches";

interface RecentSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** A stable key that keeps search history separate for each module. */
  storageKey: string;
  legacyStorageKeys?: readonly string[];
  className?: string;
}

/**
 * The canonical module search control: submit, clear, and recent-search history.
 * Keep it shared so every management view behaves like 鋒兄訂閱.
 */
export function RecentSearchInput({
  value,
  onChange,
  placeholder,
  storageKey,
  legacyStorageKeys,
  className,
}: RecentSearchInputProps) {
  const { items, addSearch, removeSearch, clearAll } = useRecentSearches(storageKey, legacyStorageKeys);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = useCallback(() => {
    const query = value.trim();
    if (query) addSearch(query);
    setIsOpen(false);
  }, [addSearch, value]);

  const clear = useCallback(() => {
    onChange("");
    setIsOpen(false);
    inputRef.current?.focus();
  }, [onChange]);

  const pick = useCallback((term: string) => {
    onChange(term);
    addSearch(term);
    setIsOpen(false);
    inputRef.current?.focus();
  }, [addSearch, onChange]);

  const handleBlur = useCallback((event: React.FocusEvent) => {
    if (wrapperRef.current?.contains(event.relatedTarget as Node | null)) return;
    setIsOpen(false);
  }, []);

  return (
    <div ref={wrapperRef} className={`relative ${className ?? ""}`} onBlur={handleBlur}>
      <div className="relative flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            ref={inputRef}
            type="search"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onFocus={() => setIsOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
              if (event.key === "Escape") setIsOpen(false);
            }}
            placeholder={placeholder}
            className="h-11 rounded-xl border-slate-200 bg-white pl-10 pr-10 dark:border-slate-700 dark:bg-slate-950"
          />
          {value ? (
            <button
              type="button"
              onClick={clear}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="清除搜尋內容"
              title="清除搜尋內容"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={submit}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60 dark:border-slate-700 dark:bg-sky-500 dark:hover:bg-sky-400"
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">搜尋</span>
        </button>
      </div>

      {isOpen && items.length > 0 ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[var(--z-popover)] max-h-[420px] overflow-y-auto rounded-2xl border border-[var(--line-soft)] bg-[color:var(--panel-strong)] shadow-xl backdrop-blur-lg">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-4 py-2.5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400">
              <Clock className="h-3.5 w-3.5" />
              最近搜尋
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-400">{items.length}</span>
            </div>
            <button type="button" onClick={clearAll} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30 dark:hover:text-rose-400">
              <Trash2 className="h-3 w-3" />
              清除全部
            </button>
          </div>
          <div className="py-1">
            {items.map((term) => (
              <div key={term} className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <Search className="h-3.5 w-3.5 shrink-0 text-slate-300 dark:text-slate-600" />
                <button type="button" onClick={() => pick(term)} className="min-w-0 flex-1 truncate text-left text-sm text-slate-700 dark:text-slate-200">{term}</button>
                <button type="button" onClick={() => removeSearch(term)} aria-label={`移除最近搜尋 ${term}`} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-300 opacity-0 transition-all hover:bg-rose-100 hover:text-rose-500 focus-visible:opacity-100 group-hover:opacity-100 dark:text-slate-600 dark:hover:bg-rose-900/40 dark:hover:text-rose-400">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
