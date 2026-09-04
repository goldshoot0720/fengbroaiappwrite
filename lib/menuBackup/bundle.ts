import { loadJSZip } from "@/lib/loadJSZip";

type ZipCtor = Awaited<ReturnType<typeof loadJSZip>>;
type ZipInstance = InstanceType<ZipCtor>;
import { withBom } from "@/lib/csvText";
import {
  CSV_BUNDLE_DIR,
  MANIFEST_NAME,
  MENU_BACKUP_ENTRIES,
  REPORT_NAME,
  ZIP_BUNDLE_DIR,
  buildManifest,
  csvMenus,
  csvPathFor,
  identifyBackupFile,
  zipMenus,
  zipPathFor,
  type MenuBackupEntry,
  type MenuBackupMode,
} from "./catalog";
import { exportCsvMenu, importCsvMenu, type BackupProgressFn, type MenuJobResult } from "./csvMenus";
import { exportZipMenu, importZipMenu } from "./zipMenus";

export type BundleRun = {
  kind: MenuBackupMode;
  results: MenuJobResult[];
  blob?: Blob;
};

function downloadBlob(blob: Blob, filename: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function formatReport(kind: MenuBackupMode, results: MenuJobResult[]): string {
  const lines = [
    "鋒兄選單備份",
    `kind: ${kind}`,
    `exportedAt: ${new Date().toISOString()}`,
    "",
  ];
  for (const result of results) {
    const status = result.status === "ok" ? "ok" : result.status;
    lines.push(`${result.label} (${result.id}): ${status} ${result.rows} 筆${result.message ? ` — ${result.message}` : ""}`);
  }
  return lines.join("\n");
}

function summarize(results: MenuJobResult[]): string {
  const ok = results.filter((result) => result.status === "ok").length;
  const fail = results.filter((result) => result.status === "error").length;
  const skipped = results.filter((result) => result.status === "skipped").length;
  const details = results
    .filter((result) => result.status === "error")
    .map((result) => `${result.label}：${result.message || "失敗"}`)
    .slice(0, 8);
  return [
    `完成 ${ok} 個選單${fail ? `，失敗 ${fail}` : ""}${skipped ? `，略過 ${skipped}` : ""}。`,
    ...details,
  ].join("\n");
}

async function zipFromBlob(blob: Blob): Promise<ZipInstance> {
  return (await loadJSZip()).loadAsync(blob);
}

function collectEntries(zip: ZipInstance): Array<{ path: string; file: ZipInstance["files"][string] }> {
  return Object.values(zip.files)
    .filter((file) => !file.dir)
    .map((file) => ({ path: file.name.replace(/\\/g, "/"), file }));
}

export async function exportMenuBundle(
  kind: MenuBackupMode,
  filename: string,
  onProgress?: BackupProgressFn,
): Promise<BundleRun> {
  const zip = new (await loadJSZip())();
  const results: MenuJobResult[] = [];
  const included: string[] = [];

  const csvTargets = csvMenus().filter((entry) => kind === "csv" || !entry.zipBundle);
  const zipTargets = kind === "all" ? zipMenus() : [];
  const total = csvTargets.length + zipTargets.length;

  let done = 0;
  for (const entry of csvTargets) {
    onProgress?.({
      stage: "export-csv",
      current: done + 1,
      total,
      message: `匯出 ${entry.label} CSV`,
      menuId: entry.id,
    });
    try {
      const { csv, rows } = await exportCsvMenu(entry, onProgress);
      zip.file(csvPathFor(entry), withBom(csv));
      results.push({ id: entry.id, label: entry.label, status: "ok", rows });
      included.push(entry.id);
    } catch (error) {
      results.push({
        id: entry.id,
        label: entry.label,
        status: "error",
        rows: 0,
        message: error instanceof Error ? error.message : "匯出失敗",
      });
    }
    done += 1;
  }

  for (const entry of zipTargets) {
    onProgress?.({
      stage: "export-zip",
      current: done + 1,
      total,
      message: `匯出 ${entry.label} ZIP`,
      menuId: entry.id,
    });
    try {
      const blob = await exportZipMenu(entry, onProgress);
      zip.file(zipPathFor(entry), blob);
      results.push({ id: entry.id, label: entry.label, status: "ok", rows: 1, message: "已打包 ZIP" });
      included.push(entry.id);
    } catch (error) {
      results.push({
        id: entry.id,
        label: entry.label,
        status: "error",
        rows: 0,
        message: error instanceof Error ? error.message : "匯出失敗",
      });
    }
    done += 1;
  }

  zip.file(MANIFEST_NAME, JSON.stringify(buildManifest(kind, included), null, 2));
  zip.file(REPORT_NAME, formatReport(kind, results));
  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, filename);
  return { kind, results, blob };
}

