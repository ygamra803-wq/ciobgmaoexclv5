/**
 * Service Worker Enterprise Optimisé pour PWA - CIOB GMAO v4
 * Supporte :
 * - Stratégies multi-niveaux (Cache-First pour assets, Network-First pour API & Navigation)
 * - Background Sync ('sync-gmao-data')
 * - Push Notifications (VAPID / Web Push)
 * - Nettoyage automatique de la taille du cache (LRU / Max Entries)
 * - Isolation des requêtes de développement Vite
 */
const CACHE_NAME = 'gmao-v4';
const DATA_CACHE_NAME = 'gmao-data-v4';
const ASSET_CACHE_NAME = 'gmao-assets-v4';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/icon.svg',
  '/apple-touch-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
];

const API_ENDPOINTS = ['/api/gmao', '/api/health'];
const MAX_ASSET_CACHE_SIZE = 100;
const MAX_DATA_CACHE_SIZE = 50;

// 1. Installation du Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Certains fichiers statiques n’ont pu être pré-mis en cache:', err);
      });
    })
  );
  self.skipWaiting();
});

// 2. Activation et nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  const validCaches = new Set([CACHE_NAME, DATA_CACHE_NAME, ASSET_CACHE_NAME]);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!validCaches.has(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Interception Fetch avec stratégies dédiées
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;

  // Ignorer les requêtes de développement Vite, HMR et WebSockets
  if (
    url.pathname.includes('/@vite') ||
    url.pathname.includes('/@id/') ||
    url.pathname.includes('/@fs/') ||
    url.pathname.includes('node_modules') ||
    url.pathname.includes('__vite_ping') ||
    url.protocol === 'ws:' ||
    url.protocol === 'wss:'
  ) {
    return;
  }

  // A. Requêtes API : Network-First avec Cache-Fallback
  if (API_ENDPOINTS.some((endpoint) => url.pathname.startsWith(endpoint))) {
    event.respondWith(networkFirstWithCacheFallback(request, DATA_CACHE_NAME));
    return;
  }

  // B. Ressources statiques : Cache-First avec mise à jour réseau en arrière-plan (Stale-While-Revalidate)
  if (isStaticAsset(request)) {
    event.respondWith(cacheFirstWithNetworkUpdate(request, ASSET_CACHE_NAME));
    return;
  }

  // C. Navigation HTML : Network-First avec repli sur /offline.html
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }

  // D. Par défaut : Network-First
  event.respondWith(
    fetch(request).catch(async () => {
      const cached = await caches.match(request);
      return cached || createOfflineResponse();
    })
  );
});

async function networkFirstWithCacheFallback(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const networkResponse = await fetch(request.clone());
    if (networkResponse && networkResponse.status === 200) {
      await cache.put(request, networkResponse.clone());
      cleanupCache(cacheName, MAX_DATA_CACHE_SIZE);
    }
    return networkResponse;
  } catch {
    const cachedResponse = await cache.match(request);
    return cachedResponse || createOfflineResponse();
  }
}

async function cacheFirstWithNetworkUpdate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    fetch(request.clone())
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          cache.put(request, networkResponse.clone());
        }
      })
      .catch(() => {});
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request.clone());
    if (networkResponse && networkResponse.status === 200) {
      await cache.put(request, networkResponse.clone());
      cleanupCache(cacheName, MAX_ASSET_CACHE_SIZE);
    }
    return networkResponse;
  } catch {
    return createOfflineResponse();
  }
}

async function networkFirstWithOfflineFallback(request) {
  try {
    const networkResponse = await fetch(request.clone());
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;

    const offlineResponse = await cache.match('/offline.html');
    if (offlineResponse) return offlineResponse;

    return createOfflineResponse();
  }
}

// 4. Background Sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-gmao-data') {
    event.waitUntil(syncGmaoData());
  }
});

async function syncGmaoData() {
  try {
    const cache = await caches.open(DATA_CACHE_NAME);
    const keys = await cache.keys();

    for (const key of keys) {
      const request = new Request(key.url, { method: 'GET' });
      const response = await fetch(request);
      if (response && response.status === 200) {
        await cache.put(key, response.clone());
      }
    }

    const clients = await self.clients.matchAll();
    clients.forEach((client) => client.postMessage({ type: 'SYNC_COMPLETE', timestamp: new Date().toISOString() }));
  } catch {
    // Replanifier silencieusement si hors-ligne
  }
}

// 5. Push Notifications
self.addEventListener('push', (event) => {
  let payload;
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : 'Nouvelle notification GMAO' };
  }

  const title = payload.title || 'CIOB GMAO';
  const options = {
    body: payload.body || 'Nouvelle notification',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: payload.data || {},
    actions: payload.actions || [],
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return self.clients.openWindow('/');
    })
  );
});

// 6. Nettoyage périodique des caches (LRU simple)
async function cleanupCache(cacheName, maxEntries) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxEntries) {
      const toDelete = keys.slice(0, keys.length - maxEntries);
      await Promise.all(toDelete.map((k) => cache.delete(k)));
    }
  } catch {
    // Ignorer les erreurs de nettoyage
  }
}

function isStaticAsset(request) {
  const url = new URL(request.url);
  return /\.(js|css|png|jpg|jpeg|svg|gif|webp|woff|woff2|ico|json)$/.test(url.pathname);
}

function createOfflineResponse() {
  return new Response(
    JSON.stringify({
      error: 'OFFLINE',
      message: 'Mode hors-ligne actif. Vos données locales sont préservées.',
      timestamp: new Date().toISOString(),
      status: 503,
    }),
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
