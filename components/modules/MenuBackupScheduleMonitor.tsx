"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, Loader2, PlayCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui";
import { fetchApi } from "@/hooks/useApi";
import { API_ENDPOINTS } from "@/lib/constants";
import { DRIVE_REAUTH_STEPS, isDriveAuthError } from "@/lib/googleDriveAuthHelp";
import {
  BACKUP_INTERVAL_OPTIONS,
  BACKUP_SCHEDULE_TIME_LABEL,
  daysBetweenDateKeys,
  describeBackupDate,
  intervalLabel,
  taipeiDateKey,
} from "@/lib/menuBackup/schedule";

type ScheduleState = {
  enabled: boolean;
  intervalDays: number;
  lastAttemptAt: string;
  lastResult: "" | "ok" | "partial" | "failed";
  lastMessage: string;
  lastFile: string;
  lastSuccessAt: string;
  lastSuccessDate: string;
  todayKey: string;
  nextRunDate: string;
  dueToday: boolean;
};

type RunResponse = {
  success?: boolean;
  error?: string;
  ok?: number;
  failed?: number;
  skipped?: number;
  file?: { name?: string };
  schedule?: ScheduleState | null;
};

const RESULT_STYLE: Record<string, { label: string; className: string }> = {
  ok: { label: "成功", className: "text-emerald-600 dark:text-emerald-400" },
  partial: { label: "部分失敗", className: "text-amber-600 dark:text-amber-400" },
  failed: { label: "失敗", className: "text-red-600 dark:text-red-400" },
};

