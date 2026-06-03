"use client";

import { useCallback, useEffect, useState } from "react";
import { getAppwriteConfig, hasRequiredAppwriteConfig } from "@/lib/utils";

export const APPWRITE_CONFIG_CHANGED_EVENT = "fengbro:appwrite-config-changed";

export function notifyAppwriteConfigChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(APPWRITE_CONFIG_CHANGED_EVENT));
}

function readAppwriteSetup() {
  return {
    checked: true,
    config: getAppwriteConfig(),
    hasDatabaseConfig: hasRequiredAppwriteConfig({ requireApiKey: true }),
    hasStorageConfig: hasRequiredAppwriteConfig({ requireApiKey: true, requireBucket: true }),
  };
}

export function useAppwriteSetup() {
  const [setup, setSetup] = useState(() => ({
    checked: false,
    config: {
      endpoint: "",
      projectId: "",
      databaseId: "",
      bucketId: "",
      apiKey: "",
    },
    hasDatabaseConfig: false,
    hasStorageConfig: false,
  }));

  const refresh = useCallback(() => {
    setSetup(readAppwriteSetup());
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(APPWRITE_CONFIG_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(APPWRITE_CONFIG_CHANGED_EVENT, refresh);
    };
  }, [refresh]);

  return { ...setup, refresh };
}
