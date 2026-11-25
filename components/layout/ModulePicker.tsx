"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { DensityToggleCompact } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";
import type { MenuItem } from "@/types";

function leaves(item: MenuItem): MenuItem[] {
  return item.children?.length ? item.children.flatMap(leaves) : [item];
}

function normalize(value: string) {
  return value.normalize("NFKC").toLowerCase().trim();
}

export default function ModulePicker({
  menuItems, currentModule, onClose, onNavigate,
}: {
  menuItems: MenuItem[];
  currentModule: string;
  onClose: () => void;
  onNavigate: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const startedOnBackdrop = useRef(false);
  const term = normalize(query);
  const groups = menuItems.map((group) => ({
    group,
    items: leaves(group).filter((item) =>
      normalize([group.label, item.label, item.subtitle, item.id].join(" ")).includes(term)
    ),
  })).filter(({ items }) => items.length > 0);
  const count = groups.reduce((sum, { items }) => sum + items.length, 0);

  useLayoutEffect(() => {
    const dialog = dialogRef.current!;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    dialog.showModal();
    // Keep the on-screen keyboard closed when someone opens the menu to browse.
    if (window.matchMedia("(pointer: fine)").matches) searchRef.current?.focus();
    return () => {
      dialog.close();
      root.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <dialog
      id="module-picker"
      ref={dialogRef}
      aria-labelledby="module-picker-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onPointerDown={(event) => { startedOnBackdrop.current = event.target === event.currentTarget; }}
      onClick={(event) => {
        if (startedOnBackdrop.current && event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 text-foreground backdrop:bg-[var(--scrim)] open:flex open:items-end open:justify-center md:open:items-center md:p-5"
    >
      <div className="flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-card shadow-[var(--shadow-dock)] md:max-h-[min(82dvh,44rem)] md:rounded-2xl">
        <div className="shrink-0 border-b border-[var(--line-soft)] px-4 pb-3 pt-3 sm:px-6">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 id="module-picker-title" tabIndex={-1} className="font-display text-xl font-semibold focus:outline-none">
              全部模組
            </h2>
            <div className="flex items-center gap-1">
              <DensityToggleCompact />
              <button type="button" onClick={onClose} aria-label="關閉選單" className="grid size-11 place-items-center rounded-lg text-muted-foreground hover:bg-muted">
                <X size={19} />
              </button>
            </div>
          </div>
          <div className="flex min-h-11 items-center gap-2.5 rounded-lg border border-[var(--line-strong)] bg-background px-3 focus-within:border-[var(--ring)]">
            <Search aria-hidden size={17} className="shrink-0 text-muted-foreground" />
            <input
              ref={searchRef}
              type="search"
              aria-label="搜尋模組"
              placeholder="搜尋模組名稱或分類"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && term && count === 1 &&
                    !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) {
                  event.preventDefault();
                  onNavigate(groups[0].items[0].id);
                }
              }}
              className="min-h-11 min-w-0 flex-1 bg-transparent text-base outline-none focus-visible:outline-none"
            />
          </div>
        </div>

        <p role="status" className="sr-only">{term ? `找到 ${count} 個模組` : ""}</p>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
          {groups.map(({ group, items }) => (
            <section key={group.id} aria-label={group.label} className="mb-3 last:mb-0">
              <h3 className="mb-1 px-2 text-sm font-semibold text-muted-foreground">{group.label}</h3>
              <div className="grid grid-cols-2 gap-x-2 sm:grid-cols-3">
                {items.map((item) => {
                  const active = currentModule === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-current={active ? "page" : undefined}
                      onClick={() => onNavigate(item.id)}
                      className={cn(
                        "flex min-h-11 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-muted",
                        active && "bg-[var(--panel-soft)] font-semibold"
                      )}
                    >
                      <span aria-hidden className="shrink-0 text-[var(--accent-strong)]">{item.icon}</span>
                      <span className="min-w-0">{item.label}</span>
                      {active && <Check aria-hidden size={15} className="ml-auto shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          {count === 0 && (
            <div className="py-5 text-center">
              <p className="text-sm">沒有符合的模組</p>
              <button
                type="button"
                onClick={() => { setQuery(""); searchRef.current?.focus(); }}
                className="min-h-11 rounded-lg px-3 text-sm font-medium text-[var(--accent-strong)] underline underline-offset-4"
              >
                清除搜尋
              </button>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
