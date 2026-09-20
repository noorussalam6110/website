const CACHE_NAME = 'noorussalam-v15';
const RUNTIME_CACHE = 'noorussalam-runtime-v15';

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

self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(CORE_FILES);
      for (const url of OPTIONAL_PAGES) {
        try { await cache.add(url); }
        catch (e) { console.log('[SW] Optional page not cached:', url); }
      }
      for (const url of CDN_RESOURCES) {
        try { await cache.add(url); }
        catch (e) { console.log('[SW] CDN resource not cached:', url); }
      }
    })()
  );
  self.skipWaiting();
});

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

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  
  // Skip Supabase API calls
  if (url.hostname.includes('supabase.co')) return;
  
  // Only handle http/https
  if (!url.protocol.startsWith('http')) return;
  
  // ============================================
  // HTML NAVIGATION — network first, fallback to cache
  // ============================================
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
          return response;
        })
        .catch(async () => {
          // Exact URL match
          const cached = await caches.match(req);
          if (cached) return cached;
          
          // Path-based fallback
          const path = url.pathname;
          
          // If navigating to login.html → fallback to login.html
          if (path.includes('login')) {
            return (await caches.match('./login.html')) ||
                   (await caches.match('./index.html'));
          }
          
          // If navigating to student-zone/fees/calendar → try those
          if (path.includes('student-zone')) {
            return (await caches.match('./student-zone.html')) ||
                   (await caches.match('./login.html'));
          }
          if (path.includes('fees')) {
            return (await caches.match('./fees.html')) ||
                   (await caches.match('./login.html'));
          }
          if (path.includes('calendar')) {
            return (await caches.match('./calendar.html')) ||
                   (await caches.match('./login.html'));
          }
          
          // Default → login.html (Student Portal is primary app entry)
          return (await caches.match('./login.html')) ||
                 (await caches.match('./index.html'));
        })
    );
    return;
  }
  
  // ============================================
  // CDN RESOURCES — cache first
  // ============================================
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
  
  // ============================================
  // IMAGES — cache first
  // ============================================
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
  
  // ============================================
  // EVERYTHING ELSE — cache first, network fallback
  // ============================================
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).catch(() => cached))
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
