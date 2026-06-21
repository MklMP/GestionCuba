const CACHE = 'gestion-cuba-v4';
const SHELL = ['/', '/index.html', '/styles.css', '/script.js', '/manifest.json', '/icon.svg'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  const path = url.pathname;

  if (path === '/api/productos') {
    e.respondWith(
      fetch(e.request).then((r) => {
        caches.open(CACHE).then((c) => {
          try { c.put(e.request, r.clone()); } catch (_) {}
        }).catch(() => {});
        return r;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  if (SHELL.includes(path)) {
    e.respondWith(
      caches.open(CACHE).then((c) =>
        c.match(e.request, { ignoreSearch: true }).then((cached) => {
          const fetchP = fetch(e.request).then((r) => {
            c.put(e.request, r.clone());
            return r;
          }).catch(() => cached);
          return cached || fetchP;
        })
      )
    );
    return;
  }

  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
