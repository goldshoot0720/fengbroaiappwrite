"use client";

import type { ReactNode } from "react";
import { CheckCircle2, Mic, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataCard } from "@/components/ui/data-card";
import { Input } from "@/components/ui/input";
import { formatRecordingClock } from "@/hooks/useSpeechRecognition";
import { cn } from "@/lib/utils";

export type VoiceBarRisk = "safe" | "review" | "danger";

export type VoiceBarPending = {
  summary: string;
  risk: VoiceBarRisk;
};

type VoiceCommandBarProps = {
  title: string;
  description: string;
  helpText?: string;
  accent?: "emerald" | "sky";
  transcript: string;
  onTranscriptChange: (value: string) => void;
  feedback: string;
  isListening: boolean;
  isSupported: boolean;
  canStop: boolean;
  elapsedMs: number;
  placeholder?: string;
  samples?: string[];
  pending?: VoiceBarPending | null;
  onToggleListen: () => void;
  onSubmit: (text: string) => void;
  onConfirm?: () => void;
  onCancelPending?: () => void;
  extraActions?: ReactNode;
  className?: string;
};

const accentStyles = {
  emerald: {
    card: "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/20",
    title: "text-emerald-700 dark:text-emerald-300",
    iconIdle: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
    listenBtn: "bg-emerald-600 hover:bg-emerald-700",
    runBtn: "bg-emerald-600 hover:bg-emerald-700",
    status: "border-emerald-200 bg-white/80 text-emerald-950 dark:border-emerald-900 dark:bg-gray-950/40 dark:text-emerald-100",
  },
  sky: {
    card: "border-sky-200 bg-sky-50/70 dark:border-sky-900 dark:bg-sky-950/20",
    title: "text-sky-700 dark:text-sky-300",
    iconIdle: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-200",
    listenBtn: "bg-sky-600 hover:bg-sky-700",
    runBtn: "bg-sky-600 hover:bg-sky-700",
    status: "border-sky-200 bg-white/80 text-sky-950 dark:border-sky-900 dark:bg-gray-950/40 dark:text-sky-100",
  },
};

export function VoiceCommandBar({
  title,
  description,
  helpText,
  accent = "emerald",
  transcript,
  onTranscriptChange,
  feedback,
  isListening,
  isSupported,
  canStop,
  elapsedMs,
  placeholder = "說或輸入指令後按 Enter",
  samples = [],
  pending = null,
  onToggleListen,
  onSubmit,
  onConfirm,
  onCancelPending,
  extraActions,
  className,
}: VoiceCommandBarProps) {
  const styles = accentStyles[accent];

  return (
    <DataCard className={cn(styles.card, "p-4 shadow-sm", className)}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-2xl",
                isListening ? "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-200" : styles.iconIdle
              )}
            >
              <Mic className="h-4 w-4" />
            </div>
            <div>
              <h3 className={cn("text-sm font-semibold", styles.title)}>{title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {description}
                {isListening ? ` · 錄音中 ${formatRecordingClock(elapsedMs)}` : ""}
              </p>
            </div>
            {isListening && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-200">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                </span>
                聆聽中 · 說完會自動結束
              </span>
            )}
          </div>
          {helpText && (
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{helpText}</p>
          )}
          {!isSupported && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              此瀏覽器不支援語音辨識（建議 Chrome / Edge），仍可輸入文字後按「執行」。
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            onClick={onToggleListen}
            disabled={!isSupported && !isListening}
            className={cn(
              "min-w-[8.5rem] rounded-xl text-white",
              isListening ? "bg-red-600 hover:bg-red-700" : styles.listenBtn
            )}
          >
            <Mic className={cn("mr-1 h-4 w-4", isListening && "animate-pulse")} />
            {isListening ? (canStop ? "說完了" : "準備中…") : "開始說話"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-w-[8rem] rounded-xl bg-white/80 dark:bg-transparent"
            onClick={() => onSubmit(transcript)}
            disabled={!transcript.trim() || isListening}
          >
            <Sparkles className="mr-1 h-4 w-4" />
            執行
          </Button>
          {extraActions}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <Input
          value={transcript}
          onChange={(event) => onTranscriptChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSubmit(transcript);
          }}
          placeholder={placeholder}
          className="h-12 rounded-xl bg-white dark:bg-slate-950"
          disabled={isListening}
          aria-label="語音或文字指令"
        />
        {samples.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {samples.map((sample) => (
              <Button
                key={sample}
                type="button"
                variant="outline"
                className="h-12 rounded-xl bg-white dark:bg-slate-950"
                onClick={() => onSubmit(sample)}
              >
                {sample}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className={cn("mt-3 rounded-2xl border p-3 text-sm shadow-sm", styles.status)}>
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">狀態</div>
        <div className="mt-1 leading-6">{feedback}</div>
      </div>

      {pending && (
        <div
          className={cn(
            "mt-3 rounded-2xl border p-3 text-sm shadow-sm",
            pending.risk === "danger"
              ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100"
              : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
          )}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <CheckCircle2 className="h-4 w-4" />
                {pending.risk === "danger" ? "危險操作，需確認" : "需確認後執行"}
              </p>
              <p className="mt-1 text-sm leading-6">{pending.summary}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl bg-white/80"
                onClick={onCancelPending}
              >
                取消
              </Button>
              <Button
                type="button"
                className={cn(
                  "rounded-xl text-white",
                  pending.risk === "danger" ? "bg-red-600 hover:bg-red-700" : styles.runBtn
                )}
                onClick={onConfirm}
              >
                確認執行
              </Button>
            </div>
          </div>
        </div>
      )}
    </DataCard>
  );
}
