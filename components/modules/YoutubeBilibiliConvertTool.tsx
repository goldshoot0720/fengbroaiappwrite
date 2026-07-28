"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  ExternalLink,
  Loader2,
  Music2,
  Trash2,
  Video,
  Youtube,
} from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import { Button } from "@/components/ui/button";
import { getExportFilename } from "@/lib/utils";

const SOURCE_URL =
  "https://github.com/huang1988pioneer/YoutubeBilibiliMP4MP3Converter";

const URL_COUNT_OPTIONS = [1, 3, 7] as const;
const FORMAT_OPTIONS = ["MP3", "MP4"] as const;
const QUALITY_OPTIONS = ["1080p", "4K"] as const;

const SETTINGS_KEY = "fengbro.tools.ytbili.settings";

type ToolsProbe = {
  available: boolean;
  ytDlp: string | null;
  ffmpeg: string | null;
  ffprobe: string | null;
  ytDlpSource?: string | null;
  installHint: string[];
};

type SavedSettings = {
  urlCount: number;
  format: "MP3" | "MP4";
  mp4Quality: "1080p" | "4K";
  urls?: string[];
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      /* fall through */
    }
  }
  const plain = /filename="([^"]+)"/i.exec(header);
  if (plain?.[1]) return plain[1];
  return fallback;
}

