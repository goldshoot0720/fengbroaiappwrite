"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRef } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ManagementDeleteDialog({ open, recordName, busy, error, onCancel, onConfirm }: {
  open: boolean;
  recordName: string;
  busy: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
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
          <Dialog.Title className="font-display text-xl font-semibold text-foreground">確認刪除這筆紀錄？</Dialog.Title>
          <Dialog.Description className="mt-3 break-words text-sm leading-7 text-muted-foreground">
            將刪除「{recordName}」。此操作無法復原，其他紀錄不受影響。
          </Dialog.Description>
          {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
          <div className="mt-6 flex justify-end gap-2">
            <Button ref={cancelRef} type="button" variant="outline" disabled={busy} onClick={onCancel}>取消</Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={onConfirm}>
              {busy ? <RefreshCw className="animate-spin" /> : <Trash2 />}
              {busy ? "刪除中…" : "確認刪除"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
