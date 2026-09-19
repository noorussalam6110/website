/* ============================================================
   Noorussalam Madrasa Student Portal — Service Worker
   Version: v22.1 (matches app)
   ============================================================ */

const CACHE_VERSION = 'v22.1';
const CACHE_NAME = 'noorussalam-' + CACHE_VERSION;
const RUNTIME_CACHE = 'noorussalam-runtime-' + CACHE_VERSION;
const IMAGE_CACHE = 'noorussalam-images-' + CACHE_VERSION;
const MAX_RUNTIME_ITEMS = 80;
const MAX_IMAGE_ITEMS = 60;

const CORE_FILES = [
  './',
  './login.html',
  './index.html',
  './manifest.json'
];

const OPTIONAL_PAGES = [
  './student-zone.html',
  './fees.html',
  './calendar.html'
];

const CDN_RESOURCES = [
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.12/cropper.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.12/cropper.min.js',
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.25/jspdf.plugin.autotable.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Anek+Malayalam:wght@300;400;500;600;700;800&display=swap'
];

/* ---------- INSTALL ---------- */
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Core files — critical
    const coreResults = await Promise.allSettled(
      CORE_FILES.map(url => cache.add(url))
    );
    coreResults.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.warn('[SW] Core file failed:', CORE_FILES[i]);
      }
    });

    // Optional pages — safe to fail
    await Promise.allSettled(
      OPTIONAL_PAGES.map(url =>
        cache.add(url).catch(() => console.log('[SW] Optional skipped:', url))
      )
    );

    // CDN resources — safe to fail
    await Promise.allSettled(
      CDN_RESOURCES.map(url =>
        cache.add(new Request(url, { mode: 'no-cors' }))
          .catch(() => console.log('[SW] CDN skipped:', url))
      )
    );

    self.skipWaiting();
  })());
});

/* ---------- ACTIVATE ---------- */
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names.map(name => {
        if (name !== CACHE_NAME &&
            name !== RUNTIME_CACHE &&
            name !== IMAGE_CACHE) {
          console.log('[SW] Deleting old cache:', name);
          return caches.delete(name);
        }
      })
    );
    await self.clients.claim();
  })());
});

/* ---------- HELPER: trim cache ---------- */
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxItems) return;
  const toDelete = keys.length - maxItems;
  for (let i = 0; i < toDelete; i++) {
    await cache.delete(keys[i]);
  }
}

/* ---------- FETCH ---------- */
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Skip Supabase API (always network — fresh data)
  if (url.hostname.includes('supabase.co')) return;

  // Skip Chrome extensions
  if (!url.protocol.startsWith('http')) return;

  /* ---------- HTML NAVIGATION ---------- */
  if (req.mode === 'navigate' ||
      (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith((async () => {
      try {
        const response = await fetch(req);
        const clone = response.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, clone));
        return response;
      } catch (e) {
        // Exact match
        let cached = await caches.match(req);
        if (cached) return cached;

        // Path-based fallback
        const path = url.pathname;
        if (path.includes('student-zone')) {
          cached = await caches.match('./student-zone.html');
        } else if (path.includes('fees')) {
          cached = await caches.match('./fees.html');
        } else if (path.includes('calendar')) {
          cached = await caches.match('./calendar.html');
        } else if (path.includes('login')) {
          cached = await caches.match('./login.html');
        }
        if (cached) return cached;

        // Final fallback
        return (await caches.match('./login.html')) ||
               (await caches.match('./index.html')) ||
               new Response('Offline — please check your connection',
                            { status: 503, headers: { 'Content-Type': 'text/plain' } });
      }
    })());
    return;
  }

  /* ---------- CDN / FONTS — cache first ---------- */
  if (url.hostname.includes('cdn.jsdelivr.net') ||
      url.hostname.includes('cdnjs.cloudflare.com') ||
      url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com') ||
      url.hostname.includes('postimg.cc')) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const response = await fetch(req);
        const clone = response.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, clone));
        return response;
      } catch (e) {
        return cached || new Response('', { status: 408 });
      }
    })());
    return;
  }

  /* ---------- IMAGES — cache first + trim ---------- */
  if (req.destination === 'image') {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const response = await fetch(req);
        if (response && response.status === 200) {
          const clone = response.clone();
          const cache = await caches.open(IMAGE_CACHE);
          cache.put(req, clone);
          trimCache(IMAGE_CACHE, MAX_IMAGE_ITEMS);
        }
        return response;
      } catch (e) {
        return cached || new Response('', { status: 408 });
      }
    })());
    return;
  }

  /* ---------- EVERYTHING ELSE — stale-while-revalidate ---------- */
  event.respondWith((async () => {
    const cached = await caches.match(req);
    const networkFetch = fetch(req).then(async response => {
      if (response && response.status === 200 && response.type === 'basic') {
        const clone = response.clone();
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(req, clone);
        trimCache(RUNTIME_CACHE, MAX_RUNTIME_ITEMS);
      }
      return response;
    }).catch(() => cached);

    return cached || networkFetch;
  })());
});

/* ---------- MESSAGE (skip waiting / version check) ---------- */
self.addEventListener('message', event => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }
});

/* ---------- PUSH NOTIFICATIONS ---------- */
self.addEventListener('push', event => {
  let data = { title: 'Noorussalam Madrasa', body: 'New update!' };
  try { if (event.data) data = event.data.json(); } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      vibrate: [100, 50, 100],
      data: { url: data.url || './login.html' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || './login.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes(targetUrl) && 'focus' in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

/* ---------- BACKGROUND SYNC (optional) ---------- */
self.addEventListener('sync', event => {
  if (event.tag === 'nsm-sync') {
    event.waitUntil(Promise.resolve());
  }
});
