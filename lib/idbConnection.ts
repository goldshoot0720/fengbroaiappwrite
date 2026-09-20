"use client";

/**
 * 共用的 IndexedDB 連線池。
 *
 * 原本各快取 hook 的每一個操作（檢查、統計、讀取、寫入、刪除）都會重新
 * indexedDB.open()，等於每次存取都多付一次開啟資料庫的成本。這裡把連線
 * 依 `名稱:版本` 記住，之後的操作直接重用同一個 IDBDatabase。
 */

type UpgradeHandler = (db: IDBDatabase) => void;

const connections = new Map<string, Promise<IDBDatabase>>();

export function openDatabase(
  name: string,
  version: number,
  onUpgrade: UpgradeHandler
): Promise<IDBDatabase> {
  const key = `${name}:${version}`;

  const existing = connections.get(key);
  if (existing) return existing;

  const connection = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("此環境不支援 IndexedDB"));
      return;
    }

    const request = indexedDB.open(name, version);

    request.onerror = () => reject(request.error ?? new Error("無法打開數據庫"));
    request.onblocked = () => reject(new Error("資料庫被其他分頁佔用"));
    request.onupgradeneeded = () => onUpgrade(request.result);

    request.onsuccess = () => {
      const db = request.result;
      // 分頁關閉連線或其他分頁要升級版本時，把快取的連線丟掉以便下次重開。
      db.onclose = () => {
        if (connections.get(key) === connection) connections.delete(key);
      };
      db.onversionchange = () => {
        db.close();
        if (connections.get(key) === connection) connections.delete(key);
      };
      resolve(db);
    };
  });

  // 開啟失敗不要留下壞掉的 promise，否則之後每次都拿到同一個錯誤。
  connection.catch(() => {
    if (connections.get(key) === connection) connections.delete(key);
  });

  connections.set(key, connection);
  return connection;
}
