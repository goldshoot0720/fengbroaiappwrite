"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRef } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function BulkDeleteDialog({
  open,
  count,
  noun,
  confirmPhrase,
  busy,
  progress = 0,
  total = 0,
  error,
  confirmInput,
  onConfirmInputChange,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  count: number;
  noun: string;
  confirmPhrase: string;
  busy: boolean;
  progress?: number;
  total?: number;
  error?: string | null;
  confirmInput: string;
  onConfirmInputChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const canConfirm = confirmInput === confirmPhrase && !busy && count > 0;

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next && !busy) onCancel(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[120] bg-foreground/35" />
        <Dialog.Content
          role="alertdialog"
          className="surface-raised fixed left-1/2 top-1/2 z-[121] max-h-[85dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl p-6 outline-none"
          onPointerDownOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            cancelRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
          }}
        >
          <Dialog.Title className="font-display text-xl font-semibold text-foreground">確認批次刪除？</Dialog.Title>
          <Dialog.Description className="mt-3 break-words text-sm leading-7 text-muted-foreground">
            即將刪除 <span className="font-semibold text-destructive">{count}</span> 筆{noun}。此操作無法復原。
          </Dialog.Description>
          {busy ? (
            <div className="mt-4 space-y-2">
              <p className="text-sm text-muted-foreground">
                正在刪除中…{total > 0 ? `（${progress} / ${total} 筆）` : ""}
              </p>
              {total > 0 ? (
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-2.5 rounded-full bg-destructive transition-all"
                    style={{ width: `${Math.min(100, (progress / total) * 100)}%` }}
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              <p className="text-sm text-muted-foreground">請輸入以下文字確認：</p>
              <code className="block rounded-lg bg-muted px-3 py-2 font-mono text-sm text-destructive">{confirmPhrase}</code>
              <Input
                value={confirmInput}
                onChange={(event) => onConfirmInputChange(event.target.value)}
                placeholder={`輸入 ${confirmPhrase}`}
                autoComplete="off"
              />
            </div>
          )}
          {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
          <div className="mt-6 flex justify-end gap-2">
            <Button ref={cancelRef} type="button" variant="outline" disabled={busy} onClick={onCancel}>取消</Button>
            <Button type="button" variant="destructive" disabled={!canConfirm} onClick={onConfirm}>
              {busy ? <RefreshCw className="animate-spin" /> : <Trash2 />}
              {busy ? "刪除中…" : `確認刪除（${count} 筆）`}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