function entryById(id: string): MenuBackupEntry | undefined {
  return MENU_BACKUP_ENTRIES.find((entry) => entry.id === id);
}

export async function importMenuBundle(
  file: File,
  kind: MenuBackupMode,
  onProgress?: BackupProgressFn,
): Promise<BundleRun> {
  const results: MenuJobResult[] = [];
  const name = file.name.toLowerCase();

  if (name.endsWith(".csv")) {
    const identified = identifyBackupFile(file.name);
    const entry = identified ? entryById(identified.id) : undefined;
    if (!entry || !entry.csvOnly) {
      return {
        kind,
        results: [{ id: "unknown", label: file.name, status: "error", rows: 0, message: "無法辨識這個 CSV 屬於哪個選單" }],
      };
    }
    const text = await file.text();
    results.push(await importCsvMenu(entry, text, onProgress));
    return { kind, results };
  }

  if (!name.endsWith(".zip")) {
    return {
      kind,
      results: [{ id: "unknown", label: file.name, status: "error", rows: 0, message: "請選擇 .zip 或 .csv" }],
    };
  }

  const zip = await zipFromBlob(file);
  const files = collectEntries(zip);
  const csvJobs: Array<{ entry: MenuBackupEntry; text: Promise<string> }> = [];
  const zipJobs: Array<{ entry: MenuBackupEntry; blob: Promise<Blob> }> = [];
  const seenCsv = new Set<string>();
  const seenZip = new Set<string>();

  for (const { path, file: zipFile } of files) {
    const identified = identifyBackupFile(path);
    if (!identified) continue;
    const entry = entryById(identified.id);
    if (!entry) continue;

    if (identified.kind === "zip") {
      if (kind === "csv") continue;
      if (seenZip.has(entry.id)) continue;
      seenZip.add(entry.id);
      zipJobs.push({ entry, blob: zipFile.async("blob") });
      continue;
    }

    if (identified.kind === "csv") {
      if (kind === "all" && entry.zipBundle) continue;
      if (seenCsv.has(entry.id)) continue;
      seenCsv.add(entry.id);
      csvJobs.push({ entry, text: zipFile.async("string") });
    }
  }

  const total = csvJobs.length + zipJobs.length;
  let done = 0;
  for (const job of csvJobs) {
    onProgress?.({
      stage: "import-csv",
      current: done + 1,
      total,
      message: `匯入 ${job.entry.label} CSV`,
      menuId: job.entry.id,
    });
    try {
      results.push(await importCsvMenu(job.entry, await job.text, onProgress));
    } catch (error) {
      results.push({
        id: job.entry.id,
        label: job.entry.label,
        status: "error",
        rows: 0,
        message: error instanceof Error ? error.message : "匯入失敗",
      });
    }
    done += 1;
  }

  for (const job of zipJobs) {
    onProgress?.({
      stage: "import-zip",
      current: done + 1,
      total,
      message: `匯入 ${job.entry.label} ZIP`,
      menuId: job.entry.id,
    });
    try {
      results.push(await importZipMenu(job.entry, await job.blob, onProgress));
    } catch (error) {
      results.push({
        id: job.entry.id,
        label: job.entry.label,
        status: "error",
        rows: 0,
        message: error instanceof Error ? error.message : "匯入失敗",
      });
    }
    done += 1;
  }

  if (results.length === 0) {
    results.push({
      id: "unknown",
      label: file.name,
      status: "error",
      rows: 0,
      message: kind === "csv"
        ? `ZIP 裡沒有可辨識的 CSV（請放在 ${CSV_BUNDLE_DIR}/ 或檔名含選單名稱）`
        : `ZIP 裡沒有可辨識的 CSV / ZIP（請放在 ${CSV_BUNDLE_DIR}/ 與 ${ZIP_BUNDLE_DIR}/）`,
    });
  }

  return { kind, results };
}

export { summarize };
