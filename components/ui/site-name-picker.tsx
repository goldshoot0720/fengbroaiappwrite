"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";

export function SiteNamePicker({ names, label, onSelect }: {
  names: string[];
  label: string;
  onSelect: (name: string) => void;
}) {
  const [position, setPosition] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [query, setQuery] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const id = useId();
  const filtered = names.filter(name => name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const isOpen = Boolean(position);
  const close = () => { setPosition(null); trigger.current?.focus(); };

  useEffect(() => {
    if (!isOpen) return;
    search.current?.focus({ preventScroll: true });
    const outside = (event: Event) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !trigger.current?.contains(target)) setPosition(null);
    };
    const dismiss = () => setPosition(null);
    const scroll = (event: Event) => {
      if (panel.current?.contains(event.target as Node)) return;
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition(current => current ? { ...current, left: Math.max(12, Math.min(rect.right - current.width, window.innerWidth - current.width - 12)), top: window.innerHeight - rect.bottom - 12 >= current.height ? rect.bottom + 4 : Math.max(12, rect.top - current.height - 4) } : null);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    window.addEventListener("resize", dismiss);
    document.addEventListener("scroll", scroll, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      window.removeEventListener("resize", dismiss);
      document.removeEventListener("scroll", scroll, true);
    };
  }, [isOpen]);

  return <>
    <button ref={trigger} type="button" aria-label={label} aria-haspopup="dialog" aria-expanded={Boolean(position)} aria-controls={position ? id : undefined}
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-input bg-background text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
      onClick={() => {
        if (position) { close(); return; }
        const rect = trigger.current!.getBoundingClientRect();
        const width = Math.min(320, window.innerWidth - 24);
        const below = window.innerHeight - rect.bottom - 12;
        const above = rect.top - 12;
        const height = Math.min(320, Math.max(below, above));
        setQuery("");
        setPosition({ width, height, left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)), top: below >= height ? rect.bottom + 4 : Math.max(12, rect.top - height - 4) });
      }}><ChevronDown size={16} /></button>
    {position && createPortal(<div ref={panel} id={id} role="dialog" aria-label={label}
      className="fixed z-[100] flex flex-col overflow-hidden rounded-xl border border-border bg-popover p-2 text-popover-foreground"
      style={{ top: position.top, left: position.left, width: position.width, maxHeight: position.height }}
      onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          const controls = Array.from(panel.current!.querySelectorAll<HTMLElement>("input, button"));
          const current = controls.indexOf(document.activeElement as HTMLElement);
          controls[(current + (event.key === "ArrowDown" ? 1 : controls.length - 1)) % controls.length]?.focus();
        }
      }}>
      <Input ref={search} value={query} onChange={event => setQuery(event.target.value)} aria-label="搜尋常用網站" placeholder="搜尋常用網站…" className="shrink-0"
        onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); if (filtered[0]) { onSelect(filtered[0]); close(); } } }} />
      <div className="mt-2 min-h-0 overflow-y-auto">
        {filtered.map(name => <button type="button" key={name} className="block min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm break-words hover:bg-accent focus-visible:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
          onClick={() => { onSelect(name); close(); }}>{name}</button>)}
        {filtered.length === 0 && <p role="status" className="px-3 py-4 text-sm text-muted-foreground">找不到符合的網站，可直接在名稱欄輸入。</p>}
      </div>
    </div>, document.body)}
  </>;
}
