const CACHE_NAME = 'noorussalam-v13';
const RUNTIME_CACHE = 'noorussalam-runtime-v13';

// Core files (essential for offline)
const CORE_FILES = [
  './',
  './index.html',
  './manifest.json'
];

// Optional pages (cache if available, but don't fail install if missing)
const OPTIONAL_PAGES = [
  './student-zone.html',
  './fees.html',
  './calendar.html'
];

// External CDN resources (cache for offline)
const CDN_RESOURCES = [
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.12/cropper.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.12/cropper.min.js',
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.25/jspdf.plugin.autotable.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// Install — cache core + try optional + CDN
self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      
      // Cache core files (must succeed)
      await cache.addAll(CORE_FILES);
      
      // Cache optional pages (don't fail if missing)
      for (const url of OPTIONAL_PAGES) {
        try {
          await cache.add(url);
        } catch (e) {
          console.log('[SW] Optional page not cached:', url);
        }
      }
      
      // Cache CDN resources (don't fail if any missing)
      for (const url of CDN_RESOURCES) {
        try {
          await cache.add(url);
        } catch (e) {
          console.log('[SW] CDN resource not cached:', url);
        }
      }
    })()
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.map(name => {
          if (name !== CACHE_NAME && name !== RUNTIME_CACHE) {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          }
        })
      );
      await self.clients.claim();
    })()
  );
});

// Fetch — smart caching strategy
self.addEventListener('fetch', event => {
  const req = event.request;
  
  // Only handle GET requests
  if (req.method !== 'GET') return;
  
  const url = new URL(req.url);
  
  // Skip Supabase API calls (always network)
  if (url.hostname.includes('supabase.co')) {
    return; // Let it go to network naturally
  }
  
  // Skip chrome-extension and other non-http protocols
  if (!url.protocol.startsWith('http')) return;
  
  // HTML navigation requests → network-first (always get fresh HTML)
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
          return response;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }
  
  // CDN resources → cache-first (fast, rarely change)
  if (url.hostname.includes('cdn.jsdelivr.net') || 
      url.hostname.includes('cdnjs.cloudflare.com') ||
      url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
          return response;
        }).catch(() => cached || new Response('', { status: 408 }));
      })
    );
    return;
  }
  
  // Images (postimg, etc.) → cache-first
  if (req.destination === 'image') {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(response => {
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then(cache => cache.put(req, clone));
          return response;
        }).catch(() => cached || new Response('', { status: 408 }));
      })
    );
    return;
  }
  
  // Other requests → cache-first, fallback to network
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).catch(() => cached))
  );
});

// Listen for messages from the app (e.g., skip waiting)
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
