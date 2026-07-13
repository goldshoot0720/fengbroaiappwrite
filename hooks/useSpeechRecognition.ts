"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getVoicePreferences } from "@/lib/voicePreferences";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onstart: ((event: Event) => void) | null;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: ((event: Event) => void) | null;
};

type SpeechRecognitionResultEventLike = {
  results: ArrayLike<{
    isFinal?: boolean;
    0?: { transcript?: string };
  }>;
};

/** phrase = 說完自動結束（短指令）；dictation = 持續聽直到手動結束 */
export type SpeechRecognitionMode = "phrase" | "dictation";

export type UseSpeechRecognitionOptions = {
  lang?: string;
  /** Default "phrase" — ends after a natural pause so users rarely need to click stop. */
  mode?: SpeechRecognitionMode;
  /** Minimum hold before manual stop is allowed. Default 300ms. */
  minRecordingMs?: number;
  /**
   * After the last speech result, auto-stop when silence lasts this long (ms).
   * Only used in continuous/dictation-like flows. Default 1500. Set 0 to disable.
   */
  silenceTimeoutMs?: number;
  /** Called when listening ends and there is usable text. */
  onResult?: (text: string) => void;
  /** Called when listening ends without usable text. */
  onEmptyResult?: () => void;
  /** Called when listening ends unexpectedly without text (legacy alias of empty). */
  onInterrupted?: () => void;
  onError?: (message: string) => void;
  onStart?: () => void;
};

export type UseSpeechRecognitionReturn = {
  isSupported: boolean;
  isListening: boolean;
  transcript: string;
  setTranscript: (value: string) => void;
  elapsedMs: number;
  canStop: boolean;
  remainingMs: number;
  remainingSeconds: number;
  error: string | null;
  mode: SpeechRecognitionMode;
  start: () => void;
  stop: () => void;
  toggle: () => void;
};

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const win = window as typeof window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

function collectTranscripts(event: SpeechRecognitionResultEventLike) {
  let finalText = "";
  let interimText = "";
  for (let index = 0; index < event.results.length; index += 1) {
    const result = event.results[index];
    const text = result?.[0]?.transcript || "";
    if (result?.isFinal) finalText += text;
    else interimText += text;
  }
  return {
    finalText: finalText.trim(),
    interimText: interimText.trim(),
    displayText: (finalText || interimText).trim(),
  };
}

/**
 * Shared Web Speech API helper for short, friendly voice commands.
 * Phrase mode auto-finishes after a pause; no forced multi-second recording.
 */
