import { NextResponse } from "next/server";
import JSZip from "jszip";
import { withBom } from "../../../lib/csvText";
import { BACKUP_FOLDER_LABEL, uploadBackupWithToken } from "../../../lib/googleDrive";
import { MANIFEST_NAME, REPORT_NAME, buildManifest, csvMenus, csvPathFor } from "../../../lib/menuBackup/catalog";
import { CsvExportSkipped, exportCsvMenuWith, formatBackupReport } from "../../../lib/menuBackup/csvExport";
import { getDriveAccessToken } from "../_lib/googleDriveOAuth";
import { createAppwrite } from "../_lib/appwriteClient";
import { loadResendConfig } from "../_lib/resendSettings";
import { sendResendEmail } from "../_lib/resendEmail";
import { validateResendConfigs } from "../../../lib/notifications/resolveResendConfig.mjs";

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

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/**
 * Emails the Resend recipients from 鋒兄設定 when a run fails outright or any
 * menu errors. Skipped menus (鋒兄新聞 lives only in the browser) are expected
 * and do not count. Never throws: a broken notifier must not hide the backup
 * result, so its own failure is returned alongside instead.
 */
async function notifyBackupFailure(outcome) {
  try {
    const { databases, databaseId } = createAppwrite(null);
    const { configs } = await loadResendConfig(databases, databaseId);
    if (configs.length === 0) return { sent: 0, reason: "未設定 Resend 通知" };
    validateResendConfigs(configs);

    const dateKey = taipeiDateStamp();
    const failedMenus = (outcome.results || []).filter((result) => result.status === "error");
    const partial = outcome.success === true;
    const subject = partial
      ? `鋒兄 CSV 備份部分失敗 ${dateKey}（${failedMenus.length} 個選單）`
      : `鋒兄 CSV 備份失敗 ${dateKey}`;
    const lines = [
      partial
        ? `備份已上傳到 ${BACKUP_FOLDER_LABEL}，但有選單匯出失敗：`
        : `今天的排程備份沒有上傳到 ${BACKUP_FOLDER_LABEL}。`,
      outcome.error ? `原因：${outcome.error}` : "",
      ...failedMenus.map((result) => `- ${result.label}：${result.message || "匯出失敗"}`),
    ].filter(Boolean);
    const text = lines.join("\n");
    const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;color:#172033">
      <h2 style="margin:0 0 12px">${escapeHtml(subject)}</h2>
      ${lines.map((line) => `<p style="margin:0 0 6px">${escapeHtml(line)}</p>`).join("")}
    </div>`;

    const sent = await Promise.all(
      configs.map((resend, index) =>
        sendResendEmail({
          ...resend,
          subject,
          text,
          html,
          // Manual retries on the same day send one email, not one per attempt.
          idempotencyKey: `fengbro-menu-backup-${partial ? "partial" : "failed"}-${dateKey}-${index + 1}`,
        })
      )
    );
    return { sent: sent.length };
  } catch (error) {
    console.error("menu-backup-cron notify error:", error);
    return { sent: 0, error: error instanceof Error ? error.message : "Resend 通知失敗" };
  }
}

/**
 * GET /api/menu-backup-cron — Vercel cron 每天台灣時間 06:06 執行：
 * 匯出「所有 CSV 選單（不含 ZIP）」並上傳到 Google 雲端硬碟 OAuth／fengbroaiappwrite，
 * 檔案格式與鋒兄設定「匯出到雲端硬碟」相同，可直接用一鍵匯入還原。
 * 失敗（含部分選單失敗）時用鋒兄設定裡的 Resend 寄信通知。
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

  const { status, body } = await runBackup(request);
  if (status >= 400 || body.failed > 0) {
    body.notification = await notifyBackupFailure(body);
  }
  return json(body, status);
}

async function runBackup(request) {
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
      return { status: 502, body: { error: "所有選單都匯出失敗，未上傳。", results } };
    }

    zip.file(MANIFEST_NAME, JSON.stringify(buildManifest("csv", included), null, 2));
    zip.file(REPORT_NAME, formatBackupReport("csv", results));
    const bytes = await zip.generateAsync({ type: "uint8array" });

    const filename = `appwrite-all-csv-${taipeiDateStamp()}.zip`;
    const uploaded = await uploadBackupWithToken(accessToken, new Blob([bytes], { type: "application/zip" }), filename);

    return {
      status: 200,
      body: {
        success: true,
        file: uploaded,
        ok: results.filter((result) => result.status === "ok").length,
        failed: results.filter((result) => result.status === "error").length,
        skipped: results.filter((result) => result.status === "skipped").length,
        results,
      },
    };
  } catch (error) {
    console.error("menu-backup-cron error:", error);
    return { status: 500, body: { error: error instanceof Error ? error.message : "排程備份失敗" } };
  }
}
