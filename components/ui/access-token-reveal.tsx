"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchApi } from "@/hooks/useApi";
import { API_ENDPOINTS } from "@/lib/constants";
import { formatDate } from "@/lib/formatters";

/** 顯示後自動重新遮蔽的秒數，避免 token 長時間留在畫面上。 */
const AUTO_HIDE_SECONDS = 30;

interface RevealResponse {
  accessToken: string;
  maskedAccessToken: string;
  accountId: string | null;
  tokenExpiry: string | null;
}

export function AccessTokenReveal({
  quotaId,
  hint,
  className = "",
}: {
  quotaId: string;
  hint?: string;
  className?: string;
}) {
  const [mode, setMode] = useState<"masked" | "asking" | "revealed">("masked");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState<RevealResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState(AUTO_HIDE_SECONDS);
  const inputRef = useRef<HTMLInputElement>(null);

  const hide = useCallback(() => {
    setMode("masked");
    setRevealed(null);
    setPin("");
    setError("");
    setCopied(false);
  }, []);

  // 顯示後倒數自動遮蔽
  useEffect(() => {
    if (mode !== "revealed") return;
    setCountdown(AUTO_HIDE_SECONDS);
    const timer = window.setInterval(() => {
      setCountdown((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          hide();
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [mode, hide]);

  useEffect(() => {
    if (mode === "asking") inputRef.current?.focus();
  }, [mode]);

  const submitPin = async () => {
    if (!/^\d{4}$/.test(pin)) {
      setError("請輸入四位數字");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const data = await fetchApi<RevealResponse>(
        `${API_ENDPOINTS.QUOTA}/${quotaId}/access-token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        }
      );
      setRevealed(data);
      setPin("");
      setMode("revealed");
    } catch (err) {
      // 密碼還沒建立時，訊息會指向「先到編輯表單設定四位數密碼」
      setError(err instanceof Error ? err.message : "讀取失敗");
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  const copyToken = async () => {
    if (!revealed?.accessToken) return;
    try {
      await navigator.clipboard.writeText(revealed.accessToken);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("複製失敗，請手動選取");
    }
  };

  if (mode === "asking") {
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        <Input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          placeholder="••••"
          value={pin}
          onChange={(event) => {
            setPin(event.target.value.replace(/\D/g, "").slice(0, 4));
            setError("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") submitPin();
            if (event.key === "Escape") hide();
          }}
          className="h-8 w-20 text-center tracking-[0.4em]"
          aria-label="四位數密碼"
        />
        <Button type="button" size="sm" onClick={submitPin} disabled={loading} className="h-8 rounded-lg">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "解鎖"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={hide} className="h-8 rounded-lg">
          取消
        </Button>
        {error ? <span className="text-xs text-red-600 dark:text-red-400">{error}</span> : null}
      </div>
    );
  }

  if (mode === "revealed" && revealed) {
    return (
      <div className={`space-y-1 ${className}`}>
        <div className="flex flex-wrap items-center gap-2">
          <code className="max-w-full break-all rounded bg-gray-100 px-2 py-1 text-[11px] text-gray-800 dark:bg-gray-800 dark:text-gray-100">
            {revealed.accessToken}
          </code>
          <Button type="button" size="sm" variant="outline" onClick={copyToken} className="h-8 rounded-lg" title="複製 accessToken">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={hide} className="h-8 rounded-lg" title="立即隱藏">
            <EyeOff className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="text-[11px] text-gray-500 dark:text-gray-400">
          {revealed.tokenExpiry ? `Token 到期：${formatDate(revealed.tokenExpiry)}　` : ""}
          {countdown} 秒後自動隱藏
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <code className="rounded bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600 dark:bg-gray-800 dark:text-gray-300">
        {hint ? `••••••••${hint}` : "••••••••"}
      </code>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setMode("asking")}
        className="h-8 rounded-lg"
        title="輸入四位數密碼以顯示 accessToken"
      >
        <Eye className="mr-1 h-3.5 w-3.5" />
        顯示
      </Button>
    </div>
  );
}

/** 額度頁用的四位數密碼輸入（解鎖整頁查詢）。 */
export function PinUnlockForm({
  onSubmit,
  loading,
  error,
  description = "accessToken 預設隱藏，輸入四位數密碼後才會查詢用量。",
}: {
  onSubmit: (pin: string) => void;
  loading?: boolean;
  error?: string;
  description?: string;
}) {
  const [pin, setPin] = useState("");

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
        <KeyRound className="h-4 w-4" />
        四位數密碼
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          placeholder="••••"
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
          onKeyDown={(event) => {
            if (event.key === "Enter" && pin.length === 4) onSubmit(pin);
          }}
          className="h-10 w-28 text-center text-lg tracking-[0.5em]"
          aria-label="四位數密碼"
        />
        <Button
          type="button"
          onClick={() => onSubmit(pin)}
          disabled={pin.length !== 4 || loading}
          className="rounded-lg"
        >
          {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
          解鎖並查詢
        </Button>
      </div>
      {error ? <div className="text-sm text-red-600 dark:text-red-400">{error}</div> : null}
    </div>
  );
}
