"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getVoicePreferences,
  setVoicePreferences,
  subscribeVoicePreferences,
  type VoicePreferences,
} from "@/lib/voicePreferences";

export function useVoicePreferences() {
  const [preferences, setPreferences] = useState<VoicePreferences>(() => getVoicePreferences());

  useEffect(() => {
    setPreferences(getVoicePreferences());
    return subscribeVoicePreferences(setPreferences);
  }, []);

  const updatePreferences = useCallback((partial: Partial<VoicePreferences>) => {
    const next = setVoicePreferences(partial);
    setPreferences(next);
    return next;
  }, []);

  return { preferences, updatePreferences };
}
