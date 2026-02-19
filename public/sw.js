const CACHE_NAME = 'fengbro-ai-v4';
const OFFLINE_URL = '/offline.html';

const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/favicon.ico',
  '/manifest.json',
];

// ─── IndexedDB：儲存 Appwrite config 供背景任務使用 ───────────────────────────
const CONFIG_DB_NAME = 'fengbro-config';
const CONFIG_STORE_NAME = 'appwrite';

function openConfigDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(CONFIG_DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(CONFIG_STORE_NAME);
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveConfig(config) {
  try {
    const db = await openConfigDB();
    return new Promise((resolve) => {
      const tx = db.transaction(CONFIG_STORE_NAME, 'readwrite');
      tx.objectStore(CONFIG_STORE_NAME).put(config, 'config');
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
  } catch (_) {}
}

async function loadConfig() {
  try {
    const db = await openConfigDB();
    return new Promise((resolve) => {
      const tx = db.transaction(CONFIG_STORE_NAME, 'readonly');
      const req = tx.objectStore(CONFIG_STORE_NAME).get('config');
      req.onsuccess = () => resolve(req.result || {});
      req.onerror = () => resolve({});
    });
  } catch (_) {
    return {};
  }
}

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ─── Message：從頁面接收 Appwrite config ──────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SAVE_CONFIG') {
    saveConfig(event.data.config);
  }
});

// ─── Periodic Background Sync：定期背景檢查（Android Chrome）─────────────────
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-expiry') {
    event.waitUntil(checkExpiryBackground());
  }
});

// ─── Background Sync：連線恢復後立即同步 ─────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'check-expiry-sync') {
    event.waitUntil(checkExpiryBackground());
  }
});

async function checkExpiryBackground() {
  try {
    const config = await loadConfig();
    const params = new URLSearchParams();
    if (config.endpoint) params.set('_endpoint', config.endpoint);
    if (config.projectId) params.set('_project', config.projectId);
    if (config.databaseId) params.set('_database', config.databaseId);
    if (config.apiKey) params.set('_key', config.apiKey);

    const response = await fetch(`/api/check-expiry?${params.toString()}`);
    if (!response.ok) return;

    const data = await response.json();
    const { expiringSubscriptions = [], expiringFoods = [] } = data;

    // 訂閱即將到期通知
    for (const item of expiringSubscriptions) {
      const label = item.daysLeft === 0 ? '今天到期！' : `${item.daysLeft} 天後到期`;
      await self.registration.showNotification('📅 訂閱到期提醒', {
        body: `${item.name} ${label}`,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: `subscription-${item.id}`,
        renotify: false,
        data: { url: '/' },
      });
    }

    // 食品即將過期通知
    for (const item of expiringFoods) {
      const label = item.daysLeft === 0 ? '今天過期！' : `${item.daysLeft} 天後過期`;
      await self.registration.showNotification('🍱 食品過期提醒', {
        body: `${item.name} ${label}`,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: `food-${item.id}`,
        renotify: false,
        data: { url: '/' },
      });
    }
  } catch (e) {
    console.error('[SW] Background check error:', e);
  }
}

// ─── Push：伺服器推播通知 ─────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: '鋒兄AI Appwrite', body: '您有新的提醒' };
  try {
    if (event.data) data = event.data.json();
  } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
    })
  );
});

// ─── Notification Click：點擊通知開啟 App ────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});

// ─── Fetch：網路優先，離線回退 ────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;
  if (!request.url.startsWith(self.location.origin)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'image' ||
    request.destination === 'font'
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