/** ISO 時間 → 台北時間「2026-10-21 06:12」；沒有值就回「—」。 */
function formatTaipeiTime(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const parts = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${pick("year")}-${pick("month")}-${pick("day")} ${pick("hour")}:${pick("minute")}`;
}

/**
 * 排程備份監測。
 *
 * cron 固定在每天 06:06 叫一次，「每 3／7／14／28 天」是在伺服器端比對上次成功日期
 * 後跳過，所以這裡只存頻率、不碰 vercel.json。狀態全部由 /api/menu-backup-schedule
 * 讀寫，換裝置看到的結果一致。
 */
export function MenuBackupScheduleMonitor() {
  const [state, setState] = useState<ScheduleState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setState(await fetchApi<ScheduleState>(API_ENDPOINTS.MENU_BACKUP_SCHEDULE));
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "讀取排程設定失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (next: Partial<Pick<ScheduleState, "enabled" | "intervalDays">>) => {
    if (!state || saving) return;
    const payload = {
      enabled: next.enabled ?? state.enabled,
      intervalDays: next.intervalDays ?? state.intervalDays,
    };
    setSaving(true);
    setFailed(false);
    setMessage(null);
    try {
      setState(
        await fetchApi<ScheduleState>(API_ENDPOINTS.MENU_BACKUP_SCHEDULE, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      );
      setMessage(
        payload.enabled
          ? `已設定為${intervalLabel(payload.intervalDays)}自動備份。`
          : "已關閉排程自動備份（仍可按「立即備份一次」）。"
      );
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  };

  const runNow = async () => {
    if (running) return;
    setRunning(true);
    setFailed(false);
    setMessage("備份中，需要一點時間打包並上傳…");
    try {
      const result = await fetchApi<RunResponse>(API_ENDPOINTS.MENU_BACKUP_SCHEDULE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run" }),
      });
      if (result.schedule) setState(result.schedule);
      if (result.success) {
        setMessage(
          `備份成功：${result.ok ?? 0} 個選單已上傳${result.failed ? `，${result.failed} 個失敗` : ""}。`
        );
      } else {
        // 失敗原因已經寫進「上次執行」，這裡不再重複一整段。
        setFailed(true);
        setMessage("備份失敗，原因見上方「上次執行」。");
      }
    } catch {
      setFailed(true);
      // 原因已經寫進「上次執行」，這裡只留一句，避免同一段錯誤重複兩次。
      setMessage("備份失敗，原因見上方「上次執行」。");
      // 失敗時伺服器已經把結果寫進 Appwrite，但非 2xx 讓 fetchApi 直接丟錯、
      // 拿不到回傳的 schedule，所以重新抓一次，「上次執行」才會跟著更新。
      void load();
    } finally {
      setRunning(false);
    }
  };

  const resultStyle = state?.lastResult ? RESULT_STYLE[state.lastResult] : null;
  const busy = saving || running;

  /**
   * 「監測」的重點：備份失敗會寄信，但如果 cron 根本沒被觸發（CRON_SECRET 沒設、
   * 排程被停用），連信都不會來。用上次執行的日期跟今天比，超過一個間隔還沒動就示警。
   */
  const lastAttemptAt = state?.lastAttemptAt || "";
  const idleDays = lastAttemptAt
    ? daysBetweenDateKeys(taipeiDateKey(new Date(lastAttemptAt)), state?.todayKey || "")
    : null;
  const neverRan = Boolean(state?.enabled) && !lastAttemptAt;
  const stale =
    Boolean(state?.enabled) &&
    !neverRan &&
    idleDays != null &&
    idleDays > (state?.intervalDays ?? 1) + 1;
  const needsReauth = isDriveAuthError(state?.lastMessage);

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-800 dark:bg-sky-950/40">
      <div className="flex flex-wrap items-center gap-2">
        <CalendarClock size={16} className="text-sky-700 dark:text-sky-300" />
        <h4 className="font-semibold text-sky-900 dark:text-sky-100">排程自動備份</h4>
        {loading ? <Loader2 size={14} className="animate-spin text-sky-600" /> : null}
        {state ? (
          <span
            className={
              state.enabled
                ? "rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                : "rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300"
            }
          >
            {state.enabled ? intervalLabel(state.intervalDays) : "已關閉"}
          </span>
        ) : null}
      </div>

      <p className="mt-1 text-xs text-sky-700 dark:text-sky-300">
        雲端硬碟備份由 Vercel 排程在{BACKUP_SCHEDULE_TIME_LABEL}檢查一次（實際觸發時間由 Vercel
        排定，可能晚至 07:06）；選 3 天以上時，未滿間隔會自動跳過，滿間隔的當天才上傳。
        失敗會用 Resend 寄信通知。
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {BACKUP_INTERVAL_OPTIONS.map((days) => {
          const active = state?.intervalDays === days && state?.enabled;
          return (
            <button
              key={days}
              type="button"
              disabled={!state || busy}
              onClick={() => void save({ enabled: true, intervalDays: days })}
              className={
                active
                  ? "rounded-lg border border-sky-600 bg-sky-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                  : "rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-medium text-sky-800 hover:bg-sky-100 disabled:opacity-60 dark:border-sky-700 dark:bg-sky-900/40 dark:text-sky-200 dark:hover:bg-sky-900"
              }
            >
              {intervalLabel(days)}
            </button>
          );
        })}
        <button
          type="button"
          disabled={!state || busy}
          onClick={() => void save({ enabled: !state?.enabled })}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          {state?.enabled ? "關閉排程" : "開啟排程"}
        </button>
      </div>

      {state ? (
        <dl className="mt-3 space-y-1 text-xs text-sky-800 dark:text-sky-200">
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-sky-600 dark:text-sky-400">上次執行</dt>
            <dd className="min-w-0 break-words">
              {formatTaipeiTime(state.lastAttemptAt)}
              {resultStyle ? (
                <span className={`ml-2 font-medium ${resultStyle.className}`}>{resultStyle.label}</span>
              ) : null}
              {state.lastMessage ? (
                <span className="ml-2 text-sky-700 dark:text-sky-300" title={state.lastMessage}>
                  — {state.lastMessage.length > 120 ? `${state.lastMessage.slice(0, 120)}…` : state.lastMessage}
                </span>
              ) : null}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-sky-600 dark:text-sky-400">上次成功</dt>
            <dd className="min-w-0 break-words">
              {state.lastSuccessDate ? formatTaipeiTime(state.lastSuccessAt) : "還沒有成功紀錄"}
              {state.lastFile ? (
                <span className="ml-2 break-all font-mono text-[11px] text-sky-700 dark:text-sky-300">{state.lastFile}</span>
              ) : null}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-sky-600 dark:text-sky-400">下次執行</dt>
            <dd className="min-w-0 break-words">
              {!state.enabled
                ? "已關閉"
                : state.dueToday
                  ? "今天 06:06–07:06"
                  : `${describeBackupDate(state.nextRunDate, state.todayKey)} 06:06–07:06`}
            </dd>
          </div>
        </dl>
      ) : null}

      {neverRan || stale ? (
        <p className="mt-2 rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
          {neverRan
            ? "排程還沒有任何執行紀錄。若是剛部署，等隔天 06:06 再看；超過兩天仍空白，請確認 Vercel 的 CRON_SECRET 與排程設定。"
            : `排程已經 ${idleDays} 天沒有執行（間隔 ${state?.intervalDays} 天），可能 Vercel Cron 沒被觸發或 CRON_SECRET 沒設好。`}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={runNow} disabled={busy}>
          {running ? <Loader2 size={16} className="animate-spin" /> : <PlayCircle size={16} />}
          {running ? "備份中…" : "立即備份一次"}
        </Button>
        {message ? (
          <span className={`text-xs ${failed ? "text-destructive" : "text-sky-700 dark:text-sky-300"}`}>
            {failed ? <XCircle size={12} className="mr-1 inline" /> : <CheckCircle2 size={12} className="mr-1 inline" />}
            {message}
          </span>
        ) : null}
      </div>

      {needsReauth ? (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100">
          <p className="font-semibold">需要重新授權 Google 雲端硬碟</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            {DRIVE_REAUTH_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
