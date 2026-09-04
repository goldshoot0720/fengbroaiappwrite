"use client";

import { useState } from "react";
import {
  Focus,
  Lock,
  Plus,
  RotateCcw,
  Trash2,
  Unlock,
} from "lucide-react";
import { BulkDeleteDialog } from "@/components/ui/bulk-delete-dialog";
import { BulkSelectionControls, SelectionCheckbox } from "@/components/ui/bulk-selection-controls";
import { Button } from "@/components/ui/button";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import {
  DEFAULT_FENGBRO_NEWS_SITES_COUNT,
  type FengbroNewsAdapter,
  type FengbroNewsSiteConfig,
} from "@/lib/fengbroNewsSites";

export const NEWS_ADAPTER_OPTIONS: Array<{
  id: FengbroNewsAdapter;
  label: string;
  hint: string;
}> = [
  { id: "generic-keyword-url", label: "通用來源（自動）", hint: "掃首頁／列表或 {q} 搜尋模板" },
  { id: "youtube-channel", label: "YouTube 頻道", hint: "頻道影片標題關鍵字" },
  { id: "tycg-traffic", label: "桃園交通局", hint: "businessd/post 關鍵字列表" },
  { id: "rb-nreo", label: "鐵道局北工", hint: "NREO 最新消息（reader）" },
  { id: "tycg-zhongli", label: "中壢區公所", hint: "News.aspx 分頁掃標題" },
];

export function newsAdapterLabel(adapter: FengbroNewsAdapter) {
  return NEWS_ADAPTER_OPTIONS.find((a) => a.id === adapter)?.label || adapter;
}

type NewsSitesManagerProps = {
  displaySites: FengbroNewsSiteConfig[];
  lockedCount: number;
  sitesCount: number;
  draftName: string;
  draftHomeUrl: string;
  draftAdapter: FengbroNewsAdapter;
  draftTemplate: string;
  editingId: string | null;
  advancedOpen: boolean;
  formMessage: string;
  onDraftNameChange: (value: string) => void;
  onDraftHomeUrlChange: (value: string) => void;
  onDraftAdapterChange: (value: FengbroNewsAdapter) => void;
  onDraftTemplateChange: (value: string) => void;
  onAdvancedOpenChange: (open: boolean) => void;
  onSaveSite: () => void;
  onClearDraft: () => void;
  onResetSites: () => void;
  onToggleLock: (id: string) => void;
  onEditSite: (site: FengbroNewsSiteConfig) => void;
  onDeleteSite: (id: string) => void;
  onDeleteSites: (ids: string[]) => void;
};

