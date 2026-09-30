import { NextResponse } from "next/server";
import JSZip from "jszip";
import { withBom } from "../../../lib/csvText";
import { uploadBackupWithToken } from "../../../lib/googleDrive";
import { MANIFEST_NAME, REPORT_NAME, buildManifest, csvMenus, csvPathFor } from "../../../lib/menuBackup/catalog";
import { CsvExportSkipped, exportCsvMenuWith, formatBackupReport } from "../../../lib/menuBackup/csvExport";
import { getDriveAccessToken } from "../_lib/googleDriveOAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function json(data, status = 200) {
  return NextResponse.json(data, { status });
}

/** YYYYMMDD in Taiwan time, matching the date the user sees in the filename. */
function taipeiDateStamp(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(date)
    .replace(/-/g, "");
}

/**
 * GET /api/menu-backup-cron — Vercel cron 每天執行：
 * 匯出「所有 CSV 選單（不含 ZIP）」並上傳到 Google 雲端硬碟 OAuth／fengbroaiappwrite，
 * 檔案格式與鋒兄設定「匯出到雲端硬碟」相同，可直接用一鍵匯入還原。
 * 必須設定 CRON_SECRET：這條路徑會讀出全部資料並寫進雲端硬碟。
 */
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return json({ error: "未設定 CRON_SECRET，排程備份已停用。" }, 503);
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return json({ error: "unauthorized" }, 401);
  }

  try {
    // Fail before reading every table if Drive is not set up.
    const accessToken = await getDriveAccessToken();

    // Same list APIs the browser export reads; with no query string they fall
    // back to this deployment's Appwrite env config.
    const { origin } = new URL(request.url);
    const source = {
      fetchJson: async (path) => {
        const response = await fetch(new URL(path, origin), { cache: "no-store" });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || `${path} 回應 HTTP ${response.status}`);
        return data;
      },
    };

    const zip = new JSZip();
    const results = [];
    const included = [];
    for (const entry of csvMenus()) {
      try {
        const { csv, rows } = await exportCsvMenuWith(entry, source);
        zip.file(csvPathFor(entry), withBom(csv));
        results.push({ id: entry.id, label: entry.label, status: "ok", rows });
        included.push(entry.id);
      } catch (error) {
        results.push({
          id: entry.id,
          label: entry.label,
          status: error instanceof CsvExportSkipped ? "skipped" : "error",
          rows: 0,
          message: error instanceof Error ? error.message : "匯出失敗",
        });
      }
    }

    // A backup with no menus in it would look like a success on Drive.
    if (included.length === 0) {
      return json({ error: "所有選單都匯出失敗，未上傳。", results }, 502);
    }

    zip.file(MANIFEST_NAME, JSON.stringify(buildManifest("csv", included), null, 2));
    zip.file(REPORT_NAME, formatBackupReport("csv", results));
    const bytes = await zip.generateAsync({ type: "uint8array" });

    const filename = `appwrite-all-csv-${taipeiDateStamp()}.zip`;
    const uploaded = await uploadBackupWithToken(accessToken, new Blob([bytes], { type: "application/zip" }), filename);

    return json({
      success: true,
      file: uploaded,
      ok: results.filter((result) => result.status === "ok").length,
      failed: results.filter((result) => result.status === "error").length,
      skipped: results.filter((result) => result.status === "skipped").length,
      results,
    });
  } catch (error) {
    console.error("menu-backup-cron error:", error);
    return json({ error: error instanceof Error ? error.message : "排程備份失敗" }, 500);
  }
}
