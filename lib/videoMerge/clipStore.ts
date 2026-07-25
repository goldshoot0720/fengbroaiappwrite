/**
 * Persist video clips + custom audio in IndexedDB.
 * Adapted from huang1988pioneer/VideoMerge.
 */

const DB_NAME = "fengbro-videomerge-clips";
const DB_VERSION = 1;
const STORE = "clips";
const AUDIO_STORE = "audio";
const PREVIEW_STORE = "preview";
const AUDIO_ID = "bgm";
const PREVIEW_ID = "preview";

export type VideoClipStatus = "loading" | "ready" | "error";

export type VideoClip = {
  id: string;
  file: File;
  name: string;
  size: number;
  firstFrame: string | null;
  lastFrame: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  status: VideoClipStatus;
  error: string | null;
};

type StoredClip = {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  blob: Blob;
  firstFrame: string | null;
  lastFrame: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  status: string;
  error: string | null;
  order: number;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB 不可用"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error || new Error("無法開啟影片快取"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(AUDIO_STORE)) {
        db.createObjectStore(AUDIO_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(PREVIEW_STORE)) {
        db.createObjectStore(PREVIEW_STORE, { keyPath: "id" });
      }
    };
  });
  return dbPromise;
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveClips(clips: VideoClip[]): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);

  await reqToPromise(store.clear());

  for (let i = 0; i < clips.length; i++) {
    const c = clips[i];
    const file = c.file;
    if (!(file instanceof Blob) || !file.size) continue;
    const row: StoredClip = {
      id: c.id,
      name: c.name || (file instanceof File ? file.name : `clip-${i}.mp4`),
      size: c.size || file.size,
      type: file.type || "video/mp4",
      lastModified: file instanceof File ? file.lastModified : Date.now(),
      blob: file,
      firstFrame: c.firstFrame ?? null,
      lastFrame: c.lastFrame ?? null,
      duration: c.duration ?? null,
      width: c.width ?? null,
      height: c.height ?? null,
      status: c.status === "ready" || c.status === "error" ? c.status : "ready",
      error: c.error ?? null,
      order: i,
    };
    store.put(row);
  }

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("儲存中止"));
  });
}

export async function loadClips(): Promise<VideoClip[]> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const store = tx.objectStore(STORE);
  const rows = (await reqToPromise(store.getAll())) as StoredClip[];
  rows.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return rows
    .filter((r) => r?.blob instanceof Blob && r.blob.size > 0)
    .map((r) => {
      const file = new File([r.blob], r.name || "video.mp4", {
        type: r.type || r.blob.type || "video/mp4",
        lastModified: r.lastModified || Date.now(),
      });
      const hasFrames = Boolean(r.firstFrame && r.lastFrame);
      return {
        id: r.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        name: r.name || file.name,
        size: r.size || file.size,
        firstFrame: r.firstFrame ?? null,
        lastFrame: r.lastFrame ?? null,
        duration: Number.isFinite(r.duration as number) ? r.duration : null,
        width: Number.isFinite(r.width as number) ? r.width : null,
        height: Number.isFinite(r.height as number) ? r.height : null,
        status: (r.status === "error" ? "error" : hasFrames ? "ready" : "loading") as VideoClipStatus,
        error: r.error ?? null,
      };
    });
}

export async function clearClips(): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}

export async function saveAudio(file: File | Blob | null): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(AUDIO_STORE, "readwrite");
  const store = tx.objectStore(AUDIO_STORE);
  if (!(file instanceof Blob) || !file.size) {
    store.delete(AUDIO_ID);
  } else {
    store.put({
      id: AUDIO_ID,
      name: file instanceof File ? file.name : "audio.mp3",
      size: file.size,
      type: file.type || "audio/mpeg",
      lastModified: file instanceof File ? file.lastModified : Date.now(),
      blob: file,
    });
  }
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("音軌儲存中止"));
  });
}

export async function loadAudio(): Promise<File | null> {
  try {
    const db = await openDb();
    const tx = db.transaction(AUDIO_STORE, "readonly");
    const store = tx.objectStore(AUDIO_STORE);
    const row = (await reqToPromise(store.get(AUDIO_ID))) as
      | { blob?: Blob; name?: string; type?: string; lastModified?: number }
      | undefined;
    if (!row?.blob || !(row.blob instanceof Blob) || !row.blob.size) return null;
    return new File([row.blob], row.name || "audio.mp3", {
      type: row.type || row.blob.type || "audio/mpeg",
      lastModified: row.lastModified || Date.now(),
    });
  } catch {
    return null;
  }
}

export async function clearStoredAudio(): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(AUDIO_STORE, "readwrite");
    tx.objectStore(AUDIO_STORE).delete(AUDIO_ID);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}

export async function savePreview(
  blob: Blob | null,
  meta: { filename?: string } = {}
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(PREVIEW_STORE, "readwrite");
  const store = tx.objectStore(PREVIEW_STORE);
  if (!(blob instanceof Blob) || !blob.size) {
    store.delete(PREVIEW_ID);
  } else {
    store.put({
      id: PREVIEW_ID,
      blob,
      type: blob.type || "video/mp4",
      size: blob.size,
      filename: meta.filename || "preview.mp4",
      savedAt: Date.now(),
    });
  }
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("預覽儲存中止"));
  });
}

export async function loadPreview(): Promise<{
  blob: Blob;
  filename: string;
  savedAt: number;
} | null> {
  try {
    const db = await openDb();
    const tx = db.transaction(PREVIEW_STORE, "readonly");
    const store = tx.objectStore(PREVIEW_STORE);
    const row = (await reqToPromise(store.get(PREVIEW_ID))) as
      | { blob?: Blob; filename?: string; savedAt?: number }
      | undefined;
    if (!row?.blob || !(row.blob instanceof Blob) || !row.blob.size) return null;
    return {
      blob: row.blob,
      filename: row.filename || "preview.mp4",
      savedAt: Number(row.savedAt) || 0,
    };
  } catch {
    return null;
  }
}

export async function clearStoredPreview(): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(PREVIEW_STORE, "readwrite");
    tx.objectStore(PREVIEW_STORE).delete(PREVIEW_ID);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}