function decodeLogHeader(header: string | null): string[] {
  if (!header) return [];
  try {
    const bin = atob(header.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const text = new TextDecoder().decode(bytes);
    return text.split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

export default function YoutubeBilibiliConvertTool() {
  const [urlCount, setUrlCount] = useState<number>(1);
  const [urls, setUrls] = useState<string[]>(() => Array(7).fill(""));
  const [format, setFormat] = useState<"MP3" | "MP4">("MP3");
  const [mp4Quality, setMp4Quality] = useState<"1080p" | "4K">("1080p");
  const [status, setStatus] = useState("準備就緒");
  const [logLines, setLogLines] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [probe, setProbe] = useState<ToolsProbe | null>(null);
  const [probeLoading, setProbeLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  // Restore settings
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const s = JSON.parse(raw) as SavedSettings;
        if (URL_COUNT_OPTIONS.includes(s.urlCount as 1 | 3 | 7)) {
          setUrlCount(s.urlCount);
        }
        if (s.format === "MP3" || s.format === "MP4") setFormat(s.format);
        if (s.mp4Quality === "1080p" || s.mp4Quality === "4K") {
          setMp4Quality(s.mp4Quality);
        }
        if (Array.isArray(s.urls) && s.urls.length) {
          setUrls((prev) => {
            const next = [...prev];
            for (let i = 0; i < Math.min(7, s.urls!.length); i++) {
              next[i] = s.urls![i] || "";
            }
            return next;
          });
        }
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const payload: SavedSettings = {
        urlCount,
        format,
        mp4Quality,
        urls: urls.slice(0, urlCount),
      };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }, [format, hydrated, mp4Quality, urlCount, urls]);

  const refreshProbe = useCallback(async () => {
    setProbeLoading(true);
    try {
      const res = await fetch("/api/youtube-bilibili-convert", {
        cache: "no-store",
      });
      const data = (await res.json()) as ToolsProbe;
      setProbe(data);
      if (!data.available) {
        setStatus("需要 yt-dlp 和 ffmpeg 才能轉換 MP3 / MP4");
        setLogLines([
          `yt-dlp: ${data.ytDlp || "找不到"}${
            data.ytDlpSource ? ` (${data.ytDlpSource})` : ""
          }`,
          `ffmpeg: ${data.ffmpeg || "找不到"}`,
          `ffprobe: ${data.ffprobe || "找不到"}`,
          ...(data.installHint || []),
        ]);
      } else {
        setStatus("準備就緒");
        setLogLines([
          `yt-dlp: ${data.ytDlp}${
            data.ytDlpSource ? ` (${data.ytDlpSource})` : ""
          }`,
          `ffmpeg: ${data.ffmpeg}`,
          `ffprobe: ${data.ffprobe || "—"}`,
        ]);
      }
    } catch (err) {
      setProbe({
        available: false,
        ytDlp: null,
        ffmpeg: null,
        ffprobe: null,
        ytDlpSource: null,
        installHint: ["無法連線探測 API"],
      });
      setStatus("無法檢查轉檔工具");
      setLogLines([err instanceof Error ? err.message : String(err)]);
    } finally {
      setProbeLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshProbe();
  }, [refreshProbe]);

  const visibleUrls = useMemo(
    () => urls.slice(0, urlCount),
    [urlCount, urls]
  );

  const filledCount = useMemo(
    () => visibleUrls.filter((u) => u.trim()).length,
    [visibleUrls]
  );

  const setUrlAt = useCallback((index: number, value: string) => {
    setUrls((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const clearUrls = useCallback(() => {
    setUrls(Array(7).fill(""));
    setStatus("網址已清除");
  }, []);

  const appendLog = useCallback((lines: string[]) => {
    setLogLines((prev) => {
      const next = [...prev, ...lines];
      return next.length > 400 ? next.slice(-400) : next;
    });
  }, []);

  const runConvert = useCallback(async () => {
    if (busy) return;
    const list = visibleUrls.map((u) => u.trim()).filter(Boolean);
    if (!list.length) {
      setStatus("請至少輸入一個 YouTube 或 Bilibili 網址");
      return;
    }

    setBusy(true);
    setStatus(`正在轉換 1/${list.length}…`);
    appendLog([
      "",
      `—— 開始轉換 ${list.length} 個 → ${format}${
        format === "MP4" ? ` ${mp4Quality}` : ""
      } ——`,
      ...list.map((u, i) => `[${i + 1}] ${u}`),
    ]);

    try {
      const res = await fetch("/api/youtube-bilibili-convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls: list,
          format,
          mp4Quality,
        }),
      });

      const logHeader = res.headers.get("X-Convert-Logs");
      const successN = res.headers.get("X-Convert-Success");
      const totalN = res.headers.get("X-Convert-Total");

      if (!res.ok) {
        let message = `轉換失敗（HTTP ${res.status}）`;
        try {
          const data = (await res.json()) as {
            error?: string;
            logs?: string[];
            installHint?: string[];
            validationErrors?: string[];
          };
          if (data.error) message = data.error;
          if (data.logs?.length) appendLog(data.logs);
          if (data.installHint?.length) appendLog(data.installHint);
          if (data.validationErrors?.length) appendLog(data.validationErrors);
        } catch {
          /* ignore */
        }
        setStatus(message);
        return;
      }

      const headerLogs = decodeLogHeader(logHeader);
      if (headerLogs.length) appendLog(headerLogs);

      const blob = await res.blob();
      const disp = res.headers.get("Content-Disposition");
      const fallback =
        blob.type === "application/zip"
          ? getExportFilename(`youtube-bilibili-${format.toLowerCase()}`, "zip")
          : getExportFilename(
              `youtube-bilibili`,
              format === "MP3" ? "mp3" : "mp4"
            );
      const name = filenameFromDisposition(disp, fallback);
      downloadBlob(blob, name);

      const ok = successN || "?";
      const total = totalN || String(list.length);
      setStatus(
        ok === total
          ? `完成，已輸出 ${ok} 個 ${format}（已開始下載 ${name}）`
          : `完成 ${ok}/${total}，已開始下載 ${name}；請查看記錄`
      );
      appendLog([`下載：${name}（${(blob.size / 1024 / 1024).toFixed(2)} MB）`]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "轉換時發生錯誤";
      setStatus(message);
      appendLog([message]);
    } finally {
      setBusy(false);
    }
  }, [appendLog, busy, format, mp4Quality, visibleUrls]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <DataCard className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
              <Youtube size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold">
                YouTube / Bilibili → MP3 / MP4
              </h3>
              <p className="text-sm text-muted-foreground">
                貼上 YouTube 或 Bilibili 連結，在伺服器端以 yt-dlp + ffmpeg
                轉成 MP3 或 MP4 後下載。
              </p>
            </div>
          </div>
          <a
            href={SOURCE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 shrink-0 items-center gap-1 self-start rounded-full border border-[var(--line-soft)] px-2.5 text-[11px] font-medium text-[var(--muted-foreground)] transition-impeccable hover:bg-[color:var(--panel-soft)]"
          >
            <ExternalLink size={12} />
            參考專案
          </a>
        </div>

        {/* Tool status */}
        <div
          className={
            probe?.available
              ? "rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
              : "rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
          }
        >
          {probeLoading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              檢查 yt-dlp / ffmpeg…
            </span>
          ) : probe?.available ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                轉檔工具就緒（yt-dlp
                {probe.ytDlpSource === "auto-download" ? " 已自動下載" : ""} +
                ffmpeg）
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void refreshProbe()}
              >
                重新檢查
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="font-medium">伺服器尚未就緒 yt-dlp 或 ffmpeg</p>
              <ul className="list-inside list-disc text-xs opacity-90">
                {(probe?.installHint || []).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="text-xs opacity-80">
                雲端會嘗試自動下載 yt-dlp；本機可用桌面版{" "}
                <a
                  href={SOURCE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                >
                  YoutubeBilibiliMP4MP3Converter
                </a>
                ，或設定{" "}
                <code className="rounded bg-black/10 px-1">YT_DLP_PATH</code>／
                <code className="rounded bg-black/10 px-1">.vendor/yt-dlp/</code>
                。
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void refreshProbe()}
              >
                重新檢查
              </Button>
            </div>
          )}
        </div>

        {/* URL count */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-[var(--muted-foreground)]">
            網址組數
          </label>
          <div className="flex flex-wrap gap-2">
            {URL_COUNT_OPTIONS.map((n) => (
              <Button
                key={n}
                type="button"
                size="sm"
                variant={urlCount === n ? "default" : "outline"}
                disabled={busy}
                onClick={() => setUrlCount(n)}
              >
                {n} 組
              </Button>
            ))}
          </div>
        </div>

        {/* URL inputs */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-[var(--muted-foreground)]">
            影片網址
          </label>
          <div className="space-y-2">
            {Array.from({ length: urlCount }, (_, i) => (
              <input
                key={i}
                type="url"
                value={urls[i] || ""}
                disabled={busy}
                placeholder={`網址 ${i + 1}：貼上 YouTube 或 Bilibili 影片/播放清單網址`}
                onChange={(e) => setUrlAt(i, e.target.value)}
                className="h-10 w-full rounded-lg border border-[var(--line-soft)] bg-background px-3 text-sm"
              />
            ))}
          </div>
        </div>

        {/* Format */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-medium text-[var(--muted-foreground)]">
              輸出格式
            </label>
            <div className="flex gap-2">
              {FORMAT_OPTIONS.map((f) => (
                <Button
                  key={f}
                  type="button"
                  size="sm"
                  variant={format === f ? "default" : "outline"}
                  disabled={busy}
                  onClick={() => setFormat(f)}
                  className="flex-1 gap-1.5"
                >
                  {f === "MP3" ? <Music2 size={14} /> : <Video size={14} />}
                  {f}
                </Button>
              ))}
            </div>
          </div>
          {format === "MP4" ? (
            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">
                MP4 畫質
              </label>
              <div className="flex gap-2">
                {QUALITY_OPTIONS.map((q) => (
                  <Button
                    key={q}
                    type="button"
                    size="sm"
                    variant={mp4Quality === q ? "default" : "outline"}
                    disabled={busy}
                    onClick={() => setMp4Quality(q)}
                    className="flex-1"
                  >
                    {q}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--muted-foreground)]">
                MP3 品質
              </label>
              <p className="text-sm text-[var(--muted-foreground)]">
                最高音質（audio-quality 0）· 可嵌入封面
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => void runConvert()}
            disabled={busy || !probe?.available || filledCount === 0}
            className="gap-1.5"
          >
            {busy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            {busy ? "轉換中…" : `轉成 ${format}`}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={clearUrls}
            className="gap-1.5"
          >
            <Trash2 size={14} />
            清除網址
          </Button>
          <p className="text-sm text-[var(--muted-foreground)]">{status}</p>
        </div>

        {busy ? (
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--line-soft)]">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-[linear-gradient(135deg,var(--accent-strong),var(--accent))]" />
          </div>
        ) : null}
      </DataCard>

      <DataCard className="space-y-3 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold">記錄</h4>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={!logLines.length}
            onClick={() => setLogLines([])}
          >
            清空記錄
          </Button>
        </div>
        <pre className="max-h-72 min-h-[140px] overflow-auto rounded-xl bg-black/85 p-3 text-[11px] leading-relaxed text-emerald-100">
          {logLines.length ? logLines.join("\n") : "（尚無記錄）"}
        </pre>
        <p className="text-[11px] leading-relaxed text-[var(--muted-foreground)]">
          功能參考{" "}
          <a
            href={SOURCE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            huang1988pioneer/YoutubeBilibiliMP4MP3Converter
          </a>
          。僅供合法授權／個人備份用途；部分會員、地區限制或反爬影片可能失敗。伺服器端不會讀取瀏覽器
          cookies（與桌面版不同）。若平台提供中文字幕，會一併下載（ZIP
          時含 .srt）。
        </p>
      </DataCard>
    </div>
  );
}