export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const {
    lang = "zh-TW",
    mode = "phrase",
    minRecordingMs = 300,
    silenceTimeoutMs = 1500,
    onResult,
    onEmptyResult,
    onInterrupted,
    onError,
    onStart,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const startedAtRef = useRef(0);
  const userStopRef = useRef(false);
  const finalTextRef = useRef("");
  const interimTextRef = useRef("");
  const transcriptRef = useRef("");
  const silenceTimerRef = useRef<number | null>(null);
  const isListeningRef = useRef(false);

  const onResultRef = useRef(onResult);
  const onEmptyResultRef = useRef(onEmptyResult);
  const onInterruptedRef = useRef(onInterrupted);
  const onErrorRef = useRef(onError);
  const onStartRef = useRef(onStart);
  const modeRef = useRef(mode);
  const silenceTimeoutRef = useRef(silenceTimeoutMs);
  const minRecordingMsRef = useRef(minRecordingMs);

  useEffect(() => {
    onResultRef.current = onResult;
    onEmptyResultRef.current = onEmptyResult;
    onInterruptedRef.current = onInterrupted;
    onErrorRef.current = onError;
    onStartRef.current = onStart;
    modeRef.current = mode;
    silenceTimeoutRef.current = silenceTimeoutMs;
    minRecordingMsRef.current = minRecordingMs;
  }, [onResult, onEmptyResult, onInterrupted, onError, onStart, mode, silenceTimeoutMs, minRecordingMs]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    setIsSupported(Boolean(getSpeechRecognitionCtor()));
  }, []);

  useEffect(() => {
    if (!isListening) return;
    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 200);
    return () => window.clearInterval(timer);
  }, [isListening]);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearSilenceTimer();
      try {
        recognitionRef.current?.abort?.();
        recognitionRef.current?.stop?.();
      } catch {
        // ignore cleanup errors
      }
      recognitionRef.current = null;
    };
  }, [clearSilenceTimer]);

  const canStop = !isListening || elapsedMs >= minRecordingMs;
  const remainingMs = Math.max(0, minRecordingMs - elapsedMs);
  const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));

  const stop = useCallback(() => {
    if (!recognitionRef.current) return;
    const elapsed = Date.now() - startedAtRef.current;
    if (elapsed < minRecordingMsRef.current) {
      const seconds = Math.max(1, Math.ceil((minRecordingMsRef.current - elapsed) / 1000));
      const message = `請再說一下，約 ${seconds} 秒後可結束錄音。`;
      setError(message);
      onErrorRef.current?.(message);
      return;
    }
    userStopRef.current = true;
    clearSilenceTimer();
    try {
      recognitionRef.current.stop();
    } catch {
      // ignore
    }
  }, [clearSilenceTimer]);

  const scheduleSilenceStop = useCallback(() => {
    clearSilenceTimer();
    const timeout = silenceTimeoutRef.current;
    // Phrase mode already relies on browser end-of-speech; keep a safety net for continuous.
    if (!timeout || timeout <= 0) return;
    if (modeRef.current === "phrase") return;

    silenceTimerRef.current = window.setTimeout(() => {
      if (!recognitionRef.current || !isListeningRef.current) return;
      const text = (
        finalTextRef.current ||
        interimTextRef.current ||
        transcriptRef.current
      ).trim();
      if (!text) return;
      userStopRef.current = true;
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }, timeout);
  }, [clearSilenceTimer]);

  const start = useCallback(() => {
    if (isListeningRef.current) {
      stop();
      return;
    }

    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (!SpeechRecognitionCtor) {
      const message = "此瀏覽器不支援語音辨識，請改用文字指令。";
      setError(message);
      setIsSupported(false);
      onErrorRef.current?.(message);
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    const continuous = modeRef.current === "dictation";
    recognition.lang = lang;
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    finalTextRef.current = "";
    interimTextRef.current = "";
    userStopRef.current = false;
    startedAtRef.current = Date.now();
    clearSilenceTimer();
    setElapsedMs(0);
    setError(null);
    setTranscript("");
    transcriptRef.current = "";

    recognition.onstart = () => {
      recognitionRef.current = recognition;
      isListeningRef.current = true;
      setIsListening(true);
      onStartRef.current?.();
    };

    recognition.onresult = (event) => {
      const collected = collectTranscripts(event);
      finalTextRef.current = collected.finalText;
      interimTextRef.current = collected.interimText;
      transcriptRef.current = collected.displayText;
      setTranscript(collected.displayText);

      // Safety auto-stop after pause when dictating continuously.
      if (continuous) scheduleSilenceStop();

      // Phrase mode: once we have a final chunk and silence, many engines end on their own.
      // Extra safety: if we already have final text and a short quiet window, stop ourselves.
      if (!continuous && collected.finalText && silenceTimeoutRef.current > 0) {
        clearSilenceTimer();
        silenceTimerRef.current = window.setTimeout(() => {
          if (!recognitionRef.current || !isListeningRef.current) return;
          userStopRef.current = true;
          try {
            recognitionRef.current.stop();
          } catch {
            // ignore
          }
        }, Math.min(silenceTimeoutRef.current, 900));
      }
    };

    recognition.onerror = (event) => {
      const code = event?.error || "unknown";
      if (code === "aborted" || code === "no-speech") return;
      const message =
        code === "not-allowed"
          ? "麥克風權限被拒絕，請在瀏覽器設定允許後再試。"
          : code === "network"
            ? "語音服務連線失敗，請檢查網路後再試，或改用文字指令。"
            : `語音辨識失敗（${code}），請再試一次或改用文字指令。`;
      setError(message);
      onErrorRef.current?.(message);
    };

    recognition.onend = () => {
      clearSilenceTimer();
      recognitionRef.current = null;
      isListeningRef.current = false;
      setIsListening(false);
      setElapsedMs(0);

      const text = (
        finalTextRef.current ||
        interimTextRef.current ||
        transcriptRef.current
      ).trim();

      if (text) {
        onResultRef.current?.(text);
        return;
      }

      if (userStopRef.current) {
        onEmptyResultRef.current?.();
        return;
      }

      // Browser ended with no text (timeout / no-speech) — keep copy gentle.
      if (onEmptyResultRef.current) onEmptyResultRef.current();
      else onInterruptedRef.current?.();
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      const message = "無法啟動麥克風，請再試一次。";
      setError(message);
      isListeningRef.current = false;
      setIsListening(false);
      onErrorRef.current?.(message);
    }
  }, [clearSilenceTimer, lang, scheduleSilenceStop, stop]);

  const toggle = useCallback(() => {
    if (isListeningRef.current) stop();
    else start();
  }, [start, stop]);

  const setTranscriptSafe = useCallback((value: string) => {
    setTranscript(value);
    transcriptRef.current = value;
  }, []);

  return {
    isSupported,
    isListening,
    transcript,
    setTranscript: setTranscriptSafe,
    elapsedMs,
    canStop,
    remainingMs,
    remainingSeconds,
    error,
    mode,
    start,
    stop,
    toggle,
  };
}

export function formatRecordingClock(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Soft UI chime for successful safe commands (no external asset). Honors voice preferences. */
export function playVoiceSuccessTone() {
  if (typeof window === "undefined") return;
  try {
    if (!getVoicePreferences().successSound) return;

    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
    window.setTimeout(() => void ctx.close(), 300);
  } catch {
    // ignore audio failures
  }
}
