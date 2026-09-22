/* ============================================================ */
/* 🔧 NOORUSSALAM MADRASA — Service Worker v19                  */
/* ============================================================ */

const CACHE_NAME = 'noorussalam-v19';
const RUNTIME_CACHE = 'noorussalam-runtime-v19';

const CORE_FILES = [
  './',
  './login.html',
  './manifest.json'
];

const OPTIONAL_PAGES = [
  './index.html',
  './gallery.html',
  './contact.html',
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

/* ──────────────────────────────────────────────────────────── */
/* ─── Install ─── */
/* ──────────────────────────────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      console.log('[SW v19] Installing...');
      for (const url of CORE_FILES) {
        try { await cache.add(url); console.log('[SW] ✅ Core:', url); }
        catch (e) { console.log('[SW] ⚠️ Skip:', url); }
      }
      for (const url of OPTIONAL_PAGES) {
        try { await cache.add(url); console.log('[SW] ✅ Optional:', url); }
        catch (e) { console.log('[SW] ⚠️ Skip:', url); }
      }
      for (const url of CDN_RESOURCES) {
        try { await cache.add(url); console.log('[SW] ✅ CDN:', url); }
        catch (e) { console.log('[SW] ⚠️ Skip CDN:', url); }
      }
      console.log('[SW] ✅ Install complete');
    })()
  );
  self.skipWaiting();
});

/* ──────────────────────────────────────────────────────────── */
/* ─── Activate ─── */
/* ──────────────────────────────────────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.map(name => {
          if (name !== CACHE_NAME && name !== RUNTIME_CACHE) {
            console.log('[SW] 🗑️ Deleting old:', name);
            return caches.delete(name);
          }
        })
      );
      await self.clients.claim();
      console.log('[SW] ✅ Activated v19');
    })()
  );
});

/* ──────────────────────────────────────────────────────────── */
/* ─── Fetch ─── */
/* ──────────────────────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.hostname.includes('supabase.co')) return;
  if (!url.protocol.startsWith('http')) return;

  // HTML — network first
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        return response;
      }).catch(async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        const path = url.pathname;
        if (path.includes('login')) return (await caches.match('./login.html')) || (await caches.match('./index.html'));
        if (path.includes('gallery')) return (await caches.match('./gallery.html')) || (await caches.match('./login.html'));
        if (path.includes('contact')) return (await caches.match('./contact.html')) || (await caches.match('./login.html'));
        if (path.includes('student-zone')) return (await caches.match('./student-zone.html')) || (await caches.match('./login.html'));
        if (path.includes('fees')) return (await caches.match('./fees.html')) || (await caches.match('./login.html'));
        if (path.includes('calendar')) return (await caches.match('./calendar.html')) || (await caches.match('./login.html'));
        return (await caches.match('./login.html')) || (await caches.match('./index.html'));
      })
    );
    return;
  }

  // CDN — cache first
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

  // Images — cache first
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

  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).catch(() => cached))
  );
});

/* ──────────────────────────────────────────────────────────── */
/* ─── Message ─── */
/* ──────────────────────────────────────────────────────────── */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/* ============================================================ */
/* 🔔 PUSH NOTIFICATION HANDLER                                  */
/* ============================================================ */
self.addEventListener('push', function(event) {
  let data = {
    title: 'Noorussalam',
    body: 'പുതിയ അറിയിപ്പ്',
    count: 1,
    url: '/'
  };
  
  try {
    if (event.data) {
      data = Object.assign({}, data, event.data.json());
    }
  } catch (e) {
    console.log('[SW] Push data parse error:', e);
  }
  
  console.log('[SW] 📩 Push received:', data.title, '| URL:', data.url);
  
  event.waitUntil(
    (async () => {
      try {
        if ('setAppBadge' in self.navigator) {
          await self.navigator.setAppBadge(data.count || 1);
        }
      } catch (e) {}
      
      await self.registration.showNotification(data.title, {
        body: data.body,
        icon: 'https://i.postimg.cc/DznFT7L9/IMG-3167.png',
        badge: 'https://i.postimg.cc/DznFT7L9/IMG-3167.png',
        tag: 'nsm-' + Date.now(),
        renotify: true,
        vibrate: [200, 100, 200],
        requireInteraction: false,
        data: { url: data.url || '/' }
      });
      
      console.log('[SW] ✅ Notification shown');
    })()
  );
});

/* ═══════════════════════════════════════════════════════════ */
/* 🎯 NOTIFICATION CLICK — ഇവിടെ ആണ് പ്രധാന function!           */
/* ═══════════════════════════════════════════════════════════ */
self.addEventListener('notificationclick', function(event) {
  console.log('[SW] 🔔 Notification clicked');
  event.notification.close();
  
  // Get URL from notification data
  var targetUrl = '/';
  if (event.notification.data && event.notification.data.url) {
    targetUrl = event.notification.data.url;
  }
  
  console.log('[SW] Opening URL:', targetUrl);
  
  // Clear badge
  try {
    if ('clearAppBadge' in self.navigator) {
      self.navigator.clearAppBadge();
    }
  } catch (e) {}
  
  event.waitUntil(
    clients.matchAll({ 
      type: 'window', 
      includeUncontrolled: true 
    }).then(function(clientList) {
      // External URL - open new window
      if (targetUrl.startsWith('http')) {
        // Check if URL is same origin
        var isSameOrigin = targetUrl.includes(self.location.origin);
        
        // Try to focus existing window first (for same origin)
        if (isSameOrigin) {
          for (var i = 0; i < clientList.length; i++) {
            var client = clientList[i];
            if (client.url.includes(self.location.origin) && 'focus' in client) {
              if ('navigate' in client && targetUrl !== client.url) {
                return client.navigate(targetUrl).then(function() {
                  return client.focus();
                });
              }
              return client.focus();
            }
          }
        }
        
        // External or no existing window - open new
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
        return;
      }
      
      // Internal URL (starts with /)
      for (var j = 0; j < clientList.length; j++) {
        var c = clientList[j];
        if (c.url.includes(self.location.origin) && 'focus' in c) {
          if ('navigate' in c && targetUrl !== '/') {
            return c.navigate(targetUrl).then(function() {
              return c.focus();
            });
          }
          return c.focus();
        }
      }
      
      // No existing window - open new
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

/* ──────────────────────────────────────────────────────────── */
/* ─── Notification Close ─── */
/* ──────────────────────────────────────────────────────────── */
self.addEventListener('notificationclose', function(event) {
  console.log('[SW] 🔕 Notification closed');
  try {
    if ('clearAppBadge' in self.navigator) {
      self.navigator.clearAppBadge();
    }
  } catch (e) {}
});
