"use client";

import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SelectionCheckbox({
  checked,
  onChange,
  label,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      aria-label={label}
      className={cn("size-4 shrink-0 cursor-pointer rounded border-input accent-destructive", className)}
    />
  );
}

export function BulkSelectionControls({
  selectionMode,
  isAllSelected,
  selectedCount,
  visibleCount,
  disabled,
  onSelectAll,
  onClear,
  onDeleteSelected,
}: {
  selectionMode: boolean;
  isAllSelected: boolean;
  selectedCount: number;
  visibleCount: number;
  disabled?: boolean;
  onSelectAll: () => void;
  onClear: () => void;
  onDeleteSelected: () => void;
}) {
  if (!selectionMode) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={onSelectAll}
        disabled={disabled || visibleCount === 0}
        title="全選刪除"
      >
        <Trash2 />
        全選刪除
      </Button>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={onSelectAll}
        disabled={disabled}
        className="border-destructive/40 text-destructive hover:bg-destructive/10"
      >
        {isAllSelected ? <><X />取消全選</> : <><Trash2 />全選</>}
      </Button>
      <Button type="button" variant="outline" onClick={onClear} disabled={disabled}>
        <X />
        取消選取
      </Button>
      {selectedCount > 0 ? (
        <Button type="button" variant="destructive" onClick={onDeleteSelected} disabled={disabled}>
          <Trash2 />
          刪除選取 ({selectedCount})
        </Button>
      ) : null}
    </>
  );
}
