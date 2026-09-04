"use client";

import { useRef, useState } from "react";
import { Archive, Download, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui";
import { CollapsibleSettingsCard } from "@/components/ui/collapsible-settings-card";
import { notifyDataRefresh } from "@/hooks/useRefreshKey";
import { csvMenus, zipMenus } from "@/lib/menuBackup/catalog";
import { exportMenuBundle, importMenuBundle, summarize } from "@/lib/menuBackup/bundle";
import type { MenuBackupMode, MenuJobResult } from "@/lib/menuBackup";
import { getExportFilename } from "@/lib/utils";

type ProgressState = {
  stage: string;
  current: number;
  total: number;
  message: string;
};

export function MenuBackupSettings() {
  const csvInputRef = useRef<HTMLInputElement>(null);
  const allInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<MenuBackupMode | null>(null);
  const [action, setAction] = useState<"export" | "import" | null>(null);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [results, setResults] = useState<MenuJobResult[] | null>(null);

  const csvCount = csvMenus().length;
  const zipCount = zipMenus().length;

  const runExport = async (kind: MenuBackupMode) => {
    if (busy) return;
    setBusy(kind);
    setAction("export");
    setResults(null);
    setProgress({ stage: "export", current: 0, total: 1, message: "準備匯出…" });
    try {
      const filename = getExportFilename(kind === "csv" ? "all-csv" : "all-menus", "zip");
      const run = await exportMenuBundle(kind, filename, (update) => {
        setProgress({
          stage: update.stage,
          current: update.current,
          total: update.total,
          message: update.message,
        });
      });
      setResults(run.results);
      window.alert(`匯出完成，已開始下載 ${filename}\n\n${summarize(run.results)}`);
    } catch (error) {
      window.alert(`匯出失敗：${error instanceof Error ? error.message : "未知錯誤"}`);
    } finally {
      setBusy(null);
      setAction(null);
      setProgress(null);
    }
  };

  const runImport = async (kind: MenuBackupMode, file: File) => {
    if (busy) return;
    const confirmText =
      kind === "csv"
        ? `即將匯入 CSV 選單備份「${file.name}」。\n相同紀錄會更新、其餘新增；不會刪除備份裡沒有的資料。\n\n確定繼續？`
        : `即將匯入全部選單備份「${file.name}」（CSV + ZIP）。\n相同紀錄會更新、其餘新增；媒體檔會重新上傳，可能需要較長時間。\n\n確定繼續？`;
    if (!window.confirm(confirmText)) return;

    setBusy(kind);
    setAction("import");
    setResults(null);
    setProgress({ stage: "import", current: 0, total: 1, message: "讀取備份…" });
    try {
      const run = await importMenuBundle(file, kind, (update) => {
        setProgress({
          stage: update.stage,
          current: update.current,
          total: update.total,
          message: update.message,
        });
      });
      setResults(run.results);
      notifyDataRefresh("*");
      window.alert(`匯入完成\n\n${summarize(run.results)}`);
    } catch (error) {
      window.alert(`匯入失敗：${error instanceof Error ? error.message : "未知錯誤"}`);
    } finally {
      setBusy(null);
      setAction(null);
      setProgress(null);
    }
  };

  const percent = progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <CollapsibleSettingsCard
      className="md:col-span-2"
      defaultOpen
      accent="bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400"
      icon={<Archive size={20} />}
      title={<h3 className="font-bold text-lg">選單備份／還原</h3>}
      subtitle="一鍵匯出或匯入各選單 CSV；也可連同媒體 ZIP 一次打包"
    >
      <div className="space-y-5">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          CSV 備份只含文字資料（不含圖片／影片等檔案）。全部選單會再附上圖片、影片、音樂、播客、文件、筆記的 ZIP。匯入時相同鍵會更新、其餘新增，不會刪除備份裡沒有的紀錄。
        </p>

        {progress && (
          <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 dark:border-teal-800 dark:bg-teal-950">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-teal-900 dark:text-teal-100">{progress.message}</span>
              <span className="text-xs text-teal-700 dark:text-teal-300">
                {progress.current}/{progress.total}（{percent}%）
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-teal-200 dark:bg-teal-900">
              <div
                className="h-2 rounded-full bg-teal-600 transition-all duration-300 dark:bg-teal-400"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100">所有 CSV 選單（不含 ZIP）</h4>
            <p className="mt-1 text-xs text-gray-500">
              {csvCount} 個選單：訂閱、食品、常用、銀行、例行、音樂／影片中繼資料、比價、新聞等。
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                ref={csvInputRef}
                type="file"
                accept=".zip,.csv,application/zip,text/csv"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void runImport("csv", file);
                }}
              />
              <Button
                variant="outline"
                className="flex-1"
                disabled={Boolean(busy)}
                onClick={() => void runExport("csv")}
              >
                {busy === "csv" && action === "export" ? (
                  <><Loader2 size={16} className="animate-spin" /> 匯出中…</>
                ) : (
                  <><Download size={16} /> 一鍵匯出 CSV</>
                )}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={Boolean(busy)}
                onClick={() => csvInputRef.current?.click()}
              >
                {busy === "csv" && action === "import" ? (
                  <><Loader2 size={16} className="animate-spin" /> 匯入中…</>
                ) : (
                  <><Upload size={16} /> 一鍵匯入 CSV</>
                )}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100">所有選單（.csv + .zip）</h4>
            <p className="mt-1 text-xs text-gray-500">
              上述 CSV，加上 {zipCount} 個媒體 ZIP：圖片、影片、音樂、播客、文件、筆記。
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                ref={allInputRef}
                type="file"
                accept=".zip,application/zip"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void runImport("all", file);
                }}
              />
              <Button
                variant="outline"
                className="flex-1"
                disabled={Boolean(busy)}
                onClick={() => void runExport("all")}
              >
                {busy === "all" && action === "export" ? (
                  <><Loader2 size={16} className="animate-spin" /> 匯出中…</>
                ) : (
                  <><Download size={16} /> 一鍵匯出全部</>
                )}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={Boolean(busy)}
                onClick={() => allInputRef.current?.click()}
              >
                {busy === "all" && action === "import" ? (
                  <><Loader2 size={16} className="animate-spin" /> 匯入中…</>
                ) : (
                  <><Upload size={16} /> 一鍵匯入全部</>
                )}
              </Button>
            </div>
          </div>
        </div>

        {results && results.length > 0 && (
          <div className="rounded-xl border border-gray-200 p-3 text-xs dark:border-gray-700">
            <p className="mb-2 font-semibold text-gray-700 dark:text-gray-200">上次結果</p>
            <ul className="max-h-48 space-y-1 overflow-auto">
              {results.map((result) => (
                <li key={`${result.id}-${result.label}`} className="flex justify-between gap-3">
                  <span>{result.label}</span>
                  <span
                    className={
                      result.status === "ok"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : result.status === "skipped"
                          ? "text-gray-400"
                          : "text-red-600 dark:text-red-400"
                    }
                  >
                    {result.status === "ok" ? `${result.rows} 筆` : result.message || result.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </CollapsibleSettingsCard>
  );
}
