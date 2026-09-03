type SessionCacheEnvelope<T> = {
  savedAt: number;
  data: T;
};

function accountScope(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    const project = window.localStorage.getItem("NEXT_PUBLIC_APPWRITE_PROJECT_ID") || "";
    const database = window.localStorage.getItem("APPWRITE_DATABASE_ID") || "";
    return `${project}:${database}`;
  } catch {
    return "local";
  }
}

export function sessionCacheKey(name: string): string {
  return `fengbro:session-cache:${accountScope()}:${name}`;
}

export function readSessionCache<T>(name: string, maxAgeMs: number): T | null {
  if (typeof window === "undefined" || maxAgeMs <= 0) return null;
  try {
    const raw = window.sessionStorage.getItem(sessionCacheKey(name));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionCacheEnvelope<T>;
    if (!parsed || typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > maxAgeMs) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeSessionCache<T>(name: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    const envelope: SessionCacheEnvelope<T> = { savedAt: Date.now(), data };
    window.sessionStorage.setItem(sessionCacheKey(name), JSON.stringify(envelope));
  } catch {
    // sessionStorage full or blocked
  }
}

export function clearSessionCache(name: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(sessionCacheKey(name));
  } catch {
    // ignore
  }
}
