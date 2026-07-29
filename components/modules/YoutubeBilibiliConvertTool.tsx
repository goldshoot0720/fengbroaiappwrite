"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  ExternalLink,
  FileUp,
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
const QUALITY_OPTIONS = ["1080p", "720p"] as const;

const SETTINGS_KEY = "fengbro.tools.ytbili.settings";
/** Browser-local cookies.txt cache (this device only; never sent except on convert). */
const COOKIES_CACHE_KEY = "fengbro.tools.ytbili.cookies";
/** Cap cache size (~512KB) to match API body limit. */
const MAX_COOKIES_CACHE_CHARS = 512_000;

type ToolsProbe = {
  available: boolean;
  ytDlp: string | null;
  ffmpeg: string | null;
  ffprobe: string | null;
  ytDlpSource?: string | null;
  hasEnvCookies?: boolean;
  installHint: string[];
};

type SavedSettings = {
  urlCount: number;
  format: "MP3" | "MP4";
  /** Current: 1080p | 720p. Legacy "4K" is remapped on load. */
  mp4Quality: "1080p" | "720p" | "4K";
  urls?: string[];
};

type CookiesCache = {
  text: string;
  fileName?: string | null;
  savedAt?: string;
};

function readCookiesCache(): CookiesCache | null {
  try {
    const raw = localStorage.getItem(COOKIES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CookiesCache;
    if (typeof parsed?.text !== "string" || parsed.text.trim().length < 20) {
      return null;
    }
    if (parsed.text.length > MAX_COOKIES_CACHE_CHARS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCookiesCache(text: string, fileName: string | null): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    try {
      localStorage.removeItem(COOKIES_CACHE_KEY);
    } catch {
      /* ignore */
    }
    return true;
  }
  if (trimmed.length > MAX_COOKIES_CACHE_CHARS) return false;
  try {
    const payload: CookiesCache = {
      text: text.endsWith("\n") ? text : `${text}\n`,
      fileName: fileName || null,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(COOKIES_CACHE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

function clearCookiesCache(): void {
  try {
    localStorage.removeItem(COOKIES_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

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
  const [mp4Quality, setMp4Quality] = useState<"1080p" | "720p">("1080p");
  const [status, setStatus] = useState("準備就緒");
  const [logLines, setLogLines] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [probe, setProbe] = useState<ToolsProbe | null>(null);
  const [probeLoading, setProbeLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  /** Netscape cookies.txt — cached in this browser via localStorage. */
  const [cookiesText, setCookiesText] = useState("");
  const [cookiesFileName, setCookiesFileName] = useState<string | null>(null);
  const [cookiesCachedAt, setCookiesCachedAt] = useState<string | null>(null);
  const [showCookies, setShowCookies] = useState(false);
  const cookiesFileRef = useRef<HTMLInputElement>(null);

  // Restore settings + cookies cache
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const s = JSON.parse(raw) as SavedSettings;
        if (URL_COUNT_OPTIONS.includes(s.urlCount as 1 | 3 | 7)) {
          setUrlCount(s.urlCount);
        }
        if (s.format === "MP3" || s.format === "MP4") setFormat(s.format);
        if (s.mp4Quality === "1080p" || s.mp4Quality === "720p") {
          setMp4Quality(s.mp4Quality);
        } else if (s.mp4Quality === "4K") {
          // legacy setting → highest ladder step
          setMp4Quality("1080p");
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

    const cached = readCookiesCache();
    if (cached) {
      setCookiesText(cached.text);
      setCookiesFileName(cached.fileName || "cookies.txt");
      setCookiesCachedAt(cached.savedAt || null);
      setShowCookies(false);
      setStatus(
        `已從本機快取還原 cookies${
          cached.fileName ? `（${cached.fileName}）` : ""
        }`
      );
      setLogLines((prev) => [
        ...prev,
        `cookies 本機快取已還原${
          cached.fileName ? `：${cached.fileName}` : ""
        }（${cached.text.trim().length} 字元，此裝置瀏覽器）`,
      ]);
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

  // Persist cookies.txt to browser cache whenever content changes.
  useEffect(() => {
    if (!hydrated) return;
    if (!cookiesText.trim()) {
      clearCookiesCache();
      setCookiesCachedAt(null);
      return;
    }
    const ok = writeCookiesCache(cookiesText, cookiesFileName);
    if (ok) {
      setCookiesCachedAt(new Date().toISOString());
    }
  }, [cookiesFileName, cookiesText, hydrated]);

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

  const hasYoutubeUrl = useMemo(
    () =>
      visibleUrls.some((u) => {
        const t = u.trim().toLowerCase();
        return (
          t.includes("youtube.com") ||
          t.includes("youtu.be") ||
          t.includes("music.youtube.com")
        );
      }),
    [visibleUrls]
  );

  const hasCookiesReady = Boolean(
    cookiesText.trim() || probe?.hasEnvCookies
  );

  // Auto-open cookies panel when user pastes a YouTube link without cookies.
  useEffect(() => {
    if (hasYoutubeUrl && !hasCookiesReady) {
      setShowCookies(true);
    }
  }, [hasYoutubeUrl, hasCookiesReady]);

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

    const youtubeOnly = list.some((u) => {
      const t = u.toLowerCase();
      return (
        t.includes("youtube.com") ||
        t.includes("youtu.be") ||
        t.includes("music.youtube.com")
      );
    });

    // Pre-flight: without cookies, Vercel YouTube always hits "not a bot".
    if (youtubeOnly && !cookiesText.trim() && !probe?.hasEnvCookies) {
      setShowCookies(true);
      setStatus("YouTube 需要 cookies 才能在雲端轉換（尚未提供）");
      appendLog([
        "",
        "—— 已阻止轉換：未提供 YouTube cookies ——",
        "日誌裡的 cookies: 未提供 → 一定會被 YouTube 擋下（Sign in to confirm you're not a bot）。",
        "",
        "請依序操作：",
        "1. 用 Chrome/Edge 登入 https://www.youtube.com",
        "2. 安裝擴充套件「Get cookies.txt LOCALLY」（或同等工具）",
        "3. 在 youtube.com 頁面匯出 Netscape cookies.txt",
        "4. 點「選擇 cookies.txt 檔案」載入（或全選貼到文字框）",
        "5. 再按一次「轉成 MP4/MP3」",
        "",
        "本機開發也可設環境變數 YT_DLP_COOKIES_PATH 指向 cookies 檔路徑。",
        "不想貼 cookies → 請用本機桌面版：",
        SOURCE_URL,
      ]);
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
      cookiesText.trim()
        ? `cookies: 本次請求已附帶${
            cookiesFileName ? `（檔案 ${cookiesFileName}）` : "（文字框）"
          }`
        : probe?.hasEnvCookies
          ? "cookies: 使用伺服器環境變數"
          : "cookies: 未提供",
    ]);

    try {
      const res = await fetch("/api/youtube-bilibili-convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls: list,
          format,
          mp4Quality,
          ...(cookiesText.trim() ? { cookies: cookiesText } : {}),
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
            needCookies?: boolean;
          };
          if (data.error) message = data.error;
          if (data.logs?.length) appendLog(data.logs);
          if (data.installHint?.length) appendLog(data.installHint);
          if (data.validationErrors?.length) appendLog(data.validationErrors);
          if (data.needCookies) {
            setShowCookies(true);
            appendLog([
              "→ 請「選擇 cookies.txt 檔案」或貼上 Netscape cookies.txt 後重試。",
              "  匯出：瀏覽器擴充套件 Get cookies.txt LOCALLY，或見 yt-dlp wiki。",
            ]);
          }
        } catch {
          // 504/HTML 等非 JSON 回應
          if (res.status === 504 || res.status === 502 || res.status === 524) {
            message =
              "伺服器逾時（雲端下載 YouTube 常卡住）。沒有產生檔案可下載。";
          }
        }
        setStatus(`${message}（未產生下載檔）`);
        appendLog(["—— 結束：轉換失敗，沒有檔案可下載 ——"]);
        return;
      }

      const headerLogs = decodeLogHeader(logHeader);
      if (headerLogs.length) appendLog(headerLogs);

      const blob = await res.blob();
      if (!blob || blob.size < 64) {
        setStatus("伺服器回傳空檔，未產生可下載內容");
        appendLog([
          "—— 結束：回應幾乎是空的，沒有檔案可下載 ——",
          "常見原因：YouTube 擋雲端 IP、函式逾時、或轉檔中途失敗。",
        ]);
        return;
      }

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
      appendLog([
        `下載：${name}（${(blob.size / 1024 / 1024).toFixed(2)} MB）`,
        "若瀏覽器沒跳出檔案，請檢查下載列／是否封鎖彈出下載。",
      ]);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "轉換時發生錯誤";
      const message =
        /failed to fetch|networkerror|load failed|aborted/i.test(raw)
          ? "連線中斷或函式逾時（雲端下載 YouTube 常失敗／超時）。沒有產生檔案可下載。"
          : `${raw}（未產生下載檔）`;
      setStatus(message);
      appendLog([message, "—— 結束：沒有檔案可下載 ——"]);
    } finally {
      setBusy(false);
    }
  }, [
    appendLog,
    busy,
    cookiesFileName,
    cookiesText,
    format,
    mp4Quality,
    probe?.hasEnvCookies,
    visibleUrls,
  ]);

  const loadCookiesFromFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      try {
        const text = await file.text();
        const trimmed = text.trim();
        if (trimmed.length < 20) {
          setStatus("cookies 檔案內容太短，請重新匯出 Netscape cookies.txt");
          appendLog([
            `讀取失敗：${file.name} 內容過短（${trimmed.length} 字元）`,
          ]);
          return;
        }
        const looksOk =
          /# Netscape|# HTTP Cookie File/i.test(trimmed) ||
          (/youtube\.com|google\.com/i.test(trimmed) && /\t/.test(trimmed)) ||
          /^\s*[\w.-]+=/.test(trimmed);
        if (!looksOk) {
          setStatus("檔案不像 Netscape cookies.txt，請用擴充套件重新匯出");
          appendLog([
            `讀取失敗：${file.name} 格式不像 cookies.txt`,
            "請用「Get cookies.txt LOCALLY」在 youtube.com 匯出 Netscape 格式。",
          ]);
          return;
        }
        const normalized = text.endsWith("\n") ? text : `${text}\n`;
        if (normalized.length > MAX_COOKIES_CACHE_CHARS) {
          setStatus(
            `cookies 過長（>${MAX_COOKIES_CACHE_CHARS} 字元），無法快取`
          );
          appendLog([
            `讀取失敗：${file.name} 超過快取上限 ${MAX_COOKIES_CACHE_CHARS} 字元`,
          ]);
          return;
        }
        setCookiesText(normalized);
        setCookiesFileName(file.name);
        setShowCookies(true);
        const cached = writeCookiesCache(normalized, file.name);
        if (cached) setCookiesCachedAt(new Date().toISOString());
        setStatus(
          cached
            ? `已載入並快取 cookies：${file.name}`
            : `已載入 cookies：${file.name}（本機快取寫入失敗）`
        );
        appendLog([
          `cookies 已從檔案載入：${file.name}（${trimmed.length} 字元）`,
          cached
            ? "已快取到本機瀏覽器（鋒兄工具 · 此裝置 localStorage），下次開啟可直接用。"
            : "未能寫入本機快取（可能空間不足）；本次仍可用。",
        ]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatus(`讀取 cookies 檔失敗：${msg}`);
        appendLog([`讀取 cookies 檔失敗：${msg}`]);
      }
    },
    [appendLog]
  );

  const clearCookies = useCallback(() => {
    setCookiesText("");
    setCookiesFileName(null);
    setCookiesCachedAt(null);
    clearCookiesCache();
    setStatus("已清除 cookies 與本機快取");
    appendLog(["已清除 cookies.txt 本機快取"]);
  }, [appendLog]);

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
                轉成 MP3 或 MP4 後下載。雲端（Vercel）IP 常被 YouTube
                封鎖，若卡在「Extracting URL」請改本機或桌面版。
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

        {/* YouTube cookies (required on Vercel / datacenter IP) */}
        <div
          className={
            hasYoutubeUrl && !hasCookiesReady
              ? "rounded-2xl border border-amber-300 bg-amber-50/80 p-3 sm:p-4 dark:border-amber-800 dark:bg-amber-950/40"
              : "rounded-2xl border border-[var(--line-soft)] bg-[var(--surface-muted)]/40 p-3 sm:p-4"
          }
        >
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 text-left text-sm font-medium"
            onClick={() => setShowCookies((v) => !v)}
          >
            <span>
              {hasYoutubeUrl && !hasCookiesReady
                ? "⚠ YouTube 必填：cookies.txt（目前尚未提供）"
                : "YouTube cookies（雲端防 bot 用）"}
              {cookiesText.trim()
                ? cookiesFileName
                  ? ` · 已快取 ${cookiesFileName} ✓`
                  : " · 已快取 ✓"
                : probe?.hasEnvCookies
                  ? " · 伺服器環境變數已設定 ✓"
                  : ""}
            </span>
            <span className="text-xs text-[var(--muted-foreground)]">
              {showCookies ? "收合" : "展開"}
            </span>
          </button>
          {hasYoutubeUrl && !hasCookiesReady ? (
            <p className="mt-2 text-xs font-medium text-amber-900 dark:text-amber-100">
              你的日誌已證明：沒 cookies 會卡在「Sign in to confirm you&apos;re
              not a bot」，且不會有下載檔。請先用「選擇 cookies.txt
              檔案」或貼上內容（會自動快取到本機瀏覽器）。
            </p>
          ) : null}
          {showCookies ? (
            <div className="mt-3 space-y-2">
              <ol className="list-decimal space-y-1 pl-4 text-xs leading-relaxed text-[var(--muted-foreground)]">
                <li>
                  瀏覽器登入{" "}
                  <a
                    href="https://www.youtube.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2"
                  >
                    youtube.com
                  </a>
                </li>
                <li>
                  用擴充套件「Get cookies.txt LOCALLY」匯出 Netscape{" "}
                  <code className="rounded bg-black/10 px-1">cookies.txt</code>
                </li>
                <li>
                  點下方「選擇 cookies.txt 檔案」（例如{" "}
                  <code className="rounded bg-black/10 px-1">
                    Downloads\cookies.txt
                  </code>
                  ）或貼到文字框 →{" "}
                  <strong className="font-medium text-foreground">
                    自動快取到本機
                  </strong>
                </li>
                <li>下次開啟鋒兄工具可直接轉換，不必重選檔</li>
                <li>再按「轉成 {format}」</li>
              </ol>
              <p className="text-xs text-[var(--muted-foreground)]">
                快取存在<strong className="font-medium">此裝置瀏覽器</strong>
                （localStorage），不上傳伺服器；只有按轉換時才會附在請求裡。過期請重匯 cookies
                並覆蓋快取。進階：本機{" "}
                <code className="rounded bg-black/10 px-1">
                  YT_DLP_COOKIES_PATH
                </code>
                ／雲端{" "}
                <code className="rounded bg-black/10 px-1">YT_DLP_COOKIES</code>
                。{" "}
                <a
                  href="https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                >
                  官方匯出說明
                </a>
              </p>
              <input
                ref={cookiesFileRef}
                type="file"
                accept=".txt,text/plain"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  void loadCookiesFromFile(f);
                  // allow re-selecting the same file
                  e.target.value = "";
                }}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  disabled={busy}
                  className="gap-1.5"
                  onClick={() => cookiesFileRef.current?.click()}
                >
                  <FileUp size={14} />
                  選擇 cookies.txt 檔案
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy || !cookiesText}
                  onClick={clearCookies}
                >
                  清除 cookies 快取
                </Button>
              </div>
              {cookiesText.trim() ? (
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  本機快取中
                  {cookiesFileName ? `：${cookiesFileName}` : ""}
                  {cookiesCachedAt
                    ? ` · ${new Date(cookiesCachedAt).toLocaleString()}`
                    : ""}
                  （{cookiesText.trim().length.toLocaleString()} 字元）
                </p>
              ) : null}
              <textarea
                value={cookiesText}
                disabled={busy}
                rows={6}
                spellCheck={false}
                autoComplete="off"
                placeholder={
                  "# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t0\tLOGIN_INFO\t...\n（選檔或貼上後會自動快取到本機瀏覽器）"
                }
                onChange={(e) => {
                  setCookiesText(e.target.value);
                  if (!e.target.value.trim()) {
                    setCookiesFileName(null);
                    setCookiesCachedAt(null);
                  } else if (!cookiesFileName) {
                    setCookiesFileName("cookies.txt");
                  }
                }}
                className="w-full rounded-lg border border-[var(--line-soft)] bg-background px-3 py-2 font-mono text-[11px] leading-relaxed"
              />
            </div>
          ) : null}
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
                MP4 畫質（優先 1080p，失敗自動降 720p）
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
          。僅供合法授權／個人備份用途。YouTube 在雲端常要求 cookies（上方可貼
          cookies.txt）。若平台提供中文字幕，會一併下載（ZIP 時含 .srt）。
        </p>
      </DataCard>
    </div>
  );
}
