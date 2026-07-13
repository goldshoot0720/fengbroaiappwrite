'use client';
import { useCallback } from 'react';

const IMAGE_DB   = 'ivv-image-db';
const IMAGE_STORE = 'images';
const SCRIPT_KEY  = 'ivv-script';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IMAGE_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IMAGE_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

export function useCache() {
  const saveImage = useCallback(async (key: string, blob: Blob) => {
    const db    = await openDB();
    const tx    = db.transaction(IMAGE_STORE, 'readwrite');
    tx.objectStore(IMAGE_STORE).put(blob, key);
    await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
    db.close();
  }, []);

  const loadImage = useCallback(async (key: string): Promise<Blob | null> => {
    const db  = await openDB();
    const tx  = db.transaction(IMAGE_STORE, 'readonly');
    const req = tx.objectStore(IMAGE_STORE).get(key);
    return new Promise((res, rej) => {
      req.onsuccess = () => { db.close(); res(req.result ?? null); };
      req.onerror   = () => { db.close(); rej(req.error); };
    });
  }, []);

  const saveScript = useCallback((text: string) => {
    try { localStorage.setItem(SCRIPT_KEY, text); } catch { /* ignore */ }
  }, []);

  const loadScript = useCallback((): string => {
    try { return localStorage.getItem(SCRIPT_KEY) ?? ''; } catch { return ''; }
  }, []);

  return { saveImage, loadImage, saveScript, loadScript };
}