export function NewsSitesManager({
  displaySites,
  lockedCount,
  sitesCount,
  draftName,
  draftHomeUrl,
  draftAdapter,
  draftTemplate,
  editingId,
  advancedOpen,
  formMessage,
  onDraftNameChange,
  onDraftHomeUrlChange,
  onDraftAdapterChange,
  onDraftTemplateChange,
  onAdvancedOpenChange,
  onSaveSite,
  onClearDraft,
  onResetSites,
  onToggleLock,
  onEditSite,
  onDeleteSite,
  onDeleteSites,
}: NewsSitesManagerProps) {
  const siteIds = displaySites.map((site) => site.id);
  const bulk = useBulkSelection(siteIds);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteInput, setBulkDeleteInput] = useState("");

  return (
    <div className="border-b border-sky-50 p-4 sm:p-6">
      <div className="rounded-[28px] border border-sky-100 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h4 className="flex items-center gap-2 font-semibold text-foreground">
              <Focus size={16} className="text-sky-600" />
              新聞來源網站
              <span className="rounded-full border border-sky-100 bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-800">
                共 {sitesCount} 個
              </span>
            </h4>
            <p className="mt-1 text-sm text-muted-foreground">
              可新增任意新聞／公部門網站。鎖定後才會納入標題關鍵字搜尋；設定存在本機瀏覽器。
              目前 {sitesCount} 個來源（鎖定 {lockedCount}），內建預設 {DEFAULT_FENGBRO_NEWS_SITES_COUNT}{" "}
              個。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <BulkSelectionControls
              selectionMode={bulk.selectionMode}
              isAllSelected={bulk.isAllSelected}
              selectedCount={bulk.selectedCount}
              visibleCount={siteIds.length}
              onSelectAll={bulk.selectAll}
              onClear={bulk.clear}
              onDeleteSelected={() => { setBulkDeleteInput(""); setBulkDeleteOpen(true); }}
            />
            <Button type="button" variant="outline" onClick={onResetSites} className="gap-2 rounded-xl">
              <RotateCcw size={16} />
              還原預設（{DEFAULT_FENGBRO_NEWS_SITES_COUNT}）
            </Button>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-dashed border-sky-200 bg-sky-50/40 p-4">
          <p className="text-sm font-medium text-foreground">
            {editingId ? "編輯新聞來源" : "新增新聞來源網站"}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)_auto]">
            <input
              value={draftName}
              onChange={(e) => onDraftNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSaveSite();
              }}
              placeholder="網站名稱（可留空，自動用網域）"
              className="h-11 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            />
            <input
              value={draftHomeUrl}
              onChange={(e) => onDraftHomeUrlChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSaveSite();
              }}
              placeholder="網站網址，例如 https://www.youtube.com/@tnews6460/videos"
              className="h-11 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            />
            <Button
              type="button"
              onClick={onSaveSite}
              className="h-11 gap-2 rounded-xl bg-sky-600 hover:bg-sky-700"
            >
              <Plus size={16} />
              {editingId ? "儲存來源" : "新增來源"}
            </Button>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onAdvancedOpenChange(!advancedOpen)}
              className="text-xs font-medium text-sky-700 hover:underline"
            >
              {advancedOpen ? "收合進階設定" : "進階設定（適配器／搜尋模板）"}
            </button>
            {editingId && (
              <Button type="button" variant="ghost" onClick={onClearDraft} className="h-8 rounded-xl px-2 text-xs">
                取消編輯
              </Button>
            )}
          </div>

          {advancedOpen && (
            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              <select
                value={draftAdapter}
                onChange={(e) => onDraftAdapterChange(e.target.value as FengbroNewsAdapter)}
                className="h-11 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
              >
                {NEWS_ADAPTER_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label} — {opt.hint}
                  </option>
                ))}
              </select>
              <input
                value={draftTemplate}
                onChange={(e) => onDraftTemplateChange(e.target.value)}
                placeholder="搜尋 URL 模板（可選），關鍵字用 {q}"
                className="h-11 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
              />
              <p className="text-xs text-muted-foreground lg:col-span-2">
                通用來源會掃首頁／新聞列表；若站內有關鍵字搜尋頁，可填模板例如{" "}
                <code className="rounded bg-white px-1">https://example.gov.tw/search?q={"{q}"}</code>
              </p>
            </div>
          )}

          {formMessage && (
            <p className="mt-2 rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs text-sky-800">
              {formMessage}
            </p>
          )}
        </div>

        <div className="mt-4 grid gap-2 xl:grid-cols-2">
          {displaySites.map((site) => (
            <div
              key={site.id}
              className={`flex min-w-0 items-center justify-between gap-3 rounded-2xl border px-3 py-2 ${
                site.locked
                  ? "border-sky-200 bg-sky-50/80"
                  : "border-slate-200 bg-slate-50/80 opacity-80"
              } ${bulk.selectionMode && bulk.isSelected(site.id) ? "ring-2 ring-sky-400" : ""}`}
            >
              {bulk.selectionMode ? (
                <SelectionCheckbox
                  checked={bulk.isSelected(site.id)}
                  onChange={() => bulk.toggle(site.id)}
                  label={`選取 ${site.name}`}
                />
              ) : null}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {site.locked ? "🔒 " : "🔓 "}
                  {site.name}
                </p>
                <a
                  href={site.homeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-xs text-sky-700 hover:underline"
                >
                  {site.domain} · {newsAdapterLabel(site.adapter)}
                </a>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onToggleLock(site.id)}
                  className="h-9 rounded-xl px-2 text-xs"
                  title={site.locked ? "解除鎖定" : "鎖定焦點"}
                >
                  {site.locked ? <Lock size={14} /> : <Unlock size={14} />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onEditSite(site)}
                  className="h-9 rounded-xl px-3 text-xs"
                >
                  編輯
                </Button>
                <button
                  type="button"
                  onClick={() => onDeleteSite(site.id)}
                  className="rounded-full p-2 text-sky-600 transition hover:bg-sky-100 hover:text-sky-800"
                  title="刪除來源"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <BulkDeleteDialog
          open={bulkDeleteOpen}
          count={bulk.selectedCount}
          noun="新聞來源"
          confirmPhrase="DELETE news"
          busy={false}
          confirmInput={bulkDeleteInput}
          onConfirmInputChange={setBulkDeleteInput}
          onCancel={() => { setBulkDeleteOpen(false); setBulkDeleteInput(""); }}
          onConfirm={() => {
            onDeleteSites(Array.from(bulk.selectedIds));
            bulk.clear();
            setBulkDeleteOpen(false);
            setBulkDeleteInput("");
          }}
        />
      </div>
    </div>
  );
}
