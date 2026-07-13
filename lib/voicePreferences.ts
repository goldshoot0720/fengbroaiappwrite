export type VoicePreferences = {
  /** Play a soft chime when a safe voice command runs. */
  successSound: boolean;
  /** Opening global voice FAB also starts listening immediately. */
  autoStartGlobal: boolean;
  /** Require confirm even for safe commands (search/refresh/navigate). */
  confirmSafeActions: boolean;
};

export const VOICE_PREFERENCES_KEY = "fengbro.voice.preferences";
export const VOICE_PREFERENCES_EVENT = "fengbro:voice-preferences";

export const DEFAULT_VOICE_PREFERENCES: VoicePreferences = {
  successSound: true,
  autoStartGlobal: true,
  confirmSafeActions: false,
};

function isBrowser() {
  return typeof window !== "undefined";
}

export function getVoicePreferences(): VoicePreferences {
  if (!isBrowser()) return { ...DEFAULT_VOICE_PREFERENCES };
  try {
    const raw = localStorage.getItem(VOICE_PREFERENCES_KEY);
    if (!raw) return { ...DEFAULT_VOICE_PREFERENCES };
    const parsed = JSON.parse(raw) as Partial<VoicePreferences>;
    return {
      successSound: typeof parsed.successSound === "boolean" ? parsed.successSound : DEFAULT_VOICE_PREFERENCES.successSound,
      autoStartGlobal: typeof parsed.autoStartGlobal === "boolean" ? parsed.autoStartGlobal : DEFAULT_VOICE_PREFERENCES.autoStartGlobal,
      confirmSafeActions:
        typeof parsed.confirmSafeActions === "boolean"
          ? parsed.confirmSafeActions
          : DEFAULT_VOICE_PREFERENCES.confirmSafeActions,
    };
  } catch {
    return { ...DEFAULT_VOICE_PREFERENCES };
  }
}

export function setVoicePreferences(partial: Partial<VoicePreferences>): VoicePreferences {
  const next = { ...getVoicePreferences(), ...partial };
  if (isBrowser()) {
    localStorage.setItem(VOICE_PREFERENCES_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(VOICE_PREFERENCES_EVENT, { detail: next }));
  }
  return next;
}

export function subscribeVoicePreferences(listener: (prefs: VoicePreferences) => void) {
  if (!isBrowser()) return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key && event.key !== VOICE_PREFERENCES_KEY) return;
    listener(getVoicePreferences());
  };
  const onCustom = (event: Event) => {
    const detail = (event as CustomEvent<VoicePreferences>).detail;
    listener(detail ? { ...DEFAULT_VOICE_PREFERENCES, ...detail } : getVoicePreferences());
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(VOICE_PREFERENCES_EVENT, onCustom as EventListener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(VOICE_PREFERENCES_EVENT, onCustom as EventListener);
  };
}

/** Whether a voice risk can auto-run without a second confirm click. */
export function shouldAutoExecuteVoiceRisk(risk: "safe" | "review" | "danger") {
  if (risk !== "safe") return false;
  return !getVoicePreferences().confirmSafeActions;
}
